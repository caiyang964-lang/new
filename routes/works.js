const express = require('express');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');

module.exports = function(db) {
    const router = express.Router();

    // 公开：获取单个作品详情
    router.get('/:id', (req, res) => {
        const work = db.prepare('SELECT * FROM works WHERE id = ? AND is_published = 1').get(req.params.id);
        if (!work) return res.status(404).json({ error: '作品不存在' });
        
        res.json({
            ...work,
            hasDownload: !!work.download_file
        });
    });

    // 管理：创建作品
    router.post('/', authMiddleware, (req, res) => {
        const { category_id, title, type, thumb, img, video, script, sort_order, is_published } = req.body;
        
        if (!category_id || !title || !type) {
            return res.status(400).json({ error: '分类、标题和类型不能为空' });
        }

        const result = db.prepare(`
            INSERT INTO works (category_id, title, type, thumb, img, video, script, sort_order, is_published)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(category_id, title, type, thumb || '', img || '', video || '', script || '', sort_order || 0, is_published !== undefined ? is_published : 1);

        res.json({ success: true, id: result.lastInsertRowid });
    });

    // 管理：更新作品
    router.put('/:id', authMiddleware, (req, res) => {
        const { category_id, title, type, thumb, img, video, script, sort_order, is_published } = req.body;
        
        db.prepare(`
            UPDATE works SET 
                category_id = ?, title = ?, type = ?, thumb = ?, img = ?, video = ?, script = ?,
                sort_order = ?, is_published = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(category_id, title, type, thumb || '', img || '', video || '', script || '', sort_order || 0, is_published ? 1 : 0, req.params.id);

        res.json({ success: true });
    });

    // 管理：删除作品
    router.delete('/:id', authMiddleware, (req, res) => {
        const work = db.prepare('SELECT * FROM works WHERE id = ?').get(req.params.id);
        if (work && work.download_file) {
            const filePath = path.join(__dirname, '..', 'uploads', work.download_file);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        db.prepare('DELETE FROM works WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    });

    // 管理：批量发布/取消发布
    router.post('/toggle-publish', authMiddleware, (req, res) => {
        const { ids, is_published } = req.body;
        const stmt = db.prepare('UPDATE works SET is_published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        const transaction = db.transaction((items) => {
            items.forEach(id => stmt.run(is_published ? 1 : 0, id));
        });
        transaction(ids);
        res.json({ success: true });
    });

    // 管理：调整排序
    router.post('/reorder', authMiddleware, (req, res) => {
        const { order } = req.body;
        const stmt = db.prepare('UPDATE works SET sort_order = ? WHERE id = ?');
        const transaction = db.transaction((items) => {
            items.forEach(item => stmt.run(item.sort_order, item.id));
        });
        transaction(order);
        res.json({ success: true });
    });

    // 公开：下载记录统计
    router.get('/:id/stats', (req, res) => {
        const work = db.prepare('SELECT download_count, created_at FROM works WHERE id = ?').get(req.params.id);
        const recentDownloads = db.prepare('SELECT downloaded_at, ip_address FROM downloads WHERE work_id = ? ORDER BY downloaded_at DESC LIMIT 10').all(req.params.id);
        res.json({ ...work, recentDownloads });
    });

    return router;
};
