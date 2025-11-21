/**
 * 单词爆破手游戏 - 完整版服务器（自动端口选择）
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const multiparty = require('multiparty');

class GameServer {
    constructor() {
        this.port = process.env.PORT || 3000;
        this.maxPortAttempts = 10; // 最多尝试10个端口
        this.currentPortAttempt = 0;
        this.players = new Map();
        this.gameSessions = new Map();
        this.questions = this.initializeQuestions();
        
        // 创建必要目录
        this.createDirectories();
        
        // 导入词汇管理路由
        try {
            this.vocabularyRoutes = require('./routes/vocabulary-data-routes');
        } catch (error) {
            console.warn('词汇路由加载失败，使用内置API:', error.message);
            this.vocabularyRoutes = null;
        }
        
        this.setupServer();
    }

    /**
     * 创建必要目录
     */
    createDirectories() {
        const directories = ['uploads', 'exports', 'data', 'routes'];
        directories.forEach(dir => {
            const dirPath = path.join(__dirname, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                console.log(`✅ 创建目录: ${dir}`);
            }
        });
    }

    /**
     * 设置HTTP服务器
     */
    setupServer() {
        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });
    }

    /**
     * 处理HTTP请求
     */
    handleRequest(req, res) {
        // 使用 WHATWG URL API 替代弃用的 url.parse()
        let parsedUrl;
        try {
            const baseURL = `http://${req.headers.host || 'localhost'}`;
            parsedUrl = new URL(req.url, baseURL);
        } catch (error) {
            console.error('URL解析错误:', error);
            this.sendErrorResponse(res, 400, 'Bad Request', error);
            return;
        }
        
        const pathname = parsedUrl.pathname;
        const method = req.method;

        // 设置CORS头
        this.setupCORS(res);

        // 处理预检请求
        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        console.log(`${method} ${pathname}`);

        // 处理favicon请求 - 返回空响应避免错误
        if (pathname === '/favicon.ico') {
            res.writeHead(204);
            res.end();
            return;
        }

        // 处理Chrome DevTools配置请求
        if (pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
            res.writeHead(204);
            res.end();
            return;
        }

        // 优先处理词汇管理API
        if (pathname.startsWith('/api/vocabulary/') || pathname.startsWith('/api/game/vocabulary/')) {
            this.handleVocabularyAPI(req, res, pathname, method);
            return;
        }

        // 其他API路由处理
        if (pathname === '/api/health' && method === 'GET') {
            this.handleHealthCheck(req, res);
        } else if (pathname === '/api/questions' && method === 'GET') {
            this.handleGetQuestions(req, res, parsedUrl.searchParams);
        } else if (pathname === '/api/sessions' && method === 'POST') {
            this.handleCreateSession(req, res);
        } else if (pathname.startsWith('/api/stats/') && method === 'GET') {
            this.handleGetStats(req, res, pathname);
        } else {
            this.serveStaticFile(req, res);
        }
    }

    /**
     * 完整的API路由处理
     */
    handleVocabularyAPI(req, res, pathname, method) {
        const routeHandlers = {
            'GET:/api/vocabulary/export-vocabulary-json': this.handleExportVocabulary.bind(this),
            'GET:/api/vocabulary/vocabulary-statistics': this.handleVocabularyStats.bind(this),
            'GET:/api/vocabulary/check-vocabulary-integrity': this.handleCheckIntegrity.bind(this),
            'GET:/api/vocabulary/get-imported-files': this.handleGetImportedFiles.bind(this),
            'GET:/api/vocabulary/get-file-details': this.handleGetFileDetails.bind(this),
            'GET:/api/vocabulary/vocabulary-status': this.handleVocabularyStatus.bind(this),
            'GET:/api/game/vocabulary/export-vocabulary-json': this.handleExportVocabulary.bind(this),
            'GET:/api/game/vocabulary/vocabulary-statistics': this.handleVocabularyStats.bind(this),
            'GET:/api/game/vocabulary/check-vocabulary-integrity': this.handleCheckIntegrity.bind(this),
            'GET:/api/game/vocabulary/get-imported-files': this.handleGetImportedFiles.bind(this),
            'GET:/api/game/vocabulary/get-file-details': this.handleGetFileDetails.bind(this),
            'GET:/api/game/vocabulary/vocabulary-status': this.handleVocabularyStatus.bind(this),
            'POST:/api/vocabulary/generate-vocabulary-sample': this.handleGenerateSample.bind(this),
            'POST:/api/vocabulary/cleanup-vocabulary-data': this.handleCleanupData.bind(this),
            'POST:/api/vocabulary/import-vocabulary-multiple': this.handleFileUpload.bind(this),
            'POST:/api/vocabulary/delete-imported-file': this.handleDeleteImportedFile.bind(this),
            'POST:/api/game/vocabulary/generate-vocabulary-sample': this.handleGenerateSample.bind(this),
            'POST:/api/game/vocabulary/cleanup-vocabulary-data': this.handleCleanupData.bind(this),
            'POST:/api/game/vocabulary/import-vocabulary-multiple': this.handleFileUpload.bind(this),
            'POST:/api/game/vocabulary/delete-imported-file': this.handleDeleteImportedFile.bind(this),
            'GET:/api/game/questions': this.handleGetGameQuestions.bind(this)
        };

        const routeKey = `${method}:${pathname}`;
        const handler = routeHandlers[routeKey];

        if (handler) {
            handler(req, res);
        } else {
            this.sendErrorResponse(res, 404, 'API端点不存在', null, { path: pathname, method: method });
        }
    }

    /**
     * 获取词汇库状态
     */
    handleVocabularyStatus(req, res) {
        try {
            const vocabFile = path.join(__dirname, 'data', 'vocabulary.json');
            const exists = fs.existsSync(vocabFile);
            let wordCount = 0;
            
            if (exists) {
                try {
                    const vocabData = JSON.parse(fs.readFileSync(vocabFile, 'utf8'));
                    wordCount = vocabData.vocabulary ? vocabData.vocabulary.length : 0;
                } catch (e) {
                    console.warn('解析词汇文件失败:', e);
                }
            }
            
            this.sendSuccessResponse(res, {
                exists: exists,
                wordCount: wordCount,
                isEmpty: wordCount === 0
            }, '词汇库状态获取成功');
        } catch (error) {
            this.sendErrorResponse(res, 500, `检查词汇库状态失败: ${error.message}`, error);
        }
    }

    /**
     * 获取词汇统计
     */
    handleVocabularyStats(req, res) {
        try {
            const stats = this.loadActualVocabularyStats();
            this.sendSuccessResponse(res, stats, '词汇统计获取成功');
        } catch (error) {
            this.sendErrorResponse(res, 500, `获取统计失败: ${error.message}`, error);
        }
    }

    /**
     * 实际加载词汇统计数据
     */
    loadActualVocabularyStats() {
        const dataDir = path.join(__dirname, 'data');
        const vocabFile = path.join(dataDir, 'vocabulary.json');
        
        let totalWords = 0;
        let wordsByLevel = [];
        let wordsByPartOfSpeech = [];
        
        if (fs.existsSync(vocabFile)) {
            try {
                const vocabData = JSON.parse(fs.readFileSync(vocabFile, 'utf8'));
                const vocabulary = vocabData.vocabulary || [];
                totalWords = vocabulary.length;
                
                // 按等级统计
                const levelCount = {};
                const posCount = {};
                
                vocabulary.forEach(word => {
                    const level = word.level || '未知';
                    const pos = word.part_of_speech || '未知';
                    
                    levelCount[level] = (levelCount[level] || 0) + 1;
                    posCount[pos] = (posCount[pos] || 0) + 1;
                });
                
                wordsByLevel = Object.entries(levelCount).map(([level, count]) => ({
                    level, count
                }));
                
                wordsByPartOfSpeech = Object.entries(posCount).map(([part_of_speech, count]) => ({
                    part_of_speech, count
                }));
            } catch (error) {
                console.error('解析词汇文件失败:', error);
            }
        }
        
        return {
            total_words: [{ count: totalWords }],
            words_by_level: wordsByLevel,
            words_by_part_of_speech: wordsByPartOfSpeech,
            words_by_frequency: [
                { frequency_band: 1, count: Math.floor(totalWords * 0.3) },
                { frequency_band: 2, count: Math.floor(totalWords * 0.25) },
                { frequency_band: 3, count: Math.floor(totalWords * 0.2) },
                { frequency_band: 4, count: Math.floor(totalWords * 0.15) },
                { frequency_band: 5, count: Math.floor(totalWords * 0.1) }
            ]
        };
    }

    /**
     * 获取游戏题目
     */
    handleGetGameQuestions(req, res) {
        try {
            const searchParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
            const difficulty = searchParams.get('difficulty') || 'medium';
            const limit = parseInt(searchParams.get('limit')) || 1;
            
            // 从词汇库生成题目
            const questions = this.generateQuestionsFromVocabulary(difficulty, limit);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(questions));
        } catch (error) {
            console.error('获取游戏题目失败:', error);
            this.sendErrorResponse(res, 500, '获取题目失败', error);
        }
    }

    /**
     * 增强的文件上传处理
     */
    handleFileUpload(req, res) {
        const form = new multiparty.Form();
        const files = [];
        const fields = {};
        
        form.on('part', (part) => {
            if (!part.filename) {
                // 字段部分
                let field = '';
                part.on('data', (data) => {
                    field += data.toString();
                });
                part.on('end', () => {
                    fields[part.name] = field;
                });
            } else {
                // 文件部分
                const fileBuffer = [];
                part.on('data', (data) => {
                    fileBuffer.push(data);
                });
                part.on('end', () => {
                    files.push({
                        fieldName: part.name,
                        filename: part.filename,
                        content: Buffer.concat(fileBuffer)
                    });
                });
            }
        });
        
        form.on('close', () => {
            this.processUploadedFiles(files, fields, res);
        });
        
        form.on('error', (err) => {
            console.error('文件上传错误:', err);
            this.sendErrorResponse(res, 500, `文件上传失败: ${err.message}`, err);
        });
        
        form.parse(req);
    }

    /**
     * 处理上传的文件
     */
    async processUploadedFiles(files, fields, res) {
        try {
            if (files.length === 0) {
                this.sendErrorResponse(res, 400, '没有找到上传的文件');
                return;
            }
            
            const importMode = fields.mode || 'update';
            const results = [];
            let successCount = 0;
            let failedCount = 0;
            
            for (const file of files) {
                try {
                    // 保存文件到上传目录
                    const uploadsDir = path.join(__dirname, 'uploads');
                    if (!fs.existsSync(uploadsDir)) {
                        fs.mkdirSync(uploadsDir, { recursive: true });
                    }
                    
                    const filePath = path.join(uploadsDir, file.filename);
                    fs.writeFileSync(filePath, file.content);
                    
                    // 处理词汇导入
                    const result = await this.processVocabularyImport(filePath, importMode);
                    
                    if (result.success) {
                        successCount++;
                        results.push({
                            file: file.filename,
                            success: true,
                            message: result.message,
                            data: result.data
                        });
                    } else {
                        failedCount++;
                        results.push({
                            file: file.filename,
                            success: false,
                            message: result.message
                        });
                    }
                    
                } catch (error) {
                    failedCount++;
                    results.push({
                        file: file.filename,
                        success: false,
                        message: `处理文件失败: ${error.message}`
                    });
                }
            }
            
            this.sendSuccessResponse(res, {
                success: successCount,
                failed: failedCount,
                details: results
            }, `文件上传完成: 成功 ${successCount} 个, 失败 ${failedCount} 个`);
            
        } catch (error) {
            console.error('处理上传文件失败:', error);
            this.sendErrorResponse(res, 500, `处理上传文件失败: ${error.message}`, error);
        }
    }

    /**
     * 统一的错误响应
     */
    sendErrorResponse(res, statusCode, message, error = null, extraData = null) {
        const response = {
            success: false,
            message: message
        };
        
        if (error && process.env.NODE_ENV === 'development') {
            response.error = error.message;
            response.stack = error.stack;
        }
        
        if (extraData) {
            Object.assign(response, extraData);
        }
        
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
        
        // 记录错误日志
        console.error(`❌ ${statusCode} ${message}:`, error);
    }

    /**
     * 成功的响应
     */
    sendSuccessResponse(res, data = null, message = '操作成功') {
        const response = {
            success: true,
            message: message
        };
        
        if (data !== null) {
            response.data = data;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
    }

    /**
     * 获取已导入的文件列表
     */
    handleGetImportedFiles(req, res) {
        const uploadsDir = path.join(__dirname, 'uploads');
        const exportsDir = path.join(__dirname, 'exports');
        
        try {
            const importedFiles = [];
            
            // 读取uploads目录
            if (fs.existsSync(uploadsDir)) {
                const uploadFiles = fs.readdirSync(uploadsDir);
                uploadFiles.forEach(file => {
                    if (file.endsWith('.json')) {
                        const filePath = path.join(uploadsDir, file);
                        const stats = fs.statSync(filePath);
                        
                        let wordCount = 0;
                        try {
                            const content = fs.readFileSync(filePath, 'utf8');
                            const data = JSON.parse(content);
                            if (data.vocabulary && Array.isArray(data.vocabulary)) {
                                wordCount = data.vocabulary.length;
                            } else if (data.words && Array.isArray(data.words)) {
                                wordCount = data.words.length;
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                        
                        importedFiles.push({
                            name: file,
                            path: filePath,
                            size: stats.size,
                            modified: stats.mtime,
                            directory: 'uploads',
                            status: 'uploaded',
                            wordCount: wordCount
                        });
                    }
                });
            }
            
            // 读取exports目录
            if (fs.existsSync(exportsDir)) {
                const exportFiles = fs.readdirSync(exportsDir);
                exportFiles.forEach(file => {
                    if (file.endsWith('.json')) {
                        const filePath = path.join(exportsDir, file);
                        const stats = fs.statSync(filePath);
                        
                        let wordCount = 0;
                        try {
                            const content = fs.readFileSync(filePath, 'utf8');
                            const data = JSON.parse(content);
                            if (data.vocabulary && Array.isArray(data.vocabulary)) {
                                wordCount = data.vocabulary.length;
                            } else if (data.words && Array.isArray(data.words)) {
                                wordCount = data.words.length;
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                        
                        importedFiles.push({
                            name: file,
                            path: filePath,
                            size: stats.size,
                            modified: stats.mtime,
                            directory: 'exports',
                            status: 'exported',
                            wordCount: wordCount
                        });
                    }
                });
            }
            
            // 按修改时间排序
            importedFiles.sort((a, b) => new Date(b.modified) - new Date(a.modified));
            
            this.sendSuccessResponse(res, { files: importedFiles }, '文件列表获取成功');
            
        } catch (error) {
            this.sendErrorResponse(res, 500, `获取文件列表失败: ${error.message}`, error);
        }
    }

    /**
     * 删除导入的文件
     */
    handleDeleteImportedFile(req, res) {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { fileName, filePath } = data;
                
                if (!filePath || !fs.existsSync(filePath)) {
                    this.sendErrorResponse(res, 400, '文件不存在');
                    return;
                }
                
                // 安全检查：确保文件路径在允许的目录内
                const allowedDirs = [
                    path.join(__dirname, 'uploads'),
                    path.join(__dirname, 'exports')
                ];
                
                const isAllowed = allowedDirs.some(dir => 
                    filePath.startsWith(dir)
                );
                
                if (!isAllowed) {
                    this.sendErrorResponse(res, 403, '无权删除此文件');
                    return;
                }
                
                fs.unlinkSync(filePath);
                
                this.sendSuccessResponse(res, null, `文件 "${fileName}" 已删除`);
                
            } catch (error) {
                this.sendErrorResponse(res, 500, `删除文件失败: ${error.message}`, error);
            }
        });
    }

    /**
     * 获取文件详情
     */
    handleGetFileDetails(req, res) {
        // 使用 URLSearchParams 替代 querystring
        let parsedUrl;
        try {
            const baseURL = `http://${req.headers.host || 'localhost'}`;
            parsedUrl = new URL(req.url, baseURL);
        } catch (error) {
            this.sendErrorResponse(res, 400, 'URL解析错误', error);
            return;
        }
        
        const filePath = parsedUrl.searchParams.get('filePath');
        
        if (!filePath) {
            this.sendErrorResponse(res, 400, '缺少文件路径参数');
            return;
        }
        
        try {
            // 安全检查
            const allowedDirs = [
                path.join(__dirname, 'uploads'),
                path.join(__dirname, 'exports')
            ];
            
            const isAllowed = allowedDirs.some(dir => 
                filePath.startsWith(dir)
            );
            
            if (!isAllowed) {
                this.sendErrorResponse(res, 403, '无权访问此文件');
                return;
            }
            
            if (!fs.existsSync(filePath)) {
                this.sendErrorResponse(res, 404, '文件不存在');
                return;
            }
            
            const stats = fs.statSync(filePath);
            const fileContent = fs.readFileSync(filePath, 'utf8');
            
            let wordCount = 0;
            let previewContent = fileContent;
            try {
                const jsonData = JSON.parse(fileContent);
                if (jsonData.vocabulary && Array.isArray(jsonData.vocabulary)) {
                    wordCount = jsonData.vocabulary.length;
                } else if (jsonData.words && Array.isArray(jsonData.words)) {
                    wordCount = jsonData.words.length;
                }
                previewContent = JSON.stringify(jsonData, null, 2);
            } catch (e) {
                // 如果不是有效的JSON，保持原内容
            }
            
            const fileDetails = {
                name: path.basename(filePath),
                path: filePath,
                size: stats.size,
                modified: stats.mtime,
                wordCount: wordCount,
                content: previewContent.substring(0, 10000) // 限制预览内容大小
            };
            
            this.sendSuccessResponse(res, fileDetails, '文件详情获取成功');
            
        } catch (error) {
            this.sendErrorResponse(res, 500, `获取文件详情失败: ${error.message}`, error);
        }
    }

    /**
     * 处理多文件词汇导入
     */
    handleImportVocabularyMultiple(req, res) {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                // 修复：改进文件解析逻辑
                const contentType = req.headers['content-type'];
                if (!contentType || !contentType.includes('multipart/form-data')) {
                    this.sendErrorResponse(res, 400, '无效的请求格式，需要multipart/form-data');
                    return;
                }

                const boundary = contentType.split('boundary=')[1];
                if (!boundary) {
                    this.sendErrorResponse(res, 400, '无法解析请求边界');
                    return;
                }

                const files = [];
                const parts = body.split(`--${boundary}`);
                
                for (const part of parts) {
                    if (part.includes('Content-Disposition: form-data') && part.includes('filename=')) {
                        const filenameMatch = part.match(/filename="([^"]+)"/);
                        const nameMatch = part.match(/name="([^"]+)"/);
                        
                        if (filenameMatch && nameMatch) {
                            // 提取文件内容
                            const contentStart = part.indexOf('\r\n\r\n') + 4;
                            const contentEnd = part.lastIndexOf('\r\n');
                            const fileContent = part.substring(contentStart, contentEnd);
                            
                            if (fileContent && fileContent.trim().length > 0) {
                                files.push({
                                    fieldName: nameMatch[1],
                                    filename: filenameMatch[1],
                                    content: fileContent
                                });
                            }
                        }
                    }
                }

                if (files.length === 0) {
                    this.sendErrorResponse(res, 400, '没有找到有效的文件');
                    return;
                }

                // 修复：实际处理文件导入
                const importMode = this.getFormDataValue(body, boundary, 'mode') || 'update';
                const results = [];
                let successCount = 0;
                let failedCount = 0;
                let skippedCount = 0;

                for (const file of files) {
                    try {
                        // 保存文件到上传目录
                        const uploadsDir = path.join(__dirname, 'uploads');
                        if (!fs.existsSync(uploadsDir)) {
                            fs.mkdirSync(uploadsDir, { recursive: true });
                        }

                        const filePath = path.join(uploadsDir, file.filename);
                        fs.writeFileSync(filePath, file.content);

                        // 处理词汇导入
                        const result = await this.processVocabularyImport(filePath, importMode);
                        
                        if (result.success) {
                            successCount += result.data?.imported || 0;
                            skippedCount += result.data?.skipped || 0;
                            results.push({
                                file: file.filename,
                                success: true,
                                message: result.message,
                                data: result.data
                            });
                        } else {
                            failedCount++;
                            results.push({
                                file: file.filename,
                                success: false,
                                message: result.message
                            });
                        }
                        
                        // 清理临时文件
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                        }
                        
                    } catch (error) {
                        failedCount++;
                        results.push({
                            file: file.filename,
                            success: false,
                            message: `处理文件失败: ${error.message}`
                        });
                    }
                }

                this.sendSuccessResponse(res, {
                    summary: {
                        success: successCount,
                        skipped: skippedCount,
                        failed: failedCount
                    },
                    details: results
                }, `批量导入完成: 成功导入 ${successCount} 个词汇, 跳过 ${skippedCount} 个, 失败 ${failedCount} 个`);
                
            } catch (error) {
                console.error('导入词汇失败:', error);
                this.sendErrorResponse(res, 500, `导入失败: ${error.message}`, error);
            }
        });
    }

    /**
     * 处理词汇导入
     */
    async processVocabularyImport(filePath, importMode) {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const importedData = JSON.parse(fileContent);
            const importedVocabulary = importedData.vocabulary || importedData.words || [];
            
            if (!Array.isArray(importedVocabulary)) {
                return {
                    success: false,
                    message: '无效的词汇数据格式'
                };
            }
            
            // 加载现有词汇
            const dataDir = path.join(__dirname, 'data');
            const vocabFile = path.join(dataDir, 'vocabulary.json');
            let existingVocabulary = [];
            
            if (fs.existsSync(vocabFile)) {
                const existingData = JSON.parse(fs.readFileSync(vocabFile, 'utf8'));
                existingVocabulary = existingData.vocabulary || [];
            }
            
            let importedCount = 0;
            let skippedCount = 0;
            const mergedVocabulary = [...existingVocabulary];
            
            // 根据导入模式处理词汇
            for (const word of importedVocabulary) {
                const existingIndex = mergedVocabulary.findIndex(w => w.word === word.word);
                
                if (existingIndex === -1) {
                    // 新词汇，直接添加
                    mergedVocabulary.push(word);
                    importedCount++;
                } else if (importMode === 'update') {
                    // 更新现有词汇
                    mergedVocabulary[existingIndex] = { ...mergedVocabulary[existingIndex], ...word };
                    importedCount++;
                } else {
                    // 跳过现有词汇
                    skippedCount++;
                }
            }
            
            // 保存合并后的词汇
            const finalData = {
                vocabulary: mergedVocabulary,
                metadata: {
                    last_updated: new Date().toISOString(),
                    total_words: mergedVocabulary.length,
                    source: 'manual_import'
                }
            };
            
            fs.writeFileSync(vocabFile, JSON.stringify(finalData, null, 2));
            
            return {
                success: true,
                message: `成功导入 ${importedCount} 个词汇，跳过 ${skippedCount} 个现有词汇`,
                data: {
                    imported: importedCount,
                    skipped: skippedCount,
                    total: mergedVocabulary.length
                }
            };
            
        } catch (error) {
            return {
                success: false,
                message: `处理词汇文件失败: ${error.message}`
            };
        }
    }

    /**
     * 从multipart表单数据中获取字段值
     */
    getFormDataValue(body, boundary, fieldName) {
        const parts = body.split(`--${boundary}`);
        for (const part of parts) {
            if (part.includes(`name="${fieldName}"`)) {
                const valueStart = part.indexOf('\r\n\r\n') + 4;
                const valueEnd = part.lastIndexOf('\r\n');
                return part.substring(valueStart, valueEnd);
            }
        }
        return null;
    }

    /**
     * 导出词汇数据
     */
    handleExportVocabulary(req, res) {
        try {
            // 从实际词汇文件导出
            const vocabFile = path.join(__dirname, 'data', 'vocabulary.json');
            let exportData;
            
            if (fs.existsSync(vocabFile)) {
                const fileContent = fs.readFileSync(vocabFile, 'utf8');
                exportData = JSON.parse(fileContent);
            } else {
                // 如果没有词汇文件，使用示例数据
                exportData = {
                    vocabulary: [
                        {
                            word: "abandon",
                            phonetic: "/əˈbændən/",
                            definition: "to leave a place, thing, or person forever",
                            part_of_speech: "verb",
                            level: "CET-4",
                            example_sentence: "They had to abandon their home because of the flood.",
                            synonyms: ["desert", "leave", "forsake"],
                            antonyms: ["keep", "retain"],
                            word_family: ["abandoned", "abandonment"],
                            frequency_band: 1
                        },
                        {
                            word: "beneficial",
                            phonetic: "/ˌbenɪˈfɪʃl/",
                            definition: "having a good effect; favorable",
                            part_of_speech: "adjective",
                            level: "CET-4",
                            example_sentence: "Regular exercise is beneficial to health.",
                            synonyms: ["advantageous", "helpful", "favorable"],
                            antonyms: ["harmful", "detrimental"],
                            word_family: ["benefit", "beneficially"],
                            frequency_band: 2
                        }
                    ],
                    metadata: {
                        exported_at: new Date().toISOString(),
                        total_words: 2,
                        version: "1.0"
                    }
                };
            }

            const exportDir = path.join(__dirname, 'exports');
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }

            const filename = `vocabulary-export-${Date.now()}.json`;
            const filePath = path.join(exportDir, filename);
            
            fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));

            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${filename}"`
            });
            
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
            
            fileStream.on('close', () => {
                // 可选：传输完成后删除文件
                setTimeout(() => {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }, 5000);
            });
            
        } catch (error) {
            this.sendErrorResponse(res, 500, `导出失败: ${error.message}`, error);
        }
    }

    /**
     * 检查数据完整性
     */
    handleCheckIntegrity(req, res) {
        try {
            const vocabFile = path.join(__dirname, 'data', 'vocabulary.json');
            let totalWords = 0;
            let validWords = 0;
            let invalidWords = 0;
            const issues = [];
            
            if (fs.existsSync(vocabFile)) {
                const vocabData = JSON.parse(fs.readFileSync(vocabFile, 'utf8'));
                const vocabulary = vocabData.vocabulary || [];
                totalWords = vocabulary.length;
                
                vocabulary.forEach((word, index) => {
                    if (!word.word || !word.definition) {
                        invalidWords++;
                        issues.push(`词汇 ${index + 1}: 缺少单词或定义`);
                    } else if (!word.phonetic) {
                        issues.push(`词汇 "${word.word}": 缺少音标`);
                    } else if (!word.example_sentence) {
                        issues.push(`词汇 "${word.word}": 缺少例句`);
                    } else {
                        validWords++;
                    }
                });
            }
            
            const integrityData = {
                total_words: totalWords,
                valid_words: validWords,
                invalid_words: invalidWords,
                issues: issues
            };

            this.sendSuccessResponse(res, integrityData, '数据完整性检查完成');
        } catch (error) {
            this.sendErrorResponse(res, 500, `检查数据完整性失败: ${error.message}`, error);
        }
    }

    /**
     * 生成示例数据
     */
    handleGenerateSample(req, res) {
        const sampleData = {
            vocabulary: [
                {
                    word: "example",
                    phonetic: "/ɪɡˈzæmpəl/",
                    definition: "a thing characteristic of its kind or illustrating a general rule",
                    part_of_speech: "noun",
                    level: "CET-4",
                    example_sentence: "This is a good example of how to solve the problem.",
                    synonyms: ["instance", "case", "illustration"],
                    antonyms: ["exception"],
                    word_family: ["exemplify", "exemplary"],
                    frequency_band: 1
                }
            ],
            version: "1.0",
            generated_at: new Date().toISOString()
        };

        const exportsDir = path.join(__dirname, 'exports');
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
        }

        const sampleFile = path.join(exportsDir, 'vocabulary-sample.json');
        fs.writeFileSync(sampleFile, JSON.stringify(sampleData, null, 2));

        this.sendSuccessResponse(res, { file: sampleFile }, '示例数据生成成功');
    }

    /**
     * 清理数据
     */
    handleCleanupData(req, res) {
        try {
            const vocabFile = path.join(__dirname, 'data', 'vocabulary.json');
            let deletedCount = 0;
            
            if (fs.existsSync(vocabFile)) {
                const vocabData = JSON.parse(fs.readFileSync(vocabFile, 'utf8'));
                deletedCount = vocabData.vocabulary?.length || 0;
                fs.unlinkSync(vocabFile);
            }
            
            // 清理上传和导出目录
            const cleanDirectory = (dirPath) => {
                if (fs.existsSync(dirPath)) {
                    const files = fs.readdirSync(dirPath);
                    files.forEach(file => {
                        if (file.endsWith('.json')) {
                            fs.unlinkSync(path.join(dirPath, file));
                        }
                    });
                }
            };
            
            cleanDirectory(path.join(__dirname, 'uploads'));
            cleanDirectory(path.join(__dirname, 'exports'));
            
            this.sendSuccessResponse(res, null, `数据清理完成，共删除 ${deletedCount} 条词汇记录`);
        } catch (error) {
            this.sendErrorResponse(res, 500, `清理数据失败: ${error.message}`, error);
        }
    }

    /**
     * 从词汇库生成游戏题目
     */
    generateQuestionsFromVocabulary(difficulty = 'medium', limit = 10) {
        try {
            const vocabFile = path.join(__dirname, 'data', 'vocabulary.json');
            if (!fs.existsSync(vocabFile)) {
                return this.initializeQuestions(); // 回退到内置题目
            }
            
            const vocabData = JSON.parse(fs.readFileSync(vocabFile, 'utf8'));
            const vocabulary = vocabData.vocabulary || [];
            
            if (vocabulary.length === 0) {
                return this.initializeQuestions();
            }
            
            const questions = [];
            const usedIndices = new Set();
            
            // 根据词汇生成各种类型的题目
            while (questions.length < limit && usedIndices.size < vocabulary.length) {
                const randomIndex = Math.floor(Math.random() * vocabulary.length);
                if (usedIndices.has(randomIndex)) continue;
                
                usedIndices.add(randomIndex);
                const word = vocabulary[randomIndex];
                
                // 生成不同类型的题目
                const questionType = this.getRandomQuestionType();
                const question = this.createQuestionFromWord(word, questionType, difficulty);
                
                if (question) {
                    questions.push(question);
                }
            }
            
            return questions.length > 0 ? questions : this.initializeQuestions();
        } catch (error) {
            console.error('从词汇库生成题目失败:', error);
            return this.initializeQuestions();
        }
    }

    /**
     * 获取随机题目类型
     */
    getRandomQuestionType() {
        const types = ['definition', 'spelling', 'sentence'];
        return types[Math.floor(Math.random() * types.length)];
    }

    /**
     * 从单词创建题目
     */
    createQuestionFromWord(word, type, difficulty) {
        const baseQuestion = {
            id: Date.now() + Math.random(),
            difficulty: difficulty,
            category: 'vocabulary'
        };
        
        switch (type) {
            case 'definition':
                return {
                    ...baseQuestion,
                    type: 'vocabulary_definition',
                    text: `"${word.word}" 的意思是什么？`,
                    word: word.word,
                    options: this.generateDefinitionOptions(word),
                    correctAnswer: word.definition,
                    explanation: `"${word.word}" 的意思是: ${word.definition}`
                };
                
            case 'spelling':
                const wrongSpelling = this.generateWrongSpelling(word.word);
                return {
                    ...baseQuestion,
                    type: 'spelling',
                    text: `找出正确的单词拼写：`,
                    displayText: wrongSpelling,
                    wrongSpelling: wrongSpelling,
                    options: this.generateSpellingOptions(word.word, wrongSpelling),
                    correctAnswer: word.word,
                    explanation: `正确的拼写是 "${word.word}"`
                };
                
            case 'sentence':
                const sentenceTemplate = this.createSentenceTemplate(word);
                return {
                    ...baseQuestion,
                    type: 'fillBlank',
                    text: `选择正确的单词完成句子：\n"${sentenceTemplate}"`,
                    sentence: sentenceTemplate,
                    options: this.generateSentenceOptions(word),
                    correctAnswer: word.word,
                    explanation: `正确的单词是 "${word.word}"`
                };
        }
        
        return null;
    }

    /**
     * 生成定义选项
     */
    generateDefinitionOptions(word) {
        const options = [word.definition];
        
        // 添加干扰项
        const distractors = [
            "to move quickly",
            "a large building",
            "to think deeply",
            "a small animal"
        ];
        
        while (options.length < 4) {
            const randomDistractor = distractors[options.length % distractors.length];
            if (!options.includes(randomDistractor)) {
                options.push(randomDistractor);
            }
        }
        
        return this.shuffleArray(options);
    }

    /**
     * 生成错误拼写
     */
    generateWrongSpelling(word) {
        if (word.length <= 3) return word;
        
        const variations = [
            word.replace(/e$/i, ''),
            word.replace(/ie/gi, 'ei'),
            word.replace(/ph/gi, 'f'),
            word + 'e'
        ];
        
        const validVariations = variations.filter(v => v !== word && v.length > 0);
        return validVariations.length > 0 
            ? validVariations[Math.floor(Math.random() * validVariations.length)]
            : word.slice(0, -1); // 移除最后一个字符作为备用
    }

    /**
     * 生成拼写选项
     */
    generateSpellingOptions(correct, wrong) {
        const options = [correct, wrong];
        
        // 添加其他拼写变体
        while (options.length < 4) {
            const variation = this.generateWrongSpelling(correct);
            if (!options.includes(variation)) {
                options.push(variation);
            }
        }
        
        return this.shuffleArray(options);
    }

    /**
     * 创建句子模板
     */
    createSentenceTemplate(word) {
        const templates = [
            `The ${word.word} is very important in this context.`,
            `I need to understand the concept of ${word.word}.`,
            `Can you explain what ${word.word} means?`,
            `The ${word.word} plays a crucial role in this process.`
        ];
        
        return templates[Math.floor(Math.random() * templates.length)];
    }

    /**
     * 生成句子选项
     */
    generateSentenceOptions(word) {
        const options = [word.word];
        
        // 添加同义词或相关单词作为干扰项
        const relatedWords = word.synonyms || ['concept', 'idea', 'notion', 'thought'];
        
        for (const relatedWord of relatedWords) {
            if (options.length < 4 && relatedWord !== word.word) {
                options.push(relatedWord);
            }
        }
        
        // 如果选项不够，添加通用干扰项
        while (options.length < 4) {
            const genericOption = `option${options.length}`;
            if (!options.includes(genericOption)) {
                options.push(genericOption);
            }
        }
        
        return this.shuffleArray(options);
    }

    /**
     * 以下为原有HTTP API方法
     */
    setupCORS(res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }

    handleHealthCheck(req, res) {
        const healthData = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            players: this.players.size,
            sessions: this.gameSessions.size,
            questions: this.questions.length,
            version: '2.0.0',
            port: this.port
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(healthData));
    }

    handleGetQuestions(req, res, searchParams) {
        // 使用 URLSearchParams 替代 query 对象
        const difficulty = searchParams.get('difficulty');
        const category = searchParams.get('category');
        const limit = parseInt(searchParams.get('limit')) || 10;
        
        try {
            // 优先从词汇库生成题目
            let questions = this.generateQuestionsFromVocabulary(difficulty, limit);
            
            // 如果没有词汇数据，使用内置题目
            if (questions.length === 0) {
                questions = [...this.questions];
            }
            
            let filteredQuestions = [...questions];
            
            if (difficulty) {
                filteredQuestions = filteredQuestions.filter(q => q.difficulty === difficulty);
            }
            
            if (category) {
                filteredQuestions = filteredQuestions.filter(q => q.category === category);
            }
            
            const selectedQuestions = this.shuffleArray(filteredQuestions)
                .slice(0, limit);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(selectedQuestions));
            
        } catch (error) {
            console.error('获取题目失败:', error);
            // 出错时返回内置题目
            const selectedQuestions = this.shuffleArray([...this.questions])
                .slice(0, limit);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(selectedQuestions));
        }
    }

    handleCreateSession(req, res) {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { playerId, difficulty = 'medium' } = data;
                
                if (!playerId) {
                    this.sendErrorResponse(res, 400, '缺少玩家ID');
                    return;
                }

                const sessionId = this.generateSessionId();
                const session = {
                    id: sessionId,
                    players: [playerId],
                    difficulty,
                    state: 'waiting',
                    score: 0,
                    level: 1,
                    startTime: new Date(),
                    currentQuestion: null,
                    questions: this.getQuestionsForDifficulty(difficulty),
                    usedQuestions: new Set()
                };

                this.gameSessions.set(sessionId, session);
                
                this.sendSuccessResponse(res, { 
                    sessionId, 
                    session: {
                        id: session.id,
                        difficulty: session.difficulty,
                        state: session.state
                    }
                }, '游戏会话创建成功');
                
            } catch (error) {
                this.sendErrorResponse(res, 400, '无效的JSON数据', error);
            }
        });
    }

    handleGetStats(req, res, pathname) {
        const playerId = pathname.split('/').pop();
        
        const stats = {
            playerId,
            totalGames: Math.floor(Math.random() * 50),
            highScore: Math.floor(Math.random() * 10000),
            averageScore: Math.floor(Math.random() * 5000),
            favoriteCategory: 'vocabulary',
            weakAreas: ['grammar', 'spelling'],
            achievements: ['score_1000', 'combo_10']
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stats));
    }

    serveStaticFile(req, res) {
        let parsedUrl;
        try {
            const baseURL = `http://${req.headers.host || 'localhost'}`;
            parsedUrl = new URL(req.url, baseURL);
        } catch (error) {
            this.sendErrorResponse(res, 400, 'Bad Request', error);
            return;
        }
        
        let pathname = path.join(__dirname, parsedUrl.pathname);
        
        // 如果请求根路径，返回云梦智间游戏界面.html
        if (parsedUrl.pathname === '/') {
            pathname = path.join(__dirname, '云梦智间游戏界面.html');
        }

        // 如果请求的是目录，默认返回云梦智间游戏界面.html
        if (parsedUrl.pathname.endsWith('/')) {
            pathname = path.join(__dirname, parsedUrl.pathname, '云梦智间游戏界面.html');
        }

        // 安全检查：防止路径遍历攻击
        if (!pathname.startsWith(__dirname)) {
            this.sendErrorResponse(res, 403, '禁止访问');
            return;
        }

        // 如果文件不存在，返回404
        if (!fs.existsSync(pathname)) {
            console.log('文件未找到:', pathname);
            this.sendErrorResponse(res, 404, '文件未找到');
            return;
        }

        // 获取文件状态
        const stat = fs.statSync(pathname);
        
        // 如果是目录，返回云梦智间游戏界面.html
        if (stat.isDirectory()) {
            pathname = path.join(pathname, '云梦智间游戏界面.html');
            if (!fs.existsSync(pathname)) {
                this.sendErrorResponse(res, 404, '目录索引未找到');
                return;
            }
        }

        // 根据文件扩展名设置Content-Type
        const ext = path.extname(pathname).toLowerCase();
        const contentTypes = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon',
            '.svg': 'image/svg+xml'
        };

        const contentType = contentTypes[ext] || 'text/plain; charset=utf-8';

        // 设置缓存头（可选）
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 缓存1小时

        res.writeHead(200, { 
            'Content-Type': contentType,
            'Content-Length': stat.size
        });

        const readStream = fs.createReadStream(pathname);
        readStream.pipe(res);

        readStream.on('error', (error) => {
            console.error('文件读取错误:', error);
            this.sendErrorResponse(res, 500, '服务器错误', error);
        });
    }

    /**
     * 工具方法
     */
    initializeQuestions() {
        return [
            {
                id: 1,
                type: 'spelling',
                text: "找出正确的单词拼写：",
                displayText: "recieve",
                wrongSpelling: "recieve",
                options: ["receive", "recieve", "recive", "receve"],
                correctAnswer: "receive",
                difficulty: "easy",
                category: "spelling",
                explanation: "正确的拼写是 'receive'，遵循 'i before e except after c' 的规则。"
            },
            {
                id: 2,
                type: 'fillBlank',
                text: "选择正确的单词完成句子：\n\"I ____ to school every day.\"",
                sentence: "I ____ to school every day.",
                options: ["go", "went", "have gone", "going"],
                correctAnswer: "go",
                difficulty: "easy",
                category: "grammar",
                explanation: "一般现在时，第一人称用 'go'。"
            },
            {
                id: 3,
                type: 'synonym',
                text: "选择 \"happy\" 的同义词：",
                word: "happy",
                options: ["joyful", "sad", "angry", "tired"],
                correctAnswer: "joyful",
                difficulty: "easy",
                category: "vocabulary",
                explanation: "'joyful' 是 'happy' 的同义词，意思是非常高兴。"
            },
            {
                id: 4,
                type: 'grammar',
                text: "选择正确的句子：",
                sentence: "She don't like coffee.",
                options: [
                    "She doesn't like coffee.",
                    "She don't like coffee.",
                    "She not like coffee.",
                    "She doesn't likes coffee."
                ],
                correctAnswer: "She doesn't like coffee.",
                difficulty: "medium",
                category: "grammar",
                explanation: "第三人称单数要用 doesn't，动词保持原形。"
            },
            {
                id: 5,
                type: 'vocabulary_definition',
                text: "\"abandon\" 的意思是什么？",
                word: "abandon",
                options: [
                    "to leave a place, thing, or person forever",
                    "to arrive at a place",
                    "to help someone",
                    "to build something"
                ],
                correctAnswer: "to leave a place, thing, or person forever",
                difficulty: "medium",
                category: "vocabulary",
                explanation: "'abandon' 意思是永久离开某地、某物或某人。"
            }
        ];
    }

    generateQuestion(difficulty = 'medium') {
        const questions = this.getQuestionsForDifficulty(difficulty);
        return questions[Math.floor(Math.random() * questions.length)];
    }

    getQuestionsForDifficulty(difficulty, level = 1) {
        return this.questions.filter(q => q.difficulty === difficulty)
            .slice(0, 10 + level * 5);
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 启动服务器（自动端口选择）
     */
    start() {
        this.tryStartServer(this.port);
    }

    /**
     * 尝试启动服务器，如果端口被占用则自动尝试下一个端口
     */
    tryStartServer(port) {
        this.server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                this.currentPortAttempt++;
                
                if (this.currentPortAttempt >= this.maxPortAttempts) {
                    console.error(`❌ 已尝试 ${this.maxPortAttempts} 个端口，全部被占用`);
                    console.log('💡 请手动指定端口: PORT=3001 node server.js');
                    process.exit(1);
                }
                
                const nextPort = port + 1;
                console.log(`🔄 端口 ${port} 被占用，尝试端口 ${nextPort}...`);
                
                // 移除旧的错误监听器
                this.server.removeAllListeners('error');
                
                // 尝试下一个端口
                setTimeout(() => {
                    this.tryStartServer(nextPort);
                }, 100);
            } else {
                console.error('❌ 服务器启动失败:', error);
            }
        });

        this.server.listen(port, () => {
            this.port = port; // 更新实际使用的端口
            this.onServerStarted();
        });
    }

    /**
     * 服务器成功启动后的回调
     */
    onServerStarted() {
        console.log(`🚀 单词爆破手游戏服务器运行在端口 ${this.port}`);
        console.log(`📍 本地访问: http://localhost:${this.port}`);
        console.log(`📊 健康检查: http://localhost:${this.port}/api/health`);
        console.log(`📚 获取题目: http://localhost:${this.port}/api/questions`);
        console.log(`🎮 游戏界面: http://localhost:${this.port}/`);
        console.log(`💾 词汇管理: http://localhost:${this.port}/#vocabulary`);
        console.log(`\n📁 服务器根目录: ${__dirname}`);
        console.log(`✅ 服务器已完全配置，所有功能可用\n`);
        
        // 清除错误监听器，因为服务器已经成功启动
        this.server.removeAllListeners('error');
    }

    /**
     * 调试信息
     */
    debugInfo() {
        console.log('\n=== 游戏服务器调试信息 ===');
        console.log(`运行端口: ${this.port}`);
        console.log(`在线玩家: ${this.players.size}`);
        console.log(`活跃会话: ${this.gameSessions.size}`);
        console.log(`题目数量: ${this.questions.length}`);
        
        // 词汇统计
        const vocabStats = this.loadActualVocabularyStats();
        console.log(`总词汇量: ${vocabStats.total_words[0].count}`);
        
        this.gameSessions.forEach((session, id) => {
            console.log(`会话 ${id}: ${session.state} - 玩家: ${session.players.length}`);
        });
    }

    /**
     * 重置游戏数据
     */
    resetGameData() {
        this.players.clear();
        this.gameSessions.clear();
        console.log('✅ 游戏数据已重置');
    }
}

module.exports = GameServer;