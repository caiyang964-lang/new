# IDEL Portfolio System

作品集网站 + 管理后台 + 版权保护系统

## 功能

### 🌐 作品集网站 (前端)
- 从 API 动态加载作品数据
- 保留所有原有动画效果（流体背景、文字磁力交互、滚动视差）
- 真实的文件下载功能（带版权保护）
- 响应式设计，支持移动端

### 🔧 管理后台
- **仪表盘** — 作品统计、下载数据概览
- **分类管理** — 增删改查分类，支持排序和主题色
- **作品管理** — 创建/编辑/删除作品，上传文件，发布控制
- **文件管理** — 拖拽上传，文件绑定，预览和删除
- **下载统计** — 下载排行、最近下载记录
- **版权设置** — 配置水印透明度、位置、EXIF 注入等

### © 版权保护系统
- **图片水印** — 自动添加可见水印（对角线重复 + 角落标识）
- **EXIF 注入** — 为图片注入 Copyright、Artist 等元数据
- **版权文件** — 非图片文件自动生成版权声明文本
- **下载追踪** — 记录每次下载的 IP、时间、User-Agent
- **可配置** — 水印透明度、位置、是否启用 EXIF 等

## 快速开始

```bash
cd portfolio-system
npm install
npm start
```

打开：
- 作品集: http://localhost:3000
- 管理后台: http://localhost:3000/admin
- API: http://localhost:3000/api

默认管理员: `admin` / `admin123`

## 目录结构

```
portfolio-system/
├── server.js              # Express 主服务器
├── package.json
├── db/
│   └── init.js            # SQLite 数据库初始化
├── middleware/
│   └── auth.js            # JWT 认证中间件
├── routes/
│   ├── auth.js            # 登录/登出
│   ├── categories.js      # 分类 CRUD
│   ├── works.js           # 作品 CRUD
│   ├── upload.js          # 文件上传
│   └── download.js        # 版权下载
├── services/
│   └── copyright.js       # 版权水印服务
├── public/
│   ├── index.html         # 作品集前端
│   └── admin/
│       └── index.html     # 管理后台
└── uploads/               # 上传文件存储
    ├── images/
    ├── videos/
    ├── thumbnails/
    └── watermarked/       # 临时水印文件
```

## API 文档

### 公开接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/categories` | 获取所有分类（含已发布作品） |
| GET | `/api/works/:id` | 获取单个作品详情 |
| GET | `/api/download/:workId` | 下载作品（带版权保护） |

### 管理接口（需登录）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/categories/admin` | 获取所有分类（含未发布） |
| POST | `/api/categories` | 创建分类 |
| PUT | `/api/categories/:id` | 更新分类 |
| DELETE | `/api/categories/:id` | 删除分类 |
| POST | `/api/works` | 创建作品 |
| PUT | `/api/works/:id` | 更新作品 |
| DELETE | `/api/works/:id` | 删除作品 |
| POST | `/api/upload/file` | 上传文件 |
| POST | `/api/upload/attach/:workId` | 绑定文件到作品 |
| GET | `/api/dashboard/stats` | 仪表盘统计 |
| GET | `/api/download/config/copyright` | 获取版权配置 |
| PUT | `/api/download/config/copyright` | 更新版权配置 |

## 部署

### 环境变量
```bash
PORT=3000                    # 服务端口
JWT_SECRET=your-secret-key   # JWT 密钥
```

### 生产环境建议
1. 修改默认管理员密码
2. 设置强 JWT_SECRET
3. 使用 PM2 或 systemd 管理进程
4. 配置 Nginx 反向代理
5. 使用 HTTPS
