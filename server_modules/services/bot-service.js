// [file name]: server_modules/services/bot-service.js
const axios = require('axios');

class BotService {
    constructor() {
        this.apiConfig = {
            API_KEY: "pat_gowXG0bV6QRfRClupSdUcg4XF1b3fYIV21fj17BxEoqh7iB4nYfOJRcNB MrVKjn1",
            API_URL: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            BASE_URL: "https://open.bigmodel.cn/api/paas/v4"
        };
        
        this.rateLimit = {
            requests: 0,
            maxRequests: 1000, // 扣子API有更高的限制
            lastReset: Date.now()
        };
    }

    // 检查速率限制
    checkRateLimit() {
        const now = Date.now();
        const oneMinute = 60 * 1000;
        
        if (now - this.rateLimit.lastReset > oneMinute) {
            this.rateLimit.requests = 0;
            this.rateLimit.lastReset = now;
        }
        
        if (this.rateLimit.requests >= this.rateLimit.maxRequests) {
            return false;
        }
        
        this.rateLimit.requests++;
        return true;
    }

    // 主聊天方法
    async chat(messages, options = {}) {
        try {
            if (!this.checkRateLimit()) {
                return {
                    success: false,
                    message: '请求频率过高，请稍后再试'
                };
            }

            const { 
                model = "glm-4", 
                temperature = 0.7, 
                max_tokens = 2048, 
                stream = false,
                tools = []
            } = options;

            const requestData = {
                model: model,
                messages: messages,
                temperature: temperature,
                max_tokens: max_tokens,
                stream: stream
            };

            // 如果有工具，添加工具配置
            if (tools && tools.length > 0) {
                requestData.tools = tools;
                requestData.tool_choice = "auto";
            }

            const response = await axios.post(
                this.apiConfig.API_URL,
                requestData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiConfig.API_KEY}`,
                        'Accept': 'application/json'
                    },
                    timeout: 30000
                }
            );

            if (response.data && response.data.choices && response.data.choices.length > 0) {
                const choice = response.data.choices[0];
                return {
                    success: true,
                    content: choice.message.content,
                    tokens: response.data.usage?.total_tokens || 0,
                    model: response.data.model,
                    finish_reason: choice.finish_reason,
                    tool_calls: choice.message.tool_calls || null
                };
            } else {
                return {
                    success: false,
                    message: '扣子API返回空响应'
                };
            }

        } catch (error) {
            console.error('扣子API调用错误:', error.response?.data || error.message);
            return {
                success: false,
                message: '扣子服务暂时不可用: ' + (error.response?.data?.error?.message || error.message)
            };
        }
    }

    // 流式聊天方法
    async chatStream(messages, onMessage, onError, options = {}) {
        try {
            if (!this.checkRateLimit()) {
                onError('请求频率过高，请稍后再试');
                return;
            }

            const { 
                model = "glm-4", 
                temperature = 0.7, 
                max_tokens = 2048 
            } = options;

            const requestData = {
                model: model,
                messages: messages,
                temperature: temperature,
                max_tokens: max_tokens,
                stream: true
            };

            const response = await fetch(this.apiConfig.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiConfig.API_KEY}`
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.choices && data.choices[0].delta) {
                                const content = data.choices[0].delta.content;
                                if (content) {
                                    onMessage(content);
                                }
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }

        } catch (error) {
            console.error('扣子流式API错误:', error);
            onError(error.message);
        }
    }

    // 专用学习助手
    async learningAssistant(message, conversationHistory = []) {
        const messages = [
            {
                role: "system",
                content: `你是一个专业的英语学习助手，专注于帮助用户提升英语水平。请根据用户的学习需求提供：
1. 精准的语法纠正和解释
2. 词汇扩展和用法指导
3. 学习策略和建议
4. 四六级考试备考指导
5. 个性化的学习计划

请用专业、友好的语气回答，确保内容准确且易于理解。`
            },
            ...conversationHistory,
            {
                role: "user",
                content: message
            }
        ];

        return await this.chat(messages, {
            temperature: 0.3,
            max_tokens: 2000
        });
    }

    // 专用翻译助手
    async translationAssistant(text, sourceLang = 'auto', targetLang = 'en') {
        const messages = [
            {
                role: "system",
                content: `你是一个专业的翻译助手，精通中英文互译。请确保：
1. 翻译准确，保持原意
2. 语言自然流畅，符合目标语言习惯
3. 文化差异处理得当
4. 专业术语翻译准确

请提供高质量的翻译服务。`
            },
            {
                role: "user",
                content: `请将以下${sourceLang === 'zh' ? '中文' : '英文'}文本翻译成${targetLang === 'en' ? '英文' : '中文'}：
                
${text}`
            }
        ];

        return await this.chat(messages, {
            temperature: 0.1,
            max_tokens: 1000
        });
    }

    // 专用写作助手
    async writingAssistant(text, writingType = 'essay') {
        const prompt = this.getWritingPrompt(writingType);
        
        const messages = [
            {
                role: "system",
                content: `你是一个专业的英语写作教练，擅长各类英语写作指导。请提供：
1. 结构分析和建议
2. 语法和用词改进
3. 逻辑连贯性评估
4. 具体的修改建议
5. 写作技巧指导`
            },
            {
                role: "user",
                content: `${prompt}

作文内容：
${text}`
            }
        ];

        return await this.chat(messages, {
            temperature: 0.2,
            max_tokens: 3000
        });
    }

    // 获取写作提示
    getWritingPrompt(writingType) {
        const prompts = {
            essay: "请对这篇英语作文进行全面分析和指导：",
            email: "请分析这封英文邮件的写作质量并提供改进建议：",
            report: "请评估这份英文报告的结构和内容：",
            story: "请分析这个英文故事的创作技巧："
        };
        
        return prompts[writingType] || prompts.essay;
    }

    // 智能批改方法
    async correctText(text, correctionType = 'grammar') {
        const correctionPrompts = {
            grammar: "请检查以下文本的语法错误，指出错误并提供修正：",
            vocabulary: "请分析以下文本的词汇使用，提供更合适的词汇建议：",
            structure: "请分析以下文本的结构问题，提供改进建议：",
            overall: "请对以下文本进行全面评估和改进："
        };

        const messages = [
            {
                role: "system",
                content: "你是一个专业的文本校对专家，擅长发现和改进各种语言问题。请提供具体、实用的改进建议。"
            },
            {
                role: "user",
                content: `${correctionPrompts[correctionType]}

${text}`
            }
        ];

        return await this.chat(messages, {
            temperature: 0.2,
            max_tokens: 2000
        });
    }

    // 获取可用模型
    async getAvailableModels() {
        // 扣子API目前支持的模型
        return {
            success: true,
            models: [
                {
                    id: "glm-4",
                    name: "GLM-4",
                    description: "最新一代基座模型，性能全面提升",
                    max_tokens: 8192,
                    capabilities: ["chat", "completion", "function_call"]
                },
                {
                    id: "glm-3-turbo",
                    name: "GLM-3-Turbo",
                    description: "高速推理模型，响应更快",
                    max_tokens: 8192,
                    capabilities: ["chat", "completion"]
                }
            ]
        };
    }

    // 获取服务状态
    getServiceStatus() {
        return {
            name: '扣子智能体',
            enabled: true,
            rateLimit: {
                used: this.rateLimit.requests,
                max: this.rateLimit.maxRequests,
                resetIn: 60000 - (Date.now() - this.rateLimit.lastReset)
            },
            models: ['glm-4', 'glm-3-turbo']
        };
    }
}

module.exports = new BotService();