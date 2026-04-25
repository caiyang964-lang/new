const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const fs = require('fs');
const { initDatabase } = require('./db/init');
const CopyrightService = require('./services/copyright');

// Initialize database
console.log('🔧 Initializing database...');
const db = initDatabase();
console.log('✅ Database ready');

// Initialize copyright service
const copyrightService = new CopyrightService(db);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth')(db));
app.use('/api/categories', require('./routes/categories')(db));
app.use('/api/works', require('./routes/works')(db));
app.use('/api/upload', require('./routes/upload')(db));
app.use('/api/download', require('./routes/download')(db, copyrightService));

// Dashboard stats
app.get('/api/dashboard/stats', require('./middleware/auth').authMiddleware, (req, res) => {
    const categories = db.prepare('SELECT COUNT(*) as count FROM categories').get();
    const works = db.prepare('SELECT COUNT(*) as count FROM works').get();
    const publishedWorks = db.prepare('SELECT COUNT(*) as count FROM works WHERE is_published = 1').get();
    const totalDownloads = db.prepare('SELECT COUNT(*) as count FROM downloads').get();
    const recentDownloads = db.prepare(`
        SELECT d.*, w.title as work_title 
        FROM downloads d 
        LEFT JOIN works w ON d.work_id = w.id 
        ORDER BY d.downloaded_at DESC LIMIT 5
    `).all();
    const topWorks = db.prepare(`
        SELECT id, title, download_count FROM works 
        WHERE download_count > 0 
        ORDER BY download_count DESC LIMIT 5
    `).all();

    res.json({
        categories: categories.count,
        works: works.count,
        publishedWorks: publishedWorks.count,
        totalDownloads: totalDownloads.count,
        recentDownloads,
        topWorks
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: '文件太大，最大支持 500MB' });
    }
    res.status(500).json({ error: err.message || '服务器错误' });
});

// Ensure upload directories exist
['uploads/images', 'uploads/videos', 'uploads/thumbnails', 'uploads/watermarked'].forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║          IDEL Portfolio System v1.0.0                ║
╠══════════════════════════════════════════════════════╣
║  🌐 作品集: http://localhost:${PORT}                    ║
║  🔧 管理后台: http://localhost:${PORT}/admin              ║
║  📡 API: http://localhost:${PORT}/api                   ║
║                                                      ║
║  默认管理员: admin / admin123                         ║
╚══════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
