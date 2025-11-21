// [file name]: server_modules/services/file-scanner-service.js
const fs = require('fs');
const path = require('path');
const PDFParserEnhanced = require('./pdf-parser-enhanced.js');

class FileScannerService {
    constructor() {
        // 修改为支持多个目录
        this.basePaths = [
            path.join(__dirname, '../../真题与听力/download四级'),
            path.join(__dirname, '../../真题与听力/download')
        ];
        
        console.log('📄 PDF扫描服务初始化 - 扫描目录:', this.basePaths);
    }

    // 使用增强PDF解析提取文本
    async extractTextFromPDF(pdfBuffer) {
        try {
            console.log('开始解析PDF文件...');
            
            // 使用增强的PDF解析
            const result = await PDFParserEnhanced.extractTextFromPDF(pdfBuffer);
            
            if (result.success) {
                console.log(`✅ PDF解析成功，提取字符数: ${result.text.length} (方法: ${result.method})`);
            } else {
                console.log(`❌ PDF解析失败: ${result.message}`);
            }
            
            return result;
            
        } catch (error) {
            console.error('PDF解析异常:', error);
            return {
                success: false,
                message: 'PDF解析异常: ' + error.message
            };
        }
    }

    // 修改扫描目录方法
    async scanDirectory() {
        try {
            console.log('开始扫描真题目录:', this.basePaths);
            
            let allFiles = [];
            
            // 扫描所有目录
            for (const basePath of this.basePaths) {
                if (!fs.existsSync(basePath)) {
                    console.warn(`目录不存在: ${basePath}`);
                    continue;
                }

                const files = fs.readdirSync(basePath);
                const pdfFiles = files.filter(file => 
                    file.toLowerCase().endsWith('.pdf')
                ).map(file => ({
                    filename: file,
                    filepath: path.join(basePath, file),
                    basePath: path.basename(basePath) // 记录来源目录
                }));

                console.log(`目录 ${basePath} 找到PDF文件:`, pdfFiles.map(f => f.filename));
                allFiles = allFiles.concat(pdfFiles);
            }

            if (allFiles.length === 0) {
                return {
                    success: false,
                    message: '在所有目录中都没有找到PDF文件'
                };
            }

            // 分类文件：题目文件和答案文件
            const categorizedFiles = this.categorizeFiles(allFiles);
            
            return {
                success: true,
                files: allFiles.map(f => f.filename),
                categorized: categorizedFiles,
                total: allFiles.length,
                basePaths: this.basePaths
            };

        } catch (error) {
            console.error('扫描目录失败:', error);
            return {
                success: false,
                message: '扫描目录失败: ' + error.message
            };
        }
    }

    // 修改分类文件方法，添加目录信息
    categorizeFiles(files) {
        const categorized = {
            questionPapers: [],    // 题目文件
            answerPapers: [],      // 答案文件
            unknown: []            // 未识别文件
        };

        files.forEach(file => {
            const lowerFile = file.filename.toLowerCase();
            
            // 识别答案文件的关键词
            const answerKeywords = ['答案', 'answer', 'ans', '解析', 'analysis', '详解'];
            const isAnswerFile = answerKeywords.some(keyword => 
                lowerFile.includes(keyword.toLowerCase())
            );

            // 识别考试类型和年份
            const examInfo = this.parseExamInfo(file.filename);
            
            const fileInfo = {
                filename: file.filename,
                filepath: file.filepath,
                basePath: file.basePath, // 添加目录信息
                isAnswer: isAnswerFile,
                examInfo: examInfo
            };

            if (isAnswerFile) {
                categorized.answerPapers.push(fileInfo);
            } else {
                categorized.questionPapers.push(fileInfo);
            }
        });

        return categorized;
    }

    // 解析文件名中的考试信息
    parseExamInfo(filename) {
        const patterns = [
            // CET6_2021_06_1.pdf 或 CET6_202106_1.pdf
            /(CET[46])_(\d{4})_?(\d{2})_?(\d)?/i,
            // 2021年6月英语六级真题.pdf
            /(\d{4})年(\d{1,2})月英语([四六])级/,
            // 六级202106.pdf
            /([四六])级(\d{6})/,
            // CET6_2021_12.pdf
            /(CET[46])_(\d{4})_(\d{2})/i
        ];

        for (const pattern of patterns) {
            const match = filename.match(pattern);
            if (match) {
                let examType, year, month, paperNumber = 1;

                if (pattern === patterns[0]) {
                    // CET6_2021_06_1.pdf
                    examType = match[1].toUpperCase();
                    year = parseInt(match[2]);
                    month = parseInt(match[3]);
                    paperNumber = match[4] ? parseInt(match[4]) : 1;
                } else if (pattern === patterns[1]) {
                    // 2021年6月英语六级真题.pdf
                    year = parseInt(match[1]);
                    month = parseInt(match[2]);
                    examType = match[3] === '六' ? 'CET6' : 'CET4';
                } else if (pattern === patterns[2]) {
                    // 六级202106.pdf
                    examType = match[1] === '六' ? 'CET6' : 'CET4';
                    const dateStr = match[2];
                    year = parseInt(dateStr.substring(0, 4));
                    month = parseInt(dateStr.substring(4, 6));
                } else if (pattern === patterns[3]) {
                    // CET6_2021_12.pdf
                    examType = match[1].toUpperCase();
                    year = parseInt(match[2]);
                    month = parseInt(match[3]);
                }

                return {
                    examType,
                    year,
                    month,
                    paperNumber,
                    isValid: true
                };
            }
        }

        return {
            examType: '未知',
            year: 0,
            month: 0,
            paperNumber: 1,
            isValid: false
        };
    }

    // 自动匹配题目文件和答案文件
    async autoMatchFiles() {
        const scanResult = await this.scanDirectory();
        if (!scanResult.success) {
            return scanResult;
        }

        const { questionPapers, answerPapers } = scanResult.categorized;
        const matchedPairs = [];

        // 为每个题目文件寻找匹配的答案文件
        questionPapers.forEach(questionFile => {
            const matchedAnswer = this.findMatchingAnswer(questionFile, answerPapers);
            
            if (matchedAnswer) {
                matchedPairs.push({
                    questionFile,
                    answerFile: matchedAnswer,
                    examInfo: questionFile.examInfo
                });
            } else {
                matchedPairs.push({
                    questionFile,
                    answerFile: null,
                    examInfo: questionFile.examInfo,
                    status: 'missing_answer'
                });
            }
        });

        return {
            success: true,
            matchedPairs,
            unmatchedQuestions: questionPapers.filter(q => 
                !matchedPairs.find(p => p.questionFile.filename === q.filename)
            ),
            unmatchedAnswers: answerPapers.filter(a => 
                !matchedPairs.find(p => p.answerFile && p.answerFile.filename === a.filename)
            )
        };
    }

    // 寻找匹配的答案文件
    findMatchingAnswer(questionFile, answerFiles) {
        const qInfo = questionFile.examInfo;
        
        return answerFiles.find(answerFile => {
            const aInfo = answerFile.examInfo;
            
            // 匹配考试类型、年份、月份
            if (qInfo.examType === aInfo.examType && 
                qInfo.year === aInfo.year && 
                qInfo.month === aInfo.month) {
                
                // 如果都有试卷编号，检查是否匹配
                if (qInfo.paperNumber && aInfo.paperNumber) {
                    return qInfo.paperNumber === aInfo.paperNumber;
                }
                return true;
            }
            return false;
        });
    }

    // 批量导入所有匹配的文件对
    async batchImportAll() {
        const matchResult = await this.autoMatchFiles();
        if (!matchResult.success) {
            return matchResult;
        }

        const importResults = [];
        const { matchedPairs } = matchResult;

        console.log(`开始批量导入 ${matchedPairs.length} 个文件对...`);

        for (const pair of matchedPairs) {
            if (pair.answerFile) {
                const result = await this.importFilePairDirect(pair);
                importResults.push(result);
            } else {
                importResults.push({
                    filename: pair.questionFile.filename,
                    success: false,
                    message: '未找到匹配的答案文件',
                    status: 'missing_answer'
                });
            }
        }

        return {
            success: true,
            total: matchedPairs.length,
            imported: importResults.filter(r => r.success).length,
            failed: importResults.filter(r => !r.success).length,
            results: importResults
        };
    }

    // 直接导入文件对 - 使用增强PDF解析
    async importFilePairDirect(pair) {
        try {
            const { questionFile, answerFile, examInfo } = pair;
            
            if (!examInfo.isValid) {
                return {
                    filename: questionFile.filename,
                    success: false,
                    message: '无法识别考试信息'
                };
            }

            console.log(`导入文件对: ${questionFile.filename} + ${answerFile.filename}`);

            // 读取文件内容
            const questionBuffer = fs.readFileSync(questionFile.filepath);
            const answerBuffer = fs.readFileSync(answerFile.filepath);

            // 简单的文件验证
            const questionValidation = this.validatePDFBuffer(questionBuffer, questionFile);
            const answerValidation = this.validatePDFBuffer(answerBuffer, answerFile);

            if (!questionValidation.valid) {
                return {
                    filename: questionFile.filename,
                    success: false,
                    message: `题目文件验证失败: ${questionValidation.reason}`
                };
            }

            if (!answerValidation.valid) {
                return {
                    filename: questionFile.filename,
                    success: false,
                    message: `答案文件验证失败: ${answerValidation.reason}`
                };
            }

            console.log(`文件验证通过: 题目${questionValidation.sizeMB}MB, 答案${answerValidation.sizeMB}MB`);

            // 使用增强PDF解析
            const questionText = await this.extractTextFromPDF(questionBuffer);
            const answerText = await this.extractTextFromPDF(answerBuffer);
            
            if (!questionText.success || !answerText.success) {
                throw new Error(`题目提取: ${questionText.message}, 答案提取: ${answerText.message}`);
            }

            // 处理考试内容
            const parsedData = await this.processExamContent(
                questionText.text, 
                answerText.text, 
                examInfo
            );

            // 保存到数据库
            const saveResult = await this.saveToDatabaseDirectly(parsedData, examInfo);

            return {
                filename: questionFile.filename,
                success: true,
                message: '导入成功',
                data: saveResult,
                examInfo: examInfo
            };

        } catch (error) {
            console.error(`导入文件对失败: ${pair.questionFile.filename}`, error);
            return {
                filename: pair.questionFile.filename,
                success: false,
                message: '导入失败: ' + error.message
            };
        }
    }

    // 修改文件验证方法，添加目录显示
    validatePDFBuffer(buffer, fileInfo) {
        const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        
        // 检查文件大小
        if (buffer.length === 0) {
            return { valid: false, reason: '文件为空', sizeMB, fileInfo };
        }
        
        if (buffer.length > 20 * 1024 * 1024) { // 20MB限制
            return { valid: false, reason: '文件过大(超过20MB)', sizeMB, fileInfo };
        }
        
        // 检查是否为PDF文件（简单的魔数检查）
        if (buffer.length >= 4) {
            const header = buffer.slice(0, 4).toString('hex');
            if (header !== '25504446') { // %PDF
                return { valid: false, reason: '不是有效的PDF文件', sizeMB, fileInfo };
            }
        }
        
        return { valid: true, sizeMB, fileInfo };
    }

    // 处理考试内容
    async processExamContent(questionText, answerText, examInfo) {
        console.log('处理考试内容...');
        
        // 改进的题目解析逻辑
        const parsedData = {
            sections: {
                reading: {
                    title: "阅读理解",
                    questions: this.parseEnhancedQuestions(questionText, answerText)
                },
                listening: {
                    title: "听力理解", 
                    questions: this.parseListeningQuestions(questionText, answerText)
                }
            },
            analysis: this.parseEnhancedAnalysis(answerText)
        };

        return parsedData;
    }

    // 增强的题目解析
    parseEnhancedQuestions(questionText, answerText) {
        const questions = [];
        
        // 分割文本为行
        const lines = questionText.split('\n').filter(line => line.trim().length > 0);
        
        let currentQuestion = null;
        
        lines.forEach((line, index) => {
            // 检测题目开始（数字后跟点或括号）
            const questionMatch = line.match(/^(\d+)[\.\)]\s*(.+)/);
            if (questionMatch) {
                // 保存上一个题目
                if (currentQuestion) {
                    questions.push(currentQuestion);
                }
                
                // 创建新题目
                currentQuestion = {
                    question_number: questionMatch[1],
                    question_type: "single_choice",
                    content: questionMatch[2].trim(),
                    options: [],
                    correct_answer: this.extractEnhancedCorrectAnswer(answerText, questionMatch[1]),
                    score: this.calculateScore(questionMatch[1])
                };
            }
            
            // 检测选项（A)、B)、C)、D)等）
            const optionMatch = line.match(/^([A-D])[\)\.]\s*(.+)/i);
            if (optionMatch && currentQuestion) {
                currentQuestion.options.push({
                    key: optionMatch[1].toUpperCase(),
                    text: optionMatch[2].trim()
                });
            }
            
            // 如果当前行包含问号，可能是题目内容的一部分
            if (line.includes('?') && currentQuestion) {
                currentQuestion.content += ' ' + line.trim();
            }
        });
        
        // 添加最后一个题目
        if (currentQuestion) {
            questions.push(currentQuestion);
        }
        
        console.log(`解析出 ${questions.length} 个题目`);
        return questions.slice(0, 100); // 限制题目数量
    }

    // 解析听力题目
    parseListeningQuestions(questionText, answerText) {
        const questions = [];
        
        // 简单的听力题目检测逻辑
        const lines = questionText.split('\n');
        const listeningKeywords = ['听力', 'listening', 'conversation', 'dialogue', 'passage'];
        
        let inListeningSection = false;
        let questionCount = 0;
        
        lines.forEach((line, index) => {
            const lowerLine = line.toLowerCase();
            
            // 检测听力部分开始
            if (listeningKeywords.some(keyword => lowerLine.includes(keyword))) {
                inListeningSection = true;
                return;
            }
            
            // 在听力部分中检测题目
            if (inListeningSection) {
                const questionMatch = line.match(/^(\d+)[\.\)]\s*(.+)/);
                if (questionMatch) {
                    questionCount++;
                    questions.push({
                        question_number: questionCount.toString(),
                        question_type: "listening_single_choice",
                        content: questionMatch[2].trim(),
                        options: this.extractListeningOptions(lines, index),
                        correct_answer: this.extractEnhancedCorrectAnswer(answerText, questionCount.toString()),
                        score: 7.1,
                        section: "listening"
                    });
                }
            }
        });
        
        return questions.slice(0, 50);
    }

    // 提取听力选项
    extractListeningOptions(lines, currentIndex) {
        const options = [];
        const optionPattern = /^([A-D])[\)\.]\s*(.+)/i;
        
        for (let i = 1; i <= 6; i++) { // 最多检查6行
            if (currentIndex + i >= lines.length) break;
            
            const line = lines[currentIndex + i];
            const match = line.match(optionPattern);
            if (match) {
                options.push({
                    key: match[1].toUpperCase(),
                    text: match[2].trim()
                });
            } else if (line.trim() && !line.match(/^\d/)) {
                // 如果不是数字开头，可能是选项的延续
                if (options.length > 0) {
                    options[options.length - 1].text += ' ' + line.trim();
                }
            } else {
                // 遇到新题目或空行，停止
                break;
            }
        }
        
        // 如果没有找到选项，提供默认选项
        if (options.length === 0) {
            return [
                { key: 'A', text: 'Option A' },
                { key: 'B', text: 'Option B' },
                { key: 'C', text: 'Option C' },
                { key: 'D', text: 'Option D' }
            ];
        }
        
        return options;
    }

    // 增强的正确答案提取
    extractEnhancedCorrectAnswer(answerText, questionNumber) {
        const patterns = [
            new RegExp(`${questionNumber}\\s*[\.\)]\\s*([ABCD])`, 'i'),
            new RegExp(`第\\s*${questionNumber}\\s*题\\s*[：:]\\s*([ABCD])`, 'i'),
            new RegExp(`答案\\s*${questionNumber}\\s*[：:]\\s*([ABCD])`, 'i'),
            new RegExp(`Question\\s*${questionNumber}\\s*[：:]\\s*([ABCD])`, 'i')
        ];
        
        for (const pattern of patterns) {
            const match = answerText.match(pattern);
            if (match) {
                return match[1].toUpperCase();
            }
        }
        
        // 如果找不到，尝试在答案文本中搜索题目编号和选项
        const answerLines = answerText.split('\n');
        for (const line of answerLines) {
            if (line.includes(questionNumber.toString())) {
                const optionMatch = line.match(/([ABCD])/);
                if (optionMatch) {
                    return optionMatch[1].toUpperCase();
                }
            }
        }
        
        return 'A'; // 默认值
    }

    // 计算分数（根据题目类型和数量）
    calculateScore(questionNumber) {
        const num = parseInt(questionNumber);
        if (num <= 15) return 7.1;   // 前15题每题7.1分
        if (num <= 35) return 14.2;  // 16-35题每题14.2分
        return 10.65;               // 其他题目10.65分
    }

    // 增强的解析分析
    parseEnhancedAnalysis(answerText) {
        const analysis = {};
        const answerLines = answerText.split('\n');
        
        answerLines.forEach(line => {
            // 匹配 "1. A" 或 "1) A" 或 "第1题 A" 等格式
            const match = line.match(/(\d+)[\.\)]\s*([ABCD])/i) || 
                         line.match(/第\s*(\d+)\s*题\s*[：:]\s*([ABCD])/i);
            if (match) {
                analysis[match[1]] = {
                    correct_answer: match[2].toUpperCase(),
                    explanation: `正确答案: ${match[2].toUpperCase()}`
                };
            }
        });
        
        return analysis;
    }

    // 直接保存到数据库
    async saveToDatabaseDirectly(parsedData, examInfo) {
        return new Promise((resolve, reject) => {
            const db = require('../database.js').db;
            
            const paperTitle = `${examInfo.year}年${examInfo.month}月英语${examInfo.examType}真题`;
            const sections = JSON.stringify(parsedData.sections);
            const totalQuestions = this.calculateTotalQuestions(parsedData.sections);
            
            db.run(
                `INSERT INTO real_exam_papers 
                (exam_type, year, month, paper_number, title, sections, total_questions) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [examInfo.examType, examInfo.year, examInfo.month, examInfo.paperNumber, paperTitle, sections, totalQuestions],
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    const paperId = this.lastID;
                    this.saveQuestionsDirectly(db, paperId, parsedData, resolve, reject);
                }.bind(this)
            );
        });
    }

    // 计算总题目数
    calculateTotalQuestions(sections) {
        let total = 0;
        Object.values(sections).forEach(section => {
            if (section.questions) {
                total += section.questions.length;
            }
        });
        return total;
    }

    saveQuestionsDirectly(db, paperId, parsedData, resolve, reject) {
        const questions = [];
        
        Object.entries(parsedData.sections).forEach(([sectionType, section]) => {
            if (section.questions && section.questions.length > 0) {
                section.questions.forEach((question, index) => {
                    questions.push([
                        paperId,
                        sectionType,
                        question.question_type,
                        question.question_number,
                        question.content,
                        JSON.stringify(question.options),
                        question.correct_answer,
                        question.score || 0,
                        parsedData.analysis[question.question_number] ? 
                            JSON.stringify(parsedData.analysis[question.question_number]) : '{}',
                        index
                    ]);
                });
            }
        });

        if (questions.length === 0) {
            reject(new Error('没有找到有效的题目'));
            return;
        }

        const placeholders = questions.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        const sql = `INSERT INTO real_exam_questions 
                    (paper_id, section_type, question_type, question_number, content, options, correct_answer, score, analysis, sort_order) 
                    VALUES ${placeholders}`;
        
        const flattenedQuestions = questions.flat();
        
        db.run(sql, flattenedQuestions, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({
                    paperId: paperId,
                    questionCount: questions.length,
                    sections: Object.keys(parsedData.sections)
                });
            }
        });
    }

    // 手动导入指定文件
    async manualImport(questionFilename, answerFilename, examInfo) {
        try {
            // 在多个目录中查找文件
            let questionPath = null;
            let answerPath = null;
            
            for (const basePath of this.basePaths) {
                const tempQuestionPath = path.join(basePath, questionFilename);
                const tempAnswerPath = path.join(basePath, answerFilename);
                
                if (!questionPath && fs.existsSync(tempQuestionPath)) {
                    questionPath = tempQuestionPath;
                }
                if (!answerPath && fs.existsSync(tempAnswerPath)) {
                    answerPath = tempAnswerPath;
                }
            }

            if (!questionPath || !answerPath) {
                return {
                    success: false,
                    message: '文件不存在'
                };
            }

            const questionBuffer = fs.readFileSync(questionPath);
            const answerBuffer = fs.readFileSync(answerPath);

            // 使用增强PDF解析
            const questionText = await this.extractTextFromPDF(questionBuffer);
            const answerText = await this.extractTextFromPDF(answerBuffer);
            
            if (!questionText.success || !answerText.success) {
                throw new Error(`题目提取: ${questionText.message}, 答案提取: ${answerText.message}`);
            }

            const parsedData = await this.processExamContent(
                questionText.text, 
                answerText.text, 
                examInfo
            );

            const saveResult = await this.saveToDatabaseDirectly(parsedData, examInfo);

            return {
                success: true,
                message: '手动导入成功',
                data: saveResult
            };

        } catch (error) {
            console.error('手动导入失败:', error);
            return {
                success: false,
                message: '手动导入失败: ' + error.message
            };
        }
    }

    // 获取已导入的试卷列表
    async getImportedPapers() {
        return new Promise((resolve, reject) => {
            const db = require('../database.js').db;
            
            db.all(`
                SELECT * FROM real_exam_papers 
                ORDER BY exam_type, year DESC, month DESC, paper_number ASC
            `, (err, papers) => {
                if (err) {
                    reject(err);
                    return;
                }

                // 解析sections字段
                const processedPapers = papers.map(paper => {
                    try {
                        paper.sections = JSON.parse(paper.sections || '{}');
                    } catch (e) {
                        paper.sections = {};
                    }
                    return paper;
                });

                resolve(processedPapers);
            });
        });
    }
}

module.exports = new FileScannerService();