// [file name]: server_modules/init-error-questions-tables.js
// 错题本表初始化脚本 - 仿照日记表结构

const initErrorQuestionsTables = (db) => {
    return new Promise((resolve, reject) => {
        console.log('🚀 开始初始化错题本表...');
        
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
                console.error('❌ 用户表不存在，无法创建错题本表');
                reject(new Error('用户表不存在，请先初始化用户系统'));
                return;
            }
            
            console.log('✅ 用户表存在，继续初始化错题本表...');
            
            // 第二步：创建错题条目表
            const createErrorQuestionsTableSQL = `
                CREATE TABLE IF NOT EXISTS error_questions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    question TEXT NOT NULL,
                    my_answer TEXT DEFAULT '',
                    correct_answer TEXT NOT NULL,
                    analysis TEXT DEFAULT '',
                    subject TEXT DEFAULT '',
                    difficulty TEXT DEFAULT '中等',
                    error_type TEXT DEFAULT '',
                    knowledge_points TEXT DEFAULT '',
                    tags TEXT DEFAULT '',
                    review_count INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            `;

            // 第三步：执行创建表
            database.run(createErrorQuestionsTableSQL, (err) => {
                if (err) {
                    console.error('❌ 创建error_questions表失败:', err);
                    reject(err);
                    return;
                }
                
                console.log('✅ error_questions表创建/检查完成');
                
                // 第四步：创建索引以提高查询性能
                const createIndexesSQL = [
                    `CREATE INDEX IF NOT EXISTS idx_error_questions_user_id ON error_questions(user_id)`,
                    `CREATE INDEX IF NOT EXISTS idx_error_questions_created_at ON error_questions(created_at)`,
                    `CREATE INDEX IF NOT EXISTS idx_error_questions_subject ON error_questions(subject)`,
                    `CREATE INDEX IF NOT EXISTS idx_error_questions_difficulty ON error_questions(difficulty)`,
                    `CREATE INDEX IF NOT EXISTS idx_error_questions_tags ON error_questions(tags)`
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
                                console.warn('⚠️ 错题本表初始化完成，但有索引创建错误');
                                resolve({
                                    success: true,
                                    warnings: indexErrors,
                                    message: '错题本表初始化完成，但部分索引创建失败'
                                });
                            } else {
                                console.log('🎉 错题本表初始化完成');
                                resolve({
                                    success: true,
                                    message: '错题本表初始化成功'
                                });
                            }
                        }
                    });
                });
            });
        });
    });
};

// 表检查函数
const checkErrorQuestionsTables = (db) => {
    return new Promise((resolve) => {
        console.log('🔍 检查错题本表状态...');
        
        const database = db.db || db;
        const tablesToCheck = ['error_questions'];
        
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
                    
                    console.log('📊 错题本表检查结果:', {
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

// 紧急修复函数
const emergencyFixErrorQuestionsTables = (db) => {
    return new Promise((resolve) => {
        console.log('🚨 执行错题本表紧急修复...');
        
        const database = db.db || db;
        
        // 最简单的表结构，确保基本功能可用
        const emergencySQL = `
            CREATE TABLE IF NOT EXISTS error_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                question TEXT NOT NULL,
                my_answer TEXT DEFAULT '',
                correct_answer TEXT NOT NULL,
                analysis TEXT DEFAULT '',
                subject TEXT DEFAULT '',
                difficulty TEXT DEFAULT '中等',
                error_type TEXT DEFAULT '',
                knowledge_points TEXT DEFAULT '',
                tags TEXT DEFAULT '',
                review_count INTEGER DEFAULT 0,
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
                resolve({ success: true, message: '错题本表紧急修复完成' });
            }
        });
    });
};

// 验证表结构完整性
const validateErrorQuestionsTableStructure = (db) => {
    return new Promise((resolve) => {
        console.log('🔧 验证错题本表结构完整性...');
        
        const database = db.db || db;
        
        database.all("PRAGMA table_info(error_questions)", (err, columns) => {
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
            
            const requiredColumns = ['id', 'user_id', 'question', 'correct_answer', 'created_at'];
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
            
            console.log('📋 错题本表结构验证结果:', {
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
const insertErrorQuestionsTestData = (db, userId = 1) => {
    return new Promise((resolve) => {
        console.log('🧪 插入错题本测试数据...');
        
        const database = db.db || db;
        const now = new Date().toISOString();
        
        const testEntries = [
            {
                user_id: userId,
                question: '虚拟语气的正确用法是什么？在条件句中如何表达与现在事实相反的情况？',
                my_answer: 'If I was you, I will study harder.',
                correct_answer: 'If I were you, I would study harder.',
                analysis: '虚拟语气中，be动词要用were而不是was，主句要用would do而不是will do。这是与现在事实相反的虚拟语气标准结构。',
                subject: '语法',
                difficulty: '中等',
                error_type: '概念不清',
                knowledge_points: '虚拟语气,条件句,与现在事实相反',
                tags: '易错题,重点,需要复习',
                review_count: 2,
                created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                user_id: userId,
                question: '阅读理解：What is the main idea of the passage about climate change?',
                my_answer: 'The passage mainly talks about weather patterns.',
                correct_answer: 'The passage mainly discusses the long-term impacts of human activities on global climate systems.',
                analysis: '混淆了天气和气候的概念。天气是短期的，气候是长期的。文章重点是人类活动对全球气候系统的长期影响。',
                subject: '阅读',
                difficulty: '困难',
                error_type: '审题不清',
                knowledge_points: '主旨大意,气候与天气区别,阅读理解技巧',
                tags: '主旨题,易混淆',
                review_count: 1,
                created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                user_id: userId,
                question: '听力：What does the woman suggest the man do?',
                my_answer: 'Go to the library',
                correct_answer: 'Check the online database first',
                analysis: '没有听清关键信息"first"。女士建议先查看在线数据库，而不是直接去图书馆。',
                subject: '听力',
                difficulty: '简单',
                error_type: '粗心大意',
                knowledge_points: '听力细节,建议表达,顺序词',
                tags: '细节题,顺序词',
                review_count: 0,
                created_at: now
            }
        ];

        let inserted = 0;
        let errors = [];

        testEntries.forEach((entry, index) => {
            const insertQuery = `
                INSERT OR IGNORE INTO error_questions 
                (user_id, question, my_answer, correct_answer, analysis, subject, difficulty, error_type, knowledge_points, tags, review_count, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            database.run(insertQuery, [
                entry.user_id, 
                entry.question, 
                entry.my_answer, 
                entry.correct_answer, 
                entry.analysis, 
                entry.subject, 
                entry.difficulty, 
                entry.error_type, 
                entry.knowledge_points, 
                entry.tags, 
                entry.review_count, 
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
const completeErrorQuestionsSetup = async (db) => {
    try {
        console.log('🎯 开始完整的错题本系统设置...');
        
        // 1. 检查表状态
        const checkResult = await checkErrorQuestionsTables(db);
        
        if (!checkResult.allTablesExist) {
            console.log('📦 错题本表不存在，开始初始化...');
            
            // 2. 初始化表
            const initResult = await initErrorQuestionsTables(db);
            
            if (!initResult.success) {
                console.error('❌ 表初始化失败，尝试紧急修复...');
                
                // 3. 紧急修复
                const emergencyResult = await emergencyFixErrorQuestionsTables(db);
                
                if (!emergencyResult.success) {
                    throw new Error('所有初始化方案都失败了');
                }
            }
        }
        
        // 4. 验证表结构
        const validationResult = await validateErrorQuestionsTableStructure(db);
        
        if (!validationResult.valid) {
            console.error('❌ 表结构验证失败');
            throw new Error('表结构不完整');
        }
        
        console.log('✅ 错题本系统设置完成');
        
        return {
            success: true,
            message: '错题本系统初始化完成',
            validation: validationResult
        };
        
    } catch (error) {
        console.error('❌ 错题本系统设置失败:', error);
        
        // 最后的尝试：紧急修复
        try {
            const emergencyResult = await emergencyFixErrorQuestionsTables(db);
            return {
                success: emergencyResult.success,
                message: emergencyResult.success ? '通过紧急修复完成初始化' : '初始化完全失败',
                error: error.message,
                emergency: emergencyResult
            };
        } catch (finalError) {
            return {
                success: false,
                message: '错题本系统初始化完全失败',
                error: finalError.message
            };
        }
    }
};

module.exports = {
    initErrorQuestionsTables,
    checkErrorQuestionsTables,
    emergencyFixErrorQuestionsTables,
    validateErrorQuestionsTableStructure,
    insertErrorQuestionsTestData,
    completeErrorQuestionsSetup
};