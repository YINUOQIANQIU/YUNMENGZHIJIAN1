# Vercel 部署指南

本指南将帮助您将云梦智间项目部署到 Vercel 平台。

## ⚠️ 重要限制说明

### 数据库限制
- **Vercel Serverless Functions 不支持 SQLite 数据库**
- SQLite 需要文件系统持久化，而 Vercel 的 Serverless Functions 是只读文件系统
- **解决方案**：
  1. **推荐**：使用 Vercel Postgres 或外部数据库服务（如 Supabase、PlanetScale）
  2. **临时方案**：使用内存数据库（数据会在函数重启时丢失，仅用于测试）

### 文件上传限制
- Vercel Serverless Functions 不支持本地文件系统写入
- 上传的文件需要使用外部存储服务（如 AWS S3、Cloudinary、Vercel Blob）

## 前置要求

1. Vercel 账号（访问 https://vercel.com 注册，可使用 GitHub 账号登录）
2. GitHub 账号（用于连接代码仓库）
3. 项目已推送到 GitHub

## 部署步骤

### 1. 准备项目

确保项目已包含以下文件：
- `package.json` - Node.js 项目配置
- `vercel.json` - Vercel 配置文件（已创建）
- `api/index.js` - Vercel Serverless Function 入口（已创建）
- `云梦智间服务器.js` - Express 服务器文件

### 2. 连接 GitHub 仓库

1. 登录 Vercel 控制台（https://vercel.com/dashboard）
2. 点击 "Add New..." → "Project"
3. 选择 "Import Git Repository"
4. 授权 Vercel 访问您的 GitHub 仓库
5. 选择您的项目仓库

### 3. 配置项目设置

Vercel 会自动检测项目配置，但您需要：

1. **Framework Preset**: 选择 "Other" 或让 Vercel 自动检测
2. **Root Directory**: 保持默认（项目根目录）
3. **Build Command**: 留空（Vercel 会自动处理）
4. **Output Directory**: 留空
5. **Install Command**: `npm install`（默认）

### 4. 配置环境变量

在 Vercel 项目设置中添加以下环境变量：

```
# 数据库配置（如果使用外部数据库）
DATABASE_URL=your-database-connection-string

# 数据库路径（仅用于本地开发，Vercel不支持SQLite）
DATABASE_PATH=./moyu_zhixue.db

# Node环境
NODE_ENV=production

# JWT密钥（用于用户认证）
JWT_SECRET=your-secret-key-here-change-in-production

# 文件上传配置（如果使用外部存储）
UPLOAD_SERVICE=s3  # 或 cloudinary, vercel-blob
UPLOAD_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### 5. 部署

点击 "Deploy" 按钮，Vercel 会：
1. 安装依赖（`npm install`）
2. 构建项目
3. 部署到全球 CDN

### 6. 获取访问地址

部署完成后，Vercel 会提供：
- **生产环境 URL**: `https://your-project-name.vercel.app`
- **预览环境 URL**: 每次 Git push 都会创建新的预览部署

## 数据库迁移方案

### 方案 1：使用 Vercel Postgres（推荐）

1. 在 Vercel 项目中添加 Postgres 数据库
2. 获取连接字符串
3. 修改 `server_modules/database.js` 使用 PostgreSQL 而不是 SQLite
4. 迁移现有数据

### 方案 2：使用 Supabase（推荐）

1. 在 Supabase 创建项目
2. 获取 PostgreSQL 连接字符串
3. 修改数据库配置
4. 迁移数据

### 方案 3：使用 PlanetScale（MySQL）

1. 在 PlanetScale 创建数据库
2. 获取连接字符串
3. 修改数据库配置使用 MySQL
4. 迁移数据

### 方案 4：临时使用内存数据库（仅测试）

仅用于功能测试，数据不会持久化。

## 文件上传迁移方案

### 方案 1：使用 Vercel Blob Storage

```javascript
import { put } from '@vercel/blob';

const blob = await put(file.name, file, {
  access: 'public',
});
```

### 方案 2：使用 AWS S3

```javascript
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

await s3.upload({
  Bucket: process.env.UPLOAD_BUCKET,
  Key: file.name,
  Body: file.buffer,
}).promise();
```

### 方案 3：使用 Cloudinary

```javascript
const cloudinary = require('cloudinary').v2;

const result = await cloudinary.uploader.upload(file.path);
```

## 项目结构

```
项目根目录/
├── api/
│   └── index.js          # Vercel Serverless Function 入口
├── vercel.json           # Vercel 配置文件
├── package.json          # 项目依赖配置
├── 云梦智间服务器.js     # Express 应用
└── ...其他文件
```

## 路由配置

`vercel.json` 已配置：
- `/api/*` → 路由到 `api/index.js`（Serverless Function）
- 静态文件（HTML、CSS、JS、图片等）→ 直接提供
- 其他请求 → 路由到 `api/index.js`

## 故障排查

### 部署失败

1. **检查构建日志**：在 Vercel 控制台查看详细错误信息
2. **检查依赖**：确保 `package.json` 中所有依赖都正确
3. **检查 Node.js 版本**：Vercel 默认使用 Node.js 18.x

### 数据库连接失败

1. **SQLite 不支持**：Vercel 不支持 SQLite，必须使用外部数据库
2. **检查连接字符串**：确保环境变量 `DATABASE_URL` 正确
3. **检查网络**：确保 Vercel 可以访问您的数据库

### 静态文件无法访问

1. **检查文件路径**：确保使用相对路径
2. **检查 vercel.json**：确保路由配置正确
3. **检查文件大小**：Vercel 有文件大小限制

### API 路由返回 404

1. **检查路由配置**：确保 `vercel.json` 中的路由规则正确
2. **检查函数超时**：默认超时 10 秒，可在 `vercel.json` 中调整
3. **检查日志**：在 Vercel 控制台查看函数执行日志

## 性能优化

1. **函数超时设置**：已在 `vercel.json` 中设置为 60 秒
2. **缓存策略**：静态文件会自动缓存
3. **CDN 加速**：所有文件通过全球 CDN 提供

## 监控和维护

- Vercel 提供实时日志查看
- 可以设置 Webhook 通知
- 建议使用 Vercel Analytics 监控性能

## 本地开发

本地开发时，项目会正常启动 Express 服务器：

```bash
npm start
```

服务器会在 `http://localhost:3000` 启动。

## 支持

如有问题，请查看：
- Vercel 文档：https://vercel.com/docs
- Vercel 社区：https://github.com/vercel/vercel/discussions
- 项目 GitHub Issues

## 注意事项

1. **SQLite 不支持**：必须迁移到外部数据库
2. **文件上传**：必须使用外部存储服务
3. **函数超时**：默认 10 秒，已调整为 60 秒
4. **冷启动**：Serverless Functions 有冷启动时间
5. **成本**：Vercel 免费版有使用限制，超出需要付费

