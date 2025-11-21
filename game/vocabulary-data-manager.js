// game/vocabulary-data-manager.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class VocabularyDataManager {
    constructor() {
        this.dbPath = path.join(__dirname, '../moyu_zhixue.db');
        this.db = new sqlite3.Database(this.dbPath);
        this.initVocabularyTables();
    }

    // 初始化词汇相关表
    initVocabularyTables() {
        this.db.serialize(() => {
            // 词汇主表
            this.db.run(`CREATE TABLE IF NOT EXISTS vocabulary_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL UNIQUE,
                phonetic TEXT,
                definition TEXT NOT NULL,
                part_of_speech TEXT,
                level TEXT DEFAULT 'CET-4',
                example_sentence TEXT,
                synonyms TEXT,
                antonyms TEXT,
                word_family TEXT,
                frequency_band INTEGER DEFAULT 1,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // 词汇分类表
            this.db.run(`CREATE TABLE IF NOT EXISTS vocabulary_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word_id INTEGER,
                category TEXT,
                subcategory TEXT,
                FOREIGN KEY (word_id) REFERENCES vocabulary_words (id)
            )`);

            // 用户学习记录表
            this.db.run(`CREATE TABLE IF NOT EXISTS vocabulary_learning (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word_id INTEGER,
                user_id INTEGER DEFAULT 0,
                mastery_level INTEGER DEFAULT 0,
                review_count INTEGER DEFAULT 0,
                last_reviewed DATETIME,
                next_review DATETIME,
                FOREIGN KEY (word_id) REFERENCES vocabulary_words (id)
            )`);

            console.log('✅ 词汇数据表初始化完成');
        });
    }

    // 导入词汇JSON数据 - 修复导入逻辑
    async importVocabularyData(jsonFile, options = {}) {
        return new Promise((resolve, reject) => {
            // 修复：直接处理文件内容，而不是从文件读取
            let jsonData;
            try {
                if (typeof jsonFile === 'string' && fs.existsSync(jsonFile)) {
                    // 从文件路径读取
                    const data = fs.readFileSync(jsonFile, 'utf8');
                    if (!data || data.trim().length === 0) {
                        resolve({ 
                            success: false, 
                            message: 'JSON文件为空',
                            skipped: true
                        });
                        return;
                    }
                    jsonData = JSON.parse(data);
                } else if (typeof jsonFile === 'object') {
                    // 直接使用对象
                    jsonData = jsonFile;
                } else if (typeof jsonFile === 'string') {
                    // 尝试解析JSON字符串
                    jsonData = JSON.parse(jsonFile);
                } else {
                    reject(new Error('不支持的JSON文件格式'));
                    return;
                }
            } catch (parseError) {
                console.error('❌ JSON解析错误:', parseError.message);
                resolve({ 
                    success: false, 
                    message: `JSON解析失败: ${parseError.message}`,
                    skipped: true
                });
                return;
            }

            // 处理词汇数据
            this.processVocabularyData(jsonData, options)
                .then(result => resolve(result))
                .catch(error => reject(error));
        });
    }

    // 处理词汇数据 - 修复：添加options参数
    async processVocabularyData(data, options = {}) {
        try {
            let words = [];
            
            // 检测数据格式
            if (data.vocabulary && Array.isArray(data.vocabulary)) {
                words = data.vocabulary;
            } else if (data.words && Array.isArray(data.words)) {
                words = data.words;
            } else if (Array.isArray(data)) {
                words = data;
            } else {
                return { 
                    success: false, 
                    message: '无法识别的词汇数据格式' 
                };
            }

            console.log(`📝 开始处理 ${words.length} 个词汇...`);

            let importedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;

            for (const wordData of words) {
                try {
                    // 验证词汇数据
                    if (!this.validateWordData(wordData)) {
                        console.warn(`⚠️ 跳过无效词汇数据:`, wordData);
                        skippedCount++;
                        continue;
                    }

                    // 检查重复词汇
                    const existingWord = await this.findExistingWord(wordData.word);
                    if (existingWord) {
                        if (options.mode === 'skip') {
                            console.log(`⏭️ 跳过重复词汇: ${wordData.word}`);
                            skippedCount++;
                            continue;
                        } else if (options.mode === 'update') {
                            console.log(`🔄 更新词汇: ${wordData.word}`);
                            await this.updateWord(existingWord.id, wordData);
                            importedCount++;
                        } else {
                            // 默认模式：跳过重复
                            console.log(`⏭️ 跳过重复词汇: ${wordData.word}`);
                            skippedCount++;
                        }
                    } else {
                        console.log(`✅ 导入新词汇: ${wordData.word}`);
                        await this.insertWord(wordData);
                        importedCount++;
                    }
                    
                } catch (error) {
                    console.error(`❌ 处理词汇 "${wordData.word}" 失败:`, error.message);
                    errorCount++;
                }
            }

            return {
                success: true,
                message: `词汇导入完成: 成功 ${importedCount}, 跳过 ${skippedCount}, 错误 ${errorCount}`,
                data: {
                    imported: importedCount,
                    skipped: skippedCount,
                    errors: errorCount
                }
            };

        } catch (error) {
            throw new Error(`处理词汇数据失败: ${error.message}`);
        }
    }

    // 验证词汇数据
    validateWordData(wordData) {
        if (!wordData.word || !wordData.definition) {
            console.warn('❌ 词汇数据缺少必要字段:', { 
                word: wordData.word, 
                definition: wordData.definition 
            });
            return false;
        }
        
        // 基本验证
        if (typeof wordData.word !== 'string' || wordData.word.trim().length === 0) {
            console.warn('❌ 词汇格式无效:', wordData.word);
            return false;
        }
        
        if (typeof wordData.definition !== 'string' || wordData.definition.trim().length === 0) {
            console.warn('❌ 定义格式无效:', wordData.definition);
            return false;
        }
        
        return true;
    }

    // 查找现有词汇
    async findExistingWord(word) {
        return new Promise((resolve, reject) => {
            this.db.get(
                "SELECT id FROM vocabulary_words WHERE word = ? AND is_active = 1",
                [word],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // 插入新词汇 - 修复：添加错误处理
    async insertWord(wordData) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO vocabulary_words 
                (word, phonetic, definition, part_of_speech, level, example_sentence, synonyms, antonyms, word_family, frequency_band)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run([
                wordData.word,
                wordData.phonetic || '',
                wordData.definition,
                wordData.part_of_speech || '',
                wordData.level || 'CET-4',
                wordData.example_sentence || '',
                wordData.synonyms ? JSON.stringify(wordData.synonyms) : '[]',
                wordData.antonyms ? JSON.stringify(wordData.antonyms) : '[]',
                wordData.word_family ? JSON.stringify(wordData.word_family) : '[]',
                wordData.frequency_band || 1
            ], function(err) {
                if (err) {
                    console.error(`❌ 插入词汇失败 "${wordData.word}":`, err);
                    reject(err);
                } else {
                    const wordId = this.lastID;
                    
                    // 插入分类信息
                    if (wordData.categories && Array.isArray(wordData.categories)) {
                        this.insertCategories(wordId, wordData.categories).catch(catErr => {
                            console.warn(`⚠️ 插入分类信息失败: ${catErr.message}`);
                        });
                    }
                    
                    resolve(wordId);
                }
            });
            
            stmt.finalize();
        });
    }

    // 插入分类信息 - 修复：添加错误处理
    async insertCategories(wordId, categories) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO vocabulary_categories (word_id, category, subcategory)
                VALUES (?, ?, ?)
            `);
            
            let completed = 0;
            const total = categories.length;
            
            if (total === 0) {
                resolve();
                return;
            }
            
            for (const category of categories) {
                stmt.run([
                    wordId,
                    category.category || '',
                    category.subcategory || ''
                ], function(err) {
                    if (err) {
                        console.error('❌ 插入分类失败:', err);
                    }
                    
                    completed++;
                    if (completed === total) {
                        stmt.finalize();
                        resolve();
                    }
                });
            }
        });
    }

    // 更新词汇
    async updateWord(wordId, wordData) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                UPDATE vocabulary_words 
                SET phonetic = ?, definition = ?, part_of_speech = ?, level = ?, 
                    example_sentence = ?, synonyms = ?, antonyms = ?, word_family = ?, 
                    frequency_band = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            
            stmt.run([
                wordData.phonetic || '',
                wordData.definition,
                wordData.part_of_speech || '',
                wordData.level || 'CET-4',
                wordData.example_sentence || '',
                wordData.synonyms ? JSON.stringify(wordData.synonyms) : '[]',
                wordData.antonyms ? JSON.stringify(wordData.antonyms) : '[]',
                wordData.word_family ? JSON.stringify(wordData.word_family) : '[]',
                wordData.frequency_band || 1,
                wordId
            ], function(err) {
                if (err) {
                    console.error(`❌ 更新词汇失败 ID ${wordId}:`, err);
                    reject(err);
                } else {
                    console.log(`✅ 词汇更新成功 ID ${wordId}`);
                    resolve();
                }
            });
            
            stmt.finalize();
        });
    }

    // 导出词汇数据
    async exportVocabularyData(outputFile) {
        return new Promise((resolve, reject) => {
            const exportData = {
                vocabulary: [],
                export_time: new Date().toISOString(),
                version: '1.0'
            };

            this.db.all(`
                SELECT v.*, 
                       GROUP_CONCAT(DISTINCT c.category) as categories,
                       GROUP_CONCAT(DISTINCT c.subcategory) as subcategories
                FROM vocabulary_words v
                LEFT JOIN vocabulary_categories c ON v.id = c.word_id
                WHERE v.is_active = 1
                GROUP BY v.id
                ORDER BY v.word
            `, (err, words) => {
                if (err) {
                    reject(err);
                    return;
                }

                words.forEach(word => {
                    const wordData = {
                        word: word.word,
                        phonetic: word.phonetic,
                        definition: word.definition,
                        part_of_speech: word.part_of_speech,
                        level: word.level,
                        example_sentence: word.example_sentence,
                        synonyms: word.synonyms ? JSON.parse(word.synonyms) : [],
                        antonyms: word.antonyms ? JSON.parse(word.antonyms) : [],
                        word_family: word.word_family ? JSON.parse(word.word_family) : [],
                        frequency_band: word.frequency_band,
                        categories: []
                    };

                    // 处理分类信息
                    if (word.categories) {
                        const categories = word.categories.split(',');
                        const subcategories = word.subcategories ? word.subcategories.split(',') : [];
                        
                        categories.forEach((category, index) => {
                            if (category) {
                                wordData.categories.push({
                                    category: category,
                                    subcategory: subcategories[index] || ''
                                });
                            }
                        });
                    }

                    exportData.vocabulary.push(wordData);
                });

                fs.writeFile(outputFile, JSON.stringify(exportData, null, 2), (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ 
                            success: true, 
                            message: `导出完成，共${exportData.vocabulary.length}个词汇`,
                            file: outputFile 
                        });
                    }
                });
            });
        });
    }

    // 获取词汇统计
    async getStatistics() {
        return new Promise((resolve, reject) => {
            const queries = {
                total_words: "SELECT COUNT(*) as count FROM vocabulary_words WHERE is_active = 1",
                words_by_level: "SELECT level, COUNT(*) as count FROM vocabulary_words WHERE is_active = 1 GROUP BY level",
                words_by_part_of_speech: "SELECT part_of_speech, COUNT(*) as count FROM vocabulary_words WHERE is_active = 1 GROUP BY part_of_speech",
                words_by_frequency: "SELECT frequency_band, COUNT(*) as count FROM vocabulary_words WHERE is_active = 1 GROUP BY frequency_band"
            };

            const results = {};
            let completed = 0;
            const totalQueries = Object.keys(queries).length;

            Object.entries(queries).forEach(([key, query]) => {
                this.db.all(query, (err, rows) => {
                    if (err) {
                        console.error(`查询${key}失败:`, err);
                        results[key] = { error: err.message };
                    } else {
                        results[key] = rows;
                    }

                    completed++;
                    if (completed === totalQueries) {
                        resolve(results);
                    }
                });
            });
        });
    }

    // 清理词汇数据
    async cleanupData() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run("DELETE FROM vocabulary_categories", (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    this.db.run("DELETE FROM vocabulary_learning", (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        this.db.run("DELETE FROM vocabulary_words", (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve({ success: true, message: '词汇数据清理完成' });
                            }
                        });
                    });
                });
            });
        });
    }

    // 根据难度获取随机词汇
    async getRandomWords(level = 'CET-4', count = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT * FROM vocabulary_words 
                WHERE level = ? AND is_active = 1 
                ORDER BY RANDOM() 
                LIMIT ?
            `, [level, count], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // 解析JSON字段
                    const words = rows.map(word => ({
                        ...word,
                        synonyms: word.synonyms ? JSON.parse(word.synonyms) : [],
                        antonyms: word.antonyms ? JSON.parse(word.antonyms) : [],
                        word_family: word.word_family ? JSON.parse(word.word_family) : []
                    }));
                    resolve(words);
                }
            });
        });
    }

    // 新增：获取所有词汇
    async getAllWords(limit = 100) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT * FROM vocabulary_words 
                WHERE is_active = 1 
                ORDER BY word 
                LIMIT ?
            `, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const words = rows.map(word => ({
                        ...word,
                        synonyms: word.synonyms ? JSON.parse(word.synonyms) : [],
                        antonyms: word.antonyms ? JSON.parse(word.antonyms) : [],
                        word_family: word.word_family ? JSON.parse(word.word_family) : []
                    }));
                    resolve(words);
                }
            });
        });
    }
}

module.exports = VocabularyDataManager;