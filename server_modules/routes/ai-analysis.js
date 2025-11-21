// [file name]: server_modules/routes/ai-analysis.js
const express = require('express');
const router = express.Router();
const db = require('../database').db;

// 保存AI分析结果
router.post('/save-analysis', async (req, res) => {
    try {
        const { userId, examType, analysisData, abilityMap, weakPoints, learningPath, reviewPlan, overallScore, level } = req.body;

        if (!userId || !examType || !analysisData) {
            return res.json({ success: false, message: '缺少必要参数' });
        }

        const query = `
            INSERT INTO ai_analysis_results 
            (user_id, exam_type, analysis_data, ability_map, weak_points, learning_path, review_plan, overall_score, level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(query, [
            userId,
            examType,
            JSON.stringify(analysisData),
            JSON.stringify(abilityMap),
            JSON.stringify(weakPoints),
            JSON.stringify(learningPath),
            JSON.stringify(reviewPlan),
            overallScore,
            level
        ], function(err) {
            if (err) {
                console.error('保存AI分析结果失败:', err);
                return res.json({ success: false, message: '保存失败' });
            }

            res.json({
                success: true,
                recordId: this.lastID,
                message: '分析结果保存成功'
            });
        });

    } catch (error) {
        console.error('保存AI分析结果服务器错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 创建分析会话
router.post('/create-session', async (req, res) => {
    try {
        const { userId, testData } = req.body;
        const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        const query = `
            INSERT INTO analysis_sessions (user_id, session_id, test_data, status)
            VALUES (?, ?, ?, 'processing')
        `;

        db.run(query, [userId, sessionId, JSON.stringify(testData)], function(err) {
            if (err) {
                console.error('创建分析会话失败:', err);
                return res.json({ success: false, message: '创建会话失败' });
            }

            res.json({
                success: true,
                sessionId: sessionId,
                sessionDbId: this.lastID
            });
        });

    } catch (error) {
        console.error('创建分析会话服务器错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 更新分析会话结果
router.post('/update-session', async (req, res) => {
    try {
        const { sessionId, analysisResult, status } = req.body;

        const query = `
            UPDATE analysis_sessions 
            SET analysis_result = ?, status = ?, completed_at = CURRENT_TIMESTAMP
            WHERE session_id = ?
        `;

        db.run(query, [JSON.stringify(analysisResult), status, sessionId], function(err) {
            if (err) {
                console.error('更新分析会话失败:', err);
                return res.json({ success: false, message: '更新会话失败' });
            }

            res.json({
                success: true,
                message: '会话更新成功'
            });
        });

    } catch (error) {
        console.error('更新分析会话服务器错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 获取分析结果
router.get('/results/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { limit = 5, examType } = req.query;

        let query = `
            SELECT * FROM ai_analysis_results 
            WHERE user_id = ? 
        `;
        const params = [userId];

        if (examType) {
            query += ' AND exam_type = ?';
            params.push(examType);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        db.all(query, params, (err, results) => {
            if (err) {
                console.error('获取分析结果失败:', err);
                return res.json({ success: false, message: '获取失败' });
            }

            // 解析JSON数据
            const processedResults = results.map(result => {
                try {
                    result.analysis_data = JSON.parse(result.analysis_data);
                    result.ability_map = JSON.parse(result.ability_map);
                    result.weak_points = JSON.parse(result.weak_points);
                    result.learning_path = JSON.parse(result.learning_path);
                    result.review_plan = JSON.parse(result.review_plan);
                } catch (e) {
                    console.error('解析分析结果JSON失败:', e);
                }
                return result;
            });

            res.json({
                success: true,
                data: processedResults
            });
        });

    } catch (error) {
        console.error('获取分析结果服务器错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 获取最新分析结果
router.get('/latest/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        const query = `
            SELECT * FROM ai_analysis_results 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 1
        `;

        db.get(query, [userId], (err, result) => {
            if (err) {
                console.error('获取最新分析结果失败:', err);
                return res.json({ success: false, message: '获取失败' });
            }

            if (!result) {
                return res.json({ success: false, message: '未找到分析结果' });
            }

            // 解析JSON数据
            try {
                result.analysis_data = JSON.parse(result.analysis_data);
                result.ability_map = JSON.parse(result.ability_map);
                result.weak_points = JSON.parse(result.weak_points);
                result.learning_path = JSON.parse(result.learning_path);
                result.review_plan = JSON.parse(result.review_plan);
            } catch (e) {
                console.error('解析最新分析结果JSON失败:', e);
            }

            res.json({
                success: true,
                data: result
            });
        });

    } catch (error) {
        console.error('获取最新分析结果服务器错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

module.exports = router;