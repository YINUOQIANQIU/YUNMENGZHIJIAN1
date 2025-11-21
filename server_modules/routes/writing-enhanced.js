// server_modules/routes/writing-enhanced.js
const express = require('express');
const router = express.Router();

// 获取写作试卷列表 - 修正查询逻辑
router.get('/papers', async (req, res) => {
    try {
        const db = req.app.locals.db;

        const sql = `
            SELECT DISTINCT 
                p.id,
                p.exam_type,
                p.year,
                p.month,
                p.paper_number,
                p.title,
                p.description,
                p.total_score,
                p.time_allowed,
                p.questions_count,
                p.difficulty,
                p.created_at,
                COUNT(DISTINCT q.id) as writing_questions_count
            FROM exam_papers p
            JOIN exam_sections s ON p.id = s.paper_id
            LEFT JOIN exam_questions q ON s.id = q.section_id 
            WHERE p.is_active = 1 
            AND s.section_type = 'writing'
            GROUP BY p.id
            ORDER BY p.year DESC, p.month DESC, p.exam_type
        `;

        db.all(sql, [], (err, papers) => {
            if (err) {
                console.error('获取写作试卷失败:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '获取试卷失败' 
                });
            }

            res.json({
                success: true,
                data: papers,
                count: papers.length
            });
        });
    } catch (error) {
        console.error('写作试卷API错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

// 获取写作题目 - 修正查询逻辑
router.get('/papers/:paperId/questions', async (req, res) => {
    try {
        const paperId = req.params.paperId;
        const db = req.app.locals.db;

        const sql = `
            SELECT 
                q.id,
                q.question_text as title,
                q.question_text as content,
                s.directions as requirements,
                s.passage_content,
                s.translation_content,
                150 as word_limit,
                30 as time_limit,
                s.section_name,
                s.section_type,
                p.exam_type,
                p.year,
                p.month,
                p.title as paper_title
            FROM exam_questions q
            JOIN exam_sections s ON q.section_id = s.id
            JOIN exam_papers p ON s.paper_id = p.id
            WHERE p.id = ? AND s.section_type = 'writing'
            ORDER BY q.question_order ASC, q.question_number ASC
        `;

        db.all(sql, [paperId], (err, questions) => {
            if (err) {
                console.error('获取写作题目失败:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '获取题目失败' 
                });
            }

            if (questions.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: '该试卷没有写作题目' 
                });
            }

            // 处理题目数据，确保格式正确
            const processedQuestions = questions.map(q => ({
                ...q,
                title: q.title || `写作题目`,
                content: q.content || '',
                requirements: q.requirements || '请根据题目要求完成写作',
                word_limit: q.word_limit || 150,
                time_limit: q.time_limit || 30
            }));

            res.json({
                success: true,
                data: processedQuestions,
                count: processedQuestions.length
            });
        });
    } catch (error) {
        console.error('写作题目API错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

// 随机获取写作题目 - 修正查询逻辑
router.get('/random-question', async (req, res) => {
    try {
        const { exam_type } = req.query;
        const db = req.app.locals.db;

        let sql = `
            SELECT 
                q.id,
                q.question_text as title,
                q.question_text as content,
                s.directions as requirements,
                s.passage_content,
                s.translation_content,
                150 as word_limit,
                30 as time_limit,
                s.section_name,
                s.section_type,
                p.exam_type,
                p.year,
                p.month,
                p.title as paper_title
            FROM exam_questions q
            JOIN exam_sections s ON q.section_id = s.id
            JOIN exam_papers p ON s.paper_id = p.id
            WHERE s.section_type = 'writing' AND p.is_active = 1
        `;

        const params = [];
        if (exam_type) {
            sql += ' AND p.exam_type = ?';
            params.push(exam_type);
        }

        sql += ' ORDER BY RANDOM() LIMIT 1';

        db.get(sql, params, (err, question) => {
            if (err) {
                console.error('获取随机写作题目失败:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '获取题目失败' 
                });
            }

            if (!question) {
                return res.status(404).json({ 
                    success: false, 
                    message: '未找到写作题目' 
                });
            }

            // 处理题目数据
            const processedQuestion = {
                ...question,
                title: question.title || `写作题目`,
                content: question.content || '',
                requirements: question.requirements || '请根据题目要求完成写作',
                word_limit: question.word_limit || 150,
                time_limit: question.time_limit || 30,
                source: `${question.exam_type} ${question.year}年${question.month}月`
            };

            res.json({
                success: true,
                data: processedQuestion
            });
        });
    } catch (error) {
        console.error('随机写作题目API错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

// 保存写作结果 - 保持不变
router.post('/save-result', async (req, res) => {
    try {
        const { 
            user_id, 
            question_id, 
            content, 
            time_spent, 
            analysis_result, 
            word_count 
        } = req.body;
        
        const db = req.app.locals.db;

        const sql = `
            INSERT INTO writing_sessions 
            (user_id, question_id, user_content, word_count, time_spent, 
             score_overall, score_content, score_structure, score_language,
             ai_feedback, common_errors, suggestions, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `;

        const scores = analysis_result.scores || {
            overall: 0,
            content: 0,
            structure: 0,
            language: 0
        };

        const commonErrors = Array.isArray(analysis_result.common_errors) 
            ? analysis_result.common_errors.join(', ') 
            : '';

        const suggestions = Array.isArray(analysis_result.suggestions)
            ? analysis_result.suggestions.join(', ')
            : '';

        db.run(sql, [
            user_id,
            question_id,
            content,
            word_count,
            time_spent,
            scores.overall,
            scores.content,
            scores.structure,
            scores.language,
            analysis_result.feedback || '',
            commonErrors,
            suggestions
        ], function(err) {
            if (err) {
                console.error('保存写作结果失败:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '保存结果失败' 
                });
            }

            res.json({
                success: true,
                message: '写作结果保存成功',
                session_id: this.lastID
            });
        });
    } catch (error) {
        console.error('保存写作结果API错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

// 获取写作历史 - 保持不变
router.get('/history', async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;
        const db = req.app.locals.db;

        const offset = (page - 1) * limit;

        const sql = `
            SELECT 
                ws.id,
                ws.user_content as content,
                ws.word_count,
                ws.time_spent,
                ws.score_overall,
                ws.submitted_at,
                eq.question_text as title
            FROM writing_sessions ws
            LEFT JOIN exam_questions eq ON ws.question_id = eq.id
            WHERE ws.user_id = ?
            ORDER BY ws.submitted_at DESC
            LIMIT ? OFFSET ?
        `;

        const countSql = `
            SELECT COUNT(*) as total 
            FROM writing_sessions 
            WHERE user_id = ?
        `;

        db.get(countSql, [userId], (err, countResult) => {
            if (err) {
                console.error('获取写作历史计数失败:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '获取历史记录失败' 
                });
            }

            db.all(sql, [userId, parseInt(limit), offset], (err, records) => {
                if (err) {
                    console.error('获取写作历史失败:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '获取历史记录失败' 
                    });
                }

                res.json({
                    success: true,
                    data: {
                        records: records,
                        pagination: {
                            page: parseInt(page),
                            limit: parseInt(limit),
                            total: countResult.total,
                            pages: Math.ceil(countResult.total / limit)
                        }
                    }
                });
            });
        });
    } catch (error) {
        console.error('写作历史API错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

module.exports = router;