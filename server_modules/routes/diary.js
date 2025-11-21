// [file name]: server_modules/routes/diary.js
const express = require('express');
const router = express.Router();

// 增强错误处理中间件
const handleDatabaseError = (res, error, operation) => {
    console.error(`${operation}失败:`, error);
    return res.status(500).json({ 
        success: false, 
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
};

// 获取正确的数据库实例
const getDatabase = (locals) => {
    return locals.db.db || locals.db;
};

// 获取日记条目列表
router.post('/entries', async (req, res) => {
    try {
        const { page = 1, search = '', tag = '', date = '', mood = '' } = req.body;
        const userId = req.user?.id;
        
        console.log('获取日记请求:', { userId, page, search, tag, date, mood });
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: '用户未认证' 
            });
        }

        const limit = 10;
        const offset = (page - 1) * limit;

        let query = `SELECT * FROM diary_entries WHERE user_id = ?`;
        let params = [userId];
        let countQuery = `SELECT COUNT(*) as total FROM diary_entries WHERE user_id = ?`;
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

        // 执行查询
        const database = getDatabase(req.app.locals);
        
        console.log('执行查询:', query, params);
        
        database.all(query, params, (err, entries) => {
            if (err) {
                console.error('查询日记失败:', err);
                // 如果是表不存在错误，返回空数据
                if (err.message && err.message.includes('no such table')) {
                    console.log('日记表不存在，返回空数据');
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
                return handleDatabaseError(res, err, '查询日记条目');
            }

            console.log(`查询到 ${entries?.length || 0} 条日记`);

            // 获取总数
            database.get(countQuery, countParams, (countErr, countResult) => {
                if (countErr) {
                    console.error('获取总数失败:', countErr);
                }

                const total = countResult?.total || 0;
                const hasMore = (page * limit) < total;

                res.json({
                    success: true,
                    data: {
                        entries: entries || [],
                        hasMore,
                        currentPage: parseInt(page),
                        total,
                        totalPages: Math.ceil(total / limit)
                    }
                });
            });
        });
    } catch (error) {
        console.error('获取日记异常:', error);
        // 捕获其他异常也返回空数据
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

// 保存日记条目
router.post('/save', async (req, res) => {
    try {
        const {
            id,
            title = '',
            content,
            achievements = '',
            tags = '',
            mood = 'normal',
            created_at
        } = req.body;

        const userId = req.user?.id;

        console.log('保存日记请求:', { userId, id, title: title?.substring(0, 50) });

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: '用户未认证' 
            });
        }

        // 验证必填字段
        if (!content?.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: '日记内容不能为空' 
            });
        }

        const database = getDatabase(req.app.locals);
        const now = new Date().toISOString();
        const entryDate = created_at || now;

        if (id) {
            // 更新现有条目 - 修复表名
            const updateQuery = `
                UPDATE diary_entries SET
                title = ?, content = ?, achievements = ?, tags = ?, mood = ?,
                created_at = ?, updated_at = ?
                WHERE id = ? AND user_id = ?
            `;

            database.run(updateQuery, [
                title, content, achievements, tags, mood,
                entryDate, now, id, userId
            ], function(err) {
                if (err) {
                    console.error('更新日记失败:', err);
                    // 如果是表不存在错误，返回特定错误
                    if (err.message && err.message.includes('no such table')) {
                        return res.status(500).json({ 
                            success: false, 
                            message: '日记系统未初始化，请刷新页面重试' 
                        });
                    }
                    return handleDatabaseError(res, err, '更新日记条目');
                }

                if (this.changes === 0) {
                    return res.status(404).json({ 
                        success: false, 
                        message: '日记条目不存在或无权操作' 
                    });
                }

                console.log('日记更新成功:', id);
                res.json({ 
                    success: true, 
                    message: '日记更新成功',
                    data: { id: id }
                });
            });
        } else {
            // 创建新条目 - 修复表名
            const insertQuery = `
                INSERT INTO diary_entries 
                (user_id, title, content, achievements, tags, mood, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            database.run(insertQuery, [
                userId, title, content, achievements, tags, mood, entryDate, now
            ], function(err) {
                if (err) {
                    console.error('创建日记失败:', err);
                    // 如果是表不存在错误，返回特定错误
                    if (err.message && err.message.includes('no such table')) {
                        return res.status(500).json({ 
                            success: false, 
                            message: '日记系统未初始化，请刷新页面重试' 
                        });
                    }
                    return handleDatabaseError(res, err, '创建日记条目');
                }

                console.log('日记创建成功，ID:', this.lastID);
                res.json({ 
                    success: true, 
                    message: '日记保存成功', 
                    data: { id: this.lastID }
                });
            });
        }
    } catch (error) {
        console.error('保存日记异常:', error);
        handleDatabaseError(res, error, '保存日记条目');
    }
});

// 删除日记条目 - 修复表名
router.post('/delete', async (req, res) => {
    try {
        const { id } = req.body;
        const userId = req.user?.id;

        console.log('删除日记请求:', { userId, id });

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: '用户未认证' 
            });
        }

        if (!id) {
            return res.status(400).json({ 
                success: false, 
                message: '日记条目ID不能为空' 
            });
        }

        const database = getDatabase(req.app.locals);
        
        database.run(
            'DELETE FROM diary_entries WHERE id = ? AND user_id = ?',
            [id, userId],
            function(err) {
                if (err) {
                    console.error('删除日记失败:', err);
                    // 如果是表不存在错误，返回特定错误
                    if (err.message && err.message.includes('no such table')) {
                        return res.status(500).json({ 
                            success: false, 
                            message: '日记系统未初始化，请刷新页面重试' 
                        });
                    }
                    return handleDatabaseError(res, err, '删除日记条目');
                }

                if (this.changes === 0) {
                    return res.status(404).json({ 
                        success: false, 
                        message: '日记不存在或无权删除' 
                    });
                }

                console.log('日记删除成功:', id);
                res.json({ 
                    success: true, 
                    message: '日记删除成功' 
                });
            }
        );
    } catch (error) {
        console.error('删除日记异常:', error);
        handleDatabaseError(res, error, '删除日记条目');
    }
});

// 获取标签列表 - 修复表名
router.get('/tags', async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: '用户未认证' 
            });
        }

        const database = getDatabase(req.app.locals);
        // 简化标签获取逻辑
        const query = `
            SELECT tags FROM diary_entries 
            WHERE user_id = ? AND tags IS NOT NULL AND tags != ''
        `;

        database.all(query, [userId], (err, rows) => {
            if (err) {
                console.error('获取标签失败:', err);
                // 如果是表不存在错误，返回默认标签
                if (err.message && err.message.includes('no such table')) {
                    console.log('日记表不存在，返回默认标签');
                    return res.json({
                        success: true,
                        data: ['英语学习', '词汇突破', '听力训练', '写作练习', '阅读理解']
                    });
                }
                return res.json({
                    success: true,
                    data: []
                });
            }

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

            res.json({
                success: true,
                data: Array.from(allTags)
            });
        });
    } catch (error) {
        console.error('获取标签异常:', error);
        res.json({
            success: true,
            data: ['英语学习', '词汇突破', '听力训练', '写作练习', '阅读理解']
        });
    }
});

// 获取统计信息 - 修复表名
router.get('/statistics', async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: '用户未认证' 
            });
        }

        const database = getDatabase(req.app.locals);
        
        // 基础统计查询
        const baseQuery = `SELECT COUNT(*) as count FROM diary_entries WHERE user_id = ?`;
        
        database.get(baseQuery, [userId], (err, totalResult) => {
            if (err) {
                console.error('获取统计失败:', err);
                // 如果是表不存在错误，返回默认统计
                if (err.message && err.message.includes('no such table')) {
                    console.log('日记表不存在，返回默认统计');
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

            const total = totalResult?.count || 0;
            
            // 获取本月日记数
            const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
            const monthQuery = `SELECT COUNT(*) as count FROM diary_entries WHERE user_id = ? AND strftime('%Y-%m', created_at) = ?`;
            
            database.get(monthQuery, [userId, currentMonth], (monthErr, monthResult) => {
                if (monthErr) {
                    console.error('获取本月统计失败:', monthErr);
                }
                
                const recent = monthResult?.count || 0;
                
                // 获取字数统计
                const wordsQuery = `SELECT content FROM diary_entries WHERE user_id = ? AND content IS NOT NULL`;
                
                database.all(wordsQuery, [userId], (wordsErr, wordsRows) => {
                    if (wordsErr) {
                        console.error('获取字数统计失败:', wordsErr);
                    }
                    
                    let totalWords = 0;
                    let maxWords = 0;
                    
                    if (wordsRows && wordsRows.length > 0) {
                        wordsRows.forEach(row => {
                            const wordCount = row.content ? row.content.length : 0;
                            totalWords += wordCount;
                            if (wordCount > maxWords) {
                                maxWords = wordCount;
                            }
                        });
                    }
                    
                    const avgWords = total > 0 ? Math.round(totalWords / total) : 0;
                    
                    res.json({
                        success: true,
                        data: {
                            total: total,
                            recent: recent,
                            avgWords: avgWords,
                            totalWords: totalWords,
                            maxWords: maxWords,
                            byMonth: []
                        }
                    });
                });
            });
        });
    } catch (error) {
        console.error('获取统计异常:', error);
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

// 健康检查接口
router.get('/health', async (req, res) => {
    try {
        const database = getDatabase(req.app.locals);
        
        // 检查日记表是否存在
        database.get("SELECT name FROM sqlite_master WHERE type='table' AND name='diary_entries'", (err, row) => {
            if (err) {
                console.error('健康检查失败:', err);
                return res.json({
                    success: false,
                    message: '数据库查询失败',
                    error: err.message
                });
            }
            
            const tableExists = !!row;
            
            if (tableExists) {
                // 进一步检查表结构
                database.all("PRAGMA table_info(diary_entries)", (tableErr, columns) => {
                    if (tableErr) {
                        console.error('检查表结构失败:', tableErr);
                        return res.json({
                            success: true,
                            data: {
                                tableExists: true,
                                tableStructure: 'unknown',
                                timestamp: new Date().toISOString(),
                                status: 'healthy'
                            }
                        });
                    }
                    
                    res.json({
                        success: true,
                        data: {
                            tableExists: true,
                            tableStructure: 'valid',
                            columnCount: columns ? columns.length : 0,
                            timestamp: new Date().toISOString(),
                            status: 'healthy'
                        }
                    });
                });
            } else {
                res.json({
                    success: true,
                    data: {
                        tableExists: false,
                        tableStructure: 'missing',
                        timestamp: new Date().toISOString(),
                        status: 'table_missing'
                    }
                });
            }
        });
    } catch (error) {
        console.error('健康检查异常:', error);
        res.json({
            success: false,
            message: '健康检查异常',
            error: error.message
        });
    }
});

module.exports = router;