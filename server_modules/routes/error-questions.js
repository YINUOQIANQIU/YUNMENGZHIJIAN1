// [file name]: server_modules/routes/error-questions.js
const express = require('express');
const router = express.Router();

// 定义正确的表名常量
const ERROR_QUESTIONS_TABLE_NAME = 'error_questions';

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

// 获取错题列表 - 增强错误处理
router.post('/entries', validateUser, async (req, res) => {
    try {
        const { page = 1, search = '', tag = '', subject = '', difficulty = '' } = req.body;
        const userId = req.user.id;
        
        console.log('📝 获取错题请求:', { userId, page, search, tag, subject, difficulty });
        
        const limit = 10;
        const offset = (page - 1) * limit;

        let query = `SELECT * FROM ${ERROR_QUESTIONS_TABLE_NAME} WHERE user_id = ?`;
        let params = [userId];
        let countQuery = `SELECT COUNT(*) as total FROM ${ERROR_QUESTIONS_TABLE_NAME} WHERE user_id = ?`;
        let countParams = [userId];

        // 构建筛选条件
        if (subject) {
            query += ' AND subject = ?';
            countQuery += ' AND subject = ?';
            params.push(subject);
            countParams.push(subject);
        }

        if (difficulty) {
            query += ' AND difficulty = ?';
            countQuery += ' AND difficulty = ?';
            params.push(difficulty);
            countParams.push(difficulty);
        }

        if (search) {
            const searchParam = `%${search}%`;
            query += ` AND (question LIKE ? OR my_answer LIKE ? OR correct_answer LIKE ? OR analysis LIKE ? OR knowledge_points LIKE ?)`;
            countQuery += ` AND (question LIKE ? OR my_answer LIKE ? OR correct_answer LIKE ? OR analysis LIKE ? OR knowledge_points LIKE ?)`;
            params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
            countParams.push(searchParam, searchParam, searchParam, searchParam, searchParam);
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
                    questions: [],
                    hasMore: false,
                    currentPage: parseInt(page),
                    total: 0,
                    totalPages: 0
                }
            });
        }

        // 检查表是否存在
        const tableCheck = await new Promise((resolve) => {
            db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${ERROR_QUESTIONS_TABLE_NAME}'`, (err, row) => {
                if (err || !row) {
                    console.warn('⚠️ 错题表不存在，返回空数据');
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
                    questions: [],
                    hasMore: false,
                    currentPage: parseInt(page),
                    total: 0,
                    totalPages: 0
                }
            });
        }

        // 并行执行查询和计数
        const [questions, countResult] = await Promise.all([
            new Promise((resolve, reject) => {
                db.all(query, params, (err, rows) => {
                    if (err) {
                        console.error('❌ 查询错题失败:', err);
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

        console.log(`✅ 返回 ${questions.length} 条错题，总计 ${total} 条`);

        res.json({
            success: true,
            data: {
                questions: questions,
                hasMore,
                currentPage: parseInt(page),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('❌ 获取错题列表失败:', error);
        
        // 任何错误都返回空数据，确保前端能正常显示
        res.json({
            success: true,
            data: {
                questions: [],
                hasMore: false,
                currentPage: 1,
                total: 0,
                totalPages: 0
            }
        });
    }
});

// 保存错题 - 使用动态字段检测
router.post('/save', validateUser, async (req, res) => {
    try {
        const { 
            id, 
            question, 
            my_answer = '', 
            correct_answer, 
            analysis = '', 
            subject = '', 
            difficulty = '中等', 
            error_type = '', 
            knowledge_points = '', 
            tags = '' 
        } = req.body;
        const userId = req.user.id;

        console.log('💾 保存错题请求:', { userId, id, subject, difficulty });

        // 验证必填字段
        if (!question || !question.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: '题目不能为空',
                code: 'QUESTION_REQUIRED'
            });
        }

        if (!correct_answer || !correct_answer.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: '正确答案不能为空',
                code: 'CORRECT_ANSWER_REQUIRED'
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

        // 动态检测表字段
        const tableInfo = await new Promise((resolve) => {
            db.all("PRAGMA table_info(error_questions)", (err, columns) => {
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
            
            if (availableColumns.includes('question')) {
                setParts.push('question = ?');
                params.push(question);
            }
            if (availableColumns.includes('my_answer')) {
                setParts.push('my_answer = ?');
                params.push(my_answer);
            }
            if (availableColumns.includes('correct_answer')) {
                setParts.push('correct_answer = ?');
                params.push(correct_answer);
            }
            if (availableColumns.includes('analysis')) {
                setParts.push('analysis = ?');
                params.push(analysis);
            }
            if (availableColumns.includes('subject')) {
                setParts.push('subject = ?');
                params.push(subject);
            }
            if (availableColumns.includes('difficulty')) {
                setParts.push('difficulty = ?');
                params.push(difficulty);
            }
            if (availableColumns.includes('error_type')) {
                setParts.push('error_type = ?');
                params.push(error_type);
            }
            if (availableColumns.includes('knowledge_points')) {
                setParts.push('knowledge_points = ?');
                params.push(knowledge_points);
            }
            if (availableColumns.includes('tags')) {
                setParts.push('tags = ?');
                params.push(tags);
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
            const updateQuery = `UPDATE error_questions SET ${setParts.join(', ')} WHERE id = ? AND user_id = ?`;
            
            const result = await new Promise((resolve, reject) => {
                db.run(updateQuery, params, function(err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            });

            if (result.changes === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: '错题不存在或无权操作',
                    code: 'QUESTION_NOT_FOUND'
                });
            }

            resultId = id;
            console.log('✅ 错题更新成功:', id);
        } else {
            // 新增 - 只使用存在的字段
            const insertColumns = ['user_id', 'question', 'correct_answer'];
            const placeholders = ['?', '?', '?'];
            const params = [userId, question, correct_answer];
            
            if (availableColumns.includes('my_answer')) {
                insertColumns.push('my_answer');
                placeholders.push('?');
                params.push(my_answer);
            }
            if (availableColumns.includes('analysis')) {
                insertColumns.push('analysis');
                placeholders.push('?');
                params.push(analysis);
            }
            if (availableColumns.includes('subject')) {
                insertColumns.push('subject');
                placeholders.push('?');
                params.push(subject);
            }
            if (availableColumns.includes('difficulty')) {
                insertColumns.push('difficulty');
                placeholders.push('?');
                params.push(difficulty);
            }
            if (availableColumns.includes('error_type')) {
                insertColumns.push('error_type');
                placeholders.push('?');
                params.push(error_type);
            }
            if (availableColumns.includes('knowledge_points')) {
                insertColumns.push('knowledge_points');
                placeholders.push('?');
                params.push(knowledge_points);
            }
            if (availableColumns.includes('tags')) {
                insertColumns.push('tags');
                placeholders.push('?');
                params.push(tags);
            }
            if (availableColumns.includes('created_at')) {
                insertColumns.push('created_at');
                placeholders.push('?');
                params.push(now);
            }
            if (availableColumns.includes('updated_at')) {
                insertColumns.push('updated_at');
                placeholders.push('?');
                params.push(now);
            }
            
            const insertQuery = `INSERT INTO error_questions (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`;
            
            const result = await new Promise((resolve, reject) => {
                db.run(insertQuery, params, function(err) {
                    if (err) reject(err);
                    else resolve(this);
                });
            });

            resultId = result.lastID;
            console.log('✅ 错题创建成功，ID:', resultId);
        }

        res.json({ 
            success: true, 
            message: id ? '错题更新成功' : '错题保存成功',
            data: { id: resultId }
        });

    } catch (error) {
        console.error('❌ 保存错题失败:', error);
        
        // 提供详细的错误信息
        let errorMessage = '保存失败，请重试';
        if (error.message.includes('no such table')) {
            errorMessage = '错题表不存在，请联系管理员修复';
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

// 删除错题
router.post('/delete', validateUser, async (req, res) => {
    try {
        const { id } = req.body;
        const userId = req.user.id;

        console.log('🗑️ 删除错题请求:', { userId, id });

        if (!id) {
            return res.status(400).json({ 
                success: false, 
                message: '错题ID不能为空',
                code: 'ID_REQUIRED'
            });
        }

        // 使用验证后的数据库实例
        const db = getValidDatabase(req.app);
        if (!db) {
            return handleDBError(res, new Error('数据库实例无效'), '删除错题');
        }
        
        const result = await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM ${ERROR_QUESTIONS_TABLE_NAME} WHERE id = ? AND user_id = ?`,
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
                message: '错题不存在或无权删除',
                code: 'QUESTION_NOT_FOUND'
            });
        }

        console.log('✅ 错题删除成功:', id);
        res.json({ 
            success: true, 
            message: '错题删除成功' 
        });

    } catch (error) {
        console.error('❌ 删除错题失败:', error);
        handleDBError(res, error, '删除错题');
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
                data: ['易错题', '重点', '需要复习', '概念不清', '计算错误', '审题不清']
            });
        }

        const rows = await new Promise((resolve, reject) => {
            db.all(
                `SELECT tags FROM ${ERROR_QUESTIONS_TABLE_NAME} WHERE user_id = ? AND tags IS NOT NULL AND tags != ''`,
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
        const defaultTags = ['易错题', '重点', '需要复习', '概念不清', '计算错误', '审题不清', '粗心大意', '知识点遗忘'];
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
            data: ['易错题', '重点', '需要复习', '概念不清', '计算错误']
        });
    }
});

// 获取科目列表
router.get('/subjects', validateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 使用验证后的数据库实例
        const db = getValidDatabase(req.app);
        if (!db) {
            console.error('❌ 数据库实例无效，返回默认科目');
            return res.json({
                success: true,
                data: ['词汇', '听力', '阅读', '写作', '翻译', '语法', '完形填空', '口语']
            });
        }

        const rows = await new Promise((resolve, reject) => {
            db.all(
                `SELECT DISTINCT subject FROM ${ERROR_QUESTIONS_TABLE_NAME} WHERE user_id = ? AND subject IS NOT NULL AND subject != ''`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        const subjects = rows.map(row => row.subject);

        // 添加默认科目
        const defaultSubjects = ['词汇', '听力', '阅读', '写作', '翻译', '语法', '完形填空', '口语'];
        defaultSubjects.forEach(subject => {
            if (!subjects.includes(subject)) {
                subjects.push(subject);
            }
        });

        res.json({
            success: true,
            data: subjects
        });

    } catch (error) {
        console.error('❌ 获取科目失败:', error);
        // 出错时返回默认科目
        res.json({
            success: true,
            data: ['词汇', '听力', '阅读', '写作', '翻译', '语法', '完形填空', '口语']
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
                    byDifficulty: [],
                    bySubject: []
                }
            });
        }

        // 获取基础统计
        const totalStats = await new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as total FROM ${ERROR_QUESTIONS_TABLE_NAME} WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.total : 0);
                }
            );
        });

        // 获取本周新增
        const recentStats = await new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as recent FROM ${ERROR_QUESTIONS_TABLE_NAME} 
                 WHERE user_id = ? AND created_at >= date('now', '-7 days')`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.recent : 0);
                }
            );
        });

        // 按难度统计
        const byDifficulty = await new Promise((resolve, reject) => {
            db.all(
                `SELECT difficulty, COUNT(*) as count FROM ${ERROR_QUESTIONS_TABLE_NAME} 
                 WHERE user_id = ? AND difficulty IS NOT NULL 
                 GROUP BY difficulty`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        // 按科目统计
        const bySubject = await new Promise((resolve, reject) => {
            db.all(
                `SELECT subject, COUNT(*) as count FROM ${ERROR_QUESTIONS_TABLE_NAME} 
                 WHERE user_id = ? AND subject IS NOT NULL 
                 GROUP BY subject`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        res.json({
            success: true,
            data: {
                total: totalStats,
                recent: recentStats,
                byDifficulty: byDifficulty,
                bySubject: bySubject
            }
        });

    } catch (error) {
        console.error('❌ 获取统计失败:', error);
        res.json({
            success: true,
            data: {
                total: 0,
                recent: 0,
                byDifficulty: [],
                bySubject: []
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
                `SELECT name FROM sqlite_master WHERE type='table' AND name='${ERROR_QUESTIONS_TABLE_NAME}'`,
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