// game/enhanced-question-manager.js
const VocabularyDataManager = require('./vocabulary-data-manager');

class EnhancedQuestionManager {
    constructor() {
        this.vocabularyManager = new VocabularyDataManager();
    }

    // 基于词汇库生成题目 - 强制只使用词汇库
    async generateVocabularyQuestion(difficulty = 'medium', type = 'auto') {
        try {
            // 根据难度确定词汇级别
            const level = this.mapDifficultyToLevel(difficulty);
            
            // 获取随机词汇
            const words = await this.vocabularyManager.getRandomWords(level, 4);
            if (!words || words.length < 4) {
                throw new Error('词汇库中没有足够的词汇，请先导入词汇数据');
            }

            const targetWord = words[0];
            const otherWords = words.slice(1);

            // 自动选择题目类型或使用指定类型
            const questionType = type === 'auto' ? 
                this.autoSelectQuestionType(targetWord) : type;

            switch (questionType) {
                case 'definition':
                    return this.generateDefinitionQuestion(targetWord, otherWords);
                case 'synonym':
                    return this.generateSynonymQuestion(targetWord, otherWords);
                case 'antonym':
                    return this.generateAntonymQuestion(targetWord, otherWords);
                case 'fill_blank':
                    return this.generateFillBlankQuestion(targetWord, otherWords);
                case 'spelling':
                    return this.generateSpellingQuestion(targetWord, otherWords);
                default:
                    return this.generateDefinitionQuestion(targetWord, otherWords);
            }

        } catch (error) {
            console.error('从词汇库生成题目失败:', error);
            throw error; // 不再回退到标准题目
        }
    }

    // 根据难度映射词汇级别
    mapDifficultyToLevel(difficulty) {
        const levelMap = {
            'easy': 'CET-4',
            'medium': 'CET-4',
            'hard': 'CET-6'
        };
        return levelMap[difficulty] || 'CET-4';
    }

    // 自动选择题目类型
    autoSelectQuestionType(word) {
        const types = ['definition', 'fill_blank'];
        
        // 如果有同义词，增加同义词题型的概率
        if (word.synonyms && word.synonyms.length > 0) {
            types.push('synonym', 'synonym');
        }
        
        // 如果有反义词，增加反义词题型的概率
        if (word.antonyms && word.antonyms.length > 0) {
            types.push('antonym');
        }
        
        // 随机选择类型
        return types[Math.floor(Math.random() * types.length)];
    }

    // 生成词义选择题
    generateDefinitionQuestion(targetWord, otherWords) {
        const options = [
            { text: targetWord.definition, correct: true },
            ...otherWords.map(word => ({ text: word.definition, correct: false }))
        ];

        // 随机排序选项
        this.shuffleArray(options);

        return {
            type: 'vocabulary_definition',
            text: `"${targetWord.word}" 的意思是什么？`,
            word: targetWord.word,
            phonetic: targetWord.phonetic,
            options: options.map(opt => opt.text),
            correctAnswer: targetWord.definition,
            difficulty: this.mapLevelToDifficulty(targetWord.level),
            metadata: {
                wordId: targetWord.id,
                partOfSpeech: targetWord.part_of_speech,
                example: targetWord.example_sentence
            }
        };
    }

    // 生成同义词选择题
    generateSynonymQuestion(targetWord, otherWords) {
        if (!targetWord.synonyms || targetWord.synonyms.length === 0) {
            return this.generateDefinitionQuestion(targetWord, otherWords);
        }

        const synonyms = targetWord.synonyms;
        const correctSynonym = synonyms[Math.floor(Math.random() * synonyms.length)];

        const options = [
            { text: correctSynonym, correct: true },
            ...otherWords.map(word => ({ 
                text: word.word, 
                correct: false 
            }))
        ];

        this.shuffleArray(options);

        return {
            type: 'vocabulary_synonym',
            text: `"${targetWord.word}" 的同义词是？`,
            word: targetWord.word,
            options: options.map(opt => opt.text),
            correctAnswer: correctSynonym,
            difficulty: this.mapLevelToDifficulty(targetWord.level),
            metadata: {
                wordId: targetWord.id,
                definition: targetWord.definition
            }
        };
    }

    // 生成反义词选择题
    generateAntonymQuestion(targetWord, otherWords) {
        if (!targetWord.antonyms || targetWord.antonyms.length === 0) {
            return this.generateDefinitionQuestion(targetWord, otherWords);
        }

        const antonyms = targetWord.antonyms;
        const correctAntonym = antonyms[Math.floor(Math.random() * antonyms.length)];

        const options = [
            { text: correctAntonym, correct: true },
            ...otherWords.map(word => ({ 
                text: word.word, 
                correct: false 
            }))
        ];

        this.shuffleArray(options);

        return {
            type: 'vocabulary_antonym',
            text: `"${targetWord.word}" 的反义词是？`,
            word: targetWord.word,
            options: options.map(opt => opt.text),
            correctAnswer: correctAntonym,
            difficulty: this.mapLevelToDifficulty(targetWord.level),
            metadata: {
                wordId: targetWord.id,
                definition: targetWord.definition
            }
        };
    }

    // 生成填空题
    generateFillBlankQuestion(targetWord, otherWords) {
        if (!targetWord.example_sentence) {
            return this.generateDefinitionQuestion(targetWord, otherWords);
        }

        // 从例句中挖空目标单词
        const sentence = targetWord.example_sentence;
        const blankSentence = sentence.replace(
            new RegExp(targetWord.word, 'gi'), 
            '_______'
        );

        const options = [
            { text: targetWord.word, correct: true },
            ...otherWords.map(word => ({ text: word.word, correct: false }))
        ];

        this.shuffleArray(options);

        return {
            type: 'vocabulary_fill_blank',
            text: `选择正确的单词完成句子：\n"${blankSentence}"`,
            sentence: blankSentence,
            options: options.map(opt => opt.text),
            correctAnswer: targetWord.word,
            difficulty: this.mapLevelToDifficulty(targetWord.level),
            metadata: {
                wordId: targetWord.id,
                definition: targetWord.definition,
                originalSentence: sentence
            }
        };
    }

    // 生成拼写题
    generateSpellingQuestion(targetWord, otherWords) {
        // 生成常见的拼写错误
        const wrongSpellings = this.generateWrongSpellings(targetWord.word);
        
        const options = [
            { text: targetWord.word, correct: true },
            ...wrongSpellings.map(spelling => ({ text: spelling, correct: false }))
        ];

        this.shuffleArray(options);

        return {
            type: 'vocabulary_spelling',
            text: `选择正确的单词拼写：`,
            word: targetWord.word,
            options: options.map(opt => opt.text),
            correctAnswer: targetWord.word,
            difficulty: this.mapLevelToDifficulty(targetWord.level),
            metadata: {
                wordId: targetWord.id,
                definition: targetWord.definition
            }
        };
    }

    // 生成常见的拼写错误
    generateWrongSpellings(word) {
        const wrongSpellings = [];
        
        // 双写错误
        if (word.match(/([aeiou])([^aeiou])/)) {
            wrongSpellings.push(word.replace(/([aeiou])([^aeiou])/, '$1$1$2'));
        }
        
        // 少写字母
        if (word.length > 3) {
            wrongSpellings.push(word.slice(0, -1));
        }
        
        // 字母顺序错误
        if (word.length > 4) {
            const chars = word.split('');
            const index = Math.floor(Math.random() * (chars.length - 1));
            [chars[index], chars[index + 1]] = [chars[index + 1], chars[index]];
            wrongSpellings.push(chars.join(''));
        }
        
        return wrongSpellings.slice(0, 3);
    }

    // 工具方法
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    mapLevelToDifficulty(level) {
        const difficultyMap = {
            'CET-4': 'medium',
            'CET-6': 'hard'
        };
        return difficultyMap[level] || 'medium';
    }

    // 验证题目
    validateQuestion(question) {
        if (!question) return false;
        if (!question.options || !Array.isArray(question.options)) return false;
        if (question.options.length < 2) return false;
        if (!question.correctAnswer) return false;
        if (!question.options.includes(question.correctAnswer)) return false;
        return true;
    }

    // 新增：检查词汇库是否为空
    async checkVocabularyEmpty() {
        try {
            const stats = await this.vocabularyManager.getStatistics();
            const totalWords = stats.total_words?.[0]?.count || 0;
            return totalWords === 0;
        } catch (error) {
            console.error('检查词汇库失败:', error);
            return true;
        }
    }

    // 新增：获取词汇库统计
    async getVocabularyStats() {
        try {
            return await this.vocabularyManager.getStatistics();
        } catch (error) {
            console.error('获取词汇库统计失败:', error);
            return null;
        }
    }
}

module.exports = EnhancedQuestionManager;