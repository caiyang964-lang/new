const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'portfolio-jwt-secret-key-change-in-production';

function authMiddleware(req, res, next) {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: '未登录，请先登录' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
}

function generateToken(admin) {
    return jwt.sign(
        { id: admin.id, username: admin.username, display_name: admin.display_name },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

module.exports = { authMiddleware, generateToken, JWT_SECRET };
