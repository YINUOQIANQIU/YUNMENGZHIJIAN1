const express = require('express');
const router = express.Router();
const db = require('../database.js');

// 获取词汇库数据
router.get('/data', async (req, res) => {
    try {
        const vocabularyData = require('../../data/vocabulary-library.json');
        res.json({
            success: true,
            data: vocabularyData
        });
    } catch (error) {
        console.error('获取词汇数据失败:', error);
        res.status(500).json({
            success: false,
            message: '获取词汇数据失败'
        });
    }
});

// 获取用户词汇学习进度
router.get('/progress', async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 这里简化实现，实际应该从数据库查询
        const defaultProgress = {
            userId: userId,
            statistics: {
                totalWordsLearned: 0,
                masteredWords: 0,
                wordsToReview: 0,
                currentStreak: 0,
                todayProgress: 0
            },
            wordProgress: {},
            lastStudyDate: null
        };
        
        res.json({
            success: true,
            data: defaultProgress
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取学习进度失败'
        });
    }
});

// 更新词汇学习进度
router.post('/progress', async (req, res) => {
    try {
        const userId = req.user.id;
        const progressData = req.body;
        
        // 这里应该保存到数据库
        console.log('更新用户进度:', userId, progressData);
        
        res.json({
            success: true,
            message: '进度更新成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '更新进度失败'
        });
    }
});

module.exports = router;