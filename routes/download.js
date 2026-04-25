const express = require('express');
const path = require('path');
const fs = require('fs');

module.exports = function(db, copyrightService) {
    const router = express.Router();

    router.get('/:workId', async (req, res) => {
        try {
            const work = db.get('SELECT * FROM works WHERE id = ? AND is_published = 1', req.params.workId);
            if (!work) return res.status(404).json({ error: '作品不存在' });
            if (!work.download_file) return res.status(404).json({ error: '该作品暂无可下载文件' });

            const clientIp = req.ip || req.connection.remoteAddress;
            const userAgent = req.headers['user-agent'] || '';
            const result = await copyrightService.processDownload(work.id, clientIp, userAgent);

            const ext = path.extname(result.filename).toLowerCase();
            const mimeTypes = { '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4','.mov':'video/quicktime','.pdf':'application/pdf','.zip':'application/zip' };
            const downloadName = result.isWatermarked ? work.title+'_IDEL_版权保护'+ext : work.title+ext;

            res.setHeader('Content-Disposition', 'attachment; filename="'+encodeURIComponent(downloadName)+'"');
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');

            const fileStream = fs.createReadStream(result.path);
            fileStream.pipe(res);
            fileStream.on('end', () => {
                setTimeout(() => { try { if (fs.existsSync(result.path)) fs.unlinkSync(result.path); } catch(e){} }, 5000);
            });
        } catch (err) {
            console.error('Download error:', err);
            res.status(500).json({ error: err.message || '下载失败' });
        }
    });

    router.get('/stats/overview', (req, res) => {
        const total = db.get('SELECT COUNT(*) as count FROM downloads');
        const topWorks = db.all('SELECT w.id, w.title, w.download_count, c.title as category_title FROM works w LEFT JOIN categories c ON w.category_id = c.id WHERE w.download_count > 0 ORDER BY w.download_count DESC LIMIT 10');
        const recent = db.all('SELECT d.*, w.title as work_title FROM downloads d LEFT JOIN works w ON d.work_id = w.id ORDER BY d.downloaded_at DESC LIMIT 20');
        res.json({ totalDownloads: total.count, topWorks, recentDownloads: recent });
    });

    router.get('/config/copyright', (req, res) => { res.json(copyrightService.getConfig()); });
    router.put('/config/copyright', (req, res) => { copyrightService.updateConfig(req.body); res.json({ success: true, config: copyrightService.getConfig() }); });

    return router;
};
