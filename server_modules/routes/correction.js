const express = require('express');
const router = express.Router();
const AIService = require('../services/ai-service');
const multer = require('multer');
const path = require('path');

// 配置multer用于文件上传
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.txt', '.pdf', '.doc', '.docx'];
        const fileExt = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(fileExt)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件格式'), false);
        }
    }
});

// AI批改分析
router.post('/analyze', async (req, res) => {
    try {
        const { text, examType = 'CET4', userId } = req.body;
        
        if (!text || text.trim().length === 0) {
            return res.json({ 
                success: false, 
                message: '请输入要批改的文本' 
            });
        }

        // 使用AI服务进行批改
        const correctionResult = await AIService.correctEssay(text, examType);
        
        // 记录学习活动
        if (req.app.locals.db && userId) {
            req.app.locals.db.run(
                `INSERT INTO correction_history (user_id, text, score, correction_result, created_at) VALUES (?, ?, ?, ?, ?)`,
                [userId, text.substring(0, 500), correctionResult.score.total, JSON.stringify(correctionResult), new Date().toISOString()]
            );
        }

        res.json({
            success: true,
            data: correctionResult
        });

    } catch (error) {
        console.error('批改分析错误:', error);
        res.json({ 
            success: false, 
            message: '批改服务暂时不可用' 
        });
    }
});

// 文件解析接口
router.post('/parse-file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.json({
                success: false,
                message: '请选择要上传的文件'
            });
        }

        const { originalname, buffer, mimetype } = req.file;
        
        console.log('解析文件:', { originalname, mimetype, size: buffer.length });

        // 使用AI服务解析文件内容
        const textContent = await AIService.extractTextFromFile(buffer, originalname, mimetype);

        res.json({
            success: true,
            data: {
                text: textContent,
                fileName: originalname,
                fileSize: buffer.length
            }
        });

    } catch (error) {
        console.error('文件解析错误:', error);
        res.json({
            success: false,
            message: error.message || '文件解析失败'
        });
    }
});

// 获取批改历史
router.get('/history', async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;
        
        if (req.app.locals.db) {
            req.app.locals.db.all(
                `SELECT * FROM correction_history 
                 WHERE user_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`,
                [userId, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)],
                (err, rows) => {
                    if (err) {
                        return res.json({ success: false, message: '查询历史失败' });
                    }
                    
                    // 解析批改结果
                    const processedRows = rows.map(row => {
                        try {
                            row.correction_result = JSON.parse(row.correction_result);
                        } catch (e) {
                            row.correction_result = null;
                        }
                        return row;
                    });
                    
                    res.json({
                        success: true,
                        data: processedRows,
                        total: rows.length
                    });
                }
            );
        } else {
            res.json({ success: true, data: [], total: 0 });
        }

    } catch (error) {
        console.error('获取批改历史错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 获取批改统计
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (req.app.locals.db) {
            req.app.locals.db.get(
                `SELECT 
                    COUNT(*) as total_corrections,
                    AVG(score) as avg_score,
                    MAX(score) as best_score,
                    MIN(score) as worst_score
                 FROM correction_history 
                 WHERE user_id = ?`,
                [userId],
                (err, stats) => {
                    if (err) {
                        return res.json({ success: false, message: '查询统计失败' });
                    }
                    
                    res.json({
                        success: true,
                        data: stats
                    });
                }
            );
        } else {
            res.json({ 
                success: true, 
                data: {
                    total_corrections: 0,
                    avg_score: 0,
                    best_score: 0,
                    worst_score: 0
                }
            });
        }

    } catch (error) {
        console.error('获取批改统计错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

module.exports = router;