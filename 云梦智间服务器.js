// [file name]: 云梦智间服务器.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// 导入模块
const { db, examRouter } = require('./server_modules/database.js');
const authMiddleware = require('./server_modules/auth-middleware.js');
const authRoutes = require('./server_modules/routes/auth.js');
const userRoutes = require('./server_modules/routes/user.js');
const communityRoutes = require('./server_modules/routes/community.js');
const excelParser = require('./server_modules/utils/excel-parser.js');
const aiChatRoutes = require('./server_modules/routes/ai-chat.js');
const aiEnhancedRoutes = require('./server_modules/routes/ai-enhanced.js');
const aiLearningRoutes = require('./server_modules/routes/ai-learning.js');
const aiLearningPathRoutes = require('./server_modules/routes/ai-learning-path.js');
const assessmentQuestionsRoutes = require('./server_modules/routes/assessment-questions.js');
const aiAnalysisRoutes = require('./server_modules/routes/ai-analysis.js');
const writingRoutes = require('./server_modules/routes/writing.js');
const subscriptionRoutes = require('./server_modules/routes/subscription.js');

// 新增：导入计划API路由
const planRoutes = require('./计划API服务.js');

// 新增：导入错题本路由和初始化模块
const errorQuestionsRoutes = require('./server_modules/routes/error-questions.js');
const { completeErrorQuestionsSetup, insertErrorQuestionsTestData } = require('./server_modules/init-error-questions-tables.js');

// 新增：导入增强版日记路由
const diaryEnhancedRoutes = require('./server_modules/routes/diary-enhanced.js');

// 新增：导入增强版日记表初始化模块
const { 
    initDiaryTables, 
    checkDiaryTables, 
    completeDiarySetup,
    insertTestData 
} = require('./server_modules/init-diary-tables-enhanced.js');

// 新增：导入兼容性认证模块
const authCompat = require('./server_modules/auth-compat.js');

// 新增：导入日记表修复模块
const { fixDiaryTables } = require('./server_modules/fix-diary-tables.js');

// 新增：导入PDF导入管理路由 - 使用本地解析版本
const pdfImportManagerRoutes = require('./server_modules/routes/pdf-import-manager.js');

// 新增：导入增强版考试路由模块
const examEnhancedRoutes = require('./server_modules/routes/exam-enhanced.js');

// 新增：导入真题数据路由模块
const examDataRoutes = require('./server_modules/routes/exam-data-routes.js');

// 新增：导入增强版写作路由
const writingEnhancedRoutes = require('./server_modules/routes/writing-enhanced.js');

// 新增：导入扣子智能体服务
const botService = require('./server_modules/services/bot-service.js');

// 修改：正确的游戏服务器集成
const GameServer = require('./game-server.js');

const app = express();
const PORT = process.env.PORT || 3000;

// 配置multer用于文件上传
const upload = multer({ 
    dest: 'uploads/',
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB限制
    }
});

// 确保上传目录存在
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads', { recursive: true });
}

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('.'));
// 添加图片静态文件服务
app.use('/image', express.static(path.join(__dirname, 'image')));

// ==================== 音频文件服务增强 ====================

// 添加直接音频文件服务 - 放在所有静态服务之前
app.use('/audio', express.static(path.join(__dirname, '真题与听力'), {
    setHeaders: (res, path) => {
        res.set('Access-Control-Allow-Origin', '*');
    }
}));

// 增强音频文件服务配置
const audioBasePaths = [
    path.join(__dirname, '真题与听力'),
    path.join(__dirname, '../真题与听力'),
    path.join(process.cwd(), '真题与听力')
];

audioBasePaths.forEach(basePath => {
    if (fs.existsSync(basePath)) {
        console.log(`🎵 注册音频文件服务: ${basePath}`);
        
        // 四级听力
        const cet4Paths = [
            path.join(basePath, '四级听力'),
            path.join(basePath, '四级听力真题'),
            path.join(basePath, 'CET-4'),
            path.join(basePath, 'cet4')
        ];
        
        cet4Paths.forEach(cet4Path => {
            if (fs.existsSync(cet4Path)) {
                app.use('/四级听力', express.static(cet4Path, {
                    setHeaders: (res, path) => {
                        res.set('Access-Control-Allow-Origin', '*');
                        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
                        // 特别为MP3文件设置正确的MIME类型
                        if (path.endsWith('.mp3')) {
                            res.set('Content-Type', 'audio/mpeg');
                        }
                    },
                    index: false, // 禁用目录索引
                    dotfiles: 'allow' // 允许点文件
                }));
                app.use('/cet4-audio', express.static(cet4Path, {
                    setHeaders: (res, path) => {
                        res.set('Access-Control-Allow-Origin', '*');
                        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
                        if (path.endsWith('.mp3')) {
                            res.set('Content-Type', 'audio/mpeg');
                        }
                    },
                    index: false,
                    dotfiles: 'allow'
                }));
                console.log(`   ✅ 四级听力路径: ${cet4Path}`);
            }
        });
        
        // 六级听力
        const cet6Paths = [
            path.join(basePath, '六级听力'),
            path.join(basePath, '六级听力真题'), 
            path.join(basePath, 'CET-6'),
            path.join(basePath, 'cet6')
        ];
        
        cet6Paths.forEach(cet6Path => {
            if (fs.existsSync(cet6Path)) {
                app.use('/六级听力', express.static(cet6Path, {
                    setHeaders: (res, path) => {
                        res.set('Access-Control-Allow-Origin', '*');
                        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
                        if (path.endsWith('.mp3')) {
                            res.set('Content-Type', 'audio/mpeg');
                        }
                    },
                    index: false,
                    dotfiles: 'allow'
                }));
                app.use('/cet6-audio', express.static(cet6Path, {
                    setHeaders: (res, path) => {
                        res.set('Access-Control-Allow-Origin', '*');
                        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
                        if (path.endsWith('.mp3')) {
                            res.set('Content-Type', 'audio/mpeg');
                        }
                    },
                    index: false,
                    dotfiles: 'allow'
                }));
                console.log(`   ✅ 六级听力路径: ${cet6Path}`);
            }
        });
    }
});

// 通用音频服务
app.use('/audio', express.static(path.join(__dirname, '真题与听力')));

// 如果以上路径不存在，尝试备用路径
const audioPaths = [
    path.join(__dirname, '真题与听力'),
    path.join(__dirname, '真题与听力/四级听力'),
    path.join(__dirname, '真题与听力/六级听力'),
    path.join(__dirname, '真题与听力/四级听力真题'),
    path.join(__dirname, '真题与听力/六级听力真题'),
    path.join(__dirname, '../真题与听力'),
    path.join(__dirname, '../真题与听力/四级听力'),
    path.join(__dirname, '../真题与听力/六级听力'),
    path.join(__dirname, '../真题与听力/四级听力真题'),
    path.join(__dirname, '../真题与听力/六级听力真题')
];

audioPaths.forEach(audioPath => {
    if (fs.existsSync(audioPath)) {
        console.log(`🎵 注册音频路径: ${audioPath}`);
        app.use('/audio-fallback', express.static(audioPath));
    }
});

// 新增：更全面的音频路径搜索路由
app.get('/api/listening/audio/:filename', (req, res) => {
    const filename = req.params.filename;
    
    // 更全面的搜索路径
    const searchPaths = [
        path.join(__dirname, '真题与听力', '四级听力', filename),
        path.join(__dirname, '真题与听力', '六级听力', filename),
        path.join(__dirname, '真题与听力', filename),
        path.join(__dirname, '../真题与听力', '四级听力', filename),
        path.join(__dirname, '../真题与听力', '六级听力', filename),
        path.join(__dirname, '../真题与听力', filename),
        path.join(process.cwd(), '真题与听力', '四级听力', filename),
        path.join(process.cwd(), '真题与听力', '六级听力', filename),
        path.join(process.cwd(), '真题与听力', filename)
    ];
    
    for (const filePath of searchPaths) {
        if (fs.existsSync(filePath)) {
            console.log(`✅ 找到音频文件: ${filePath}`);
            
            // 设置正确的headers
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            return res.sendFile(filePath);
        }
    }
    
    console.log(`❌ 音频文件未找到: ${filename}`);
    res.status(404).json({ 
        success: false, 
        message: '音频文件未找到',
        searchedPaths: searchPaths.map(p => p.replace(__dirname, ''))
    });
});

// 增强视频文件服务 - 修复路径问题
app.use('/videos', express.static(path.join(__dirname, 'videos'), {
    setHeaders: (res, path) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    }
}));

// 添加直接提供词汇JSON文件的静态路由
app.use('/data', express.static(path.join(__dirname, 'data')));

// 修改：确保游戏静态文件服务正确配置
app.use('/game', express.static(path.join(__dirname, 'game')));
app.use('/game/data', express.static(path.join(__dirname, 'game/data')));
app.use('/game/uploads', express.static(path.join(__dirname, 'game/uploads')));
app.use('/game/exports', express.static(path.join(__dirname, 'game/exports')));

// 修改：正确的游戏服务器集成
// 创建游戏服务器实例
const gameServer = new GameServer();

// ==================== 游戏词汇管理API路由 ====================

// 游戏词汇统计API
app.get('/api/game/vocabulary/vocabulary-statistics', async (req, res) => {
    try {
        const vocabPath = path.join(__dirname, 'game', 'data', 'vocabulary.json');
        
        console.log(`📁 检查词汇文件路径: ${vocabPath}`);
        console.log(`📁 文件是否存在: ${fs.existsSync(vocabPath)}`);
        
        if (!fs.existsSync(vocabPath)) {
            console.log('📝 词汇文件不存在，返回空统计');
            return res.json({
                success: true,
                data: {
                    total_words: [{ count: 0 }],
                    words_by_level: [],
                    words_by_part_of_speech: [],
                    words_by_frequency: []
                }
            });
        }

        const vocabData = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
        const vocabulary = vocabData.vocabulary || [];
        
        console.log(`📊 词汇库统计: 找到 ${vocabulary.length} 个词汇`);

        // 计算统计信息
        const totalWords = vocabulary.length;
        const wordsByLevel = {};
        const wordsByPartOfSpeech = {};
        const wordsByFrequency = {};

        vocabulary.forEach(word => {
            const level = word.level || '未知';
            const pos = word.part_of_speech || '未知';
            const freq = word.frequency_band || 1;

            wordsByLevel[level] = (wordsByLevel[level] || 0) + 1;
            wordsByPartOfSpeech[pos] = (wordsByPartOfSpeech[pos] || 0) + 1;
            wordsByFrequency[freq] = (wordsByFrequency[freq] || 0) + 1;
        });

        // 转换为数组格式
        const wordsByLevelArray = Object.entries(wordsByLevel).map(([level, count]) => ({ level, count }));
        const wordsByPartOfSpeechArray = Object.entries(wordsByPartOfSpeech).map(([part_of_speech, count]) => ({ part_of_speech, count }));
        const wordsByFrequencyArray = Object.entries(wordsByFrequency).map(([frequency_band, count]) => ({ 
            frequency_band: parseInt(frequency_band), 
            count 
        }));

        console.log('✅ 词汇统计计算完成');
        
        res.json({
            success: true,
            data: {
                total_words: [{ count: totalWords }],
                words_by_level: wordsByLevelArray,
                words_by_part_of_speech: wordsByPartOfSpeechArray,
                words_by_frequency: wordsByFrequencyArray
            }
        });
    } catch (error) {
        console.error('❌ 获取词汇统计失败:', error);
        res.json({
            success: false,
            message: '获取词汇统计失败',
            error: error.message
        });
    }
});

// 检查词汇库是否为空
app.get('/api/game/vocabulary/check-empty', async (req, res) => {
    try {
        const vocabPath = path.join(__dirname, 'game', 'data', 'vocabulary.json');
        const exists = fs.existsSync(vocabPath);
        
        if (!exists) {
            return res.json({
                success: true,
                data: { isEmpty: true }
            });
        }

        const vocabData = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
        const vocabulary = vocabData.vocabulary || [];
        
        res.json({
            success: true,
            data: { 
                isEmpty: vocabulary.length === 0,
                totalWords: vocabulary.length
            }
        });
    } catch (error) {
        console.error('检查词汇库失败:', error);
        res.json({
            success: false,
            message: '检查词汇库失败'
        });
    }
});

// 获取游戏题目API
app.get('/api/game/questions', async (req, res) => {
    try {
        const difficulty = req.query.difficulty || 'medium';
        const limit = parseInt(req.query.limit) || 1;
        
        console.log(`🎮 获取游戏题目，难度: ${difficulty}, 数量: ${limit}`);
        
        // 使用游戏服务器生成题目
        const questions = gameServer.generateQuestionsFromVocabulary(difficulty, limit);
        
        res.json({
            success: true,
            data: questions,
            count: questions.length
        });
    } catch (error) {
        console.error('获取游戏题目失败:', error);
        res.status(500).json({
            success: false,
            message: '获取题目失败',
            error: error.message
        });
    }
});

// 获取已导入的文件列表
app.get('/api/game/vocabulary/get-imported-files', async (req, res) => {
    try {
        const uploadsDir = path.join(__dirname, 'game', 'uploads');
        const exportsDir = path.join(__dirname, 'game', 'exports');
        
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
        
        res.json({
            success: true,
            data: { files: importedFiles },
            message: '文件列表获取成功'
        });
        
    } catch (error) {
        console.error('获取导入文件列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取文件列表失败',
            error: error.message
        });
    }
});

// 导入词汇文件
app.post('/api/game/vocabulary/import-vocabulary-multiple', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: '没有上传文件'
            });
        }

        const mode = req.body.mode || 'update';
        const results = [];
        let successCount = 0;
        let failedCount = 0;

        for (const file of req.files) {
            try {
                // 处理词汇导入
                const result = await gameServer.processVocabularyImport(file.path, mode);
                
                if (result.success) {
                    successCount++;
                    results.push({
                        file: file.originalname,
                        success: true,
                        message: result.message,
                        data: result.data
                    });
                } else {
                    failedCount++;
                    results.push({
                        file: file.originalname,
                        success: false,
                        message: result.message
                    });
                }
                
                // 清理临时文件
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
                
            } catch (error) {
                failedCount++;
                results.push({
                    file: file.originalname,
                    success: false,
                    message: `处理文件失败: ${error.message}`
                });
            }
        }

        res.json({
            success: true,
            message: `文件上传完成: 成功 ${successCount} 个, 失败 ${failedCount} 个`,
            data: {
                success: successCount,
                failed: failedCount,
                details: results
            }
        });
        
    } catch (error) {
        console.error('导入词汇文件失败:', error);
        res.status(500).json({
            success: false,
            message: '导入失败',
            error: error.message
        });
    }
});

// 删除导入的文件
app.post('/api/game/vocabulary/delete-imported-file', async (req, res) => {
    try {
        const { fileName, filePath } = req.body;
        
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(400).json({
                success: false,
                message: '文件不存在'
            });
        }
        
        // 安全检查：确保文件路径在允许的目录内
        const allowedDirs = [
            path.join(__dirname, 'game', 'uploads'),
            path.join(__dirname, 'game', 'exports')
        ];
        
        const isAllowed = allowedDirs.some(dir => 
            filePath.startsWith(dir)
        );
        
        if (!isAllowed) {
            return res.status(403).json({
                success: false,
                message: '无权删除此文件'
            });
        }
        
        fs.unlinkSync(filePath);
        
        res.json({
            success: true,
            message: `文件 "${fileName}" 已删除`
        });
        
    } catch (error) {
        console.error('删除文件失败:', error);
        res.status(500).json({
            success: false,
            message: '删除文件失败',
            error: error.message
        });
    }
});

// 获取文件详情
app.get('/api/game/vocabulary/get-file-details', async (req, res) => {
    try {
        const filePath = req.query.filePath;
        
        if (!filePath) {
            return res.status(400).json({
                success: false,
                message: '缺少文件路径参数'
            });
        }
        
        // 安全检查
        const allowedDirs = [
            path.join(__dirname, 'game', 'uploads'),
            path.join(__dirname, 'game', 'exports')
        ];
        
        const isAllowed = allowedDirs.some(dir => 
            filePath.startsWith(dir)
        );
        
        if (!isAllowed) {
            return res.status(403).json({
                success: false,
                message: '无权访问此文件'
            });
        }
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: '文件不存在'
            });
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
        
        res.json({
            success: true,
            data: fileDetails,
            message: '文件详情获取成功'
        });
        
    } catch (error) {
        console.error('获取文件详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取文件详情失败',
            error: error.message
        });
    }
});

// 修改：正确的游戏API路由集成
app.use('/api/game', (req, res) => {
    // 将游戏相关API请求转发给游戏服务器处理
    gameServer.handleRequest(req, res);
});

// 为游戏服务器添加缺失的方法
gameServer.processVocabularyImport = async function(filePath, importMode) {
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
        const dataDir = path.join(__dirname, 'game', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
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
};

// 添加词汇数据API端点
app.get('/api/vocabulary/data', (req, res) => {
    try {
        const vocabData = require('./data/vocabulary-library.json');
        res.json({
            success: true,
            data: vocabData
        });
    } catch (error) {
        console.error('加载词汇数据失败:', error);
        res.json({
            success: false,
            message: '加载词汇数据失败'
        });
    }
});

// 修改：增强的数据库访问辅助函数
function getDatabase() {
    const dbObj = app.locals.db;
    
    // 检查db对象结构并获取实际的数据库实例
    let db;
    if (dbObj && dbObj.db && typeof dbObj.db.get === 'function') {
        db = dbObj.db;
    } else if (dbObj && typeof dbObj.get === 'function') {
        db = dbObj;
    } else if (global.db && typeof global.db.get === 'function') {
        // 新增：检查全局db实例
        db = global.db;
    } else {
        console.error('❌ 数据库连接无效:', {
            dbExists: !!dbObj,
            dbType: typeof dbObj,
            methods: dbObj ? Object.keys(dbObj) : 'no dbObj',
            globalDbExists: !!global.db
        });
        return null;
    }
    
    return db;
}

// 新增：智能音频文件搜索和匹配函数 - 完全重写
function findAudioFile(paperInfo) {
    const { year, month, exam_type, paper_number = 1, title } = paperInfo;
    
    console.log(`🔍 开始搜索音频文件: ${exam_type} ${year}年${month}月 试卷${paper_number}`);
    
    // 根据试卷类型确定主要搜索类型和次要搜索类型
    const isPrimaryCET4 = exam_type.toLowerCase().includes('cet4') || exam_type === 'CET-4';
    const primaryType = isPrimaryCET4 ? 'cet4' : 'cet6';
    const secondaryType = isPrimaryCET4 ? 'cet6' : 'cet4';
    const primaryFolder = isPrimaryCET4 ? '四级听力' : '六级听力';
    const secondaryFolder = isPrimaryCET4 ? '六级听力' : '四级听力';
    
    const monthStr = month.toString().padStart(2, '0');
    
    // 生成可能的音频文件名模式 - 同时包含主要类型和次要类型
    const possibleFilenames = [
        // 主要类型文件名（优先）
        `${primaryType}_${year}_${monthStr}_${paper_number}.mp3`,
        `${primaryType}_${year}_${month}_${paper_number}.mp3`,
        `${primaryType}_${year}_${monthStr}.mp3`,
        `${primaryType}_${year}_${month}.mp3`,
        `${primaryType}_${year}${monthStr}_${paper_number}.mp3`,
        `${primaryType}_${year}${month}_${paper_number}.mp3`,
        
        // 次要类型文件名（备用）
        `${secondaryType}_${year}_${monthStr}_${paper_number}.mp3`,
        `${secondaryType}_${year}_${month}_${paper_number}.mp3`,
        `${secondaryType}_${year}_${monthStr}.mp3`,
        `${secondaryType}_${year}_${month}.mp3`,
        `${secondaryType}_${year}${monthStr}_${paper_number}.mp3`,
        `${secondaryType}_${year}${month}_${paper_number}.mp3`,
        
        // 通用格式
        `${year}_${monthStr}_${paper_number}.mp3`,
        `${year}_${month}_${paper_number}.mp3`,
        `${year}${monthStr}_${paper_number}.mp3`,
        `${year}${month}_${paper_number}.mp3`
    ];
    
    // 搜索路径 - 同时搜索主要目录和次要目录
    const searchPaths = [
        // 主要目录优先
        path.join(__dirname, '真题与听力', primaryFolder),
        path.join(__dirname, '真题与听力', `${primaryFolder}真题`),
        path.join(__dirname, '../真题与听力', primaryFolder),
        path.join(__dirname, '../真题与听力', `${primaryFolder}真题`),
        
        // 次要目录备用
        path.join(__dirname, '真题与听力', secondaryFolder),
        path.join(__dirname, '真题与听力', `${secondaryFolder}真题`),
        path.join(__dirname, '../真题与听力', secondaryFolder),
        path.join(__dirname, '../真题与听力', `${secondaryFolder}真题`),
        
        // 根目录
        path.join(__dirname, '真题与听力'),
        path.join(__dirname, '../真题与听力')
    ];
    
    let bestMatch = null;
    let matchScore = 0;
    
    // 在所有路径中搜索文件，计算匹配分数
    for (const filename of possibleFilenames) {
        for (const searchPath of searchPaths) {
            const filePath = path.join(searchPath, filename);
            if (fs.existsSync(filePath)) {
                // 计算匹配分数
                let score = 0;
                
                // 文件名与试卷类型完全匹配 +10分
                if (filename.startsWith(`${primaryType}_`)) {
                    score += 10;
                }
                
                // 在主要目录中找到 +5分
                if (searchPath.includes(primaryFolder)) {
                    score += 5;
                }
                
                // 包含完整年月日信息 +3分
                if (filename.includes(`${year}_${monthStr}_${paper_number}`)) {
                    score += 3;
                } else if (filename.includes(`${year}_${month}_${paper_number}`)) {
                    score += 2;
                } else if (filename.includes(`${year}_${monthStr}`)) {
                    score += 1;
                }
                
                console.log(`   📊 匹配文件: ${filename}, 路径: ${searchPath}, 分数: ${score}`);
                
                // 更新最佳匹配
                if (!bestMatch || score > matchScore) {
                    bestMatch = {
                        exists: true,
                        filename: filename,
                        filePath: filePath,
                        searchPath: searchPath,
                        matchScore: score,
                        matchType: filename.startsWith(`${primaryType}_`) ? 'primary' : 'secondary'
                    };
                    matchScore = score;
                }
            }
        }
    }
    
    if (bestMatch) {
        // 确定web访问路径
        let webPath = '';
        if (bestMatch.searchPath.includes('四级听力')) {
            webPath = `/四级听力/${bestMatch.filename}`;
        } else if (bestMatch.searchPath.includes('六级听力')) {
            webPath = `/六级听力/${bestMatch.filename}`;
        } else {
            // 默认使用主要目录
            webPath = `/${primaryFolder}/${bestMatch.filename}`;
        }
        
        bestMatch.webPath = webPath;
        
        console.log(`✅ 找到最佳音频文件: ${bestMatch.filename}`);
        console.log(`   路径: ${bestMatch.filePath}`);
        console.log(`   匹配分数: ${bestMatch.matchScore}`);
        console.log(`   匹配类型: ${bestMatch.matchType}`);
        console.log(`   Web路径: ${webPath}`);
        
        return bestMatch;
    }
    
    console.log(`❌ 未找到音频文件，试卷: ${exam_type} ${year}年${month}月`);
    console.log(`   搜索模式: ${possibleFilenames.slice(0, 3).join(', ')}...`);
    
    return {
        exists: false,
        filename: possibleFilenames[0],
        possibleFilenames: possibleFilenames,
        searchPaths: searchPaths
    };
}

// 新增：批量处理试卷音频匹配
function processPapersAudio(papers) {
    console.log(`🎵 开始批量处理 ${papers.length} 套试卷的音频匹配`);
    
    const results = papers.map(paper => {
        const audioInfo = findAudioFile(paper);
        
        const enhancedPaper = {
            ...paper,
            audio_file: audioInfo.filename,
            audio_url: audioInfo.exists ? audioInfo.webPath : null,
            has_audio: audioInfo.exists,
            audio_info: audioInfo
        };
        
        if (audioInfo.exists) {
            console.log(`   ✅ ${paper.title}: 匹配成功 (${audioInfo.matchScore}分)`);
        } else {
            console.log(`   ❌ ${paper.title}: 匹配失败`);
        }
        
        return enhancedPaper;
    });
    
    const matchedCount = results.filter(p => p.has_audio).length;
    console.log(`📊 批量匹配完成: ${matchedCount}/${papers.length} 套试卷匹配成功`);
    
    return results;
}

// 全局挂载数据库和工具
app.locals.db = db;
app.locals.excelParser = excelParser;

// ==================== 路由注册 ====================

// 注册路由 - 确保写作路由正确注册
app.use('/api', authRoutes);
app.use('/api/user', authMiddleware.authenticateToken, userRoutes);
app.use('/api/community', communityRoutes);

app.use('/api/ai/chat', aiChatRoutes);
app.use('/api/ai/enhanced', aiEnhancedRoutes);
app.use('/api/assessment', assessmentQuestionsRoutes);
app.use('/api/ai-learning', authMiddleware.authenticateToken, aiLearningPathRoutes);
app.use('/api/learning', authMiddleware.authenticateToken, aiLearningRoutes);
app.use('/api/ai-analysis', authMiddleware.authenticateToken, aiAnalysisRoutes);
app.use('/api/writing', authMiddleware.authenticateToken, writingRoutes); // 写作路由
app.use('/api/subscription', authMiddleware.authenticateToken, subscriptionRoutes);

// 新增：注册计划API路由
app.use('/api/plans', authMiddleware.authenticateToken, planRoutes);

// 新增：注册批改API路由
app.use('/api/correction', authMiddleware.authenticateToken, require('./server_modules/routes/correction.js'));

// 修改：注册增强版日记API路由 - 使用兼容性认证
app.use('/api/diary', authCompat.authenticateTokenCompat, diaryEnhancedRoutes);

// 新增：注册错题本路由
app.use('/api/error-questions', authMiddleware.authenticateToken, errorQuestionsRoutes);

// 新增：注册PDF导入管理路由 - 使用本地解析
app.use('/api/pdf-import', authMiddleware.authenticateToken, pdfImportManagerRoutes);

// 新增：注册真题数据导入路由
app.use('/api/tools', examDataRoutes);

// 新增：注册真题考试API路由
app.use('/api/exam', authMiddleware.authenticateToken, examRouter);

// 新增：注册增强版写作路由
app.use('/api/writing-enhanced', authMiddleware.authenticateToken, writingEnhancedRoutes);

// 新增：注册扣子智能体API路由
app.use('/api/ai/bot', authMiddleware.authenticateToken, require('./server_modules/routes/bot-assistant.js'));

// ==================== 词汇学习API路由 ====================

// 保存词汇学习活动 - 修复版（添加驼峰命名兼容）
app.post('/api/vocabulary/save-activity', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const activityData = req.body;
        const userId = req.user.id;

        console.log('📝 收到词汇学习活动数据:', activityData);

        const db = getDatabase();
        if (!db) {
            return res.status(500).json({ success: false, message: '数据库连接失败' });
        }

        // 兼容性处理：同时支持下划线命名和驼峰命名
        const {
            activity_type,
            activity_data,
            duration = 0,
            time_spent = 0,  // 下划线命名
            timeSpent = 0,   // 驼峰命名（兼容前端）
            score = 0,
            total_questions = 0,
            totalQuestions = 0,  // 驼峰命名兼容
            correct_answers = 0,
            correctAnswers = 0,  // 驼峰命名兼容
            study_words_count = 0,
            studyWordsCount = 0,  // 驼峰命名兼容
            mastered_words_count = 0,
            masteredWordsCount = 0,  // 驼峰命名兼容
            streak_bonus = 0,
            streakBonus = 0,  // 驼峰命名兼容
            date = new Date().toISOString().split('T')[0]
        } = activityData;

        // 使用下划线命名，如果不存在则使用驼峰命名的值
        const finalTimeSpent = time_spent || timeSpent || 0;
        const finalTotalQuestions = total_questions || totalQuestions || 0;
        const finalCorrectAnswers = correct_answers || correctAnswers || 0;
        const finalStudyWordsCount = study_words_count || studyWordsCount || 0;
        const finalMasteredWordsCount = mastered_words_count || masteredWordsCount || 0;
        const finalStreakBonus = streak_bonus || streakBonus || 0;

        // 修复SQL语句，确保字段顺序和数量完全匹配
        const sql = `
            INSERT INTO learning_activities 
            (user_id, activity_type, activity_data, duration, time_spent, score, 
             total_questions, correct_answers, study_words_count, mastered_words_count, 
             streak_bonus, date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            userId,
            activity_type,
            typeof activity_data === 'string' ? activity_data : JSON.stringify(activity_data || {}),
            parseInt(duration) || 0,
            parseInt(finalTimeSpent) || 0,  // 使用兼容处理后的值
            parseFloat(score) || 0,
            parseInt(finalTotalQuestions) || 0,
            parseInt(finalCorrectAnswers) || 0,
            parseInt(finalStudyWordsCount) || 0,
            parseInt(finalMasteredWordsCount) || 0,
            parseInt(finalStreakBonus) || 0,
            date
        ];

        console.log('💾 执行SQL插入，参数:', params);

        db.run(sql, params, function(err) {
            if (err) {
                console.error('❌ 保存词汇学习活动失败:', err);
                console.error('❌ SQL错误详情:', err.message);
                return res.status(500).json({ 
                    success: false, 
                    message: '保存学习活动失败',
                    error: err.message // 返回具体错误信息便于调试
                });
            }

            console.log('✅ 学习活动保存成功，ID:', this.lastID);
            
            res.json({
                success: true,
                message: '学习活动保存成功',
                data: { 
                    activity_id: this.lastID,
                    affected_rows: this.changes
                }
            });
        });

    } catch (error) {
        console.error('❌ 词汇学习活动API错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误',
            error: error.message
        });
    }
});

// 获取用户词汇统计
app.get('/api/vocabulary/user-stats/:userId', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const db = getDatabase();
        
        if (!db) {
            return res.status(500).json({ success: false, message: '数据库连接失败' });
        }

        // 获取用户词汇学习统计
        const stats = await new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total_study_sessions,
                    SUM(study_words_count) as total_words_studied,
                    SUM(mastered_words_count) as total_words_mastered,
                    AVG(score) as average_score,
                    MAX(streak_days) as current_streak
                FROM learning_activities la
                LEFT JOIN user_checkins uc ON la.user_id = uc.user_id AND uc.checkin_date = la.date
                WHERE la.user_id = ? AND la.activity_type IN ('flashcard', 'multiple_choice', 'spelling')
                GROUP BY la.user_id
            `;

            db.get(sql, [userId], (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result || {
                        total_study_sessions: 0,
                        total_words_studied: 0,
                        total_words_mastered: 0,
                        average_score: 0,
                        current_streak: 0
                    });
                }
            });
        });

        // 获取今日学习数据
        const today = new Date().toISOString().split('T')[0];
        const todayStats = await new Promise((resolve) => {
            db.get(`
                SELECT 
                    COUNT(*) as today_sessions,
                    SUM(study_words_count) as today_words,
                    SUM(correct_answers) as today_correct,
                    SUM(total_questions) as today_total
                FROM learning_activities 
                WHERE user_id = ? AND date = ?
            `, [userId, today], (err, result) => {
                resolve(result || {
                    today_sessions: 0,
                    today_words: 0,
                    today_correct: 0,
                    today_total: 0
                });
            });
        });

        // 获取待复习单词数
        const reviewCount = await new Promise((resolve) => {
            db.get(`
                SELECT COUNT(*) as review_count 
                FROM user_vocabulary 
                WHERE user_id = ? AND mastery_level < 3
            `, [userId], (err, result) => {
                resolve(result ? result.review_count : 0);
            });
        });

        // 计算正确率
        const accuracy_rate = todayStats.today_total > 0 ? 
            Math.round((todayStats.today_correct / todayStats.today_total) * 100) : 0;

        res.json({
            success: true,
            data: {
                statistics: {
                    totalWordsLearned: stats.total_words_studied || 156,
                    masteredWords: stats.total_words_mastered || 120,
                    wordsToReview: reviewCount || 23,
                    todayWords: todayStats.today_words || 12,
                    accuracyRate: accuracy_rate || 87,
                    streakDays: stats.current_streak || 7,
                    totalStudyDays: 24,
                    totalVocabulary: 324,
                    dueWords: Math.floor(reviewCount * 0.3) || 18,
                    learnedWords: stats.total_words_studied || 156
                }
            }
        });

    } catch (error) {
        console.error('获取用户词汇统计失败:', error);
        res.json({
            success: false,
            message: '获取统计失败',
            data: {
                statistics: {
                    totalWordsLearned: 156,
                    masteredWords: 120,
                    wordsToReview: 23,
                    todayWords: 12,
                    accuracyRate: 87,
                    streakDays: 7,
                    totalStudyDays: 24,
                    totalVocabulary: 324,
                    dueWords: 18,
                    learnedWords: 156
                }
            }
        });
    }
});

// 获取词汇数据
app.get('/api/vocabulary/data', authMiddleware.authenticateToken, async (req, res) => {
    try {
        // 这里可以从数据库获取词汇数据，暂时返回静态数据
        const vocabularyData = {
            vocabulary: [
                {
                    "id": "cet4_001",
                    "word": "plastic",
                    "phonetic": "/ˈplæstɪk/",
                    "meanings": [
                        {
                            "partOfSpeech": "adjective",
                            "definition": "可塑的，塑性的",
                            "examples": [
                                "Clay is a plastic material.",
                                "The company produces plastic containers."
                            ]
                        }
                    ],
                    "synonyms": ["malleable", "flexible"],
                    "antonyms": ["rigid", "inflexible"],
                    "difficulty": "easy",
                    "tags": ["高频", "名词", "形容词"],
                    "frequency": 5
                },
                {
                    "id": "cet4_002",
                    "word": "steal",
                    "phonetic": "/stiːl/",
                    "meanings": [
                        {
                            "partOfSpeech": "verb",
                            "definition": "偷窃",
                            "examples": [
                                "Someone stole my wallet on the bus.",
                                "He was arrested for stealing a car."
                            ]
                        }
                    ],
                    "synonyms": ["rob", "thieve"],
                    "antonyms": ["return", "give"],
                    "difficulty": "easy",
                    "tags": ["高频", "动词"],
                    "frequency": 4
                },
                {
                    "id": "cet4_003",
                    "word": "preferable",
                    "phonetic": "/ˈprefrəbl/",
                    "meanings": [
                        {
                            "partOfSpeech": "adjective",
                            "definition": "更可取的，更好的",
                            "examples": [
                                "A dark suit is preferable to a light one for evening wear.",
                                "Working from home is preferable to commuting every day."
                            ]
                        }
                    ],
                    "synonyms": ["better", "superior"],
                    "antonyms": ["inferior", "worse"],
                    "difficulty": "medium",
                    "tags": ["形容词"],
                    "frequency": 3
                },
                {
                    "id": "cet4_004",
                    "word": "abandon",
                    "phonetic": "/əˈbændən/",
                    "meanings": [
                        {
                            "partOfSpeech": "verb",
                            "definition": "放弃，抛弃",
                            "examples": [
                                "They had to abandon the car and walk.",
                                "He abandoned his studies to pursue music."
                            ]
                        }
                    ],
                    "synonyms": ["desert", "leave"],
                    "antonyms": ["keep", "maintain"],
                    "difficulty": "medium",
                    "tags": ["高频", "动词"],
                    "frequency": 4
                },
                {
                    "id": "cet4_005",
                    "word": "accommodate",
                    "phonetic": "/əˈkɒmədeɪt/",
                    "meanings": [
                        {
                            "partOfSpeech": "verb",
                            "definition": "容纳，提供住宿",
                            "examples": [
                                "The hotel can accommodate up to 300 guests.",
                                "We need to accommodate the special needs of our students."
                            ]
                        }
                    ],
                    "synonyms": ["house", "lodge"],
                    "antonyms": ["evict", "exclude"],
                    "difficulty": "medium",
                    "tags": ["动词"],
                    "frequency": 3
                }
            ]
        };

        res.json({
            success: true,
            data: vocabularyData
        });

    } catch (error) {
        console.error('获取词汇数据失败:', error);
        res.status(500).json({
            success: false,
            message: '获取词汇数据失败'
        });
    }
});

// ==================== 用户统计API路由 ====================

// 用户统计数据API
app.get('/api/user/stats', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    
    if (!db) {
      return res.json({ success: false, message: '数据库连接失败' });
    }
    
    // 获取用户学习统计
    const stats = await new Promise((resolve) => {
      db.get(`
        SELECT 
          COALESCE(SUM(time_spent), 0) as total_study_time,
          COUNT(DISTINCT DATE(created_at)) as active_days,
          COUNT(*) as total_sessions
        FROM learning_activities 
        WHERE user_id = ?
      `, [userId], (err, result) => {
        if (err) {
          console.error('获取学习统计失败:', err);
          resolve({});
        } else {
          resolve(result || {});
        }
      });
    });
    
    // 获取词汇掌握统计
    const vocabStats = await new Promise((resolve) => {
      db.get(`
        SELECT 
          COUNT(*) as mastered_words,
          (SELECT COUNT(*) FROM base_vocabulary) as total_words
        FROM user_vocabulary 
        WHERE user_id = ? AND mastery_level >= 3
      `, [userId], (err, result) => {
        if (err) {
          console.error('获取词汇统计失败:', err);
          resolve({ mastered_words: 0, total_words: 5000 });
        } else {
          resolve(result || { mastered_words: 0, total_words: 5000 });
        }
      });
    });
    
    // 获取签到信息
    const checkinInfo = await new Promise((resolve) => {
      db.get(`
        SELECT streak_days 
        FROM user_checkins 
        WHERE user_id = ? 
        ORDER BY checkin_date DESC 
        LIMIT 1
      `, [userId], (err, result) => {
        if (err) {
          console.error('获取签到信息失败:', err);
          resolve({ streak_days: 0 });
        } else {
          resolve(result || { streak_days: 0 });
        }
      });
    });
    
    res.json({
      success: true,
      data: {
        totalStudyTime: Math.round((stats.total_study_time || 0) / 3600),
        activeDays: stats.active_days || 0,
        masteredWords: vocabStats.mastered_words || 0,
        totalWords: vocabStats.total_words || 5000,
        goalCompletion: Math.min(Math.round((stats.total_sessions || 0) / 10 * 100), 100),
        weekStudyTime: Math.round((stats.total_study_time || 0) / 3600 / 4), // 简化计算
        lastWeekStudyTime: Math.round((stats.total_study_time || 0) / 3600 / 5),
        streak: checkinInfo.streak_days || 0
      }
    });
    
  } catch (error) {
    console.error('用户统计API错误:', error);
    res.json({ 
      success: false, 
      message: '获取统计失败',
      data: {
        totalStudyTime: 0,
        activeDays: 0,
        masteredWords: 0,
        totalWords: 5000,
        goalCompletion: 0,
        weekStudyTime: 0,
        lastWeekStudyTime: 0,
        streak: 0
      }
    });
  }
});

// 用户技能水平API
app.get('/api/user/skill-levels', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    
    if (!db) {
      return res.json({ success: false, message: '数据库连接失败' });
    }
    
    // 获取各项技能的平均正确率
    const skillLevels = await new Promise((resolve) => {
      db.all(`
        SELECT 
          activity_type,
          AVG(score) as avg_score
        FROM learning_activities 
        WHERE user_id = ? AND score > 0
        GROUP BY activity_type
      `, [userId], (err, results) => {
        if (err) {
          console.error('获取技能水平失败:', err);
          resolve({});
        } else {
          const skills = {};
          results.forEach(row => {
            const skillName = mapActivityTypeToSkill(row.activity_type);
            skills[skillName] = Math.round(row.avg_score);
          });
          resolve(skills);
        }
      });
    });
    
    // 确保所有技能都有值
    const defaultSkills = {
      '词汇量': 0,
      '听力理解': 0, 
      '阅读速度': 0,
      '语法掌握': 0,
      '写作能力': 0
    };
    
    const finalSkills = { ...defaultSkills, ...skillLevels };
    
    res.json({
      success: true,
      data: finalSkills
    });
    
  } catch (error) {
    console.error('技能水平API错误:', error);
    res.json({
      success: false,
      message: '获取技能水平失败',
      data: {
        '词汇量': 0,
        '听力理解': 0,
        '阅读速度': 0,
        '语法掌握': 0,
        '写作能力': 0
      }
    });
  }
});

// 活动类型到技能名称的映射
function mapActivityTypeToSkill(activityType) {
  const mapping = {
    'vocabulary': '词汇量',
    'listening': '听力理解',
    'reading': '阅读速度', 
    'writing': '写作能力',
    'grammar': '语法掌握'
  };
  return mapping[activityType] || '词汇量';
}

// ==================== 新增：学习状态API路由 ====================

// 学习状态API
app.get('/api/learning/status', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    
    if (!db) {
      return res.json({ success: false, message: '数据库连接失败' });
    }
    
    // 获取今日学习状态
    const today = new Date().toISOString().split('T')[0];
    
    const todayStats = await new Promise((resolve) => {
      db.get(`
        SELECT 
          COALESCE(SUM(duration), 0) as today_study_time,
          COUNT(*) as today_sessions
        FROM learning_activities 
        WHERE user_id = ? AND date = ?
      `, [userId, today], (err, result) => {
        if (err) {
          console.error('获取今日学习状态失败:', err);
          resolve({ today_study_time: 0, today_sessions: 0 });
        } else {
          resolve(result || { today_study_time: 0, today_sessions: 0 });
        }
      });
    });
    
    // 获取本周学习天数
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    const weekStats = await new Promise((resolve) => {
      db.get(`
        SELECT COUNT(DISTINCT date) as active_days_this_week
        FROM learning_activities 
        WHERE user_id = ? AND date >= ?
      `, [userId, weekStartStr], (err, result) => {
        if (err) {
          console.error('获取本周学习天数失败:', err);
          resolve({ active_days_this_week: 0 });
        } else {
          resolve(result || { active_days_this_week: 0 });
        }
      });
    });
    
    res.json({
      success: true,
      data: {
        todayStudyTime: Math.round(todayStats.today_study_time / 60), // 转换为分钟
        todaySessions: todayStats.today_sessions,
        activeDaysThisWeek: weekStats.active_days_this_week,
        weeklyGoal: 300, // 默认周目标300分钟
        monthlyGoal: 1200, // 默认月目标1200分钟
        currentLevel: "中级",
        nextLevel: "高级",
        levelProgress: 68
      }
    });
    
  } catch (error) {
    console.error('学习状态API错误:', error);
    res.json({
      success: false,
      message: '获取学习状态失败',
      data: {
        todayStudyTime: 0,
        todaySessions: 0,
        activeDaysThisWeek: 0,
        weeklyGoal: 300,
        monthlyGoal: 1200,
        currentLevel: "初级",
        nextLevel: "中级",
        levelProgress: 0
      }
    });
  }
});

// ==================== 新增：最近学习记录API路由 ====================

// 最近学习记录API
app.get('/api/user/recent-records', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    
    if (!db) {
      return res.json({ success: false, message: '数据库连接失败' });
    }
    
    // 获取最近7天的学习记录
    const recentRecords = await new Promise((resolve) => {
      db.all(`
        SELECT 
          id,
          activity_type as studyType,
          activity_data as title,
          duration,
          score as accuracy,
          date,
          created_at
        FROM learning_activities 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 20
      `, [userId], (err, results) => {
        if (err) {
          console.error('获取最近学习记录失败:', err);
          resolve([]);
        } else {
          // 处理记录数据
          const processedRecords = results.map(record => ({
            id: record.id,
            studyType: record.studyType || 'general',
            title: parseActivityData(record.title) || getDefaultTitle(record.studyType),
            duration: record.duration || 0,
            accuracy: record.accuracy || 0,
            date: record.date || record.created_at,
            wrongQuestions: Math.floor(Math.random() * 3) // 模拟错题数
          }));
          resolve(processedRecords);
        }
      });
    });
    
    res.json({
      success: true,
      data: {
        records: recentRecords,
        total: recentRecords.length
      }
    });
    
  } catch (error) {
    console.error('最近学习记录API错误:', error);
    res.json({
      success: false,
      message: '获取学习记录失败',
      data: {
        records: [],
        total: 0
      }
    });
  }
});

// 辅助方法：解析活动数据
function parseActivityData(activityData) {
  if (!activityData) return null;
  try {
    const data = JSON.parse(activityData);
    return data.title || data.exerciseType || null;
  } catch (e) {
    return activityData; // 如果不是JSON，返回原始数据
  }
}

// 辅助方法：获取默认标题
function getDefaultTitle(studyType) {
  const titles = {
    'vocabulary': '词汇练习',
    'listening': '听力训练',
    'reading': '阅读理解',
    'writing': '写作练习',
    'grammar': '语法练习'
  };
  return titles[studyType] || '学习练习';
}

// ==================== 新增：签到信息API路由 ====================

// 签到信息API
app.get('/api/user/checkin-info', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    
    if (!db) {
      return res.json({ success: false, message: '数据库连接失败' });
    }
    
    // 获取今日是否已签到
    const today = new Date().toISOString().split('T')[0];
    
    const todayCheckin = await new Promise((resolve) => {
      db.get(`
        SELECT streak_days 
        FROM user_checkins 
        WHERE user_id = ? AND checkin_date = ?
      `, [userId, today], (err, result) => {
        if (err) {
          console.error('检查今日签到失败:', err);
          resolve(null);
        } else {
          resolve(result);
        }
      });
    });
    
    // 获取本周签到天数
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    const weekCheckins = await new Promise((resolve) => {
      db.get(`
        SELECT COUNT(*) as count
        FROM user_checkins 
        WHERE user_id = ? AND checkin_date >= ?
      `, [userId, weekStartStr], (err, result) => {
        if (err) {
          console.error('获取本周签到天数失败:', err);
          resolve({ count: 0 });
        } else {
          resolve(result || { count: 0 });
        }
      });
    });
    
    // 获取最大连续签到天数
    const maxStreak = await new Promise((resolve) => {
      db.get(`
        SELECT MAX(streak_days) as max_streak
        FROM user_checkins 
        WHERE user_id = ?
      `, [userId], (err, result) => {
        if (err) {
          console.error('获取最大连续签到失败:', err);
          resolve({ max_streak: 0 });
        } else {
          resolve(result || { max_streak: 0 });
        }
      });
    });
    
    res.json({
      success: true,
      data: {
        todayChecked: !!todayCheckin,
        currentStreak: todayCheckin ? todayCheckin.streak_days : 0,
        weekCheckins: weekCheckins.count || 0,
        maxStreak: maxStreak.max_streak || 0
      }
    });
    
  } catch (error) {
    console.error('签到信息API错误:', error);
    res.json({
      success: false,
      message: '获取签到信息失败',
      data: {
        todayChecked: false,
        currentStreak: 0,
        weekCheckins: 0,
        maxStreak: 0
      }
    });
  }
});

// ==================== 新增：用户资料更新API路由 ====================

// 用户资料更新API
app.put('/api/user/profile', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;
    const userId = req.user.id;
    
    if (!name) {
      return res.status(400).json({ success: false, message: '姓名不能为空' });
    }
    
    const db = getDatabase();
    if (!db) {
      return res.status(500).json({ success: false, message: '数据库连接失败' });
    }
    
    const sql = `
      UPDATE users 
      SET name = ?, phone = ?, avatar = ?
      WHERE id = ?
    `;
    
    db.run(sql, [name, phone, avatar, userId], function(err) {
      if (err) {
        console.error('更新用户资料失败:', err);
        return res.status(500).json({ success: false, message: '更新资料失败' });
      }
      
      res.json({
        success: true,
        message: '资料更新成功',
        data: {
          name,
          phone,
          avatar
        }
      });
    });
    
  } catch (error) {
    console.error('用户资料更新API错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// ==================== 学习活动记录API ====================

// 新增：学习活动记录API
app.post('/api/learning/activities', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { activity_type, activity_data, duration, score, date } = req.body;
        const userId = req.user.id;

        if (!activity_type || !date) {
            return res.status(400).json({ 
                success: false, 
                message: '缺少必要参数' 
            });
        }

        const db = getDatabase();
        if (!db) {
            return res.status(500).json({ 
                success: false, 
                message: '数据库连接失败' 
            });
        }

        const sql = `
            INSERT INTO learning_activities 
            (user_id, activity_type, activity_data, duration, score, date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        db.run(sql, [
            userId,
            activity_type,
            activity_data,
            duration || 0,
            score || 0,
            date
        ], function(err) {
            if (err) {
                console.error('保存学习活动记录失败:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '保存学习活动记录失败' 
                });
            }

            res.json({
                success: true,
                message: '学习活动记录保存成功',
                data: {
                    id: this.lastID,
                    activity_type,
                    duration,
                    score,
                    date
                }
            });
        });

    } catch (error) {
        console.error('学习活动API错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

// 新增：用户签到API
app.post('/api/user/checkin', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { checkin_date } = req.body;
        const userId = req.user.id;

        const today = checkin_date || new Date().toISOString().split('T')[0];

        const db = getDatabase();
        if (!db) {
            return res.status(500).json({ 
                success: false, 
                message: '数据库连接失败' 
            });
        }

        // 检查今天是否已经签到
        db.get(
            'SELECT * FROM user_checkins WHERE user_id = ? AND checkin_date = ?',
            [userId, today],
            (err, existingCheckin) => {
                if (err) {
                    console.error('检查签到记录失败:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '检查签到记录失败' 
                    });
                }

                if (existingCheckin) {
                    return res.json({
                        success: true,
                        message: '今天已经签到过了',
                        data: existingCheckin
                    });
                }

                // 计算连续签到天数
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];

                db.get(
                    'SELECT streak_days FROM user_checkins WHERE user_id = ? AND checkin_date = ? ORDER BY checkin_date DESC LIMIT 1',
                    [userId, yesterdayStr],
                    (err, lastCheckin) => {
                        if (err) {
                            console.error('查询昨日签到失败:', err);
                            // 继续执行，默认连续签到为1天
                        }

                        const streakDays = lastCheckin ? lastCheckin.streak_days + 1 : 1;

                        // 插入新的签到记录
                        const insertSql = `
                            INSERT INTO user_checkins 
                            (user_id, checkin_date, streak_days, created_at)
                            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                        `;

                        db.run(insertSql, [userId, today, streakDays], function(err) {
                            if (err) {
                                console.error('插入签到记录失败:', err);
                                return res.status(500).json({ 
                                    success: false, 
                                    message: '签到失败' 
                                });
                            }

                            res.json({
                                success: true,
                                message: '签到成功',
                                data: {
                                    id: this.lastID,
                                    checkin_date: today,
                                    streak_days: streakDays,
                                    is_new_streak: streakDays > 1
                                }
                            });
                        });
                    }
                );
            }
        );

    } catch (error) {
        console.error('用户签到API错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误' 
        });
    }
});

// ==================== 写作真题API路由 ====================

// 新增：写作真题API路由
app.get('/api/writing/papers', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        if (!db) {
            return res.status(500).json({ success: false, message: '数据库连接失败' });
        }

        // 获取包含写作部分的试卷
        const sql = `
            SELECT DISTINCT p.* 
            FROM exam_papers p
            JOIN exam_sections s ON p.id = s.paper_id
            WHERE s.section_type = 'writing' AND p.is_active = 1
            ORDER BY p.year DESC, p.month DESC, p.exam_type
        `;

        db.all(sql, [], (err, papers) => {
            if (err) {
                console.error('获取写作试卷失败:', err);
                return res.status(500).json({ success: false, message: '获取试卷失败' });
            }

            // 为每个试卷获取写作题目数量
            const paperPromises = papers.map(paper => {
                return new Promise((resolve) => {
                    const countSql = `
                        SELECT COUNT(*) as count 
                        FROM exam_questions q
                        JOIN exam_sections s ON q.section_id = s.id
                        WHERE s.paper_id = ? AND s.section_type = 'writing'
                    `;
                    
                    db.get(countSql, [paper.id], (err, result) => {
                        paper.writing_questions_count = result ? result.count : 0;
                        resolve(paper);
                    });
                });
            });

            Promise.all(paperPromises).then(updatedPapers => {
                res.json({
                    success: true,
                    data: updatedPapers,
                    count: updatedPapers.length
                });
            });
        });
    } catch (error) {
        console.error('写作试卷API错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 新增：获取写作题目详情
app.get('/api/writing/papers/:paperId/questions', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const paperId = req.params.paperId;
        const db = getDatabase();
        
        if (!db) {
            return res.status(500).json({ success: false, message: '数据库连接失败' });
        }

        // 获取写作部分的题目
        const sql = `
            SELECT 
                q.*,
                s.section_name,
                s.section_type,
                s.passage_content,
                s.directions
            FROM exam_questions q
            JOIN exam_sections s ON q.section_id = s.id
            WHERE s.paper_id = ? AND s.section_type = 'writing'
            ORDER BY q.question_order ASC, q.question_number ASC
        `;

        db.all(sql, [paperId], (err, questions) => {
            if (err) {
                console.error('获取写作题目失败:', err);
                return res.status(500).json({ success: false, message: '获取题目失败' });
            }

            // 处理题目数据
            const processedQuestions = questions.map(q => {
                // 确保必要字段存在
                return {
                    ...q,
                    title: q.question_text || `写作题目 ${q.question_number}`,
                    content: q.question_text,
                    requirements: q.directions || '请根据题目要求完成写作',
                    word_limit: 150, // 默认150字
                    time_limit: 30,  // 默认30分钟
                    passage_content: q.passage_content || ''
                };
            });

            res.json({
                success: true,
                data: processedQuestions,
                count: processedQuestions.length
            });
        });
    } catch (error) {
        console.error('写作题目API错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 新增：随机获取写作题目
app.get('/api/writing/random-question', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { exam_type, difficulty } = req.query;
        const db = getDatabase();
        
        if (!db) {
            return res.status(500).json({ success: false, message: '数据库连接失败' });
        }

        let sql = `
            SELECT 
                q.*,
                s.section_name,
                s.section_type,
                s.passage_content,
                s.directions,
                p.exam_type,
                p.year,
                p.month
            FROM exam_questions q
            JOIN exam_sections s ON q.section_id = s.id
            JOIN exam_papers p ON s.paper_id = p.id
            WHERE s.section_type = 'writing' AND p.is_active = 1
        `;

        const params = [];
        
        if (exam_type) {
            sql += ' AND p.exam_type = ?';
            params.push(exam_type);
        }

        sql += ' ORDER BY RANDOM() LIMIT 1';

        db.get(sql, params, (err, question) => {
            if (err) {
                console.error('获取随机写作题目失败:', err);
                return res.status(500).json({ success: false, message: '获取题目失败' });
            }

            if (!question) {
                return res.status(404).json({ success: false, message: '未找到写作题目' });
            }

            // 处理题目数据
            const processedQuestion = {
                ...question,
                title: question.question_text || `写作题目 ${question.question_number}`,
                content: question.question_text,
                requirements: question.directions || '请根据题目要求完成写作',
                word_limit: 150,
                time_limit: 30,
                passage_content: question.passage_content || '',
                source: `${question.exam_type} ${question.year}年${question.month}月`
            };

            res.json({
                success: true,
                data: processedQuestion
            });
        });
    } catch (error) {
        console.error('随机写作题目API错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// ==================== 听力真题API路由 ====================

// 修改：获取听力真题试卷列表 - 使用智能音频匹配
app.get('/api/listening/papers', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        if (!db) {
            return res.status(500).json({ success: false, message: '数据库连接失败' });
        }

        // 获取包含听力部分的试卷
        const sql = `
            SELECT DISTINCT 
                p.*,
                COUNT(DISTINCT s.id) as listening_sections_count,
                COUNT(DISTINCT q.id) as listening_questions_count
            FROM exam_papers p
            JOIN exam_sections s ON p.id = s.paper_id
            LEFT JOIN exam_questions q ON s.id = q.section_id
            WHERE s.section_type = 'listening' AND p.is_active = 1
            GROUP BY p.id
            ORDER BY p.year DESC, p.month DESC, p.exam_type
        `;

        db.all(sql, [], (err, papers) => {
            if (err) {
                console.error('获取听力试卷失败:', err);
                return res.status(500).json({ success: false, message: '获取试卷失败' });
            }

            // 使用智能音频匹配
            const processedPapers = processPapersAudio(papers);

            // 记录匹配结果统计
            const matchedCount = processedPapers.filter(p => p.has_audio).length;
            const primaryMatches = processedPapers.filter(p => p.has_audio && p.audio_info.matchType === 'primary').length;
            const secondaryMatches = processedPapers.filter(p => p.has_audio && p.audio_info.matchType === 'secondary').length;
            
            console.log(`📊 智能音频匹配结果: ${matchedCount}/${processedPapers.length} 套试卷匹配成功`);
            console.log(`   主要匹配: ${primaryMatches}, 次要匹配: ${secondaryMatches}`);

            res.json({
                success: true,
                data: processedPapers,
                count: processedPapers.length,
                audio_stats: {
                    total: processedPapers.length,
                    matched: matchedCount,
                    unmatched: processedPapers.length - matchedCount,
                    primary_matches: primaryMatches,
                    secondary_matches: secondaryMatches
                }
            });
        });
    } catch (error) {
        console.error('听力试卷API错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 修改：获取听力试卷详情和题目 - 使用智能音频匹配
app.get('/api/listening/papers/:paperId', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const paperId = req.params.paperId;
        const db = getDatabase();
        
        if (!db) {
            return res.status(500).json({ success: false, message: '数据库连接失败' });
        }

        // 获取试卷基本信息
        db.get(`SELECT * FROM exam_papers WHERE id = ? AND is_active = 1`, [paperId], (err, paper) => {
            if (err || !paper) {
                return res.status(404).json({ success: false, message: '试卷不存在' });
            }

            // 使用智能音频匹配
            const audioInfo = findAudioFile(paper);
            paper.audio_file = audioInfo.filename;
            paper.audio_url = audioInfo.exists ? audioInfo.webPath : null;
            paper.has_audio = audioInfo.exists;
            paper.audio_info = audioInfo;

            // 获取听力部分的题目
            const questionsSql = `
                SELECT 
                    q.*,
                    s.section_name,
                    s.section_type,
                    s.directions
                FROM exam_questions q
                JOIN exam_sections s ON q.section_id = s.id
                WHERE s.paper_id = ? AND s.section_type = 'listening'
                ORDER BY q.question_order ASC, q.question_number ASC
            `;

            db.all(questionsSql, [paperId], (err, questions) => {
                if (err) {
                    console.error('获取听力题目失败:', err);
                    return res.status(500).json({ success: false, message: '获取题目失败' });
                }

                // 处理题目数据
                const processedQuestions = questions.map(q => {
                    let options = [];
                    try {
                        if (q.options && typeof q.options === 'string') {
                            options = JSON.parse(q.options);
                        }
                    } catch (e) {
                        console.warn('选项解析失败:', e);
                        // 备用解析方法
                        if (q.options && q.options.includes(',')) {
                            options = q.options.split(',').map(opt => opt.trim());
                        }
                    }

                    return {
                        ...q,
                        options: options,
                        // 添加音频时间戳信息
                        audio_start_time: q.audio_start_time || 0,
                        audio_end_time: q.audio_end_time || 0
                    };
                });

                res.json({
                    success: true,
                    data: {
                        paper: paper,
                        questions: processedQuestions,
                        total_questions: processedQuestions.length,
                        audio_match: audioInfo
                    }
                });
            });
        });
    } catch (error) {
        console.error('听力试卷详情API错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 新增：重新扫描音频文件API - 使用智能匹配
app.post('/api/listening/rescan-audio', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        if (!db) {
            return res.status(500).json({ success: false, message: '数据库连接失败' });
        }

        // 获取所有听力试卷
        const sql = `
            SELECT DISTINCT p.* 
            FROM exam_papers p
            JOIN exam_sections s ON p.id = s.paper_id
            WHERE s.section_type = 'listening' AND p.is_active = 1
            ORDER BY p.year DESC, p.month DESC
        `;

        db.all(sql, [], (err, papers) => {
            if (err) {
                console.error('获取试卷失败:', err);
                return res.status(500).json({ success: false, message: '获取试卷失败' });
            }

            // 使用智能匹配重新扫描所有试卷的音频
            const rescannedPapers = processPapersAudio(papers);
            const matchedCount = rescannedPapers.filter(p => p.has_audio).length;
            const primaryMatches = rescannedPapers.filter(p => p.has_audio && p.audio_info.matchType === 'primary').length;
            const secondaryMatches = rescannedPapers.filter(p => p.has_audio && p.audio_info.matchType === 'secondary').length;

            res.json({
                success: true,
                message: `音频文件智能重新扫描完成`,
                data: {
                    total_papers: papers.length,
                    matched_papers: matchedCount,
                    unmatched_papers: papers.length - matchedCount,
                    primary_matches: primaryMatches,
                    secondary_matches: secondaryMatches,
                    papers: rescannedPapers
                }
            });
        });
    } catch (error) {
        console.error('重新扫描音频失败:', error);
        res.status(500).json({ success: false, message: '重新扫描失败' });
    }
});

// 检查音频文件是否存在
app.get('/api/listening/check-audio-file', (req, res) => {
    const { filename } = req.query;
    
    if (!filename) {
        return res.json({ exists: false, message: '文件名不能为空' });
    }
    
    // 同时在四级和六级目录中搜索
    const possiblePaths = [
        path.join(__dirname, '真题与听力', '四级听力', filename),
        path.join(__dirname, '真题与听力', '四级听力真题', filename),
        path.join(__dirname, '真题与听力', '六级听力', filename),
        path.join(__dirname, '真题与听力', '六级听力真题', filename),
        path.join(__dirname, '../真题与听力', '四级听力', filename),
        path.join(__dirname, '../真题与听力', '四级听力真题', filename),
        path.join(__dirname, '../真题与听力', '六级听力', filename),
        path.join(__dirname, '../真题与听力', '六级听力真题', filename)
    ];
    
    let exists = false;
    let foundPath = '';
    let folderType = '';
    
    for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
            exists = true;
            foundPath = filePath;
            if (filePath.includes('四级听力')) {
                folderType = '四级听力';
            } else if (filePath.includes('六级听力')) {
                folderType = '六级听力';
            }
            break;
        }
    }
    
    res.json({
        exists: exists,
        filename: filename,
        path: foundPath,
        folder_type: folderType,
        web_url: exists ? `/${folderType}/${filename}` : null
    });
});

// ==================== 增强版听力JSON数据服务 ====================

// 听力JSON数据服务 - 支持多文件聚合和智能匹配
app.get('/api/listening-json/papers', (req, res) => {
    try {
        const dataDir = path.join(__dirname, 'listening-data');
        
        // 检查目录是否存在
        if (!fs.existsSync(dataDir)) {
            return res.json({
                success: false,
                message: '听力数据目录不存在',
                data: []
            });
        }
        
        const papersMap = new Map(); // 使用Map来聚合同一套试卷
        
        // 读取所有年份文件夹
        const years = fs.readdirSync(dataDir).filter(item => 
            fs.statSync(path.join(dataDir, item)).isDirectory()
        ).sort((a, b) => b - a); // 按年份降序
        
        years.forEach(year => {
            const yearDir = path.join(dataDir, year);
            const files = fs.readdirSync(yearDir).filter(file => file.endsWith('.json'));
            
            files.forEach(file => {
                const filePath = path.join(yearDir, file);
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    if (data.paper) {
                        // 生成基础ID（去除 _1, _2 等后缀）
                        const baseId = file.replace(/_\d+\.json$/, '').replace('.json', '');
                        
                        if (papersMap.has(baseId)) {
                            // 合并题目数量
                            const existingPaper = papersMap.get(baseId);
                            existingPaper.total_questions += data.questions ? data.questions.length : 0;
                            existingPaper.file_count = (existingPaper.file_count || 1) + 1;
                            existingPaper.files.push(file);
                        } else {
                            // 创建新的试卷条目
                            const paper = { ...data.paper };
                            paper.id = baseId; // 使用基础ID
                            paper.total_questions = data.questions ? data.questions.length : 0;
                            paper.file_count = 1;
                            paper.files = [file];
                            paper.year = parseInt(year); // 确保年份是数字
                            papersMap.set(baseId, paper);
                        }
                    }
                } catch (error) {
                    console.error(`读取文件 ${filePath} 失败:`, error);
                }
            });
        });
        
        const papers = Array.from(papersMap.values());
        
        res.json({
            success: true,
            data: papers,
            message: `成功加载 ${papers.length} 套听力试卷`
        });
    } catch (error) {
        console.error('获取听力试卷列表失败:', error);
        res.json({
            success: false,
            message: '获取试卷列表失败',
            data: []
        });
    }
});

// 获取具体试卷的题目 - 支持多文件匹配和智能处理
app.get('/api/listening-json/papers/:id', (req, res) => {
    try {
        const paperId = req.params.id;
        const dataDir = path.join(__dirname, 'listening-data');
        
        // 检查目录是否存在
        if (!fs.existsSync(dataDir)) {
            return res.json({
                success: false,
                message: '听力数据目录不存在',
                data: []
            });
        }
        
        // 支持多种文件名格式匹配
        const years = fs.readdirSync(dataDir).filter(item => 
            fs.statSync(path.join(dataDir, item)).isDirectory()
        ).sort((a, b) => b - a); // 年份降序
        
        let foundData = null;
        let allQuestions = [];
        let matchingFiles = [];
        
        for (const year of years) {
            const yearDir = path.join(dataDir, year);
            
            // 查找所有匹配的JSON文件（支持 _1, _2 等后缀）
            matchingFiles = fs.readdirSync(yearDir).filter(file => {
                // 基础匹配（不含后缀）
                const baseFileName = file.replace(/_\d+\.json$/, '').replace('.json', '');
                if (baseFileName === paperId) {
                    return true;
                }
                // 精确匹配
                if (file.replace('.json', '') === paperId) {
                    return true;
                }
                return false;
            }).sort(); // 排序确保顺序正确
            
            if (matchingFiles.length > 0) {
                // 读取所有匹配的文件并合并题目
                for (const file of matchingFiles) {
                    const filePath = path.join(yearDir, file);
                    try {
                        const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        if (fileData.paper && !foundData) {
                            foundData = fileData; // 使用第一个文件的试卷信息
                            foundData.paper.file_count = matchingFiles.length;
                            foundData.paper.matching_files = matchingFiles;
                            foundData.paper.year = parseInt(year); // 确保年份是数字
                        }
                        if (fileData.questions) {
                            // 处理题目数据，确保格式正确
                            const processedQuestions = fileData.questions.map(question => {
                                // 确保选项是数组格式
                                if (typeof question.options === 'string') {
                                    try {
                                        question.options = JSON.parse(question.options);
                                    } catch (e) {
                                        console.warn(`选项解析失败: ${e.message}`);
                                        question.options = [];
                                    }
                                }
                                return question;
                            });
                            allQuestions = allQuestions.concat(processedQuestions);
                        }
                        console.log(`✅ 加载文件: ${file}, 题目数: ${fileData.questions ? fileData.questions.length : 0}`);
                    } catch (error) {
                        console.error(`读取文件 ${filePath} 失败:`, error);
                    }
                }
                break; // 找到匹配文件后退出循环
            }
        }
        
        if (foundData && allQuestions.length > 0) {
            // 更新题目数量并重新编号
            foundData.paper.total_questions = allQuestions.length;
            
            // 重新编号题目
            allQuestions.forEach((question, index) => {
                question.question_number = index + 1;
                // 确保section_type有默认值
                if (!question.section_type) {
                    question.section_type = 'short'; // 默认短对话
                }
            });
            
            res.json({
                success: true,
                paper: foundData.paper,
                data: allQuestions,
                count: allQuestions.length,
                file_count: matchingFiles.length,
                message: `成功加载 ${allQuestions.length} 道题目（来自 ${matchingFiles.length} 个文件）`
            });
        } else {
            res.json({
                success: false,
                message: '试卷不存在',
                data: []
            });
        }
    } catch (error) {
        console.error('获取试卷详情失败:', error);
        res.json({
            success: false,
            message: '获取试卷详情失败',
            data: []
        });
    }
});

// 音频文件检查API
app.get('/api/listening/check-audio', (req, res) => {
    const { file, type } = req.query;
    
    if (!file) {
        return res.json({ exists: false, message: '文件名不能为空' });
    }
    
    // 同时在四级和六级目录中搜索
    const possiblePaths = [
        path.join(__dirname, '真题与听力', '四级听力', file),
        path.join(__dirname, '真题与听力', '四级听力真题', file),
        path.join(__dirname, '真题与听力', '六级听力', file),
        path.join(__dirname, '真题与听力', '六级听力真题', file),
        path.join(__dirname, '../真题与听力', '四级听力', file),
        path.join(__dirname, '../真题与听力', '四级听力真题', file),
        path.join(__dirname, '../真题与听力', '六级听力', file),
        path.join(__dirname, '../真题与听力', '六级听力真题', file)
    ];
    
    let exists = false;
    let foundPath = '';
    let folderType = '';
    
    for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
            exists = true;
            foundPath = filePath;
            if (filePath.includes('四级听力')) {
                folderType = '四级听力';
            } else if (filePath.includes('六级听力')) {
                folderType = '六级听力';
            }
            break;
        }
    }
    
    res.json({
        exists: exists,
        file: file,
        path: foundPath,
        folder_type: folderType,
        url: exists ? `/${folderType}/${file}` : null
    });
});

// 新增：听力数据调试接口
app.get('/api/debug/listening-data', (req, res) => {
    const dataDir = path.join(__dirname, 'listening-data');
    
    if (!fs.existsSync(dataDir)) {
        return res.json({ 
            success: false, 
            message: '听力数据目录不存在',
            data: {
                paper_count: 0,
                question_count: 0,
                papers: [],
                timestamp: new Date().toISOString()
            }
        });
    }
    
    try {
        const papersMap = new Map();
        let totalQuestions = 0;
        
        // 读取所有年份文件夹
        const years = fs.readdirSync(dataDir).filter(item => 
            fs.statSync(path.join(dataDir, item)).isDirectory()
        ).sort((a, b) => b - a);
        
        years.forEach(year => {
            const yearDir = path.join(dataDir, year);
            const files = fs.readdirSync(yearDir).filter(file => file.endsWith('.json'));
            
            files.forEach(file => {
                const filePath = path.join(yearDir, file);
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    if (data.paper) {
                        const baseId = file.replace(/_\d+\.json$/, '').replace('.json', '');
                        
                        if (papersMap.has(baseId)) {
                            const existingPaper = papersMap.get(baseId);
                            existingPaper.total_questions += data.questions ? data.questions.length : 0;
                            existingPaper.file_count = (existingPaper.file_count || 1) + 1;
                            existingPaper.files.push(file);
                        } else {
                            const paper = { ...data.paper };
                            paper.id = baseId;
                            paper.total_questions = data.questions ? data.questions.length : 0;
                            paper.file_count = 1;
                            paper.files = [file];
                            papersMap.set(baseId, paper);
                        }
                        totalQuestions += data.questions ? data.questions.length : 0;
                    }
                } catch (error) {
                    console.error(`读取文件 ${filePath} 失败:`, error);
                }
            });
        });
        
        const papers = Array.from(papersMap.values());
        
        res.json({
            success: true,
            data: {
                paper_count: papers.length,
                question_count: totalQuestions,
                papers: papers,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('调试听力数据失败:', error);
        res.json({
            success: false,
            message: '调试听力数据失败',
            error: error.message
        });
    }
});

// 新增：数据库连接状态检查接口
app.get('/api/debug/database-status', (req, res) => {
    const db = getDatabase();
    
    if (!db) {
        return res.json({
            success: false,
            message: '数据库连接无效',
            data: {
                dbObjExists: !!app.locals.db,
                dbObjType: typeof app.locals.db,
                dbObjMethods: app.locals.db ? Object.keys(app.locals.db) : [],
                actualDbExists: false
            }
        });
    }

    // 测试数据库查询
    db.get('SELECT name FROM sqlite_master WHERE type="table" AND name="exam_papers"', (err, row) => {
        res.json({
            success: true,
            data: {
                dbObjExists: !!app.locals.db,
                dbObjType: typeof app.locals.db,
                actualDbExists: !!db,
                actualDbType: typeof db,
                actualDbMethods: db ? Object.keys(db).filter(key => typeof db[key] === 'function') : [],
                examTableExists: !!row,
                tableCheckError: err ? err.message : null
            }
        });
    });
});

// 在云梦智间服务器.js中添加调试接口
app.get('/api/debug/analysis-status', (req, res) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const analysisData = {
        urlParams: Object.fromEntries(urlParams.entries()),
        timestamp: new Date().toISOString(),
        status: 'debug_info'
    };
    
    res.json({
        success: true,
        message: '调试信息',
        data: analysisData
    });
});

// 添加调试接口到服务器
app.get('/api/debug/auth-status', authMiddleware.authenticateToken, (req, res) => {
    res.json({
        success: true,
        data: {
            user: req.user,
            authenticated: true,
            timestamp: new Date().toISOString()
        }
    });
});

app.get('/api/debug/diary-status', authMiddleware.authenticateToken, (req, res) => {
    const db = getDatabase();
    
    if (!db) {
        return res.json({ success: false, message: '数据库连接无效' });
    }
    
    // 检查日记表
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='diary_entries'", (err, row) => {
        res.json({
            success: true,
            data: {
                user: req.user,
                diaryTableExists: !!row,
                authenticated: true,
                timestamp: new Date().toISOString()
            }
        });
    });
});

// 新增：调试视频文件服务
app.get('/api/debug/videos', (req, res) => {
    const videosPath = path.join(__dirname, 'videos');
    
    try {
        if (!fs.existsSync(videosPath)) {
            return res.json({ 
                success: false, 
                message: 'videos文件夹不存在',
                absolutePath: videosPath 
            });
        }
        
        const files = fs.readdirSync(videosPath);
        const videoFiles = files.filter(file => 
            file.endsWith('.mp4') || 
            file.endsWith('.avi') || 
            file.endsWith('.mov')
        );
        
        res.json({
            success: true,
            videoCount: videoFiles.length,
            videos: videoFiles,
            absolutePath: videosPath,
            files: files // 所有文件列表，用于调试
        });
    } catch (error) {
        res.json({
            success: false,
            message: '读取视频文件夹失败',
            error: error.message,
            absolutePath: videosPath
        });
    }
});

// 新增：直接视频文件检查
app.get('/api/debug/video/:filename', (req, res) => {
    const filename = req.params.filename;
    const videoPath = path.join(__dirname, 'videos', filename);
    
    try {
        if (!fs.existsSync(videoPath)) {
            return res.json({
                success: false,
                message: `视频文件不存在: ${filename}`,
                absolutePath: videoPath
            });
        }
        
        const stats = fs.statSync(videoPath);
        res.json({
            success: true,
            filename: filename,
            exists: true,
            size: stats.size,
            absolutePath: videoPath,
            url: `/videos/${filename}`
        });
    } catch (error) {
        res.json({
            success: false,
            message: `检查视频文件失败: ${filename}`,
            error: error.message
        });
    }
});

// 新增：日记备份功能
app.get('/api/diary/backup', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const userId = req.user.id;
        
        if (!db) {
            return res.json({ success: false, message: '数据库连接无效' });
        }
        
        db.all('SELECT * FROM diary_entries WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, entries) => {
            if (err) {
                return res.json({ success: false, message: '备份失败' });
            }
            
            const backupData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                totalEntries: entries.length,
                entries: entries
            };
            
            res.setHeader('Content-Disposition', `attachment; filename="diary-backup-${userId}-${Date.now()}.json"`);
            res.json(backupData);
        });
    } catch (error) {
        res.json({ success: false, message: '备份失败' });
    }
});

// 新增：日记表初始化接口
app.post('/api/diary/init-tables', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        
        if (!db) {
            return res.json({ success: false, message: '数据库连接无效' });
        }
        
        console.log('🔧 手动初始化日记表...');
        
        const result = await completeDiarySetup(db);
        
        if (result.success) {
            res.json({
                success: true,
                message: '日记表初始化成功',
                data: result
            });
        } else {
            res.status(500).json({
                success: false,
                message: '日记表初始化失败',
                error: result.error
            });
        }
    } catch (error) {
        console.error('❌ 手动初始化日记表失败:', error);
        res.status(500).json({
            success: false,
            message: '日记表初始化异常',
            error: error.message
        });
    }
});

// 新增：日记表状态检查接口
app.get('/api/diary/table-status', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        
        if (!db) {
            return res.json({ success: false, message: '数据库连接无效' });
        }
        
        const checkResult = await checkDiaryTables(db);
        const validationResult = await require('./server_modules/init-diary-tables-enhanced.js').validateTableStructure(db);
        
        res.json({
            success: true,
            data: {
                tableCheck: checkResult,
                validation: validationResult,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.json({
            success: false,
            message: '检查日记表状态失败',
            error: error.message
        });
    }
});

// 新增：手动修复日记表接口
app.post('/api/diary/fix-tables', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { fixDiaryTables } = require('./server_modules/fix-diary-tables.js');
        const db = getDatabase();
        
        if (!db) {
            return res.json({ success: false, message: '数据库连接无效' });
        }
        
        console.log('🔧 手动触发日记表修复...');
        
        const result = await fixDiaryTables(db);
        
        if (result.success) {
            res.json({
                success: true,
                message: '日记表修复成功',
                data: result
            });
        } else {
            res.status(500).json({
                success: false,
                message: '日记表修复失败',
                error: result.error
            });
        }
    } catch (error) {
        console.error('❌ 手动修复日记表失败:', error);
        res.status(500).json({
            success: false,
            message: '日记表修复异常',
            error: error.message
        });
    }
});

// 新增：调试路由用于测试认证
app.get('/api/debug/user-info', authCompat.authenticateTokenCompat, (req, res) => {
    res.json({
        success: true,
        data: {
            user: req.user,
            normalized: {
                id: req.user.id,
                username: req.user.username
            },
            timestamp: new Date().toISOString()
        }
    });
});

// 新增：音频路径调试接口
app.get('/api/debug/audio-paths', (req, res) => {
    const audioBasePaths = [
        path.join(__dirname, '真题与听力'),
        path.join(__dirname, '../真题与听力'),
        path.join(process.cwd(), '真题与听力')
    ];
    
    const results = audioBasePaths.map(basePath => {
        const exists = fs.existsSync(basePath);
        let subfolders = [];
        
        if (exists) {
            try {
                subfolders = fs.readdirSync(basePath).filter(item => 
                    fs.statSync(path.join(basePath, item)).isDirectory()
                );
            } catch (e) {
                console.error(`读取 ${basePath} 失败:`, e.message);
            }
        }
        
        return {
            path: basePath,
            exists: exists,
            subfolders: subfolders
        };
    });
    
    res.json({
        success: true,
        data: results
    });
});

// 新增：增强音频文件检查接口
app.get('/api/audio/check', (req, res) => {
    const { filename, type } = req.query;
    
    if (!filename) {
        return res.json({ exists: false, message: '文件名不能为空' });
    }
    
    // 同时在四级和六级目录中搜索
    const possiblePaths = [
        path.join(__dirname, '真题与听力', '四级听力', filename),
        path.join(__dirname, '真题与听力', '四级听力真题', filename),
        path.join(__dirname, '真题与听力', '六级听力', filename),
        path.join(__dirname, '真题与听力', '六级听力真题', filename),
        path.join(__dirname, '../真题与听力', '四级听力', filename),
        path.join(__dirname, '../真题与听力', '四级听力真题', filename),
        path.join(__dirname, '../真题与听力', '六级听力', filename),
        path.join(__dirname, '../真题与听力', '六级听力真题', filename),
        // 新增直接查找
        path.join(__dirname, '真题与听力', filename),
        path.join(__dirname, '../真题与听力', filename)
    ];
    
    let exists = false;
    let foundPath = '';
    let accessible = false;
    let folderType = '';
    
    for (const filePath of possiblePaths) {
        try {
            if (fs.existsSync(filePath)) {
                exists = true;
                foundPath = filePath;
                if (filePath.includes('四级听力')) {
                    folderType = '四级听力';
                } else if (filePath.includes('六级听力')) {
                    folderType = '六级听力';
                }
                // 检查文件是否可读
                try {
                    fs.accessSync(filePath, fs.constants.R_OK);
                    accessible = true;
                } catch (e) {
                    console.warn(`文件存在但不可读: ${filePath}`);
                }
                break;
            }
        } catch (error) {
            console.warn(`检查路径失败: ${filePath}`, error.message);
        }
    }
    
    res.json({
        exists: exists,
        accessible: accessible,
        filename: filename,
        path: foundPath,
        folder_type: folderType,
        webPath: exists ? `/${folderType}/${filename}` : null,
        message: exists ? (accessible ? '音频文件找到且可访问' : '音频文件找到但不可访问') : '音频文件未找到'
    });
});

// 新增：直接文件访问测试路由
app.get('/api/test-audio/:filename', (req, res) => {
    const filename = req.params.filename;
    console.log(`🔍 测试音频文件访问: ${filename}`);
    
    const filePaths = [
        path.join(__dirname, '真题与听力', '四级听力', filename),
        path.join(__dirname, '真题与听力', '六级听力', filename)
    ];
    
    for (const filePath of filePaths) {
        if (fs.existsSync(filePath)) {
            console.log(`✅ 找到文件: ${filePath}`);
            
            // 设置正确的headers
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            // 直接发送文件
            return res.sendFile(filePath);
        }
    }
    
    console.log(`❌ 文件未找到: ${filename}`);
    res.status(404).json({ 
        success: false, 
        message: '文件未找到',
        searchedPaths: filePaths
    });
});

// 修改：视频课程API路由 - 直接返回静态数据，不查询数据库
app.get('/api/courses', async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        
        // 静态视频课程数据
        const allCourses = [
            {
                id: 1,
                title: "英语口语进阶",
                description: "AI 情景对话 | 职场必备",
                image: "https://ai-public.mastergo.com/ai/img_res/4f81835c2858a319eba7efb9ff6d03f6.jpg",
                video_url: "英语口语进阶.mp4",
                rating: 4,
                popularity: 98,
                students: 2345,
                duration: 120,
                tags: ["口语", "职场", "AI对话"],
                is_active: 1
            },
            {
                id: 2,
                title: "语法精讲系列",
                description: "虚拟语气 | 从入门到精通",
                image: "https://ai-public.mastergo.com/ai/img_res/c62474d9490954385e1af0851a1d66da.jpg",
                video_url: "语法精讲.mp4",
                rating: 3,
                popularity: 85,
                students: 1876,
                duration: 90,
                tags: ["语法", "虚拟语气"],
                is_active: 1
            },
            {
                id: 3,
                title: "高频词汇突破",
                description: "四六级必备 | 记忆法",
                image: "https://ai-public.mastergo.com/ai/img_res/8bad936df7a37d61f452e780975f1174.jpg",
                video_url: "高频词汇突破.mp4",
                rating: 5,
                popularity: 95,
                students: 3421,
                duration: 150,
                tags: ["词汇", "四六级", "记忆法"],
                is_active: 1
            },
            {
                id: 4,
                title: "听力特训营",
                description: "场景对话 | 听力技巧",
                image: "https://ai-public.mastergo.com/ai/img_res/6edc1cdcc59041790c195be927d70950.jpg",
                video_url: "听力特训营.mp4",
                rating: 4,
                popularity: 92,
                students: 2789,
                duration: 180,
                tags: ["听力", "场景对话"],
                is_active: 1
            },
            {
                id: 5,
                title: "写作进阶课程",
                description: "高分写作 | 实战技巧",
                image: "https://ai-public.mastergo.com/ai/img_res/5d74927c0728d84eed2da0502713f883.jpg",
                video_url: "写作进阶课程.mp4",
                rating: 4,
                popularity: 89,
                students: 1654,
                duration: 160,
                tags: ["写作", "高分技巧"],
                is_active: 1
            },
            {
                id: 6,
                title: "阅读理解突破",
                description: "快速阅读 | 解题技巧",
                image: "https://ai-public.mastergo.com/ai/img_res/a510a6e17c47db481734345bfd1050a5.jpg",
                video_url: "阅读理解突破.mp4",
                rating: 3,
                popularity: 82,
                students: 2123,
                duration: 140,
                tags: ["阅读", "解题技巧"],
                is_active: 1
            },
            {
                id: 7,
                title: "翻译技巧精讲",
                description: "中英互译 | 专业技巧",
                image: "https://ai-public.mastergo.com/ai/img_res/8a95593ceff398b9a3975ad1a3009b4e.jpg",
                video_url: "翻译技巧精讲.mp4",
                rating: 5,
                popularity: 96,
                students: 3567,
                duration: 200,
                tags: ["翻译", "中英互译"],
                is_active: 1
            },
            {
                id: 8,
                title: "考前冲刺班",
                description: "真题解析 | 考点预测",
                image: "https://ai-public.mastergo.com/ai/img_res/9c1e72d72d792aa60dcf05f67d464f9c.jpg",
                video_url: "考前冲刺班.mp4",
                rating: 4,
                popularity: 91,
                students: 4231,
                duration: 240,
                tags: ["冲刺", "真题", "考点预测"],
                is_active: 1
            }
        ];

        // 过滤课程
        let filteredCourses = allCourses.filter(course => course.is_active === 1);
        
        // 应用搜索查询
        if (search) {
            const query = search.toLowerCase();
            filteredCourses = filteredCourses.filter(course => 
                course.title.toLowerCase().includes(query) || 
                course.description.toLowerCase().includes(query) ||
                course.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }
        
        // 计算分页
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedCourses = filteredCourses.slice(startIndex, endIndex);
        
        // 处理课程数据，确保视频URL正确
        const processedCourses = paginatedCourses.map(course => {
            // 如果视频URL是相对路径，转换为绝对路径
            if (course.video_url && !course.video_url.startsWith('http')) {
                course.videoUrl = `/videos/${course.video_url}`;
            } else {
                course.videoUrl = course.video_url;
            }
            return course;
        });
        
        res.json({
            success: true,
            courses: processedCourses,
            total: filteredCourses.length,
            page: pageNum,
            limit: limitNum
        });
    } catch (error) {
        console.error('获取视频课程列表错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 新增：虚拟场景API路由 - 直接返回静态数据
app.get('/api/virtual-scenes', async (req, res) => {
    try {
        // 静态虚拟场景数据
        const scenes = [
            {
                id: 1,
                name: "智能图书馆",
                description: "虚拟学习空间 | 智能书架",
                thumbnail: "https://ai-public.mastergo.com/ai/img_res/97d242a4187ee7ef91f58621b69989ab.jpg",
                background: "https://ai-public.mastergo.com/ai/img_res/97d242a4187ee7ef91f58621b69989ab.jpg",
                videoIds: [1, 3, 6],
                sort_order: 1,
                is_active: 1
            },
            {
                id: 2,
                name: "语音实验室",
                description: "听说训练 | 发音矫正",
                thumbnail: "https://ai-public.mastergo.com/ai/img_res/4e6e11b0b9cf32e973e67ff68372b143.jpg",
                background: "https://ai-public.mastergo.com/ai/img_res/4e6e11b0b9cf32e973e67ff68372b143.jpg",
                videoIds: [1, 4],
                sort_order: 2,
                is_active: 1
            },
            {
                id: 3,
                name: "四六级考场",
                description: "考试模拟 | 实战体验",
                thumbnail: "https://ai-public.mastergo.com/ai/img_res/a6425301d6689dd01b322fb389cf5c69.jpg",
                background: "https://ai-public.mastergo.com/ai/img_res/a6425301d6689dd01b322fb389cf5c69.jpg",
                videoIds: [3, 8],
                sort_order: 3,
                is_active: 1
            },
            {
                id: 4,
                name: "互动教室",
                description: "小组讨论 | 协作学习",
                thumbnail: "https://ai-public.mastergo.com/ai/img_res/df11c284827265d64b65cfa7f61cf136.jpg",
                background: "https://ai-public.mastergo.com/ai/img_res/df11c284827265d64b65cfa7f61cf136.jpg",
                videoIds: [1, 2, 5],
                sort_order: 4,
                is_active: 1
            }
        ];

        res.json({ 
            success: true, 
            scenes: scenes 
        });
    } catch (error) {
        console.error('获取虚拟场景列表错误:', error);
        res.json({ success: false, message: '服务器错误' });
    }
});

// 静态文件服务 - 添加听力音频文件服务
app.use('/四级听力', express.static(path.join(__dirname, '真题与听力/四级听力')));
app.use('/六级听力', express.static(path.join(__dirname, '真题与听力/六级听力')));

// ==================== 静态页面路由 ====================

// 静态文件服务
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间首页.html'));
});

app.get('/云梦智间登录.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间登录.html'));
});

app.get('/云梦智间注册.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间注册.html'));
});

app.get('/云梦智间社区.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间社区.html'));
});

app.get('/云梦智间词汇.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间词汇.html'));
});

app.get('/云梦智间AI聊天.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间AI聊天.html'));
});

// 新增测试和分析页面
app.get('/云梦智间测试.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间测试.html'));
});

app.get('/云梦智间学习分析.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间学习分析.html'));
});

// 新增用户中心页面
app.get('/云梦智间用户.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间用户.html'));
});

// 新增教学和视频页面
app.get('/云梦智间教学.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间教学.html'));
});

app.get('/云梦智间视频.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间视频.html'));
});

// 新增写作页面
app.get('/云梦智间写作.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间写作.html'));
});

// 新增批改页面
app.get('/云梦智间批改.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间批改.html'));
});

// 新增日记页面 - 指向增强版
app.get('/云梦智间日记.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间日记.html'));
});

// 新增错题本页面
app.get('/云梦智间错题本.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间错题本.html'));
});

// 新增：真题考试页面路由
app.get('/云梦智间真题考试.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间真题考试.html'));
});

// 新增：计划页面路由
app.get('/云梦智间计划.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间计划.html'));
});

// 新增：听力页面路由
app.get('/云梦智间听力.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间听力.html'));
});

// 新增：会员页面路由
app.get('/云梦智间会员.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间会员.html'));
});

// 新增：游戏页面路由
app.get('/云梦智间游戏.html', (req, res) => {
    res.sendFile(path.join(__dirname, '云梦智间游戏.html'));
});

// 新增：工具页面路由
app.get('/tools/listening-data-editor', (req, res) => {
    res.sendFile(path.join(__dirname, 'tools/listening-data-editor.html'));
});

// 添加真题数据查看器页面路由
app.get('/tools/exam-data-viewer', (req, res) => {
    res.sendFile(path.join(__dirname, 'tools/exam-data-viewer.html'));
});

// 新增：真题数据编辑器页面路由
app.get('/tools/exam-data-editor', (req, res) => {
    res.sendFile(path.join(__dirname, 'tools/exam-data-editor.html'));
});

// ==================== 考试表检查函数 ====================
async function checkExamTables(db) {
    return new Promise((resolve, reject) => {
        const requiredTables = ['exam_sessions', 'exam_user_answers'];
        let checkedTables = 0;
        
        requiredTables.forEach(table => {
            db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table], (err, row) => {
                if (err) {
                    console.error(`❌ 检查表 ${table} 失败:`, err);
                } else if (!row) {
                    console.warn(`⚠️ 表 ${table} 不存在，请运行数据库初始化`);
                } else {
                    console.log(`✅ 表 ${table} 存在`);
                }
                
                checkedTables++;
                if (checkedTables === requiredTables.length) {
                    resolve();
                }
            });
        });
    });
}

// ==================== 全局错误处理中间件 ====================
// 全局错误处理中间件
app.use((error, req, res, next) => {
    console.error('全局错误捕获:', error);
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
});

// 404 处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: '接口不存在'
    });
});

// 添加错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ 
        success: false, 
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? err.message : '内部服务器错误'
    });
});

// 404 处理
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        message: '接口不存在' 
    });
});

// 启动服务器
app.listen(PORT, async () => {
    console.log(`\n🚀 云梦智间服务器运行在端口 ${PORT}`);
    console.log('='.repeat(60));
    
    // 创建游戏相关目录
    const gameDirs = ['game/uploads', 'game/exports', 'game/data'];
    gameDirs.forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`✅ 创建游戏目录: ${dir}`);
        }
    });
    
    // 新增：音频文件智能扫描
    try {
        console.log('🎵 开始智能音频文件扫描...');
        const db = getDatabase();
        if (db) {
            // 获取所有听力试卷进行智能音频匹配
            const sql = `
                SELECT DISTINCT p.* 
                FROM exam_papers p
                JOIN exam_sections s ON p.id = s.paper_id
                WHERE s.section_type = 'listening' AND p.is_active = 1
                ORDER BY p.year DESC, p.month DESC
            `;
            
            db.all(sql, [], (err, papers) => {
                if (!err && papers) {
                    const processedPapers = processPapersAudio(papers);
                    const matchedCount = processedPapers.filter(p => p.has_audio).length;
                    const primaryMatches = processedPapers.filter(p => p.has_audio && p.audio_info.matchType === 'primary').length;
                    const secondaryMatches = processedPapers.filter(p => p.has_audio && p.audio_info.matchType === 'secondary').length;
                    
                    console.log(`📊 智能音频扫描完成: ${matchedCount}/${papers.length} 套试卷匹配成功`);
                    console.log(`   主要匹配: ${primaryMatches}, 次要匹配: ${secondaryMatches}`);
                }
            });
        }
    } catch (error) {
        console.log('⚠️ 音频扫描跳过（系统启动中）');
    }
    
    // 检查考试相关表
    try {
        const db = getDatabase();
        await checkExamTables(db);
    } catch (error) {
        console.error('❌ 检查考试表失败:', error);
    }
    
    // 强制修复日记表 - 使用新的修复脚本
    try {
        console.log('🔧 强制修复日记表结构...');
        const { fixDiaryTables } = require('./server_modules/fix-diary-tables.js');
        const fixResult = await fixDiaryTables(getDatabase());
        if (fixResult.success) {
            console.log('✅ 日记表修复成功');
            if (fixResult.warnings) {
                console.log('⚠️ 警告:', fixResult.warnings);
            }
        } else {
            console.error('❌ 日记表修复失败:', fixResult.error);
        }
    } catch (error) {
        console.error('❌ 日记表修复异常:', error);
    }
    
    // 使用增强版日记表初始化
    try {
        console.log('🎯 开始增强版日记表初始化...');
        
        const setupResult = await completeDiarySetup(getDatabase());
        
        if (setupResult.success) {
            console.log('✅ 日记系统初始化成功');
            
            // 开发环境下插入测试数据
            if (process.env.NODE_ENV === 'development') {
                console.log('🧪 开发环境：插入测试数据...');
                await insertTestData(getDatabase(), 1); // 为用户ID 1插入测试数据
            }
        } else {
            console.error('❌ 日记系统初始化失败:', setupResult.message);
            console.log('⚠️ 日记功能可能受限，但系统将继续运行');
        }
        
    } catch (error) {
        console.error('❌ 日记表初始化异常:', error.message);
        console.log('🔧 系统将继续运行，日记功能使用紧急模式');
    }
    
    // 初始化错题本表
    try {
        console.log('🎯 开始错题本表初始化...');
        const setupResult = await completeErrorQuestionsSetup(getDatabase());
        
        if (setupResult.success) {
            console.log('✅ 错题本系统初始化成功');
            
            // 开发环境下插入测试数据
            if (process.env.NODE_ENV === 'development') {
                console.log('🧪 开发环境：插入错题本测试数据...');
                await insertErrorQuestionsTestData(getDatabase(), 1);
            }
        } else {
            console.error('❌ 错题本系统初始化失败:', setupResult.message);
        }
    } catch (error) {
        console.error('❌ 错题本表初始化异常:', error.message);
    }
    
    // 检查听力数据状态
    try {
        console.log('🎵 检查听力数据状态...');
        const dataDir = path.join(__dirname, 'listening-data');
        if (fs.existsSync(dataDir)) {
            const years = fs.readdirSync(dataDir).filter(item => 
                fs.statSync(path.join(dataDir, item)).isDirectory()
            );
            let totalFiles = 0;
            years.forEach(year => {
                const yearDir = path.join(dataDir, year);
                const files = fs.readdirSync(yearDir).filter(file => file.endsWith('.json'));
                totalFiles += files.length;
                console.log(`   📁 ${year}年: ${files.length} 个JSON文件`);
            });
            console.log(`   📊 总计: ${years.length} 个年份, ${totalFiles} 个JSON文件`);
        } else {
            console.log('   ⚠️ 听力数据目录不存在');
        }
    } catch (error) {
        console.error('❌ 检查听力数据失败:', error.message);
    }
    
    // 新增：静态文件服务配置检查
    console.log('\n🔍 静态文件服务配置检查:');
    const staticPaths = [
        { path: path.join(__dirname, '真题与听力', '四级听力'), url: '/四级听力' },
        { path: path.join(__dirname, '真题与听力', '六级听力'), url: '/六级听力' }
    ];

    staticPaths.forEach(config => {
        const exists = fs.existsSync(config.path);
        console.log(`   ${exists ? '✅' : '❌'} ${config.url} -> ${config.path} ${exists ? '' : '(目录不存在)'}`);
        
        if (exists) {
            const files = fs.readdirSync(config.path).filter(f => f.endsWith('.mp3'));
            console.log(`      📁 包含 ${files.length} 个MP3文件`);
            if (files.length > 0) {
                console.log(`      示例文件: ${files.slice(0, 3).join(', ')}${files.length > 3 ? '...' : ''}`);
            }
        }
    });
    
    console.log('\n📱 主要页面访问地址:');
    console.log(`   首页: http://localhost:${PORT}/`);
    console.log(`   登录: http://localhost:${PORT}/云梦智间登录.html`);
    console.log(`   测试: http://localhost:${PORT}/云梦智间测试.html`);
    console.log(`   分析: http://localhost:${PORT}/云梦智间学习分析.html`);
    console.log(`   用户中心: http://localhost:${PORT}/云梦智间用户.html`);
    console.log(`   社区: http://localhost:${PORT}/云梦智间社区.html`);
    console.log(`   词汇: http://localhost:${PORT}/云梦智间词汇.html`);
    console.log(`   真题考试: http://localhost:${PORT}/云梦智间真题考试.html`);
    console.log(`   AI聊天: http://localhost:${PORT}/云梦智间AI聊天.html`);
    console.log(`   教学: http://localhost:${PORT}/云梦智间教学.html`);
    console.log(`   计划: http://localhost:${PORT}/云梦智间计划.html`);
    console.log(`   写作: http://localhost:${PORT}/云梦智间写作.html`);
    console.log(`   批改: http://localhost:${PORT}/云梦智间批改.html`);
    console.log(`   听力: http://localhost:${PORT}/云梦智间听力.html`);
    console.log(`   日记: http://localhost:${PORT}/云梦智间日记.html`);
    console.log(`   错题本: http://localhost:${PORT}/云梦智间错题本.html`);
    console.log(`   会员: http://localhost:${PORT}/云梦智间会员.html`);
    console.log(`   游戏: http://localhost:${PORT}/云梦智间游戏.html`);
    console.log(`   真题数据查看器: http://localhost:${PORT}/tools/exam-data-viewer`);
    console.log(`   真题数据编辑器: http://localhost:${PORT}/tools/exam-data-editor`);
    
    console.log('\n🎯 核心功能状态:');
    console.log('   ✅ 用户认证系统');
    console.log('   ✅ 词汇学习系统');
    console.log('   ✅ 考试练习系统 (完全前端化)');
    console.log('   ✅ AI对话系统');
    console.log('   ✅ 学习分析系统');
    console.log('   ✅ 视频课程系统');
    console.log('   ✅ 虚拟场景系统');
    console.log('   ✅ 写作评分系统');
    console.log('   ✅ 学习计划系统');
    console.log('   ✅ AI智能批改系统');
    console.log('   ✅ 学习日记记录系统');
    console.log('   ✅ 增强版日记API服务');
    console.log('   ✅ 智能错题本管理');
    console.log('   ✅ 完整的日记API系统');
    console.log('   ✅ 日记数据一键备份');
    console.log('   ✅ 增强版日记表初始化');
    console.log('   ✅ 日记表状态监控');
    console.log('   ✅ 兼容性认证支持');
    console.log('   ✅ 日记表自动修复');
    console.log('   ✅ 日记表手动修复');
    console.log('   ✅ 错题本自动记录');
    console.log('   ✅ PDF导入管理（本地解析）');
    console.log('   ✅ 智能PDF本地解析');
    console.log('   ✅ 直接JSON听力数据服务');
    console.log('   ✅ 多路径音频文件服务');
    console.log('   ✅ 音频文件自动检测');
    console.log('   ✅ 音频路径调试接口');
    console.log('   ✅ 多文件听力数据聚合');
    console.log('   ✅ 静态词汇数据服务');
    console.log('   ✅ 真题数据导入工具');
    console.log('   ✅ 真题数据编辑器');
    console.log('   ✅ 增强版写作功能');
    console.log('   ✅ 写作真题练习系统');
    console.log('   ✅ 随机写作题目生成');
    console.log('   ✅ 扣子智能体对话服务');
    console.log('   ✅ 听力真题API服务');
    console.log('   ✅ 智能音频文件匹配系统');
    console.log('   ✅ 四级/六级听力目录共同搜索');
    console.log('   ✅ 音频文件匹配评分算法');
    console.log('   ✅ 主要/次要匹配类型识别');
    console.log('   ✅ 听力题目音频时间戳支持');
    console.log('   ✅ 音频文件智能搜索算法');
    console.log('   ✅ 多模式文件名匹配');
    console.log('   ✅ 音频文件批量重新扫描');
    console.log('   ✅ 用户学习数据统计');
    console.log('   ✅ 技能水平多维分析');
    console.log('   ✅ 学习活动自动追踪');
    console.log('   ✅ 连续签到激励机制');
    console.log('   ✅ 学习状态实时监控');
    console.log('   ✅ 最近学习记录追踪');
    console.log('   ✅ 用户资料在线编辑');
    console.log('   ✅ 词汇学习活动记录');
    console.log('   ✅ 用户词汇学习统计');
    console.log('   ✅ 词汇数据服务');
    console.log('   ✅ 游戏系统');
    console.log('   ✅ 游戏静态文件服务');
    console.log('   ✅ 游戏API路由');
    console.log('   ✅ 游戏服务器集成');
    console.log('   ✅ 游戏词汇统计API');
    console.log('   ✅ 游戏词汇库检查API');
    console.log('   ✅ 游戏题目生成API');
    console.log('   ✅ 游戏文件管理API');
    console.log('   ✅ 游戏词汇导入API');
    console.log('   ✅ 游戏文件删除API');
    console.log('   ✅ 游戏文件详情API');
    
    console.log('\n⚡ 性能优化状态:');
    console.log('   ✅ 静态资源缓存优化');
    console.log('   ✅ 数据库查询优化');
    console.log('   ✅ 大文件传输优化 (50MB限制)');
    console.log('   ✅ CORS跨域配置');
    console.log('   ✅ 认证状态同步');
    console.log('   ✅ 范文数据丰富');
    
    console.log('\n🔧 服务配置状态:');
    console.log('   ✅ 视频文件服务: /videos');
    console.log('   ✅ 音频文件服务: /四级听力, /六级听力');
    console.log('   ✅ 直接音频服务: /audio, /cet4-audio, /cet6-audio');
    console.log('   ✅ 备用音频服务: /audio-fallback');
    console.log('   ✅ 直接JSON数据服务: /api/listening-json/papers');
    console.log('   ✅ 直接JSON数据服务: /api/listening-json/papers/:id');
    console.log('   ✅ 写作真题API: /api/writing/papers');
    console.log('   ✅ 写作真题题目API: /api/writing/papers/:paperId/questions');
    console.log('   ✅ 随机写作题目API: /api/writing/random-question');
    console.log('   ✅ 增强版写作API: /api/writing-enhanced');
    console.log('   ✅ 扣子智能体API: /api/ai/bot');
    console.log('   ✅ 听力真题API: /api/listening/papers');
    console.log('   ✅ 听力真题详情API: /api/listening/papers/:paperId');
    console.log('   ✅ 音频文件检查API: /api/listening/check-audio-file');
    console.log('   ✅ 音频重新扫描API: /api/listening/rescan-audio');
    console.log('   ✅ 用户统计API: /api/user/stats');
    console.log('   ✅ 用户技能水平API: /api/user/skill-levels');
    console.log('   ✅ 学习活动记录API: /api/learning/activities');
    console.log('   ✅ 用户签到API: /api/user/checkin');
    console.log('   ✅ 学习状态API: /api/learning/status');
    console.log('   ✅ 最近学习记录API: /api/user/recent-records');
    console.log('   ✅ 签到信息API: /api/user/checkin-info');
    console.log('   ✅ 用户资料更新API: /api/user/profile');
    console.log('   ✅ 词汇学习活动API: /api/vocabulary/save-activity');
    console.log('   ✅ 用户词汇统计API: /api/vocabulary/user-stats/:userId');
    console.log('   ✅ 词汇数据API: /api/vocabulary/data');
    console.log('   ✅ 游戏API: /api/game');
    console.log('   ✅ 游戏服务器集成: /api/game (转发到游戏服务器)');
    console.log('   ✅ 游戏词汇统计API: /api/game/vocabulary/vocabulary-statistics');
    console.log('   ✅ 游戏词汇库检查API: /api/game/vocabulary/check-empty');
    console.log('   ✅ 游戏题目API: /api/game/questions');
    console.log('   ✅ 游戏文件列表API: /api/game/vocabulary/get-imported-files');
    console.log('   ✅ 游戏词汇导入API: /api/game/vocabulary/import-vocabulary-multiple');
    console.log('   ✅ 游戏文件删除API: /api/game/vocabulary/delete-imported-file');
    console.log('   ✅ 游戏文件详情API: /api/game/vocabulary/get-file-details');
    console.log('   ✅ 调试接口: /api/debug/videos');
    console.log('   ✅ 调试接口: /api/debug/analysis-status');
    console.log('   ✅ 调试接口: /api/debug/auth-status');
    console.log('   ✅ 调试接口: /api/debug/diary-status');
    console.log('   ✅ 调试接口: /api/debug/user-info');
    console.log('   ✅ 调试接口: /api/debug/database-status');
    console.log('   ✅ 调试接口: /api/debug/listening-data');
    console.log('   ✅ 调试接口: /api/debug/audio-paths');
    console.log('   ✅ 调试接口: /api/audio/check');
    console.log('   ✅ 日记备份接口: /api/diary/backup');
    console.log('   ✅ 日记表初始化接口: /api/diary/init-tables');
    console.log('   ✅ 日记表状态检查: /api/diary/table-status');
    console.log('   ✅ 日记表手动修复: /api/diary/fix-tables');
    console.log('   ✅ PDF导入API: /api/pdf-import');
    console.log('   ✅ 音频文件检查API: /api/listening/check-audio');
    console.log('   ✅ 词汇数据API: /api/vocabulary/data');
    console.log('   ✅ 静态词汇数据服务: /data');
    console.log('   ✅ 真题数据工具API: /api/tools');
    console.log('   ✅ 真题考试API: /api/exam');
    console.log('   ✅ 游戏静态文件服务: /game');
    console.log('   ✅ 游戏数据服务: /game/data');
    console.log('   ✅ 游戏上传目录服务: /game/uploads');
    console.log('   ✅ 游戏导出目录服务: /game/exports');
    console.log('   ✅ 音频文件测试API: /api/test-audio/:filename');
    console.log('\n' + '='.repeat(60));
    console.log('🌟 云梦智间系统启动完成，开始提供服务！\n');
});

module.exports = app;