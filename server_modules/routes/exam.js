// [file name]: server_modules/routes/exam.js
const express = require('express');
const router = express.Router();
const db = require('../database.js');

// 获取试卷列表
router.post('/papers', async (req, res) => {
    try {
        const { exam_type, year, search } = req.body;
        
        let sql = `
            SELECT * FROM exam_papers 
            WHERE is_active = 1
        `;
        const params = [];
        
        if (exam_type && exam_type !== 'all') {
            sql += ' AND exam_type = ?';
            params.push(exam_type);
        }
        
        if (year && year !== 'all') {
            sql += ' AND year = ?';
            params.push(parseInt(year));
        }
        
        if (search && search.trim()) {
            sql += ' AND (title LIKE ? OR description LIKE ?)';
            const searchTerm = `%${search.trim()}%`;
            params.push(searchTerm, searchTerm);
        }
        
        sql += ' ORDER BY year DESC, month DESC, paper_number ASC';
        
        db.db.all(sql, params, (err, papers) => {
            if (err) {
                console.error('查询试卷列表错误:', err);
                return res.json({ success: false, message: '查询试卷失败' });
            }
            
            res.json({
                success: true,
                data: {
                    papers: papers,
                    total: papers.length
                }
            });
        });
        
    } catch (error) {
        console.error('获取试卷列表错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 获取试卷详情（包含章节和题目）
router.get('/paper/:paperId', async (req, res) => {
    try {
        const paperId = req.params.paperId;
        
        // 获取试卷基本信息
        db.db.get('SELECT * FROM exam_papers WHERE id = ? AND is_active = 1', [paperId], (err, paper) => {
            if (err) {
                console.error('查询试卷错误:', err);
                return res.json({ success: false, message: '查询试卷失败' });
            }
            
            if (!paper) {
                return res.json({ success: false, message: '试卷不存在' });
            }
            
            // 获取试卷章节
            db.db.all('SELECT * FROM exam_sections WHERE paper_id = ? ORDER BY section_order ASC', [paperId], (err, sections) => {
                if (err) {
                    console.error('查询章节错误:', err);
                    return res.json({ success: false, message: '查询章节失败' });
                }
                
                // 获取所有题目
                const sectionIds = sections.map(s => s.id);
                if (sectionIds.length === 0) {
                    return res.json({
                        success: true,
                        data: {
                            paper: paper,
                            sections: sections,
                            questions: [],
                            questionsBySection: {}
                        }
                    });
                }
                
                const placeholders = sectionIds.map(() => '?').join(',');
                const sql = `
                    SELECT * FROM exam_questions 
                    WHERE section_id IN (${placeholders}) 
                    ORDER BY question_order ASC, question_number ASC
                `;
                
                db.db.all(sql, sectionIds, (err, questions) => {
                    if (err) {
                        console.error('查询题目错误:', err);
                        return res.json({ success: false, message: '查询题目失败' });
                    }
                    
                    // 处理选项数据
                    const processedQuestions = questions.map(question => {
                        try {
                            if (question.options) {
                                question.options = JSON.parse(question.options);
                            } else {
                                question.options = [];
                            }
                        } catch (e) {
                            console.warn('解析选项JSON失败:', e);
                            question.options = [];
                        }
                        return question;
                    });
                    
                    // 按章节分组题目
                    const questionsBySection = {};
                    sections.forEach(section => {
                        questionsBySection[section.section_type] = processedQuestions.filter(
                            question => question.section_id === section.id
                        );
                    });
                    
                    res.json({
                        success: true,
                        data: {
                            paper: paper,
                            sections: sections,
                            questions: processedQuestions,
                            questionsBySection: questionsBySection
                        }
                    });
                });
            });
        });
        
    } catch (error) {
        console.error('获取试卷详情错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 开始考试会话
router.post('/session/start', async (req, res) => {
    try {
        const { paper_id } = req.body;
        const user_id = req.user ? req.user.id : null;
        
        if (!paper_id) {
            return res.json({ success: false, message: '试卷ID不能为空' });
        }
        
        // 验证试卷是否存在
        db.db.get('SELECT * FROM exam_papers WHERE id = ? AND is_active = 1', [paper_id], (err, paper) => {
            if (err) {
                console.error('验证试卷错误:', err);
                return res.json({ success: false, message: '验证试卷失败' });
            }
            
            if (!paper) {
                return res.json({ success: false, message: '试卷不存在' });
            }
            
            // 创建考试会话
            const sessionData = {
                user_id: user_id,
                paper_id: paper_id,
                start_time: new Date().toISOString(),
                status: 'in_progress'
            };
            
            const sql = `
                INSERT INTO exam_sessions (user_id, paper_id, start_time, status) 
                VALUES (?, ?, ?, ?)
            `;
            
            db.db.run(sql, [sessionData.user_id, sessionData.paper_id, sessionData.start_time, sessionData.status], function(err) {
                if (err) {
                    console.error('创建考试会话错误:', err);
                    return res.json({ success: false, message: '创建考试会话失败' });
                }
                
                res.json({
                    success: true,
                    data: {
                        session_id: this.lastID,
                        start_time: sessionData.start_time
                    }
                });
            });
        });
        
    } catch (error) {
        console.error('开始考试会话错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 提交考试答案
router.post('/session/:sessionId/submit', async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const { answers } = req.body;
        const user_id = req.user ? req.user.id : null;
        
        if (!sessionId) {
            return res.json({ success: false, message: '会话ID不能为空' });
        }
        
        if (!answers || typeof answers !== 'object') {
            return res.json({ success: false, message: '答案数据格式错误' });
        }
        
        // 获取会话信息
        db.db.get('SELECT * FROM exam_sessions WHERE id = ?', [sessionId], (err, session) => {
            if (err) {
                console.error('查询会话错误:', err);
                return res.json({ success: false, message: '查询会话失败' });
            }
            
            if (!session) {
                return res.json({ success: false, message: '考试会话不存在' });
            }
            
            // 验证会话属于当前用户（如果已登录）
            if (user_id && session.user_id !== user_id) {
                return res.json({ success: false, message: '无权访问此会话' });
            }
            
            // 获取试卷题目信息
            const paperId = session.paper_id;
            db.db.all(`
                SELECT eq.id, eq.correct_answer, eq.question_type, eq.score, es.section_type 
                FROM exam_questions eq
                JOIN exam_sections es ON eq.section_id = es.id
                WHERE es.paper_id = ?
            `, [paperId], (err, questions) => {
                if (err) {
                    console.error('查询题目错误:', err);
                    return res.json({ success: false, message: '计算成绩失败' });
                }
                
                // 计算成绩
                let totalScore = 0;
                let correctCount = 0;
                const totalQuestions = questions.length;
                const sectionScores = {};
                const results = [];
                
                questions.forEach(question => {
                    const userAnswer = answers[question.id];
                    let isCorrect = false;
                    let score = 0;
                    const questionScore = question.score || 1; // 默认1分
                    
                    // 根据题目类型计算分数
                    if (userAnswer !== undefined && userAnswer !== null && userAnswer !== '') {
                        if (question.question_type === 'single_choice' || question.question_type === 'true_false') {
                            // 单选题和判断题
                            isCorrect = userAnswer.toString() === question.correct_answer.toString();
                            score = isCorrect ? questionScore : 0;
                        } else if (question.question_type === 'multiple_choice') {
                            // 多选题 - 需要排序后比较
                            const userAnsArray = Array.isArray(userAnswer) ? userAnswer.sort() : [userAnswer];
                            const correctAnsArray = question.correct_answer.split(',').sort();
                            isCorrect = JSON.stringify(userAnsArray) === JSON.stringify(correctAnsArray);
                            score = isCorrect ? questionScore : 0;
                        } else if (question.question_type === 'writing' || question.question_type === 'translation') {
                            // 写作和翻译题 - 暂时给基础分，实际应该由教师或AI评分
                            score = Math.min(questionScore, 5); // 给基础分，最高5分
                            isCorrect = score > 0;
                        } else {
                            // 其他题型（填空、简答等）
                            isCorrect = userAnswer.toString().trim() === question.correct_answer.toString().trim();
                            score = isCorrect ? questionScore : 0;
                        }
                    }
                    
                    if (isCorrect) {
                        correctCount++;
                    }
                    totalScore += score;
                    
                    // 统计章节分数
                    if (!sectionScores[question.section_type]) {
                        sectionScores[question.section_type] = { correct: 0, total: 0, score: 0 };
                    }
                    if (isCorrect) {
                        sectionScores[question.section_type].correct++;
                    }
                    sectionScores[question.section_type].score += score;
                    sectionScores[question.section_type].total++;
                    
                    results.push({
                        question_id: question.id,
                        user_answer: userAnswer,
                        correct_answer: question.correct_answer,
                        is_correct: isCorrect,
                        score: score
                    });
                });
                
                const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
                const endTime = new Date().toISOString();
                const startTime = new Date(session.start_time);
                const timeSpent = Math.floor((new Date(endTime) - startTime) / 1000); // 秒
                
                // 更新会话状态
                const updateSessionSql = `
                    UPDATE exam_sessions 
                    SET end_time = ?, time_spent = ?, total_score = ?, status = 'completed', answers = ?
                    WHERE id = ?
                `;
                
                db.db.run(updateSessionSql, [endTime, timeSpent, totalScore, JSON.stringify(answers), sessionId], function(err) {
                    if (err) {
                        console.error('更新会话错误:', err);
                        return res.json({ success: false, message: '提交失败' });
                    }
                    
                    // 保存统计信息
                    Object.keys(sectionScores).forEach(sectionType => {
                        const sectionData = sectionScores[sectionType];
                        const statSql = `
                            INSERT INTO exam_statistics (user_id, paper_id, session_id, section_type, correct_count, total_count, total_score, average_time)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `;
                        db.db.run(statSql, [
                            user_id, paperId, sessionId, sectionType, 
                            sectionData.correct, sectionData.total, 
                            sectionData.score, Math.floor(timeSpent / totalQuestions)
                        ], function(err) {
                            if (err) {
                                console.error('保存统计信息错误:', err);
                            }
                        });
                    });
                    
                    res.json({
                        success: true,
                        data: {
                            total_score: totalScore,
                            correct_count: correctCount,
                            total_questions: totalQuestions,
                            accuracy: accuracy,
                            time_spent: timeSpent,
                            section_scores: sectionScores,
                            results: results
                        }
                    });
                });
            });
        });
        
    } catch (error) {
        console.error('提交考试错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 获取用户考试历史
router.get('/history', async (req, res) => {
    try {
        const user_id = req.user ? req.user.id : null;
        
        if (!user_id) {
            return res.json({ success: false, message: '请先登录' });
        }
        
        const sql = `
            SELECT es.*, ep.title, ep.exam_type, ep.year, ep.month
            FROM exam_sessions es
            JOIN exam_papers ep ON es.paper_id = ep.id
            WHERE es.user_id = ? AND es.status = 'completed'
            ORDER BY es.end_time DESC
            LIMIT 20
        `;
        
        db.db.all(sql, [user_id], (err, sessions) => {
            if (err) {
                console.error('查询考试历史错误:', err);
                return res.json({ success: false, message: '查询历史失败' });
            }
            
            res.json({
                success: true,
                data: {
                    sessions: sessions
                }
            });
        });
        
    } catch (error) {
        console.error('获取考试历史错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

module.exports = router;