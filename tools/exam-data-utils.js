// tools/exam-data-utils.js
const fs = require('fs');
const path = require('path');

class ExamDataUtils {
    // 统一的真题数据验证
    static validateExamData(examData) {
        if (!examData || !examData.exam_paper) {
            throw new Error('真题数据格式错误：缺少exam_paper字段');
        }

        const paper = examData.exam_paper;
        const required = ['exam_type', 'year', 'month', 'title'];
        const missing = required.filter(field => !paper[field]);
        
        if (missing.length > 0) {
            throw new Error(`真题数据缺少必要字段: ${missing.join(', ')}`);
        }

        if (!['CET-4', 'CET-6'].includes(paper.exam_type)) {
            throw new Error('考试类型必须是 CET-4 或 CET-6');
        }

        if (paper.year < 1980 || paper.year > 2030) {
            throw new Error('年份必须在 1980-2030 之间');
        }

        return true;
    }

    // 统一数据标准化 - 增强版本，支持分离格式数据和长阅读文章内容处理
    static normalizeExamData(data) {
        // 如果已经是标准格式
        if (data.exam_paper && data.exam_paper.sections) {
            // 确保新字段有默认值
            this.ensureNewFields(data.exam_paper);
            // 增强长阅读文章内容处理
            this.enhanceReadingPassages(data.exam_paper);
            return data;
        }
        
        // 如果是分离格式（您的JSON格式）
        const separatedData = this.normalizeSeparatedExamData(data);
        if (separatedData) {
            return separatedData;
        }
        
        // 如果是听力数据格式，转换为标准格式
        if (data.papers && Array.isArray(data.papers)) {
            const convertedData = this.convertListeningToExamData(data);
            if (convertedData) {
                this.ensureNewFields(convertedData.exam_paper);
                this.enhanceReadingPassages(convertedData.exam_paper);
            }
            return convertedData;
        }
        
        // 如果是单个试卷对象
        if (data.exam_type && data.year && data.month) {
            const convertedData = this.convertPaperToExamData(data);
            this.ensureNewFields(convertedData.exam_paper);
            this.enhanceReadingPassages(convertedData.exam_paper);
            return convertedData;
        }
        
        throw new Error('无法识别的真题数据格式');
    }

    // 🔧 增强分离格式数据的验证和标准化
    static normalizeSeparatedExamData(data) {
        if (data.exam_papers && data.exam_sections && data.exam_questions) {
            console.log('检测到分离格式的真题数据，开始转换...');
            
            // 对于分离格式，我们直接返回原始数据，让导入器处理关联关系
            return {
                isSeparatedFormat: true,
                exam_papers: data.exam_papers,
                exam_sections: data.exam_sections,
                exam_questions: data.exam_questions
            };
        }
        return null;
    }

    // 🔧 新增：确保新字段有默认值
    static ensureNewFields(paper) {
        if (paper.sections && Array.isArray(paper.sections)) {
            paper.sections.forEach(section => {
                // 为 section 添加新字段的默认值
                section.passage_content = section.passage_content || '';
                section.translation_content = section.translation_content || ''; // 新增
                section.translation_requirements = section.translation_requirements || ''; // 新增
                section.passage_title = section.passage_title || '';
                section.passage_type = section.passage_type || 'reading';
                section.passage_reference = section.passage_reference || '';
                section.has_multiple_passages = section.has_multiple_passages || false;
                
                // 为题目添加新字段的默认值
                if (section.questions && Array.isArray(section.questions)) {
                    section.questions.forEach(question => {
                        question.passage_content = question.passage_content || '';
                        question.passage_reference = question.passage_reference || '';
                        question.is_reading_question = question.is_reading_question || false;
                        question.requires_passage = question.requires_passage || false;
                    });
                }
            });
        }
    }

    // 🔧 新增：增强长阅读文章内容处理
    static enhanceReadingPassages(paper) {
        if (paper.sections && Array.isArray(paper.sections)) {
            paper.sections.forEach(section => {
                // 专门处理阅读理解部分
                if (section.section_type === 'reading' && section.content) {
                    this.processReadingSection(section);
                }
                
                // 新增：专门处理翻译部分
                if (section.section_type === 'translation' && section.content) {
                    this.processTranslationSection(section);
                }
                
                // 确保每个题目都有 passage_content 字段
                if (section.questions && Array.isArray(section.questions)) {
                    section.questions.forEach(question => {
                        if (question.passage_content === undefined) {
                            question.passage_content = '';
                        }
                    });
                }
            });
        }
    }

    // 🔧 新增：处理阅读理解部分的文章内容
    static processReadingSection(section) {
        const content = section.content;
        
        if (!section.questions || !Array.isArray(section.questions)) {
            return;
        }
        
        // 如果section.content包含多篇文章，为每个题目分配对应的文章内容
        if (content.passage1 && content.passage2) {
            section.questions.forEach((question, index) => {
                const questionNumber = question.question_number || (index + 1);
                
                // 根据题目编号智能分配文章内容
                if (questionNumber >= 46 && questionNumber <= 50) {
                    question.passage_content = content.passage1;
                    question.passage_reference = 'passage1';
                } else if (questionNumber >= 51 && questionNumber <= 55) {
                    question.passage_content = content.passage2;
                    question.passage_reference = 'passage2';
                } else if (index < 5) {
                    // 按索引分配作为后备方案
                    question.passage_content = content.passage1;
                    question.passage_reference = 'passage1';
                } else {
                    question.passage_content = content.passage2;
                    question.passage_reference = 'passage2';
                }
            });
        } 
        // 单篇文章的情况
        else if (content.passage) {
            section.questions.forEach(question => {
                question.passage_content = content.passage;
                question.passage_reference = 'passage';
            });
        }
        // 如果content本身就是文章内容
        else if (typeof content === 'string') {
            section.questions.forEach(question => {
                question.passage_content = content;
                question.passage_reference = 'main';
            });
        }
    }

    // 🔧 新增：处理翻译部分的内容
    static processTranslationSection(section) {
        const content = section.content;
        
        // 设置翻译原文到section级别
        if (typeof content === 'string') {
            section.translation_content = content;
        } else if (content.translation) {
            section.translation_content = content.translation;
        } else if (content.passage) {
            section.translation_content = content.passage;
        }
        
        // 清理题目级别的passage_content，避免混淆
        if (section.questions && Array.isArray(section.questions)) {
            section.questions.forEach(question => {
                question.passage_content = ''; // 翻译题不在题目级别存储原文
            });
        }
    }

    // 将听力数据转换为真题格式
    static convertListeningToExamData(listeningData) {
        const papers = listeningData.papers || [];
        const convertedPapers = papers.map(paper => {
            return {
                exam_paper: {
                    exam_type: paper.exam_type,
                    year: paper.year,
                    month: paper.month,
                    paper_number: paper.paper_number || 1,
                    title: paper.title,
                    description: paper.description,
                    total_score: 710,
                    time_allowed: 125,
                    sections: [
                        {
                            section_type: "listening",
                            section_name: "听力部分",
                            time_allowed: "25 minutes",
                            directions: "这部分有多个小节，请仔细听录音并回答问题。",
                            questions: paper.questions || []
                        }
                    ]
                }
            };
        });

        // 如果是单个试卷，返回第一个
        return convertedPapers.length > 0 ? convertedPapers[0] : null;
    }

    // 将单个试卷对象转换为真题格式
    static convertPaperToExamData(paperData) {
        return {
            exam_paper: {
                exam_type: paperData.exam_type,
                year: paperData.year,
                month: paperData.month,
                paper_number: paperData.paper_number || 1,
                title: paperData.title,
                description: paperData.description || '',
                total_score: paperData.total_score || 710,
                time_allowed: paperData.time_allowed || 125,
                sections: paperData.sections || []
            }
        };
    }

    // 批量验证数据
    static validatePapersBatch(papers) {
        const results = {
            valid: [],
            invalid: [],
            duplicates: []
        };

        papers.forEach(paper => {
            try {
                this.validateExamData({ exam_paper: paper });
                results.valid.push(paper);
            } catch (error) {
                results.invalid.push({
                    paper: paper.title || '未知试卷',
                    error: error.message
                });
            }
        });

        return results;
    }

    // 生成CSV导出 - 添加 passage_content 字段支持
    static generateCSVData(examData) {
        let csv = '考试类型,年份,月份,套数,标题,部分类型,部分名称,题号,问题内容,文章内容,选项,正确答案,解析\n';
        
        const paper = examData.exam_paper;
        paper.sections.forEach(section => {
            section.questions.forEach(question => {
                // 转义引号，避免CSV格式问题
                const questionText = (question.question_text || '').replace(/"/g, '""');
                const passageContent = (question.passage_content || '').replace(/"/g, '""');
                
                csv += `"${paper.exam_type}","${paper.year}","${paper.month}","${paper.paper_number}","${paper.title}","${section.section_type}","${section.section_name}","${question.question_number}","${questionText}","${passageContent}","${JSON.stringify(question.options)}","${question.correct_answer}","${question.analysis}"\n`;
            });
        });

        return csv;
    }

    // 备份现有数据
    static backupExistingData(db, backupFile) {
        return new Promise((resolve, reject) => {
            const exportData = { exam_papers: [] };

            db.all("SELECT * FROM exam_papers WHERE is_active = 1", (err, papers) => {
                if (err) {
                    reject(err);
                    return;
                }

                let processed = 0;
                if (papers.length === 0) {
                    fs.writeFileSync(backupFile, JSON.stringify(exportData, null, 2));
                    resolve();
                    return;
                }

                papers.forEach(paper => {
                    db.all(
                        "SELECT * FROM exam_sections WHERE paper_id = ? ORDER BY section_order ASC",
                        [paper.id],
                        (err, sections) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            const paperWithSections = {
                                ...paper,
                                sections: []
                            };

                            let sectionsProcessed = 0;
                            
                            if (sections.length === 0) {
                                exportData.exam_papers.push(paperWithSections);
                                processed++;
                                if (processed === papers.length) {
                                    fs.writeFileSync(backupFile, JSON.stringify(exportData, null, 2));
                                    resolve();
                                }
                                return;
                            }

                            sections.forEach(section => {
                                db.all(
                                    "SELECT * FROM exam_questions WHERE section_id = ? ORDER BY question_order ASC",
                                    [section.id],
                                    (err, questions) => {
                                        if (err) {
                                            reject(err);
                                            return;
                                        }

                                        const processedQuestions = questions.map(q => {
                                            try {
                                                q.options = JSON.parse(q.options);
                                            } catch (e) {
                                                q.options = [];
                                            }
                                            return q;
                                        });

                                        paperWithSections.sections.push({
                                            ...section,
                                            questions: processedQuestions
                                        });

                                        sectionsProcessed++;
                                        
                                        if (sectionsProcessed === sections.length) {
                                            exportData.exam_papers.push(paperWithSections);
                                            processed++;
                                            
                                            if (processed === papers.length) {
                                                fs.writeFile(backupFile, JSON.stringify(exportData, null, 2), (err) => {
                                                    if (err) reject(err);
                                                    else resolve();
                                                });
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
    }
}

module.exports = ExamDataUtils;