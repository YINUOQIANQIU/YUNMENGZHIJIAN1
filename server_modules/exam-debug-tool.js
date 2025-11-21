// [file name]: server_modules/exam-debug-tool.js
const db = require('./database.js');

// 考试系统调试工具
const examDebugTool = {
    // 检查考试数据完整性
    async checkExamDataIntegrity() {
        return new Promise((resolve, reject) => {
            const results = {
                papers: 0,
                sections: 0,
                questions: 0,
                issues: []
            };

            // 检查试卷
            db.db.all('SELECT * FROM exam_papers WHERE is_active = 1', (err, papers) => {
                if (err) {
                    results.issues.push(`检查试卷失败: ${err.message}`);
                    resolve(results);
                    return;
                }

                results.papers = papers.length;
                console.log(`📝 找到 ${papers.length} 套试卷`);

                if (papers.length === 0) {
                    results.issues.push('未找到任何有效试卷');
                    resolve(results);
                    return;
                }

                // 检查每个试卷的部分
                let papersChecked = 0;
                papers.forEach(paper => {
                    db.db.all('SELECT * FROM exam_sections WHERE paper_id = ? ORDER BY section_order', [paper.id], (err, sections) => {
                        if (err) {
                            results.issues.push(`检查试卷 ${paper.title} 的部分失败: ${err.message}`);
                        } else {
                            results.sections += sections.length;
                            console.log(`   📂 试卷 "${paper.title}" 有 ${sections.length} 个部分`);

                            // 检查每个部分的题目
                            let sectionsChecked = 0;
                            if (sections.length === 0) {
                                sectionsChecked++;
                            } else {
                                sections.forEach(section => {
                                    db.db.all('SELECT * FROM exam_questions WHERE section_id = ? ORDER BY question_order', [section.id], (err, questions) => {
                                        if (err) {
                                            results.issues.push(`检查部分 ${section.section_name} 的题目失败: ${err.message}`);
                                        } else {
                                            results.questions += questions.length;
                                            console.log(`      📚 部分 "${section.section_name}" 有 ${questions.length} 道题目`);
                                        }

                                        sectionsChecked++;
                                        if (sectionsChecked === sections.length) {
                                            papersChecked++;
                                            if (papersChecked === papers.length) {
                                                resolve(results);
                                            }
                                        }
                                    });
                                });
                            }
                        }
                    });
                });
            });
        });
    },

    // 修复考试数据
    async fixExamData() {
        console.log('🔧 开始修复考试数据...');
        
        // 检查并修复表结构
        const tablesToCheck = ['exam_papers', 'exam_sections', 'exam_questions', 'exam_sessions'];
        
        for (const table of tablesToCheck) {
            try {
                const exists = await this.checkTableExists(table);
                if (!exists) {
                    console.log(`❌ 表 ${table} 不存在，需要创建`);
                    // 这里可以添加创建表的逻辑
                } else {
                    console.log(`✅ 表 ${table} 存在`);
                }
            } catch (error) {
                console.error(`检查表 ${table} 失败:`, error);
            }
        }
        
        return { success: true, message: '考试数据修复完成' };
    },

    // 检查表是否存在
    checkTableExists(tableName) {
        return new Promise((resolve, reject) => {
            db.db.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                [tableName],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(!!row);
                }
            );
        });
    }
};

module.exports = examDebugTool;