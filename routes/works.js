const express = require("express");
const path = require("path");
const fs = require("fs");
const { authMiddleware } = require("../middleware/auth");
const { exportDataJson } = require("../services/export");

module.exports = function(db) {
    const router = express.Router();

    router.get("/:id", (req, res) => {
        const work = db.get("SELECT * FROM works WHERE id = ? AND is_published = 1", req.params.id);
        if (!work) return res.status(404).json({ error: "作品不存在" });
        res.json({ ...work, hasDownload: !!work.download_file });
    });

    router.post("/", authMiddleware, (req, res) => {
        const { category_id, title, type, thumb, img, video, script, sort_order, is_published } = req.body;
        if (!category_id || !title || !type) return res.status(400).json({ error: "分类、标题和类型不能为空" });
        db.run("INSERT INTO works (category_id, title, type, thumb, img, video, script, sort_order, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            category_id, title, type, thumb || "", img || "", video || "", script || "", sort_order || 0, is_published !== undefined ? (is_published ? 1 : 0) : 1);
        const row = db.get("SELECT last_insert_rowid() as id");
        exportDataJson(db);
        res.json({ success: true, id: row.id });
    });

    router.put("/:id", authMiddleware, (req, res) => {
        const { category_id, title, type, thumb, img, video, script, sort_order, is_published } = req.body;
        db.run("UPDATE works SET category_id=?, title=?, type=?, thumb=?, img=?, video=?, script=?, sort_order=?, is_published=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            category_id, title, type, thumb || "", img || "", video || "", script || "", sort_order || 0, is_published ? 1 : 0, req.params.id);
        exportDataJson(db);
        res.json({ success: true });
    });

    router.delete("/:id", authMiddleware, (req, res) => {
        const id = parseInt(req.params.id);
        const work = db.get("SELECT * FROM works WHERE id = ?", id);
        if (work && work.download_file) {
            const filePath = path.join(__dirname, "..", "uploads", work.download_file);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        db.run("DELETE FROM works WHERE id = ?", id);
        exportDataJson(db);
        res.json({ success: true });
    });

    return router;
};
