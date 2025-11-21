const express = require('express');
const router = express.Router();
const db = require('../database').db;
const aiService = require('../services/ai-service');

// 获取写作题目列表
router.get('/questions', async (req, res) => {
    try {
        const { exam_type, question_type, difficulty, user_id } = req.query;
        
        let query = `SELECT * FROM writing_questions WHERE is_active = 1`;
        const params = [];
        
        if (exam_type) {
            query += ' AND exam_type = ?';
            params.push(exam_type);
        }
        
        if (question_type) {
            query += ' AND question_type = ?';
            params.push(question_type);
        }
        
        if (difficulty) {
            query += ' AND difficulty = ?';
            params.push(difficulty);
        }
        
        // 如果是登录用户，排除最近做过的题目
        if (user_id) {
            query += ` AND id NOT IN (
                SELECT DISTINCT question_id FROM writing_sessions 
                WHERE user_id = ? AND submitted_at > datetime('now', '-7 days')
            )`;
            params.push(user_id);
        }
        
        query += ' ORDER BY RANDOM() LIMIT 10';
        
        db.all(query, params, (err, questions) => {
            if (err) {
                console.error('获取写作题目失败:', err);
                return res.json({ success: false, message: '获取题目失败' });
            }
            
            // 如果没有找到题目，使用AI生成
            if (questions.length === 0) {
                generateAIQuestion(exam_type, question_type, difficulty)
                    .then(newQuestion => {
                        res.json({ success: true, data: [newQuestion] });
                    })
                    .catch(error => {
                        console.error('AI生成题目失败:', error);
                        // 返回基础题目作为后备
                        getFallbackQuestions(exam_type, question_type, difficulty, res);
                    });
            } else {
                res.json({ success: true, data: questions });
            }
        });
    } catch (error) {
        console.error('获取写作题目错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 获取后备题目
function getFallbackQuestions(exam_type, question_type, difficulty, res) {
    const fallbackQuery = `SELECT * FROM writing_questions WHERE is_active = 1 ORDER BY RANDOM() LIMIT 5`;
    
    db.all(fallbackQuery, [], (err, questions) => {
        if (err || questions.length === 0) {
            return res.json({ 
                success: false, 
                message: '暂时没有可用的题目，请稍后再试' 
            });
        }
        
        res.json({ success: true, data: questions });
    });
}

// AI生成写作题目
async function generateAIQuestion(exam_type, question_type, difficulty) {
    const prompt = `
请生成一个${exam_type} ${question_type}写作题目，难度级别：${difficulty}。

要求：
1. 题目要符合${exam_type}考试大纲要求
2. 难度级别：${difficulty}
3. 字数要求：150-200字
4. 时间限制：30分钟
5. 包含明确的写作要求
6. 题目要有现实意义和教育价值

请按照以下JSON格式返回：
{
    "title": "题目标题",
    "content": "题目背景和内容",
    "requirements": "具体的写作要求，分点列出",
    "word_limit": 150,
    "time_limit": 30,
    "difficulty": "${difficulty}",
    "tags": ["相关标签1", "相关标签2"],
    "exam_type": "${exam_type}",
    "question_type": "${question_type}"
}
    `;

    const conversationHistory = [
        {
            role: "system",
            content: "你是一个专业的英语考试出题专家，擅长生成符合考试大纲的写作题目。题目要有教育意义和实用性。"
        },
        {
            role: "user",
            content: prompt
        }
    ];

    try {
        const aiResponse = await aiService.getAIResponse(conversationHistory, {
            temperature: 0.7,
            max_tokens: 1000
        });

        if (aiResponse.success) {
            const questionData = JSON.parse(aiResponse.content);
            
            // 保存到数据库
            const insertQuery = `
                INSERT INTO writing_questions 
                (exam_type, question_type, title, content, requirements, word_limit, time_limit, difficulty, tags, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
            `;
            
            return new Promise((resolve, reject) => {
                db.run(insertQuery, [
                    questionData.exam_type || exam_type,
                    questionData.question_type || question_type,
                    questionData.title,
                    questionData.content,
                    questionData.requirements,
                    questionData.word_limit || 150,
                    questionData.time_limit || 30,
                    questionData.difficulty || difficulty,
                    JSON.stringify(questionData.tags || [])
                ], function(err) {
                    if (err) {
                        console.error('保存AI生成题目失败:', err);
                        reject(err);
                    } else {
                        questionData.id = this.lastID;
                        resolve(questionData);
                    }
                });
            });
        } else {
            throw new Error('AI服务暂时不可用');
        }
    } catch (error) {
        console.error('AI题目生成错误:', error);
        throw error;
    }
}

// 开始新的写作练习
router.post('/start-practice', async (req, res) => {
    try {
        const { user_id, exam_type, question_type, difficulty } = req.body;
        
        if (!user_id || !exam_type) {
            return res.json({ success: false, message: '用户ID和考试类型不能为空' });
        }
        
        // 为用户生成或获取题目
        const question = await getOrGenerateQuestion(user_id, exam_type, question_type, difficulty);
        
        res.json({
            success: true,
            data: {
                question: question,
                session_data: {
                    start_time: new Date().toISOString(),
                    question_id: question.id
                }
            }
        });
        
    } catch (error) {
        console.error('开始练习错误:', error);
        res.json({ success: false, message: '开始练习失败' });
    }
});

async function getOrGenerateQuestion(user_id, exam_type, question_type, difficulty) {
    return new Promise((resolve, reject) => {
        // 先尝试从数据库获取合适的题目
        let query = `
            SELECT * FROM writing_questions 
            WHERE exam_type = ? AND is_active = 1
        `;
        const params = [exam_type];
        
        if (question_type) {
            query += ' AND question_type = ?';
            params.push(question_type);
        }
        
        if (difficulty) {
            query += ' AND difficulty = ?';
            params.push(difficulty);
        }
        
        query += ` AND id NOT IN (
            SELECT question_id FROM writing_sessions 
            WHERE user_id = ? AND submitted_at > datetime('now', '-30 days')
        ) ORDER BY RANDOM() LIMIT 1`;
        
        params.push(user_id);
        
        db.get(query, params, async (err, question) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (question) {
                resolve(question);
            } else {
                // 如果没有找到合适的题目，使用AI生成
                try {
                    const newQuestion = await generateAIQuestion(
                        exam_type, 
                        question_type || 'essay', 
                        difficulty || 'medium'
                    );
                    resolve(newQuestion);
                } catch (error) {
                    // AI生成失败，返回随机题目
                    const fallbackQuery = `
                        SELECT * FROM writing_questions 
                        WHERE exam_type = ? AND is_active = 1 
                        ORDER BY RANDOM() LIMIT 1
                    `;
                    
                    db.get(fallbackQuery, [exam_type], (err, fallbackQuestion) => {
                        if (err || !fallbackQuestion) {
                            reject(new Error('没有可用的题目'));
                        } else {
                            resolve(fallbackQuestion);
                        }
                    });
                }
            }
        });
    });
}

// 提交写作内容并进行AI评分
router.post('/submit', async (req, res) => {
    try {
        const { user_id, question_id, content, time_spent } = req.body;
        
        if (!user_id || !question_id || !content) {
            return res.json({ success: false, message: '参数不完整' });
        }
        
        // 验证内容长度
        if (content.trim().length < 50) {
            return res.json({ success: false, message: '写作内容过短，请至少写50个字符' });
        }
        
        const word_count = content.trim().split(/\s+/).length;
        
        // 获取题目信息
        db.get('SELECT * FROM writing_questions WHERE id = ?', [question_id], async (err, question) => {
            if (err || !question) {
                return res.json({ success: false, message: '题目不存在' });
            }
            
            try {
                // 使用AI进行深度评分分析
                const analysisResult = await analyzeWritingWithAI(question, content, word_count);
                
                // 保存写作记录
                const insertQuery = `
                    INSERT INTO writing_sessions 
                    (user_id, question_id, user_content, word_count, time_spent, 
                     score_overall, score_content, score_structure, score_language,
                     ai_feedback, common_errors, suggestions, detailed_analysis, submitted_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `;
                
                db.run(insertQuery, [
                    user_id,
                    question_id,
                    content,
                    word_count,
                    time_spent,
                    analysisResult.overallScore,
                    analysisResult.dimensionScores.content,
                    analysisResult.dimensionScores.structure,
                    analysisResult.dimensionScores.language,
                    analysisResult.feedback,
                    JSON.stringify(analysisResult.commonErrors || []),
                    JSON.stringify(analysisResult.suggestions || []),
                    JSON.stringify(analysisResult.detailedAnalysis || {})
                ], function(err) {
                    if (err) {
                        console.error('保存写作记录失败:', err);
                        return res.json({ success: false, message: '保存失败' });
                    }
                    
                    const recordId = this.lastID;
                    
                    // 更新写作统计
                    updateWritingStatistics(user_id, question.exam_type, analysisResult.overallScore, word_count);
                    
                    res.json({
                        success: true,
                        data: {
                            record_id: recordId,
                            scores: {
                                overall: analysisResult.overallScore,
                                content: analysisResult.dimensionScores.content,
                                structure: analysisResult.dimensionScores.structure,
                                language: analysisResult.dimensionScores.language
                            },
                            feedback: analysisResult.feedback,
                            common_errors: analysisResult.commonErrors,
                            suggestions: analysisResult.suggestions,
                            detailed_analysis: analysisResult.detailedAnalysis,
                            word_count: word_count,
                            time_spent: time_spent,
                            improvement_suggestions: analysisResult.improvementSuggestions
                        }
                    });
                });
            } catch (analysisError) {
                console.error('AI分析失败:', analysisError);
                // 使用基础分析作为后备
                const basicAnalysis = getEnhancedWritingAnalysis(content, word_count, question.word_limit);
                
                const insertQuery = `
                    INSERT INTO writing_sessions 
                    (user_id, question_id, user_content, word_count, time_spent, 
                     score_overall, score_content, score_structure, score_language,
                     ai_feedback, common_errors, suggestions, detailed_analysis, submitted_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `;
                
                db.run(insertQuery, [
                    user_id,
                    question_id,
                    content,
                    word_count,
                    time_spent,
                    basicAnalysis.overallScore,
                    basicAnalysis.dimensionScores.content,
                    basicAnalysis.dimensionScores.structure,
                    basicAnalysis.dimensionScores.language,
                    basicAnalysis.feedback,
                    JSON.stringify(basicAnalysis.commonErrors),
                    JSON.stringify(basicAnalysis.suggestions),
                    JSON.stringify(basicAnalysis.detailedAnalysis)
                ], function(err) {
                    if (err) {
                        return res.json({ success: false, message: '保存失败' });
                    }
                    
                    res.json({
                        success: true,
                        data: {
                            record_id: this.lastID,
                            scores: {
                                overall: basicAnalysis.overallScore,
                                content: basicAnalysis.dimensionScores.content,
                                structure: basicAnalysis.dimensionScores.structure,
                                language: basicAnalysis.dimensionScores.language
                            },
                            feedback: basicAnalysis.feedback + " (基础分析模式)",
                            common_errors: basicAnalysis.commonErrors,
                            suggestions: basicAnalysis.suggestions,
                            word_count: word_count,
                            time_spent: time_spent
                        }
                    });
                });
            }
        });
    } catch (error) {
        console.error('提交写作错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 深度AI写作分析函数 - 添加超时和重试机制
async function analyzeWritingWithAI(question, content, word_count) {
    const prompt = `
请对以下英语作文进行专业、详细的评分和分析：

作文题目：${question.title}
写作要求：${question.requirements}
字数要求：${question.word_limit}字
实际字数：${word_count}字
考试类型：${question.exam_type}

学生作文：
${content}

请从以下维度进行深度分析和评分（每项满分100分）：

1. 内容切题性 (Content Relevance)：
   - 内容是否完全切题
   - 观点是否明确、有深度
   - 论据是否充分、有力
   - 是否完成所有写作要求

2. 结构组织 (Structure and Organization)：
   - 文章结构是否清晰（引言-主体-结论）
   - 段落衔接是否自然流畅
   - 逻辑是否严密
   - 过渡词使用是否恰当

3. 语言表达 (Language Use)：
   - 语法准确性
   - 词汇丰富度和准确性
   - 句式多样性
   - 语言地道性

请按照以下JSON格式返回详细分析结果：

{
    "overallScore": 总体分数,
    "dimensionScores": {
        "content": 内容分数,
        "structure": 结构分数,
        "language": 语言分数
    },
    "feedback": "总体评语，包含优点和需要改进的地方",
    "commonErrors": ["具体错误1", "具体错误2", "具体错误3"],
    "suggestions": ["具体改进建议1", "具体改进建议2", "具体改进建议3"],
    "detailedAnalysis": {
        "contentAnalysis": "内容方面的详细分析",
        "structureAnalysis": "结构方面的详细分析", 
        "languageAnalysis": "语言方面的详细分析",
        "vocabularySuggestions": ["可替换的高级词汇1", "可替换的高级词汇2"],
        "sentenceImprovements": ["可优化的句子1", "可优化的句子2"]
    },
    "improvementSuggestions": {
        "immediate": ["立即可以改进的方面1", "立即可以改进的方面2"],
        "longTerm": ["长期需要提升的能力1", "长期需要提升的能力2"]
    }
}

要求：
1. 评分要严格公正，符合${question.exam_type}评分标准
2. 指出具体错误，不要泛泛而谈
3. 提供具体可执行的改进建议
4. 分析要有深度，不能只给分数
    `;

    const conversationHistory = [
        {
            role: "system",
            content: `你是一个专业的英语写作评分专家，精通${question.exam_type}写作评分标准。请提供准确、详细、可操作的评分和分析，帮助学生真正提高写作水平。`
        },
        {
            role: "user",
            content: prompt
        }
    ];

    try {
        // 添加超时机制
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('AI分析超时')), 30000);
        });

        const aiResponsePromise = aiService.getAIResponse(conversationHistory, {
            temperature: 0.3,
            max_tokens: 3000
        });

        const aiResponse = await Promise.race([aiResponsePromise, timeoutPromise]);

        if (aiResponse.success) {
            try {
                const result = JSON.parse(aiResponse.content);
                
                // 验证结果完整性
                if (!result.overallScore || !result.dimensionScores) {
                    console.warn('AI返回数据不完整，使用备用分析');
                    return getEnhancedWritingAnalysis(content, word_count, question.word_limit);
                }
                
                console.log('AI分析成功:', {
                    overallScore: result.overallScore,
                    dimensions: result.dimensionScores
                });
                
                return result;
            } catch (parseError) {
                console.error('AI返回数据解析失败:', parseError);
                throw new Error('AI返回数据格式错误');
            }
        } else {
            console.error('AI服务调用失败:', aiResponse.message);
            throw new Error(aiResponse.message);
        }
    } catch (error) {
        console.error('AI评分完全失败:', error);
        // 返回更详细的备用分析
        return getEnhancedWritingAnalysis(content, word_count, question.word_limit);
    }
}

// 增强备用分析函数
function getEnhancedWritingAnalysis(content, word_count, word_limit) {
    // 更详细的分析逻辑
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.trim().split(/\s+/);
    
    // 计算各种指标
    const wordRatio = word_count / word_limit;
    const avgSentenceLength = words.length / (sentences.length || 1);
    
    // 检查连接词使用
    const transitionWords = ['however', 'therefore', 'moreover', 'furthermore', 'consequently', 'nevertheless', 'in addition', 'on the other hand'];
    const transitionCount = transitionWords.filter(word => content.toLowerCase().includes(word)).length;
    
    // 检查复杂句式
    const complexPatterns = [/although/i, /despite/i, /while/i, /which/i, /that/i, /because/i, /since/i];
    const complexSentenceCount = complexPatterns.filter(pattern => pattern.test(content)).length;
    
    // 基础分数计算
    let baseScore = 70;
    
    // 字数调整
    if (wordRatio < 0.8) baseScore -= 10;
    else if (wordRatio > 1.2) baseScore += 5;
    else if (wordRatio >= 0.9 && wordRatio <= 1.1) baseScore += 5;
    
    // 句子复杂度调整
    if (avgSentenceLength < 10) baseScore -= 5;
    else if (avgSentenceLength > 20) baseScore += 5;
    
    // 连接词使用调整
    if (transitionCount >= 2) baseScore += 5;
    else if (transitionCount === 0) baseScore -= 5;
    
    // 复杂句式调整
    if (complexSentenceCount >= 2) baseScore += 5;
    
    // 确保分数在合理范围内
    baseScore = Math.max(50, Math.min(85, baseScore));

    return {
        overallScore: Math.round(baseScore),
        dimensionScores: {
            content: Math.round(Math.max(50, Math.min(85, baseScore))),
            structure: Math.round(Math.max(50, Math.min(85, baseScore - 3))),
            language: Math.round(Math.max(50, Math.min(85, baseScore - 2)))
        },
        feedback: "AI分析服务暂时不可用，使用基础分析模式。您的作文结构基本完整，建议多使用连接词和复杂句式来提升作文质量。",
        commonErrors: [
            "建议注意段落之间的逻辑衔接",
            "可以增加更多细节支持观点",
            transitionCount === 0 ? "缺少连接词使文章不够连贯" : "",
            complexSentenceCount < 2 ? "可以适当使用复杂句式" : ""
        ].filter(Boolean),
        suggestions: [
            "多阅读优秀范文，学习地道的英语表达",
            "注意使用过渡词使文章更连贯",
            "尝试使用更多样的句型和词汇",
            "练习使用定语从句、状语从句等复杂句式"
        ],
        detailedAnalysis: {
            contentAnalysis: "内容基本切题，但深度和细节有待加强",
            structureAnalysis: `文章包含${sentences.length}个句子，平均句长${avgSentenceLength.toFixed(1)}词，结构基本清晰`,
            languageAnalysis: `使用了${transitionCount}个连接词和${complexSentenceCount}个复杂句式，语言表达基本准确`,
            vocabularySuggestions: ["however", "furthermore", "consequently", "nevertheless"],
            sentenceImprovements: ["尝试使用定语从句丰富句式", "可以使用倒装句增强语言表现力"]
        },
        improvementSuggestions: {
            immediate: ["检查语法错误", "增加具体例子支撑观点", "添加适当的连接词"],
            longTerm: ["扩大词汇量", "学习英语写作逻辑结构", "多练习不同文体的写作"]
        }
    };
}

// 添加获取综合题目集合的路由
router.post('/comprehensive-set', async (req, res) => {
    try {
        const { user_id, exam_type, question_count, include_types } = req.body;
        
        if (!user_id || !exam_type) {
            return res.json({ success: false, message: '参数不完整' });
        }
        
        // 为每种类型获取一道题目
        const questions = [];
        for (const type of include_types) {
            const query = `
                SELECT * FROM writing_questions 
                WHERE exam_type = ? AND question_type = ? AND is_active = 1
                ORDER BY RANDOM() LIMIT 1
            `;
            
            const question = await new Promise((resolve, reject) => {
                db.get(query, [exam_type, type], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (question) {
                questions.push(question);
            }
        }
        
        // 如果某些类型没有题目，使用备用题目
        if (questions.length < question_count) {
            const backupQuery = `
                SELECT * FROM writing_questions 
                WHERE exam_type = ? AND is_active = 1 
                ORDER BY RANDOM() LIMIT ?
            `;
            
            const backupQuestions = await new Promise((resolve, reject) => {
                db.all(backupQuery, [exam_type, question_count - questions.length], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            questions.push(...backupQuestions);
        }
        
        res.json({
            success: true,
            data: {
                questions: questions,
                total: questions.length
            }
        });
        
    } catch (error) {
        console.error('获取综合题目集合错误:', error);
        res.json({ success: false, message: '获取题目失败' });
    }
});

// 修改提交路由为保存结果（不再进行分析）
router.post('/save-result', async (req, res) => {
    try {
        const { user_id, question_id, content, time_spent, analysis_result, word_count } = req.body;
        
        if (!user_id || !question_id || !content || !analysis_result) {
            return res.json({ success: false, message: '参数不完整' });
        }
        
        // 直接保存前端分析的结果
        const insertQuery = `
            INSERT INTO writing_sessions 
            (user_id, question_id, user_content, word_count, time_spent, 
             score_overall, score_content, score_structure, score_language,
             ai_feedback, common_errors, suggestions, detailed_analysis, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `;
        
        db.run(insertQuery, [
            user_id,
            question_id,
            content,
            word_count,
            time_spent,
            analysis_result.scores.overall,
            analysis_result.scores.content,
            analysis_result.scores.structure,
            analysis_result.scores.language,
            analysis_result.feedback,
            JSON.stringify(analysis_result.common_errors || []),
            JSON.stringify(analysis_result.suggestions || []),
            JSON.stringify(analysis_result.detailed_analysis || {})
        ], function(err) {
            if (err) {
                console.error('保存写作记录失败:', err);
                return res.json({ success: false, message: '保存失败' });
            }
            
            // 更新写作统计
            updateWritingStatistics(user_id, 'CET4', analysis_result.scores.overall, word_count);
            
            res.json({
                success: true,
                data: {
                    record_id: this.lastID
                }
            });
        });
        
    } catch (error) {
        console.error('保存写作结果错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 更新写作统计
function updateWritingStatistics(user_id, exam_type, score, word_count) {
    const query = `
        INSERT OR REPLACE INTO writing_statistics 
        (user_id, exam_type, total_practices, total_words, avg_score, best_score, 
         improvement_rate, last_practice_date, common_weaknesses)
        SELECT 
            ?, ?,
            COALESCE(total_practices, 0) + 1,
            COALESCE(total_words, 0) + ?,
            (COALESCE(avg_score * total_practices, 0) + ?) / (COALESCE(total_practices, 0) + 1),
            MAX(COALESCE(best_score, 0), ?),
            COALESCE((? - avg_score) / NULLIF(avg_score, 0) * 100, 0),
            DATE('now'),
            COALESCE(common_weaknesses, '词汇多样性不足')
        FROM writing_statistics 
        WHERE user_id = ? AND exam_type = ?
    `;
    
    db.run(query, [
        user_id, exam_type, word_count, score, score, score, 
        user_id, exam_type
    ], (err) => {
        if (err) {
            console.error('更新写作统计失败:', err);
        }
    });
}

// 获取用户写作历史
router.get('/history', async (req, res) => {
    try {
        const { user_id, page = 1, limit = 10 } = req.query;
        
        if (!user_id) {
            return res.json({ success: false, message: '用户ID不能为空' });
        }
        
        const offset = (page - 1) * limit;
        
        const query = `
            SELECT ws.*, wq.title, wq.question_type, wq.exam_type
            FROM writing_sessions ws
            JOIN writing_questions wq ON ws.question_id = wq.id
            WHERE ws.user_id = ?
            ORDER BY ws.submitted_at DESC
            LIMIT ? OFFSET ?
        `;
        
        db.all(query, [user_id, parseInt(limit), offset], (err, records) => {
            if (err) {
                console.error('获取写作历史失败:', err);
                return res.json({ success: false, message: '获取历史失败' });
            }
            
            // 获取总数
            db.get('SELECT COUNT(*) as total FROM writing_sessions WHERE user_id = ?', [user_id], (err, countResult) => {
                if (err) {
                    return res.json({ success: false, message: '获取总数失败' });
                }
                
                res.json({
                    success: true,
                    data: {
                        records: records,
                        pagination: {
                            page: parseInt(page),
                            limit: parseInt(limit),
                            total: countResult.total,
                            pages: Math.ceil(countResult.total / limit)
                        }
                    }
                });
            });
        });
    } catch (error) {
        console.error('获取写作历史错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 获取范文列表
router.get('/samples', async (req, res) => {
    try {
        const { exam_type, essay_type, page = 1, limit = 12 } = req.query;
        
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT * FROM writing_sample_essays 
            WHERE is_active = 1
        `;
        const params = [];
        
        if (exam_type) {
            query += ' AND exam_type = ?';
            params.push(exam_type);
        }
        
        if (essay_type) {
            query += ' AND essay_type = ?';
            params.push(essay_type);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        db.all(query, params, (err, samples) => {
            if (err) {
                console.error('获取范文失败:', err);
                return res.json({ success: false, message: '获取范文失败' });
            }
            
            // 获取总数
            let countQuery = `SELECT COUNT(*) as total FROM writing_sample_essays WHERE is_active = 1`;
            const countParams = [];
            
            if (exam_type) {
                countQuery += ' AND exam_type = ?';
                countParams.push(exam_type);
            }
            
            if (essay_type) {
                countQuery += ' AND essay_type = ?';
                countParams.push(essay_type);
            }
            
            db.get(countQuery, countParams, (err, countResult) => {
                if (err) {
                    return res.json({ success: false, message: '获取总数失败' });
                }
                
                res.json({
                    success: true,
                    data: {
                        samples: samples,
                        pagination: {
                            page: parseInt(page),
                            limit: parseInt(limit),
                            total: countResult.total,
                            pages: Math.ceil(countResult.total / limit)
                        }
                    }
                });
            });
        });
    } catch (error) {
        console.error('获取范文错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 获取范文详情
router.get('/samples/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        db.get('SELECT * FROM writing_sample_essays WHERE id = ? AND is_active = 1', [id], (err, sample) => {
            if (err || !sample) {
                return res.json({ success: false, message: '范文不存在' });
            }
            
            // 增加阅读次数
            db.run('UPDATE writing_sample_essays SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?', [id]);
            
            res.json({ success: true, data: sample });
        });
    } catch (error) {
        console.error('获取范文详情错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 获取写作统计
router.get('/statistics', async (req, res) => {
    try {
        const { user_id } = req.query;
        
        if (!user_id) {
            return res.json({ success: false, message: '用户ID不能为空' });
        }
        
        // 获取总体统计
        db.get('SELECT * FROM writing_statistics WHERE user_id = ? AND exam_type = "CET4"', [user_id], (err, stats) => {
            if (err) {
                console.error('获取写作统计失败:', err);
                return res.json({ success: false, message: '获取统计失败' });
            }
            
            // 获取最近10次练习分数趋势
            const trendQuery = `
                SELECT score_overall, submitted_at 
                FROM writing_sessions 
                WHERE user_id = ? 
                ORDER BY submitted_at DESC 
                LIMIT 10
            `;
            
            db.all(trendQuery, [user_id], (err, trends) => {
                if (err) {
                    return res.json({ success: false, message: '获取趋势数据失败' });
                }
                
                // 获取各维度平均分
                const dimensionQuery = `
                    SELECT 
                        AVG(score_content) as avg_content,
                        AVG(score_structure) as avg_structure,
                        AVG(score_language) as avg_language
                    FROM writing_sessions 
                    WHERE user_id = ?
                `;
                
                db.get(dimensionQuery, [user_id], (err, dimensions) => {
                    if (err) {
                        return res.json({ success: false, message: '获取维度数据失败' });
                    }
                    
                    // 获取常见错误统计
                    const errorQuery = `
                        SELECT common_errors
                        FROM writing_sessions 
                        WHERE user_id = ? AND common_errors IS NOT NULL
                        ORDER BY submitted_at DESC
                        LIMIT 5
                    `;
                    
                    db.all(errorQuery, [user_id], (err, errorRecords) => {
                        const commonErrors = [];
                        if (errorRecords) {
                            errorRecords.forEach(record => {
                                try {
                                    const errors = JSON.parse(record.common_errors);
                                    commonErrors.push(...errors);
                                } catch (e) {
                                    // 忽略解析错误
                                }
                            });
                        }
                        
                        // 统计错误频率
                        const errorFrequency = {};
                        commonErrors.forEach(error => {
                            errorFrequency[error] = (errorFrequency[error] || 0) + 1;
                        });
                        
                        res.json({
                            success: true,
                            data: {
                                overall: stats || {
                                    total_practices: 0,
                                    avg_score: 0,
                                    best_score: 0,
                                    improvement_rate: 0,
                                    total_words: 0
                                },
                                trends: trends ? trends.reverse() : [],
                                dimensions: dimensions || {
                                    avg_content: 0,
                                    avg_structure: 0,
                                    avg_language: 0
                                },
                                common_errors: Object.entries(errorFrequency)
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 5)
                                    .map(([error]) => error)
                            }
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error('获取写作统计错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

module.exports = router;