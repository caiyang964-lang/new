const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'portfolio.db');
let dbInstance = null;

function saveDB() {
    if (!dbInstance) return;
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

async function initDatabase() {
    if (dbInstance) return wrapDB();

    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        dbInstance = new SQL.Database(buffer);
    } else {
        dbInstance = new SQL.Database();
    }

    const db = wrapDB();

    // Create tables
    db.run('CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, display_name TEXT DEFAULT "管理员", created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login DATETIME)');
    db.run('CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, label TEXT NOT NULL, accent_color TEXT DEFAULT "#60a5fa", cover TEXT DEFAULT "", sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    db.run('CREATE TABLE IF NOT EXISTS works (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL, title TEXT NOT NULL, type TEXT NOT NULL, thumb TEXT DEFAULT "", img TEXT DEFAULT "", video TEXT DEFAULT "", script TEXT DEFAULT "", download_file TEXT DEFAULT "", original_filename TEXT DEFAULT "", file_size INTEGER DEFAULT 0, file_type TEXT DEFAULT "", sort_order INTEGER DEFAULT 0, is_published INTEGER DEFAULT 1, download_count INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    db.run('CREATE TABLE IF NOT EXISTS downloads (id INTEGER PRIMARY KEY AUTOINCREMENT, work_id INTEGER NOT NULL, ip_address TEXT, user_agent TEXT, downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    db.run('CREATE TABLE IF NOT EXISTS copyright_config (id INTEGER PRIMARY KEY AUTOINCREMENT, author_name TEXT DEFAULT "IDEL", copyright_text TEXT DEFAULT "© 2026 IDEL. All rights reserved.", website TEXT DEFAULT "", email TEXT DEFAULT "work@idel.com", watermark_opacity REAL DEFAULT 0.15, watermark_position TEXT DEFAULT "bottom-right", embed_exif INTEGER DEFAULT 1, embed_watermark INTEGER DEFAULT 1)');
    db.run('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT DEFAULT "", message TEXT NOT NULL, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    saveDB();

    // Insert default admin
    const adminExists = db.get('SELECT id FROM admins WHERE username = ?', 'admin');
    if (!adminExists) {
        const hash = bcrypt.hashSync('admin123', 10);
        db.run('INSERT INTO admins (username, password_hash, display_name) VALUES (?, ?, ?)', 'admin', hash, 'IDEL');
        console.log('✅ Default admin created: admin / admin123');
    }

    // Insert default copyright config
    const configExists = db.get('SELECT id FROM copyright_config LIMIT 1');
    if (!configExists) {
        db.run('INSERT INTO copyright_config (author_name, copyright_text, website, email) VALUES (?, ?, ?, ?)', 'IDEL', '© 2026 IDEL. All rights reserved.', 'https://idel.com', 'work@idel.com');
        console.log('✅ Default copyright config created');
    }

    // Insert default categories
    const catCount = db.get('SELECT COUNT(*) as count FROM categories');
    if (catCount.count === 0) {
        db.run('INSERT INTO categories (title, label, accent_color, cover, sort_order) VALUES (?, ?, ?, ?, ?)', 'AI短剧', 'AI Short Film', '#60a5fa', 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&q=80', 1);
        db.run('INSERT INTO categories (title, label, accent_color, cover, sort_order) VALUES (?, ?, ?, ?, ?)', '摄影作品', 'Photography', '#a78bfa', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80', 2);
        db.run('INSERT INTO categories (title, label, accent_color, cover, sort_order) VALUES (?, ?, ?, ?, ?)', '摄像作品', 'Videography', '#34d399', 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80', 3);

        db.run('INSERT INTO works (category_id, title, type, thumb, img, video, script, download_file, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 1, '失落协议 · 序章', 'AI短剧', 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&q=80', '', '在数字荒原中寻找人类最后的体温。', '', 1);
        db.run('INSERT INTO works (category_id, title, type, thumb, img, video, script, download_file, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 1, '失落协议 · 崩塌', 'AI短剧', 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&q=80', '', '系统崩溃前的最后一帧。', '', 2);
        db.run('INSERT INTO works (category_id, title, type, thumb, img, video, script, download_file, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 1, '失落协议 · 重生', 'AI短剧', 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80', '', '废墟之上，新的协议正在被书写。', '', 3);

        db.run('INSERT INTO works (category_id, title, type, thumb, img, video, script, download_file, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 2, '留白 #01', '摄影作品', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80', '', '冷调、大面积留白。', '', 1);
        db.run('INSERT INTO works (category_id, title, type, thumb, img, video, script, download_file, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 2, '留白 #02', '摄影作品', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80', '', '侧面轮廓光。', '', 2);
        db.run('INSERT INTO works (category_id, title, type, thumb, img, video, script, download_file, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 2, '留白 #03', '摄影作品', 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80', '', '过曝风格。', '', 3);

        db.run('INSERT INTO works (category_id, title, type, thumb, img, video, script, download_file, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 3, '城市呼吸 · 上海', '摄像作品', 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80', '', '城市的节奏藏在天际线的轮廓里。', '', 1);
        db.run('INSERT INTO works (category_id, title, type, thumb, img, video, script, download_file, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 3, '海岸线 · 英吉', '摄像作品', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80', '', '浪潮的节拍就是最好的配乐。', '', 2);
        db.run('INSERT INTO works (category_id, title, type, thumb, img, video, script, download_file, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 3, '雨林 · 西双版纳', '摄像作品', 'https://images.unsplash.com/photo-1536147116438-62679a5e01f2?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1536147116438-62679a5e01f2?auto=format&fit=crop&q=80', '', '雨滴是森林的节拍器。', '', 3);

        console.log('✅ Default categories and works created');
    }

    return db;
}

function wrapDB() {
    return {
        run(sql, ...params) {
            if (params.length > 0 && Array.isArray(params[0])) {
                dbInstance.run(sql, params[0]);
            } else if (params.length > 0) {
                dbInstance.run(sql, params);
            } else {
                dbInstance.run(sql);
            }
            saveDB();
        },
        get(sql, ...params) {
            const stmt = dbInstance.prepare(sql);
            if (params.length > 0 && Array.isArray(params[0])) {
                stmt.bind(params[0]);
            } else if (params.length > 0) {
                stmt.bind(params);
            }
            if (stmt.step()) {
                const cols = stmt.getColumnNames();
                const vals = stmt.get();
                stmt.free();
                const row = {};
                cols.forEach((c, i) => row[c] = vals[i]);
                return row;
            }
            stmt.free();
            return undefined;
        },
        all(sql, ...params) {
            const stmt = dbInstance.prepare(sql);
            if (params.length > 0 && Array.isArray(params[0])) {
                stmt.bind(params[0]);
            } else if (params.length > 0) {
                stmt.bind(params);
            }
            const rows = [];
            while (stmt.step()) {
                const cols = stmt.getColumnNames();
                const vals = stmt.get();
                const row = {};
                cols.forEach((c, i) => row[c] = vals[i]);
                rows.push(row);
            }
            stmt.free();
            return rows;
        },
        save() { saveDB(); }
    };
}

module.exports = { initDatabase, DB_PATH };
