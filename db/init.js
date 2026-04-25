const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'portfolio.db');

let dbInstance = null;

async function initDatabase() {
    if (dbInstance) return dbInstance;

    const SQL = await initSqlJs();
    
    // Load existing database or create new one
    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        dbInstance = new SQL.Database(buffer);
    } else {
        dbInstance = new SQL.Database();
    }

    // Helper: persist database to disk
    function saveDB() {
        const data = dbInstance.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }

    // Helper: wrap db to provide a simpler API similar to better-sqlite3
    const db = {
        exec(sql) {
            dbInstance.run(sql);
            saveDB();
        },
        prepare(sql) {
            return {
                run(...params) {
                    dbInstance.run(sql, params);
                    saveDB();
                    return { lastInsertRowid: dbInstance.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] || 0 };
                },
                get(...params) {
                    const stmt = dbInstance.prepare(sql);
                    stmt.bind(params);
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
                all(...params) {
                    const stmt = dbInstance.prepare(sql);
                    stmt.bind(params);
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
                }
            };
        },
        pragma(str) {
            dbInstance.run(`PRAGMA ${str}`);
        },
        transaction(fn) {
            return function(...args) {
                dbInstance.run('BEGIN TRANSACTION');
                try {
                    fn(...args);
                    dbInstance.run('COMMIT');
                    saveDB();
                } catch (e) {
                    dbInstance.run('ROLLBACK');
                    throw e;
                }
            };
        },
        save() { saveDB(); }
    };

    // Enable WAL mode
    db.pragma('journal_mode = WAL');

    // Create tables
    db.exec(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT DEFAULT '管理员',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        );

        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            label TEXT NOT NULL,
            accent_color TEXT DEFAULT '#60a5fa',
            cover TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS works (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            type TEXT NOT NULL,
            thumb TEXT DEFAULT '',
            img TEXT DEFAULT '',
            video TEXT DEFAULT '',
            script TEXT DEFAULT '',
            download_file TEXT DEFAULT '',
            original_filename TEXT DEFAULT '',
            file_size INTEGER DEFAULT 0,
            file_type TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0,
            is_published INTEGER DEFAULT 1,
            download_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS downloads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            work_id INTEGER NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS copyright_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author_name TEXT DEFAULT 'IDEL',
            copyright_text TEXT DEFAULT '© 2026 IDEL. All rights reserved.',
            website TEXT DEFAULT '',
            email TEXT DEFAULT 'work@idel.com',
            watermark_opacity REAL DEFAULT 0.15,
            watermark_position TEXT DEFAULT 'bottom-right',
            embed_exif INTEGER DEFAULT 1,
            embed_watermark INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            subject TEXT DEFAULT '',
            message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Insert default admin
    const adminExists = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
    if (!adminExists) {
        const hash = bcrypt.hashSync('admin123', 10);
        db.prepare('INSERT INTO admins (username, password_hash, display_name) VALUES (?, ?, ?)').run('admin', hash, 'IDEL');
        console.log('✅ Default admin created: admin / admin123');
    }

    // Insert default copyright config
    const configExists = db.prepare('SELECT id FROM copyright_config LIMIT 1').get();
    if (!configExists) {
        db.prepare(`INSERT INTO copyright_config (author_name, copyright_text, website, email) VALUES (?, ?, ?, ?)`).run(
            'IDEL', '© 2026 IDEL. All rights reserved. 未经授权禁止转载和商业使用。', 'https://idel.com', 'work@idel.com'
        );
        console.log('✅ Default copyright config created');
    }

    // Insert default categories
    const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
    if (catCount.count === 0) {
        const insertCat = db.prepare('INSERT INTO categories (title, label, accent_color, cover, sort_order) VALUES (?, ?, ?, ?, ?)');
        const insertWork = db.prepare(`INSERT INTO works (category_id, title, type, thumb, img, video, script, download_file, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        const cat1 = insertCat.run('AI短剧', 'AI Short Film', '#60a5fa', 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&q=80', 1);
        insertWork.run(cat1.lastInsertRowid, '失落协议 · 序章', 'AI短剧', 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&q=80', '', '在数字荒原中寻找人类最后的体温。当所有协议都被遗忘，唯有意图还在燃烧。', '', 1);
        insertWork.run(cat1.lastInsertRowid, '失落协议 · 崩塌', 'AI短剧', 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&q=80', '', '系统崩溃前的最后一帧，数据碎片化为雪花。', '', 2);
        insertWork.run(cat1.lastInsertRowid, '失落协议 · 重生', 'AI短剧', 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80', '', '废墟之上，新的协议正在被书写。这一次，由人类执笔。', '', 3);

        const cat2 = insertCat.run('摄影作品', 'Photography', '#a78bfa', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80', 2);
        insertWork.run(cat2.lastInsertRowid, '留白 #01', '摄影作品', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80', '', '拍摄脚本：冷调、大面积留白。人与空间的对话。', '', 1);
        insertWork.run(cat2.lastInsertRowid, '留白 #02', '摄影作品', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80', '', '拍摄脚本：侧面轮廓光。克制的情绪表达。', '', 2);
        insertWork.run(cat2.lastInsertRowid, '留白 #03', '摄影作品', 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80', '', '拍摄脚本：过曝风格。光即是主题。', '', 3);

        const cat3 = insertCat.run('摄像作品', 'Videography', '#34d399', 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80', 3);
        insertWork.run(cat3.lastInsertRowid, '城市呼吸 · 上海', '摄像作品', 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80', '', '城市的节奏藏在天际线的轮廓里。日出时分，光影交织如同城市的呼吸。', '', 1);
        insertWork.run(cat3.lastInsertRowid, '海岸线 · 英吉', '摄像作品', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80', '', '浪潮的节拍就是最好的配乐。每一帧都是大自然的即兴表演。', '', 2);
        insertWork.run(cat3.lastInsertRowid, '雨林 · 西双版纳', '摄像作品', 'https://images.unsplash.com/photo-1536147116438-62679a5e01f2?auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1536147116438-62679a5e01f2?auto=format&fit=crop&q=80', '', '雨滴是森林的节拍器。每一棵树都在雨中跳着缓慢的华尔兹。', '', 3);

        console.log('✅ Default categories and works created');
    }

    return db;
}

module.exports = { initDatabase, DB_PATH };
