// AI批改管理器
class CorrectionManager {
    constructor() {
        this.currentCorrectionId = null;
        this.correctionHistory = [];
        this.initializeEventListeners();
        this.loadCorrectionHistory();
        this.apiKey = "fb70a667fee0422ca79519e4fe598cff.JO3wADNEk2VeaPYQ"; // 智普AI API密钥
        this.apiUrl = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
    }

    initializeEventListeners() {
        document.getElementById('submit-correction').addEventListener('click', () => this.submitCorrection());
        
        // 回车键提交支持
        document.getElementById('essay-text').addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.submitCorrection();
            }
        });

        // 单词计数
        document.getElementById('essay-text').addEventListener('input', (e) => {
            const text = e.target.value.trim();
            const wordCount = text ? text.split(/\s+/).length : 0;
            document.getElementById('word-count').textContent = `${wordCount} 单词`;
        });

        // 标签切换
        document.getElementById('text-input-tab').addEventListener('click', () => this.switchTab('text'));
        document.getElementById('file-input-tab').addEventListener('click', () => this.switchTab('file'));

        // 清空文本
        document.getElementById('clear-text').addEventListener('click', () => {
            document.getElementById('essay-text').value = '';
            document.getElementById('word-count').textContent = '0 单词';
        });

        // 粘贴文本
        document.getElementById('paste-text').addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                document.getElementById('essay-text').value = text;
                const wordCount = text ? text.split(/\s+/).length : 0;
                document.getElementById('word-count').textContent = `${wordCount} 单词`;
                this.showMessage('已粘贴剪贴板内容', 'success');
            } catch (error) {
                this.showMessage('无法读取剪贴板内容', 'error');
            }
        });
    }

    switchTab(tab) {
        const textTab = document.getElementById('text-input-tab');
        const fileTab = document.getElementById('file-input-tab');
        const textArea = document.getElementById('text-input-area');
        const fileArea = document.getElementById('file-input-area');

        if (tab === 'text') {
            textTab.classList.add('bg-white', 'text-primary', 'shadow-sm');
            textTab.classList.remove('text-gray-600');
            fileTab.classList.remove('bg-white', 'text-primary', 'shadow-sm');
            fileTab.classList.add('text-gray-600');
            textArea.classList.remove('hidden');
            fileArea.classList.add('hidden');
        } else {
            fileTab.classList.add('bg-white', 'text-primary', 'shadow-sm');
            fileTab.classList.remove('text-gray-600');
            textTab.classList.remove('bg-white', 'text-primary', 'shadow-sm');
            textTab.classList.add('text-gray-600');
            fileArea.classList.remove('hidden');
            textArea.classList.add('hidden');
        }
    }

    async submitCorrection() {
        const text = document.getElementById('essay-text').value.trim();
        
        if (!text) {
            this.showMessage('请输入要批改的英文作文', 'error');
            return;
        }

        if (text.split(/\s+/).length < 10) {
            this.showMessage('作文内容过短，请至少输入10个单词', 'warning');
            return;
        }

        // 检查登录状态
        if (!window.unifiedAuthManager || !window.unifiedAuthManager.isLoggedIn()) {
            this.showMessage('请先登录后再使用批改功能', 'error');
            setTimeout(() => {
                window.location.href = '墨语智学登录.html?redirect=' + encodeURIComponent(window.location.href);
            }, 2000);
            return;
        }

        await this.processCorrection(text);
    }

    async processCorrection(text) {
        this.showLoading(true);
        
        try {
            // 获取考试类型选择
            const examType = document.getElementById('exam-type-select')?.value || 'CET4';
            
            const correctionResult = await this.sendCorrectionRequest(text, examType);
            
            if (correctionResult.success) {
                this.displayCorrectionResult(correctionResult);
                this.saveToHistory(correctionResult);
                this.showMessage('批改完成！', 'success');
                
                // 显示详细分析
                this.showDetailedAnalysis();
            } else {
                throw new Error(correctionResult.message || '批改失败');
            }
            
        } catch (error) {
            console.error('批改请求失败:', error);
            this.showMessage('批改服务暂时不可用，使用模拟数据演示', 'warning');
            
            // 演示模式：使用模拟数据
            this.displayDemoResult(text);
        } finally {
            this.showLoading(false);
        }
    }

    async sendCorrectionRequest(text, examType) {
        try {
            // 直接在前端调用智普AI API
            const prompt = this.createCorrectionPrompt(text, examType);
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: "glm-4",
                    messages: [
                        {
                            role: "system",
                            content: `你是专业的英语作文批改专家，精通${examType}考试评分标准。请提供准确、详细的批改反馈，帮助提升写作能力。请严格返回JSON格式数据。`
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 4000
                })
            });

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.choices && result.choices[0] && result.choices[0].message) {
                const content = result.choices[0].message.content;
                
                try {
                    // 尝试解析JSON响应
                    const correctionData = JSON.parse(content);
                    return {
                        success: true,
                        ...correctionData,
                        correctedAt: new Date().toISOString(),
                        examType: examType,
                        text: text
                    };
                } catch (e) {
                    console.error('AI返回数据解析失败:', e);
                    // 如果解析失败，使用基础批改
                    return this.generateBasicCorrection(text, examType);
                }
            } else {
                throw new Error('AI服务返回无效响应');
            }

        } catch (error) {
            console.error('AI批改请求错误:', error);
            // 网络错误时使用基础批改
            return this.generateBasicCorrection(text, examType);
        }
    }

    createCorrectionPrompt(text, examType) {
        return `
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
    }

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
            examType: examType,
            text: text
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

    displayCorrectionResult(result) {
        // 显示评分概览
        this.displayScoreOverview(result.score);
        
        // 显示详细分析
        this.displayDetailedAnalysis(result);
        
        // 显示学习建议
        this.displayLearningSuggestions(result.suggestions);
        
        // 显示标注文本
        this.displayAnnotatedText(result);
    }

    displayScoreOverview(score) {
        const scoreOverview = document.getElementById('score-overview');
        const scoreDetails = document.getElementById('score-details');
        const totalScore = document.getElementById('total-score');
        const scoreComment = document.getElementById('score-comment');
        
        scoreOverview.classList.add('hidden');
        scoreDetails.classList.remove('hidden');
        
        totalScore.textContent = score.total;
        totalScore.className = this.getScoreColorClass(score.total);
        scoreComment.textContent = this.getScoreComment(score.total);
        
        // 更新细分分数
        this.updateScoreBars(score);
    }

    // 根据分数获取颜色类
    getScoreColorClass(score) {
        if (score >= 90) return 'text-5xl font-bold text-green-600';
        if (score >= 80) return 'text-5xl font-bold text-blue-600';
        if (score >= 70) return 'text-5xl font-bold text-yellow-600';
        if (score >= 60) return 'text-5xl font-bold text-orange-600';
        return 'text-5xl font-bold text-red-600';
    }

    // 更新分数进度条
    updateScoreBars(score) {
        const bars = {
            'grammar-bar': score.grammar,
            'vocabulary-bar': score.vocabulary,
            'structure-bar': score.structure,
            'content-bar': score.content
        };

        Object.keys(bars).forEach(barId => {
            const bar = document.getElementById(barId);
            const scoreElement = document.getElementById(barId.replace('-bar', '-score'));
            
            if (bar && scoreElement) {
                const percentage = (bars[barId] / 25) * 100; // 假设满分25
                bar.style.width = `${percentage}%`;
                scoreElement.textContent = `${bars[barId]}/25`;
                
                // 设置颜色
                bar.className = 'h-2 rounded-full';
                if (bars[barId] >= 20) bar.classList.add('bg-green-500');
                else if (bars[barId] >= 15) bar.classList.add('bg-yellow-500');
                else bar.classList.add('bg-red-500');
            }
        });
    }

    // 显示详细分析
    displayDetailedAnalysis(result) {
        const analysisContent = document.getElementById('analysis-content');
        const detailedAnalysis = document.getElementById('detailed-analysis');
        
        analysisContent.classList.add('hidden');
        detailedAnalysis.classList.remove('hidden');
        detailedAnalysis.innerHTML = this.generateAnalysisHTML(result);
    }

    // 生成分析HTML
    generateAnalysisHTML(result) {
        return `
            <div class="space-y-6">
                <!-- 总体评价 -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div class="flex items-center mb-2">
                        <i class="fas fa-star text-blue-500 mr-2"></i>
                        <h4 class="font-semibold text-blue-800">总体评价</h4>
                    </div>
                    <p class="text-blue-700">${result.overallComment || '作文内容完整，表达基本清晰。'}</p>
                    <div class="mt-2 text-sm text-blue-600">
                        <span class="inline-flex items-center mr-4">
                            <i class="fas fa-font mr-1"></i> ${result.wordCount} 单词
                        </span>
                        <span class="inline-flex items-center mr-4">
                            <i class="fas fa-chart-line mr-1"></i> ${result.readability || '标准'}
                        </span>
                        <span class="inline-flex items-center">
                            <i class="fas fa-graduation-cap mr-1"></i> ${result.cefrLevel || 'B1'}
                        </span>
                    </div>
                </div>
                
                <!-- 语法错误 -->
                <div class="border-l-4 border-red-500 pl-4">
                    <div class="flex items-center mb-3">
                        <i class="fas fa-exclamation-circle text-red-500 mr-2"></i>
                        <h4 class="font-semibold">语法错误 (${result.grammarErrors?.length || 0}处)</h4>
                    </div>
                    <div class="space-y-3">
                        ${result.grammarErrors?.map((error, index) => `
                            <div class="bg-red-50 border border-red-200 rounded p-3">
                                <div class="flex justify-between items-start mb-1">
                                    <span class="text-sm font-medium text-red-800">错误 ${index + 1}</span>
                                    <span class="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">${error.type}</span>
                                </div>
                                <p class="text-sm text-red-700 mb-1">${error.error}</p>
                                <p class="text-sm text-green-700">
                                    <i class="fas fa-lightbulb mr-1"></i> 修正建议: ${error.correction}
                                </p>
                            </div>
                        `).join('') || `
                            <div class="bg-green-50 border border-green-200 rounded p-3">
                                <p class="text-green-700 flex items-center">
                                    <i class="fas fa-check-circle mr-2"></i>
                                    没有发现语法错误，继续保持！
                                </p>
                            </div>
                        `}
                    </div>
                </div>
                
                <!-- 词汇建议 -->
                <div class="border-l-4 border-yellow-500 pl-4">
                    <div class="flex items-center mb-3">
                        <i class="fas fa-lightbulb text-yellow-500 mr-2"></i>
                        <h4 class="font-semibold">词汇建议</h4>
                    </div>
                    <div class="space-y-3">
                        ${result.vocabularySuggestions?.map((suggestion, index) => `
                            <div class="bg-yellow-50 border border-yellow-200 rounded p-3">
                                <p class="text-sm font-medium text-yellow-800 mb-1">
                                    <span class="line-through">${suggestion.original}</span> 
                                    <i class="fas fa-arrow-right mx-2 text-yellow-600"></i>
                                    <span class="font-semibold">${suggestion.suggestion}</span>
                                </p>
                                <p class="text-sm text-yellow-700">${suggestion.reason}</p>
                            </div>
                        `).join('') || `
                            <div class="bg-green-50 border border-green-200 rounded p-3">
                                <p class="text-green-700">词汇使用恰当，表达准确</p>
                            </div>
                        `}
                    </div>
                </div>
                
                <!-- 结构分析 -->
                <div class="border-l-4 border-blue-500 pl-4">
                    <div class="flex items-center mb-3">
                        <i class="fas fa-project-diagram text-blue-500 mr-2"></i>
                        <h4 class="font-semibold">结构分析</h4>
                    </div>
                    <p class="text-sm text-gray-700 bg-blue-50 border border-blue-200 rounded p-3">
                        ${result.structureAnalysis || '文章结构清晰，段落分明，逻辑连贯。'}
                    </p>
                </div>
                
                <!-- 内容评价 -->
                <div class="border-l-4 border-purple-500 pl-4">
                    <div class="flex items-center mb-3">
                        <i class="fas fa-edit text-purple-500 mr-2"></i>
                        <h4 class="font-semibold">内容评价</h4>
                    </div>
                    <p class="text-sm text-gray-700 bg-purple-50 border border-purple-200 rounded p-3">
                        ${result.contentEvaluation || '内容充实，观点明确，论证有力。'}
                    </p>
                </div>
            </div>
        `;
    }

    displayLearningSuggestions(suggestions) {
        const suggestionsContainer = document.getElementById('learning-suggestions');
        suggestionsContainer.innerHTML = this.generateSuggestionsHTML(suggestions);
    }

    generateSuggestionsHTML(suggestions) {
        if (!suggestions || suggestions.length === 0) {
            return '<p class="text-green-500">✓ 写作水平良好，继续保持！</p>';
        }

        return suggestions.map(suggestion => `
            <div class="p-3 bg-blue-50 rounded-lg">
                <p class="font-medium text-blue-800 mb-1">${suggestion.title || suggestion.type}</p>
                <p class="text-sm text-blue-700">${suggestion.description || suggestion.suggestion}</p>
                ${suggestion.action ? `<a href="${suggestion.action.url}" class="text-xs text-primary hover:underline mt-1 inline-block">${suggestion.action.text}</a>` : ''}
            </div>
        `).join('');
    }

    // 显示标注文本
    displayAnnotatedText(result) {
        const annotatedContainer = document.getElementById('annotated-text');
        if (!annotatedContainer) return;

        let annotatedText = result.text || document.getElementById('essay-text').value;
        
        // 简单的标注实现
        if (result.grammarErrors && result.grammarErrors.length > 0) {
            result.grammarErrors.forEach(error => {
                if (error.position && error.position.length === 2) {
                    const [start, end] = error.position;
                    const errorText = annotatedText.substring(start, end);
                    const highlighted = `<span class="highlight-error" title="${error.error} - ${error.correction}">${errorText}</span>`;
                    annotatedText = annotatedText.substring(0, start) + highlighted + annotatedText.substring(end);
                }
            });
        }

        annotatedContainer.innerHTML = `
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 class="font-semibold mb-3 flex items-center">
                    <i class="fas fa-highlighter mr-2"></i>标注文本
                </h4>
                <div class="text-sm leading-relaxed whitespace-pre-wrap annotated-content">
                    ${annotatedText}
                </div>
                <div class="mt-3 flex items-center text-xs text-gray-500">
                    <span class="flex items-center mr-4">
                        <span class="inline-block w-3 h-3 bg-red-500 mr-1"></span> 语法错误
                    </span>
                    <span class="flex items-center mr-4">
                        <span class="inline-block w-3 h-3 bg-yellow-500 mr-1"></span> 词汇建议
                    </span>
                    <span class="flex items-center">
                        <span class="inline-block w-3 h-3 bg-green-500 mr-1"></span> 优秀表达
                    </span>
                </div>
            </div>
        `;
    }

    // 显示详细分析
    showDetailedAnalysis() {
        // 滚动到分析区域
        const analysisSection = document.getElementById('detailed-analysis');
        if (analysisSection) {
            analysisSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    displayDemoResult(text) {
        // 演示数据
        const demoResult = {
            score: {
                total: 78,
                grammar: 18,
                vocabulary: 16,
                structure: 22,
                content: 22
            },
            grammarErrors: [
                { 
                    position: [10, 15],
                    error: "主谓一致错误", 
                    correction: "建议使用第三人称单数形式",
                    type: "语法错误"
                },
                { 
                    position: [25, 30],
                    error: "时态不一致", 
                    correction: "统一使用一般现在时",
                    type: "时态错误"
                }
            ],
            vocabularySuggestions: [
                { original: "good", suggestion: "excellent, outstanding", reason: "使用更精确的形容词" },
                { original: "many", suggestion: "numerous, various", reason: "丰富词汇表达" }
            ],
            structureAnalysis: "文章开头直接，但段落之间的过渡可以更自然。建议增加连接词。",
            contentEvaluation: "内容基本完整，可以进一步深化主题和论证。",
            overallComment: "良好的写作水平，有少量需要改进的地方。",
            suggestions: [
                {
                    title: "语法强化练习",
                    description: "建议重点练习主谓一致和时态用法",
                    action: { text: "开始练习", url: "墨语智学语法练习.html" }
                },
                {
                    title: "词汇扩展",
                    description: "学习更多高级词汇替换常见表达",
                    action: { text: "查看词汇", url: "墨语智学词汇.html" }
                }
            ],
            wordCount: text.split(/\s+/).length,
            readability: "适中",
            cefrLevel: "B1",
            text: text
        };
        
        this.displayCorrectionResult(demoResult);
    }

    getScoreComment(score) {
        if (score >= 90) return '优秀！写作水平很高';
        if (score >= 80) return '良好！有少量需要改进的地方';
        if (score >= 70) return '中等！需要关注主要问题';
        if (score >= 60) return '及格！需要系统学习改进';
        return '需要加强基础练习';
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

    // 获取CEFR等级
    getCEFRLevel(score) {
        if (score >= 90) return 'C2';
        if (score >= 80) return 'C1';
        if (score >= 70) return 'B2';
        if (score >= 60) return 'B1';
        if (score >= 50) return 'A2';
        return 'A1';
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    saveToHistory(correctionResult) {
        const historyItem = {
            id: Date.now(),
            text: correctionResult.text || document.getElementById('essay-text').value.substring(0, 100) + '...',
            score: correctionResult.score.total,
            timestamp: new Date().toISOString(),
            result: correctionResult
        };
        
        this.correctionHistory.unshift(historyItem);
        this.correctionHistory = this.correctionHistory.slice(0, 10); // 保留最近10条
        
        this.saveHistoryToStorage();
        this.updateHistoryDisplay();
    }

    saveHistoryToStorage() {
        if (window.unifiedAuthManager && window.unifiedAuthManager.isLoggedIn()) {
            const user = window.unifiedAuthManager.getCurrentUser();
            const storageKey = `correction_history_${user.id}`;
            localStorage.setItem(storageKey, JSON.stringify(this.correctionHistory));
        }
    }

    loadCorrectionHistory() {
        if (window.unifiedAuthManager && window.unifiedAuthManager.isLoggedIn()) {
            const user = window.unifiedAuthManager.getCurrentUser();
            const storageKey = `correction_history_${user.id}`;
            const stored = localStorage.getItem(storageKey);
            
            if (stored) {
                this.correctionHistory = JSON.parse(stored);
                this.updateHistoryDisplay();
            }
        }
    }

    updateHistoryDisplay() {
        const historyContainer = document.getElementById('correction-history');
        
        if (this.correctionHistory.length === 0) {
            historyContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-3"></i>
                    <p>暂无批改记录</p>
                </div>
            `;
            return;
        }

        historyContainer.innerHTML = this.correctionHistory.map(item => `
            <div class="p-3 border border-gray-200 rounded-lg hover:border-primary transition-colors cursor-pointer" 
                 onclick="window.correctionManager.viewHistoryItem(${item.id})">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-sm text-gray-600">${this.formatDate(item.timestamp)}</span>
                    <span class="px-2 py-1 bg-primary text-white text-xs rounded">${item.score}分</span>
                </div>
                <p class="text-sm text-gray-800 line-clamp-2">${item.text}</p>
            </div>
        `).join('');
    }

    viewHistoryItem(id) {
        const item = this.correctionHistory.find(h => h.id === id);
        if (item) {
            document.getElementById('essay-text').value = item.result.text;
            this.displayCorrectionResult(item.result);
            this.showMessage('已加载历史批改记录', 'info');
        }
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    showMessage(message, type = 'info') {
        if (window.uiManager && window.uiManager.showMessage) {
            window.uiManager.showMessage(message, type);
        } else {
            alert(message);
        }
    }
}