// [file name]: server_modules/routes/bot-assistant.js
const express = require('express');
const router = express.Router();
const botService = require('../services/bot-service.js');

// 扣子智能体聊天接口
router.post('/chat', async (req, res) => {
    try {
        const { message, conversationHistory = [], assistantType = 'general', options = {} } = req.body;

        if (!message) {
            return res.json({
                success: false,
                message: '消息内容不能为空'
            });
        }

        let result;
        switch (assistantType) {
            case 'learning':
                result = await botService.learningAssistant(message, conversationHistory);
                break;
            case 'translation':
                result = await botService.translationAssistant(message);
                break;
            case 'writing':
                result = await botService.writingAssistant(message);
                break;
            default:
                const messages = [
                    ...conversationHistory,
                    { role: "user", content: message }
                ];
                result = await botService.chat(messages, options);
        }

        res.json(result);

    } catch (error) {
        console.error('扣子智能体聊天错误:', error);
        res.json({
            success: false,
            message: '服务器错误: ' + error.message
        });
    }
});

// 流式聊天接口
router.post('/chat/stream', async (req, res) => {
    try {
        const { message, conversationHistory = [] } = req.body;

        if (!message) {
            return res.json({
                success: false,
                message: '消息内容不能为空'
            });
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        const messages = [
            ...conversationHistory,
            { role: "user", content: message }
        ];

        await botService.chatStream(messages,
            (chunk) => {
                res.write(chunk);
            },
            (error) => {
                res.write(`错误: ${error}`);
                res.end();
            },
            { temperature: 0.7 }
        );

        res.end();

    } catch (error) {
        console.error('扣子流式聊天错误:', error);
        res.json({
            success: false,
            message: '服务器错误: ' + error.message
        });
    }
});

// 文本批改接口
router.post('/correct', async (req, res) => {
    try {
        const { text, correctionType = 'overall' } = req.body;

        if (!text) {
            return res.json({
                success: false,
                message: '文本内容不能为空'
            });
        }

        const result = await botService.correctText(text, correctionType);
        res.json(result);

    } catch (error) {
        console.error('扣子文本批改错误:', error);
        res.json({
            success: false,
            message: '服务器错误: ' + error.message
        });
    }
});

// 获取模型列表
router.get('/models', async (req, res) => {
    try {
        const result = await botService.getAvailableModels();
        res.json(result);
    } catch (error) {
        console.error('获取模型列表错误:', error);
        res.json({
            success: false,
            message: '服务器错误: ' + error.message
        });
    }
});

// 获取服务状态
router.get('/status', async (req, res) => {
    try {
        const status = botService.getServiceStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('获取服务状态错误:', error);
        res.json({
            success: false,
            message: '服务器错误: ' + error.message
        });
    }
});

module.exports = router;