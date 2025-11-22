# Railway 部署指南

本指南将帮助您将云梦智间项目部署到 Railway 平台。

## 前置要求

1. Railway 账号（访问 https://railway.app 注册）
2. GitHub 账号（用于连接代码仓库）
3. 项目已推送到 GitHub

## 部署步骤

### 1. 准备项目

确保项目已包含以下文件：
- `package.json` - Node.js 项目配置
- `railway.json` - Railway 配置文件（已创建）
- `云梦智间服务器.js` - 主服务器文件
- 所有必要的依赖和静态文件

### 2. 连接 GitHub 仓库

1. 登录 Railway 控制台
2. 点击 "New Project"
3. 选择 "Deploy from GitHub repo"
4. 授权 Railway 访问您的 GitHub 仓库
5. 选择您的项目仓库

### 3. 配置环境变量

在 Railway 项目设置中添加以下环境变量（可选，有默认值）：

```
PORT=3000                    # Railway 会自动设置，无需手动配置
DATABASE_PATH=./moyu_zhixue.db
NODE_ENV=production
UPLOAD_DIR=./uploads
GAME_UPLOAD_DIR=./game/uploads
GAME_EXPORT_DIR=./game/exports
```

**注意**：Railway 会自动设置 `PORT` 环境变量，无需手动配置。

### 4. 配置持久化存储（重要）

由于 SQLite 数据库需要持久化存储：

1. 在 Railway 项目中，点击 "New" → "Volume"
2. 创建一个持久化卷（Volume）
3. 挂载到项目根目录
4. 数据库文件将保存在持久化卷中，不会在重启时丢失

**或者**：考虑迁移到 Railway 提供的 PostgreSQL 数据库（推荐用于生产环境）

### 5. 部署

Railway 会自动：
1. 检测到 `package.json` 文件
2. 运行 `npm install` 安装依赖
3. 运行 `npm start` 启动服务器

### 6. 获取访问地址

部署完成后，Railway 会提供一个公共 URL，例如：
```
https://your-project-name.up.railway.app
```

## 重要说明

### 数据库持久化

- SQLite 数据库文件需要保存在持久化卷中
- 如果使用 Railway 的 Volume，确保挂载路径正确
- 建议在生产环境使用 PostgreSQL 数据库

### 文件上传

- 上传的文件会保存在项目目录中
- 如果使用持久化卷，文件会持久保存
- 否则文件会在重启时丢失

### 静态文件

- 所有静态文件（HTML、CSS、JS、图片等）会自动提供服务
- 确保所有文件路径使用相对路径

### 端口配置

- Railway 会自动设置 `PORT` 环境变量
- 代码中已使用 `process.env.PORT || 3000`，无需修改

## 故障排查

### 部署失败

1. 检查 `package.json` 中的依赖是否正确
2. 查看 Railway 日志了解错误信息
3. 确保 Node.js 版本兼容（Railway 会自动检测）

### 数据库连接失败

1. 检查数据库路径是否正确
2. 确保持久化卷已正确挂载
3. 查看服务器日志了解详细错误

### 静态文件无法访问

1. 确保文件路径使用相对路径
2. 检查 `express.static` 配置是否正确
3. 查看浏览器控制台网络请求

## 升级到 PostgreSQL（可选）

如果项目需要更好的数据库支持，可以：

1. 在 Railway 中添加 PostgreSQL 服务
2. 获取数据库连接字符串
3. 修改 `server_modules/database.js` 使用 PostgreSQL
4. 更新环境变量 `DATABASE_URL`

## 监控和维护

- Railway 提供实时日志查看
- 可以设置健康检查端点
- 建议定期备份数据库

## 支持

如有问题，请查看：
- Railway 文档：https://docs.railway.app
- 项目 GitHub Issues

