const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken, authMiddleware } = require('../middleware/auth');

module.exports = function(db) {
    const router = express.Router();

    // 登录
    router.post('/login', (req, res) => {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '请输入用户名和密码' });
        }

        const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
        if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // Update last login
        db.prepare('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(admin.id);

        const token = generateToken(admin);
        res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
        
        res.json({
            success: true,
            token,
            admin: { id: admin.id, username: admin.username, display_name: admin.display_name }
        });
    });

    // 登出
    router.post('/logout', (req, res) => {
        res.clearCookie('token');
        res.json({ success: true });
    });

    // 获取当前用户信息
    router.get('/me', authMiddleware, (req, res) => {
        const admin = db.prepare('SELECT id, username, display_name, created_at, last_login FROM admins WHERE id = ?').get(req.admin.id);
        res.json(admin);
    });

    // 修改密码
    router.post('/change-password', authMiddleware, (req, res) => {
        const { oldPassword, newPassword } = req.body;
        const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);

        if (!bcrypt.compareSync(oldPassword, admin.password_hash)) {
            return res.status(400).json({ error: '原密码错误' });
        }

        const hash = bcrypt.hashSync(newPassword, 10);
        db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, admin.id);
        res.json({ success: true, message: '密码已更新' });
    });

    return router;
};
