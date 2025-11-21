// [file name]: auth-middleware.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const JWT_SECRET = process.env.ACCESS_TOKEN_SECRET || 'moyu_zhixue_secret_key_2025';

// JWT认证中间件 - 修复版本
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('🔐 认证中间件 - Token:', token ? `***${token.slice(-8)}` : '无');

    if (!token) {
        console.log('❌ 无Token提供');
        return res.status(401).json({ 
            success: false, 
            message: '访问令牌缺失',
            code: 'TOKEN_MISSING'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('❌ Token验证失败:', err.message);
            return res.status(403).json({ 
                success: false, 
                message: '令牌无效或已过期',
                code: 'TOKEN_INVALID'
            });
        }

        // 🔴 关键修复：确保user对象有id字段
        console.log('✅ Token验证成功，用户:', user);
        
        if (!user.id) {
            console.log('🔄 尝试从其他字段获取用户ID...');
            // 尝试从其他字段获取用户ID
            if (user.userId) {
                user.id = user.userId;
                console.log('✅ 使用userId作为id:', user.id);
            } else if (user._id) {
                user.id = user._id;
                console.log('✅ 使用_id作为id:', user.id);
            } else if (user.username) {
                // 对于基于username的token，使用username作为临时id
                user.id = user.username;
                console.log('✅ 使用username作为id:', user.id);
            } else {
                console.error('❌ 无法确定用户ID，用户对象:', user);
                return res.status(403).json({ 
                    success: false, 
                    message: '令牌中缺少用户身份信息',
                    code: 'USER_ID_MISSING'
                });
            }
        }

        // 添加会话信息
        req.user = {
            ...user,
            sessionId: crypto.randomBytes(16).toString('hex'),
            loginTime: new Date().toISOString()
        };
        
        console.log('✅ 用户认证成功，ID:', req.user.id);
        next();
    });
}

// 可选认证中间件
function optionalAuthenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        // 如果没有token，继续处理（游客模式）
        req.user = null;
        next();
        return;
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // Token无效，但仍然继续处理
            req.user = null;
        } else {
            // 确保用户对象有id字段
            if (user && !user.id) {
                if (user.userId) user.id = user.userId;
                else if (user._id) user.id = user._id;
                else if (user.username) user.id = user.username;
            }
            
            req.user = user ? {
                ...user,
                sessionId: crypto.randomBytes(16).toString('hex'),
                loginTime: new Date().toISOString()
            } : null;
        }
        next();
    });
}

// 学习权限检查中间件
function requireStudyPermission(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: '需要登录才能学习',
            code: 'STUDY_PERMISSION_REQUIRED'
        });
    }
    next();
}

// 评估权限检查中间件
function requireAssessmentPermission(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: '需要登录后进行能力评估',
            code: 'ASSESSMENT_PERMISSION_REQUIRED'
        });
    }
    next();
}

module.exports = {
    authenticateToken,
    optionalAuthenticateToken,
    requireStudyPermission,
    requireAssessmentPermission,
    JWT_SECRET
};