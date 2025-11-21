// game/题目管理系统.js - 只使用词汇库版本
class QuestionManager {
    static async generateQuestion(difficulty = 'medium') {
        try {
            // 只从词汇库生成题目
            const vocabQuestion = await this.generateVocabularyQuestion(difficulty, 'auto');
            if (vocabQuestion && this.validateQuestion(vocabQuestion)) {
                console.log('✅ 使用词汇库题目');
                return vocabQuestion;
            } else {
                throw new Error('生成的词汇题目无效');
            }
        } catch (error) {
            console.error('词汇库题目生成失败:', error.message);
            // 不再回退到标准题目，直接抛出错误
            throw new Error('无法从词汇库生成题目: ' + error.message);
        }
    }

    // 🔥 强制只使用词汇管理器
    static async generateVocabularyQuestion(difficulty = 'medium', type = 'auto') {
        try {
            // 动态导入增强的题目管理器
            const EnhancedQuestionManager = require('./tools/enhanced-question-manager');
            const enhancedManager = new EnhancedQuestionManager();
            
            return await enhancedManager.generateVocabularyQuestion(difficulty, type);
        } catch (error) {
            console.warn('词汇管理器加载失败:', error.message);
            throw error;
        }
    }
    
    // 🔥 新增：获取词汇统计
    static async getVocabularyStats() {
        try {
            const VocabularyDataManager = require('./tools/vocabulary-data-manager');
            const manager = new VocabularyDataManager();
            return await manager.getStatistics();
        } catch (error) {
            console.error('获取词汇统计失败:', error);
            return null;
        }
    }

    // 🔥 新增：检查词汇库是否为空
    static async checkVocabularyEmpty() {
        try {
            const EnhancedQuestionManager = require('./tools/enhanced-question-manager');
            const enhancedManager = new EnhancedQuestionManager();
            return await enhancedManager.checkVocabularyEmpty();
        } catch (error) {
            console.error('检查词汇库失败:', error);
            return true;
        }
    }
    
    // 🔥 新增：智能题目生成（只使用词汇库）
    static async generateSmartQuestion(difficulty = 'medium') {
        try {
            const vocabQuestion = await this.generateVocabularyQuestion(difficulty, 'auto');
            if (vocabQuestion && this.validateQuestion(vocabQuestion)) {
                console.log('✅ 使用词汇库题目');
                return vocabQuestion;
            } else {
                throw new Error('生成的词汇题目无效');
            }
        } catch (error) {
            console.error('词汇库题目生成失败:', error.message);
            throw new Error('无法从词汇库生成题目，请确保已导入词汇数据');
        }
    }

    // 移除标准题目生成逻辑，只保留工具方法

    // 数组洗牌
    static shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    // 获取题目统计信息
    static getQuestionStats() {
        const stats = JSON.parse(localStorage.getItem('questionStats') || '{}');
        return stats;
    }

    // 更新题目统计
    static updateQuestionStats(questionType, isCorrect) {
        const stats = this.getQuestionStats();
        
        if (!stats[questionType]) {
            stats[questionType] = { total: 0, correct: 0 };
        }
        
        stats[questionType].total++;
        if (isCorrect) {
            stats[questionType].correct++;
        }
        
        localStorage.setItem('questionStats', JSON.stringify(stats));
    }

    // 获取用户的薄弱环节
    static getWeakAreas() {
        const stats = this.getQuestionStats();
        const areas = [];
        
        for (const [type, data] of Object.entries(stats)) {
            const accuracy = data.correct / data.total;
            if (accuracy < 0.7) { // 正确率低于70%视为薄弱环节
                areas.push({
                    type: type,
                    accuracy: accuracy,
                    totalAttempts: data.total
                });
            }
        }
        
        return areas.sort((a, b) => a.accuracy - b.accuracy);
    }

    // 添加题目验证方法
    static validateQuestion(question) {
        if (!question) return false;
        if (!question.options || !Array.isArray(question.options)) return false;
        if (question.options.length < 2) return false;
        if (!question.correctAnswer) return false;
        if (!question.options.includes(question.correctAnswer)) return false;
        return true;
    }

    // 🔥 新增：批量生成题目（只从词汇库）
    static async generateBatchQuestions(difficulty = 'medium', count = 10) {
        const questions = [];
        for (let i = 0; i < count; i++) {
            try {
                const question = await this.generateVocabularyQuestion(difficulty, 'auto');
                if (question) {
                    questions.push(question);
                }
            } catch (error) {
                console.error(`生成第${i+1}个题目失败:`, error);
            }
        }
        return questions;
    }

    // 🔥 新增：根据薄弱环节生成针对性题目
    static async generateTargetedQuestions() {
        const weakAreas = this.getWeakAreas();
        if (weakAreas.length === 0) {
            return await this.generateSmartQuestion('medium');
        }
        
        // 优先针对最薄弱的环节
        const weakestArea = weakAreas[0];
        let question;
        
        try {
            question = await this.generateVocabularyQuestion('medium', weakestArea.type.replace('vocabulary_', ''));
        } catch (error) {
            // 如果特定类型生成失败，尝试生成默认类型
            try {
                question = await this.generateVocabularyQuestion('medium', 'auto');
            } catch (fallbackError) {
                throw new Error('无法生成针对性题目: ' + fallbackError.message);
            }
        }
        
        return question;
    }

    // 🔥 新增：导出题目数据
    static exportQuestions(questions, format = 'json') {
        const exportData = {
            questions: questions,
            metadata: {
                exportTime: new Date().toISOString(),
                totalQuestions: questions.length,
                version: '1.0',
                source: 'vocabulary_library'
            }
        };

        if (format === 'json') {
            return JSON.stringify(exportData, null, 2);
        } else if (format === 'csv') {
            // 简化的CSV导出
            let csv = '类型,题目,正确答案,选项\n';
            questions.forEach(q => {
                csv += `"${q.type}","${q.text}","${q.correctAnswer}","${q.options.join('|')}"\n`;
            });
            return csv;
        }
        
        return exportData;
    }

    // 🔥 新增：导入题目数据
    static importQuestions(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            if (data.questions && Array.isArray(data.questions)) {
                return data.questions;
            }
            throw new Error('无效的题目数据格式');
        } catch (error) {
            console.error('导入题目数据失败:', error);
            return [];
        }
    }

    // 🔥 新增：获取题目类型统计
    static getQuestionTypeStats(questions) {
        const stats = {};
        questions.forEach(q => {
            if (!stats[q.type]) {
                stats[q.type] = 0;
            }
            stats[q.type]++;
        });
        return stats;
    }

    // 🔥 新增：难度分析
    static analyzeDifficulty(questions) {
        const difficultyStats = {
            easy: 0,
            medium: 0,
            hard: 0
        };

        questions.forEach(q => {
            if (q.difficulty && difficultyStats.hasOwnProperty(q.difficulty)) {
                difficultyStats[q.difficulty]++;
            }
        });

        return difficultyStats;
    }
}

// 导出增强的QuestionManager
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuestionManager;
}

// 浏览器环境下的全局导出
if (typeof window !== 'undefined') {
    window.QuestionManager = QuestionManager;
}