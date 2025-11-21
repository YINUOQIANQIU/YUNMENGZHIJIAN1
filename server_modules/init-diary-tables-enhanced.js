// [file name]: server_modules/init-diary-tables-enhanced.js
// 增强版日记表初始化脚本 - 完全重写

const initDiaryTablesEnhanced = (db) => {
    return new Promise((resolve, reject) => {
        console.log('🚀 开始初始化增强版日记表...');
        
        // 修复：使用正确的数据库实例
        const database = db.db || db;
        
        if (!database) {
            console.error('❌ 数据库实例不存在');
            reject(new Error('数据库连接失败'));
            return;
        }

        // 第一步：检查用户表是否存在
        const checkUsersTableSQL = `SELECT name FROM sqlite_master WHERE type='table' AND name='users'`;
        
        database.get(checkUsersTableSQL, (err, row) => {
            if (err) {
                console.error('❌ 检查用户表失败:', err);
                reject(err);
                return;
            }
            
            if (!row) {
                console.error('❌ 用户表不存在，无法创建日记表');
                reject(new Error('用户表不存在，请先初始化用户系统'));
                return;
            }
            
            console.log('✅ 用户表存在，继续初始化日记表...');
            
            // 第二步：创建日记条目表（简化结构，移除不必要的字段）
            const createDiaryEntriesTableSQL = `
                CREATE TABLE IF NOT EXISTS diary_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    title TEXT DEFAULT '',
                    content TEXT NOT NULL,
                    achievements TEXT DEFAULT '',
                    tags TEXT DEFAULT '',
                    mood TEXT DEFAULT 'normal',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            `;

            // 第三步：执行创建表
            database.run(createDiaryEntriesTableSQL, (err) => {
                if (err) {
                    console.error('❌ 创建diary_entries表失败:', err);
                    reject(err);
                    return;
                }
                
                console.log('✅ diary_entries表创建/检查完成');
                
                // 第四步：创建索引以提高查询性能
                const createIndexesSQL = [
                    `CREATE INDEX IF NOT EXISTS idx_diary_user_id ON diary_entries(user_id)`,
                    `CREATE INDEX IF NOT EXISTS idx_diary_created_at ON diary_entries(created_at)`,
                    `CREATE INDEX IF NOT EXISTS idx_diary_mood ON diary_entries(mood)`,
                    `CREATE INDEX IF NOT EXISTS idx_diary_tags ON diary_entries(tags)`
                ];
                
                let completedIndexes = 0;
                let indexErrors = [];
                
                createIndexesSQL.forEach((sql, index) => {
                    database.run(sql, (indexErr) => {
                        completedIndexes++;
                        
                        if (indexErr) {
                            console.warn(`⚠️ 创建索引 ${index + 1} 失败:`, indexErr.message);
                            indexErrors.push(indexErr.message);
                        } else {
                            console.log(`✅ 索引 ${index + 1} 创建完成`);
                        }
                        
                        if (completedIndexes === createIndexesSQL.length) {
                            if (indexErrors.length > 0) {
                                console.warn('⚠️ 日记表初始化完成，但有索引创建错误');
                                resolve({
                                    success: true,
                                    warnings: indexErrors,
                                    message: '日记表初始化完成，但部分索引创建失败'
                                });
                            } else {
                                console.log('🎉 日记表初始化完成');
                                resolve({
                                    success: true,
                                    message: '日记表初始化成功'
                                });
                            }
                        }
                    });
                });
            });
        });
    });
};

// 增强表检查函数
const checkDiaryTablesEnhanced = (db) => {
    return new Promise((resolve) => {
        console.log('🔍 检查日记表状态...');
        
        const database = db.db || db;
        const tablesToCheck = ['diary_entries'];
        
        let checkedTables = 0;
        let missingTables = [];
        let tableStatus = {};

        tablesToCheck.forEach(tableName => {
            const sql = `SELECT name, sql FROM sqlite_master WHERE type='table' AND name=?`;
            
            database.get(sql, [tableName], (err, row) => {
                checkedTables++;
                
                if (err) {
                    console.error(`❌ 检查表 ${tableName} 失败:`, err);
                    missingTables.push(tableName);
                    tableStatus[tableName] = { exists: false, error: err.message };
                } else if (!row) {
                    console.warn(`⚠️ 表 ${tableName} 不存在`);
                    missingTables.push(tableName);
                    tableStatus[tableName] = { exists: false };
                } else {
                    console.log(`✅ 表 ${tableName} 存在`);
                    tableStatus[tableName] = { 
                        exists: true, 
                        sql: row.sql 
                    };
                }
                
                if (checkedTables === tablesToCheck.length) {
                    const allTablesExist = missingTables.length === 0;
                    
                    console.log('📊 日记表检查结果:', {
                        allTablesExist,
                        missingTables,
                        tableStatus
                    });
                    
                    resolve({
                        allTablesExist,
                        missingTables,
                        tableStatus,
                        details: tableStatus
                    });
                }
            });
        });
    });
};

// 紧急修复函数 - 如果表初始化失败，使用此函数
const emergencyFixDiaryTables = (db) => {
    return new Promise((resolve) => {
        console.log('🚨 执行日记表紧急修复...');
        
        const database = db.db || db;
        
        // 最简单的表结构，确保基本功能可用
        const emergencySQL = `
            CREATE TABLE IF NOT EXISTS diary_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT,
                content TEXT NOT NULL,
                achievements TEXT,
                tags TEXT,
                mood TEXT DEFAULT 'normal',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        database.run(emergencySQL, (err) => {
            if (err) {
                console.error('❌ 紧急修复失败:', err);
                resolve({ success: false, error: err.message });
            } else {
                console.log('✅ 紧急修复成功');
                resolve({ success: true, message: '日记表紧急修复完成' });
            }
        });
    });
};

// 验证表结构完整性
const validateTableStructure = (db) => {
    return new Promise((resolve) => {
        console.log('🔧 验证日记表结构完整性...');
        
        const database = db.db || db;
        
        database.all("PRAGMA table_info(diary_entries)", (err, columns) => {
            if (err) {
                console.error('❌ 验证表结构失败:', err);
                resolve({ valid: false, error: err.message });
                return;
            }
            
            if (!columns || columns.length === 0) {
                console.error('❌ 表结构为空');
                resolve({ valid: false, error: '表结构为空' });
                return;
            }
            
            const requiredColumns = ['id', 'user_id', 'content', 'created_at'];
            const missingColumns = [];
            const columnDetails = {};
            
            columns.forEach(col => {
                columnDetails[col.name] = {
                    type: col.type,
                    notnull: col.notnull,
                    defaultValue: col.dflt_value
                };
            });
            
            requiredColumns.forEach(reqCol => {
                if (!columnDetails[reqCol]) {
                    missingColumns.push(reqCol);
                }
            });
            
            const isValid = missingColumns.length === 0;
            
            console.log('📋 表结构验证结果:', {
                isValid,
                columnCount: columns.length,
                missingColumns,
                columnDetails
            });
            
            resolve({
                valid: isValid,
                columnCount: columns.length,
                missingColumns,
                columns: columnDetails,
                details: columns
            });
        });
    });
};

// 插入测试数据（开发环境使用）
const insertTestData = (db, userId = 1) => {
    return new Promise((resolve) => {
        console.log('🧪 插入测试数据...');
        
        const database = db.db || db;
        const now = new Date().toISOString();
        
        const testEntries = [
            {
                user_id: userId,
                title: '英语学习第一天',
                content: '今天学习了基础词汇和简单对话，感觉收获很大。特别是虚拟语气的用法让我印象深刻。坚持每天学习，相信会有很大的进步！',
                achievements: '掌握了50个新单词，完成了2篇阅读理解',
                tags: '英语学习,词汇突破',
                mood: 'happy',
                created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                user_id: userId,
                title: '听力训练心得',
                content: '今天的听力材料有点难，但通过反复练习，终于能够理解大部分内容了。需要继续加强听力训练。',
                achievements: '完成了一套四级听力真题',
                tags: '听力训练,真题练习',
                mood: 'normal',
                created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                user_id: userId,
                title: '写作练习突破',
                content: '尝试写了一篇议论文，虽然还有很多不足，但比之前进步了很多。老师给了很多有用的建议。',
                achievements: '完成了一篇150词的英语作文',
                tags: '写作练习,作文',
                mood: 'excited',
                created_at: now
            }
        ];

        let inserted = 0;
        let errors = [];

        testEntries.forEach((entry, index) => {
            const insertQuery = `
                INSERT OR IGNORE INTO diary_entries 
                (user_id, title, content, achievements, tags, mood, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            database.run(insertQuery, [
                entry.user_id, 
                entry.title, 
                entry.content, 
                entry.achievements, 
                entry.tags, 
                entry.mood, 
                entry.created_at, 
                now
            ], function(err) {
                inserted++;
                
                if (err) {
                    console.error(`❌ 插入测试数据 ${index + 1} 失败:`, err);
                    errors.push(`条目${index + 1}: ${err.message}`);
                } else {
                    console.log(`✅ 测试数据 ${index + 1} 插入成功`);
                }
                
                if (inserted === testEntries.length) {
                    if (errors.length > 0) {
                        console.warn('⚠️ 部分测试数据插入失败');
                        resolve({ 
                            success: false, 
                            inserted: testEntries.length - errors.length,
                            errors 
                        });
                    } else {
                        console.log('🎉 所有测试数据插入成功');
                        resolve({ 
                            success: true, 
                            inserted: testEntries.length,
                            message: '测试数据插入完成' 
                        });
                    }
                }
            });
        });
    });
};

// 完整的初始化流程
const completeDiarySetup = async (db) => {
    try {
        console.log('🎯 开始完整的日记系统设置...');
        
        // 1. 检查表状态
        const checkResult = await checkDiaryTablesEnhanced(db);
        
        if (!checkResult.allTablesExist) {
            console.log('📦 日记表不存在，开始初始化...');
            
            // 2. 初始化表
            const initResult = await initDiaryTablesEnhanced(db);
            
            if (!initResult.success) {
                console.error('❌ 表初始化失败，尝试紧急修复...');
                
                // 3. 紧急修复
                const emergencyResult = await emergencyFixDiaryTables(db);
                
                if (!emergencyResult.success) {
                    throw new Error('所有初始化方案都失败了');
                }
            }
        }
        
        // 4. 验证表结构
        const validationResult = await validateTableStructure(db);
        
        if (!validationResult.valid) {
            console.error('❌ 表结构验证失败');
            throw new Error('表结构不完整');
        }
        
        console.log('✅ 日记系统设置完成');
        
        return {
            success: true,
            message: '日记系统初始化完成',
            validation: validationResult
        };
        
    } catch (error) {
        console.error('❌ 日记系统设置失败:', error);
        
        // 最后的尝试：紧急修复
        try {
            const emergencyResult = await emergencyFixDiaryTables(db);
            return {
                success: emergencyResult.success,
                message: emergencyResult.success ? '通过紧急修复完成初始化' : '初始化完全失败',
                error: error.message,
                emergency: emergencyResult
            };
        } catch (finalError) {
            return {
                success: false,
                message: '日记系统初始化完全失败',
                error: finalError.message
            };
        }
    }
};

module.exports = {
    initDiaryTables: initDiaryTablesEnhanced,
    checkDiaryTables: checkDiaryTablesEnhanced,
    emergencyFixDiaryTables,
    validateTableStructure,
    insertTestData,
    completeDiarySetup
};