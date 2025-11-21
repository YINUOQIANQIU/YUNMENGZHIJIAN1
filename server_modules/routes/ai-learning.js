// [file name]: server_modules/routes/ai-learning.js (新建文件)
const express = require('express');
const router = express.Router();
const db = require('../database').db;

// 获取全局学习统计
router.get('/global-stats', async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 获取连续学习天数
        const streak = await getLearningStreak(userId);
        
        // 获取周进度
        const weeklyProgress = await getWeeklyProgress(userId);
        
        // 获取已掌握词汇
        const masteredWords = await getMasteredWordsCount(userId);
        
        // 获取今日任务
        const todayTasks = await getTodayTasks(userId);
        
        res.json({
            success: true,
            data: {
                streakDays: streak,
                weeklyProgress: weeklyProgress,
                masteredWords: masteredWords,
                todayTasks: todayTasks,
                lastUpdated: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('获取全局学习统计错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 获取学习连续天数
function getLearningStreak(userId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT COUNT(DISTINCT date) as streak 
            FROM learning_activities 
            WHERE user_id = ? 
            AND date >= DATE('now', '-30 days')
            AND activity_type IN ('vocabulary_study', 'reading', 'listening', 'writing')
        `;
        
        db.get(query, [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row?.streak || 0);
        });
    });
}

// 获取周进度
function getWeeklyProgress(userId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT COUNT(*) as completed,
                   (SELECT COUNT(*) FROM user_learning_tasks 
                    WHERE user_id = ? AND week_start = DATE('now', 'weekday 0', '-7 days')) as total
            FROM user_learning_tasks 
            WHERE user_id = ? 
            AND week_start = DATE('now', 'weekday 0', '-7 days')
            AND status = 'completed'
        `;
        
        db.get(query, [userId, userId], (err, row) => {
            if (err) reject(err);
            else {
                const progress = row && row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
                resolve(progress);
            }
        });
    });
}

// 获取已掌握词汇数
function getMasteredWordsCount(userId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT COUNT(*) as count 
            FROM user_vocabulary 
            WHERE user_id = ? 
            AND mastery_level >= 80
        `;
        
        db.get(query, [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row?.count || 0);
        });
    });
}

// 获取今日任务
function getTodayTasks(userId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT COUNT(*) as count 
            FROM user_learning_tasks 
            WHERE user_id = ? 
            AND due_date = DATE('now')
            AND status = 'pending'
        `;
        
        db.get(query, [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row?.count || 0);
        });
    });
}

// 获取学习活动记录
router.get('/activities', async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 50, offset = 0 } = req.query;
        
        const query = `
            SELECT * FROM learning_activities 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `;
        
        db.all(query, [userId, parseInt(limit), parseInt(offset)], (err, rows) => {
            if (err) {
                res.json({ success: false, message: '查询失败' });
                return;
            }
            
            res.json({
                success: true,
                data: rows,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: rows.length
                }
            });
        });
        
    } catch (error) {
        console.error('获取学习活动错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 记录学习活动
router.post('/activities', async (req, res) => {
    try {
        const userId = req.user.id;
        const { activityType, data, duration, score } = req.body;
        
        const query = `
            INSERT INTO learning_activities 
            (user_id, activity_type, activity_data, duration, score, date)
            VALUES (?, ?, ?, ?, ?, DATE('now'))
        `;
        
        db.run(query, [userId, activityType, JSON.stringify(data), duration, score], function(err) {
            if (err) {
                res.json({ success: false, message: '记录失败' });
                return;
            }
            
            // 更新全局学习统计缓存
            updateLearningStatsCache(userId);
            
            res.json({
                success: true,
                message: '学习活动记录成功',
                activityId: this.lastID
            });
        });
        
    } catch (error) {
        console.error('记录学习活动错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 更新学习统计缓存
function updateLearningStatsCache(userId) {
    // 这里可以实现缓存更新逻辑
    console.log(`更新用户 ${userId} 的学习统计缓存`);
}

module.exports = router;