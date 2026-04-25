const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { exportDataJson } = require("../services/export");

module.exports = function(db) {
    const router = express.Router();

    router.get("/", (req, res) => {
        const categories = db.all("SELECT * FROM categories ORDER BY sort_order ASC");
        const works = db.all("SELECT * FROM works WHERE is_published = 1 ORDER BY sort_order ASC");
        const result = categories.map(cat => ({
            ...cat,
            works: works.filter(w => w.category_id === cat.id).map(w => ({
                id: w.id, title: w.title, type: w.type, thumb: w.thumb, img: w.img,
                video: w.video, script: w.script, hasDownload: !!w.download_file, downloadCount: w.download_count
            }))
        }));
        res.json(result);
    });

    router.get("/admin", authMiddleware, (req, res) => {
        const categories = db.all("SELECT * FROM categories ORDER BY sort_order ASC");
        const works = db.all("SELECT * FROM works ORDER BY sort_order ASC");
        res.json(categories.map(cat => ({ ...cat, works: works.filter(w => w.category_id === cat.id) })));
    });

    router.post("/", authMiddleware, (req, res) => {
        const { title, label, accent_color, cover, sort_order } = req.body;
        if (!title || !label) return res.status(400).json({ error: "标题和标签不能为空" });
        db.run("INSERT INTO categories (title, label, accent_color, cover, sort_order) VALUES (?, ?, ?, ?, ?)",
            title, label, accent_color || "#60a5fa", cover || "", sort_order || 0);
        const row = db.get("SELECT last_insert_rowid() as id");
        exportDataJson(db);
        res.json({ success: true, id: row.id });
    });

    router.put("/:id", authMiddleware, (req, res) => {
        const { title, label, accent_color, cover, sort_order } = req.body;
        db.run("UPDATE categories SET title=?, label=?, accent_color=?, cover=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            title, label, accent_color, cover, sort_order, req.params.id);
        exportDataJson(db);
        res.json({ success: true });
    });

    router.delete("/:id", authMiddleware, (req, res) => {
        const id = parseInt(req.params.id);
        db.run("DELETE FROM works WHERE category_id = ?", id);
        db.run("DELETE FROM categories WHERE id = ?", id);
        exportDataJson(db);
        res.json({ success: true });
    });

    return router;
};
