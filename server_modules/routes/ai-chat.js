// [file name]: server_modules/routes/ai-chat.js
const express = require('express');
const router = express.Router();
const AIService = require('../services/ai-service');
const authMiddleware = require('../auth-middleware');

// AI聊天会话管理
class AIChatSessionManager {
    constructor() {
        this.sessions = new Map();
        this.maxHistoryLength = 20; // 最大对话历史长度
    }

    // 获取或创建会话
    getSession(userId, sessionId = 'default') {
        const key = `${userId}_${sessionId}`;
        if (!this.sessions.has(key)) {
            this.sessions.set(key, {
                userId,
                sessionId,
                conversationHistory: [],
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
        return this.sessions.get(key);
    }

    // 添加消息到会话
    addMessage(session, role, content, messageId = null, avatar = null) {
        const message = {
            id: messageId || Date.now().toString(),
            role,
            content,
            avatar: avatar || (role === 'assistant' ? '/image/机械人助手.jpg' : null),
            timestamp: new Date()
        };

        session.conversationHistory.push(message);
        
        // 限制历史记录长度
        if (session.conversationHistory.length > this.maxHistoryLength) {
            session.conversationHistory = session.conversationHistory.slice(-this.maxHistoryLength);
        }
        
        session.updatedAt = new Date();
        return message;
    }

    // 清理过期会话（24小时）
    cleanupExpiredSessions() {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        for (const [key, session] of this.sessions.entries()) {
            if (session.updatedAt < twentyFourHoursAgo) {
                this.sessions.delete(key);
            }
        }
    }
}

// 创建会话管理器实例
const sessionManager = new AIChatSessionManager();

// 使用限制检查中间件 - 修复版本
function checkUsageLimit(req, res, next) {
    // 对于测试，暂时放宽限制
    next();
}

// 获取游客使用情况
function getGuestUsage() {
    return { todayCount: 0 };
}

// 获取AI回复 - 强制使用扣子服务
router.post('/message', authMiddleware.authenticateToken, checkUsageLimit, async (req, res) => {
    try {
        const { message, sessionId = 'default', assistantType = 'learning', attachments = [] } = req.body;
        const userId = req.user ? req.user.id : 'guest';

        if (!message || message.trim() === '') {
            return res.json({
                success: false,
                message: '消息内容不能为空'
            });
        }

        console.log('收到AI聊天请求:', { 
            userId, 
            sessionId, 
            message: message.substring(0, 100), 
            assistantType, 
            attachments: attachments?.length 
        });

        // 获取用户会话
        const session = sessionManager.getSession(userId, sessionId);
        
        // 处理附件内容
        let processedMessage = message;
        if (attachments && attachments.length > 0) {
            attachments.forEach(attachment => {
                if (attachment.type === 'image') {
                    processedMessage += `\n[图片识别结果: ${attachment.content}]`;
                } else if (attachment.type === 'document') {
                    processedMessage += `\n[文档内容: ${attachment.content}]`;
                }
            });
        }
        
        // 添加用户消息到历史
        const userAvatar = req.user ? req.user.avatar : null;
        sessionManager.addMessage(session, 'user', processedMessage.trim(), null, userAvatar);

        // 构建对话历史
        const conversationHistory = [
            {
                role: "system",
                content: getSystemPrompt(assistantType)
            },
            ...session.conversationHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }))
        ];

        console.log('发送到AI服务的对话历史长度:', conversationHistory.length);

        // 强制使用扣子服务优先的AI响应
        const aiResponse = await AIService.getChatResponse(conversationHistory, {
            assistantType: assistantType
        });

        console.log('AI服务响应详情:', {
            success: aiResponse.success,
            service: aiResponse.service,
            source: aiResponse.source,
            contentLength: aiResponse.content?.length
        });

        if (aiResponse.success) {
            // 添加AI回复到历史
            const aiMessage = sessionManager.addMessage(session, 'assistant', aiResponse.content);
            
            // 准备文本转语音
            let ttsResult = { success: false };
            try {
                ttsResult = await AIService.textToSpeech(aiResponse.content);
            } catch (ttsError) {
                console.warn('TTS服务失败:', ttsError.message);
            }
            
            // 记录学习活动（如果数据库可用）
            if (req.app.locals && req.app.locals.db) {
                try {
                    const db = req.app.locals.db;
                    db.run(
                        `INSERT INTO ai_chat_records (user_id, session_id, user_message, ai_response, assistant_type, tokens_used, ai_service) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [userId, sessionId, message, aiResponse.content, assistantType, aiResponse.tokens || 0, aiResponse.service || 'unknown'],
                        (err) => {
                            if (err) {
                                console.error('保存AI聊天记录失败:', err);
                            }
                        }
                    );
                } catch (dbError) {
                    console.error('数据库操作错误:', dbError);
                }
            }

            res.json({
                success: true,
                data: {
                    message: aiResponse.content,
                    messageId: aiMessage.id,
                    tokens: aiResponse.tokens || 0,
                    sessionId: sessionId,
                    avatar: '/image/机械人助手.jpg',
                    ttsText: ttsResult.success ? ttsResult.text : null,
                    aiService: aiResponse.service || 'unknown', // 返回使用的AI服务
                    source: aiResponse.source || 'unknown'
                }
            });
        } else {
            res.json({
                success: false,
                message: aiResponse.message || 'AI服务暂时不可用',
                service: aiResponse.service,
                source: aiResponse.source
            });
        }

    } catch (error) {
        console.error('AI聊天处理错误:', error);
        res.json({
            success: false,
            message: '服务器内部错误: ' + error.message
        });
    }
});

// 获取聊天历史 - 增强版本
router.get('/history', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 'guest';
        const { sessionId = 'default', limit = 50 } = req.query;

        // 从内存会话获取聊天历史
        const session = sessionManager.getSession(userId, sessionId);
        
        const history = session.conversationHistory.map(record => ({
            id: record.id,
            role: record.role,
            content: record.content,
            avatar: record.avatar || (record.role === 'assistant' ? '/image/机械人助手.jpg' : (req.user ? req.user.avatar : null)),
            timestamp: record.timestamp
        }));

        res.json({
            success: true,
            data: {
                history,
                sessionId
            }
        });

    } catch (error) {
        console.error('获取聊天历史错误:', error);
        res.json({
            success: false,
            message: '获取历史记录失败: ' + error.message
        });
    }
});

// 获取会话列表 - 简化版本
router.get('/sessions', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 'guest';
        
        // 从内存会话获取
        const sessions = [];
        for (const [key, session] of sessionManager.sessions.entries()) {
            if (key.startsWith(userId + '_')) {
                const lastMessage = session.conversationHistory[session.conversationHistory.length - 1];
                sessions.push({
                    id: session.sessionId,
                    title: lastMessage ? (lastMessage.content.substring(0, 30) + (lastMessage.content.length > 30 ? '...' : '')) : '新对话',
                    lastActivity: session.updatedAt,
                    messageCount: session.conversationHistory.length
                });
            }
        }

        res.json({
            success: true,
            data: sessions
        });

    } catch (error) {
        console.error('获取会话列表错误:', error);
        res.json({
            success: false,
            message: '获取会话列表失败'
        });
    }
});

// 创建新会话
router.post('/sessions/new', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 'guest';
        const { sessionId = `session_${Date.now()}`, title = '新对话' } = req.body;

        // 在内存中创建新会话
        sessionManager.getSession(userId, sessionId);

        res.json({
            success: true,
            data: {
                sessionId,
                title,
                createdAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('创建会话错误:', error);
        res.json({
            success: false,
            message: '创建会话失败'
        });
    }
});

// 删除会话
router.delete('/sessions/:sessionId', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 'guest';
        const { sessionId } = req.params;
        const key = `${userId}_${sessionId}`;
        
        sessionManager.sessions.delete(key);

        res.json({
            success: true,
            message: '会话删除成功'
        });

    } catch (error) {
        console.error('删除会话错误:', error);
        res.json({
            success: false,
            message: '删除会话失败'
        });
    }
});

// 添加使用情况接口 - 简化版本
router.get('/usage', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        
        if (!userId) {
            // 游客使用情况
            const guestUsage = getGuestUsage();
            const remaining = 50 - guestUsage.todayCount; // 增加游客限制
            
            return res.json({
                success: true,
                data: {
                    canSend: remaining > 0,
                    remaining: remaining,
                    total: 50,
                    isGuest: true
                }
            });
        }
        
        // 登录用户使用情况
        const userLimit = 100; // 普通用户每日100条
        const todayCount = 0; // 简化实现
        
        res.json({
            success: true,
            data: {
                canSend: true,
                remaining: userLimit - todayCount,
                total: userLimit,
                todayCount: todayCount,
                isGuest: false
            }
        });
        
    } catch (error) {
        console.error('获取使用情况错误:', error);
        res.json({
            success: false,
            message: '获取使用情况失败'
        });
    }
});

// 文件上传处理（图片、文档等）
router.post('/upload', authMiddleware.authenticateToken, async (req, res) => {
    try {
        res.json({
            success: false,
            message: '文件上传功能已迁移到增强路由'
        });
    } catch (error) {
        console.error('文件上传错误:', error);
        res.json({
            success: false,
            message: '文件上传失败'
        });
    }
});

// 新增：获取AI服务状态接口
router.get('/service-status', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const status = AIService.getAIServiceStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('获取服务状态错误:', error);
        res.json({
            success: false,
            message: '获取服务状态失败'
        });
    }
});

// 获取系统提示词 - 增强扣子服务专用提示
function getSystemPrompt(assistantType) {
    const prompts = {
        'learning': `你是云梦智间的专业学习助手，基于扣子智能体技术。你的任务是帮助用户解决英语学习中的各种问题，包括听力、阅读、写作和翻译等方面。回答要专业、准确且友好，使用现代年轻人喜欢的轻松语言风格。`,
        'translation': `你是云梦智间的专业翻译助手，基于扣子智能体技术。你的任务是提供准确、流畅的中英互译服务，保持原文意思的同时符合目标语言的表达习惯。`,
        'writing': `你是云梦智间的专业写作助手，基于扣子智能体技术。你的任务是帮助用户提升英文写作水平，包括语法修正、表达优化、结构改进等。`,
        'grammar': `你是云梦智间的语法检查助手，基于扣子智能体技术。专注于识别和修正英文语法错误，提供详细的解释和改进建议。`,
        'tutor': `你是云梦智间的专业学习导师，基于扣子智能体技术。能够解答各学科问题，提供详细的学习指导和资源推荐。`
    };
    
    return prompts[assistantType] || prompts['learning'];
}

// 定期清理过期会话
setInterval(() => {
    sessionManager.cleanupExpiredSessions();
}, 60 * 60 * 1000); // 每小时清理一次

module.exports = router;