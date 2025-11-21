// tools/import-export-utils.js
const fs = require('fs');
const path = require('path');

class ImportExportUtils {
    // 统一的真题数据验证
    static validateRealExamData(examData) {
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

    // 统一数据标准化
    static normalizeRealExamData(data) {
        // 如果已经是标准格式
        if (data.exam_paper) {
            return data;
        }
        
        // 如果是听力数据格式，转换为标准格式
        if (data.papers && Array.isArray(data.papers)) {
            return this.convertListeningToRealExam(data);
        }
        
        // 如果是单个试卷对象
        if (data.exam_type && data.year && data.month) {
            return this.convertPaperToRealExam(data);
        }
        
        throw new Error('无法识别的真题数据格式');
    }

    // 将听力数据转换为真题格式
    static convertListeningToRealExam(listeningData) {
        const examPaper = listeningData.papers[0]; // 取第一个试卷
        
        return {
            exam_paper: {
                exam_type: examPaper.exam_type,
                year: examPaper.year,
                month: examPaper.month,
                paper_number: examPaper.paper_number || 1,
                title: examPaper.title,
                description: examPaper.description,
                total_score: 710,
                time_allowed: 125,
                sections: [
                    {
                        section_type: "listening",
                        section_name: "听力部分",
                        time_allowed: "25 minutes",
                        questions: examPaper.questions || []
                    }
                ]
            }
        };
    }

    // 将单个试卷对象转换为真题格式
    static convertPaperToRealExam(paperData) {
        return {
            exam_paper: {
                exam_type: paperData.exam_type,
                year: paperData.year,
                month: paperData.month,
                paper_number: paperData.paper_number || 1,
                title: paperData.title,
                description: paperData.description || '',
                total_score: 710,
                time_allowed: 125,
                sections: paperData.sections || []
            }
        };
    }

    // 验证试卷数据 - 放宽验证条件
    static validatePaperData(paper) {
        if (!paper) {
            throw new Error('试卷数据为空');
        }

        const required = ['exam_type', 'year', 'month', 'title'];
        const missing = required.filter(field => !paper[field]);
        
        if (missing.length > 0) {
            throw new Error(`试卷数据缺少必要字段: ${missing.join(', ')}`);
        }

        if (!['CET-4', 'CET-6'].includes(paper.exam_type)) {
            throw new Error('考试类型必须是 CET-4 或 CET-6');
        }

        if (paper.year < 1980 || paper.year > 2030) {
            throw new Error('年份必须在 1980-2030 之间');
        }

        return true;
    }

    static validateQuestionData(question) {
        const required = ['section_type', 'question_number', 'question_text', 'options', 'correct_answer'];
        const missing = required.filter(field => !question[field]);
        
        if (missing.length > 0) {
            throw new Error(`题目数据缺少必要字段: ${missing.join(', ')}`);
        }

        if (!['short', 'long', 'passage', 'lecture'].includes(question.section_type)) {
            throw new Error('题目类型必须是 short, long, passage 或 lecture');
        }

        return true;
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
                this.validatePaperData(paper);
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

    // 添加一个更宽松的数据格式转换函数
    static normalizeExamData(data) {
        if (Array.isArray(data)) {
            return { papers: data };
        }
        
        if (data.papers && Array.isArray(data.papers)) {
            return data;
        }
        
        // 尝试查找其他可能的字段
        const possibleArrayFields = ['exams', 'listening_papers', 'data', 'items'];
        for (const field of possibleArrayFields) {
            if (data[field] && Array.isArray(data[field])) {
                return { papers: data[field] };
            }
        }
        
        // 如果是单个试卷对象
        if (data.exam_type && data.year && data.month) {
            return { papers: [data] };
        }
        
        throw new Error('无法识别的数据格式');
    }

    // 从CSV导入 - 增强路径处理
    static parseCSVData(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim());
        const papers = [];
        let currentPaper = null;

        for (const line of lines) {
            const [type, year, month, paperNum, title, audioFile, section, qNum, question, options, answer] = line.split(',');

            if (type && year) {
                // 新试卷
                currentPaper = {
                    exam_type: type,
                    year: parseInt(year),
                    month: parseInt(month),
                    paper_number: parseInt(paperNum) || 1,
                    title: title,
                    audio_file: audioFile,
                    audio_url: this.generateAudioUrl(type, audioFile),
                    total_questions: 0,
                    difficulty: 'medium',
                    questions: []
                };
                papers.push(currentPaper);
            }

            if (currentPaper && section && qNum) {
                // 题目数据
                const questionData = {
                    section_type: section,
                    question_number: parseInt(qNum),
                    question_text: question,
                    options: this.safeJSONParse(options || '[]'),
                    correct_answer: answer,
                    audio_start_time: 0,
                    audio_end_time: 0
                };
                currentPaper.questions.push(questionData);
                currentPaper.total_questions++;
            }
        }

        return { papers };
    }

    // 生成音频URL - 增强路径兼容性
    static generateAudioUrl(examType, audioFile) {
        if (!audioFile) return '';
        
        const folderName = examType === 'CET-4' ? '四级听力' : '六级听力';
        
        // 检查文件是否存在于不同路径
        const possiblePaths = [
            path.join(__dirname, '../真题与听力', folderName, audioFile),
            path.join(__dirname, '../真题与听力', `${folderName}真题`, audioFile),
            path.join('E:/编程库/云梦智间英语/真题与听力', `${folderName}真题`, audioFile),
            path.join(__dirname, '../../真题与听力', folderName, audioFile)
        ];
        
        // 返回第一个存在的路径，否则使用默认路径
        for (const filePath of possiblePaths) {
            if (fs.existsSync(filePath)) {
                return `/${folderName}/${audioFile}`;
            }
        }
        
        // 如果文件不存在，仍然返回默认URL（可能在后续上传）
        return `/${folderName}/${audioFile}`;
    }

    // 安全的JSON解析
    static safeJSONParse(str) {
        try {
            return JSON.parse(str);
        } catch (e) {
            console.warn('JSON解析失败，使用默认值:', e.message);
            return [];
        }
    }

    // 生成CSV导出
    static generateCSVData(papersData) {
        let csv = '考试类型,年份,月份,套数,标题,音频文件,题目类型,题号,问题内容,选项,正确答案\n';
        
        papersData.papers.forEach(paper => {
            paper.questions.forEach(question => {
                csv += `"${paper.exam_type}","${paper.year}","${paper.month}","${paper.paper_number}","${paper.title}","${paper.audio_file}","${question.section_type}","${question.question_number}","${question.question_text}","${JSON.stringify(question.options)}","${question.correct_answer}"\n`;
            });
        });

        return csv;
    }

    // 备份现有数据
    static backupExistingData(db, backupFile) {
        return new Promise((resolve, reject) => {
            const exportData = { papers: [] };

            db.all("SELECT * FROM listening_exam_papers WHERE is_active = 1", (err, papers) => {
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
                        "SELECT * FROM listening_exam_questions WHERE paper_id = ? ORDER BY sort_order ASC",
                        [paper.id],
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

                            exportData.papers.push({
                                ...paper,
                                questions: processedQuestions
                            });

                            processed++;
                            
                            if (processed === papers.length) {
                                fs.writeFile(backupFile, JSON.stringify(exportData, null, 2), (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                });
                            }
                        }
                    );
                });
            });
        });
    }

    // 检查音频文件是否存在
    static checkAudioFiles(papersData) {
        const results = {
            total: 0,
            found: 0,
            missing: [],
            details: []
        };

        papersData.papers.forEach(paper => {
            if (!paper.audio_file) {
                results.total++;
                results.details.push({
                    paper: paper.title,
                    audio_file: '(无音频文件)',
                    status: '无音频',
                    path: ''
                });
                return;
            }

            const folderName = paper.exam_type === 'CET-4' ? '四级听力' : '六级听力';
            const possiblePaths = [
                path.join(__dirname, '../真题与听力', folderName, paper.audio_file),
                path.join(__dirname, '../真题与听力', `${folderName}真题`, paper.audio_file),
                path.join('E:/编程库/云梦智间英语/真题与听力', `${folderName}真题`, paper.audio_file)
            ];

            let found = false;
            let foundPath = '';

            for (const filePath of possiblePaths) {
                if (fs.existsSync(filePath)) {
                    found = true;
                    foundPath = filePath;
                    break;
                }
            }

            results.total++;
            if (found) {
                results.found++;
                results.details.push({
                    paper: paper.title,
                    audio_file: paper.audio_file,
                    status: '存在',
                    path: foundPath
                });
            } else {
                results.missing.push({
                    paper: paper.title,
                    audio_file: paper.audio_file,
                    expected_paths: possiblePaths
                });
                results.details.push({
                    paper: paper.title,
                    audio_file: paper.audio_file,
                    status: '缺失',
                    paths: possiblePaths
                });
            }
        });

        return results;
    }
}

module.exports = ImportExportUtils;