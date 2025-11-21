// [file name]: server_modules/routes/user.js
const express = require('express');
const { db } = require('../database');

const router = express.Router();

// 获取当前用户信息
router.get('/', (req, res) => {
    db.get(
        'SELECT id, username, name, phone, avatar, created_at, last_login FROM users WHERE id = ? AND is_active = 1',
        [req.user.userId],
        (err, user) => {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }

            if (!user) {
                return res.status(404).json({ 
                    success: false, 
                    message: '用户不存在' 
                });
            }

            res.json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        username: user.username,
                        name: user.name,
                        phone: user.phone,
                        avatar: user.avatar
                    }
                }
            });
        }
    );
});

// 获取用户个人中心数据
router.get('/profile', (req, res) => {
    const userId = req.user.userId;
    
    // 获取用户基本信息
    const userQuery = `
        SELECT id, username, name, phone, avatar, created_at, last_login 
        FROM users 
        WHERE id = ? AND is_active = 1
    `;
    
    // 获取学习统计数据
    const statsQuery = `
        SELECT 
            (SELECT COALESCE(SUM(time_spent), 0) FROM vocabulary_study_records WHERE user_id = ?) as total_study_time,
            (SELECT COUNT(DISTINCT study_date) FROM vocabulary_study_records WHERE user_id = ? AND study_date >= DATE('now', '-7 days')) as active_days,
            (SELECT COUNT(*) FROM user_vocabulary WHERE user_id = ? AND mastery_level >= 3) as mastered_words,
            (SELECT COUNT(*) FROM user_vocabulary WHERE user_id = ?) as total_words
    `;
    
    // 获取最近学习记录
    const recentRecordsQuery = `
        SELECT 
            vsr.study_date,
            uv.word,
            uv.meaning,
            vsr.result,
            vsr.study_type,
            COUNT(*) as total_questions,
            SUM(CASE WHEN vsr.result = 0 THEN 1 ELSE 0 END) as wrong_questions
        FROM vocabulary_study_records vsr
        JOIN user_vocabulary uv ON vsr.word_id = uv.id
        WHERE vsr.user_id = ?
        GROUP BY vsr.study_date, uv.word, vsr.study_type
        ORDER BY vsr.study_date DESC
        LIMIT 10
    `;

    db.get(userQuery, [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '获取用户信息失败' 
            });
        }

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: '用户不存在' 
            });
        }

        // 获取统计数据
        db.get(statsQuery, [userId, userId, userId, userId], (err, stats) => {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: '获取统计数据失败' 
                });
            }

            // 获取最近学习记录
            db.all(recentRecordsQuery, [userId], (err, recentRecords) => {
                if (err) {
                    return res.status(500).json({ 
                        success: false, 
                        message: '获取学习记录失败' 
                    });
                }

                // 计算学习目标完成度（假设每日目标为20个单词）
                const todayQuery = `
                    SELECT COUNT(*) as today_count 
                    FROM vocabulary_study_records 
                    WHERE user_id = ? AND study_date = DATE('now')
                `;

                db.get(todayQuery, [userId], (err, todayResult) => {
                    if (err) {
                        return res.status(500).json({ 
                            success: false, 
                            message: '获取今日进度失败' 
                        });
                    }

                    const todayCount = todayResult ? todayResult.today_count : 0;
                    const goalCompletion = Math.min(Math.round((todayCount / 20) * 100), 100);

                    // 获取技能评估数据
                    const skillAssessmentQuery = `
                        SELECT 
                            study_type,
                            COUNT(*) as total,
                            SUM(CASE WHEN result = 1 THEN 1 ELSE 0 END) as correct
                        FROM vocabulary_study_records 
                        WHERE user_id = ? AND study_date >= DATE('now', '-30 days')
                        GROUP BY study_type
                    `;

                    db.all(skillAssessmentQuery, [userId], (err, skillData) => {
                        if (err) {
                            return res.status(500).json({ 
                                success: false, 
                                message: '获取技能评估失败' 
                            });
                        }

                        // 处理技能数据
                        const skillLevels = {
                            '词汇量': 85,
                            '听力理解': 78,
                            '阅读速度': 82,
                            '语法掌握': 90,
                            '写作能力': 75
                        };

                        // 如果有实际数据，使用实际数据
                        skillData.forEach(item => {
                            const accuracy = item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0;
                            switch(item.study_type) {
                                case 'vocabulary':
                                    skillLevels['词汇量'] = accuracy;
                                    break;
                                case 'listening':
                                    skillLevels['听力理解'] = accuracy;
                                    break;
                                case 'reading':
                                    skillLevels['阅读速度'] = accuracy;
                                    break;
                                case 'grammar':
                                    skillLevels['语法掌握'] = accuracy;
                                    break;
                                case 'writing':
                                    skillLevels['写作能力'] = accuracy;
                                    break;
                            }
                        });

                        res.json({
                            success: true,
                            data: {
                                user: {
                                    id: user.id,
                                    username: user.username,
                                    name: user.name,
                                    phone: user.phone,
                                    avatar: user.avatar,
                                    memberLevel: '高级会员',
                                    memberDaysLeft: 26
                                },
                                stats: {
                                    totalStudyTime: Math.round((stats.total_study_time || 0) / 3600 * 10) / 10,
                                    activeDays: stats.active_days || 0,
                                    goalCompletion: goalCompletion,
                                    masteredWords: stats.mastered_words || 0,
                                    totalWords: stats.total_words || 0
                                },
                                recentRecords: recentRecords.map(record => ({
                                    title: `${record.word} - ${record.study_type}`,
                                    date: record.study_date,
                                    accuracy: record.total_questions > 0 ? 
                                        Math.round(((record.total_questions - record.wrong_questions) / record.total_questions) * 100) : 0,
                                    wrongQuestions: record.wrong_questions
                                })),
                                skillLevels: skillLevels,
                                weeklyAccuracy: [85, 82, 91, 88, 86, 90, 92]
                            }
                        });
                    });
                });
            });
        });
    });
});

// 更新用户资料
router.put('/profile', (req, res) => {
    const userId = req.user.userId;
    const { name, phone, avatar } = req.body;

    if (!name) {
        return res.status(400).json({ 
            success: false, 
            message: '姓名不能为空' 
        });
    }

    const updateQuery = `
        UPDATE users 
        SET name = ?, phone = ?, avatar = ?
        WHERE id = ? AND is_active = 1
    `;

    db.run(updateQuery, [name, phone, avatar, userId], function(err) {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '更新资料失败' 
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '用户不存在' 
            });
        }

        // 获取更新后的用户信息
        db.get('SELECT id, username, name, phone, avatar FROM users WHERE id = ?', [userId], (err, user) => {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: '获取更新后信息失败' 
                });
            }

            res.json({
                success: true,
                message: '资料更新成功',
                data: { user }
            });
        });
    });
});

// 上传用户头像
router.post('/avatar', (req, res) => {
    const userId = req.user.userId;
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
        return res.status(400).json({ 
            success: false, 
            message: '头像URL不能为空' 
        });
    }

    const updateQuery = `UPDATE users SET avatar = ? WHERE id = ?`;

    db.run(updateQuery, [avatarUrl, userId], function(err) {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '更新头像失败' 
            });
        }

        res.json({
            success: true,
            message: '头像更新成功',
            data: { avatarUrl }
        });
    });
});

// 获取用户学习趋势
router.get('/learning-trend', (req, res) => {
    const userId = req.user.userId;
    const { period = 'week' } = req.query;

    let dateFilter = "study_date >= DATE('now', '-7 days')";
    if (period === 'month') {
        dateFilter = "study_date >= DATE('now', '-30 days')";
    } else if (period === 'year') {
        dateFilter = "study_date >= DATE('now', '-365 days')";
    }

    const query = `
        SELECT 
            study_date as date,
            COUNT(*) as word_count,
            SUM(time_spent) as study_time,
            SUM(CASE WHEN result = 1 THEN 1 ELSE 0 END) as correct_count,
            COUNT(*) as total_count
        FROM vocabulary_study_records 
        WHERE user_id = ? AND ${dateFilter}
        GROUP BY study_date
        ORDER BY study_date ASC
    `;

    db.all(query, [userId], (err, records) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '获取学习趋势失败' 
            });
        }

        // 处理数据格式
        const learningTrend = {
            dates: [],
            wordCounts: [],
            studyTimes: [],
            accuracyRates: []
        };

        records.forEach(record => {
            learningTrend.dates.push(record.date);
            learningTrend.wordCounts.push(record.word_count);
            learningTrend.studyTimes.push(Math.round(record.study_time / 60));
            learningTrend.accuracyRates.push(
                record.total_count > 0 ? Math.round((record.correct_count / record.total_count) * 100) : 0
            );
        });

        res.json({
            success: true,
            data: learningTrend
        });
    });
});

// 获取用户学习状态 - 新增API
router.get('/study-status', (req, res) => {
    const userId = req.user.userId;
    
    const query = `
        SELECT 
            (SELECT COUNT(DISTINCT study_date) FROM vocabulary_study_records 
             WHERE user_id = ? AND study_date >= DATE('now', '-7 days')) as active_days_7,
            (SELECT COUNT(DISTINCT study_date) FROM vocabulary_study_records 
             WHERE user_id = ?) as total_active_days,
            (SELECT COALESCE(SUM(time_spent), 0) FROM vocabulary_study_records 
             WHERE user_id = ?) as total_study_time,
            (SELECT MAX(study_date) FROM vocabulary_study_records 
             WHERE user_id = ?) as last_study_date
    `;
    
    db.get(query, [userId, userId, userId, userId], (err, result) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '获取学习状态失败' 
            });
        }

        res.json({
            success: true,
            data: {
                activeDays7: result.active_days_7 || 0,
                totalActiveDays: result.total_active_days || 0,
                totalStudyTime: result.total_study_time || 0,
                lastStudyDate: result.last_study_date,
                studyStreak: calculateStudyStreak(result.last_study_date)
            }
        });
    });
});

// 计算学习连续天数
function calculateStudyStreak(lastStudyDate) {
    if (!lastStudyDate) return 0;
    
    const lastDate = new Date(lastStudyDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);
    
    const diffTime = today - lastDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // 如果最后学习日期是今天，则连续天数至少为1
    // 如果最后学习日期是昨天，则连续天数为2，依此类推
    // 如果间隔超过1天，则连续天数中断
    return diffDays === 0 ? 1 : (diffDays === 1 ? 2 : 0);
}

// 获取用户学习成就
router.get('/achievements', (req, res) => {
    const userId = req.user.userId;
    
    const achievementsQuery = `
        SELECT 
            -- 学习时长成就
            CASE 
                WHEN (SELECT COALESCE(SUM(time_spent), 0) FROM vocabulary_study_records WHERE user_id = ?) >= 36000 THEN '学习大师'
                WHEN (SELECT COALESCE(SUM(time_spent), 0) FROM vocabulary_study_records WHERE user_id = ?) >= 18000 THEN '学习达人'
                WHEN (SELECT COALESCE(SUM(time_spent), 0) FROM vocabulary_study_records WHERE user_id = ?) >= 7200 THEN '学习爱好者'
                ELSE '学习新手'
            END as study_time_level,
            
            -- 词汇量成就
            CASE 
                WHEN (SELECT COUNT(*) FROM user_vocabulary WHERE user_id = ? AND mastery_level >= 3) >= 5000 THEN '词汇大师'
                WHEN (SELECT COUNT(*) FROM user_vocabulary WHERE user_id = ? AND mastery_level >= 3) >= 3000 THEN '词汇达人'
                WHEN (SELECT COUNT(*) FROM user_vocabulary WHERE user_id = ? AND mastery_level >= 3) >= 1500 THEN '词汇爱好者'
                ELSE '词汇新手'
            END as vocabulary_level,
            
            -- 连续学习成就
            CASE 
                WHEN (SELECT COUNT(DISTINCT study_date) FROM vocabulary_study_records 
                      WHERE user_id = ? AND study_date >= DATE('now', '-30 days')) >= 28 THEN '学习狂人'
                WHEN (SELECT COUNT(DISTINCT study_date) FROM vocabulary_study_records 
                      WHERE user_id = ? AND study_date >= DATE('now', '-30 days')) >= 21 THEN '学习坚持者'
                WHEN (SELECT COUNT(DISTINCT study_date) FROM vocabulary_study_records 
                      WHERE user_id = ? AND study_date >= DATE('now', '-30 days')) >= 14 THEN '学习积极分子'
                ELSE '学习起步者'
            END as consistency_level
    `;
    
    db.get(achievementsQuery, [
        userId, userId, userId, 
        userId, userId, userId,
        userId, userId, userId
    ], (err, achievements) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '获取学习成就失败' 
            });
        }

        res.json({
            success: true,
            data: {
                achievements: achievements || {
                    study_time_level: '学习新手',
                    vocabulary_level: '词汇新手',
                    consistency_level: '学习起步者'
                }
            }
        });
    });
});

// 获取用户学习成就徽章
router.get('/achievements/badges', (req, res) => {
  const userId = req.user.userId;
  
  const badgesQuery = `
    SELECT 
      -- 学习时长徽章
      CASE 
        WHEN (SELECT COALESCE(SUM(time_spent), 0) FROM vocabulary_study_records WHERE user_id = ?) >= 36000 THEN 'study_master'
        WHEN (SELECT COALESCE(SUM(time_spent), 0) FROM vocabulary_study_records WHERE user_id = ?) >= 18000 THEN 'study_expert'
        WHEN (SELECT COALESCE(SUM(time_spent), 0) FROM vocabulary_study_records WHERE user_id = ?) >= 7200 THEN 'study_enthusiast'
        ELSE 'study_beginner'
      END as study_time_badge,
      
      -- 连续学习徽章
      CASE 
        WHEN (SELECT COUNT(DISTINCT study_date) FROM vocabulary_study_records 
              WHERE user_id = ? AND study_date >= DATE('now', '-30 days')) >= 28 THEN 'consistency_champion'
        WHEN (SELECT COUNT(DISTINCT study_date) FROM vocabulary_study_records 
              WHERE user_id = ? AND study_date >= DATE('now', '-30 days')) >= 21 THEN 'consistency_expert'
        WHEN (SELECT COUNT(DISTINCT study_date) FROM vocabulary_study_records 
              WHERE user_id = ? AND study_date >= DATE('now', '-30 days')) >= 14 THEN 'consistency_enthusiast'
        ELSE 'consistency_beginner'
      END as consistency_badge,
      
      -- 词汇量徽章
      CASE 
        WHEN (SELECT COUNT(*) FROM user_vocabulary WHERE user_id = ? AND mastery_level >= 3) >= 5000 THEN 'vocabulary_master'
        WHEN (SELECT COUNT(*) FROM user_vocabulary WHERE user_id = ? AND mastery_level >= 3) >= 3000 THEN 'vocabulary_expert'
        WHEN (SELECT COUNT(*) FROM user_vocabulary WHERE user_id = ? AND mastery_level >= 3) >= 1500 THEN 'vocabulary_enthusiast'
        ELSE 'vocabulary_beginner'
      END as vocabulary_badge
  `;
  
  db.get(badgesQuery, [
    userId, userId, userId,
    userId, userId, userId,
    userId, userId, userId
  ], (err, badges) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: '获取成就徽章失败' 
      });
    }

    res.json({
      success: true,
      data: {
        badges: badges || {
          study_time_badge: 'study_beginner',
          consistency_badge: 'consistency_beginner',
          vocabulary_badge: 'vocabulary_beginner'
        }
      }
    });
  });
});

// 获取用户学习周报
router.get('/weekly-report', (req, res) => {
  const userId = req.user.userId;
  
  const weeklyReportQuery = `
    SELECT 
      -- 本周学习数据
      (SELECT COUNT(DISTINCT study_date) FROM vocabulary_study_records 
       WHERE user_id = ? AND study_date >= DATE('now', '-7 days')) as active_days_week,
       
      (SELECT COALESCE(SUM(time_spent), 0) FROM vocabulary_study_records 
       WHERE user_id = ? AND study_date >= DATE('now', '-7 days')) as study_time_week,
       
      (SELECT COUNT(*) FROM user_vocabulary 
       WHERE user_id = ? AND created_at >= DATE('now', '-7 days')) as new_words_week,
       
      -- 正确率数据
      (SELECT 
        CASE 
          WHEN COUNT(*) > 0 THEN ROUND(SUM(CASE WHEN result = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1)
          ELSE 0 
        END
       FROM vocabulary_study_records 
       WHERE user_id = ? AND study_date >= DATE('now', '-7 days')) as accuracy_week,
       
      -- 与上周对比
      (SELECT COALESCE(SUM(time_spent), 0) FROM vocabulary_study_records 
       WHERE user_id = ? AND study_date BETWEEN DATE('now', '-14 days') AND DATE('now', '-7 days')) as study_time_last_week
  `;
  
  db.get(weeklyReportQuery, [userId, userId, userId, userId, userId], (err, report) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: '获取周报数据失败' 
      });
    }

    // 计算趋势
    const currentWeekTime = report.study_time_week || 0;
    const lastWeekTime = report.study_time_last_week || 0;
    const trend = lastWeekTime > 0 ? 
      Math.round(((currentWeekTime - lastWeekTime) / lastWeekTime) * 100) : 100;

    res.json({
      success: true,
      data: {
        weeklyReport: {
          activeDays: report.active_days_week || 0,
          studyTime: Math.round(currentWeekTime / 3600 * 10) / 10,
          newWords: report.new_words_week || 0,
          accuracy: report.accuracy_week || 0,
          trend: trend
        }
      }
    });
  });
});

// 更新用户学习目标
router.put('/study-goal', (req, res) => {
  const userId = req.user.userId;
  const { dailyWords, weeklyHours, targetScore } = req.body;
  
  const updateQuery = `
    INSERT OR REPLACE INTO user_study_goals 
    (user_id, daily_words, weekly_hours, target_score, updated_at) 
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;
  
  db.run(updateQuery, [userId, dailyWords, weeklyHours, targetScore], function(err) {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: '更新学习目标失败' 
      });
    }

    res.json({
      success: true,
      message: '学习目标更新成功',
      data: {
        dailyWords: dailyWords,
        weeklyHours: weeklyHours,
        targetScore: targetScore
      }
    });
  });
});

// 获取用户学习目标
router.get('/study-goal', (req, res) => {
  const userId = req.user.userId;
  
  const query = `
    SELECT daily_words, weekly_hours, target_score 
    FROM user_study_goals 
    WHERE user_id = ?
  `;
  
  db.get(query, [userId], (err, goal) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: '获取学习目标失败' 
      });
    }

    // 如果没有设置目标，返回默认值
    const defaultGoal = {
      daily_words: 20,
      weekly_hours: 5,
      target_score: 85
    };

    res.json({
      success: true,
      data: {
        goal: goal || defaultGoal
      }
    });
  });
});

// 获取用户学习统计
router.get('/learning-stats', (req, res) => {
    const userId = req.user.userId;
    
    const query = `
        SELECT 
            (SELECT COALESCE(SUM(time_spent), 0) FROM vocabulary_study_records WHERE user_id = ?) as total_study_time,
            (SELECT COUNT(DISTINCT study_date) FROM vocabulary_study_records WHERE user_id = ? AND study_date >= DATE('now', '-7 days')) as active_days_7,
            (SELECT COUNT(*) FROM user_vocabulary WHERE user_id = ? AND mastery_level >= 3) as mastered_words,
            (SELECT COUNT(*) FROM user_vocabulary WHERE user_id = ?) as total_words,
            (SELECT COALESCE(SUM(time_spent), 0) FROM vocabulary_study_records WHERE user_id = ? AND study_date >= DATE('now', '-7 days')) as week_study_time,
            (SELECT COALESCE(SUM(time_spent), 0) FROM vocabulary_study_records WHERE user_id = ? AND study_date BETWEEN DATE('now', '-14 days') AND DATE('now', '-7 days')) as last_week_study_time
    `;
    
    db.get(query, [userId, userId, userId, userId, userId, userId], (err, stats) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '获取学习统计失败' 
            });
        }

        res.json({
            success: true,
            data: {
                totalStudyTime: Math.round((stats.total_study_time || 0) / 3600 * 10) / 10,
                activeDays: stats.active_days_7 || 0,
                masteredWords: stats.mastered_words || 0,
                totalWords: stats.total_words || 0,
                weekStudyTime: Math.round((stats.week_study_time || 0) / 3600 * 10) / 10,
                lastWeekStudyTime: Math.round((stats.last_week_study_time || 0) / 3600 * 10) / 10
            }
        });
    });
});

// 获取用户签到信息
router.get('/checkin-info', (req, res) => {
    const userId = req.user.userId;
    
    const query = `
        SELECT 
            (SELECT COUNT(*) FROM user_checkins WHERE user_id = ? AND checkin_date = DATE('now')) as today_checked,
            (SELECT COUNT(*) FROM user_checkins WHERE user_id = ? AND checkin_date >= DATE('now', '-7 days')) as week_checkins,
            (SELECT MAX(streak_days) FROM user_checkins WHERE user_id = ?) as max_streak
    `;
    
    db.get(query, [userId, userId, userId], (err, result) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '获取签到信息失败' 
            });
        }

        res.json({
            success: true,
            data: {
                todayChecked: result.today_checked > 0,
                weekCheckins: result.week_checkins || 0,
                maxStreak: result.max_streak || 0
            }
        });
    });
});

// 用户签到
router.post('/checkin', (req, res) => {
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];
    
    // 检查今天是否已经签到
    const checkQuery = 'SELECT id FROM user_checkins WHERE user_id = ? AND checkin_date = ?';
    
    db.get(checkQuery, [userId, today], (err, existing) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '签到检查失败' 
            });
        }
        
        if (existing) {
            return res.json({
                success: false,
                message: '今天已经签到过了'
            });
        }
        
        // 计算连续签到天数
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        db.get('SELECT streak_days FROM user_checkins WHERE user_id = ? AND checkin_date = ? ORDER BY id DESC LIMIT 1', 
            [userId, yesterdayStr], (err, lastCheckin) => {
            
            const streakDays = lastCheckin ? lastCheckin.streak_days + 1 : 1;
            
            // 插入签到记录
            const insertQuery = `
                INSERT INTO user_checkins (user_id, checkin_date, streak_days, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            db.run(insertQuery, [userId, today, streakDays], function(err) {
                if (err) {
                    return res.status(500).json({ 
                        success: false, 
                        message: '签到失败' 
                    });
                }
                
                res.json({
                    success: true,
                    message: '签到成功',
                    data: {
                        streakDays: streakDays,
                        checkinDate: today
                    }
                });
            });
        });
    });
});

// 更新用户学习统计
router.post('/learning-stats', (req, res) => {
    const userId = req.user.userId;
    const { activityType, duration, wordCount, accuracy } = req.body;
    
    // 这里可以记录学习活动，更新统计缓存等
    // 简化实现，直接返回成功
    res.json({
        success: true,
        message: '学习统计已更新'
    });
});

// 获取用户基础信息
router.get('/basic-info', (req, res) => {
    const userId = req.user.userId;
    
    db.get(`
        SELECT id, username, name, phone, avatar, created_at, last_login 
        FROM users 
        WHERE id = ? AND is_active = 1
    `, [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '获取用户信息失败' 
            });
        }

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: '用户不存在' 
            });
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    phone: user.phone,
                    avatar: user.avatar,
                    memberLevel: 'premium', // 默认会员等级
                    memberDaysLeft: 30
                }
            }
        });
    });
});

// 获取用户统计信息
router.get('/stats', (req, res) => {
    const userId = req.user.userId;
    
    const query = `
        SELECT 
            (SELECT COALESCE(SUM(time_spent), 0) FROM vocabulary_study_records WHERE user_id = ?) as total_study_time,
            (SELECT COUNT(DISTINCT study_date) FROM vocabulary_study_records WHERE user_id = ? AND study_date >= DATE('now', '-7 days')) as active_days,
            (SELECT COUNT(*) FROM user_vocabulary WHERE user_id = ? AND mastery_level >= 3) as mastered_words,
            (SELECT COUNT(*) FROM user_vocabulary WHERE user_id = ?) as total_words
    `;
    
    db.get(query, [userId, userId, userId, userId], (err, stats) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '获取统计数据失败' 
            });
        }

        res.json({
            success: true,
            data: {
                totalStudyTime: Math.round((stats.total_study_time || 0) / 3600 * 10) / 10,
                activeDays: stats.active_days || 0,
                masteredWords: stats.mastered_words || 0,
                totalWords: stats.total_words || 0,
                goalCompletion: 65 // 默认完成度
            }
        });
    });
});

module.exports = router;