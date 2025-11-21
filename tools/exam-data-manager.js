// tools/exam-data-manager.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const ExamDataUtils = require('./exam-data-utils.js');

class ExamDataManager {
    constructor() {
        this.dbPath = path.join(__dirname, '../moyu_zhixue.db');
        this.db = new sqlite3.Database(this.dbPath);
        this.importMode = 'update'; // 'update', 'skip', 'overwrite'
        
        // 初始化时检查表结构
        this.initExamTables();
        this.checkTableStructure();
    }

    // 初始化真题相关表
    initExamTables() {
        this.db.serialize(() => {
            // 这些表已经在 database.js 中创建，这里确保存在
            const tables = [
                'exam_papers',
                'exam_sections', 
                'exam_questions',
                'exam_sessions',
                'exam_statistics'
            ];
            
            console.log('✅ 真题数据表初始化完成');
        });
    }

    // 检查表结构
    async checkTableStructure() {
        const requiredColumns = {
            'exam_papers': ['description', 'sections_count', 'questions_count'],
            'exam_sections': ['section_order', 'time_allowed', 'directions', 'passage_content'],
            'exam_questions': ['question_type', 'question_order', 'analysis', 'explanation', 'score']
        };

        for (const [table, columns] of Object.entries(requiredColumns)) {
            try {
                for (const column of columns) {
                    const exists = await this.columnExists(table, column);
                    if (!exists) {
                        console.warn(`⚠️ 表 ${table} 缺少列 ${column}`);
                    }
                }
            } catch (error) {
                console.error(`检查表 ${table} 结构时出错:`, error.message);
            }
        }
    }

    async columnExists(table, column) {
        return new Promise((resolve, reject) => {
            this.db.all(`PRAGMA table_info(${table})`, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                const hasColumn = rows.some(row => row.name === column);
                resolve(hasColumn);
            });
        });
    }

    // 设置导入模式
    setImportMode(mode) {
        const validModes = ['update', 'skip', 'overwrite'];
        if (validModes.includes(mode)) {
            this.importMode = mode;
        }
    }

    // 主要导入方法 - 修复版本
    async importExamData(jsonFile, options = {}) {
        return new Promise((resolve, reject) => {
            fs.readFile(jsonFile, 'utf8', async (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!data || data.trim().length === 0) {
                    resolve({ 
                        success: false, 
                        message: 'JSON文件为空或格式错误',
                        skipped: true,
                        reason: '空文件'
                    });
                    return;
                }

                try {
                    let rawData;
                    try {
                        rawData = JSON.parse(data);
                    } catch (parseError) {
                        console.error('❌ JSON解析错误:', parseError.message);
                        resolve({ 
                            success: false, 
                            message: `JSON解析失败: ${parseError.message}`,
                            skipped: true,
                            reason: 'JSON格式错误'
                        });
                        return;
                    }

                    // 检测是否为分离格式数据
                    if (rawData.exam_papers && rawData.exam_sections && rawData.exam_questions) {
                        console.log('🔧 检测到分离格式数据，开始处理...');
                        const result = await this.importSeparatedExamData(rawData);
                        resolve(result);
                    } else {
                        // 原有标准化逻辑
                        const examData = ExamDataUtils.normalizeExamData(rawData);
                        
                        if (!examData) {
                            resolve({ 
                                success: false, 
                                message: '无法识别的数据格式',
                                skipped: true,
                                reason: '格式不匹配'
                            });
                            return;
                        }

                        // 验证真题数据
                        try {
                            ExamDataUtils.validateExamData(examData);
                        } catch (validationError) {
                            console.warn('数据验证警告:', validationError.message);
                        }

                        const paper = examData.exam_paper;

                        // 检查重复试卷
                        const existingPaper = await this.findExistingExamPaper(paper);
                        
                        if (existingPaper && this.importMode === 'skip') {
                            resolve({
                                skipped: true,
                                reason: '真题试卷已存在且设置为跳过模式',
                                existingId: existingPaper.id
                            });
                            return;
                        }

                        if (existingPaper && this.importMode === 'update') {
                            await this.deleteExamPaper(existingPaper.id);
                            console.log(`🗑️ 删除重复真题试卷 ID: ${existingPaper.id}`);
                        }

                        // 导入真题数据
                        const importResult = await this.importExamToDatabase(
                            paper, 
                            examData.sections, 
                            examData.questions
                        );
                        
                        resolve({
                            success: true,
                            message: `真题数据导入成功: ${paper.title}`,
                            data: {
                                paperId: importResult.paperId,
                                sections: importResult.sections,
                                questions: importResult.questions,
                                totalSections: importResult.sections.length,
                                totalQuestions: importResult.questions
                            }
                        });
                    }

                } catch (error) {
                    console.error('导入真题数据过程错误:', error);
                    reject(new Error(`导入真题数据失败: ${error.message}`));
                }
            });
        });
    }

    // 新增：专门处理分离格式数据的方法
    async importSeparatedExamData(separatedData) {
        try {
            console.log('📝 开始处理分离格式数据...');
            
            const papers = separatedData.exam_papers || [];
            const sections = separatedData.exam_sections || [];
            const questions = separatedData.exam_questions || [];
            
            console.log(`📊 数据统计: ${papers.length} 套试卷, ${sections.length} 个部分, ${questions.length} 道题目`);
            
            if (papers.length === 0) {
                return { 
                    success: false, 
                    message: '分离格式数据中没有试卷数据',
                    skipped: true,
                    reason: '无试卷数据'
                };
            }

            const results = [];
            let totalImported = 0;
            let totalSkipped = 0;

            // 按试卷处理
            for (const paperData of papers) {
                try {
                    // 检查重复试卷
                    const existingPaper = await this.findExistingExamPaper(paperData);
                    
                    if (existingPaper && this.importMode === 'skip') {
                        console.log(`⏭️ 跳过重复试卷: ${paperData.title}`);
                        totalSkipped++;
                        continue;
                    }

                    if (existingPaper && this.importMode === 'update') {
                        await this.deleteExamPaper(existingPaper.id);
                        console.log(`🗑️ 删除重复真题试卷 ID: ${existingPaper.id}`);
                    }

                    // 获取该试卷对应的部分
                    const paperSections = sections.filter(section => section.paper_id === paperData.id);
                    
                    // 获取这些部分对应的题目
                    const sectionIds = paperSections.map(section => section.id);
                    const paperQuestions = questions.filter(question => 
                        sectionIds.includes(question.section_id)
                    );

                    console.log(`📋 试卷 ${paperData.title}: ${paperSections.length} 个部分, ${paperQuestions.length} 道题目`);

                    // 导入试卷
                    const importResult = await this.importExamToDatabase(
                        paperData,
                        paperSections,
                        paperQuestions
                    );

                    results.push({
                        paper: paperData.title,
                        success: true,
                        paperId: importResult.paperId,
                        sections: importResult.sections,
                        questions: importResult.questions
                    });

                    totalImported++;
                    console.log(`✅ 成功导入试卷: ${paperData.title}`);

                } catch (error) {
                    console.error(`❌ 导入试卷 ${paperData.title} 失败:`, error.message);
                    results.push({
                        paper: paperData.title,
                        success: false,
                        error: error.message
                    });
                }
            }

            return {
                success: true,
                message: `分离格式数据导入完成: 成功 ${totalImported}, 跳过 ${totalSkipped}`,
                data: {
                    imported: totalImported,
                    skipped: totalSkipped,
                    details: results
                }
            };

        } catch (error) {
            console.error('处理分离格式数据失败:', error);
            throw new Error(`分离格式数据导入失败: ${error.message}`);
        }
    }

    // 新增：将题目分配到对应的部分 - 修复版本
    assignQuestionsToSections(examData, sectionIdMap = null) {
        if (!examData.sections || !examData.questions) return;
        
        // 创建sectionId到section对象的映射
        const sectionMap = {};
        examData.sections.forEach(section => {
            sectionMap[section.id] = section;
            section.questions = []; // 初始化题目数组
        });
        
        // 将题目分配到对应的部分
        examData.questions.forEach(question => {
            let targetSectionId = question.section_id;
            
            // 关键修复：如果有sectionId映射，使用数据库中的真实section_id
            if (sectionIdMap && sectionIdMap[question.section_id]) {
                targetSectionId = sectionIdMap[question.section_id];
                question.section_id = targetSectionId; // 更新为数据库ID
            }
            
            const section = sectionMap[targetSectionId];
            if (section) {
                section.questions.push(question);
            } else {
                console.warn(`⚠️ 题目 ${question.id} 对应的部分 ${question.section_id} 不存在`);
            }
        });
        
        // 更新exam_paper的sections
        examData.exam_paper.sections = examData.sections;
    }

    // 查找现有真题试卷
    async findExistingExamPaper(paper) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id FROM exam_papers 
                WHERE exam_type = ? AND year = ? AND month = ? AND paper_number = ?
            `;
            this.db.get(query, [paper.exam_type, paper.year, paper.month, paper.paper_number || 1], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    // 删除真题试卷
    async deleteExamPaper(paperId) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run("DELETE FROM exam_questions WHERE section_id IN (SELECT id FROM exam_sections WHERE paper_id = ?)", [paperId], (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    this.db.run("DELETE FROM exam_sections WHERE paper_id = ?", [paperId], (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        this.db.run("DELETE FROM exam_papers WHERE id = ?", [paperId], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                });
            });
        });
    }

    // 修改导入到数据库的方法，使用完全正确的表结构
    async importExamToDatabase(paper, sections = null, questions = null) {
        return new Promise((resolve, reject) => {
            const self = this;
            
            self.db.serialize(() => {
                // 插入试卷主记录
                const paperStmt = self.db.prepare(`
                    INSERT INTO exam_papers 
                    (exam_type, year, month, paper_number, title, description, total_score, time_allowed, sections_count, questions_count, difficulty, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                // 计算题目总数
                let totalQuestions = 0;
                if (questions && questions.length > 0) {
                    totalQuestions = questions.length;
                } else if (sections && sections.length > 0) {
                    sections.forEach(section => {
                        totalQuestions += section.questions ? section.questions.length : 0;
                    });
                }
                
                paperStmt.run([
                    paper.exam_type,
                    paper.year,
                    paper.month,
                    paper.paper_number || 1,
                    paper.title,
                    paper.description || '',
                    paper.total_score || 710,
                    paper.time_allowed || 125,
                    sections ? sections.length : 0,
                    totalQuestions,
                    paper.difficulty || 'medium',
                    paper.is_active !== undefined ? paper.is_active : 1
                ], async function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    const paperId = this.lastID;
                    const sectionResults = [];
                    let totalImportedQuestions = 0;
                    
                    console.log(`✅ 插入真题试卷: ${paper.title} (ID: ${paperId})`);
                    
                    // 处理部分数据
                    const sectionsToProcess = sections || [];
                    if (sectionsToProcess.length > 0) {
                        // ✅ 使用完全正确的 exam_sections 表结构
                        const sectionStmt = self.db.prepare(`
                            INSERT INTO exam_sections 
                            (paper_id, section_type, section_name, section_order, time_allowed, directions, 
                             passage_content, translation_content, translation_requirements, 
                             passage_title, passage_type, has_multiple_passages, questions_count)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `);
                        
                        let processedSections = 0;
                        const totalSections = sectionsToProcess.length;
                        
                        // 处理每个section
                        const processSection = async (section, index) => {
                            return new Promise((resolveSection) => {
                                // 计算该section的题目数量
                                let sectionQuestionsCount = 0;
                                if (questions && questions.length > 0) {
                                    // 分离格式：根据section_id筛选题目
                                    sectionQuestionsCount = questions.filter(q => q.section_id === section.id).length;
                                } else if (section.questions) {
                                    sectionQuestionsCount = section.questions.length;
                                }
                                
                                // ✅ 使用完全正确的字段列表
                                sectionStmt.run([
                                    paperId,
                                    section.section_type,
                                    section.section_name,
                                    section.section_order || index,
                                    section.time_allowed || 0,
                                    section.directions || '',
                                    section.passage_content || '',
                                    section.translation_content || '',
                                    section.translation_requirements || '',
                                    section.passage_title || '',
                                    section.passage_type || 'reading',
                                    section.has_multiple_passages ? 1 : 0,
                                    sectionQuestionsCount
                                ], async function(err) {
                                    if (err) {
                                        console.error('插入部分失败:', err);
                                        console.error('错误详情:', err.message);
                                        processedSections++;
                                        resolveSection(0);
                                        return;
                                    }

                                    const sectionId = this.lastID;
                                    
                                    sectionResults.push({
                                        sectionId: sectionId,
                                        sectionType: section.section_type,
                                        sectionName: section.section_name
                                    });
                                    
                                    console.log(`   ✅ 插入部分: ${section.section_name} (ID: ${sectionId})`);
                                    
                                    let importedCount = 0;
                                    
                                    // 插入题目 - 处理分离格式的题目
                                    if (questions && questions.length > 0) {
                                        // 分离格式：根据section_id筛选题目
                                        const sectionQuestions = questions.filter(q => q.section_id === section.id);
                                        if (sectionQuestions.length > 0) {
                                            try {
                                                importedCount = await self.importQuestions(sectionId, section, sectionQuestions);
                                                totalImportedQuestions += importedCount;
                                                console.log(`     📝 插入 ${importedCount} 道题目到部分 ${section.section_name}`);
                                            } catch (err) {
                                                console.error('插入题目失败:', err);
                                            }
                                        }
                                    } else if (section.questions && section.questions.length > 0) {
                                        // 标准格式：直接插入section中的题目
                                        try {
                                            importedCount = await self.importQuestions(sectionId, section, section.questions);
                                            totalImportedQuestions += importedCount;
                                            console.log(`     📝 插入 ${importedCount} 道题目到部分 ${section.section_name}`);
                                        } catch (err) {
                                            console.error('插入题目失败:', err);
                                        }
                                    }
                                    
                                    processedSections++;
                                    resolveSection(importedCount);
                                    
                                    // 检查是否所有section都处理完成
                                    if (processedSections === totalSections) {
                                        sectionStmt.finalize();
                                        
                                        // 更新试卷的题目总数
                                        self.db.run(
                                            "UPDATE exam_papers SET questions_count = ? WHERE id = ?",
                                            [totalImportedQuestions, paperId],
                                            (err) => {
                                                if (err) {
                                                    console.error('更新题目总数失败:', err);
                                                }
                                                
                                                console.log(`📊 试卷 ${paper.title} 导入完成: ${totalImportedQuestions} 道题目`);
                                                resolve({
                                                    paperId: paperId,
                                                    sections: sectionResults,
                                                    questions: totalImportedQuestions
                                                });
                                            }
                                        );
                                    }
                                });
                            });
                        };
                        
                        // 依次处理每个section
                        (async () => {
                            for (let i = 0; i < sectionsToProcess.length; i++) {
                                await processSection(sectionsToProcess[i], i);
                            }
                        })();
                    } else {
                        resolve({
                            paperId: paperId,
                            sections: [],
                            questions: 0
                        });
                    }
                });
            });
        });
    }

    // ✅ 使用完全正确的 exam_questions 表结构
    async importQuestions(sectionId, sectionData, questions) {
        const self = this;
        
        return new Promise((resolve, reject) => {
            // ✅ 使用完全正确的题目表字段结构
            const questionStmt = self.db.prepare(`
                INSERT INTO exam_questions 
                (section_id, question_type, question_number, question_text, 
                 options, correct_answer, analysis, explanation, 
                 question_order, score, requires_passage)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            let questionCount = 0;
            let completed = 0;
            const totalQuestions = questions.length;
            
            if (totalQuestions === 0) {
                questionStmt.finalize();
                resolve(0);
                return;
            }
            
            console.log(`    🎯 开始插入 ${totalQuestions} 道题目...`);
            
            questions.forEach((question, index) => {
                // 确保选项数据是有效的JSON字符串
                let optionsJson = '[]';
                try {
                    if (typeof question.options === 'string') {
                        const parsedOptions = JSON.parse(question.options);
                        optionsJson = JSON.stringify(parsedOptions);
                    } else if (Array.isArray(question.options)) {
                        optionsJson = JSON.stringify(question.options);
                    } else if (question.options) {
                        optionsJson = JSON.stringify(question.options);
                    }
                } catch (e) {
                    console.warn(`题目 ${index + 1} 选项格式错误:`, e.message);
                    optionsJson = '[]';
                }
                
                // 确保问题文本不为空
                const questionText = question.question_text || `题目 ${question.question_number || (index + 1)}`;
                
                // ✅ 使用完全正确的字段列表
                questionStmt.run([
                    sectionId,
                    question.question_type || 'single_choice',
                    question.question_number || (index + 1),
                    questionText,
                    optionsJson,
                    question.correct_answer || '',
                    question.analysis || '',
                    question.explanation || '',
                    index,
                    question.score || 1,
                    question.requires_passage ? 1 : 0
                ], (err) => {
                    if (err) {
                        console.error(`插入题目 ${index + 1} 失败:`, err);
                        console.error('错误详情:', err.message);
                    } else {
                        questionCount++;
                    }
                    
                    completed++;
                    if (completed === totalQuestions) {
                        questionStmt.finalize();
                        console.log(`    ✅ 题目插入完成: ${questionCount}/${totalQuestions}`);
                        resolve(questionCount);
                    }
                });
            });
        });
    }

    // 修改导出方法以匹配正确的表结构
    exportToJSON(outputFile) {
        return new Promise((resolve, reject) => {
            const exportData = {
                exam_papers: [],
                export_time: new Date().toISOString(),
                version: '1.0'
            };

            this.db.serialize(() => {
                // 查询所有试卷
                this.db.all("SELECT * FROM exam_papers WHERE is_active = 1", (err, papers) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    let processed = 0;
                    
                    if (papers.length === 0) {
                        fs.writeFile(outputFile, JSON.stringify(exportData, null, 2), (err) => {
                            if (err) reject(err);
                            else resolve({ success: true, message: '导出完成，无数据' });
                        });
                        return;
                    }
                    
                    papers.forEach(paper => {
                        // 查询每个试卷的部分
                        this.db.all(
                            "SELECT * FROM exam_sections WHERE paper_id = ? ORDER BY section_order ASC",
                            [paper.id],
                            (err, sections) => {
                                if (err) {
                                    console.error('查询部分失败:', err);
                                    processed++;
                                    return;
                                }

                                const paperWithSections = {
                                    exam_type: paper.exam_type,
                                    year: paper.year,
                                    month: paper.month,
                                    paper_number: paper.paper_number,
                                    title: paper.title,
                                    description: paper.description,
                                    total_score: paper.total_score,
                                    time_allowed: paper.time_allowed,
                                    sections: []
                                };

                                let sectionsProcessed = 0;
                                
                                if (sections.length === 0) {
                                    exportData.exam_papers.push(paperWithSections);
                                    processed++;
                                    if (processed === papers.length) {
                                        this.finalizeExport(exportData, outputFile, resolve, reject);
                                    }
                                    return;
                                }

                                sections.forEach(section => {
                                    // 查询每个部分的题目
                                    this.db.all(
                                        "SELECT * FROM exam_questions WHERE section_id = ? ORDER BY question_order ASC",
                                        [section.id],
                                        (err, questions) => {
                                            if (err) {
                                                console.error('查询题目失败:', err);
                                                sectionsProcessed++;
                                                return;
                                            }

                                            const processedQuestions = questions.map(q => {
                                                try {
                                                    q.options = JSON.parse(q.options);
                                                } catch (e) {
                                                    q.options = [];
                                                }
                                                return {
                                                    question_type: q.question_type,
                                                    question_number: q.question_number,
                                                    question_text: q.question_text,
                                                    options: q.options,
                                                    correct_answer: q.correct_answer,
                                                    analysis: q.analysis,
                                                    explanation: q.explanation,
                                                    audio_start_time: q.audio_start_time,
                                                    audio_end_time: q.audio_end_time,
                                                    score: q.score || 1
                                                };
                                            });

                                            // 修改：在导出section时包含正确的字段
                                            paperWithSections.sections.push({
                                                section_type: section.section_type,
                                                section_name: section.section_name,
                                                time_allowed: section.time_allowed,
                                                directions: section.directions,
                                                passage_content: section.passage_content || '',
                                                translation_content: section.translation_content || '',
                                                translation_requirements: section.translation_requirements || '',
                                                questions: processedQuestions
                                            });

                                            sectionsProcessed++;
                                            
                                            if (sectionsProcessed === sections.length) {
                                                exportData.exam_papers.push(paperWithSections);
                                                processed++;
                                                
                                                if (processed === papers.length) {
                                                    this.finalizeExport(exportData, outputFile, resolve, reject);
                                                }
                                            }
                                        }
                                    );
                                });
                            }
                        );
                    });
                });
            });
        });
    }

    finalizeExport(exportData, outputFile, resolve, reject) {
        fs.writeFile(outputFile, JSON.stringify(exportData, null, 2), (err) => {
            if (err) {
                reject(err);
            } else {
                console.log(`✅ 数据已导出到: ${outputFile}`);
                resolve({ 
                    success: true, 
                    message: `导出完成，共${exportData.exam_papers.length}套试卷`,
                    file: outputFile 
                });
            }
        });
    }

    // 查看数据统计
    getStatistics() {
        return new Promise((resolve, reject) => {
            const queries = {
                total_papers: "SELECT COUNT(*) as count FROM exam_papers WHERE is_active = 1",
                total_sections: "SELECT COUNT(*) as count FROM exam_sections",
                total_questions: "SELECT COUNT(*) as count FROM exam_questions",
                papers_by_type: "SELECT exam_type, COUNT(*) as count FROM exam_papers WHERE is_active = 1 GROUP BY exam_type",
                sections_by_type: "SELECT section_type, COUNT(*) as count FROM exam_sections GROUP BY section_type"
            };

            const results = {};
            let completed = 0;
            const totalQueries = Object.keys(queries).length;

            Object.entries(queries).forEach(([key, query]) => {
                this.db.get(query, (err, result) => {
                    if (err) {
                        console.error(`查询${key}失败:`, err);
                        results[key] = { error: err.message };
                    } else {
                        results[key] = result;
                    }

                    completed++;
                    if (completed === totalQueries) {
                        resolve(results);
                    }
                });
            });
        });
    }

    // 清理数据
    async cleanupData() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run("DELETE FROM exam_questions", (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    this.db.run("DELETE FROM exam_sections", (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        this.db.run("DELETE FROM exam_papers", (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve({ success: true, message: '真题数据清理完成' });
                            }
                        });
                    });
                });
            });
        });
    }
}

module.exports = ExamDataManager;