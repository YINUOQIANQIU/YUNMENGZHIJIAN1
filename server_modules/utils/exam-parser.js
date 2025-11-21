// [file name]: server_modules/utils/exam-parser.js - 增强版
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

class ExamExcelParser {
    constructor() {
        this.examData = [];
        this.sectionPatterns = {
            writing: ['写作', 'Writing', 'Part I', '第一部分'],
            listening: ['听力', 'Listening', 'Part II', '第二部分'], 
            reading: ['阅读', 'Reading', 'Part III', '第三部分'],
            translation: ['翻译', 'Translation', 'Part IV', '第四部分']
        };
    }

    // 解析真题Excel文件 - 增强版
    async parseExamFile(filePath, examType, year, month, paperNumber = 1) {
        try {
            console.log(`开始解析${examType} ${year}年${month}月真题文件:`, filePath);
            
            if (!fs.existsSync(filePath)) {
                throw new Error(`文件不存在: ${filePath}`);
            }

            const workbook = XLSX.readFile(filePath);
            const examPaper = {
                exam_type: examType,
                year: parseInt(year),
                month: parseInt(month),
                paper_number: paperNumber,
                title: `${year}年${month}月${examType === 'CET4' ? '英语四级' : '英语六级'}真题`,
                questions: [],
                total_questions: 0,
                audio_files: this.generateDefaultAudioFiles(examType, year, month, paperNumber)
            };

            // 解析各个部分
            await this.parseAllSections(workbook, examPaper);

            examPaper.total_questions = examPaper.questions.length;
            console.log(`解析完成: ${examPaper.title}, 共${examPaper.questions.length}道题目`);
            return examPaper;

        } catch (error) {
            console.error('解析真题文件失败:', error);
            throw error;
        }
    }

    // 生成默认音频文件路径
    generateDefaultAudioFiles(examType, year, month, paperNumber) {
        const baseDir = examType === 'CET4' ? '四级听力' : '六级听力';
        const prefix = `${year}${month.toString().padStart(2, '0')}-${paperNumber}`;
        
        return {
            short: `/${baseDir}/${prefix}-short.mp3`,
            long1: `/${baseDir}/${prefix}-long1.mp3`,
            long2: `/${baseDir}/${prefix}-long2.mp3`,
            lecture: `/${baseDir}/${prefix}-lecture.mp3`
        };
    }

    // 解析所有部分 - 增强听力解析
    async parseAllSections(workbook, examPaper) {
        const sheetNames = workbook.SheetNames;
        
        for (const sheetName of sheetNames) {
            try {
                console.log(`解析工作表: ${sheetName}`);
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                // 根据工作表名称判断内容类型
                const sectionType = this.detectSectionType(sheetName);
                if (sectionType) {
                    await this.parseSection(data, sectionType, examPaper, sheetName);
                } else {
                    // 自动检测内容类型
                    await this.autoDetectAndParse(data, examPaper, sheetName);
                }
            } catch (error) {
                console.error(`解析工作表 ${sheetName} 失败:`, error);
            }
        }
    }

    // 检测工作表类型
    detectSectionType(sheetName) {
        const lowerSheetName = sheetName.toLowerCase();
        
        for (const [sectionType, patterns] of Object.entries(this.sectionPatterns)) {
            for (const pattern of patterns) {
                if (lowerSheetName.includes(pattern.toLowerCase())) {
                    return sectionType;
                }
            }
        }
        
        return null;
    }

    // 自动检测并解析内容
    async autoDetectAndParse(data, examPaper, sheetName) {
        const content = data.flat().join(' ').toLowerCase();
        
        // 检测写作内容
        if (content.includes('writing') || content.includes('essay') || content.includes('作文') || content.includes('写作')) {
            await this.parseWritingSection(data, examPaper, sheetName);
        }
        // 检测听力内容 - 增强检测
        else if (content.includes('listening') || content.includes('听力') || content.includes('conversation') || content.includes('dialogue') || content.includes('section a') || content.includes('section b')) {
            await this.parseListeningSection(data, examPaper, sheetName);
        }
        // 检测阅读内容
        else if (content.includes('reading') || content.includes('阅读') || content.includes('passage') || content.includes('comprehension')) {
            await this.parseReadingSection(data, examPaper, sheetName);
        }
        // 检测翻译内容
        else if (content.includes('translation') || content.includes('翻译') || content.includes('汉译英') || content.includes('中译英')) {
            await this.parseTranslationSection(data, examPaper, sheetName);
        }
        // 默认按选择题解析
        else {
            await this.parseChoiceQuestions(data, examPaper, 'unknown');
        }
    }

    // 解析指定部分
    async parseSection(data, sectionType, examPaper, sheetName) {
        switch (sectionType) {
            case 'writing':
                await this.parseWritingSection(data, examPaper, sheetName);
                break;
            case 'listening':
                await this.parseListeningSection(data, examPaper, sheetName);
                break;
            case 'reading':
                await this.parseReadingSection(data, examPaper, sheetName);
                break;
            case 'translation':
                await this.parseTranslationSection(data, examPaper, sheetName);
                break;
            default:
                await this.parseChoiceQuestions(data, examPaper, sectionType);
        }
    }

    // 解析写作部分
    async parseWritingSection(data, examPaper, sheetName) {
        try {
            console.log(`解析写作部分: ${sheetName}`);
            
            let writingContent = '';
            let foundPrompt = false;

            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                if (!row || row.length === 0) continue;

                const rowText = row.map(cell => cell?.toString()?.trim() || '').join(' ').trim();
                
                // 查找写作提示
                if (rowText.includes('Directions') || rowText.includes('写作') || rowText.includes('作文') || 
                    rowText.includes('write') || rowText.includes('essay')) {
                    foundPrompt = true;
                }

                if (foundPrompt && rowText) {
                    writingContent += rowText + '\n';
                    
                    // 如果找到字数要求，认为提示结束
                    if (rowText.includes('120') && rowText.includes('180') || 
                        rowText.includes('words') || rowText.includes('词')) {
                        break;
                    }
                }
            }

            if (!writingContent) {
                // 如果没有找到具体内容，使用默认提示
                writingContent = `Directions: For this part, you are allowed 30 minutes to write an essay. You should write at least 120 words but no more than 180 words.`;
            }

            examPaper.questions.push({
                section_type: 'writing',
                question_type: 'writing',
                question_number: 'Writing',
                content: writingContent.trim(),
                score: 106, // 写作满分106
                sort_order: 1,
                audio_url: null,
                audio_start_time: 0,
                audio_end_time: 0
            });

        } catch (error) {
            console.error('解析写作部分失败:', error);
        }
    }

    // 解析听力部分 - 增强版
    async parseListeningSection(data, examPaper, sheetName) {
        try {
            console.log(`解析听力部分: ${sheetName}`);
            
            const questions = this.parseChoiceQuestionsFromData(data, 'listening');
            
            // 为听力题目分配音频路径和时间
            this.assignAudioToListeningQuestions(questions, examPaper);
            
            questions.forEach((question, index) => {
                examPaper.questions.push({
                    ...question,
                    sort_order: 2 + index
                });
            });

            console.log(`✓ 解析听力题目: ${questions.length} 个`);

        } catch (error) {
            console.error('解析听力部分失败:', error);
        }
    }

    // 为听力题目分配音频路径和时间
    assignAudioToListeningQuestions(questions, examPaper) {
        const { exam_type, year, month, paper_number, audio_files } = examPaper;
        const baseDir = exam_type === 'CET4' ? '四级听力' : '六级听力';
        const prefix = `${year}${month.toString().padStart(2, '0')}-${paper_number}`;
        
        let currentAudioFile = audio_files.short;
        let currentTime = 0;
        const timePerQuestion = 15; // 每题15秒

        questions.forEach((question, index) => {
            // 根据题号切换音频文件
            const questionNum = parseInt(question.question_number);
            if (questionNum === 9) {
                currentAudioFile = audio_files.long1;
                currentTime = 0;
            } else if (questionNum === 16) {
                currentAudioFile = audio_files.long2;
                currentTime = 0;
            }

            // 分配时间
            question.audio_url = currentAudioFile;
            question.audio_start_time = currentTime;
            question.audio_end_time = currentTime + timePerQuestion;
            
            currentTime += timePerQuestion;
        });
    }

    // 解析阅读部分
    async parseReadingSection(data, examPaper, sheetName) {
        try {
            console.log(`解析阅读部分: ${sheetName}`);
            
            const questions = this.parseChoiceQuestionsFromData(data, 'reading');
            questions.forEach((question, index) => {
                examPaper.questions.push({
                    ...question,
                    sort_order: 3 + index,
                    audio_url: null,
                    audio_start_time: 0,
                    audio_end_time: 0
                });
            });

        } catch (error) {
            console.error('解析阅读部分失败:', error);
        }
    }

    // 解析翻译部分
    async parseTranslationSection(data, examPaper, sheetName) {
        try {
            console.log(`解析翻译部分: ${sheetName}`);
            
            let translationContent = '';
            let foundContent = false;

            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                if (!row || row.length === 0) continue;

                const rowText = row.map(cell => cell?.toString()?.trim() || '').join(' ').trim();
                
                // 查找翻译内容（中文）
                if (this.containsChinese(rowText) && (rowText.includes('。') || rowText.includes('，') || rowText.length > 10)) {
                    foundContent = true;
                    translationContent = rowText;
                    break;
                }
            }

            if (!translationContent) {
                translationContent = '请将以下中文段落翻译成英文。';
            }

            examPaper.questions.push({
                section_type: 'translation',
                question_type: 'translation',
                question_number: 'Translation',
                content: translationContent.trim(),
                score: 106, // 翻译满分106
                sort_order: 4,
                audio_url: null,
                audio_start_time: 0,
                audio_end_time: 0
            });

        } catch (error) {
            console.error('解析翻译部分失败:', error);
        }
    }

    // 从数据中解析选择题 - 增强版
    parseChoiceQuestionsFromData(data, sectionType) {
        const questions = [];
        let currentQuestion = null;
        let questionNumber = 1;

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            // 检查是否是题号行
            const firstCell = row[0]?.toString()?.trim() || '';
            const numberMatch = firstCell.match(/^(\d+)\.?$/);
            
            if (numberMatch) {
                // 保存上一个问题
                if (currentQuestion) {
                    questions.push(currentQuestion);
                }

                // 开始新问题
                currentQuestion = {
                    section_type: sectionType,
                    question_type: 'single_choice',
                    question_number: numberMatch[1],
                    content: '',
                    options: [],
                    correct_answer: '',
                    score: sectionType === 'listening' ? 7.1 : 14.2,
                    audio_url: null,
                    audio_start_time: 0,
                    audio_end_time: 0
                };

                // 提取问题内容
                if (row[1]) {
                    currentQuestion.content = row[1].toString().trim();
                }

                // 提取选项
                this.extractOptionsFromRow(row, currentQuestion);
            } 
            else if (currentQuestion) {
                // 如果是选项行
                if (this.isOptionRow(row)) {
                    this.extractOptionsFromRow(row, currentQuestion);
                }
                // 如果是答案行
                else if (this.isAnswerRow(row)) {
                    this.extractAnswerFromRow(row, currentQuestion);
                }
                // 如果是问题内容续行
                else if (!currentQuestion.content && row.some(cell => cell && cell.toString().trim())) {
                    currentQuestion.content = row.map(cell => cell?.toString()?.trim() || '').join(' ').trim();
                }
            }
        }

        // 添加最后一个问题
        if (currentQuestion && currentQuestion.content) {
            questions.push(currentQuestion);
        }

        return questions;
    }

    // 检查是否是选项行
    isOptionRow(row) {
        const rowText = row.map(cell => cell?.toString()?.trim() || '').join(' ').toUpperCase();
        return rowText.includes('A.') || rowText.includes('B.') || rowText.includes('C.') || rowText.includes('D.') ||
               rowText.includes('A)') || rowText.includes('B)') || rowText.includes('C)') || rowText.includes('D)');
    }

    // 检查是否是答案行
    isAnswerRow(row) {
        const rowText = row.map(cell => cell?.toString()?.trim() || '').join(' ').toUpperCase();
        return rowText.includes('答案') || rowText.includes('ANSWER') || rowText.includes('KEY') || 
               /^[A-D]$/.test(rowText) || /^正确答案?[：:]\s*[A-D]$/i.test(rowText);
    }

    // 从行中提取选项
    extractOptionsFromRow(row, question) {
        const optionsMap = {};
        
        for (let j = 0; j < row.length; j++) {
            const cell = row[j]?.toString()?.trim();
            if (!cell) continue;

            // 匹配 A. 选项内容 或 A) 选项内容 格式
            const optionMatch = cell.match(/^([A-D])[\.、\)]?\s*(.+)$/i);
            if (optionMatch) {
                const optionLetter = optionMatch[1].toUpperCase();
                const optionText = optionMatch[2].trim();
                
                if (!optionsMap[optionLetter]) {
                    optionsMap[optionLetter] = {
                        option: optionLetter,
                        text: optionText
                    };
                }
            }
        }

        // 添加到问题选项
        Object.values(optionsMap).forEach(option => {
            if (!question.options.find(opt => opt.option === option.option)) {
                question.options.push(option);
            }
        });
    }

    // 从行中提取答案
    extractAnswerFromRow(row, question) {
        const rowText = row.map(cell => cell?.toString()?.trim() || '').join(' ').toUpperCase();
        
        // 匹配各种答案格式
        const answerMatch = rowText.match(/(答案|ANSWER|KEY)[：:]\s*([A-D])/i) || 
                           rowText.match(/^([A-D])$/) ||
                           rowText.match(/正确答案?[：:]\s*([A-D])/i);
        
        if (answerMatch) {
            question.correct_answer = answerMatch[answerMatch.length - 1].toUpperCase();
        }
    }

    // 解析选择题
    async parseChoiceQuestions(data, examPaper, sectionType) {
        try {
            console.log(`解析选择题部分: ${sectionType}`);
            
            const questions = this.parseChoiceQuestionsFromData(data, sectionType);
            questions.forEach((question, index) => {
                examPaper.questions.push({
                    ...question,
                    sort_order: examPaper.questions.length + 1
                });
            });

        } catch (error) {
            console.error('解析选择题失败:', error);
        }
    }

    // 检查是否包含中文
    containsChinese(text) {
        return /[\u4e00-\u9fa5]/.test(text);
    }

    // 批量导入真题
    async importAllExams(examsFolder) {
        const results = [];
        
        try {
            console.log('开始批量导入真题数据...');
            
            const cet4Path = path.join(examsFolder, '四级真题');
            const cet6Path = path.join(examsFolder, '六级真题');
            
            // 导入四级真题
            if (fs.existsSync(cet4Path)) {
                console.log('发现四级真题文件夹');
                const cet4Results = await this.importExamType(cet4Path, 'CET4');
                results.push(...cet4Results);
            } else {
                console.log('四级真题文件夹不存在:', cet4Path);
            }
            
            // 导入六级真题
            if (fs.existsSync(cet6Path)) {
                console.log('发现六级真题文件夹');
                const cet6Results = await this.importExamType(cet6Path, 'CET6');
                results.push(...cet6Results);
            } else {
                console.log('六级真题文件夹不存在:', cet6Path);
            }
            
            console.log(`批量导入完成，共处理 ${results.length} 套试卷`);
            return results;
        } catch (error) {
            console.error('批量导入真题失败:', error);
            throw error;
        }
    }

    // 导入指定类型的真题
    async importExamType(examPath, examType) {
        const results = [];
        
        try {
            const files = fs.readdirSync(examPath);
            const examFiles = files.filter(file => 
                file.toLowerCase().endsWith('.xlsx') || file.toLowerCase().endsWith('.xls')
            );

            console.log(`在${examPath}中发现${examFiles.length}个Excel文件`);

            for (const file of examFiles) {
                try {
                    // 解析文件名获取年份和月份
                    const filename = path.parse(file).name;
                    const match = filename.match(/(\d{4})[_-]?(\d{2})/);
                    
                    if (match) {
                        const year = parseInt(match[1]);
                        const month = parseInt(match[2]);
                        const filePath = path.join(examPath, file);
                        
                        // 检查是否是答案文件（跳过答案文件，只处理题目文件）
                        if (filename.toLowerCase().includes('ans') || filename.toLowerCase().includes('answer')) {
                            console.log(`跳过答案文件: ${file}`);
                            continue;
                        }

                        console.log(`导入${examType} ${year}年${month}月真题:`, file);
                        const examPaper = await this.parseExamFile(filePath, examType, year, month);
                        
                        if (examPaper.questions.length > 0) {
                            results.push(examPaper);
                            console.log(`成功导入: ${examPaper.title}, ${examPaper.questions.length}题`);
                        } else {
                            console.log(`警告: ${file} 没有解析出任何题目`);
                        }
                    } else {
                        console.log(`无法解析文件名: ${file}`);
                    }
                } catch (fileError) {
                    console.error(`导入文件 ${file} 失败:`, fileError);
                }
            }
        } catch (error) {
            console.error(`导入${examType}真题失败:`, error);
        }
        
        return results;
    }

    // 获取解析的考试数据
    getExamData() {
        return this.examData;
    }

    // 清空解析数据
    clearExamData() {
        this.examData = [];
    }

    // 验证Excel文件格式
    validateExcelFile(filePath) {
        try {
            const workbook = XLSX.readFile(filePath);
            const sheetNames = workbook.SheetNames;
            
            if (sheetNames.length === 0) {
                return { valid: false, error: 'Excel文件没有工作表' };
            }

            // 检查是否有有效内容
            for (const sheetName of sheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (data.length > 0 && data.some(row => row.some(cell => cell && cell.toString().trim()))) {
                    return { valid: true };
                }
            }

            return { valid: false, error: 'Excel文件没有有效内容' };
        } catch (error) {
            return { valid: false, error: `读取Excel文件失败: ${error.message}` };
        }
    }

    // 生成默认题目（当解析失败时使用）
    generateDefaultQuestions(examType, year, month) {
        return [
            {
                section_type: 'writing',
                question_type: 'writing',
                question_number: 'Writing',
                content: 'Directions: For this part, you are allowed 30 minutes to write an essay. You should write at least 120 words but no more than 180 words.',
                score: 106,
                sort_order: 1,
                audio_url: null,
                audio_start_time: 0,
                audio_end_time: 0
            },
            {
                section_type: 'listening',
                question_type: 'single_choice',
                question_number: '1',
                content: 'What does the conversation mainly about?',
                options: JSON.stringify([
                    { option: 'A', text: 'Study plans' },
                    { option: 'B', text: 'Travel arrangements' },
                    { option: 'C', text: 'Job opportunities' },
                    { option: 'D', text: 'Course registration' }
                ]),
                correct_answer: 'A',
                score: 7.1,
                sort_order: 2,
                audio_url: `/${examType === 'CET4' ? '四级听力' : '六级听力'}/default.mp3`,
                audio_start_time: 0,
                audio_end_time: 15
            },
            {
                section_type: 'reading',
                question_type: 'single_choice',
                question_number: '2',
                content: 'What is the main idea of the passage?',
                options: JSON.stringify([
                    { option: 'A', text: 'The importance of education' },
                    { option: 'B', text: 'The development of technology' },
                    { option: 'C', text: 'The impact of climate change' },
                    { option: 'D', text: 'The benefits of exercise' }
                ]),
                correct_answer: 'B',
                score: 14.2,
                sort_order: 3,
                audio_url: null,
                audio_start_time: 0,
                audio_end_time: 0
            },
            {
                section_type: 'translation',
                question_type: 'translation',
                question_number: 'Translation',
                content: '请将以下中文翻译成英文：中国有着悠久的历史和丰富的文化传统。',
                score: 106,
                sort_order: 4,
                audio_url: null,
                audio_start_time: 0,
                audio_end_time: 0
            }
        ];
    }
}

module.exports = new ExamExcelParser();