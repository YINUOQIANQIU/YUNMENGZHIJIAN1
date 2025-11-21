// [file name]: js/ai-api-service.js
class AIApiService {
    constructor() {
        this.baseURL = window.location.origin;
        this.timeout = 30000;
        this.preferredService = 'bot'; // 默认优先使用扣子服务
    }

    // 发送聊天消息 - 增强版本
    async sendChatMessage(messageData) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            // 添加服务偏好参数
            const enhancedData = {
                ...messageData,
                preferredService: this.preferredService
            };

            const response = await fetch(`${this.baseURL}/api/ai/chat/message`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(enhancedData),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('请求超时，请稍后重试');
            }
            throw error;
        }
    }

    // 语音转文本
    async speechToText(audioFile) {
        try {
            const formData = new FormData();
            formData.append('audio', audioFile);

            const response = await fetch(`${this.baseURL}/api/ai/enhanced/speech-to-text`, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders()
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('语音转文本失败:', error);
            throw error;
        }
    }

    // 文档OCR识别
    async documentOCR(file, options = {}) {
        try {
            const formData = new FormData();
            formData.append('document', file);
            formData.append('options', JSON.stringify(options));

            const response = await fetch(`${this.baseURL}/api/ai/enhanced/document-ocr`, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders()
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                console.log('✅ 文档OCR成功');
            } else {
                console.error('❌ 文档OCR失败:', result.message);
            }

            return result;

        } catch (error) {
            console.error('❌ 文档OCR API调用失败:', error);
            return {
                success: false,
                message: '文档识别服务暂时不可用: ' + error.message
            };
        }
    }

    // 图像识别
    async imageRecognition(file) {
        try {
            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch(`${this.baseURL}/api/ai/enhanced/image-recognition`, {
                method: 'POST',
                headers: {
                    ...this.getAuthHeaders()
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('图像识别失败:', error);
            throw error;
        }
    }

    // 获取聊天历史
    async getChatHistory(sessionId = 'default', limit = 50) {
        try {
            const response = await fetch(
                `${this.baseURL}/api/ai/chat/history?sessionId=${sessionId}&limit=${limit}`,
                {
                    headers: this.getHeaders()
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('获取聊天历史失败:', error);
            throw error;
        }
    }

    // 获取会话列表
    async getSessions() {
        try {
            const response = await fetch(`${this.baseURL}/api/ai/chat/sessions`, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('获取会话列表失败:', error);
            throw error;
        }
    }

    // 创建新会话
    async createSession(sessionData) {
        try {
            const response = await fetch(`${this.baseURL}/api/ai/chat/sessions/new`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(sessionData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('创建会话失败:', error);
            throw error;
        }
    }

    // 获取请求头
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        // 添加认证头
        if (window.unifiedAuthManager) {
            const authHeaders = window.unifiedAuthManager.getAuthHeaders();
            Object.assign(headers, authHeaders);
        }

        return headers;
    }

    // 获取认证头（用于FormData）
    getAuthHeaders() {
        const headers = {};

        if (window.unifiedAuthManager) {
            const authHeaders = window.unifiedAuthManager.getAuthHeaders();
            // 移除Content-Type，让浏览器自动设置
            Object.keys(authHeaders).forEach(key => {
                if (key.toLowerCase() !== 'content-type') {
                    headers[key] = authHeaders[key];
                }
            });
        }

        return headers;
    }

    // 检查服务状态
    async checkServiceStatus() {
        try {
            const response = await fetch(`${this.baseURL}/api/ai/enhanced/service-status`, {
                headers: this.getHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                return result.success ? result.data : null;
            }
            return null;
        } catch (error) {
            console.error('检查服务状态失败:', error);
            return null;
        }
    }

    // 获取使用情况
    async getUsageStats() {
        try {
            const response = await fetch(`${this.baseURL}/api/ai/usage`, {
                headers: this.getHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                return result.success ? result.data : null;
            }
            return null;
        } catch (error) {
            console.error('获取使用情况失败:', error);
            return null;
        }
    }

    // 新增：获取AI服务状态
    async getAIServiceStatus() {
        try {
            const response = await fetch(`${this.baseURL}/api/ai/chat/service-status`, {
                headers: this.getHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                return result.success ? result.data : null;
            }
            return null;
        } catch (error) {
            console.error('获取AI服务状态失败:', error);
            return null;
        }
    }

    // 新增：设置首选AI服务
    setPreferredService(service) {
        if (['bot', 'zhipu', 'auto'].includes(service)) {
            this.preferredService = service;
            console.log(`AI服务偏好设置为: ${service}`);
        }
    }

    // 新增：获取当前服务偏好
    getPreferredService() {
        return this.preferredService;
    }

    // 增强语音识别API
    async enhancedSpeechToText(audioBlob, options = {}) {
        try {
            console.log('🔊 调用增强语音识别API');
            
            const formData = new FormData();
            formData.append('audio', audioBlob, `recording_${Date.now()}.wav`);
            formData.append('options', JSON.stringify(options));

            const response = await fetch(`${this.baseURL}/api/ai/enhanced/speech-to-text`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                console.log('✅ 语音识别成功:', { 
                    textLength: result.data.text.length,
                    confidence: result.data.confidence 
                });
            } else {
                console.error('❌ 语音识别失败:', result.message);
            }

            return result;

        } catch (error) {
            console.error('❌ 语音识别API调用失败:', error);
            return {
                success: false,
                message: '语音识别服务暂时不可用: ' + error.message
            };
        }
    }

    // 增强图片识别API - 添加前端重试
    async enhancedImageRecognition(imageBlob, options = {}) {
        let retryCount = 0;
        const maxRetries = 2;
        
        const attemptUpload = async () => {
            try {
                console.log(`🖼️ 前端图片识别尝试 ${retryCount + 1}/${maxRetries + 1}`);
                
                const formData = new FormData();
                formData.append('image', imageBlob, `image_${Date.now()}.jpg`);
                formData.append('options', JSON.stringify({
                    ...options,
                    attempt: retryCount + 1
                }));

                const response = await fetch(`${this.baseURL}/api/ai/enhanced/image-recognition`, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                
                if (result.success) {
                    console.log('✅ 图片识别成功:', { 
                        service: result.data.service,
                        objectsCount: result.data.primaryObjects.length 
                    });
                } else if (retryCount < maxRetries && result.fallbackAvailable) {
                    // 如果服务建议重试且还有重试次数
                    throw new Error('Service suggested retry');
                }

                return result;

            } catch (error) {
                console.error(`❌ 前端图片识别尝试 ${retryCount + 1} 失败:`, error);
                
                if (retryCount < maxRetries) {
                    retryCount++;
                    console.log(`🔄 前端准备第 ${retryCount + 1} 次重试...`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                    return attemptUpload();
                }
                
                throw error;
            }
        };

        try {
            return await attemptUpload();
        } catch (error) {
            console.error('💥 所有前端图片识别尝试均失败:', error);
            return {
                success: false,
                message: '图片上传处理失败: ' + error.message,
                suggestion: '请检查网络连接或尝试使用其他图片'
            };
        }
    }

    // 统一文件上传API - 已修改：添加回退逻辑
    async enhancedFileUpload(file, options = {}) {
        try {
            console.log('📤 调用文件上传处理:', { 
                name: file.name, 
                type: file.type, 
                size: file.size 
            });

            // 根据文件类型选择不同的处理方式
            if (file.type.startsWith('image/')) {
                return await this.enhancedImageRecognition(file, options);
            } else if (file.type.startsWith('audio/')) {
                return await this.enhancedSpeechToText(file, options);
            } else {
                // 文档文件使用OCR
                return await this.documentOCR(file, options);
            }

        } catch (error) {
            console.error('❌ 文件上传处理失败:', error);
            return {
                success: false,
                message: '文件处理服务暂时不可用: ' + error.message
            };
        }
    }

    // 实时语音识别（流式）
    async startStreamingSpeechRecognition(onText, onError, options = {}) {
        try {
            // 获取用户媒体权限
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                } 
            });

            const audioContext = new AudioContext({ sampleRate: 16000 });
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);

            let audioBuffer = [];
            let isRecording = true;

            processor.onaudioprocess = (event) => {
                if (!isRecording) return;
                
                const inputData = event.inputBuffer.getChannelData(0);
                audioBuffer.push(new Float32Array(inputData));

                // 每2秒发送一次数据
                if (audioBuffer.length >= 4) { // 约2秒数据
                    this.processAudioChunk(audioBuffer, onText, onError);
                    audioBuffer = [];
                }
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

            return {
                stop: () => {
                    isRecording = false;
                    stream.getTracks().forEach(track => track.stop());
                    processor.disconnect();
                    source.disconnect();
                    audioContext.close();
                }
            };

        } catch (error) {
            console.error('❌ 实时语音识别启动失败:', error);
            onError('无法访问麦克风: ' + error.message);
            return null;
        }
    }

    // 处理音频片段
    async processAudioChunk(audioBuffer, onText, onError) {
        try {
            // 将Float32Array转换为WAV格式
            const wavBuffer = this.floatToWav(audioBuffer.flat());
            const blob = new Blob([wavBuffer], { type: 'audio/wav' });

            const result = await this.enhancedSpeechToText(blob);
            if (result.success && result.data.text.trim()) {
                onText(result.data.text);
            }

        } catch (error) {
            console.error('❌ 音频处理失败:', error);
            onError('音频处理错误: ' + error.message);
        }
    }

    // Float32Array转WAV格式
    floatToWav(input) {
        const buffer = new ArrayBuffer(44 + input.length * 2);
        const view = new DataView(buffer);
        
        // WAV头部
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + input.length * 2, true);
        this.writeString(view, 8, 'WAVE');
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, 16000, true);
        view.setUint32(28, 16000 * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        this.writeString(view, 36, 'data');
        view.setUint32(40, input.length * 2, true);
        
        // PCM数据
        let offset = 44;
        for (let i = 0; i < input.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, input[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        
        return buffer;
    }

    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    // 获取支持的文件类型
    getSupportedFileTypes() {
        return {
            images: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
            documents: ['.txt', '.pdf', '.doc', '.docx'],
            audio: ['.mp3', '.wav', '.m4a', '.aac', '.ogg'],
            all: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.txt', '.pdf', '.doc', '.docx', '.mp3', '.wav', '.m4a', '.aac', '.ogg']
        };
    }

    // 检查文件是否支持
    isFileSupported(file) {
        const supportedTypes = this.getSupportedFileTypes().all;
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        return supportedTypes.includes(extension);
    }

    // 获取文件大小限制
    getFileSizeLimit() {
        return 10 * 1024 * 1024; // 10MB
    }
}

// 创建全局API服务实例
window.AIApiService = AIApiService;