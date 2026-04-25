const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');

module.exports = function(db) {
    const router = express.Router();

    // Multer 配置
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
            const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.bmp', '.svg'].includes(ext);
            
            let dir;
            if (isVideo) {
                dir = path.join(__dirname, '..', 'uploads', 'videos');
            } else if (isImage) {
                dir = path.join(__dirname, '..', 'uploads', 'images');
            } else {
                dir = path.join(__dirname, '..', 'uploads', 'images'); // default
            }
            
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            const name = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
            cb(null, name);
        }
    });

    const upload = multer({
        storage,
        limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
        fileFilter: (req, file, cb) => {
            const allowedTypes = /jpeg|jpg|png|gif|webp|tiff|bmp|svg|mp4|mov|avi|mkv|webm|pdf|zip|rar|psd|ai/;
            const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
            const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/');
            
            if (extname || mimetype) {
                cb(null, true);
            } else {
                cb(new Error('不支持的文件类型'));
            }
        }
    });

    // 上传作品文件
    router.post('/file', authMiddleware, upload.single('file'), (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: '请选择文件' });
        }

        const ext = path.extname(req.file.originalname).toLowerCase();
        const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
        const subDir = isVideo ? 'videos' : 'images';
        
        const relativePath = `${subDir}/${req.file.filename}`;
        
        res.json({
            success: true,
            file: {
                path: relativePath,
                url: `/uploads/${relativePath}`,
                originalName: req.file.originalname,
                filename: req.file.filename,
                size: req.file.size,
                mimetype: req.file.mimetype
            }
        });
    });

    // 上传缩略图
    router.post('/thumbnail', authMiddleware, upload.single('thumbnail'), (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: '请选择缩略图' });
        }

        const relativePath = `thumbnails/${req.file.filename}`;
        const destDir = path.join(__dirname, '..', 'uploads', 'thumbnails');
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        
        // Move file to thumbnails directory
        const oldPath = req.file.path;
        const newPath = path.join(destDir, req.file.filename);
        fs.renameSync(oldPath, newPath);

        res.json({
            success: true,
            file: {
                path: relativePath,
                url: `/uploads/${relativePath}`,
                filename: req.file.filename,
                size: req.file.size
            }
        });
    });

    // 绑定文件到作品
    router.post('/attach/:workId', authMiddleware, (req, res) => {
        const { file_path, original_filename } = req.body;
        const work = db.prepare('SELECT * FROM works WHERE id = ?').get(req.params.workId);
        
        if (!work) return res.status(404).json({ error: '作品不存在' });

        // Get file size
        const fullPath = path.join(__dirname, '..', 'uploads', file_path);
        const fileSize = fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
        const ext = path.extname(original_filename || file_path).toLowerCase();

        db.prepare(`
            UPDATE works SET download_file = ?, original_filename = ?, file_size = ?, file_type = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(file_path, original_filename || '', fileSize, ext, req.params.workId);

        res.json({ success: true });
    });

    // 获取上传列表
    router.get('/files', authMiddleware, (req, res) => {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        const files = [];
        
        ['images', 'videos', 'thumbnails'].forEach(subDir => {
            const dirPath = path.join(uploadDir, subDir);
            if (fs.existsSync(dirPath)) {
                fs.readdirSync(dirPath).forEach(filename => {
                    const filePath = path.join(dirPath, filename);
                    const stat = fs.statSync(filePath);
                    files.push({
                        path: `${subDir}/${filename}`,
                        url: `/uploads/${subDir}/${filename}`,
                        filename,
                        size: stat.size,
                        created: stat.birthtime,
                        type: subDir
                    });
                });
            }
        });

        // Check which files are attached to works
        const works = db.prepare('SELECT download_file FROM works WHERE download_file IS NOT NULL AND download_file != ""').all();
        const attachedFiles = new Set(works.map(w => w.download_file));

        files.sort((a, b) => new Date(b.created) - new Date(a.created));
        res.json(files.map(f => ({ ...f, isAttached: attachedFiles.has(f.path) })));
    });

    // 删除上传文件
    router.delete('/file/:subDir/:filename', authMiddleware, (req, res) => {
        const { subDir, filename } = req.params;
        const filePath = path.join(__dirname, '..', 'uploads', subDir, filename);
        
        // Check if file is in use
        const relativePath = `${subDir}/${filename}`;
        const inUse = db.prepare('SELECT id FROM works WHERE download_file = ?').get(relativePath);
        if (inUse) {
            return res.status(400).json({ error: '该文件正在被作品使用，请先解绑' });
        }

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        res.json({ success: true });
    });

    return router;
};
