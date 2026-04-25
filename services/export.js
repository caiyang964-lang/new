const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

function exportDataJson(db) {
    try {
        const categories = db.all("SELECT * FROM categories ORDER BY sort_order ASC");
        const works = db.all("SELECT * FROM works WHERE is_published = 1 ORDER BY sort_order ASC");
        const data = categories.map(cat => ({
            title: cat.title,
            label: cat.label,
            accent_color: cat.accent_color || "#60a5fa",
            cover: cat.cover || "",
            works: works.filter(w => w.category_id === cat.id).map(w => ({
                id: w.id,
                title: w.title,
                type: w.type,
                thumb: w.thumb || "",
                img: w.img || "",
                video: w.video || "",
                script: w.script || "",
                hasDownload: !!w.download_file
            }))
        }));

        const json = JSON.stringify(data, null, 2);
        const publicPath = path.join(__dirname, "..", "public", "data.json");
        const rootPath = path.join(__dirname, "..", "data.json");
        fs.writeFileSync(publicPath, json);
        fs.writeFileSync(rootPath, json);
        console.log("[export] data.json updated -", data.length, "categories");

        // 自动推送到 GitHub（如果配置了 git remote）
        autoPush();
    } catch (err) {
        console.error("[export] Failed:", err.message);
    }
}

let pushTimer = null;
function autoPush() {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
        const repoDir = path.join(__dirname, "..");
        exec("git add data.json && git commit -m \"auto: sync portfolio data\" && git push origin main", {
            cwd: repoDir,
            timeout: 30000
        }, (err, stdout, stderr) => {
            if (err) {
                console.log("[export] git push skipped:", err.message.split("\\n")[0]);
            } else {
                console.log("[export] pushed to GitHub");
            }
        });
    }, 2000);
}

module.exports = { exportDataJson };
