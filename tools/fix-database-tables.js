// tools/fix-database-tables.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseFixer {
    constructor() {
        this.dbPath = path.join(__dirname, '../moyu_zhixue.db');
        this.db = new sqlite3.Database(this.dbPath);
    }

    // 检查表是否存在某列
    async checkColumnExists(table, column) {
        return new Promise((resolve, reject) => {
            this.db.all(`PRAGMA table_info(${table})`, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (!rows || !Array.isArray(rows)) {
                    resolve(false);
                    return;
                }
                
                const hasColumn = rows.some(row => row.name === column);
                resolve(hasColumn);
            });
        });
    }

    // 添加缺失的列
    async addMissingColumns() {
        const tablesToFix = {
            'exam_papers': [
                { name: 'description', def: 'TEXT' },
                { name: 'sections_count', def: 'INTEGER DEFAULT 0' },
                { name: 'questions_count', def: 'INTEGER DEFAULT 0' },
                { name: 'is_active', def: 'BOOLEAN DEFAULT 1' },
                { name: 'updated_at', def: 'DATETIME DEFAULT CURRENT_TIMESTAMP' }
            ],
            'exam_sections': [
                { name: 'section_order', def: 'INTEGER DEFAULT 0' },
                { name: 'time_allowed', def: 'VARCHAR(20)' },
                { name: 'directions', def: 'TEXT' },
                { name: 'content', def: 'TEXT' },
                { name: 'questions_count', def: 'INTEGER DEFAULT 0' }
            ],
            'exam_questions': [
                { name: 'question_type', def: 'VARCHAR(20) DEFAULT "single_choice"' },
                { name: 'question_order', def: 'INTEGER DEFAULT 0' },
                { name: 'analysis', def: 'TEXT' },
                { name: 'explanation', def: 'TEXT' },
                { name: 'audio_start_time', def: 'REAL DEFAULT 0' },
                { name: 'audio_end_time', def: 'REAL DEFAULT 0' }
            ]
        };

        console.log('🔧 开始修复数据库表结构...');

        for (const [table, columns] of Object.entries(tablesToFix)) {
            console.log(`\n检查表: ${table}`);
            
            // 先检查表是否存在
            const tableExists = await this.tableExists(table);
            if (!tableExists) {
                console.log(`   ❌ 表不存在，需要创建: ${table}`);
                await this.createTable(table);
                continue;
            }

            for (const column of columns) {
                try {
                    const exists = await this.checkColumnExists(table, column.name);
                    
                    if (!exists) {
                        console.log(`   ➕ 添加缺失列: ${column.name} ${column.def}`);
                        await this.addColumn(table, column.name, column.def);
                    } else {
                        console.log(`   ✅ 列已存在: ${column.name}`);
                    }
                } catch (error) {
                    console.error(`   ❌ 检查列失败: ${column.name}`, error.message);
                }
            }
        }

        console.log('\n🎉 数据库表结构修复完成');
    }

    async createTable(tableName) {
        const tableSchemas = {
            'exam_papers': `
                CREATE TABLE exam_papers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    exam_type VARCHAR(10) NOT NULL,
                    year INTEGER NOT NULL,
                    month INTEGER NOT NULL,
                    paper_number INTEGER DEFAULT 1,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    total_score INTEGER DEFAULT 710,
                    time_allowed INTEGER DEFAULT 125,
                    sections_count INTEGER DEFAULT 0,
                    questions_count INTEGER DEFAULT 0,
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(exam_type, year, month, paper_number)
                )
            `,
            'exam_sections': `
                CREATE TABLE exam_sections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    paper_id INTEGER NOT NULL,
                    section_type VARCHAR(20) NOT NULL,
                    section_name VARCHAR(100) NOT NULL,
                    section_order INTEGER DEFAULT 0,
                    time_allowed VARCHAR(20),
                    directions TEXT,
                    content TEXT,
                    questions_count INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (paper_id) REFERENCES exam_papers (id) ON DELETE CASCADE
                )
            `,
            'exam_questions': `
                CREATE TABLE exam_questions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    section_id INTEGER NOT NULL,
                    question_type VARCHAR(20) NOT NULL DEFAULT 'single_choice',
                    question_number INTEGER NOT NULL,
                    question_text TEXT NOT NULL,
                    options TEXT,
                    correct_answer TEXT,
                    analysis TEXT,
                    explanation TEXT,
                    audio_start_time REAL DEFAULT 0,
                    audio_end_time REAL DEFAULT 0,
                    question_order INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (section_id) REFERENCES exam_sections (id) ON DELETE CASCADE
                )
            `
        };

        const schema = tableSchemas[tableName];
        if (!schema) {
            throw new Error(`未知表名: ${tableName}`);
        }

        return new Promise((resolve, reject) => {
            this.db.run(schema, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async addColumn(table, columnName, columnDef) {
        return new Promise((resolve, reject) => {
            const sql = `ALTER TABLE ${table} ADD COLUMN ${columnName} ${columnDef}`;
            this.db.run(sql, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // 检查所有必要的表是否存在
    async checkAllTables() {
        const requiredTables = [
            'exam_papers', 'exam_sections', 'exam_questions',
            'exam_sessions', 'exam_statistics'
        ];

        console.log('\n📋 检查所有必要的表...');

        for (const table of requiredTables) {
            const exists = await this.tableExists(table);
            console.log(`   ${exists ? '✅' : '❌'} ${table}: ${exists ? '存在' : '缺失'}`);
            
            if (exists) {
                // 显示表结构
                await this.showTableStructure(table);
            }
        }
    }

    async showTableStructure(table) {
        return new Promise((resolve, reject) => {
            this.db.all(`PRAGMA table_info(${table})`, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (rows && Array.isArray(rows)) {
                    console.log(`     表结构:`);
                    rows.forEach(row => {
                        console.log(`       - ${row.name} (${row.type})`);
                    });
                }
                resolve();
            });
        });
    }

    async tableExists(table) {
        return new Promise((resolve, reject) => {
            this.db.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                [table],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(!!row);
                    }
                }
            );
        });
    }

    // 修复数据完整性
    async fixDataIntegrity() {
        console.log('\n🔍 修复数据完整性...');
        
        // 确保所有试卷都有正确的题目计数
        try {
            await this.fixQuestionCounts();
            console.log('   ✅ 题目计数修复完成');
        } catch (error) {
            console.error('   ❌ 题目计数修复失败:', error.message);
        }
    }

    async fixQuestionCounts() {
        return new Promise((resolve, reject) => {
            // 更新试卷的题目计数
            const updatePaperCounts = `
                UPDATE exam_papers 
                SET questions_count = (
                    SELECT COUNT(*) 
                    FROM exam_questions eq
                    JOIN exam_sections es ON eq.section_id = es.id
                    WHERE es.paper_id = exam_papers.id
                ),
                sections_count = (
                    SELECT COUNT(*) 
                    FROM exam_sections 
                    WHERE paper_id = exam_papers.id
                )
            `;
            
            this.db.run(updatePaperCounts, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    close() {
        this.db.close();
    }
}

// 运行修复
async function main() {
    const fixer = new DatabaseFixer();
    
    try {
        await fixer.addMissingColumns();
        await fixer.checkAllTables();
        await fixer.fixDataIntegrity();
        
        console.log('\n✨ 所有数据库修复操作完成');
    } catch (error) {
        console.error('❌ 修复过程中出错:', error);
    } finally {
        fixer.close();
    }
}

// 如果是直接运行此脚本，则执行修复
if (require.main === module) {
    main();
}

module.exports = DatabaseFixer;