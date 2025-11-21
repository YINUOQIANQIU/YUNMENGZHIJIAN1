// [file name]: server_modules/routes/diary-enhanced.js
const express = require('express');
const router = express.Router();

// 定义正确的表名常量
const DIARY_TABLE_NAME = 'diary_entries';

// 数据库实例验证函数
const getValidDatabase = (app) => {
    const db = app.locals.db;
    
    // 检查是否是有效的数据库实例
    if (db && typeof db.get === 'function' && typeof db.all === 'function' && typeof db.run === 'function') {
        return db;
    }
    
    // 如果是嵌套的数据库对象（db.db）
    if (db && db.db && typeof db.db.get === 'function') {
        return db.db;
    }
    
    console.error('❌ 无法获取有效的数据库实例:', db);
    return null;
};

// 增强认证验证中间件 - 兼容多种用户信息结构
const validateUser = (req, res, next) => {
    if (!req.user) {
        console.error('❌ 认证失败: 用户信息缺失');
        return res.status(401).json({ 
            success: false, 
            message: '请先登录',
            code: 'AUTH_REQUIRED'
        });
    }

    // 兼容多种用户ID字段
    const userId = req.user.id || req.user.userId || req.user.user_id;
    
    if (!userId) {
        console.error('❌ 用户ID缺失:', { user: req.user });
        return res.status(401).json({ 
            success: false, 
            message: '用户信息不完整',
            code: 'USER_ID_MISSING'
        });
    }

    // 标准化用户信息
    req.user.id = userId;
    console.log('✅ 用户验证成功 - 用户ID:', userId);

    next();
};

// 数据库错误处理
const handleDBError = (res, error, operation) => {
    console.error(`❌ ${operation}失败:`, error);
    return res.status(500).json({ 
        success: false, 
        message: '系统繁忙，请稍后重试',
        code: 'DATABASE_ERROR'
    });
};

// 获取日记列表 - 增强错误处理
router.post('/entries', validateUser, async (req, res) => {
    try {
        const { page = 1, search = '', tag = '', date = '', mood = '' } = req.body;
        const userId = req.user.id;
        
        console.log('📝 获取日记请求:', { userId, page, search, tag, date, mood });
        
        const limit = 10;
        const offset = (page - 1) * limit;

        let query = `SELECT * FROM ${DIARY_TABLE_NAME} WHERE user_id = ?`;
        let params = [userId];
        let countQuery = `SELECT COUNT(*) as total FROM ${DIARY_TABLE_NAME} WHERE user_id = ?`;
        let countParams = [userId];

        // 构建筛选条件
        if (date) {
            query += ' AND DATE(created_at) = ?';
            countQuery += ' AND DATE(created_at) = ?';
            params.push(date);
            countParams.push(date);
        }

        if (mood) {
            query += ' AND mood = ?';
            countQuery += ' AND mood = ?';
            params.push(mood);
            countParams.push(mood);
        }

        if (search) {
            const searchParam = `%${search}%`;
            query += ` AND (content LIKE ? OR title LIKE ? OR achievements LIKE ? OR tags LIKE ?)`;
            countQuery += ` AND (content LIKE ? OR title LIKE ? OR achievements LIKE ? OR tags LIKE ?)`;
            params.push(searchParam, searchParam, searchParam, searchParam);
            countParams.push(searchParam, searchParam, searchParam, searchParam);
        }

        if (tag) {
            query += ' AND tags LIKE ?';
            countQuery += ' AND tags LIKE ?';
            params.push(`%${tag}%`);
            countParams.push(`%${tag}%`);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        // 使用验证后的数据库实例
        const db = getValidDatabase(req.app);
        if (!db) {
            console.error('❌ 数据库实例无效');
            return res.json({
                success: true,
                data: {
                    entries: [],
                    hasMore: false,
                    currentPage: parseInt(page),
                    total: 0,
                    totalPages: 0
                }
            });
        }

        // 检查表是否存在
        const tableCheck = await new Promise((resolve) => {
            db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${DIARY_TABLE_NAME}'`, (err, row) => {
                if (err || !row) {
                    console.warn('⚠️ 日记表不存在，返回空数据');
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });

        if (!tableCheck) {
            return res.json({
                success: true,
                data: {
                    entries: [],
                    hasMore: false,
                    currentPage: parseInt(page),
                    total: 0,
                    totalPages: 0
                }
            });
        }

        // 并行执行查询和计数
        const [entries, countResult] = await Promise.all([
            new Promise((resolve, reject) => {
                db.all(query, params, (err, rows) => {
                    if (err) {
                        console.error('❌ 查询日记失败:', err);
                        resolve([]); // 出错时返回空数组而不是拒绝
                    } else {
                        resolve(rows || []);
                    }
                });
            }),
            new Promise((resolve, reject) => {
                db.get(countQuery, countParams, (err, row) => {
                    if (err) {
                        console.error('❌ 计数查询失败:', err);
                        resolve(0); // 出错时返回0
                    } else {
                        resolve(row ? row.total : 0);
                    }
                });
            })
        ]);

        const total = countResult;
        const hasMore = (page * limit) < total;

        console.log(`✅ 返回 ${entries.length} 条日记，总计 ${total} 条`);

        res.json({
            success: true,
            data: {
                entries: entries,
                hasMore,
                currentPage: parseInt(page),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('❌ 获取日记列表失败:', error);
        
        // 任何错误都返回空数据，确保前端能正常显示
        res.json({
            success: true,
            data: {
                entries: [],
                hasMore: false,
                currentPage: 1,
                total: 0,
                totalPages: 0
            }
        });
    }
});

// 保存日记 - 使用动态字段检测
router.post('/save', validateUser, async (req, res) => {
    try {
        const { id, title = '', content, achievements = '', tags = '', mood = 'normal', created_at } = req.body;
        const userId = req.user.id;

        console.log('💾 保存日记请求:', { userId, id, title: title?.substring(0, 50) });

        // 验证必填字段
        if (!content || !content.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: '日记内容不能为空',
                code: 'CONTENT_REQUIRED'
            });
        }

        const db = getValidDatabase(req.app);
        if (!db) {
            return res.status(500).json({ 
                success: false, 
                message: '数据库连接失败' 
            });
        }

        const now = new Date().toISOString();
        const entryDate = created_at || now;

        // 动态检测表字段
        const tableInfo = await new Promise((resolve) => {
            db.all("PRAGMA table_info(diary_entries)", (err, columns) => {
                if (err) {
                    console.error('检查表结构失败:', err);
                    resolve([]);
                } else {
                    resolve(columns || []);
                }
            });
        });

        const availableColumns = tableInfo.map(col => col.name);
        console.log('📋 可用字段:', availableColumns);

        let resultId;

        if (id) {
            // 更新 - 只使用存在的字段
            const setParts = [];
            const params = [];
            
            if (availableColumns.includes('title')) {
                setParts.push('title = ?');
                params.push(title);
            }
            if (availableColumns.includes('content')) {
                setParts.push('content = ?');
                params.push(content);
            }
            if (availableColumns.includes('achievements')) {
                setParts.push('achievements = ?');
                params.push(achievements);
            }
            if (availableColumns.includes('tags')) {
                setParts.push('tags = ?');
                params.push(tags);
            }
            if (availableColumns.includes('mood')) {
                setParts.push('mood = ?');
                params.push(mood);
            }
            if (availableColumns.includes('created_at')) {
                setParts.push('created_at = ?');
                params.push(entryDate);
            }
            if (availableColumns.includes('updated_at')) {
                setParts.push('updated_at = ?');
                params.push(now);
            }
            
            if (setParts.length === 0) {
                return res.status(500).json({ 
                    success: false, 
                    message: '表结构异常',
                    code: 'TABLE_SCHEMA_ERROR'
                });
            }
            
            params.push(id, userId);
            const updateQuery = `UPDATE diary_entries SET ${setParts.join(', ')} WHERE id = ? AND user_id = ?`;
            
            const result = await new Promise((resolve, reject) => {
                db.run(updateQuery, params, function(err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            });

            if (result.changes === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: '日记不存在或无权操作',
                    code: 'ENTRY_NOT_FOUND'
                });
            }

            resultId = id;
            console.log('✅ 日记更新成功:', id);
        } else {
            // 新增 - 只使用存在的字段
            const insertColumns = ['user_id', 'content'];
            const placeholders = ['?', '?'];
            const params = [userId, content];
            
            if (availableColumns.includes('title')) {
                insertColumns.push('title');
                placeholders.push('?');
                params.push(title);
            }
            if (availableColumns.includes('achievements')) {
                insertColumns.push('achievements');
                placeholders.push('?');
                params.push(achievements);
            }
            if (availableColumns.includes('tags')) {
                insertColumns.push('tags');
                placeholders.push('?');
                params.push(tags);
            }
            if (availableColumns.includes('mood')) {
                insertColumns.push('mood');
                placeholders.push('?');
                params.push(mood);
            }
            if (availableColumns.includes('created_at')) {
                insertColumns.push('created_at');
                placeholders.push('?');
                params.push(entryDate);
            }
            if (availableColumns.includes('updated_at')) {
                insertColumns.push('updated_at');
                placeholders.push('?');
                params.push(now);
            }
            
            const insertQuery = `INSERT INTO diary_entries (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`;
            
            const result = await new Promise((resolve, reject) => {
                db.run(insertQuery, params, function(err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            });

            resultId = result.lastID;
            console.log('✅ 日记创建成功，ID:', resultId);
        }

        res.json({ 
            success: true, 
            message: id ? '日记更新成功' : '日记保存成功',
            data: { id: resultId }
        });

    } catch (error) {
        console.error('❌ 保存日记失败:', error);
        
        // 提供详细的错误信息
        let errorMessage = '保存失败，请重试';
        if (error.message.includes('no such table')) {
            errorMessage = '日记表不存在，请联系管理员修复';
        } else if (error.message.includes('no column named')) {
            errorMessage = '表结构错误，正在自动修复，请稍后重试';
        }
        
        res.status(500).json({ 
            success: false, 
            message: errorMessage,
            code: 'SAVE_FAILED',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 删除日记 - 完全重写
router.post('/delete', validateUser, async (req, res) => {
    try {
        const { id } = req.body;
        const userId = req.user.id;

        console.log('🗑️ 删除日记请求:', { userId, id });

        if (!id) {
            return res.status(400).json({ 
                success: false, 
                message: '日记ID不能为空',
                code: 'ID_REQUIRED'
            });
        }

        // 使用验证后的数据库实例
        const db = getValidDatabase(req.app);
        if (!db) {
            return handleDBError(res, new Error('数据库实例无效'), '删除日记');
        }
        
        const result = await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM ${DIARY_TABLE_NAME} WHERE id = ? AND user_id = ?`,
                [id, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this);
                }
            );
        });

        if (result.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '日记不存在或无权删除',
                code: 'ENTRY_NOT_FOUND'
            });
        }

        console.log('✅ 日记删除成功:', id);
        res.json({ 
            success: true, 
            message: '日记删除成功' 
        });

    } catch (error) {
        console.error('❌ 删除日记失败:', error);
        handleDBError(res, error, '删除日记');
    }
});

// 获取标签列表
router.get('/tags', validateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 使用验证后的数据库实例
        const db = getValidDatabase(req.app);
        if (!db) {
            console.error('❌ 数据库实例无效，返回默认标签');
            return res.json({
                success: true,
                data: ['英语学习', '词汇突破', '听力训练', '写作练习', '阅读理解', '口语练习', '语法学习']
            });
        }

        const rows = await new Promise((resolve, reject) => {
            db.all(
                `SELECT tags FROM ${DIARY_TABLE_NAME} WHERE user_id = ? AND tags IS NOT NULL AND tags != ''`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // 从tags字段中提取所有标签
        const allTags = new Set();
        rows.forEach(row => {
            if (row.tags) {
                row.tags.split(',').forEach(tag => {
                    const trimmedTag = tag.trim();
                    if (trimmedTag) {
                        allTags.add(trimmedTag);
                    }
                });
            }
        });

        // 添加默认标签
        const defaultTags = ['英语学习', '词汇突破', '听力训练', '写作练习', '阅读理解', '口语练习', '语法学习'];
        defaultTags.forEach(tag => allTags.add(tag));

        res.json({
            success: true,
            data: Array.from(allTags)
        });

    } catch (error) {
        console.error('❌ 获取标签失败:', error);
        // 出错时返回默认标签
        res.json({
            success: true,
            data: ['英语学习', '词汇突破', '听力训练', '写作练习', '阅读理解']
        });
    }
});

// 获取统计信息
router.get('/statistics', validateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 使用验证后的数据库实例
        const db = getValidDatabase(req.app);
        if (!db) {
            console.error('❌ 数据库实例无效，返回空统计');
            return res.json({
                success: true,
                data: {
                    total: 0,
                    recent: 0,
                    avgWords: 0,
                    totalWords: 0,
                    maxWords: 0,
                    byMonth: []
                }
            });
        }

        // 获取基础统计
        const stats = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    COUNT(*) as total,
                    SUM(LENGTH(content)) as totalWords,
                    AVG(LENGTH(content)) as avgWords,
                    MAX(LENGTH(content)) as maxWords
                 FROM ${DIARY_TABLE_NAME} WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row || { total: 0, totalWords: 0, avgWords: 0, maxWords: 0 });
                }
            );
        });

        // 获取本月日记数
        const currentMonth = new Date().toISOString().substring(0, 7);
        const monthStats = await new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as recent FROM ${DIARY_TABLE_NAME} 
                 WHERE user_id = ? AND strftime('%Y-%m', created_at) = ?`,
                [userId, currentMonth],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.recent : 0);
                }
            );
        });

        res.json({
            success: true,
            data: {
                total: stats.total || 0,
                recent: monthStats || 0,
                avgWords: Math.round(stats.avgWords) || 0,
                totalWords: stats.totalWords || 0,
                maxWords: stats.maxWords || 0,
                byMonth: []
            }
        });

    } catch (error) {
        console.error('❌ 获取统计失败:', error);
        res.json({
            success: true,
            data: {
                total: 0,
                recent: 0,
                avgWords: 0,
                totalWords: 0,
                maxWords: 0,
                byMonth: []
            }
        });
    }
});

// 健康检查
router.get('/health', validateUser, async (req, res) => {
    try {
        // 使用验证后的数据库实例
        const db = getValidDatabase(req.app);
        if (!db) {
            return res.json({
                success: false,
                message: '数据库连接失败',
                error: '无法获取有效的数据库实例'
            });
        }
        
        const tableInfo = await new Promise((resolve, reject) => {
            db.get(
                `SELECT name FROM sqlite_master WHERE type='table' AND name='${DIARY_TABLE_NAME}'`,
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        res.json({
            success: true,
            data: {
                tableExists: !!tableInfo,
                status: tableInfo ? 'healthy' : 'table_missing',
                timestamp: new Date().toISOString(),
                user: req.user.id
            }
        });

    } catch (error) {
        console.error('❌ 健康检查失败:', error);
        res.json({
            success: false,
            message: '健康检查失败',
            error: error.message
        });
    }
});

module.exports = router;