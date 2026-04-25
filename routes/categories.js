const express = require('express');
const { authMiddleware } = require('../middleware/auth');

module.exports = function(db) {
    const router = express.Router();

    // 公开：获取所有分类（含作品）
    router.get('/', (req, res) => {
        const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();
        const works = db.prepare('SELECT * FROM works WHERE is_published = 1 ORDER BY sort_order ASC').all();
        
        const result = categories.map(cat => ({
            ...cat,
            works: works.filter(w => w.category_id === cat.id).map(w => ({
                id: w.id,
                title: w.title,
                type: w.type,
                thumb: w.thumb,
                img: w.img,
                video: w.video,
                script: w.script,
                hasDownload: !!w.download_file,
                downloadCount: w.download_count
            }))
        }));
        
        res.json(result);
    });

    // 管理：获取所有分类（含未发布作品）
    router.get('/admin', authMiddleware, (req, res) => {
        const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();
        const works = db.prepare('SELECT * FROM works ORDER BY sort_order ASC').all();
        
        const result = categories.map(cat => ({
            ...cat,
            works: works.filter(w => w.category_id === cat.id)
        }));
        
        res.json(result);
    });

    // 管理：创建分类
    router.post('/', authMiddleware, (req, res) => {
        const { title, label, accent_color, cover, sort_order } = req.body;
        
        if (!title || !label) {
            return res.status(400).json({ error: '标题和标签不能为空' });
        }

        const result = db.prepare(
            'INSERT INTO categories (title, label, accent_color, cover, sort_order) VALUES (?, ?, ?, ?, ?)'
        ).run(title, label, accent_color || '#60a5fa', cover || '', sort_order || 0);

        res.json({ success: true, id: result.lastInsertRowid });
    });

    // 管理：更新分类
    router.put('/:id', authMiddleware, (req, res) => {
        const { title, label, accent_color, cover, sort_order } = req.body;
        
        db.prepare(`
            UPDATE categories SET title = ?, label = ?, accent_color = ?, cover = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(title, label, accent_color, cover, sort_order, req.params.id);

        res.json({ success: true });
    });

    // 管理：删除分类
    router.delete('/:id', authMiddleware, (req, res) => {
        db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    });

    // 管理：调整排序
    router.post('/reorder', authMiddleware, (req, res) => {
        const { order } = req.body; // [{ id, sort_order }]
        const stmt = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?');
        const transaction = db.transaction((items) => {
            items.forEach(item => stmt.run(item.sort_order, item.id));
        });
        transaction(order);
        res.json({ success: true });
    });

    return router;
};
