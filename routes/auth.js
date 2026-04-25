const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken, authMiddleware } = require('../middleware/auth');

module.exports = function(db) {
    const router = express.Router();
    router.post('/login', (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });
        const admin = db.get('SELECT * FROM admins WHERE username = ?', username);
        if (!admin || !bcrypt.compareSync(password, admin.password_hash))
            return res.status(401).json({ error: '用户名或密码错误' });
        db.run('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?', admin.id);
        const token = generateToken(admin);
        res.cookie('token', token, { httpOnly: true, maxAge: 7*24*60*60*1000 });
        res.json({ success: true, token, admin: { id: admin.id, username: admin.username, display_name: admin.display_name } });
    });
    router.post('/logout', (req, res) => { res.clearCookie('token'); res.json({ success: true }); });
    router.get('/me', authMiddleware, (req, res) => {
        res.json(db.get('SELECT id, username, display_name, created_at, last_login FROM admins WHERE id = ?', req.admin.id));
    });
    return router;
};
