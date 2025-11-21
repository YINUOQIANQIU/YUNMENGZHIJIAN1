// [file name]: server_modules/auth-compat.js
const jwt = require('jsonwebtoken');
// 统一JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'moyu_zhixue_secret_key_2025';

// 修复版：宽松兼容性认证中间件 - 不依赖数据库验证
function authenticateTokenCompat(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.log('⚠️ 无Token访问，使用游客模式');
        // 在兼容模式下，允许无token访问，设置为游客模式
        req.user = {
            id: 0,
            username: 'guest',
            isGuest: true,
            permissions: ['read'] // 基础只读权限
        };
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.warn('⚠️ Token验证失败，使用游客模式:', err.message);
            // Token无效，但不阻止访问，设置为游客模式
            req.user = {
                id: 0,
                username: 'guest',
                isGuest: true,
                permissions: ['read']
            };
            return next();
        }

        console.log('✅ Token验证成功，处理用户信息:', user);
        
        // 灵活的用户信息标准化处理
        let normalizedUser = {
            isGuest: false,
            permissions: ['read', 'write', 'exam'] // 认证用户有更多权限
        };

        // 处理各种可能的用户信息结构
        if (user.id) {
            // 标准格式: { id, username, ... }
            normalizedUser.id = user.id;
            normalizedUser.username = user.username || `user_${user.id}`;
        } else if (user.userId) {
            // 兼容格式: { userId, username, ... }
            normalizedUser.id = user.userId;
            normalizedUser.username = user.username || `user_${user.userId}`;
        } else if (user.user_id) {
            // 兼容格式: { user_id, username, ... }
            normalizedUser.id = user.user_id;
            normalizedUser.username = user.username || `user_${user.user_id}`;
        } else {
            // 未知格式，尝试提取数字ID
            const numericKeys = Object.keys(user).filter(key => 
                typeof user[key] === 'number' && user[key] > 0
            );
            
            if (numericKeys.length > 0) {
                normalizedUser.id = user[numericKeys[0]];
                normalizedUser.username = user.username || `user_${user[numericKeys[0]]}`;
            } else {
                // 最后回退：使用默认认证用户
                normalizedUser.id = 101; // 默认认证用户ID
                normalizedUser.username = user.username || 'authenticated_user';
                console.warn('⚠️ 使用默认认证用户信息');
            }
        }

        // 保留其他原始属性
        Object.keys(user).forEach(key => {
            if (!['id', 'userId', 'user_id', 'username'].includes(key)) {
                normalizedUser[key] = user[key];
            }
        });

        console.log('✅ 兼容性认证成功 - 标准化用户信息:', normalizedUser);
        req.user = normalizedUser;
        next();
    });
}

// 严格认证中间件 - 仅用于需要严格验证的接口
function authenticateTokenStrict(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.log('❌ 严格模式：访问令牌不存在');
        return res.status(401).json({ 
            success: false, 
            message: '访问令牌不存在',
            code: 'TOKEN_REQUIRED'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('❌ 严格模式：Token验证失败:', err.message);
            return res.status(403).json({ 
                success: false, 
                message: '令牌无效或已过期',
                code: 'TOKEN_INVALID'
            });
        }

        // 严格模式下的用户信息验证
        if (!user.id && !user.userId && !user.user_id) {
            console.error('❌ 严格模式：用户信息缺少ID字段');
            return res.status(403).json({ 
                success: false, 
                message: '用户信息格式错误',
                code: 'USER_FORMAT_ERROR'
            });
        }

        let normalizedUser = {};
        
        if (user.id) {
            normalizedUser = { ...user };
        } else if (user.userId) {
            normalizedUser = {
                id: user.userId,
                username: user.username,
                ...user
            };
            delete normalizedUser.userId;
        } else if (user.user_id) {
            normalizedUser = {
                id: user.user_id,
                username: user.username,
                ...user
            };
            delete normalizedUser.user_id;
        }

        console.log('✅ 严格认证成功:', normalizedUser);
        req.user = normalizedUser;
        next();
    });
}

// 调试模式认证 - 开发环境使用
function authenticateTokenDebug(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('🐛 调试认证 - Headers:', req.headers);
    console.log('🐛 调试认证 - Token:', token ? '存在' : '不存在');

    if (!token) {
        // 调试模式下使用测试用户
        req.user = {
            id: 101,
            username: 'debug_user',
            isGuest: false,
            permissions: ['read', 'write', 'exam', 'debug'],
            debug: true
        };
        console.log('🐛 调试模式：使用测试用户');
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.warn('🐛 调试模式：Token验证失败，使用测试用户');
            req.user = {
                id: 101,
                username: 'debug_fallback',
                isGuest: false,
                permissions: ['read', 'write', 'exam'],
                debug: true,
                tokenError: err.message
            };
            return next();
        }

        console.log('🐛 调试模式：原始用户数据:', user);
        
        // 灵活的标准化
        const normalizedUser = {
            id: user.id || user.userId || user.user_id || 101,
            username: user.username || 'debug_authenticated',
            isGuest: false,
            permissions: ['read', 'write', 'exam', 'debug'],
            debug: true,
            ...user
        };

        console.log('🐛 调试模式：标准化用户:', normalizedUser);
        req.user = normalizedUser;
        next();
    });
}

// 权限检查辅助函数
function requireAuth(requiredPermissions = []) {
    return (req, res, next) => {
        if (!req.user || req.user.isGuest) {
            return res.status(401).json({
                success: false,
                message: '需要登录才能访问此功能',
                code: 'AUTH_REQUIRED'
            });
        }

        if (requiredPermissions.length > 0) {
            const userPermissions = req.user.permissions || [];
            const hasPermission = requiredPermissions.every(perm => 
                userPermissions.includes(perm)
            );
            
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: '权限不足',
                    code: 'PERMISSION_DENIED'
                });
            }
        }

        next();
    };
}

// 游客权限检查
function allowGuest(requiredPermissions = ['read']) {
    return (req, res, next) => {
        if (!req.user) {
            // 如果没有用户信息，设置为游客
            req.user = {
                id: 0,
                username: 'guest',
                isGuest: true,
                permissions: ['read']
            };
        }

        const userPermissions = req.user.permissions || [];
        const hasPermission = requiredPermissions.every(perm => 
            userPermissions.includes(perm)
        );
        
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: '权限不足',
                code: 'PERMISSION_DENIED'
            });
        }

        next();
    };
}

module.exports = {
    authenticateTokenCompat,    // 主要使用的兼容性认证
    authenticateTokenStrict,    // 严格认证（用于敏感操作）
    authenticateTokenDebug,     // 调试认证（开发环境）
    requireAuth,                // 权限检查中间件
    allowGuest                  // 游客权限检查
};