const sqlite3 = require('sqlite3').verbose();
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// 数据库路径
const dbPath = path.join(__dirname, 'moyu_zhixue.db');
const db = new sqlite3.Database(dbPath);

// 文件路径 - 请确保文件名完全匹配
const CET6_FILE = '大学英语六级词汇乱序版.xlsx';
const CET4_FILE = '大学英语四级词汇.xlsx';

class ManualVocabularyImporter {
    constructor() {
        this.stats = {
            cet4: { total: 0, imported: 0, errors: 0 },
            cet6: { total: 0, imported: 0, errors: 0 }
        };
    }

    // 检查文件是否存在
    checkFiles() {
        const filesExist = {
            cet4: fs.existsSync(path.join(__dirname, CET4_FILE)),
            cet6: fs.existsSync(path.join(__dirname, CET6_FILE))
        };
        
        console.log('文件检查结果:');
        console.log(`- 四级文件: ${filesExist.cet4 ? '存在' : '不存在'}`);
        console.log(`- 六级文件: ${filesExist.cet6 ? '存在' : '不存在'}`);
        
        return filesExist;
    }

    // 解析Excel文件
    parseExcelFile(filePath, level) {
        try {
            console.log(`开始解析 ${level} 文件: ${filePath}`);
            
            if (!fs.existsSync(filePath)) {
                console.error(`文件不存在: ${filePath}`);
                return [];
            }

            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // 转换为JSON，保留所有行
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            console.log(`读取到 ${data.length} 行数据`);
            
            const vocabulary = [];
            
            // 跳过表头，从第1行开始
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (row && row.length > 0) {
                    const wordEntries = this.parseRow(row, level, i);
                    if (wordEntries) {
                        // 可能是单个条目或多个条目的数组
                        if (Array.isArray(wordEntries)) {
                            vocabulary.push(...wordEntries);
                        } else {
                            vocabulary.push(wordEntries);
                        }
                    }
                }
            }
            
            console.log(`成功解析 ${vocabulary.length} 个词汇`);
            return vocabulary;
            
        } catch (error) {
            console.error(`解析文件失败 ${filePath}:`, error);
            return [];
        }
    }

    // 解析单行数据 - 处理双列格式
    parseRow(row, level, rowIndex) {
        try {
            console.log(`解析第${rowIndex + 1}行:`, row);
            
            const vocabularyEntries = [];
            const cleanRow = row.map(cell => cell ? cell.toString().trim() : '');
            
            // 处理A列词汇（索引0）
            if (cleanRow[0] && cleanRow[0].trim()) {
                const entryA = this.parseSingleEntry(cleanRow[0], level);
                if (entryA) {
                    vocabularyEntries.push(entryA);
                }
            }
            
            // 处理C列词汇（索引2）
            if (cleanRow[2] && cleanRow[2].trim()) {
                const entryC = this.parseSingleEntry(cleanRow[2], level);
                if (entryC) {
                    vocabularyEntries.push(entryC);
                }
            }
            
            console.log(`第${rowIndex + 1}行解析出 ${vocabularyEntries.length} 个词汇条目`);
            return vocabularyEntries.length > 0 ? vocabularyEntries : null;
            
        } catch (error) {
            console.error(`解析第${rowIndex + 1}行失败:`, error, row);
            return null;
        }
    }

    // 解析单个词汇条目
    parseSingleEntry(entryText, level) {
        try {
            if (!entryText || entryText.trim() === '') {
                return null;
            }
            
            console.log('解析单个条目:', entryText);
            
            // 分割单词和释义（假设格式为 "单词 词性.释义" 或 "单词 释义"）
            const parts = entryText.split(/\s+/);
            if (parts.length < 2) {
                console.warn('条目格式不正确:', entryText);
                return null;
            }
            
            let word = '';
            let part_of_speech = '';
            let meaning = '';
            
            // 尝试提取词性（如 n. v. adj. adv. 等）
            const posMatch = entryText.match(/(\w+)\s+([nva]\.|adj\.|adv\.|prep\.|conj\.|名词|动词|形容词|副词)\s*(.+)/);
            
            if (posMatch) {
                // 格式：单词 词性 释义
                word = this.cleanWord(posMatch[1]);
                part_of_speech = posMatch[2];
                meaning = posMatch[3];
            } else {
                // 格式：单词 释义（无明确词性）
                word = this.cleanWord(parts[0]);
                meaning = parts.slice(1).join(' ');
                part_of_speech = this.guessPartOfSpeech(meaning);
            }
            
            // 验证必需字段
            if (!word || !meaning) {
                console.warn('词汇数据不完整:', { word, meaning, entryText });
                return null;
            }
            
            // 生成例句
            const example_sentence = this.generateExampleSentence(word, meaning);
            
            const wordEntry = {
                word: word.toLowerCase().trim(),
                meaning: meaning.trim(),
                pronunciation: '', // 双列格式通常没有音标
                example_sentence: example_sentence,
                level: level,
                difficulty_level: this.calculateDifficulty(word),
                frequency: 1,
                part_of_speech: part_of_speech || ''
            };

            console.log(`解析成功: ${wordEntry.word} - ${wordEntry.meaning}`);
            return wordEntry;
            
        } catch (error) {
            console.error('解析单个条目失败:', entryText, error);
            return null;
        }
    }

    cleanWord(word) {
        if (!word) return '';
        
        let cleaned = word.toString().trim();
        
        // 移除多余的空格和特殊字符，但保留连字符和撇号
        cleaned = cleaned.replace(/[^a-zA-Z\-'\s]/g, '');
        
        // 提取第一个单词（处理 "rapture n." 这种情况）
        const firstWord = cleaned.split(/\s+/)[0];
        
        return firstWord || cleaned;
    }

    // 增强的词性猜测方法
    guessPartOfSpeech(meaning) {
        const meaningStr = meaning.toString().toLowerCase();
        
        if (meaningStr.includes('v.') || meaningStr.includes('动词') || meaningStr.includes('作') || meaningStr.includes('做')) {
            return 'v.';
        }
        if (meaningStr.includes('n.') || meaningStr.includes('名词') || meaningStr.includes('者') || meaningStr.includes('物') || meaningStr.includes('人')) {
            return 'n.';
        }
        if (meaningStr.includes('adj.') || meaningStr.includes('形容词') || meaningStr.includes('的') || meaningStr.includes('状')) {
            return 'adj.';
        }
        if (meaningStr.includes('adv.') || meaningStr.includes('副词') || meaningStr.includes('地')) {
            return 'adv.';
        }
        if (meaningStr.includes('prep.') || meaningStr.includes('介词')) {
            return 'prep.';
        }
        if (meaningStr.includes('conj.') || meaningStr.includes('连词')) {
            return 'conj.';
        }
        if (meaningStr.includes('pron.') || meaningStr.includes('代词')) {
            return 'pron.';
        }
        
        return '';
    }

    generateExampleSentence(word, meaning) {
        // 简单的例句生成逻辑
        const sentences = {
            'abandon': `They had to abandon their car in the snow.`,
            'ability': `She has the ability to speak three languages fluently.`,
            'abnormal': `The test results showed abnormal levels.`,
            'resilient': `Children are often very resilient and quick to recover from illness.`,
            'perpetual': `They lived in perpetual fear of being discovered.`,
            'arbitrary': `The decision seemed completely arbitrary.`,
            'eloquent': `She made an eloquent appeal for action before it was too late.`,
            'pragmatic': `We need to take a more pragmatic approach to the problem.`,
            'ambiguous': `His answer was carefully ambiguous.`,
            'volatile': `The situation in the region is highly volatile.`
        };
        return sentences[word.toLowerCase()] || `This is an example sentence for "${word}".`;
    }

    calculateDifficulty(word) {
        const length = word.length;
        if (length <= 4) return 1;
        if (length <= 7) return 2;
        if (length <= 10) return 3;
        return 4;
    }

    // 导入到数据库
    async importToDatabase(vocabulary, level) {
        return new Promise((resolve, reject) => {
            let imported = 0;
            let errors = 0;
            let processed = 0;

            // 展平词汇数组（处理可能的多维数组）
            const flatVocabulary = vocabulary.flat();
            const total = flatVocabulary.length;
            this.stats[level.toLowerCase()].total = total;

            console.log(`开始导入 ${level} 词汇，共 ${total} 个条目`);

            if (total === 0) {
                resolve({ imported: 0, errors: 0, total: 0 });
                return;
            }

            flatVocabulary.forEach((word, index) => {
                // 跳过无效条目
                if (!word || typeof word !== 'object') {
                    processed++;
                    if (processed === total) {
                        resolve({ imported, errors, total });
                    }
                    return;
                }

                const query = `
                    INSERT OR IGNORE INTO base_vocabulary 
                    (word, meaning, pronunciation, example_sentence, level, difficulty_level, frequency, part_of_speech)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;

                db.run(query, [
                    word.word,
                    word.meaning,
                    word.pronunciation,
                    word.example_sentence,
                    word.level,
                    word.difficulty_level,
                    word.frequency,
                    word.part_of_speech
                ], function(err) {
                    processed++;
                    
                    if (err) {
                        console.error(`导入词汇失败 ${word.word}:`, err);
                        errors++;
                    } else {
                        if (this.changes > 0) {
                            imported++;
                            if (imported % 100 === 0) {
                                console.log(`已导入 ${imported}/${total} 个${level}词汇`);
                            }
                        }
                    }

                    if (processed === total) {
                        this.stats[level.toLowerCase()].imported = imported;
                        this.stats[level.toLowerCase()].errors = errors;
                        console.log(`${level}词汇导入完成: 成功 ${imported}, 失败 ${errors}, 总数 ${total}`);
                        resolve({ imported, errors, total });
                    }
                }.bind(this));
            });
        });
    }

    // 显示统计信息
    showStats() {
        console.log('\n=== 导入统计 ===');
        console.log('四级词汇:');
        console.log(`  总数: ${this.stats.cet4.total}`);
        console.log(`  成功: ${this.stats.cet4.imported}`);
        console.log(`  失败: ${this.stats.cet4.errors}`);
        
        console.log('六级词汇:');
        console.log(`  总数: ${this.stats.cet6.total}`);
        console.log(`  成功: ${this.stats.cet6.imported}`);
        console.log(`  失败: ${this.stats.cet6.errors}`);
        
        const totalImported = this.stats.cet4.imported + this.stats.cet6.imported;
        console.log(`\n总计导入: ${totalImported} 个词汇`);
    }

    // 检查数据库表是否存在
    checkDatabaseTable() {
        return new Promise((resolve, reject) => {
            db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='base_vocabulary'`, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(!!row);
                }
            });
        });
    }

    // 创建数据库表（如果不存在）
    createDatabaseTable() {
        return new Promise((resolve, reject) => {
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS base_vocabulary (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    word VARCHAR(100) NOT NULL,
                    meaning TEXT NOT NULL,
                    pronunciation VARCHAR(100),
                    example_sentence TEXT,
                    level VARCHAR(10) NOT NULL,
                    difficulty_level INTEGER DEFAULT 1,
                    frequency INTEGER DEFAULT 0,
                    part_of_speech VARCHAR(20),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(word, level)
                )
            `;

            db.run(createTableQuery, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('数据库表已就绪');
                    resolve();
                }
            });
        });
    }

    // 主导入函数
    async importAll() {
        console.log('开始手动导入词汇库...\n');
        
        try {
            // 检查并创建数据库表
            const tableExists = await this.checkDatabaseTable();
            if (!tableExists) {
                console.log('创建数据库表...');
                await this.createDatabaseTable();
            } else {
                console.log('数据库表已存在');
            }

            // 检查文件
            const filesExist = this.checkFiles();
            if (!filesExist.cet4 && !filesExist.cet6) {
                console.error('没有找到任何词汇文件，请检查文件是否存在');
                return;
            }

            // 导入四级词汇
            if (filesExist.cet4) {
                console.log('\n开始导入四级词汇...');
                const cet4Vocabulary = this.parseExcelFile(path.join(__dirname, CET4_FILE), 'CET4');
                if (cet4Vocabulary.length > 0) {
                    await this.importToDatabase(cet4Vocabulary, 'CET4');
                } else {
                    console.log('四级词汇解析结果为空，跳过导入');
                }
            }

            // 导入六级词汇
            if (filesExist.cet6) {
                console.log('\n开始导入六级词汇...');
                const cet6Vocabulary = this.parseExcelFile(path.join(__dirname, CET6_FILE), 'CET6');
                if (cet6Vocabulary.length > 0) {
                    await this.importToDatabase(cet6Vocabulary, 'CET6');
                } else {
                    console.log('六级词汇解析结果为空，跳过导入');
                }
            }

            // 显示统计
            this.showStats();
            
        } catch (error) {
            console.error('导入过程出错:', error);
        } finally {
            db.close();
        }
    }
}

// 运行导入
const importer = new ManualVocabularyImporter();
importer.importAll().then(() => {
    console.log('\n导入过程完成');
    process.exit(0);
}).catch(error => {
    console.error('导入失败:', error);
    process.exit(1);
});