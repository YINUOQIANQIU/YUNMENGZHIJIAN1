// [file name]: server_modules/fix-diary-tables.js
// 日记表修复脚本

const fixDiaryTables = (db) => {
    return new Promise((resolve) => {
        console.log('🔧 开始修复日记表结构...');
        
        const database = db.db || db;
        
        if (!database) {
            console.error('❌ 数据库实例不存在');
            resolve({ success: false, error: '数据库连接失败' });
            return;
        }

        // 步骤1：检查当前表结构
        database.all("PRAGMA table_info(diary_entries)", (err, columns) => {
            if (err) {
                console.error('❌ 检查表结构失败:', err);
                resolve({ success: false, error: err.message });
                return;
            }
            
            if (!columns || columns.length === 0) {
                console.log('📝 日记表不存在，创建新表...');
                createNewDiaryTable(database, resolve);
                return;
            }
            
            // 检查是否需要修复
            const columnNames = columns.map(col => col.name);
            console.log('📋 当前表结构:', columnNames);
            
            // 检查是否有错误的字段（如 type, question, my_answer 等）
            const invalidColumns = ['type', 'question', 'my_answer', 'correct_answer', 'analysis', 'subject', 'difficulty'];
            const hasInvalidColumns = invalidColumns.some(col => columnNames.includes(col));
            
            if (hasInvalidColumns) {
                console.log('🔄 检测到错误字段，需要重建表...');
                rebuildDiaryTable(database, resolve);
            } else {
                console.log('✅ 表结构正常，无需修复');
                resolve({ success: true, message: '表结构正常' });
            }
        });
    });
};

// 创建新表
function createNewDiaryTable(database, resolve) {
    const createTableSQL = `
        CREATE TABLE diary_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title VARCHAR(255) DEFAULT '',
            content TEXT NOT NULL,
            mood VARCHAR(20) DEFAULT 'normal',
            achievements TEXT DEFAULT '',
            tags TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `;
    
    database.run(createTableSQL, (err) => {
        if (err) {
            console.error('❌ 创建日记表失败:', err);
            resolve({ success: false, error: err.message });
        } else {
            console.log('✅ 日记表创建成功');
            createIndexes(database, resolve);
        }
    });
}

// 重建表（保留数据）
function rebuildDiaryTable(database, resolve) {
    // 1. 创建临时表备份有效数据
    const createTempTableSQL = `
        CREATE TABLE IF NOT EXISTS diary_entries_temp AS 
        SELECT 
            id,
            user_id,
            COALESCE(title, '') as title,
            COALESCE(content, '') as content,
            COALESCE(mood, 'normal') as mood,
            COALESCE(achievements, '') as achievements,
            COALESCE(tags, '') as tags,
            created_at,
            updated_at
        FROM diary_entries
        WHERE 1=0
    `;
    
    database.run(createTempTableSQL, (err) => {
        if (err) {
            console.error('❌ 创建临时表失败:', err);
            resolve({ success: false, error: err.message });
            return;
        }
        
        console.log('✅ 临时表创建成功');
        
        // 2. 尝试迁移数据
        const migrateDataSQL = `
            INSERT INTO diary_entries_temp (id, user_id, title, content, mood, achievements, tags, created_at, updated_at)
            SELECT 
                id,
                user_id,
                COALESCE(title, '') as title,
                COALESCE(content, '') as content,
                COALESCE(mood, 'normal') as mood,
                COALESCE(achievements, '') as achievements,
                COALESCE(tags, '') as tags,
                COALESCE(created_at, CURRENT_TIMESTAMP) as created_at,
                COALESCE(updated_at, CURRENT_TIMESTAMP) as updated_at
            FROM diary_entries
        `;
        
        database.run(migrateDataSQL, (migrateErr) => {
            if (migrateErr) {
                console.warn('⚠️ 数据迁移失败，继续重建空表:', migrateErr.message);
            }
            
            // 3. 删除原表
            database.run('DROP TABLE IF EXISTS diary_entries', (dropErr) => {
                if (dropErr) {
                    console.error('❌ 删除原表失败:', dropErr);
                    resolve({ success: false, error: dropErr.message });
                    return;
                }
                
                console.log('✅ 原表删除成功');
                
                // 4. 创建新表
                createNewDiaryTable(database, (result) => {
                    if (result.success) {
                        // 5. 从临时表恢复数据
                        const restoreDataSQL = `
                            INSERT INTO diary_entries (id, user_id, title, content, mood, achievements, tags, created_at, updated_at)
                            SELECT id, user_id, title, content, mood, achievements, tags, created_at, updated_at
                            FROM diary_entries_temp
                        `;
                        
                        database.run(restoreDataSQL, (restoreErr) => {
                            if (restoreErr) {
                                console.warn('⚠️ 数据恢复失败:', restoreErr.message);
                            } else {
                                console.log('✅ 数据恢复成功');
                            }
                            
                            // 6. 删除临时表
                            database.run('DROP TABLE IF EXISTS diary_entries_temp', (cleanupErr) => {
                                if (cleanupErr) {
                                    console.warn('⚠️ 清理临时表失败:', cleanupErr.message);
                                }
                                
                                resolve(result);
                            });
                        });
                    } else {
                        resolve(result);
                    }
                });
            });
        });
    });
}

// 创建索引
function createIndexes(database, resolve) {
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_diary_user_id ON diary_entries(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_diary_created_at ON diary_entries(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_diary_mood ON diary_entries(mood)',
        'CREATE INDEX IF NOT EXISTS idx_diary_tags ON diary_entries(tags)'
    ];
    
    let completed = 0;
    let errors = [];
    
    indexes.forEach((sql, index) => {
        database.run(sql, (err) => {
            completed++;
            
            if (err) {
                console.warn(`⚠️ 创建索引 ${index + 1} 失败:`, err.message);
                errors.push(err.message);
            } else {
                console.log(`✅ 索引 ${index + 1} 创建成功`);
            }
            
            if (completed === indexes.length) {
                if (errors.length > 0) {
                    console.warn('⚠️ 索引创建完成，但有错误');
                } else {
                    console.log('✅ 所有索引创建成功');
                }
                
                resolve({ 
                    success: true, 
                    message: '日记表修复完成',
                    warnings: errors.length > 0 ? errors : undefined
                });
            }
        });
    });
}

module.exports = { fixDiaryTables };