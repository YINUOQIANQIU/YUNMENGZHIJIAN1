// [file name]: server_modules/utils/exam-parser.js
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

class ExamExcelParser {
    constructor() {
        this.examData = [];
    }

    // 解析真题Excel文件
    async parseExamFile(filePath, examType, year, month, paperNumber = 1) {
        try {
            console.log(`开始解析${examType} ${year}年${month}月真题文件:`, filePath);
            
            const workbook = XLSX.readFile(filePath);
            const examPaper = {
                exam_type: examType,
                year: parseInt(year),
                month: parseInt(month),
                paper_number: paperNumber,
                title: `${year}年${month}月${examType === 'CET4' ? '英语四级' : '英语六级'}真题`,
                questions: []
            };

            // 解析各个部分
            await this.parseWritingSection(workbook, examPaper);
            await this.parseListeningSection(workbook, examPaper);
            await this.parseReadingSection(workbook, examPaper);
            await this.parseTranslationSection(workbook, examPaper);

            console.log(`解析完成: ${examPaper.title}, 共${examPaper.questions.length}道题目`);
            return examPaper;

        } catch (error) {
            console.error('解析真题文件失败:', error);
            throw error;
        }
    }

    // 解析写作部分
    async parseWritingSection(workbook, examPaper) {
        try {
            const sheetNames = workbook.SheetNames;
            const writingSheet = sheetNames.find(name => name.includes('写作') || name.includes('Writing'));
            
            if (writingSheet) {
                const worksheet = workbook.Sheets[writingSheet];
                const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                // 查找写作题目
                for (let i = 0; i < data.length; i++) {
                    const row = data[i];
                    if (row && row.length > 0 && row[0] && row[0].toString().includes('Directions')) {
                        const content = this.extractWritingContent(data, i);
                        if (content) {
                            examPaper.questions.push({
                                section_type: 'writing',
                                question_type: 'writing',
                                question_number: 'Writing',
                                content: content,
                                score: 106, // 写作满分106
                                sort_order: 1
                            });
                        }
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('解析写作部分失败:', error);
        }
    }

    // 解析听力部分
    async parseListeningSection(workbook, examPaper) {
        try {
            const sheetNames = workbook.SheetNames;
            const listeningSheet = sheetNames.find(name => name.includes('听力') || name.includes('Listening'));
            
            if (listeningSheet) {
                const worksheet = workbook.Sheets[listeningSheet];
                const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                let questionCount = 1;
                for (let i = 0; i < data.length; i++) {
                    const row = data[i];
                    if (row && row.length >= 6) {
                        // 检查是否是选择题格式
                        if (this.isChoiceQuestion(row)) {
                            const question = this.parseChoiceQuestion(row, questionCount, 'listening');
                            if (question) {
                                examPaper.questions.push(question);
                                questionCount++;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('解析听力部分失败:', error);
        }
    }

    // 解析阅读部分
    async parseReadingSection(workbook, examPaper) {
        try {
            const sheetNames = workbook.SheetNames;
            const readingSheet = sheetNames.find(name => name.includes('阅读') || name.includes('Reading'));
            
            if (readingSheet) {
                const worksheet = workbook.Sheets[readingSheet];
                const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                let questionCount = 1;
                for (let i = 0; i < data.length; i++) {
                    const row = data[i];
                    if (row && row.length >= 6) {
                        if (this.isChoiceQuestion(row)) {
                            const question = this.parseChoiceQuestion(row, questionCount, 'reading');
                            if (question) {
                                examPaper.questions.push(question);
                                questionCount++;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('解析阅读部分失败:', error);
        }
    }

    // 解析翻译部分
    async parseTranslationSection(workbook, examPaper) {
        try {
            const sheetNames = workbook.SheetNames;
            const translationSheet = sheetNames.find(name => name.includes('翻译') || name.includes('Translation'));
            
            if (translationSheet) {
                const worksheet = workbook.Sheets[translationSheet];
                const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                // 查找翻译题目
                for (let i = 0; i < data.length; i++) {
                    const row = data[i];
                    if (row && row.length > 0 && row[0] && 
                        (row[0].toString().includes('翻译') || row[0].toString().includes('Translation'))) {
                        const content = this.extractTranslationContent(data, i);
                        if (content) {
                            examPaper.questions.push({
                                section_type: 'translation',
                                question_type: 'translation',
                                question_number: 'Translation',
                                content: content,
                                score: 106, // 翻译满分106
                                sort_order: 4
                            });
                        }
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('解析翻译部分失败:', error);
        }
    }

    // 提取写作内容
    extractWritingContent(data, startRow) {
        let content = '';
        for (let i = startRow; i < Math.min(startRow + 10, data.length); i++) {
            const row = data[i];
            if (row && row[0]) {
                content += row[0].toString() + '\n';
            }
        }
        return content.trim() || '请根据题目要求完成写作任务。';
    }

    // 提取翻译内容
    extractTranslationContent(data, startRow) {
        let content = '';
        for (let i = startRow; i < Math.min(startRow + 10, data.length); i++) {
            const row = data[i];
            if (row && row[0]) {
                content += row[0].toString() + '\n';
            }
        }
        return content.trim() || '请将以下中文翻译成英文。';
    }

    // 检查是否是选择题
    isChoiceQuestion(row) {
        return row[0] && /^\d+\.?$/.test(row[0].toString().replace('.', '').trim());
    }

    // 解析选择题
    parseChoiceQuestion(row, questionNumber, sectionType) {
        try {
            const questionText = row[1] ? row[1].toString().trim() : '';
            const options = [];
            
            // 提取选项 A,B,C,D
            for (let j = 2; j <= 5; j++) {
                if (row[j]) {
                    const optionText = row[j].toString().trim();
                    if (optionText) {
                        const optionLetter = String.fromCharCode(65 + (j - 2)); // A, B, C, D
                        options.push({
                            option: optionLetter,
                            text: optionText
                        });
                    }
                }
            }

            // 提取正确答案
            let correctAnswer = '';
            if (row[5]) {
                correctAnswer = row[5].toString().trim().toUpperCase();
            }

            if (questionText && options.length >= 2) {
                return {
                    section_type: sectionType,
                    question_type: 'single_choice',
                    question_number: questionNumber.toString(),
                    content: questionText,
                    options: JSON.stringify(options),
                    correct_answer: correctAnswer,
                    score: sectionType === 'listening' ? 7 : 14, // 听力和阅读分值不同
                    sort_order: sectionType === 'listening' ? 2 : 3
                };
            }
        } catch (error) {
            console.error('解析选择题失败:', error, row);
        }
        return null;
    }

    // 批量导入真题
    async importAllExams(examsFolder) {
        const results = [];
        
        try {
            const cet4Path = path.join(examsFolder, '四级真题');
            const cet6Path = path.join(examsFolder, '六级真题');
            
            // 导入四级真题
            if (fs.existsSync(cet4Path)) {
                const cet4Results = await this.importExamType(cet4Path, 'CET4');
                results.push(...cet4Results);
            }
            
            // 导入六级真题
            if (fs.existsSync(cet6Path)) {
                const cet6Results = await this.importExamType(cet6Path, 'CET6');
                results.push(...cet6Results);
            }
            
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
                file.endsWith('.xlsx') || file.endsWith('.xls')
            );

            for (const file of examFiles) {
                try {
                    // 解析文件名获取年份和月份
                    const filename = path.parse(file).name;
                    const match = filename.match(/(\d{4})[_-]?(\d{2})/);
                    
                    if (match) {
                        const year = parseInt(match[1]);
                        const month = parseInt(match[2]);
                        const filePath = path.join(examPath, file);
                        
                        console.log(`导入${examType} ${year}年${month}月真题:`, file);
                        const examPaper = await this.parseExamFile(filePath, examType, year, month);
                        results.push(examPaper);
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
}

module.exports = new ExamExcelParser();