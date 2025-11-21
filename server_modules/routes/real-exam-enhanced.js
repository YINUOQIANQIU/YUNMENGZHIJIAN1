// [file name]: server_modules/routes/real-exam-enhanced.js
const express = require('express');
const router = express.Router();

// 获取用户考试记录
router.get('/user-records', (req, res) => {
    const user_id = req.user.id;
    const db = req.app.locals.db;
    
    const sql = `
        SELECT s.*, p.title, p.exam_type, p.year, p.month 
        FROM real_exam_sessions s
        JOIN real_exam_papers p ON s.paper_id = p.id
        WHERE s.user_id = ? AND s.status = 'completed'
        ORDER BY s.end_time DESC
        LIMIT 50
    `;
    
    db.all(sql, [user_id], (err, records) => {
        if (err) {
            res.json({ success: false, message: '查询考试记录失败' });
            return;
        }
        
        // 解析answers字段
        const processedRecords = records.map(record => {
            try {
                record.answers = JSON.parse(record.answers || '{}');
            } catch (e) {
                record.answers = {};
            }
            return record;
        });
        
        res.json({ success: true, data: processedRecords });
    });
});

// 获取用户最佳成绩
router.get('/user-best-scores', (req, res) => {
    const user_id = req.user.id;
    const db = req.app.locals.db;
    
    const sql = `
        SELECT p.exam_type, MAX(s.total_score) as best_score, COUNT(*) as attempt_count
        FROM real_exam_sessions s
        JOIN real_exam_papers p ON s.paper_id = p.id
        WHERE s.user_id = ? AND s.status = 'completed'
        GROUP BY p.exam_type
    `;
    
    db.all(sql, [user_id], (err, results) => {
        if (err) {
            res.json({ success: false, message: '查询最佳成绩失败' });
            return;
        }
        
        res.json({ success: true, data: results });
    });
});

// 获取题目统计信息
router.get('/question-stats/:paperId', (req, res) => {
    const paperId = req.params.paperId;
    const db = req.app.locals.db;
    
    const sql = `
        SELECT 
            section_type,
            COUNT(*) as total_questions,
            SUM(score) as total_score,
            AVG(score) as avg_score
        FROM real_exam_questions 
        WHERE paper_id = ?
        GROUP BY section_type
    `;
    
    db.all(sql, [paperId], (err, stats) => {
        if (err) {
            res.json({ success: false, message: '查询题目统计失败' });
            return;
        }
        
        res.json({ success: true, data: stats });
    });
});

// 保存用户笔记
router.post('/save-note', (req, res) => {
    const { question_id, note_content } = req.body;
    const user_id = req.user.id;
    const db = req.app.locals.db;
    
    // 插入或更新笔记
    const upsertSQL = `
        INSERT INTO question_notes (user_id, question_id, note_content)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, question_id) 
        DO UPDATE SET note_content = excluded.note_content, updated_at = CURRENT_TIMESTAMP
    `;
    
    db.run(upsertSQL, [user_id, question_id, note_content], function(err) {
        if (err) {
            res.json({ success: false, message: '保存笔记失败' });
            return;
        }
        
        res.json({ 
            success: true, 
            message: '笔记保存成功',
            note_id: this.lastID
        });
    });
});

// 获取用户笔记
router.get('/notes/:questionId', (req, res) => {
    const questionId = req.params.questionId;
    const user_id = req.user.id;
    const db = req.app.locals.db;
    
    const sql = `
        SELECT * FROM question_notes 
        WHERE user_id = ? AND question_id = ?
    `;
    
    db.get(sql, [user_id, questionId], (err, note) => {
        if (err) {
            res.json({ success: false, message: '查询笔记失败' });
            return;
        }
        
        res.json({ success: true, data: note });
    });
});

// 获取用户所有笔记
router.get('/user-notes', (req, res) => {
    const user_id = req.user.id;
    const db = req.app.locals.db;
    
    const sql = `
        SELECT n.*, q.question_number, q.content as question_content, 
               p.title as paper_title, p.exam_type, p.year, p.month
        FROM question_notes n
        JOIN real_exam_questions q ON n.question_id = q.id
        JOIN real_exam_papers p ON q.paper_id = p.id
        WHERE n.user_id = ?
        ORDER BY n.updated_at DESC
    `;
    
    db.all(sql, [user_id], (err, notes) => {
        if (err) {
            res.json({ success: false, message: '查询笔记列表失败' });
            return;
        }
        
        res.json({ success: true, data: notes });
    });
});

// 删除笔记
router.delete('/notes/:noteId', (req, res) => {
    const noteId = req.params.noteId;
    const user_id = req.user.id;
    const db = req.app.locals.db;
    
    const sql = `
        DELETE FROM question_notes 
        WHERE id = ? AND user_id = ?
    `;
    
    db.run(sql, [noteId, user_id], function(err) {
        if (err) {
            res.json({ success: false, message: '删除笔记失败' });
            return;
        }
        
        if (this.changes === 0) {
            res.json({ success: false, message: '笔记不存在或无权删除' });
            return;
        }
        
        res.json({ success: true, message: '笔记删除成功' });
    });
});

// 获取用户学习统计
router.get('/learning-stats', (req, res) => {
    const user_id = req.user.id;
    const db = req.app.locals.db;
    
    const statsSQL = `
        SELECT 
            COUNT(DISTINCT paper_id) as total_papers,
            COUNT(*) as total_sessions,
            SUM(total_score) as total_score_sum,
            AVG(total_score) as avg_score,
            MAX(total_score) as best_score,
            SUM(time_spent) as total_study_time,
            COUNT(DISTINCT strftime('%Y-%m-%d', start_time)) as study_days
        FROM real_exam_sessions 
        WHERE user_id = ? AND status = 'completed'
    `;
    
    const recentSQL = `
        SELECT * FROM real_exam_sessions 
        WHERE user_id = ? AND status = 'completed'
        ORDER BY end_time DESC 
        LIMIT 5
    `;
    
    db.get(statsSQL, [user_id], (err, stats) => {
        if (err) {
            res.json({ success: false, message: '查询学习统计失败' });
            return;
        }
        
        db.all(recentSQL, [user_id], (err, recentSessions) => {
            if (err) {
                res.json({ success: false, message: '查询最近记录失败' });
                return;
            }
            
            // 处理最近记录
            const processedSessions = recentSessions.map(session => {
                try {
                    session.answers = JSON.parse(session.answers || '{}');
                } catch (e) {
                    session.answers = {};
                }
                return session;
            });
            
            res.json({ 
                success: true, 
                data: {
                    stats: stats,
                    recentSessions: processedSessions
                }
            });
        });
    });
});

module.exports = router;