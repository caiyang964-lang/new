const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');

module.exports = function(db) {
    const router = express.Router();

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
            let dir = path.join(__dirname, '..', 'uploads', isVideo ? 'videos' : 'images');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + '-' + Math.random().toString(36).substring(2, 8) + path.extname(file.originalname));
        }
    });

    const upload = multer({
        storage,
        limits: { fileSize: 500 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const allowed = /jpeg|jpg|png|gif|webp|tiff|bmp|svg|mp4|mov|avi|mkv|webm|pdf|zip|rar|psd|ai/;
            cb(null, allowed.test(path.extname(file.originalname).toLowerCase()) || file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/'));
        }
    });

    router.post('/file', authMiddleware, upload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: '请选择文件' });
        const ext = path.extname(req.file.originalname).toLowerCase();
        const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
        const subDir = isVideo ? 'videos' : 'images';
        res.json({ success: true, file: {
            path: subDir + '/' + req.file.filename, url: '/uploads/' + subDir + '/' + req.file.filename,
            originalName: req.file.originalname, filename: req.file.filename, size: req.file.size, mimetype: req.file.mimetype
        }});
    });

    router.post('/attach/:workId', authMiddleware, (req, res) => {
        const { file_path, original_filename } = req.body;
        const work = db.get('SELECT * FROM works WHERE id = ?', req.params.workId);
        if (!work) return res.status(404).json({ error: '作品不存在' });
        const fullPath = path.join(__dirname, '..', 'uploads', file_path);
        const fileSize = fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
        db.run('UPDATE works SET download_file=?, original_filename=?, file_size=?, file_type=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
            file_path, original_filename || '', fileSize, path.extname(original_filename || file_path).toLowerCase(), req.params.workId);
        res.json({ success: true });
    });

    router.get('/files', authMiddleware, (req, res) => {
        const files = [];
        ['images', 'videos', 'thumbnails'].forEach(subDir => {
            const dirPath = path.join(__dirname, '..', 'uploads', subDir);
            if (fs.existsSync(dirPath)) {
                fs.readdirSync(dirPath).forEach(filename => {
                    const filePath = path.join(dirPath, filename);
                    const stat = fs.statSync(filePath);
                    files.push({ path: subDir+'/'+filename, url: '/uploads/'+subDir+'/'+filename, filename, size: stat.size, created: stat.birthtime, type: subDir });
                });
            }
        });
        const attached = new Set(db.all('SELECT download_file FROM works WHERE download_file IS NOT NULL AND download_file != ""').map(w => w.download_file));
        files.sort((a, b) => new Date(b.created) - new Date(a.created));
        res.json(files.map(f => ({ ...f, isAttached: attached.has(f.path) })));
    });

    router.delete('/file/:subDir/:filename', authMiddleware, (req, res) => {
        const { subDir, filename } = req.params;
        const filePath = path.join(__dirname, '..', 'uploads', subDir, filename);
        const inUse = db.get('SELECT id FROM works WHERE download_file = ?', subDir+'/'+filename);
        if (inUse) return res.status(400).json({ error: '文件正在使用中' });
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({ success: true });
    });

    return router;
};
