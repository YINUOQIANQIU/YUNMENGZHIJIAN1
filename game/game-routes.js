// game/game-routes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// 导入游戏服务器
const GameServer = require('../game-server.js');

// 创建游戏服务器实例
const gameServer = new GameServer();

// 游戏健康检查
router.get('/health', (req, res) => {
    const healthData = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        players: gameServer.players.size,
        sessions: gameServer.gameSessions.size,
        questions: gameServer.questions.length,
        version: '2.0.0'
    };

    res.json(healthData);
});

// 获取题目
router.get('/questions', (req, res) => {
    try {
        const difficulty = req.query.difficulty || 'medium';
        const category = req.query.category;
        const limit = parseInt(req.query.limit) || 10;
        
        // 使用游戏服务器的题目生成逻辑
        let questions = gameServer.generateQuestionsFromVocabulary(difficulty, limit);
        
        if (questions.length === 0) {
            questions = [...gameServer.questions];
        }
        
        let filteredQuestions = [...questions];
        
        if (difficulty) {
            filteredQuestions = filteredQuestions.filter(q => q.difficulty === difficulty);
        }
        
        if (category) {
            filteredQuestions = filteredQuestions.filter(q => q.category === category);
        }
        
        const selectedQuestions = gameServer.shuffleArray(filteredQuestions).slice(0, limit);
        
        res.json(selectedQuestions);
        
    } catch (error) {
        console.error('获取题目失败:', error);
        const selectedQuestions = gameServer.shuffleArray([...gameServer.questions]).slice(0, 10);
        res.json(selectedQuestions);
    }
});

// 创建游戏会话
router.post('/sessions', (req, res) => {
    try {
        const { playerId, difficulty = 'medium' } = req.body;
        
        if (!playerId) {
            return res.status(400).json({ error: '缺少玩家ID' });
        }

        const sessionId = gameServer.generateSessionId();
        const session = {
            id: sessionId,
            players: [playerId],
            difficulty,
            state: 'waiting',
            score: 0,
            level: 1,
            startTime: new Date(),
            currentQuestion: null,
            questions: gameServer.getQuestionsForDifficulty(difficulty),
            usedQuestions: new Set()
        };

        gameServer.gameSessions.set(sessionId, session);
        
        res.json({ 
            sessionId, 
            session: {
                id: session.id,
                difficulty: session.difficulty,
                state: session.state
            }
        });
        
    } catch (error) {
        res.status(400).json({ error: '无效的JSON数据' });
    }
});

// 获取玩家统计
router.get('/stats/:playerId', (req, res) => {
    const playerId = req.params.playerId;
    
    const stats = {
        playerId,
        totalGames: Math.floor(Math.random() * 50),
        highScore: Math.floor(Math.random() * 10000),
        averageScore: Math.floor(Math.random() * 5000),
        favoriteCategory: 'vocabulary',
        weakAreas: ['grammar', 'spelling'],
        achievements: ['score_1000', 'combo_10']
    };

    res.json(stats);
});

// 词汇管理API - 直接使用游戏服务器的处理函数
router.get('/vocabulary/export-vocabulary-json', (req, res) => {
    gameServer.handleExportVocabulary(req, res);
});

router.get('/vocabulary/vocabulary-statistics', (req, res) => {
    gameServer.handleVocabularyStats(req, res);
});

router.get('/vocabulary/check-vocabulary-integrity', (req, res) => {
    gameServer.handleCheckIntegrity(req, res);
});

router.get('/vocabulary/get-imported-files', (req, res) => {
    gameServer.handleGetImportedFiles(req, res);
});

router.get('/vocabulary/get-file-details', (req, res) => {
    gameServer.handleGetFileDetails(req, res);
});

router.post('/vocabulary/generate-vocabulary-sample', (req, res) => {
    gameServer.handleGenerateSample(req, res);
});

router.post('/vocabulary/cleanup-vocabulary-data', (req, res) => {
    gameServer.handleCleanupData(req, res);
});

router.post('/vocabulary/import-vocabulary-multiple', (req, res) => {
    gameServer.handleImportVocabularyMultiple(req, res);
});

router.post('/vocabulary/delete-imported-file', (req, res) => {
    gameServer.handleDeleteImportedFile(req, res);
});

module.exports = router;