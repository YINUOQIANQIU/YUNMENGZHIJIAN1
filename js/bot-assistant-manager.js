// [file name]: server_modules/routes/bot-assistant.js
const express = require('express');
const router = express.Router();
const botService = require('../services/bot-service.js');

// 扣子智能体聊天接口 - 增强版本
router.post('/chat', async (req, res) => {
    try {
        const { message, conversationHistory = [], assistantType = 'general', options = {} } = req.body;

        if (!message) {
            return res.json({
                success: false,
                message: '消息内容不能为空'
            });
        }

        console.log('扣子智能体请求:', {
            messageLength: message.length,
            historyLength: conversationHistory.length,
            assistantType: assistantType
        });

        let result;
        const startTime = Date.now();
        
        try {
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
            
            const responseTime = Date.now() - startTime;
            console.log(`✅ 扣子服务响应成功 - 耗时: ${responseTime}ms`);
            
        } catch (botError) {
            console.error('扣子服务处理错误:', botError);
            result = {
                success: false,
                message: '扣子服务处理失败: ' + botError.message
            };
        }

        // 添加服务标识
        if (result.success) {
            result.service = 'bot';
            result.source = 'bot_primary';
        }

        res.json(result);

    } catch (error) {
        console.error('扣子智能体聊天错误:', error);
        res.json({
            success: false,
            message: '服务器错误: ' + error.message,
            service: 'bot',
            source: 'bot_error'
        });
    }
});

// 扣子智能体流式聊天接口
router.post('/chat/stream', async (req, res) => {
    try {
        const { message, conversationHistory = [], assistantType = 'general', options = {} } = req.body;

        if (!message) {
            return res.json({
                success: false,
                message: '消息内容不能为空'
            });
        }

        console.log('扣子流式聊天请求:', {
            messageLength: message.length,
            historyLength: conversationHistory.length,
            assistantType: assistantType
        });

        // 设置流式响应头
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        const messages = [
            ...conversationHistory,
            { role: "user", content: message }
        ];

        try {
            await botService.streamChat(messages, (chunk) => {
                res.write(chunk);
            }, options);

            res.end();
            
        } catch (botError) {
            console.error('扣子流式服务处理错误:', botError);
            res.write(JSON.stringify({
                success: false,
                message: '扣子流式服务处理失败: ' + botError.message
            }));
            res.end();
        }

    } catch (error) {
        console.error('扣子智能体流式聊天错误:', error);
        res.write(JSON.stringify({
            success: false,
            message: '服务器错误: ' + error.message
        }));
        res.end();
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

        console.log('文本批改请求:', {
            textLength: text.length,
            correctionType: correctionType
        });

        const result = await botService.correctText(text, correctionType);
        
        // 添加服务标识
        if (result.success) {
            result.service = 'bot';
            result.source = 'bot_correction';
        }

        res.json(result);

    } catch (error) {
        console.error('文本批改错误:', error);
        res.json({
            success: false,
            message: '文本批改失败: ' + error.message,
            service: 'bot',
            source: 'bot_error'
        });
    }
});

// 获取服务状态接口
router.get('/status', async (req, res) => {
    try {
        console.log('获取扣子服务状态');
        
        const status = await botService.getStatus();
        
        res.json({
            success: true,
            data: status,
            service: 'bot',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('获取服务状态错误:', error);
        res.json({
            success: false,
            message: '获取服务状态失败: ' + error.message,
            service: 'bot',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;