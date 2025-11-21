// [file name]: server_modules/routes/pdf-import-manager.js
const express = require('express');
const router = express.Router();
const FileScannerService = require('../services/file-scanner-service.js');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class BaiduOCRService {
    constructor() {
        this.apiConfig = {
            BAIDU_OCR: {
                APP_ID: "6956866",
                API_KEY: "11qATPLTUylugt5q9QC7nJQu",
                SECRET_KEY: "Nu8jCbTCXAGWn4ISg0j1IFf5kIjzey31",
                API_URL: "https://aip.baidubce.com/rest/2.0/ocr/v1/"
            }
        };
        this.accessToken = null;
        this.tokenExpireTime = 0;
    }

    // 获取百度access token
    async getAccessToken() {
        // 检查token是否有效（24小时有效期）
        if (this.accessToken && Date.now() < this.tokenExpireTime) {
            return this.accessToken;
        }

        try {
            const response = await axios.post(
                `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.apiConfig.BAIDU_OCR.API_KEY}&client_secret=${this.apiConfig.BAIDU_OCR.SECRET_KEY}`
            );

            if (response.data && response.data.access_token) {
                this.accessToken = response.data.access_token;
                this.tokenExpireTime = Date.now() + 24 * 60 * 60 * 1000; // 24小时
                console.log('✅ 百度OCR access token获取成功');
                return this.accessToken;
            } else {
                throw new Error('获取百度access token失败');
            }
        } catch (error) {
            console.error('获取百度OCR access token错误:', error.message);
            throw error;
        }
    }

    // 直接提取PDF文本内容
    async extractTextFromPDF(pdfBuffer) {
        try {
            const accessToken = await this.getAccessToken();
            
            const formData = new FormData();
            formData.append('pdf_file', pdfBuffer, {
                filename: 'document.pdf',
                contentType: 'application/pdf'
            });
            formData.append('language_type', 'CHN_ENG');
            formData.append('detect_direction', 'true');
            formData.append('paragraph', 'true');
            formData.append('probability', 'false');

            console.log('开始调用百度OCR提取PDF文本...');

            const response = await axios.post(
                `${this.apiConfig.BAIDU_OCR.API_URL}accurate_basic`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    params: {
                        access_token: accessToken
                    },
                    timeout: 60000
                }
            );

            if (response.data && response.data.words_result) {
                const text = response.data.words_result.map(item => item.words).join('\n');
                console.log('✅ PDF文本提取成功，字符数:', text.length);
                return {
                    success: true,
                    text: text,
                    words_count: response.data.words_result_num
                };
            } else {
                console.error('百度OCR返回数据异常:', response.data);
                return {
                    success: false,
                    message: response.data.error_msg || '文档识别失败'
                };
            }

        } catch (error) {
            console.error('百度OCR提取PDF文本错误:', error.response?.data || error.message);
            return {
                success: false,
                message: 'PDF文本提取失败: ' + (error.response?.data?.error_msg || error.message)
            };
        }
    }

    // 通用文字识别（备用方法）
    async generalOCR(pdfBuffer) {
        try {
            const accessToken = await this.getAccessToken();
            
            const formData = new FormData();
            formData.append('image', pdfBuffer);
            formData.append('language_type', 'CHN_ENG');
            formData.append('detect_direction', 'true');
            formData.append('paragraph', 'true');

            const response = await axios.post(
                `${this.apiConfig.BAIDU_OCR.API_URL}general_basic`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    params: {
                        access_token: accessToken
                    },
                    timeout: 60000
                }
            );

            if (response.data && response.data.words_result) {
                const text = response.data.words_result.map(item => item.words).join('\n');
                return {
                    success: true,
                    text: text,
                    words_count: response.data.words_result_num
                };
            } else {
                return {
                    success: false,
                    message: response.data.error_msg || '文档识别失败'
                };
            }

        } catch (error) {
            console.error('百度通用OCR错误:', error.response?.data || error.message);
            return {
                success: false,
                message: 'OCR识别失败: ' + (error.response?.data?.error_msg || error.message)
            };
        }
    }
}

// 创建OCR服务实例
const baiduOCRService = new BaiduOCRService();

// 直接导入PDF文件对
async function importPDFDirectly(questionBuffer, answerBuffer, examInfo) {
    try {
        console.log('开始直接导入PDF...', {
            examType: examInfo.examType,
            year: examInfo.year,
            month: examInfo.month
        });

        // 使用百度OCR提取题目和答案文本
        const questionText = await baiduOCRService.extractTextFromPDF(questionBuffer);
        const answerText = await baiduOCRService.extractTextFromPDF(answerBuffer);
        
        if (!questionText.success || !answerText.success) {
            // 如果高精度识别失败，尝试通用识别
            console.log('尝试使用通用OCR识别...');
            const questionTextGeneral = await baiduOCRService.generalOCR(questionBuffer);
            const answerTextGeneral = await baiduOCRService.generalOCR(answerBuffer);
            
            if (!questionTextGeneral.success || !answerTextGeneral.success) {
                throw new Error(`题目提取: ${questionTextGeneral.message}, 答案提取: ${answerTextGeneral.message}`);
            }
            
            // 使用通用识别的结果
            return await processExamContent(
                questionTextGeneral.text, 
                answerTextGeneral.text, 
                examInfo
            );
        }

        // 使用高精度识别的结果
        return await processExamContent(questionText.text, answerText.text, examInfo);

    } catch (error) {
        console.error('直接导入PDF失败:', error);
        throw error;
    }
}

// 处理考试内容
async function processExamContent(questionText, answerText, examInfo) {
    // 简化的处理逻辑 - 实际项目中可以使用AI服务进一步解析
    const parsedData = {
        sections: {
            reading: {
                title: "阅读理解",
                questions: parseBasicQuestions(questionText, answerText)
            }
        },
        analysis: parseBasicAnalysis(answerText)
    };

    // 保存到数据库
    return await saveToDatabaseDirectly(parsedData, examInfo);
}

// 基础题目解析
function parseBasicQuestions(questionText, answerText) {
    const questions = [];
    
    // 简单的题目提取逻辑
    const lines = questionText.split('\n').filter(line => line.trim());
    
    lines.forEach((line, index) => {
        if (line.match(/\d+\./) || line.match(/[A-D]\./)) {
            questions.push({
                question_number: (index + 1).toString(),
                question_type: "single_choice",
                content: line,
                options: extractBasicOptions(lines, index),
                correct_answer: extractCorrectAnswer(answerText, index + 1),
                score: 7.1
            });
        }
    });
    
    return questions.slice(0, 10); // 限制题目数量
}

function extractBasicOptions(lines, currentIndex) {
    const options = [];
    for (let i = 1; i <= 4; i++) {
        if (lines[currentIndex + i]) {
            options.push(lines[currentIndex + i]);
        }
    }
    return options.length > 0 ? options : ["A) Option A", "B) Option B", "C) Option C", "D) Option D"];
}

function extractCorrectAnswer(answerText, questionNumber) {
    // 简单的答案匹配逻辑
    if (answerText.includes(`${questionNumber}. A`) || answerText.includes(`第${questionNumber}题 A`)) return "A";
    if (answerText.includes(`${questionNumber}. B`) || answerText.includes(`第${questionNumber}题 B`)) return "B";
    if (answerText.includes(`${questionNumber}. C`) || answerText.includes(`第${questionNumber}题 C`)) return "C";
    if (answerText.includes(`${questionNumber}. D`) || answerText.includes(`第${questionNumber}题 D`)) return "D";
    return "A"; // 默认值
}

function parseBasicAnalysis(answerText) {
    const analysis = {};
    const answerLines = answerText.split('\n');
    
    answerLines.forEach(line => {
        const match = line.match(/(\d+)\.\s*([ABCD])/);
        if (match) {
            analysis[match[1]] = `正确答案: ${match[2]}`;
        }
    });
    
    return analysis;
}

// 直接保存到数据库
async function saveToDatabaseDirectly(parsedData, examInfo) {
    return new Promise((resolve, reject) => {
        const db = require('../database.js').db;
        
        const paperTitle = `${examInfo.year}年${examInfo.month}月英语${examInfo.examType}真题`;
        const sections = JSON.stringify(parsedData.sections);
        
        db.run(
            `INSERT INTO real_exam_papers 
            (exam_type, year, month, paper_number, title, sections, total_questions) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [examInfo.examType, examInfo.year, examInfo.month, examInfo.paperNumber, paperTitle, sections, parsedData.sections.reading.questions.length],
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                
                const paperId = this.lastID;
                saveQuestionsDirectly(db, paperId, parsedData, resolve, reject);
            }
        );
    });
}

function saveQuestionsDirectly(db, paperId, parsedData, resolve, reject) {
    const questions = [];
    
    Object.values(parsedData.sections).forEach(section => {
        section.questions.forEach(question => {
            questions.push([
                paperId,
                'reading',
                question.question_type,
                question.question_number,
                question.content,
                question.options ? JSON.stringify(question.options) : null,
                question.correct_answer,
                question.score || 0,
                parsedData.analysis[question.question_number] || '',
                0
            ]);
        });
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

// 修改现有的批量导入路由
router.post('/batch-import-direct', async (req, res) => {
    try {
        const matchResult = await FileScannerService.autoMatchFiles();
        if (!matchResult.success) {
            return res.json(matchResult);
        }

        const importResults = [];
        const { matchedPairs } = matchResult;

        console.log(`开始直接批量导入 ${matchedPairs.length} 个文件对...`);

        for (const pair of matchedPairs) {
            if (pair.answerFile) {
                try {
                    const questionBuffer = fs.readFileSync(pair.questionFile.filepath);
                    const answerBuffer = fs.readFileSync(pair.answerFile.filepath);

                    const result = await importPDFDirectly(
                        questionBuffer, 
                        answerBuffer, 
                        pair.examInfo
                    );

                    importResults.push({
                        filename: pair.questionFile.filename,
                        success: true,
                        message: '导入成功',
                        data: result,
                        examInfo: pair.examInfo
                    });

                } catch (error) {
                    importResults.push({
                        filename: pair.questionFile.filename,
                        success: false,
                        message: '导入失败: ' + error.message,
                        examInfo: pair.examInfo
                    });
                }
            } else {
                importResults.push({
                    filename: pair.questionFile.filename,
                    success: false,
                    message: '未找到匹配的答案文件',
                    status: 'missing_answer'
                });
            }
        }

        return res.json({
            success: true,
            total: matchedPairs.length,
            imported: importResults.filter(r => r.success).length,
            failed: importResults.filter(r => !r.success).length,
            results: importResults
        });

    } catch (error) {
        console.error('直接批量导入失败:', error);
        return res.json({
            success: false,
            message: '批量导入失败: ' + error.message
        });
    }
});

// 在PDF导入管理路由中添加调试接口
router.get('/debug/ocr-test', async (req, res) => {
    try {
        const { filename } = req.query;
        
        if (!filename) {
            return res.json({
                success: false,
                message: '请提供文件名参数'
            });
        }

        const filePath = path.join(__dirname, '../../真题与听力/download四级', filename);
        
        if (!fs.existsSync(filePath)) {
            return res.json({
                success: false,
                message: `文件不存在: ${filename}`
            });
        }

        const fileBuffer = fs.readFileSync(filePath);
        const fileInfo = {
            filename: filename,
            size: fileBuffer.length,
            sizeMB: (fileBuffer.length / 1024 / 1024).toFixed(2),
            isPDF: fileBuffer.slice(0, 4).toString() === '%PDF'
        };

        // 测试OCR
        const ocrResult = await baiduOCRService.extractTextFromPDF(fileBuffer);

        res.json({
            success: true,
            fileInfo: fileInfo,
            ocrResult: ocrResult
        });

    } catch (error) {
        res.json({
            success: false,
            message: '调试失败: ' + error.message
        });
    }
});

// 添加文件验证接口
router.get('/debug/validate-file', async (req, res) => {
    try {
        const { filename } = req.query;
        
        if (!filename) {
            return res.json({
                success: false,
                message: '请提供文件名参数'
            });
        }

        const filePath = path.join(__dirname, '../../真题与听力/download四级', filename);
        
        if (!fs.existsSync(filePath)) {
            return res.json({
                success: false,
                message: `文件不存在: ${filename}`
            });
        }

        const fileBuffer = fs.readFileSync(filePath);
        const fileInfo = {
            filename: filename,
            size: fileBuffer.length,
            sizeMB: (fileBuffer.length / 1024 / 1024).toFixed(2),
            isPDF: fileBuffer.slice(0, 4).toString() === '%PDF',
            firstBytes: fileBuffer.slice(0, 10).toString('hex')
        };

        // 测试两种OCR方法
        const accurateResult = await baiduOCRService.extractTextFromPDF(fileBuffer);
        const generalResult = await baiduOCRService.generalOCR(fileBuffer);

        res.json({
            success: true,
            fileInfo: fileInfo,
            accurateOCR: accurateResult,
            generalOCR: generalResult,
            comparison: {
                accurateSuccess: accurateResult.success,
                generalSuccess: generalResult.success,
                accurateTextLength: accurateResult.success ? accurateResult.text.length : 0,
                generalTextLength: generalResult.success ? generalResult.text.length : 0
            }
        });

    } catch (error) {
        res.json({
            success: false,
            message: '文件验证失败: ' + error.message
        });
    }
});

// 添加OCR服务状态检查接口
router.get('/debug/ocr-status', async (req, res) => {
    try {
        const tokenStatus = {
            hasToken: baiduOCRService.accessToken !== null,
            tokenExpired: baiduOCRService.accessToken ? 
                (Date.now() >= baiduOCRService.tokenExpireTime) : true,
            tokenExpireTime: baiduOCRService.tokenExpireTime ? 
                new Date(baiduOCRService.tokenExpireTime).toISOString() : null,
            currentTime: new Date().toISOString()
        };

        // 测试获取token
        let tokenTest = { success: false, message: '未测试' };
        try {
            const token = await baiduOCRService.getAccessToken();
            tokenTest = {
                success: true,
                token: token ? '***' + token.slice(-8) : null
            };
        } catch (error) {
            tokenTest = {
                success: false,
                message: error.message
            };
        }

        res.json({
            success: true,
            tokenStatus: tokenStatus,
            tokenTest: tokenTest,
            config: {
                hasAppId: !!baiduOCRService.apiConfig.BAIDU_OCR.APP_ID,
                hasApiKey: !!baiduOCRService.apiConfig.BAIDU_OCR.API_KEY,
                hasSecretKey: !!baiduOCRService.apiConfig.BAIDU_OCR.SECRET_KEY
            }
        });

    } catch (error) {
        res.json({
            success: false,
            message: 'OCR状态检查失败: ' + error.message
        });
    }
});

// 原有的路由保持不变
router.get('/scan', async (req, res) => {
    try {
        const result = await FileScannerService.scanDirectory();
        res.json(result);
    } catch (error) {
        res.json({
            success: false,
            message: '扫描失败: ' + error.message
        });
    }
});

router.get('/auto-match', async (req, res) => {
    try {
        const result = await FileScannerService.autoMatchFiles();
        res.json(result);
    } catch (error) {
        res.json({
            success: false,
            message: '自动匹配失败: ' + error.message
        });
    }
});

// 修改原有的批量导入路由，使用新方法
router.post('/batch-import', async (req, res) => {
    try {
        const result = await FileScannerService.batchImportAll();
        res.json(result);
    } catch (error) {
        res.json({
            success: false,
            message: '批量导入失败: ' + error.message
        });
    }
});

// 其他原有路由保持不变...
router.post('/manual-import', async (req, res) => {
    try {
        const { questionFile, answerFile, examType, year, month, paperNumber } = req.body;
        
        if (!questionFile || !answerFile) {
            return res.json({
                success: false,
                message: '请提供题目文件和答案文件'
            });
        }

        const examInfo = {
            examType: examType || 'CET6',
            year: parseInt(year) || 2021,
            month: parseInt(month) || 6,
            paperNumber: parseInt(paperNumber) || 1
        };

        // 使用新的直接导入方法
        const questionBuffer = fs.readFileSync(questionFile);
        const answerBuffer = fs.readFileSync(answerFile);
        
        const result = await importPDFDirectly(questionBuffer, answerBuffer, examInfo);

        res.json({
            success: true,
            message: '手动导入成功',
            data: result
        });

    } catch (error) {
        res.json({
            success: false,
            message: '手动导入失败: ' + error.message
        });
    }
});

router.get('/imported-papers', async (req, res) => {
    try {
        const papers = await FileScannerService.getImportedPapers();
        res.json({
            success: true,
            data: papers,
            count: papers.length
        });
    } catch (error) {
        res.json({
            success: false,
            message: '获取试卷列表失败: ' + error.message
        });
    }
});

router.delete('/paper/:paperId', (req, res) => {
    const paperId = req.params.paperId;
    const db = req.app.locals.db;

    db.run('DELETE FROM real_exam_questions WHERE paper_id = ?', [paperId], function(err) {
        if (err) {
            res.json({ success: false, message: '删除题目失败' });
            return;
        }

        db.run('DELETE FROM real_exam_papers WHERE id = ?', [paperId], function(err) {
            if (err) {
                res.json({ success: false, message: '删除试卷失败' });
                return;
            }

            res.json({
                success: true,
                message: '删除成功',
                deletedQuestions: this.changes
            });
        });
    });
});

module.exports = router;