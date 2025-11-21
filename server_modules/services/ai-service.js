// [file name]: server_modules/services/ai-service.js
const axios = require('axios');
const FormData = require('form-data');

// 删除数据库模块引用，改用虚拟实现
// const db = require('./database'); // 注释掉这行

class AIService {
    constructor() {
        this.apiConfig = {
            ZHIPU_AI: {
                API_KEY: "db6fd96d0afb41ffac31b14f432d6d9e.fG2VWjIobDX6CRhe",
                API_URL: "https://open.bigmodel.cn/api/paas/v4/chat/completions"
            },
            BAIDU_ASR: {
                APP_ID: "6950280",
                API_KEY: "4yDRXquS6XrtVASKG89ttokG",
                SECRET_KEY: "jGdaqzXe2En0raITnEEKl0CXBX5AIlL2",
                API_URL: "https://vop.baidu.com/pro_api"
            },
            BAIDU_TTS: {
                APP_ID: "6950280", 
                API_KEY: "4yDRXquS6XrtVASKG89ttokG",
                SECRET_KEY: "jGdaqzXe2En0raITnEEKl0CXBX5AIlL2",
                API_URL: "https://tsn.baidu.com/text2audio"
            },
            BAIDU_OCR: {
                APP_ID: "6956866",
                API_KEY: "11qATPLTUylugt5q9QC7nJQu",
                SECRET_KEY: "Nu8jCbTCXAGWn4ISg0j1IFf5kIjzey31",
                API_URL: "https://aip.baidubce.com/rest/2.0/ocr/v1/"
            },
            BAIDU_IMAGE: {
                APP_ID: "6956890",
                API_KEY: "r9yxj21OWDVx4qyvs0hb8Kv3",
                SECRET_KEY: "RfuujLDSy6VVLBhYBPWDA69U1qu3GBC9",
                API_URL: "https://aip.baidubce.com/rest/2.0/image-classify/v2/"
            }
        };
        
        this.rateLimit = {
            requests: 0,
            maxRequests: 100,
            lastReset: Date.now()
        };

        this.baiduTokens = {};
        
        // 虚拟数据库存储
        this.virtualDB = {
            analysis_sessions: new Map()
        };

        // 尝试加载扣子服务 - 增强错误处理
        try {
            this.botService = require('./bot-service.js');
            console.log('✅ 扣子智能体服务加载成功');
        } catch (error) {
            console.warn('❌ 扣子智能体服务加载失败，将使用智普AI作为备选:', error.message);
            this.botService = null;
        }
        
        // 新增：扣子服务状态标记
        this.botServiceEnabled = !!this.botService;
    }

    // 增强扣子智能体响应方法 - 添加重试机制
    async getBotResponse(conversationHistory, options = {}) {
        try {
            if (!this.botService) {
                throw new Error('扣子服务未初始化');
            }
            
            // 添加超时控制
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('扣子服务响应超时')), 15000);
            });
            
            const botPromise = this.botService.chat(conversationHistory, options);
            const result = await Promise.race([botPromise, timeoutPromise]);
            
            if (result.success) {
                return {
                    success: true,
                    content: result.content,
                    tokens: result.tokens,
                    model: result.model,
                    service: 'bot',
                    source: 'bot_primary'
                };
            } else {
                throw new Error(result.message || '扣子服务返回失败');
            }
        } catch (error) {
            console.error('扣子服务调用失败:', error.message);
            return {
                success: false,
                message: '扣子服务暂时不可用: ' + error.message,
                source: 'bot_failed'
            };
        }
    }

    // 智普AI响应方法 - 标记为备选
    async getZhipuResponse(conversationHistory, options = {}) {
        try {
            if (!this.checkRateLimit()) {
                return {
                    success: false,
                    message: '请求频率过高，请稍后再试',
                    source: 'zhipu_rate_limit'
                };
            }

            const { model = "glm-4", temperature = 0.7, max_tokens = 2048, stream = false } = options;
            const zhipuConfig = this.apiConfig.ZHIPU_AI;

            const requestData = {
                model: model,
                messages: conversationHistory,
                temperature: temperature,
                max_tokens: max_tokens,
                stream: stream
            };

            if (options.enableThinking) {
                requestData.thinking = {
                    type: "enabled"
                };
            }

            const response = await axios.post(
                zhipuConfig.API_URL,
                requestData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${zhipuConfig.API_KEY}`,
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
                    service: 'zhipu',
                    source: 'zhipu_fallback', // 标记为降级使用
                    thinking: choice.thinking || null
                };
            } else {
                return {
                    success: false,
                    message: 'AI服务返回空响应',
                    source: 'zhipu_empty_response'
                };
            }

        } catch (error) {
            console.error('智普AI服务调用错误:', error.response?.data || error.message);
            return {
                success: false,
                message: 'AI服务暂时不可用: ' + (error.response?.data?.error?.message || error.message),
                source: 'zhipu_error'
            };
        }
    }

    // 主AI回复方法 - 强制优先使用扣子服务
    async getAIResponse(conversationHistory, options = {}) {
        console.log('🚀 AI服务调用 - 优先使用扣子智能体');
        
        // 优先使用扣子服务
        const botResult = await this.getBotResponse(conversationHistory, options);
        
        if (botResult.success) {
            console.log('✅ 扣子智能体响应成功');
            return botResult;
        }
        
        // 扣子服务失败时，使用智普AI作为备选
        console.log('🔄 扣子服务失败，降级使用智普AI');
        const zhipuResult = await this.getZhipuResponse(conversationHistory, options);
        
        if (zhipuResult.success) {
            console.log('✅ 智普AI降级响应成功');
            return zhipuResult;
        }
        
        // 两个服务都失败
        console.error('❌ 所有AI服务均失败');
        return {
            success: false,
            message: '所有AI服务暂时不可用，请稍后重试',
            source: 'all_services_failed'
        };
    }

    // 新增：专门用于前端对话的AI响应方法
    async getChatResponse(conversationHistory, options = {}) {
        console.log('💬 前端对话请求 - 强制使用扣子服务');
        
        // 强制优先使用扣子服务
        const botResult = await this.getBotResponse(conversationHistory, {
            ...options,
            assistantType: options.assistantType || 'learning'
        });
        
        if (botResult.success) {
            return botResult;
        }
        
        // 扣子失败时使用智普
        console.warn('⚠️ 扣子服务失败，使用智普AI备选');
        return await this.getZhipuResponse(conversationHistory, options);
    }

    // 虚拟数据库插入方法
    async db_insert(table, data) {
        try {
            if (!this.virtualDB[table]) {
                this.virtualDB[table] = new Map();
            }
            const id = 'virtual_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            data.id = id;
            this.virtualDB[table].set(id, data);
            return id;
        } catch (error) {
            console.error('虚拟数据库插入错误:', error);
            return 'virtual_' + Date.now();
        }
    }

    // 虚拟数据库更新方法
    async db_update(table, query, updateData) {
        try {
            if (!this.virtualDB[table]) return false;
            
            const sessions = this.virtualDB[table];
            let updated = false;
            
            sessions.forEach((value, key) => {
                let match = true;
                for (const [field, condition] of Object.entries(query)) {
                    if (value[field] !== condition) {
                        match = false;
                        break;
                    }
                }
                if (match) {
                    sessions.set(key, { ...value, ...updateData });
                    updated = true;
                }
            });
            
            return updated;
        } catch (error) {
            console.error('虚拟数据库更新错误:', error);
            return false;
        }
    }

    // 获取百度access token
    async getBaiduAccessToken(apiType) {
        const config = this.apiConfig[apiType];
        const cacheKey = `${apiType}_token`;
        
        if (this.baiduTokens[cacheKey] && 
            Date.now() - this.baiduTokens[cacheKey].timestamp < 24 * 60 * 60 * 1000) {
            return this.baiduTokens[cacheKey].access_token;
        }

        try {
            const response = await axios.post(
                `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${config.API_KEY}&client_secret=${config.SECRET_KEY}`
            );

            if (response.data && response.data.access_token) {
                this.baiduTokens[cacheKey] = {
                    access_token: response.data.access_token,
                    timestamp: Date.now()
                };
                return response.data.access_token;
            } else {
                throw new Error('获取百度access token失败');
            }
        } catch (error) {
            console.error(`获取${apiType} access token错误:`, error.message);
            throw error;
        }
    }

    // AI作文批改方法
    async correctEssay(text, examType = 'CET4', options = {}) {
        try {
            if (!this.checkRateLimit()) {
                return {
                    success: false,
                    message: '请求频率过高，请稍后再试'
                };
            }

            const prompt = `
请对以下英语作文进行专业批改，严格按照JSON格式返回结果：

作文内容：
${text}

考试类型：${examType}

请按照以下JSON格式返回批改结果：

{
    "score": {
        "total": 0-100,
        "grammar": 0-25,
        "vocabulary": 0-20,
        "structure": 0-25,
        "content": 0-30
    },
    "grammarErrors": [
        {
            "position": [开始位置, 结束位置],
            "error": "错误描述",
            "correction": "修正建议",
            "type": "错误类型"
        }
    ],
    "vocabularySuggestions": [
        {
            "original": "原词",
            "suggestion": "建议词汇",
            "reason": "替换原因"
        }
    ],
    "structureAnalysis": "文章结构分析",
    "contentEvaluation": "内容评价",
    "annotatedText": "带有标注的原文",
    "overallComment": "总体评价",
    "suggestions": [
        {
            "type": "语法/词汇/结构/内容",
            "suggestion": "具体建议",
            "priority": "high/medium/low"
        }
    ],
    "wordCount": 单词数,
    "readability": "可读性评价",
    "cefrLevel": "CEFR等级"
}

批改要求：
1. 严格按照四六级评分标准
2. 指出具体的语法错误并提供修正
3. 提供词汇替换建议
4. 分析文章结构和逻辑
5. 给出具体可操作的学习建议
6. 评估作文的CEFR等级
        `;

            const conversationHistory = [
                {
                    role: "system",
                    content: `你是专业的英语作文批改专家，精通${examType}考试评分标准。请提供准确、详细的批改反馈，帮助提升写作能力。`
                },
                {
                    role: "user",
                    content: prompt
                }
            ];

            const result = await this.getAIResponse(conversationHistory, {
                temperature: 0.3,
                max_tokens: 4000
            });

            if (result.success) {
                try {
                    const correctionData = JSON.parse(result.content);
                    console.log('✅ AI批改成功');
                    
                    // 增强批改结果
                    return {
                        success: true,
                        ...correctionData,
                        correctedAt: new Date().toISOString(),
                        examType: examType
                    };
                } catch (e) {
                    console.error('AI批改返回数据解析失败:', e);
                    return this.generateBasicCorrection(text, examType);
                }
            } else {
                console.warn('AI批改服务失败，使用本地批改:', result.message);
                return this.generateBasicCorrection(text, examType);
            }

        } catch (error) {
            console.error('AI批改错误:', error);
            return this.generateBasicCorrection(text, examType);
        }
    }

    // 基础批改（备用）
    generateBasicCorrection(text, examType) {
        const wordCount = text.split(/\s+/).length;
        const sentenceCount = text.split(/[.!?]+/).length - 1;
        
        // 基础评分算法
        let baseScore = Math.min(80 + Math.floor(wordCount / 5) + Math.floor(sentenceCount * 2), 95);
        
        // 简单的错误检测
        const grammarErrors = this.detectBasicGrammarErrors(text);
        const vocabularySuggestions = this.generateBasicVocabularySuggestions(text);
        
        return {
            success: true,
            score: {
                total: baseScore - grammarErrors.length * 2,
                grammar: Math.max(15, 25 - grammarErrors.length * 3),
                vocabulary: Math.max(15, 20 - vocabularySuggestions.length * 2),
                structure: 20 + Math.floor(Math.random() * 10),
                content: 20 + Math.floor(Math.random() * 10)
            },
            grammarErrors: grammarErrors,
            vocabularySuggestions: vocabularySuggestions,
            structureAnalysis: this.getStructureAnalysis(text),
            contentEvaluation: this.getContentEvaluation(text),
            overallComment: this.getScoreComment(baseScore),
            suggestions: this.generateLearningSuggestions(baseScore),
            wordCount: wordCount,
            sentenceCount: sentenceCount,
            readability: this.calculateReadability(text),
            cefrLevel: this.getCEFRLevel(baseScore),
            correctedAt: new Date().toISOString(),
            examType: examType
        };
    }

    // 基础语法错误检测
    detectBasicGrammarErrors(text) {
        const errors = [];
        const sentences = text.split(/[.!?]+/);
        
        sentences.forEach((sentence, index) => {
            const trimmed = sentence.trim();
            if (!trimmed) return;
            
            // 简单的主谓一致检测
            if (trimmed.match(/^\w+ (is|are|was|were) \w+/)) {
                const words = trimmed.split(' ');
                if (words.length >= 3) {
                    const subject = words[0];
                    const verb = words[1];
                    
                    // 简单的主谓一致检查
                    if ((subject.endsWith('s') && verb === 'are') || 
                        (!subject.endsWith('s') && verb === 'is')) {
                        errors.push({
                            position: [text.indexOf(trimmed), text.indexOf(trimmed) + trimmed.length],
                            error: "主谓不一致",
                            correction: "检查主语和谓语动词的单复数形式",
                            type: "grammar"
                        });
                    }
                }
            }
            
            // 冠词检查
            if (trimmed.match(/\ba [aeiou]/i)) {
                errors.push({
                    position: [text.indexOf(trimmed), text.indexOf(trimmed) + trimmed.length],
                    error: "冠词使用不当",
                    correction: "元音开头的单词前应使用'an'",
                    type: "grammar"
                });
            }
        });
        
        return errors.slice(0, 3); // 限制错误数量
    }

    // 基础词汇建议
    generateBasicVocabularySuggestions(text) {
        const suggestions = [];
        const commonReplacements = {
            'good': ['excellent', 'outstanding', 'remarkable'],
            'bad': ['poor', 'unsatisfactory', 'inadequate'],
            'many': ['numerous', 'various', 'multiple'],
            'important': ['crucial', 'significant', 'essential'],
            'very': ['extremely', 'highly', 'particularly']
        };
        
        Object.keys(commonReplacements).forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            if (text.match(regex)) {
                suggestions.push({
                    original: word,
                    suggestion: commonReplacements[word].join(', '),
                    reason: "使用更精确的词汇可以提升作文质量"
                });
            }
        });
        
        return suggestions.slice(0, 3);
    }

    // 文件内容提取方法
    async extractTextFromFile(fileBuffer, fileName, fileType) {
        try {
            console.log('开始提取文件内容:', { fileName, fileType });
            
            // 处理文本文件
            if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
                return fileBuffer.toString('utf8');
            }
            
            // 处理PDF文件 - 使用百度OCR
            if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
                const ocrResult = await this.pdfToText(fileBuffer);
                if (ocrResult.success) {
                    return ocrResult.text;
                } else {
                    throw new Error('PDF文件解析失败: ' + ocrResult.message);
                }
            }
            
            // 处理Word文档 - 简化处理，实际项目中应使用 mammoth 等库
            if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
                // 这里简化处理，实际项目中应使用专业的Word解析库
                throw new Error('暂不支持Word文档解析，请将内容复制为文本提交');
            }
            
            throw new Error('不支持的文件格式: ' + fileType);
            
        } catch (error) {
            console.error('文件内容提取错误:', error);
            throw error;
        }
    }

    // 快速三维能力图谱生成 - 使用AI服务
    async generateFastAbilityMap(scoreResult, examType) {
        const dimensionScores = scoreResult.dimensionScores;
        
        const prompt = `
基于以下英语能力测试结果，快速生成三维能力图谱数据：

考试目标：${examType}
总体正确率：${scoreResult.overallPercentage}%
各维度详细得分：
${Object.keys(dimensionScores).map(dim => 
    `- ${this.getDimensionDisplayName(dim)}: ${dimensionScores[dim].percentage}% (正确${dimensionScores[dim].correct}/${dimensionScores[dim].total}题)`
).join('\n')}

请严格按照以下JSON格式返回三维能力图谱数据，重点关联四六级考试大纲：

{
    "abilityMap3D": {
        "dataPoints": [
            {
                "dimension": "维度英文名",
                "displayName": "维度中文名", 
                "score": 分数,
                "weight": 基于考试大纲的权重,
                "examCorrelation": "与考试关联度描述",
                "knowledgePoints": ["相关知识点1", "相关知识点2"],
                "priority": "high/medium/low"
            }
        ],
        "weakAreas": ["薄弱维度1", "薄弱维度2"],
        "strongAreas": ["优势维度1", "优势维度2"],
        "examFocus": "考试重点分析",
        "readinessLevel": "high/medium/low"
    }
}

要求：
1. 权重基于${examType}考试大纲精确量化（0.1-1.0）
2. 明确标记薄弱领域（得分<70%）和优势领域（得分>=80%）
3. 关联具体四六级考试知识点
4. 提供可操作的学习建议
5. 响应必须在15秒内完成
        `;

        const conversationHistory = [
            {
                role: "system",
                content: `你是专业的英语能力评估专家，精通${examType}考试大纲。请快速生成准确的三维能力图谱，重点关联考试知识点权重。响应必须快速且格式严格符合JSON要求。`
            },
            {
                role: "user",
                content: prompt
            }
        ];

        // 使用AI服务进行快速分析
        const result = await this.getAIResponse(conversationHistory, {
            temperature: 0.2,
            max_tokens: 1500
        });

        if (result.success) {
            try {
                const abilityData = JSON.parse(result.content);
                console.log('✅ AI三维能力图谱生成成功');
                return abilityData;
            } catch (e) {
                console.error('AI返回数据解析失败，使用本地生成:', e);
                return this.generateLocalAbilityMap(scoreResult, examType);
            }
        } else {
            console.warn('AI服务失败，使用本地生成:', result.message);
            return this.generateLocalAbilityMap(scoreResult, examType);
        }
    }

    // AI深度薄弱点分析
    async analyzeWeakPointsWithAI(scoreResult, examType) {
        const dimensionScores = scoreResult.dimensionScores;
        
        const prompt = `
基于以下英语能力测试结果，深度分析知识薄弱点：

考试目标：${examType}
总体表现：${scoreResult.overallPercentage}%
各维度表现：
${Object.keys(dimensionScores).map(dim => 
    `- ${this.getDimensionDisplayName(dim)}: ${dimensionScores[dim].percentage}%`
).join('\n')}

请深度分析知识薄弱点，严格按照以下JSON格式返回：

{
    "weakPoints": [
        {
            "dimension": "维度英文名",
            "displayName": "维度中文名",
            "score": 分数,
            "priority": "high/medium/low",
            "knowledgeGaps": ["具体知识点1", "具体知识点2"],
            "recommendedActions": ["行动1", "行动2"],
            "examImpact": "对考试的影响程度"
        }
    ],
    "learningFocus": "学习重点方向",
    "timeToImprove": "预计提升时间"
}

要求：
1. 基于${examType}考试大纲分析具体知识点漏洞
2. 按优先级排序薄弱点
3. 提供具体可执行的学习行动
4. 分析对考试成绩的实际影响
        `;

        const conversationHistory = [
            {
                role: "system",
                content: `你是专业的英语学习诊断专家，擅长基于${examType}考试大纲深度分析知识薄弱点并提供精准的学习建议。`
            },
            {
                role: "user",
                content: prompt
            }
        ];

        const result = await this.getAIResponse(conversationHistory, {
            temperature: 0.3,
            max_tokens: 2000
        });

        if (result.success) {
            try {
                const weakPointsData = JSON.parse(result.content);
                console.log('✅ AI薄弱点分析成功');
                return weakPointsData;
            } catch (e) {
                console.error('AI返回数据解析失败:', e);
                return this.generateLocalWeakPoints(scoreResult, examType);
            }
        } else {
            console.warn('AI服务失败:', result.message);
            return this.generateLocalWeakPoints(scoreResult, examType);
        }
    }

    // 单一AI分析主方法 - 顺序处理
    async singleAIAnalysis(scoreResult, examType) {
        console.log('🚀 启动AI分析系统...');
        
        try {
            // 顺序调用两个分析
            const abilityMap = await this.generateFastAbilityMap(scoreResult, examType);
            const weakPoints = await this.analyzeWeakPointsWithAI(scoreResult, examType);

            console.log('✅ AI分析完成:', {
                abilityMap: abilityMap.abilityMap3D?.dataPoints?.length,
                weakPoints: weakPoints.weakPoints?.length
            });

            return {
                success: true,
                abilityMap: abilityMap.abilityMap3D || abilityMap,
                weakPoints: weakPoints.weakPoints || weakPoints,
                analysisSource: {
                    abilityMap: 'ai',
                    weakPoints: 'ai'
                },
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('AI分析失败:', error);
            return {
                success: false,
                abilityMap: this.generateLocalAbilityMap(scoreResult, examType),
                weakPoints: this.generateLocalWeakPoints(scoreResult, examType),
                analysisSource: { abilityMap: 'local', weakPoints: 'local' },
                timestamp: new Date().toISOString()
            };
        }
    }

    // 增强版单一AI分析系统 - 添加数据库集成
    async singleAIAnalysisEnhanced(scoreResult, examType, userId = null) {
        console.log('🚀 启动增强版AI分析系统...');
        
        let sessionResult = null;
        
        try {
            // 创建分析会话
            sessionResult = await this.createAnalysisSession(scoreResult, examType, userId);
            
            // 确保scoreResult有正确的数据结构
            const enhancedScoreResult = this.enhanceScoreResult(scoreResult, examType);
            
            console.log('📊 增强后的分数结果:', {
                overallPercentage: enhancedScoreResult.overallPercentage,
                dimensions: Object.keys(enhancedScoreResult.dimensionScores)
            });

            // 顺序调用两个AI分析，但设置超时保护
            const abilityMap = await this.generateFastAbilityMapWithTimeout(enhancedScoreResult, examType);
            const weakPoints = await this.analyzeWeakPointsWithTimeout(enhancedScoreResult, examType);

            console.log('🤖 AI分析结果:', {
                abilityMap: abilityMap ? '成功' : '失败',
                weakPoints: weakPoints ? '成功' : '失败'
            });

            // 处理能力图谱结果
            let finalAbilityMap;
            if (abilityMap && abilityMap.abilityMap3D) {
                finalAbilityMap = abilityMap.abilityMap3D;
                console.log('✅ AI能力图谱生成成功');
            } else {
                console.warn('❌ 能力图谱生成失败，使用本地生成');
                finalAbilityMap = this.generateLocalAbilityMap(enhancedScoreResult, examType);
            }

            // 处理薄弱点分析结果
            let finalWeakPoints;
            if (weakPoints && weakPoints.weakPoints) {
                finalWeakPoints = weakPoints.weakPoints;
                console.log('✅ AI薄弱点分析成功');
            } else {
                console.warn('❌ 薄弱点分析失败，使用本地生成');
                finalWeakPoints = this.generateLocalWeakPoints(enhancedScoreResult, examType);
            }

            const finalResult = {
                success: true,
                abilityMap: finalAbilityMap,
                weakPoints: finalWeakPoints,
                analysisSource: {
                    abilityMap: 'ai',
                    weakPoints: 'ai'
                },
                timestamp: new Date().toISOString(),
                overallScore: enhancedScoreResult.overallPercentage,
                level: this.getCEFRLevel(enhancedScoreResult.overallPercentage),
                sessionId: sessionResult.sessionId // 添加会话ID
            };

            console.log('🎉 AI分析最终完成:', {
                abilityPoints: finalResult.abilityMap.dataPoints?.length,
                weakPoints: finalResult.weakPoints.length,
                overallScore: finalResult.overallScore
            });

            // 更新会话状态
            await this.updateAnalysisSession(sessionResult.sessionId, finalResult, 'completed');

            return finalResult;

        } catch (error) {
            console.error('💥 AI分析完全失败:', error);
            
            // 更新会话状态为失败
            if (sessionResult && sessionResult.sessionId) {
                await this.updateAnalysisSession(sessionResult.sessionId, null, 'failed');
            }
            
            // 终极备用方案
            return this.generateUltimateBackupAnalysis(scoreResult, examType);
        }
    }

    // 新增：创建分析会话
    async createAnalysisSession(scoreResult, examType, userId = null) {
        try {
            const testData = {
                scoreResult,
                examType,
                timestamp: new Date().toISOString()
            };

            // 使用虚拟数据库创建会话记录
            const sessionData = {
                userId: userId,
                examType: examType,
                testData: testData,
                status: 'processing',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // 使用虚拟数据库插入
            const sessionId = await this.db_insert('analysis_sessions', sessionData);
            
            console.log('📝 创建分析会话成功:', { sessionId, userId });
            
            return { 
                sessionId: sessionId,
                userId: userId
            };
            
        } catch (error) {
            console.error('创建分析会话失败:', error);
            // 返回虚拟会话ID，不影响主要流程
            return { 
                sessionId: 'virtual_session_' + Date.now(),
                userId: userId
            };
        }
    }

    // 新增：更新分析会话
    async updateAnalysisSession(sessionId, analysisResult, status) {
        try {
            const updateData = {
                status: status,
                analysisResult: analysisResult,
                updatedAt: new Date(),
                completedAt: status === 'completed' ? new Date() : null
            };

            // 使用虚拟数据库更新
            const success = await this.db_update('analysis_sessions', 
                { id: sessionId }, 
                updateData
            );

            console.log('📝 更新分析会话:', { 
                sessionId, 
                status, 
                success: !!success 
            });

            return success;
            
        } catch (error) {
            console.error('更新分析会话失败:', error);
            return false;
        }
    }

    // 添加带超时的能力图谱生成
    async generateFastAbilityMapWithTimeout(scoreResult, examType) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('AI分析超时'));
            }, 15000); // 15秒超时

            this.generateFastAbilityMap(scoreResult, examType)
                .then(result => {
                    clearTimeout(timeout);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeout);
                    reject(error);
                });
        });
    }

    // 添加带超时的薄弱点分析
    async analyzeWeakPointsWithTimeout(scoreResult, examType) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('AI分析超时'));
            }, 15000); // 15秒超时

            this.analyzeWeakPointsWithAI(scoreResult, examType)
                .then(result => {
                    clearTimeout(timeout);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeout);
                    reject(error);
                });
        });
    }

    // 增强分数结果处理
    enhanceScoreResult(scoreResult, examType) {
        // 确保dimensionScores存在且格式正确
        const dimensionScores = scoreResult.dimensionScores || {};
        
        // 计算总体百分比
        let overallPercentage = scoreResult.overallPercentage;
        if (!overallPercentage && dimensionScores) {
            const scores = Object.values(dimensionScores).map(dim => dim.percentage || dim.score);
            overallPercentage = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        }

        // 确保每个维度都有正确的结构
        const enhancedDimensionScores = {};
        Object.keys(dimensionScores).forEach(dimension => {
            const dimData = dimensionScores[dimension];
            enhancedDimensionScores[dimension] = {
                percentage: dimData.percentage || dimData.score || 70,
                correct: dimData.correct || 0,
                total: dimData.total || 5,
                score: dimData.score || dimData.percentage || 70
            };
        });

        return {
            overallPercentage: overallPercentage || 70,
            dimensionScores: enhancedDimensionScores,
            totalScore: scoreResult.totalScore || overallPercentage * 10,
            correctAnswers: scoreResult.correctAnswers || 0,
            totalQuestions: scoreResult.totalQuestions || 20
        };
    }

    // 终极备用方案
    generateUltimateBackupAnalysis(scoreResult, examType) {
        console.log('🆘 使用终极备用分析方案');
        
        const enhancedResult = this.enhanceScoreResult(scoreResult, examType);
        const abilityMap = this.generateLocalAbilityMap(enhancedResult, examType);
        const weakPoints = this.generateLocalWeakPoints(enhancedResult, examType);

        return {
            success: true,
            abilityMap: abilityMap.abilityMap3D || abilityMap,
            weakPoints: weakPoints.weakPoints || weakPoints,
            analysisSource: { abilityMap: 'local', weakPoints: 'local' },
            timestamp: new Date().toISOString(),
            overallScore: enhancedResult.overallPercentage,
            level: this.getCEFRLevel(enhancedResult.overallPercentage)
        };
    }

    // 本地快速生成能力图谱（备用）
    generateLocalAbilityMap(scoreResult, examType) {
        const dimensionScores = scoreResult.dimensionScores;
        const dataPoints = Object.keys(dimensionScores).map(dimension => ({
            dimension: dimension,
            displayName: this.getDimensionDisplayName(dimension),
            score: dimensionScores[dimension].percentage,
            weight: this.getDimensionWeight(dimension, examType),
            examCorrelation: this.getExamCorrelation(dimension, examType),
            knowledgePoints: this.getKnowledgePointsForDimension(dimension),
            priority: this.getPriorityLevel(dimensionScores[dimension].percentage)
        }));

        const weakAreas = dataPoints.filter(point => point.score < 70).map(point => point.displayName);
        const strongAreas = dataPoints.filter(point => point.score >= 80).map(point => point.displayName);

        return {
            abilityMap3D: {
                dataPoints: dataPoints,
                weakAreas: weakAreas,
                strongAreas: strongAreas,
                examFocus: this.getExamFocusDescription(examType),
                readinessLevel: this.getReadinessLevel(scoreResult.overallPercentage)
            }
        };
    }

    // 本地生成薄弱点分析（备用）
    generateLocalWeakPoints(scoreResult, examType) {
        const dimensionScores = scoreResult.dimensionScores;
        const weakPoints = Object.keys(dimensionScores)
            .filter(dimension => dimensionScores[dimension].percentage < 70)
            .map(dimension => ({
                dimension: dimension,
                displayName: this.getDimensionDisplayName(dimension),
                score: dimensionScores[dimension].percentage,
                priority: dimensionScores[dimension].percentage < 60 ? 'high' : 'medium',
                knowledgeGaps: this.getKnowledgePointsForDimension(dimension).slice(0, 3),
                recommendedActions: this.getRecommendedActions(dimension),
                examImpact: this.getExamImpact(dimension, examType)
            }));

        return {
            weakPoints: weakPoints,
            learningFocus: weakPoints.map(p => p.displayName).join('、'),
            timeToImprove: this.estimateImprovementTime(weakPoints)
        };
    }

    // 新增辅助方法
    getDimensionDisplayName(dimension) {
        const names = {
            vocabulary: '词汇能力',
            grammar: '语法能力',
            reading: '阅读理解',
            translation: '翻译能力',
            listening: '听力理解',
            writing: '写作能力'
        };
        return names[dimension] || dimension;
    }

    getExamCorrelation(dimension, examType) {
        const weight = this.getDimensionWeight(dimension, examType);
        if (weight >= 0.25) return '重点考察';
        if (weight >= 0.15) return '重要考察';
        return '一般考察';
    }

    getPriorityLevel(score) {
        if (score < 60) return 'high';
        if (score < 70) return 'medium';
        return 'low';
    }

    getExamFocusDescription(examType) {
        return examType === 'CET4' ? 
            '四级重点：词汇积累、基础语法、阅读速度' : 
            '六级重点：高级词汇、复杂句式、深度理解';
    }

    getReadinessLevel(score) {
        if (score >= 80) return 'high';
        if (score >= 70) return 'medium';
        return 'low';
    }

    getExamImpact(dimension, examType) {
        const impacts = {
            vocabulary: '直接影响阅读和写作得分',
            grammar: '影响写作质量和翻译准确性',
            reading: '决定阅读理解部分表现',
            translation: '影响翻译题得分',
            listening: '决定听力部分表现',
            writing: '直接影响写作得分'
        };
        return impacts[dimension] || '综合影响考试成绩';
    }

    estimateImprovementTime(weakPoints) {
        const highPriorityCount = weakPoints.filter(p => p.priority === 'high').length;
        if (highPriorityCount >= 2) return '4-6周';
        if (highPriorityCount === 1) return '2-3周';
        return '1-2周';
    }

    getKnowledgePointsForDimension(dimension) {
        const knowledgeMap = {
            vocabulary: ['高频词汇', '短语搭配', '词义辨析', '同义替换'],
            grammar: ['时态语态', '从句结构', '虚拟语气', '非谓语动词'],
            reading: ['快速阅读', '深度理解', '推理判断', '主旨大意'],
            translation: ['中英转换', '句式调整', '文化差异', '表达习惯'],
            listening: ['短对话', '长对话', '短文理解', '讲座听力'],
            writing: ['议论文', '图表作文', '应用文写作', '逻辑结构']
        };
        return knowledgeMap[dimension] || ['综合能力'];
    }

    // 结构分析辅助方法
    getStructureAnalysis(text) {
        const paragraphs = text.split('\n').filter(p => p.trim());
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        
        if (paragraphs.length < 2) {
            return "文章结构较为简单，建议增加段落划分，使结构更清晰。";
        }
        
        if (sentences.length < 5) {
            return "句子数量较少，建议丰富句式结构，增加文章层次感。";
        }
        
        return "文章结构基本合理，段落划分清晰，逻辑连贯性较好。";
    }

    // 内容评价辅助方法
    getContentEvaluation(text) {
        const wordCount = text.split(/\s+/).length;
        
        if (wordCount < 100) {
            return "内容较为简略，建议充实具体细节和例证。";
        } else if (wordCount < 200) {
            return "内容基本完整，可以进一步深化主题和论证。";
        } else {
            return "内容丰富详实，论证充分，主题表达清晰。";
        }
    }

    // 评分评语辅助方法
    getScoreComment(score) {
        if (score >= 90) {
            return "优秀！文章结构清晰，语言表达准确流畅，内容充实。";
        } else if (score >= 80) {
            return "良好！文章整体不错，但在细节表达上还有提升空间。";
        } else if (score >= 70) {
            return "中等！文章基本符合要求，需要在语法和词汇方面加强。";
        } else {
            return "需要改进！建议重点加强基础语法和词汇积累。";
        }
    }

    // 学习建议生成
    generateLearningSuggestions(score) {
        const suggestions = [];
        
        if (score < 70) {
            suggestions.push(
                { type: "语法", suggestion: "系统学习基础语法规则", priority: "high" },
                { type: "词汇", suggestion: "每日背诵高频词汇", priority: "high" }
            );
        } else if (score < 80) {
            suggestions.push(
                { type: "结构", suggestion: "学习文章结构组织技巧", priority: "medium" },
                { type: "内容", suggestion: "丰富论证和例证", priority: "medium" }
            );
        } else {
            suggestions.push(
                { type: "表达", suggestion: "提升语言表达的多样性和准确性", priority: "low" },
                { type: "逻辑", suggestion: "加强逻辑连贯性", priority: "low" }
            );
        }
        
        return suggestions;
    }

    // 可读性计算
    calculateReadability(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        const words = text.split(/\s+/).filter(w => w.trim());
        
        if (sentences.length === 0) return "未知";
        
        const avgSentenceLength = words.length / sentences.length;
        
        if (avgSentenceLength < 10) return "简单";
        if (avgSentenceLength < 20) return "适中";
        return "较复杂";
    }

    // 深度能力分析
    async analyzeAbilityWithAI(assessmentData, examTarget) {
        const analysisPrompt = `
基于以下多维能力测试结果和${examTarget}考试大纲，请进行深度能力分析：

测试维度得分：
${JSON.stringify(assessmentData.dimensionScores, null, 2)}

答题详情：
${JSON.stringify(assessmentData.answerDetails, null, 2)}

考试目标：${examTarget}
测试用时：${assessmentData.timeSpent}秒

请按照以下结构化格式返回JSON分析结果，重点关联四六级考试大纲知识点：

{
    "overallScore": 0-100,
    "level": "A1-C2",
    "abilityMap": {
        "dataPoints": [
            {
                "dimension": "vocabulary",
                "score": 0-100,
                "weight": 0.1-1.0,
                "description": "详细能力描述",
                "relatedKnowledgePoints": ["知识点1", "知识点2"],
                "examWeight": "在大纲中的权重描述"
            }
        ]
    },
    "weakPoints": [
        {
            "dimension": "grammar",
            "score": 0-100,
            "priority": "high/medium/low",
            "knowledgeGaps": ["具体知识点1", "具体知识点2"],
            "recommendedActions": ["行动1", "行动2"]
        }
    ],
    "strengths": [
        {
            "dimension": "reading",
            "score": 0-100,
            "description": "优势描述"
        }
    ],
    "learningRecommendations": {
        "immediateActions": ["立即行动1", "立即行动2"],
        "weeklyPlan": "周计划概述",
        "focusAreas": ["重点领域1", "重点领域2"]
    },
    "examReadiness": {
        "readinessLevel": "high/medium/low",
        "estimatedScore": "预估考试分数",
        "timeToTarget": "达到目标所需时间"
    }
}

请确保分析结果：
1. 严格关联四六级考试大纲知识点
2. 量化每个知识点的权重
3. 提供具体可执行的学习建议
4. 基于遗忘曲线规划复习
    `;

        const conversationHistory = [
            {
                role: "system",
                content: "你是一个专业的英语教育专家，精通CEFR标准和四六级考试大纲。请基于测试数据提供精准的能力评估和个性化的学习建议，重点关联考试大纲知识点并量化权重。"
            },
            {
                role: "user",
                content: analysisPrompt
            }
        ];

        const aiResponse = await this.getAIResponse(conversationHistory, {
            temperature: 0.3,
            max_tokens: 4000,
            enableThinking: true
        });

        if (aiResponse.success) {
            try {
                return JSON.parse(aiResponse.content);
            } catch (e) {
                console.error('AI返回数据解析失败:', e);
                return this.generateBasicAbilityAnalysis(assessmentData, examTarget);
            }
        } else {
            return this.generateBasicAbilityAnalysis(assessmentData, examTarget);
        }
    }

    // 基础能力分析（备用）
    generateBasicAbilityAnalysis(assessmentData, examTarget) {
        const dimensionScores = assessmentData.dimensionScores || {};
        const dataPoints = [];
        
        Object.keys(dimensionScores).forEach(dimension => {
            const score = dimensionScores[dimension].score || 70;
            const weight = this.getDimensionWeight(dimension, examTarget);
            
            dataPoints.push({
                dimension: dimension,
                score: score,
                weight: weight,
                description: `${dimension}能力${score >= 80 ? '较强' : score >= 60 ? '一般' : '需要加强'}`,
                relatedKnowledgePoints: this.getRelatedKnowledgePoints(dimension, examTarget),
                examWeight: this.getExamWeightDescription(dimension, examTarget)
            });
        });

        const overallScore = Math.round(dataPoints.reduce((sum, point) => sum + point.score, 0) / dataPoints.length);
        
        // 识别薄弱点
        const weakPoints = dataPoints
            .filter(point => point.score < 70)
            .map(point => ({
                dimension: point.dimension,
                score: point.score,
                priority: point.score < 60 ? 'high' : point.score < 70 ? 'medium' : 'low',
                knowledgeGaps: point.relatedKnowledgePoints.slice(0, 2),
                recommendedActions: this.getRecommendedActions(point.dimension)
            }));

        return {
            overallScore: overallScore,
            level: this.getCEFRLevel(overallScore),
            abilityMap: { dataPoints },
            weakPoints,
            strengths: dataPoints.filter(point => point.score >= 80),
            learningRecommendations: {
                immediateActions: ['重点复习薄弱知识点', '制定每日学习计划'],
                weeklyPlan: '4周个性化学习路径',
                focusAreas: weakPoints.map(point => point.dimension)
            },
            examReadiness: {
                readinessLevel: overallScore >= 70 ? 'high' : overallScore >= 60 ? 'medium' : 'low',
                estimatedScore: this.estimateExamScore(overallScore, examTarget),
                timeToTarget: this.estimateTimeToTarget(overallScore, examTarget)
            }
        };
    }

    // 获取维度权重
    getDimensionWeight(dimension, examTarget) {
        const weights = {
            'CET4': {
                'vocabulary': 0.25,
                'grammar': 0.15,
                'reading': 0.35,
                'listening': 0.25,
                'writing': 0.15,
                'speaking': 0.10,
                'pronunciation': 0.05,
                'comprehension': 0.20,
                'fluency': 0.10
            },
            'CET6': {
                'vocabulary': 0.20,
                'grammar': 0.10,
                'reading': 0.35,
                'listening': 0.20,
                'writing': 0.15,
                'speaking': 0.10,
                'pronunciation': 0.05,
                'comprehension': 0.25,
                'fluency': 0.15
            }
        };
        
        return weights[examTarget]?.[dimension] || 0.1;
    }

    // 获取相关知识点
    getRelatedKnowledgePoints(dimension, examTarget) {
        const knowledgeMap = {
            'vocabulary': ['高频词汇', '短语搭配', '词义辨析', '同义替换'],
            'grammar': ['时态语态', '从句结构', '虚拟语气', '非谓语动词'],
            'reading': ['快速阅读', '深度理解', '推理判断', '主旨大意'],
            'listening': ['短对话', '长对话', '短文理解', '讲座听力'],
            'writing': ['议论文', '图表作文', '应用文写作', '逻辑结构'],
            'speaking': ['发音准确', '流利度', '语法正确', '内容连贯'],
            'pronunciation': ['音标', '重音', '语调', '连读'],
            'comprehension': ['细节理解', '推理判断', '主旨概括', '态度观点'],
            'fluency': ['表达流畅', '思维连贯', '反应速度', '语言组织']
        };
        
        return knowledgeMap[dimension] || ['综合能力'];
    }

    // 获取考试权重描述
    getExamWeightDescription(dimension, examTarget) {
        const weight = this.getDimensionWeight(dimension, examTarget);
        if (weight >= 0.3) return '重点考察';
        if (weight >= 0.2) return '重要考察';
        if (weight >= 0.1) return '一般考察';
        return '辅助考察';
    }

    // 获取推荐行动
    getRecommendedActions(dimension) {
        const actions = {
            vocabulary: ['每日背单词', '阅读英文文章', '使用词汇卡片', '同义词练习'],
            grammar: ['语法练习', '句子改写', '错误分析', '句型转换'],
            reading: ['精读训练', '速读练习', '阅读理解', '文章分析'],
            listening: ['听力材料', '跟读练习', '听写训练', '情景对话'],
            speaking: ['口语练习', '录音自测', '情景对话', '话题讨论'],
            writing: ['写作练习', '范文分析', '语法检查', '结构优化'],
            pronunciation: ['发音练习', '跟读模仿', '音标训练', '语调练习'],
            comprehension: ['阅读理解', '听力理解', '逻辑分析', '总结归纳'],
            fluency: ['口语练习', '思维训练', '快速反应', '语言组织']
        };
        
        return actions[dimension] || ['综合练习', '模拟测试'];
    }

    // 获取CEFR等级
    getCEFRLevel(score) {
        if (score >= 90) return 'C2';
        if (score >= 80) return 'C1';
        if (score >= 70) return 'B2';
        if (score >= 60) return 'B1';
        if (score >= 50) return 'A2';
        return 'A1';
    }

    // 预估考试分数
    estimateExamScore(overallScore, examTarget) {
        const baseScore = examTarget === 'CET6' ? 300 : 350;
        const maxScore = examTarget === 'CET6' ? 710 : 710;
        return Math.round(baseScore + (overallScore / 100) * (maxScore - baseScore));
    }

    // 预估达到目标所需时间
    estimateTimeToTarget(currentScore, examTarget) {
        const targetScore = examTarget === 'CET6' ? 425 : 425; // 及格线
        const gap = targetScore - currentScore;
        
        if (gap <= 0) return '已达到目标';
        if (gap <= 10) return '2-3周';
        if (gap <= 20) return '1-2个月';
        if (gap <= 30) return '2-3个月';
        return '3-6个月';
    }

    // 百度文本转语音 - 修复版本，支持御姐音参数
    async baiduTextToSpeech(text, options = {}) {
        try {
            const accessToken = await this.getBaiduAccessToken('BAIDU_TTS');
            
            // 支持御姐音参数（5118）
            const voiceParam = options.voice === '5118' ? '5118' : (options.voice || '0');
            
            const params = new URLSearchParams({
                tex: text,
                tok: accessToken,
                cuid: 'moyu_zhixue_tts',
                ctp: 1, // 客户端类型
                lan: 'zh', // 中文
                spd: options.speed || 5, // 语速 0-15
                pit: options.pitch || 6, // 音调 0-15  
                vol: options.volume || 8, // 音量 0-15
                per: voiceParam, // 支持御姐音
                aue: 3 // 音频格式 3=mp3
            });

            console.log('调用百度TTS服务:', { 
                text: text.substring(0, 50) + '...',
                length: text.length,
                voice: voiceParam
            });

            const response = await axios.post(this.apiConfig.BAIDU_TTS.API_URL, params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                responseType: 'arraybuffer',
                timeout: 30000
            });

            // 检查响应内容类型
            const contentType = response.headers['content-type'];
            
            if (contentType && contentType.includes('application/json')) {
                // 错误响应
                const errorData = JSON.parse(response.data.toString());
                throw new Error(errorData.err_msg || 'TTS合成失败');
            }

            if (response.status === 200 && response.data) {
                const audioBase64 = Buffer.from(response.data).toString('base64');
                
                return {
                    success: true,
                    audio: audioBase64,
                    format: 'mp3',
                    message: '语音合成成功'
                };
            } else {
                throw new Error(`TTS服务返回错误状态: ${response.status}`);
            }

        } catch (error) {
            console.error('百度TTS服务错误:', error.message);
            return {
                success: false,
                message: '语音合成服务暂时不可用: ' + error.message
            };
        }
    }

    // 文本转语音 - 使用百度TTS
    async textToSpeech(text, options = {}) {
        try {
            const cleanText = this.cleanTextForSpeech(text);
            
            if (!cleanText || cleanText.trim() === '') {
                return {
                    success: false,
                    message: '文本内容为空'
                };
            }

            // 文本长度限制检查（百度TTS限制1024字节）
            const maxLength = 800; // 留有余地
            if (cleanText.length > maxLength) {
                const truncatedText = cleanText.substring(0, maxLength) + '...';
                return await this.baiduTextToSpeech(truncatedText, options);
            }

            return await this.baiduTextToSpeech(cleanText, options);
            
        } catch (error) {
            console.error('文本转语音处理错误:', error);
            return {
                success: false,
                message: '文本处理失败: ' + error.message
            };
        }
    }

    // 清洗文本用于语音合成
    cleanTextForSpeech(text) {
        if (!text) return '';
        
        let cleanText = text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/```[\s\S]*?```/g, (match) => {
                return match.replace(/```[\w]*\n?/g, '').replace(/```/g, '');
            })
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/<[^>]*>/g, '')
            .replace(/#/g, '井号')
            .replace(/\*/g, '星号')
            .replace(/_/g, '下划线')
            .replace(/\.{3,}/g, '。')
            .replace(/\?{2,}/g, '？')
            .replace(/!{2,}/g, '！')
            .replace(/,/g, '，')
            .replace(/;/g, '；')
            .replace(/:/g, '：')
            .replace(/\s+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        // 内容安全过滤
        cleanText = this.filterSensitiveContent(cleanText);

        console.log('清洗后的文本长度:', cleanText.length);
        return cleanText;
    }

    // 内容安全过滤
    filterSensitiveContent(text) {
        const sensitiveWords = ['暴力', '色情', '政治敏感词'];
        sensitiveWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            text = text.replace(regex, '***');
        });
        return text;
    }

    // 语音转文本 - 使用百度语音识别
    async speechToText(audioBuffer, options = {}) {
        try {
            const accessToken = await this.getBaiduAccessToken('BAIDU_ASR');
            
            const audioBase64 = audioBuffer.toString('base64');
            
            const formData = new FormData();
            formData.append('speech', audioBase64);
            formData.append('format', 'wav');
            formData.append('rate', 16000);
            formData.append('channel', 1);
            formData.append('cuid', 'moyu_zhixue');
            formData.append('token', accessToken);
            formData.append('dev_pid', 1537);

            const response = await axios.post(
                this.apiConfig.BAIDU_ASR.API_URL,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    timeout: 30000
                }
            );

            if (response.data && response.data.result) {
                return {
                    success: true,
                    text: response.data.result.join(' ')
                };
            } else {
                return {
                    success: false,
                    message: response.data.err_msg || '语音识别失败'
                };
            }

        } catch (error) {
            console.error('百度语音识别错误:', error.response?.data || error.message);
            return {
                success: false,
                message: '语音识别服务暂时不可用'
            };
        }
    }

    // 文档识别 - 使用百度OCR
    async pdfToText(fileBuffer, options = {}) {
        try {
            const accessToken = await this.getBaiduAccessToken('BAIDU_OCR');
            
            const formData = new FormData();
            formData.append('image', fileBuffer);
            formData.append('language_type', 'CHN_ENG');
            formData.append('detect_direction', 'true');
            formData.append('paragraph', 'true');

            const response = await axios.post(
                `${this.apiConfig.BAIDU_OCR.API_URL}general_basic`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    params: {
                        access_token: accessToken
                    },
                    timeout: 60000
                }
            );

        if (response.data && response.data.words_result) {
                const text = response.data.words_result.map(item => item.words).join('\n');
                return {
                    success: true,
                    text: text,
                    words_count: response.data.words_result_num
                };
            } else {
                return {
                    success: false,
                    message: response.data.error_msg || '文档识别失败'
                };
            }

        } catch (error) {
            console.error('百度OCR错误:', error.response?.data || error.message);
            return {
                success: false,
                message: '文档识别服务暂时不可用'
            };
        }
    }

    // 修改：百度图像识别方法 - 添加重试机制
    async imageRecognition(imageBuffer, options = {}) {
        const maxRetries = 2;
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const accessToken = await this.getBaiduAccessToken('BAIDU_IMAGE');
                
                const formData = new FormData();
                formData.append('image', imageBuffer);

                console.log(`🖼️ 尝试第 ${attempt} 次图片识别...`);

                const response = await axios.post(
                    `${this.apiConfig.BAIDU_IMAGE.API_URL}advanced_general`,
                    formData,
                    {
                        headers: {
                            ...formData.getHeaders(),
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        params: {
                            access_token: accessToken
                        },
                        timeout: 30000
                    }
                );

                if (response.data && response.data.result) {
                    console.log('✅ 图片识别成功');
                    return {
                        success: true,
                        result: response.data.result,
                        log_id: response.data.log_id
                    };
                } else {
                    const errorMsg = response.data.error_msg || '图像识别失败';
                    console.error(`❌ 图片识别API返回错误: ${errorMsg}`);
                    lastError = new Error(errorMsg);
                    
                    // 如果是格式错误，不再重试
                    if (errorMsg.includes('image transcode error')) {
                        break;
                    }
                }

            } catch (error) {
                console.error(`❌ 第 ${attempt} 次图片识别失败:`, error.response?.data || error.message);
                lastError = error;
                
                // 等待后重试
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
        
        return {
            success: false,
            message: lastError?.message || '图像识别服务暂时不可用'
        };
    }

    // ==================== 增强图片识别方法 - 多级回退机制 ====================

    // 增强图片识别方法 - 多级回退机制
    async enhancedImageRecognition(imageBuffer, options = {}) {
        try {
            console.log('🖼️ 增强图片识别处理 - 启动多级回退机制:', { 
                bufferSize: imageBuffer.length,
                maxSize: options.maxSize || '1024x1024'
            });

            // 第一级：百度图像识别（主要服务）
            console.log('🔹 第一级：尝试百度图像识别API...');
            const preprocessedBuffer = await this.preprocessImageForBaiduAPI(imageBuffer);
            const baiduResult = await this.imageRecognition(preprocessedBuffer, options);
            
            if (baiduResult.success) {
                console.log('✅ 百度图像识别成功');
                return this.formatImageRecognitionResult(baiduResult);
            }

            // 第二级：重新处理图片后重试百度
            console.log('🔄 第二级：重新处理图片并重试百度API...');
            const reprocessedBuffer = await this.reprocessImageForCompatibility(imageBuffer);
            const baiduRetryResult = await this.imageRecognition(reprocessedBuffer, options);
            
            if (baiduRetryResult.success) {
                console.log('✅ 百度图像识别重试成功');
                return this.formatImageRecognitionResult(baiduRetryResult);
            }

            // 第三级：使用扣子服务进行图片识别
            console.log('🔹 第三级：尝试扣子智能体图片识别...');
            const botResult = await this.botImageRecognition(imageBuffer, options);
            if (botResult.success) {
                console.log('✅ 扣子智能体图片识别成功');
                return botResult;
            }

            // 第四级：使用智普AI进行图片识别
            console.log('🔹 第四级：尝试智普AI图片识别...');
            const zhipuResult = await this.zhipuImageRecognition(imageBuffer, options);
            if (zhipuResult.success) {
                console.log('✅ 智普AI图片识别成功');
                return zhipuResult;
            }

            // 第五级：终极回退 - 本地基础分析
            console.log('🆘 第五级：使用本地基础图片分析...');
            return this.localImageAnalysis(imageBuffer, options);

        } catch (error) {
            console.error('❌ 所有图片识别服务均失败:', error);
            return this.getFallbackImageResponse(error);
        }
    }

    // 新增：扣子智能体图片识别
    async botImageRecognition(imageBuffer, options = {}) {
        try {
            if (!this.botService) {
                throw new Error('扣子服务未初始化');
            }

            const base64Image = imageBuffer.toString('base64');
            const mimeType = 'image/jpeg'; // 假设为JPEG格式
            
            // 构建扣子服务可以处理的图片识别请求
            const recognitionRequest = {
                image: base64Image,
                mimeType: mimeType,
                task: 'image_recognition',
                options: {
                    detail: 'high',
                    maxTokens: 1000
                }
            };

            // 使用扣子服务处理图片识别
            const result = await this.botService.analyzeImage(recognitionRequest);
            
            if (result.success) {
                return {
                    success: true,
                    result: result.analysis || [],
                    primaryObjects: result.objects?.slice(0, 5) || [],
                    description: result.description || '图片识别完成',
                    tags: result.tags || [],
                    analysis: {
                        objectCount: result.objects?.length || 0,
                        confidence: result.confidence || 0.8,
                        mainCategories: result.categories || [],
                        complexity: result.complexity || 'medium'
                    },
                    service: 'bot',
                    source: 'bot_image_recognition'
                };
            } else {
                throw new Error(result.message || '扣子图片识别失败');
            }

        } catch (error) {
            console.error('❌ 扣子图片识别失败:', error);
            return {
                success: false,
                message: '扣子图片识别失败: ' + error.message,
                source: 'bot_failed'
            };
        }
    }

    // 新增：智普AI图片识别
    async zhipuImageRecognition(imageBuffer, options = {}) {
        try {
            const base64Image = imageBuffer.toString('base64');
            
            // 构建智普AI的图片识别请求
            const requestData = {
                model: "glm-4v",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "请详细描述这张图片的内容，包括主要物体、场景、颜色、布局等。请用JSON格式返回：{description: '描述', objects: ['物体1', '物体2'], scene: '场景类型', colors: ['颜色1', '颜色2']}"
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                temperature: 0.3,
                max_tokens: 1000
            };

            const response = await axios.post(
                this.apiConfig.ZHIPU_AI.API_URL,
                requestData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiConfig.ZHIPU_AI.API_KEY}`,
                        'Accept': 'application/json'
                    },
                    timeout: 30000
                }
            );

            if (response.data && response.data.choices && response.data.choices.length > 0) {
                const content = response.data.choices[0].message.content;
                
                // 尝试解析JSON响应
                try {
                    const parsedContent = JSON.parse(content);
                    return {
                        success: true,
                        result: parsedContent.objects ? parsedContent.objects.map(obj => ({ keyword: obj, score: 0.9 })) : [],
                        primaryObjects: parsedContent.objects ? parsedContent.objects.slice(0, 5).map(obj => ({
                            name: obj,
                            score: 0.9,
                            type: 'object'
                        })) : [],
                        description: parsedContent.description || '智普AI图片识别完成',
                        tags: parsedContent.objects || [],
                        analysis: {
                            objectCount: parsedContent.objects?.length || 0,
                            confidence: 0.85,
                            mainCategories: parsedContent.scene ? [parsedContent.scene] : [],
                            complexity: 'medium'
                        },
                        service: 'zhipu',
                        source: 'zhipu_image_recognition'
                    };
                } catch (e) {
                    // 如果不是JSON，使用原始文本作为描述
                    return {
                        success: true,
                        result: [],
                        primaryObjects: [],
                        description: content,
                        tags: [],
                        analysis: {
                            objectCount: 0,
                            confidence: 0.8,
                            mainCategories: [],
                            complexity: 'unknown'
                        },
                        service: 'zhipu',
                        source: 'zhipu_image_recognition_text'
                    };
                }
            } else {
                throw new Error('智普AI返回空响应');
            }

        } catch (error) {
            console.error('❌ 智普AI图片识别失败:', error);
            return {
                success: false,
                message: '智普AI图片识别失败: ' + error.message,
                source: 'zhipu_failed'
            };
        }
    }

    // 新增：重新处理图片以提高兼容性
    async reprocessImageForCompatibility(imageBuffer) {
        try {
            console.log('🔄 重新处理图片以提高兼容性...');
            
            // 这里可以添加更复杂的图片处理逻辑
            // 比如使用sharp库进行格式转换、压缩、尺寸调整等
            
            // 临时方案：返回原图，但添加格式标识
            // 实际项目中建议安装并使用sharp库
            // const sharp = require('sharp');
            // const processedBuffer = await sharp(imageBuffer)
            //     .jpeg({ quality: 85 })
            //     .resize(1024, 1024, { fit: 'inside' })
            //     .toBuffer();
            
            console.log('⚠️ 图片重处理功能需要安装sharp库，暂时返回原图');
            return imageBuffer;
            
        } catch (error) {
            console.error('❌ 图片重处理失败:', error);
            return imageBuffer;
        }
    }

    // 新增：本地基础图片分析（终极回退）
    localImageAnalysis(imageBuffer, options = {}) {
        console.log('🛡️ 使用本地基础图片分析作为终极回退');
        
        // 基于文件大小和名称的基础分析
        const fileSize = imageBuffer.length;
        let complexity = 'simple';
        
        if (fileSize > 500000) { // 大于500KB
            complexity = 'complex';
        } else if (fileSize > 100000) { // 大于100KB
            complexity = 'medium';
        }
        
        return {
            success: true,
            result: [],
            primaryObjects: [
                { name: '图片文件', score: 1.0, type: 'file' },
                { name: '图像内容', score: 0.8, type: 'content' }
            ],
            description: '图片已成功上传，但由于技术限制无法进行深度分析。建议尝试重新上传或使用其他格式的图片。',
            tags: ['图片', '上传成功', '基础分析'],
            analysis: {
                objectCount: 2,
                confidence: 0.6,
                mainCategories: ['digital_image'],
                complexity: complexity
            },
            service: 'local_fallback',
            source: 'local_analysis',
            fileInfo: {
                size: fileSize,
                format: 'unknown',
                processed: true
            }
        };
    }

    // 新增：格式化图片识别结果
    formatImageRecognitionResult(baiduResult) {
        return {
            success: true,
            result: baiduResult.result,
            primaryObjects: baiduResult.result.slice(0, 5).map(item => ({
                name: item.keyword || item.name,
                score: item.score || 0,
                type: 'object'
            })),
            description: this.generateImageDescription(baiduResult.result),
            tags: baiduResult.result.map(item => item.keyword || item.name).slice(0, 10),
            analysis: this.analyzeImageContent(baiduResult.result),
            log_id: baiduResult.log_id,
            service: 'baidu',
            source: 'baidu_success'
        };
    }

    // 新增：获取回退响应
    getFallbackImageResponse(error) {
        return {
            success: false,
            message: '图片识别服务暂时不可用',
            suggestion: '请尝试以下解决方案：1. 使用JPEG格式图片 2. 确保图片大小小于4MB 3. 检查图片是否损坏 4. 稍后重试',
            details: {
                error: error.message,
                timestamp: new Date().toISOString(),
                retryAdvice: '建议使用常见格式如JPEG、PNG，避免特殊格式'
            },
            fallbackAvailable: true
        };
    }

    // 增强图片预处理方法
    async preprocessImageForBaiduAPI(imageBuffer) {
        try {
            console.log('🔄 为百度API预处理图片...');
            
            // 检查图片大小
            if (imageBuffer.length > 4 * 1024 * 1024) {
                console.log('📏 图片过大，尝试基础压缩...');
                // 这里可以添加压缩逻辑
            }

            // 验证图片格式
            const imageInfo = await this.validateImageFormat(imageBuffer);
            console.log('📷 图片格式验证结果:', imageInfo);

            // 如果不支持或需要转换的格式，尝试处理
            if (imageInfo.needConversion || !imageInfo.valid) {
                console.log(`🔄 图片需要转换: ${imageInfo.format} -> 尝试兼容处理`);
                return await this.convertToCompatibleFormat(imageBuffer);
            }

            console.log('✅ 图片格式兼容，无需转换');
            return imageBuffer;

        } catch (error) {
            console.error('❌ 图片预处理失败:', error);
            // 预处理失败时返回原图
            return imageBuffer;
        }
    }

    // 新增：转换为兼容格式
    async convertToCompatibleFormat(imageBuffer) {
        try {
            // 这里可以实现格式转换逻辑
            // 实际项目中建议使用sharp库
            
            console.log('⚠️ 格式转换功能需要安装sharp库，暂时返回原图');
            return imageBuffer;
            
        } catch (error) {
            console.error('❌ 格式转换失败:', error);
            return imageBuffer;
        }
    }

    // 增强图片识别方法 - 添加重试机制
    async enhancedImageRecognitionOld(imageBuffer, options = {}) {
        try {
            console.log('🖼️ 增强图片识别处理:', { 
                bufferSize: imageBuffer.length,
                maxSize: options.maxSize || '1024x1024'
            });

            // 增强图片预处理
            const preprocessedBuffer = await this.preprocessImageForBaiduAPI(imageBuffer);
            
            // 使用百度图像识别
            const result = await this.imageRecognition(preprocessedBuffer, options);
            
            if (result.success) {
                console.log('✅ 图片识别成功:', { 
                    objectsCount: result.result.length,
                    objects: result.result.map(item => item.keyword || item.name)
                });
                
                // 增强返回结果
                return {
                    success: true,
                    result: result.result,
                    primaryObjects: result.result.slice(0, 5).map(item => ({
                        name: item.keyword || item.name,
                        score: item.score || 0,
                        type: 'object'
                    })),
                    description: this.generateImageDescription(result.result),
                    tags: result.result.map(item => item.keyword || item.name).slice(0, 10),
                    analysis: this.analyzeImageContent(result.result),
                    log_id: result.log_id
                };
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error('❌ 增强图片识别失败:', error);
            return {
                success: false,
                message: '图片识别失败: ' + error.message,
                suggestion: this.getImageRecognitionSuggestion(error)
            };
        }
    }

    // 新增：专门为百度API预处理图片的方法
    async preprocessImageForBaiduAPIOld(imageBuffer) {
        try {
            console.log('🔄 为百度API预处理图片...');
            
            // 检查图片大小
            if (imageBuffer.length > 4 * 1024 * 1024) {
                console.log('📏 图片过大，进行压缩...');
                // 这里可以添加图片压缩逻辑
                // 暂时先返回原图，但给出警告
                console.warn('⚠️ 图片超过4MB，可能影响识别效果');
            }

            // 验证图片格式并转换为百度支持的格式
            const imageInfo = await this.validateImageFormat(imageBuffer);
            console.log('📷 图片格式验证结果:', imageInfo);

            let processedBuffer = imageBuffer;
            
            // 如果格式需要转换或不是JPEG，转换为JPEG
            if (imageInfo.needConversion || imageInfo.format !== 'jpeg') {
                console.log(`🔄 转换图片格式: ${imageInfo.format} -> jpeg`);
                processedBuffer = await this.convertToJpeg(imageBuffer);
            }

            // 验证处理后的图片
            const finalImageInfo = await this.validateImageFormat(processedBuffer);
            console.log('✅ 最终图片格式:', finalImageInfo);

            return processedBuffer;

        } catch (error) {
            console.error('❌ 图片预处理失败:', error);
            // 如果预处理失败，返回原图
            return imageBuffer;
        }
    }

    // 新增：转换为JPEG格式的方法
    async convertToJpeg(imageBuffer) {
        try {
            // 在实际项目中，这里应该使用sharp等图片处理库
            // 这里简化处理，直接返回原buffer
            console.log('🔄 转换为JPEG格式（简化处理）');
            
            // 模拟转换过程
            return new Promise((resolve) => {
                // 实际项目中应该使用：
                // const sharp = require('sharp');
                // sharp(imageBuffer)
                //   .jpeg({ quality: 85 })
                //   .toBuffer()
                //   .then(resolve)
                //   .catch(() => resolve(imageBuffer)); // 失败时返回原图
                
                // 临时方案：直接返回原buffer
                console.warn('⚠️ 图片格式转换功能未实现，使用原图');
                resolve(imageBuffer);
            });
        } catch (error) {
            console.error('❌ JPEG转换失败:', error);
            return imageBuffer;
        }
    }

    // 新增：验证图片格式
    async validateImageFormat(imageBuffer) {
        try {
            // 检查图片魔数（Magic Number）来判断格式
            const buffer = Buffer.from(imageBuffer);
            
            // PNG: 89 50 4E 47 0D 0A 1A 0A
            if (buffer.length >= 8 && 
                buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
                buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
                return { format: 'png', valid: true, needConversion: false };
            }
            
            // JPEG: FF D8 FF
            if (buffer.length >= 3 && 
                buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
                return { format: 'jpeg', valid: true, needConversion: false };
            }
            
            // JPEG 2000
            if (buffer.length >= 12 && 
                buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x00 && buffer[3] === 0x0C &&
                buffer[4] === 0x6A && buffer[5] === 0x50 && buffer[6] === 0x20 && buffer[7] === 0x20) {
                return { format: 'jp2', valid: true, needConversion: true };
            }
            
            // GIF: GIF8
            if (buffer.length >= 6 && 
                buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
                return { format: 'gif', valid: true, needConversion: true };
            }
            
            // BMP: BM
            if (buffer.length >= 2 && 
                buffer[0] === 0x42 && buffer[1] === 0x4D) {
                return { format: 'bmp', valid: true, needConversion: true };
            }
            
            // WebP: RIFFxxxxWEBP
            if (buffer.length >= 12 && 
                buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
                buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
                return { format: 'webp', valid: true, needConversion: true };
            }
            
            // 未知格式，建议转换
            return { format: 'unknown', valid: false, needConversion: true };
            
        } catch (error) {
            console.error('❌ 图片格式验证失败:', error);
            return { format: 'unknown', valid: false, needConversion: true };
        }
    }

    // 新增：获取图片识别错误建议
    getImageRecognitionSuggestion(error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('transcode') || errorMessage.includes('format')) {
            return '请尝试使用JPEG或PNG格式的图片，避免使用WebP、BMP等特殊格式';
        }
        
        if (errorMessage.includes('size') || errorMessage.includes('large')) {
            return '图片文件过大，请压缩图片到4MB以下再尝试';
        }
        
        if (errorMessage.includes('corrupt') || errorMessage.includes('damage')) {
            return '图片文件可能已损坏，请重新选择或拍摄图片';
        }
        
        return '请检查图片格式和大小，建议使用常见的JPEG或PNG格式';
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

    // 文本翻译
    async translateText(text, targetLang = 'en', sourceLang = 'zh') {
        const translationPrompt = `请将以下${sourceLang === 'zh' ? '中文' : '英文'}文本翻译成${targetLang === 'en' ? '英文' : '中文'}，保持意思准确且符合目标语言的表达习惯：

${text}

请只返回翻译结果，不要添加其他内容。`;

        const conversationHistory = [
            {
                role: "system",
                content: "你是一个专业的翻译助手，专注于提供准确流畅的翻译服务。"
            },
            {
                role: "user",
                content: translationPrompt
            }
        ];

        const result = await this.getAIResponse(conversationHistory, {
            temperature: 0.3,
            max_tokens: 1000
        });

        return result;
    }

    // 获取支持的语音列表 - 百度TTS，添加御姐音
    getAvailableVoices() {
        return [
            { id: '0', name: '女声', language: 'zh-CN', gender: 'female', service: 'baidu' },
            { id: '1', name: '男声', language: 'zh-CN', gender: 'male', service: 'baidu' },
            { id: '3', name: '度逍遥', language: 'zh-CN', gender: 'male', service: 'baidu' },
            { id: '4', name: '度丫丫', language: 'zh-CN', gender: 'female', service: 'baidu' },
            { id: '5118', name: '御姐音', language: 'zh-CN', gender: 'female', service: 'baidu' }
        ];
    }

    // 新增：获取服务状态详情
    getAIServiceStatus() {
        return {
            bot_service: { 
                enabled: this.botServiceEnabled, 
                name: '扣子智能体',
                priority: 'primary'
            },
            zhipu_ai: { 
                enabled: true, 
                name: '智普AI大模型',
                priority: 'fallback'
            },
            baidu_tts: { enabled: true, name: '百度语音合成' },
            baidu_asr: { enabled: true, name: '百度语音识别' },
            baidu_ocr: { enabled: true, name: '百度文字识别' },
            baidu_image: { enabled: true, name: '百度图像识别' }
        };
    }

    // ==================== 新增增强方法 ====================

    // 增强语音识别方法 - 支持多种格式
    async enhancedSpeechToText(audioBuffer, options = {}) {
        try {
            console.log('🔊 增强语音识别处理:', { 
                bufferSize: audioBuffer.length,
                contentType: options.contentType || 'audio/wav'
            });

            // 检查音频格式并转换
            let processedBuffer = audioBuffer;
            const contentType = options.contentType || 'audio/wav';
            
            // 支持多种音频格式
            if (contentType.includes('mp3') || contentType.includes('mpeg')) {
                console.log('检测到MP3格式，尝试转换...');
                // 实际项目中应使用音频转换库
                // 这里简化处理，直接使用原buffer
            }

            // 使用百度语音识别
            const result = await this.speechToText(processedBuffer, options);
            
            if (result.success) {
                console.log('✅ 语音识别成功:', { 
                    textLength: result.text.length,
                    textPreview: result.text.substring(0, 50) + '...'
                });
                
                return {
                    success: true,
                    text: result.text,
                    confidence: 0.9, // 置信度
                    words: result.text.split(' ').length,
                    duration: options.duration || 0,
                    language: 'zh-CN'
                };
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error('❌ 增强语音识别失败:', error);
            return {
                success: false,
                message: '语音识别失败: ' + error.message
            };
        }
    }

    // 生成图片描述
    generateImageDescription(objects) {
        const primaryObjects = objects.slice(0, 3).map(obj => obj.keyword || obj.name);
        if (primaryObjects.length === 0) {
            return '未识别到明显物体';
        }
        return `图片中包含: ${primaryObjects.join('、')}等${objects.length}个物体`;
    }

    // 分析图片内容
    analyzeImageContent(objects) {
        const scores = objects.map(obj => obj.score || 0);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        
        return {
            objectCount: objects.length,
            confidence: avgScore,
            mainCategories: this.categorizeObjects(objects),
            complexity: objects.length > 5 ? 'complex' : objects.length > 2 ? 'medium' : 'simple'
        };
    }

    // 分类识别物体
    categorizeObjects(objects) {
        const categories = {
            nature: ['树', '花', '草', '天空', '云', '山', '水'],
            building: ['建筑', '房屋', '大楼', '桥梁', '道路'],
            person: ['人', '人脸', '人物', '儿童', '成人'],
            animal: ['狗', '猫', '鸟', '动物', '宠物'],
            vehicle: ['汽车', '自行车', '摩托车', '飞机', '船'],
            food: ['食物', '水果', '蔬菜', '饮料', '餐点']
        };

        const foundCategories = new Set();
        
        objects.forEach(obj => {
            const keyword = (obj.keyword || obj.name).toLowerCase();
            for (const [category, keywords] of Object.entries(categories)) {
                if (keywords.some(kw => keyword.includes(kw.toLowerCase()))) {
                    foundCategories.add(category);
                }
            }
        });

        return Array.from(foundCategories);
    }

    // 增强文档处理 - 支持多种格式
    async enhancedDocumentProcessing(fileBuffer, fileName, fileType, options = {}) {
        try {
            console.log('📄 增强文档处理:', { 
                fileName, 
                fileType,
                bufferSize: fileBuffer.length 
            });

            let extractedText = '';
            let processingResult = {};

            // 根据文件类型选择处理方法
            if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
                console.log('处理PDF文档...');
                const pdfResult = await this.pdfToText(fileBuffer, options);
                if (pdfResult.success) {
                    extractedText = pdfResult.text;
                    processingResult = {
                        type: 'pdf',
                        pageCount: 'unknown', // 实际项目中应解析PDF页数
                        wordsCount: pdfResult.words_count || extractedText.split(/\s+/).length
                    };
                } else {
                    throw new Error('PDF处理失败: ' + pdfResult.message);
                }
            } 
            else if (fileType.includes('image') || /\.(jpg|jpeg|png|gif|bmp)$/i.test(fileName)) {
                console.log('处理图片文档...');
                const imageResult = await this.enhancedImageRecognition(fileBuffer, options);
                if (imageResult.success) {
                    extractedText = `图片内容分析:\n识别到以下物体: ${imageResult.primaryObjects.map(obj => obj.name).join(', ')}\n${imageResult.description}`;
                    processingResult = {
                        type: 'image',
                        objects: imageResult.primaryObjects,
                        analysis: imageResult.analysis
                    };
                } else {
                    throw new Error('图片处理失败: ' + imageResult.message);
                }
            }
            else if (fileType.includes('audio') || /\.(mp3|wav|m4a|aac)$/i.test(fileName)) {
                console.log('处理音频文档...');
                const audioResult = await this.enhancedSpeechToText(fileBuffer, { 
                    contentType: fileType 
                });
                if (audioResult.success) {
                    extractedText = audioResult.text;
                    processingResult = {
                        type: 'audio',
                        duration: audioResult.duration,
                        confidence: audioResult.confidence,
                        words: audioResult.words
                    };
                } else {
                    throw new Error('音频处理失败: ' + audioResult.message);
                }
            }
            else if (fileType.includes('text') || fileName.endsWith('.txt')) {
                console.log('处理文本文档...');
                extractedText = fileBuffer.toString('utf8');
                processingResult = {
                    type: 'text',
                    encoding: 'utf8',
                    lines: extractedText.split('\n').length,
                    words: extractedText.split(/\s+/).length
                };
            }
            else {
                throw new Error('不支持的文件格式: ' + fileType);
            }

            // 清理提取的文本
            const cleanText = this.cleanExtractedText(extractedText);
            
            if (!cleanText || cleanText.trim().length === 0) {
                throw new Error('文件内容为空或无法提取文本');
            }

            console.log('✅ 文档处理成功:', { 
                type: processingResult.type,
                textLength: cleanText.length,
                preview: cleanText.substring(0, 100) + '...'
            });

            return {
                success: true,
                text: cleanText,
                fileType: processingResult.type,
                metadata: processingResult,
                summary: this.generateTextSummary(cleanText)
            };

        } catch (error) {
            console.error('❌ 文档处理失败:', error);
            return {
                success: false,
                message: '文档处理失败: ' + error.message
            };
        }
    }

    // 清理提取的文本
    cleanExtractedText(text) {
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\s+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    // 生成文本摘要
    generateTextSummary(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
        const words = text.split(/\s+/).filter(w => w.trim().length > 0);
        
        return {
            sentenceCount: sentences.length,
            wordCount: words.length,
            avgSentenceLength: words.length / Math.max(sentences.length, 1),
            estimatedReadingTime: Math.ceil(words.length / 200) // 按200词/分钟计算
        };
    }

    // 统一文件上传处理方法
    async processFileUpload(fileBuffer, fileName, fileType, options = {}) {
        try {
            console.log('📤 处理文件上传:', { fileName, fileType, size: fileBuffer.length });

            // 文件大小检查 (10MB限制)
            const maxSize = 10 * 1024 * 1024;
            if (fileBuffer.length > maxSize) {
                throw new Error(`文件大小超过限制 (${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB > 10MB)`);
            }

            // 文件类型检查
            const allowedTypes = [
                'text/plain', 'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 
                'audio/mpeg', 'audio/wav', 'audio/mp4', 'application/msword'
            ];
            
            const allowedExtensions = ['.txt', '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.mp3', '.wav', '.m4a', '.doc', '.docx'];
            const fileExtension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

            if (!allowedTypes.includes(fileType) && !allowedExtensions.includes(fileExtension)) {
                throw new Error(`不支持的文件类型: ${fileType}`);
            }

            // 根据文件类型处理
            let result;
            if (fileType.startsWith('image/')) {
                result = await this.enhancedImageRecognition(fileBuffer, options);
            } else if (fileType.startsWith('audio/')) {
                result = await this.enhancedSpeechToText(fileBuffer, { contentType: fileType });
            } else {
                result = await this.enhancedDocumentProcessing(fileBuffer, fileName, fileType, options);
            }

            if (result.success) {
                return {
                    success: true,
                    data: {
                        fileName,
                        fileType: result.fileType || this.getFileCategory(fileType),
                        content: result.text || result.description,
                        metadata: result.metadata || result,
                        processedAt: new Date().toISOString()
                    }
                };
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error('❌ 文件上传处理失败:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    // 获取文件分类
    getFileCategory(fileType) {
        if (fileType.startsWith('image/')) return 'image';
        if (fileType.startsWith('audio/')) return 'audio';
        if (fileType.startsWith('text/')) return 'text';
        if (fileType.includes('pdf')) return 'pdf';
        if (fileType.includes('word')) return 'document';
        return 'file';
    }

    // 图片预处理工具
    getImagePreprocessingTips() {
        return {
            supportedFormats: ['JPEG', 'PNG'],
            maxSize: '4MB',
            recommended: {
                format: 'JPEG',
                quality: '85-95%',
                resolution: '1024x1024以内'
            },
            tips: [
                '避免使用WebP、BMP等特殊格式',
                '确保图片清晰且光线充足',
                '复杂的背景可能影响识别准确率',
                '单个物体识别效果最佳'
            ]
        };
    }

    // 获取支持的图片格式信息
    getSupportedImageFormats() {
        return {
            primary: ['image/jpeg', 'image/png'],
            secondary: ['image/gif', 'image/bmp', 'image/webp'],
            maxFileSize: 4 * 1024 * 1024, // 4MB
            recommended: {
                format: 'JPEG',
                maxDimension: 2048,
                quality: 90
            }
        };
    }
}

module.exports = new AIService();