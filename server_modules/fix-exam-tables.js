// [file name]: fix-exam-tables.js
const db = require('./database.js');

// 修复考试相关表结构
async function fixExamTables() {
    console.log('🔧 开始修复考试表结构...');
    
    const tableSchemas = {
        exam_papers: `
            CREATE TABLE IF NOT EXISTS exam_papers (
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
        exam_sections: `
            CREATE TABLE IF NOT EXISTS exam_sections (
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
        exam_questions: `
            CREATE TABLE IF NOT EXISTS exam_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                section_id INTEGER NOT NULL,
                question_type VARCHAR(20) NOT NULL DEFAULT 'single_choice',
                question_number INTEGER NOT NULL,
                question_text TEXT NOT NULL,
                options TEXT,
                correct_answer TEXT,
                analysis TEXT,
                explanation TEXT,
                score INTEGER DEFAULT 1,
                audio_start_time REAL DEFAULT 0,
                audio_end_time REAL DEFAULT 0,
                question_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (section_id) REFERENCES exam_sections (id) ON DELETE CASCADE
            )
        `,
        exam_sessions: `
            CREATE TABLE IF NOT EXISTS exam_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                paper_id INTEGER NOT NULL,
                start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                end_time DATETIME,
                time_spent INTEGER DEFAULT 0,
                time_remaining INTEGER DEFAULT 0,
                total_score INTEGER DEFAULT 0,
                correct_count INTEGER DEFAULT 0,
                total_count INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'in_progress',
                answers TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (paper_id) REFERENCES exam_papers (id)
            )
        `,
        exam_statistics: `
            CREATE TABLE IF NOT EXISTS exam_statistics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                paper_id INTEGER NOT NULL,
                exam_type VARCHAR(10) NOT NULL,
                correct_count INTEGER DEFAULT 0,
                total_count INTEGER DEFAULT 0,
                total_score INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (paper_id) REFERENCES exam_papers (id),
                UNIQUE(user_id, paper_id)
            )
        `
    };

    const promises = Object.entries(tableSchemas).map(([tableName, schema]) => {
        return new Promise((resolve, reject) => {
            db.db.run(schema, (err) => {
                if (err) {
                    console.error(`创建表 ${tableName} 失败:`, err.message);
                    reject(err);
                } else {
                    console.log(`✅ 表 ${tableName} 已就绪`);
                    resolve();
                }
            });
        });
    });

    try {
        await Promise.all(promises);
        console.log('🎉 所有考试表结构修复完成');
        return { success: true, message: '考试表结构修复完成' };
    } catch (error) {
        console.error('❌ 考试表结构修复失败:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { fixExamTables };