// [file name]: server_modules/routes/listening.js
const express = require('express');
const { db } = require('../database');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// 获取听力试卷列表
router.get('/papers', (req, res) => {
    const { exam_type, level } = req.query;
    
    let query = `
        SELECT DISTINCT 
            ep.id, ep.exam_type, ep.year, ep.month, ep.paper_number,
            ep.title, ep.description, ep.audio_files,
            COUNT(eq.id) as question_count
        FROM exam_papers ep
        LEFT JOIN exam_questions eq ON ep.id = eq.paper_id AND eq.section_type = 'listening'
        WHERE ep.is_active = 1
    `;
    
    const params = [];
    
    if (exam_type) {
        query += ' AND ep.exam_type = ?';
        params.push(exam_type);
    }
    
    if (level) {
        query += ' AND ep.exam_type = ?';
        params.push(level === '四级' ? 'CET4' : 'CET6');
    }
    
    query += ' GROUP BY ep.id ORDER BY ep.year DESC, ep.month DESC';
    
    db.all(query, params, (err, papers) => {
        if (err) {
            console.error('获取听力试卷列表失败:', err);
            return res.status(500).json({
                success: false,
                message: '获取试卷列表失败'
            });
        }
        
        res.json({
            success: true,
            data: papers
        });
    });
});

// 获取听力试卷详情
router.get('/paper/:paperId', (req, res) => {
    const paperId = req.params.paperId;
    
    // 获取试卷基本信息
    const paperQuery = `
        SELECT * FROM exam_papers 
        WHERE id = ? AND is_active = 1
    `;
    
    // 获取听力题目
    const questionsQuery = `
        SELECT * FROM exam_questions 
        WHERE paper_id = ? AND section_type = 'listening'
        ORDER BY sort_order ASC, question_number ASC
    `;
    
    db.get(paperQuery, [paperId], (err, paper) => {
        if (err) {
            console.error('获取试卷详情失败:', err);
            return res.status(500).json({
                success: false,
                message: '获取试卷详情失败'
            });
        }
        
        if (!paper) {
            return res.status(404).json({
                success: false,
                message: '试卷不存在'
            });
        }
        
        db.all(questionsQuery, [paperId], (err, questions) => {
            if (err) {
                console.error('获取听力题目失败:', err);
                return res.status(500).json({
                    success: false,
                    message: '获取题目失败'
                });
            }
            
            // 解析audio_files JSON
            try {
                paper.audio_files = JSON.parse(paper.audio_files || '{}');
            } catch (e) {
                paper.audio_files = {};
            }
            
            // 解析题目选项
            const processedQuestions = questions.map(q => {
                try {
                    q.options = q.options ? JSON.parse(q.options) : [];
                } catch (e) {
                    q.options = [];
                }
                return q;
            });
            
            res.json({
                success: true,
                data: {
                    paper: paper,
                    questions: processedQuestions
                }
            });
        });
    });
});

// 开始听力练习
router.post('/start-practice', (req, res) => {
    const { paper_id, user_id } = req.body;
    
    if (!paper_id) {
        return res.status(400).json({
            success: false,
            message: '试卷ID不能为空'
        });
    }
    
    const insertQuery = `
        INSERT INTO listening_practice_sessions 
        (user_id, paper_id, start_time, status) 
        VALUES (?, ?, CURRENT_TIMESTAMP, 'in_progress')
    `;
    
    db.run(insertQuery, [user_id || null, paperId], function(err) {
        if (err) {
            console.error('创建练习会话失败:', err);
            return res.status(500).json({
                success: false,
                message: '开始练习失败'
            });
        }
        
        res.json({
            success: true,
            data: {
                session_id: this.lastID
            }
        });
    });
});

// 提交答案
router.post('/submit-answer', (req, res) => {
    const { session_id, question_id, user_answer, time_spent } = req.body;
    
    if (!session_id || !question_id) {
        return res.status(400).json({
            success: false,
            message: '参数不完整'
        });
    }
    
    // 获取正确答案
    const correctAnswerQuery = `
        SELECT correct_answer FROM exam_questions WHERE id = ?
    `;
    
    db.get(correctAnswerQuery, [question_id], (err, question) => {
        if (err) {
            console.error('获取正确答案失败:', err);
            return res.status(500).json({
                success: false,
                message: '提交答案失败'
            });
        }
        
        const is_correct = question.correct_answer === user_answer;
        
        const insertQuery = `
            INSERT OR REPLACE INTO listening_user_answers 
            (session_id, question_id, user_answer, is_correct, time_spent)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        db.run(insertQuery, [session_id, question_id, user_answer, is_correct, time_spent || 0], function(err) {
            if (err) {
                console.error('保存答案失败:', err);
                return res.status(500).json({
                    success: false,
                    message: '保存答案失败'
                });
            }
            
            res.json({
                success: true,
                data: {
                    is_correct: is_correct,
                    correct_answer: question.correct_answer
                }
            });
        });
    });
});

// 完成练习
router.post('/complete-practice', (req, res) => {
    const { session_id } = req.body;
    
    const updateQuery = `
        UPDATE listening_practice_sessions 
        SET end_time = CURRENT_TIMESTAMP, status = 'completed'
        WHERE id = ?
    `;
    
    db.run(updateQuery, [session_id], function(err) {
        if (err) {
            console.error('完成练习失败:', err);
            return res.status(500).json({
                success: false,
                message: '完成练习失败'
            });
        }
        
        // 计算成绩统计
        const statsQuery = `
            SELECT 
                COUNT(*) as total_questions,
                SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
                AVG(time_spent) as avg_time_spent
            FROM listening_user_answers
            WHERE session_id = ?
        `;
        
        db.get(statsQuery, [session_id], (err, stats) => {
            if (err) {
                console.error('计算统计失败:', err);
            }
            
            res.json({
                success: true,
                data: {
                    total_questions: stats?.total_questions || 0,
                    correct_count: stats?.correct_count || 0,
                    accuracy: stats?.total_questions ? 
                        Math.round((stats.correct_count / stats.total_questions) * 100) : 0,
                    avg_time_spent: stats?.avg_time_spent || 0
                }
            });
        });
    });
});

// 获取用户听力学习统计
router.get('/user-stats', (req, res) => {
    const user_id = req.user?.userId;
    
    if (!user_id) {
        return res.json({
            success: true,
            data: {
                total_practices: 0,
                total_questions: 0,
                accuracy: 0,
                total_time: 0
            }
        });
    }
    
    const statsQuery = `
        SELECT 
            COUNT(DISTINCT session_id) as total_practices,
            COUNT(*) as total_questions,
            SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
            SUM(time_spent) as total_time
        FROM listening_user_answers lua
        JOIN listening_practice_sessions lps ON lua.session_id = lps.id
        WHERE lps.user_id = ?
    `;
    
    db.get(statsQuery, [user_id], (err, stats) => {
        if (err) {
            console.error('获取用户统计失败:', err);
            return res.status(500).json({
                success: false,
                message: '获取统计失败'
            });
        }
        
        const accuracy = stats.total_questions > 0 ? 
            Math.round((stats.correct_count / stats.total_questions) * 100) : 0;
        
        res.json({
            success: true,
            data: {
                total_practices: stats.total_practices || 0,
                total_questions: stats.total_questions || 0,
                accuracy: accuracy,
                total_time: Math.round((stats.total_time || 0) / 60) // 转换为分钟
            }
        });
    });
});

// 获取推荐训练
router.get('/recommended-practices', (req, res) => {
    const query = `
        SELECT 
            ep.id, ep.exam_type, ep.year, ep.month, ep.title,
            ep.description, ep.audio_files,
            COUNT(eq.id) as question_count
        FROM exam_papers ep
        LEFT JOIN exam_questions eq ON ep.id = eq.paper_id AND eq.section_type = 'listening'
        WHERE ep.is_active = 1
        GROUP BY ep.id
        ORDER BY ep.year DESC, ep.month DESC
        LIMIT 8
    `;
    
    db.all(query, [], (err, practices) => {
        if (err) {
            console.error('获取推荐训练失败:', err);
            return res.status(500).json({
                success: false,
                message: '获取推荐训练失败'
            });
        }
        
        // 分类推荐
        const categorized = {
            short_dialog: practices.filter(p => p.question_count <= 10).slice(0, 2),
            long_dialog: practices.filter(p => p.question_count > 10 && p.question_count <= 20).slice(0, 2),
            lecture: practices.filter(p => p.question_count > 20).slice(0, 2),
            simulation: practices.slice(0, 2)
        };
        
        res.json({
            success: true,
            data: categorized
        });
    });
});

module.exports = router;