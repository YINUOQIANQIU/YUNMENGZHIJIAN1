// Vercel Serverless Function 入口
// 将Express应用适配为Vercel Serverless Function

// 设置Vercel环境变量
process.env.VERCEL = '1';
process.env.VERCEL_ENV = process.env.VERCEL_ENV || 'production';

// 导入Express应用（在Vercel环境下会自动导出app而不是启动服务器）
const app = require('../云梦智间服务器.js');

// 导出给Vercel使用
module.exports = app;

