// [file name]: server_modules/routes/ai-enhanced.js
const express = require('express');
const router = express.Router();
const AIService = require('../services/ai-service');
const authMiddleware = require('../auth-middleware');
const multer = require('multer');
const path = require('path');

// 配置文件上传
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'audio/mpeg',
            'audio/wav',
            'audio/mp3',
            'audio/mp4',
            'audio/aac',
            'audio/ogg',
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/jpg',
            'image/gif',
            'image/bmp',
            'image/webp',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件类型'), false);
        }
    }
});

// 百度文本转语音路由 - 优化版本
router.post('/text-to-speech', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const { text, voice = '5118', speed = 4, pitch = 6, volume = 8 } = req.body;

        if (!text || text.trim() === '') {
            return res.json({
                success: false,
                message: '文本内容不能为空'
            });
        }

        console.log('收到TTS请求:', { 
            text: text.substring(0, 100) + '...', 
            voice, 
            speed, 
            pitch,
            volume,
            length: text.length 
        });

        // 直接调用AIService的TTS方法，使用更成熟的语音参数
        const result = await AIService.textToSpeech(text, { 
            voice: voice,
            speed: parseInt(speed),
            pitch: parseInt(pitch),
            volume: parseInt(volume)
        });

        if (result.success) {
            res.json({
                success: true,
                data: {
                    audio: result.audio,
                    format: result.format,
                    text: text,
                    voice: voice === '5118' ? '御姐音' : '标准女声',
                    settings: {
                        speed: speed,
                        pitch: pitch,
                        volume: volume
                    }
                }
            });
        } else {
            res.json({
                success: false,
                message: result.message || '语音合成失败'
            });
        }

    } catch (error) {
        console.error('文本转语音错误:', error);
        res.json({
            success: false,
            message: '文本转语音服务暂时不可用: ' + error.message
        });
    }
});

// 增强语音转文本 - 支持多种格式和实时处理
router.post('/speech-to-text', authMiddleware.authenticateToken, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.json({
                success: false,
                message: '请上传音频文件'
            });
        }

        console.log('处理语音识别请求:', {
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        const options = req.body.options ? JSON.parse(req.body.options) : {};
        
        // 使用增强的语音识别方法
        const result = await AIService.enhancedSpeechToText(req.file.buffer, {
            ...options,
            contentType: req.file.mimetype
        });

        if (result.success) {
            res.json({
                success: true,
                data: {
                    text: result.text,
                    confidence: result.confidence,
                    words: result.words,
                    duration: result.duration,
                    language: result.language
                }
            });
        } else {
            res.json({
                success: false,
                message: result.message
            });
        }

    } catch (error) {
        console.error('语音转文本错误:', error);
        res.json({
            success: false,
            message: '语音识别失败: ' + error.message
        });
    }
});

// 增强文档识别 - 支持多种文档格式和图片文件智能处理
router.post('/document-ocr', authMiddleware.authenticateToken, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.json({
                success: false,
                message: '请上传文档文件'
            });
        }

        console.log('处理文档识别请求:', {
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        const options = req.body.options ? JSON.parse(req.body.options) : {};

        // 检查文件类型，如果是图片格式，使用图片识别而不是OCR
        if (req.file.mimetype.startsWith('image/')) {
            console.log('🖼️ 检测到图片文件，使用图片识别API');
            const imageResult = await AIService.enhancedImageRecognition(req.file.buffer, {
                ...options,
                forceJpeg: true // 强制转换为JPEG
            });
            
            if (imageResult.success) {
                return res.json({
                    success: true,
                    data: {
                        text: imageResult.description || '图片识别完成',
                        fileType: 'image',
                        metadata: {
                            primaryObjects: imageResult.primaryObjects,
                            analysis: imageResult.analysis,
                            description: imageResult.description
                        },
                        summary: {
                            objectCount: imageResult.primaryObjects?.length || 0,
                            description: imageResult.description
                        }
                    }
                });
            } else {
                throw new Error(imageResult.message);
            }
        }
        
        // 使用增强的文档处理方法
        const result = await AIService.enhancedDocumentProcessing(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            options
        );

        if (result.success) {
            res.json({
                success: true,
                data: {
                    text: result.text,
                    fileType: result.fileType,
                    metadata: result.metadata,
                    summary: result.summary
                }
            });
        } else {
            res.json({
                success: false,
                message: result.message
            });
        }

    } catch (error) {
        console.error('文档识别错误:', error);
        res.json({
            success: false,
            message: '文档识别失败: ' + error.message,
            suggestion: '请尝试使用更清晰的图片或支持的文件格式'
        });
    }
});

// 增强图像识别路由 - 添加重试机制
router.post('/image-recognition', authMiddleware.authenticateToken, upload.single('image'), async (req, res) => {
    let retryCount = 0;
    const maxRetries = 2;
    
    const attemptRecognition = async () => {
        try {
            if (!req.file) {
                return {
                    success: false,
                    message: '请上传图片文件'
                };
            }

            console.log(`🖼️ 图片识别尝试 ${retryCount + 1}/${maxRetries + 1}:`, {
                originalname: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            });

            const options = req.body.options ? JSON.parse(req.body.options) : {};
            
            // 使用增强的图片识别方法（带多级回退）
            const result = await AIService.enhancedImageRecognition(req.file.buffer, options);

            if (result.success) {
                console.log('✅ 图片识别成功:', {
                    service: result.service,
                    objectsCount: result.primaryObjects?.length
                });
            }

            return result;

        } catch (error) {
            console.error(`❌ 图片识别尝试 ${retryCount + 1} 失败:`, error);
            
            if (retryCount < maxRetries) {
                retryCount++;
                console.log(`🔄 准备第 ${retryCount + 1} 次重试...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                return attemptRecognition();
            }
            
            throw error;
        }
    };

    try {
        const result = await attemptRecognition();

        if (result.success) {
            res.json({
                success: true,
                data: {
                    result: result.result,
                    primaryObjects: result.primaryObjects,
                    description: result.description,
                    tags: result.tags,
                    analysis: result.analysis,
                    log_id: result.log_id,
                    service: result.service,
                    source: result.source
                },
                metadata: {
                    retryCount: retryCount,
                    finalService: result.service
                }
            });
        } else {
            res.json({
                success: false,
                message: result.message,
                suggestion: result.suggestion,
                details: {
                    fileSize: req.file.size,
                    mimeType: req.file.mimetype,
                    fileName: req.file.originalname,
                    retryCount: retryCount
                },
                fallbackAvailable: result.fallbackAvailable
            });
        }

    } catch (error) {
        console.error('💥 所有图片识别尝试均失败:', error);
        res.json({
            success: false,
            message: '图片识别服务暂时不可用',
            suggestion: '请尝试使用JPEG或PNG格式的图片，或稍后重试',
            details: {
                error: error.message,
                fileName: req.file?.originalname,
                maxRetries: maxRetries
            },
            emergencyFallback: true
        });
    }
});

// 增强文件上传通用接口 - 统一处理所有文件类型
router.post('/upload-file', authMiddleware.authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.json({
                success: false,
                message: '请上传文件'
            });
        }

        const file = req.file;
        console.log('处理文件上传请求:', {
            originalname: file.originalname,
            size: file.size,
            mimetype: file.mimetype
        });

        const options = req.body.options ? JSON.parse(req.body.options) : {};
        
        // 使用统一的文件上传处理方法
        const result = await AIService.processFileUpload(
            file.buffer,
            file.originalname,
            file.mimetype,
            options
        );

        if (result.success) {
            res.json({
                success: true,
                data: {
                    fileName: result.data.fileName,
                    fileType: result.data.fileType,
                    content: result.data.content,
                    metadata: result.data.metadata,
                    processedAt: result.data.processedAt
                }
            });
        } else {
            res.json({
                success: false,
                message: result.message
            });
        }

    } catch (error) {
        console.error('文件上传处理错误:', error);
        res.json({
            success: false,
            message: '文件处理失败: ' + error.message
        });
    }
});

// 批量文件上传接口
router.post('/batch-upload', authMiddleware.authenticateToken, upload.array('files', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.json({
                success: false,
                message: '未接收到文件'
            });
        }

        console.log('处理批量文件上传请求:', {
            fileCount: req.files.length,
            files: req.files.map(f => ({
                name: f.originalname,
                size: f.size,
                type: f.mimetype
            }))
        });

        const options = req.body.options ? JSON.parse(req.body.options) : {};
        const results = [];

        for (const file of req.files) {
            const result = await AIService.processFileUpload(
                file.buffer,
                file.originalname,
                file.mimetype,
                options
            );
            results.push({
                fileName: file.originalname,
                ...result
            });
        }

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        res.json({
            success: true,
            data: {
                total: results.length,
                successful: successful,
                failed: failed,
                results: results
            },
            message: `成功处理 ${successful} 个文件，失败 ${failed} 个文件`
        });

    } catch (error) {
        console.error('批量文件上传错误:', error);
        res.json({
            success: false,
            message: '批量文件上传处理失败: ' + error.message
        });
    }
});

// 获取可用语音列表
router.get('/available-voices', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const voices = AIService.getAvailableVoices();
        res.json({
            success: true,
            data: voices
        });
    } catch (error) {
        console.error('获取语音列表错误:', error);
        res.json({
            success: false,
            message: '获取语音列表失败'
        });
    }
});

// 获取AI服务状态
router.get('/service-status', authMiddleware.authenticateToken, async (req, res) => {
    try {
        const status = AIService.getAIServiceStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('获取服务状态错误:', error);
        res.json({
            success: false,
            message: '获取服务状态失败'
        });
    }
});

// 获取支持的文件类型
router.get('/supported-file-types', authMiddleware.authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                images: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
                documents: ['.txt', '.pdf', '.doc', '.docx'],
                audio: ['.mp3', '.wav', '.m4a', '.aac', '.ogg'],
                all: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.txt', '.pdf', '.doc', '.docx', '.mp3', '.wav', '.m4a', '.aac', '.ogg'],
                maxSize: 10 * 1024 * 1024, // 10MB
                maxBatchCount: 5
            }
        });
    } catch (error) {
        console.error('获取支持文件类型错误:', error);
        res.json({
            success: false,
            message: '获取支持文件类型失败'
        });
    }
});

// 语音识别健康检查
router.get('/speech-health', authMiddleware.authenticateToken, async (req, res) => {
    try {
        // 简单的健康检查，测试语音服务是否可用
        const testText = "健康检查测试";
        const result = await AIService.textToSpeech(testText, { voice: '0' });
        
        res.json({
            success: true,
            data: {
                service: 'speech',
                status: result.success ? 'healthy' : 'unhealthy',
                message: result.success ? '语音服务运行正常' : '语音服务异常',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('语音健康检查错误:', error);
        res.json({
            success: false,
            message: '语音健康检查失败: ' + error.message
        });
    }
});

// 文件处理健康检查
router.get('/file-processing-health', authMiddleware.authenticateToken, async (req, res) => {
    try {
        // 创建测试文件缓冲区
        const testText = "这是一个健康检查测试文件。";
        const testBuffer = Buffer.from(testText, 'utf8');
        
        const result = await AIService.enhancedDocumentProcessing(
            testBuffer,
            'test.txt',
            'text/plain'
        );
        
        res.json({
            success: true,
            data: {
                service: 'file_processing',
                status: result.success ? 'healthy' : 'unhealthy',
                message: result.success ? '文件处理服务运行正常' : '文件处理服务异常',
                testResult: result.success ? '文件处理测试通过' : '文件处理测试失败',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('文件处理健康检查错误:', error);
        res.json({
            success: false,
            message: '文件处理健康检查失败: ' + error.message
        });
    }
});

module.exports = router;