// [file name]: server_modules/routes/assessment-questions.js
const express = require('express');
const router = express.Router();
const db = require('../database').db;

// 获取评估题目 - 简化版本，主要作为备用
router.get('/questions', (req, res) => {
    try {
        const { examType, dimension, count = 5 } = req.query;
        
        console.log('获取题目参数:', { examType, dimension, count });
        
        if (!examType || !dimension) {
            return res.json({ 
                success: false, 
                message: '缺少必要参数' 
            });
        }

        // 验证维度
        const validDimensions = ['vocabulary', 'grammar', 'reading', 'translation'];
        if (!validDimensions.includes(dimension)) {
            return res.json({ 
                success: false, 
                message: '不支持的题目维度' 
            });
        }

        // 简单返回成功，因为题目现在主要在客户端
        res.json({
            success: true,
            message: '题目数据主要在客户端，请使用本地题目',
            questions: [] // 返回空数组，客户端会使用本地数据
        });
        
    } catch (error) {
        console.error('获取题目服务器错误:', error);
        res.json({ 
            success: false, 
            message: '服务器错误，请使用本地题目数据' 
        });
    }
});

// 获取测试配置
router.get('/test-config', (req, res) => {
    try {
        const { examType } = req.query;
        
        const configs = {
            CET4: {
                totalTime: 1800,
                dimensions: {
                    vocabulary: { count: 5, time: 300 },
                    grammar: { count: 5, time: 300 },
                    reading: { count: 5, time: 600 },
                    translation: { count: 5, time: 600 }
                }
            },
            CET6: {
                totalTime: 2100,
                dimensions: {
                    vocabulary: { count: 5, time: 300 },
                    grammar: { count: 5, time: 300 },
                    reading: { count: 5, time: 600 },
                    translation: { count: 5, time: 900 }
                }
            }
        };

        const config = configs[examType] || configs.CET4;

        res.json({
            success: true,
            examType: examType,
            config: config
        });

    } catch (error) {
        console.error('获取测试配置失败:', error);
        res.json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

// 获取所有维度
router.get('/dimensions', (req, res) => {
    res.json({
        success: true,
        dimensions: ['vocabulary', 'grammar', 'reading', 'translation']
    });
});

module.exports = router;