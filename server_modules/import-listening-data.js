// [file name]: import-listening-data.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class SimpleListeningDataImporter {
    constructor() {
        this.dbPath = path.join(__dirname, '../moyu_zhixue.db');
        this.db = new sqlite3.Database(this.dbPath);
        this.audioBasePath = path.join(__dirname, '../真题与听力');
        
        this.stats = {
            filesProcessed: 0,
            filesCreated: 0,
            filesUpdated: 0,
            errors: 0
        };
    }

    // 检查音频文件目录
    checkAudioDirectories() {
        const cet4Path = path.join(this.audioBasePath, '四级听力');
        const cet6Path = path.join(this.audioBasePath, '六级听力');
        
        const exists = {
            cet4: fs.existsSync(cet4Path),
            cet6: fs.existsSync(cet6Path)
        };
        
        console.log('音频目录检查:');
        console.log(`- 四级听力: ${exists.cet4 ? '存在' : '不存在'}`);
        console.log(`- 六级听力: ${exists.cet6 ? '存在' : '不存在'}`);
        
        if (exists.cet4) {
            const cet4Files = fs.readdirSync(cet4Path).filter(f => f.endsWith('.mp3'));
            console.log(`- 四级音频文件: ${cet4Files.length} 个`);
        }
        
        if (exists.cet6) {
            const cet6Files = fs.readdirSync(cet6Path).filter(f => f.endsWith('.mp3'));
            console.log(`- 六级音频文件: ${cet6Files.length} 个`);
        }
        
        return exists;
    }

    // 智能解析文件名 - 修复版
    parseAudioFilename(filename) {
        console.log(`解析文件名: ${filename}`);
        
        // 基础信息
        const info = {
            filename: filename,
            examType: 'CET4', // 默认四级
            year: 2023, // 默认年份
            month: 12, // 默认月份
            audioType: 'full', // 默认完整听力
            title: filename.replace('.mp3', '') // 默认标题为文件名
        };

        // 检测考试类型 - 精确匹配
        const lowerFilename = filename.toLowerCase();
        if (lowerFilename.includes('cet6') || lowerFilename.includes('六级') || lowerFilename.includes('6级')) {
            info.examType = 'CET6';
        } else if (lowerFilename.includes('cet4') || lowerFilename.includes('四级') || lowerFilename.includes('4级')) {
            info.examType = 'CET4';
        }

        // 检测年份和月份 - 精确解析
        const yearMatch = filename.match(/(20\d{2})/);
        if (yearMatch) {
            info.year = parseInt(yearMatch[1]);
        }

        // 精确解析月份
        const monthMatch = filename.match(/(\d)(?:\D|$)/); // 匹配单个数字月份
        if (monthMatch) {
            const month = parseInt(monthMatch[1]);
            if (month === 6 || month === 12) { // 只有6月和12月有考试
                info.month = month;
            }
        }

        // 检测音频类型 - 精确匹配
        if (lowerFilename.includes('short') || lowerFilename.includes('短对话') || lowerFilename.includes('sectiona')) {
            info.audioType = 'short';
        } else if (lowerFilename.includes('long') || lowerFilename.includes('长对话') || lowerFilename.includes('sectionb')) {
            info.audioType = 'long';
        } else if (lowerFilename.includes('lecture') || lowerFilename.includes('讲座') || lowerFilename.includes('sectionc')) {
            info.audioType = 'lecture';
        } else if (lowerFilename.includes('passage') || lowerFilename.includes('短文')) {
            info.audioType = 'passage';
        } else if (lowerFilename.includes('full') || lowerFilename.includes('完整') || lowerFilename.includes('全部')) {
            info.audioType = 'full';
        }

        // 生成友好标题 - 修复版
        info.title = this.generateFriendlyTitle(info);

        console.log(`解析结果:`, info);
        return info;
    }

    // 生成友好标题 - 修复版
    generateFriendlyTitle(info) {
        const examName = info.examType === 'CET4' ? '英语四级' : '英语六级';
        const monthName = info.month === 6 ? '6月' : '12月';
        const typeNames = {
            'short': '短对话听力',
            'long': '长对话听力', 
            'lecture': '讲座听力',
            'passage': '短文听力',
            'full': '完整听力'
        };
        
        const typeName = typeNames[info.audioType] || '听力';
        return `${info.year}年${monthName}${examName}${typeName}`;
    }

    // 修复后的标题生成逻辑 - 针对标准格式文件名
    generateAudioTitle(filename) {
        // 解析标准格式文件名：cet4_2021_06_1.mp3
        const parts = filename.replace('.mp3', '').split('_');
        
        if (parts.length >= 3) {
            const examType = parts[0].toUpperCase(); // CET4/CET6
            const year = parts[1]; // 2021
            const month = parts[2]; // 06
            const part = parts[3] || '1'; // 1,2,3 或默认1
            
            const examName = examType === 'CET4' ? '英语四级' : '英语六级';
            const monthName = month === '06' ? '6月' : '12月';
            const partNames = {
                '1': '完整听力',
                '2': '听力第二部分', 
                '3': '听力第三部分'
            };
            const partName = partNames[part] || '听力';
            
            return `${year}年${monthName}${examName}${partName}`;
        }
        
        // 如果不是标准格式，回退到智能解析
        const info = this.parseAudioFilename(filename);
        return info.title;
    }

    // 创建听力音频表（如果不存在）
    createListeningAudioTable(callback) {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS listening_audio_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                exam_type VARCHAR(10) NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                audio_type VARCHAR(20) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                title VARCHAR(255) NOT NULL,
                file_size INTEGER DEFAULT 0,
                duration INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(exam_type, year, month, audio_type, filename)
            )
        `;
        
        this.db.run(createTableSQL, (err) => {
            if (err) {
                console.error('创建听力音频表失败:', err);
                callback(false);
            } else {
                console.log('听力音频表已就绪');
                callback(true);
            }
        });
    }

    // 检查文件是否已存在
    checkFileExists(fileInfo, callback) {
        const query = `
            SELECT id, filename FROM listening_audio_files 
            WHERE exam_type = ? AND year = ? AND month = ? AND audio_type = ? AND filename = ?
        `;
        
        this.db.get(query, [
            fileInfo.examType, 
            fileInfo.year, 
            fileInfo.month, 
            fileInfo.audioType, 
            fileInfo.filename
        ], (err, row) => {
            if (err) {
                console.error('检查文件存在失败:', err);
                callback(null);
            } else {
                callback(row);
            }
        });
    }

    // 插入或更新音频文件记录
    insertOrUpdateAudioFile(fileInfo, filePath, callback) {
        this.checkFileExists(fileInfo, (existingFile) => {
            if (existingFile) {
                // 更新现有记录
                this.updateAudioFile(existingFile.id, fileInfo, filePath, callback);
            } else {
                // 插入新记录
                this.insertAudioFile(fileInfo, filePath, callback);
            }
        });
    }

    // 插入新音频文件记录
    insertAudioFile(fileInfo, filePath, callback) {
        const insertSQL = `
            INSERT INTO listening_audio_files 
            (exam_type, year, month, audio_type, filename, file_path, title, file_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        // 获取文件大小
        let fileSize = 0;
        try {
            const stats = fs.statSync(filePath);
            fileSize = stats.size;
        } catch (e) {
            console.log(`无法获取文件大小: ${filePath}`);
        }
        
        this.db.run(insertSQL, [
            fileInfo.examType,
            fileInfo.year,
            fileInfo.month,
            fileInfo.audioType,
            fileInfo.filename,
            filePath,
            fileInfo.title,
            fileSize
        ], function(err) {
            if (err) {
                console.error(`插入音频文件记录失败: ${fileInfo.filename}`, err);
                callback(false);
            } else {
                console.log(`✅ 新增音频文件: ${fileInfo.filename} (ID: ${this.lastID})`);
                this.stats.filesCreated++;
                callback(true);
            }
        }.bind(this));
    }

    // 更新音频文件记录
    updateAudioFile(fileId, fileInfo, filePath, callback) {
        const updateSQL = `
            UPDATE listening_audio_files 
            SET title = ?, file_path = ?, file_size = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        // 获取文件大小
        let fileSize = 0;
        try {
            const stats = fs.statSync(filePath);
            fileSize = stats.size;
        } catch (e) {
            console.log(`无法获取文件大小: ${filePath}`);
        }
        
        this.db.run(updateSQL, [
            fileInfo.title,
            filePath,
            fileSize,
            fileId
        ], function(err) {
            if (err) {
                console.error(`更新音频文件记录失败: ${fileInfo.filename}`, err);
                callback(false);
            } else {
                if (this.changes > 0) {
                    console.log(`🔄 更新音频文件: ${fileInfo.filename} (ID: ${fileId})`);
                    this.stats.filesUpdated++;
                }
                callback(true);
            }
        }.bind(this));
    }

    // 处理单个音频文件 - 修复版
    processAudioFile(filePath, examType, callback) {
        const filename = path.basename(filePath);
        
        // 使用修复后的标题生成逻辑
        const fileInfo = this.parseAudioFilename(filename);
        
        // 确保使用正确的考试类型
        fileInfo.examType = examType;
        
        // 使用新的标题生成方法
        fileInfo.title = this.generateAudioTitle(filename);
        
        console.log(`处理音频: ${filename}`);
        console.log(`  -> ${fileInfo.examType} ${fileInfo.year}年${fileInfo.month}月 ${fileInfo.audioType}`);
        console.log(`  -> 标题: ${fileInfo.title}`);
        
        // 使用相对路径存储
        const relativePath = `/${examType === 'CET4' ? '四级听力' : '六级听力'}/${filename}`;
        
        this.insertOrUpdateAudioFile(fileInfo, relativePath, (success) => {
            if (success) {
                this.stats.filesProcessed++;
            } else {
                this.stats.errors++;
            }
            console.log(`处理完成: ${filename}`);
            callback();
        });
    }

    // 处理所有音频文件
    async processAllAudioFiles() {
        // 先创建表
        await new Promise((resolve) => {
            this.createListeningAudioTable((success) => {
                if (success) {
                    resolve();
                } else {
                    console.log('继续处理文件，但表创建失败可能会影响结果');
                    resolve();
                }
            });
        });
        
        const audioDirs = this.checkAudioDirectories();
        
        if (audioDirs.cet4) {
            const cet4Path = path.join(this.audioBasePath, '四级听力');
            const cet4Files = fs.readdirSync(cet4Path).filter(f => f.endsWith('.mp3'));
            
            console.log(`\n开始处理四级听力文件 (${cet4Files.length} 个)...`);
            
            for (const file of cet4Files) {
                await new Promise((resolve) => {
                    this.processAudioFile(path.join(cet4Path, file), 'CET4', resolve);
                });
                // 添加延迟避免数据库锁
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        if (audioDirs.cet6) {
            const cet6Path = path.join(this.audioBasePath, '六级听力');
            const cet6Files = fs.readdirSync(cet6Path).filter(f => f.endsWith('.mp3'));
            
            console.log(`\n开始处理六级听力文件 (${cet6Files.length} 个)...`);
            
            for (const file of cet6Files) {
                await new Promise((resolve) => {
                    this.processAudioFile(path.join(cet6Path, file), 'CET6', resolve);
                });
                // 添加延迟避免数据库锁
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
    }

    // 显示统计信息
    showStats() {
        console.log('\n=== 听力数据导入统计 ===');
        console.log(`处理文件: ${this.stats.filesProcessed}`);
        console.log(`新增文件: ${this.stats.filesCreated}`);
        console.log(`更新文件: ${this.stats.filesUpdated}`);
        console.log(`错误数量: ${this.stats.errors}`);
    }

    // 显示导入的文件列表
    async showImportedFiles() {
        return new Promise((resolve) => {
            const query = `SELECT exam_type, COUNT(*) as count FROM listening_audio_files GROUP BY exam_type`;
            
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    console.error('查询导入文件失败:', err);
                } else {
                    console.log('\n=== 已导入文件统计 ===');
                    rows.forEach(row => {
                        console.log(`${row.exam_type}: ${row.count} 个文件`);
                    });
                    
                    // 显示前10个文件作为示例
                    const sampleQuery = `SELECT exam_type, filename, title FROM listening_audio_files ORDER BY id LIMIT 10`;
                    this.db.all(sampleQuery, [], (err, files) => {
                        if (!err && files.length > 0) {
                            console.log('\n示例文件:');
                            files.forEach(file => {
                                console.log(`- ${file.exam_type} | ${file.filename} -> ${file.title}`);
                            });
                        }
                        resolve();
                    });
                }
            });
        });
    }

    // 主导入函数
    async importListeningData() {
        console.log('开始导入听力数据...\n');
        
        try {
            await this.processAllAudioFiles();
            this.showStats();
            await this.showImportedFiles();
            
        } catch (error) {
            console.error('导入过程出错:', error);
            this.stats.errors++;
        } finally {
            this.db.close();
            console.log('\n导入过程完成');
        }
    }
}

// 运行导入
const importer = new SimpleListeningDataImporter();
importer.importListeningData().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('导入失败:', error);
    process.exit(1);
});