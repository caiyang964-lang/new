const express = require('express');
const path = require('path');
const fs = require('fs');

module.exports = function(db, copyrightService) {
    const router = express.Router();

    // 公开：下载作品（带版权保护）
    router.get('/:workId', async (req, res) => {
        try {
            const work = db.prepare('SELECT * FROM works WHERE id = ? AND is_published = 1').get(req.params.workId);
            if (!work) return res.status(404).json({ error: '作品不存在' });
            if (!work.download_file) return res.status(404).json({ error: '该作品暂无可下载文件' });

            const clientIp = req.ip || req.connection.remoteAddress;
            const userAgent = req.headers['user-agent'] || '';

            // 处理下载（添加版权水印）
            const result = await copyrightService.processDownload(work.id, clientIp, userAgent);

            // 设置下载头
            const ext = path.extname(result.filename).toLowerCase();
            const mimeTypes = {
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                '.webp': 'image/webp', '.gif': 'image/gif', '.tiff': 'image/tiff',
                '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
                '.mkv': 'video/x-matroska', '.webm': 'video/webm',
                '.pdf': 'application/pdf', '.zip': 'application/zip',
                '.psd': 'image/vnd.adobe.photoshop', '.ai': 'application/postscript'
            };

            const contentType = mimeTypes[ext] || 'application/octet-stream';
            const downloadName = result.isWatermarked 
                ? `${work.title}_IDEL_版权保护${ext}`
                : `${work.title}${ext}`;

            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
            res.setHeader('Content-Type', contentType);
            res.setHeader('X-Copyright', copyrightService.getConfig().copyright_text);
            res.setHeader('X-Author', copyrightService.getConfig().author_name);

            const fileStream = fs.createReadStream(result.path);
            fileStream.pipe(res);

            // 清理临时水印文件（延迟删除）
            fileStream.on('end', () => {
                setTimeout(() => {
                    try {
                        if (fs.existsSync(result.path)) fs.unlinkSync(result.path);
                        // Also clean copyright txt files
                        const txtPath = result.path.replace(ext, '.txt');
                        if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
                    } catch (e) { /* ignore */ }
                }, 5000);
            });

        } catch (err) {
            console.error('Download error:', err);
            res.status(500).json({ error: err.message || '下载失败' });
        }
    });

    // 管理：获取下载统计
    router.get('/stats/overview', (req, res) => {
        const totalDownloads = db.prepare('SELECT COUNT(*) as count FROM downloads').get();
        const topWorks = db.prepare(`
            SELECT w.id, w.title, w.download_count, c.title as category_title 
            FROM works w 
            LEFT JOIN categories c ON w.category_id = c.id 
            WHERE w.download_count > 0 
            ORDER BY w.download_count DESC 
            LIMIT 10
        `).all();
        const recentDownloads = db.prepare(`
            SELECT d.*, w.title as work_title 
            FROM downloads d 
            LEFT JOIN works w ON d.work_id = w.id 
            ORDER BY d.downloaded_at DESC 
            LIMIT 20
        `).all();

        res.json({ totalDownloads: totalDownloads.count, topWorks, recentDownloads });
    });

    // 管理：获取版权配置
    router.get('/config/copyright', (req, res) => {
        res.json(copyrightService.getConfig());
    });

    // 管理：更新版权配置
    router.put('/config/copyright', (req, res) => {
        copyrightService.updateConfig(req.body);
        res.json({ success: true, config: copyrightService.getConfig() });
    });

    return router;
};
