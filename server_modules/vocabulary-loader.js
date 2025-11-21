// [file name]: server_modules/vocabulary-loader.js
const fs = require('fs');
const path = require('path');

class VocabularyLoader {
    constructor() {
        this.cet4Data = null;
        this.cet6Data = null;
        this.loaded = false;
    }

    // 加载词汇数据
    loadVocabularyData() {
        try {
            // 加载四级词汇
            const cet4Path = path.join(__dirname, '../../大学英语四级词汇.js');
            if (fs.existsSync(cet4Path)) {
                delete require.cache[require.resolve(cet4Path)];
                this.cet4Data = require(cet4Path);
                console.log(`✅ 四级词汇加载成功: ${this.cet4Data.length} 个单词`);
            } else {
                console.log('❌ 四级词汇文件不存在');
                this.cet4Data = [];
            }

            // 加载六级词汇
            const cet6Path = path.join(__dirname, '../../大学英语六级词汇乱序版.js');
            if (fs.existsSync(cet6Path)) {
                delete require.cache[require.resolve(cet6Path)];
                this.cet6Data = require(cet6Path);
                console.log(`✅ 六级词汇加载成功: ${this.cet6Data.length} 个单词`);
            } else {
                console.log('❌ 六级词汇文件不存在');
                this.cet6Data = [];
            }

            this.loaded = true;
            return {
                success: true,
                cet4: this.cet4Data.length,
                cet6: this.cet6Data.length
            };
        } catch (error) {
            console.error('❌ 加载词汇数据失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 获取词汇数据
    getVocabulary(level, options = {}) {
        if (!this.loaded) {
            this.loadVocabularyData();
        }

        let sourceData = [];
        switch (level.toUpperCase()) {
            case 'CET4':
                sourceData = this.cet4Data || [];
                break;
            case 'CET6':
                sourceData = this.cet6Data || [];
                break;
            default:
                sourceData = [...(this.cet4Data || []), ...(this.cet6Data || [])];
        }

        // 应用过滤选项
        let filteredData = this.filterVocabulary(sourceData, options);

        return filteredData;
    }

    // 过滤词汇数据
    filterVocabulary(data, options) {
        let result = [...data];

        // 按难度过滤
        if (options.difficulty) {
            result = result.filter(word => 
                word.difficulty_level === options.difficulty
            );
        }

        // 按字母范围过滤
        if (options.letterRange) {
            result = result.filter(word => {
                const firstLetter = word.word.charAt(0).toLowerCase();
                return options.letterRange.includes(firstLetter);
            });
        }

        // 搜索关键词
        if (options.search) {
            const searchTerm = options.search.toLowerCase();
            result = result.filter(word => 
                word.word.toLowerCase().includes(searchTerm) ||
                word.meaning.toLowerCase().includes(searchTerm)
            );
        }

        // 限制数量
        if (options.limit && options.limit > 0) {
            result = result.slice(0, options.limit);
        }

        // 随机排序
        if (options.randomize) {
            result = this.shuffleArray(result);
        }

        return result;
    }

    // 数组随机排序
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // 获取词汇统计
    getVocabularyStats() {
        if (!this.loaded) {
            this.loadVocabularyData();
        }

        return {
            cet4: {
                total: this.cet4Data ? this.cet4Data.length : 0,
                byDifficulty: this.getDifficultyStats(this.cet4Data)
            },
            cet6: {
                total: this.cet6Data ? this.cet6Data.length : 0,
                byDifficulty: this.getDifficultyStats(this.cet6Data)
            }
        };
    }

    // 获取难度统计
    getDifficultyStats(data) {
        if (!data) return {};
        
        const stats = { 1: 0, 2: 0, 3: 0, 4: 0 };
        data.forEach(word => {
            const level = word.difficulty_level || 1;
            stats[level] = (stats[level] || 0) + 1;
        });
        return stats;
    }

    // 重新加载词汇数据
    reload() {
        this.loaded = false;
        return this.loadVocabularyData();
    }
}

// 创建全局实例
const vocabularyLoader = new VocabularyLoader();

// 初始加载
vocabularyLoader.loadVocabularyData();

module.exports = vocabularyLoader;