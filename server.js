const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const fs = require('fs');
const { initDatabase } = require('./db/init');
const CopyrightService = require('./services/copyright');

let db;
let copyrightService;

async function startServer() {
    console.log('🔧 Initializing database...');
    db = await initDatabase();
    console.log('✅ Database ready');

    copyrightService = new CopyrightService(db);

    const app = express();
    const PORT = process.env.PORT || 3000;

    app.use(cors({ origin: true, credentials: true }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, 'public')));
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

    app.use('/api/auth', require('./routes/auth')(db));
    app.use('/api/categories', require('./routes/categories')(db));
    app.use('/api/works', require('./routes/works')(db));
    app.use('/api/upload', require('./routes/upload')(db));
    app.use('/api/download', require('./routes/download')(db, copyrightService));

    app.get('/api/dashboard/stats', require('./middleware/auth').authMiddleware, (req, res) => {
        const categories = db.get('SELECT COUNT(*) as count FROM categories');
        const works = db.get('SELECT COUNT(*) as count FROM works');
        const publishedWorks = db.get('SELECT COUNT(*) as count FROM works WHERE is_published = 1');
        const totalDownloads = db.get('SELECT COUNT(*) as count FROM downloads');
        const recentDownloads = db.all('SELECT d.*, w.title as work_title FROM downloads d LEFT JOIN works w ON d.work_id = w.id ORDER BY d.downloaded_at DESC LIMIT 5');
        const topWorks = db.all('SELECT id, title, download_count FROM works WHERE download_count > 0 ORDER BY download_count DESC LIMIT 5');
        res.json({ categories: categories.count, works: works.count, publishedWorks: publishedWorks.count, totalDownloads: totalDownloads.count, recentDownloads, topWorks });
    });

    app.use((err, req, res, next) => {
        console.error('Error:', err.message);
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: '文件太大' });
        res.status(500).json({ error: err.message || '服务器错误' });
    });

    ['uploads/images', 'uploads/videos', 'uploads/thumbnails', 'uploads/watermarked'].forEach(dir => {
        const fullPath = path.join(__dirname, dir);
        if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
    });

    app.listen(PORT, '0.0.0.0', () => {
        console.log('╔══════════════════════════════════════════════════════╗');
        console.log('║          IDEL Portfolio System v1.0.0                ║');
        console.log('╠══════════════════════════════════════════════════════╣');
        console.log('║  🌐 作品集: http://localhost:' + PORT + '                    ║');
        console.log('║  🔧 管理后台: http://localhost:' + PORT + '/admin              ║');
        console.log('║  默认管理员: admin / admin123                         ║');
        console.log('╚══════════════════════════════════════════════════════╝');
    });
}

startServer().catch(err => { console.error('Failed to start:', err); process.exit(1); });
