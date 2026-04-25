const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * 版权保护服务
 * 
 * 功能：
 * 1. 为图片注入 EXIF 版权元数据
 * 2. 为图片添加可见水印
 * 3. 为视频/其他文件附加版权信息文件
 * 4. 生成带版权的下载包
 */
class CopyrightService {
    constructor(db) {
        this.db = db;
    }

    getConfig() {
        return this.db.prepare('SELECT * FROM copyright_config LIMIT 1').get() || {
            author_name: 'IDEL',
            copyright_text: '© 2026 IDEL. All rights reserved.',
            website: '',
            email: 'work@idel.com',
            watermark_opacity: 0.15,
            watermark_position: 'bottom-right',
            embed_exif: 1,
            embed_watermark: 1
        };
    }

    updateConfig(config) {
        const existing = this.db.prepare('SELECT id FROM copyright_config LIMIT 1').get();
        if (existing) {
            this.db.prepare(`
                UPDATE copyright_config SET 
                    author_name = ?, copyright_text = ?, website = ?, email = ?,
                    watermark_opacity = ?, watermark_position = ?, embed_exif = ?, embed_watermark = ?
                WHERE id = ?
            `).run(
                config.author_name, config.copyright_text, config.website, config.email,
                config.watermark_opacity, config.watermark_position, 
                config.embed_exif ? 1 : 0, config.embed_watermark ? 1 : 0,
                existing.id
            );
        } else {
            this.db.prepare(`
                INSERT INTO copyright_config (author_name, copyright_text, website, email, watermark_opacity, watermark_position, embed_exif, embed_watermark)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                config.author_name, config.copyright_text, config.website, config.email,
                config.watermark_opacity, config.watermark_position,
                config.embed_exif ? 1 : 0, config.embed_watermark ? 1 : 0
            );
        }
    }

    /**
     * 为图片添加版权水印和 EXIF 数据
     */
    async processImage(inputPath, outputPath, options = {}) {
        const config = this.getConfig();
        const metadata = await sharp(inputPath).metadata();
        const { width, height } = metadata;

        let pipeline = sharp(inputPath);

        // 1. 注入 EXIF 版权数据
        if (config.embed_exif) {
            pipeline = pipeline.withMetadata({
                exif: {
                    IFD0: {
                        Copyright: config.copyright_text,
                        Artist: config.author_name,
                        ImageDescription: `${config.copyright_text} | ${config.email}`,
                    },
                    IFD3: {
                        Copyright: config.copyright_text,
                        Artist: config.author_name,
                    }
                }
            });
        }

        // 2. 添加可见水印
        if (config.embed_watermark) {
            const opacity = config.watermark_opacity || 0.15;
            const fontSize = Math.max(16, Math.floor(width / 40));
            const padding = Math.floor(width / 40);
            
            // 创建 SVG 水印
            const watermarkText = `${config.author_name} © ${new Date().getFullYear()}`;
            const subText = config.website || config.email;

            const svgWatermark = `
                <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.5"/>
                        </filter>
                    </defs>
                    
                    <!-- 全局对角线重复水印 -->
                    <g opacity="${opacity * 0.5}" transform="rotate(-30, ${width/2}, ${height/2})">
                        ${this._generateTiledWatermarks(width, height, watermarkText, fontSize * 0.8)}
                    </g>
                    
                    <!-- 角落主水印 -->
                    <g filter="url(#shadow)">
                        ${this._getPositionSVG(config.watermark_position, width, height, padding, watermarkText, subText, fontSize)}
                    </g>
                </svg>
            `;

            const watermarkBuffer = Buffer.from(svgWatermark);
            pipeline = pipeline.composite([{
                input: watermarkBuffer,
                blend: 'over'
            }]);
        }

        await pipeline.toFile(outputPath);
        return outputPath;
    }

    /**
     * 生成重复的对角线水印图案
     */
    _generateTiledWatermarks(width, height, text, fontSize) {
        const svgs = [];
        const stepX = fontSize * text.length * 2.5;
        const stepY = fontSize * 6;
        
        for (let y = -height; y < height * 2; y += stepY) {
            for (let x = -width; x < width * 2; x += stepX) {
                svgs.push(`<text x="${x}" y="${y}" font-family="sans-serif" font-size="${fontSize}" fill="white" opacity="0.6">${text}</text>`);
            }
        }
        return svgs.join('\n');
    }

    /**
     * 根据位置生成水印 SVG
     */
    _getPositionSVG(position, width, height, padding, mainText, subText, fontSize) {
        const subFontSize = fontSize * 0.6;
        let x, y, anchor;
        
        switch (position) {
            case 'top-left':
                x = padding; y = padding + fontSize; anchor = 'start';
                break;
            case 'top-right':
                x = width - padding; y = padding + fontSize; anchor = 'end';
                break;
            case 'bottom-left':
                x = padding; y = height - padding - subFontSize; anchor = 'start';
                break;
            case 'center':
                x = width / 2; y = height / 2; anchor = 'middle';
                break;
            case 'bottom-right':
            default:
                x = width - padding; y = height - padding - subFontSize; anchor = 'end';
                break;
        }

        return `
            <text x="${x}" y="${y}" font-family="sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="${anchor}" opacity="0.9">${mainText}</text>
            <text x="${x}" y="${y + fontSize + 4}" font-family="sans-serif" font-size="${subFontSize}" fill="white" text-anchor="${anchor}" opacity="0.7">${subText}</text>
        `;
    }

    /**
     * 为非图片文件创建版权说明文件
     */
    createCopyrightFile(outputDir, originalFilename) {
        const config = this.getConfig();
        const date = new Date().toISOString().split('T')[0];
        
        const content = `
╔══════════════════════════════════════════════════════════════╗
║                     版权声明 / COPYRIGHT NOTICE              ║
╚══════════════════════════════════════════════════════════════╝

文件名：${originalFilename}
作者：${config.author_name}
版权：${config.copyright_text}
日期：${date}
联系：${config.email}
网站：${config.website || 'N/A'}

────────────────────────────────────────────────────────────────

使用条款：
1. 本文件及其内容受著作权法保护
2. 未经授权，不得复制、分发、修改或商业使用
3. 仅限个人学习和授权项目使用
4. 如需商业授权，请联系作者

────────────────────────────────────────────────────────────────

Downloaded from IDEL Portfolio
${config.copyright_text}
        `.trim();

        const filePath = path.join(outputDir, `版权说明_${path.parse(originalFilename).name}.txt`);
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }

    /**
     * 处理下载请求：根据文件类型生成带版权的版本
     */
    async processDownload(workId, clientIp, userAgent) {
        const work = this.db.prepare('SELECT * FROM works WHERE id = ?').get(workId);
        if (!work) throw new Error('作品不存在');
        if (!work.download_file) throw new Error('该作品暂无可下载文件');

        const config = this.getConfig();
        const originalPath = path.join(__dirname, '..', 'uploads', work.download_file);
        
        if (!fs.existsSync(originalPath)) throw new Error('文件不存在');

        const ext = path.extname(work.original_filename || work.download_file).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.bmp'].includes(ext);
        
        const timestamp = Date.now();
        const safeName = (work.title || 'download').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
        const outputFilename = `${safeName}_IDEL_${timestamp}${ext}`;
        const outputPath = path.join(__dirname, '..', 'uploads', 'watermarked', outputFilename);

        if (isImage && config.embed_watermark) {
            // 图片：添加水印 + EXIF
            await this.processImage(originalPath, outputPath);
        } else {
            // 非图片：直接复制，但生成版权文件
            fs.copyFileSync(originalPath, outputPath);
            this.createCopyrightFile(path.dirname(outputPath), work.original_filename || outputFilename);
        }

        // 记录下载
        this.db.prepare('INSERT INTO downloads (work_id, ip_address, user_agent) VALUES (?, ?, ?)').run(workId, clientIp, userAgent);
        this.db.prepare('UPDATE works SET download_count = download_count + 1 WHERE id = ?').run(workId);

        return {
            path: outputPath,
            filename: work.original_filename || outputFilename,
            isWatermarked: isImage && config.embed_watermark
        };
    }
}

module.exports = CopyrightService;
