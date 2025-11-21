// [file name]: js/ai-voice-service.js
class AIVoiceService {
    constructor() {
        this.baseURL = window.location.origin;
        this.isSpeaking = false;
        this.isPaused = false;
        this.currentAudio = null;
        this.isInitialized = false;
        this.initPromise = null;
        this.currentResolve = null;
        this.currentReject = null;
        this.speechQueue = [];
        this.isProcessingQueue = false;
        this.currentMessageId = null;
        this.currentAudioUrl = null; // 新增：存储当前音频URL
        
        // 防重复播放机制
        this.lastPlayedText = null;
        this.lastPlayedTime = 0;
        this.playDebounceTimer = null;
        
        this.playbackCallbacks = {
            onStart: null,
            onPause: null,
            onResume: null,
            onStop: null,
            onEnd: null,
            onError: null
        };
        
        // 立即开始初始化
        this.init();
    }

    async init() {
        if (this.initPromise) {
            return this.initPromise;
        }
        
        this.initPromise = new Promise(async (resolve) => {
            try {
                console.log('初始化百度AI语音服务...');
                
                // 检查服务状态
                const status = await this.checkServiceStatus();
                if (status) {
                    console.log('语音服务状态正常:', status);
                }
                
                this.isInitialized = true;
                console.log('语音服务初始化完成 - 使用百度TTS');
                resolve(true);
            } catch (error) {
                console.error('语音服务初始化失败:', error);
                this.isInitialized = false;
                resolve(false);
            }
        });
        
        return this.initPromise;
    }

    // 检查服务状态
    async checkServiceStatus() {
        try {
            const response = await fetch(`${this.baseURL}/api/ai/enhanced/service-status`, {
                headers: this.getAuthHeaders()
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

    // 增强语音播放方法 - 支持御姐音和完整播放控制，添加防重复机制
    async speak(text, options = {}) {
        // 防重复检查：如果正在播放相同内容，直接返回
        if (this.isDuplicatePlayback(text, options.messageId)) {
            console.log('重复播放请求，已忽略');
            if (options.onError) options.onError('重复播放请求');
            return Promise.reject(new Error('重复播放请求'));
        }

        // 清除之前的防抖计时器
        if (this.playDebounceTimer) {
            clearTimeout(this.playDebounceTimer);
            this.playDebounceTimer = null;
        }

        if (!this.isInitialized) {
            await this.init();
        }

        return new Promise(async (resolve, reject) => {
            try {
                // 如果正在播放，先完全停止当前播放
                if (this.isSpeaking) {
                    this.stop();
                    // 添加短暂延迟确保完全停止
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                if (!text || text.trim() === '') {
                    reject(new Error('文本内容为空'));
                    return;
                }

                const cleanText = this.cleanTextForSpeech(text);
                
                if (cleanText.length === 0) {
                    reject(new Error('清洗后文本为空'));
                    return;
                }

                console.log('准备合成语音:', cleanText.substring(0, 100) + '...');

                // 获取语音设置，默认使用御姐音参数
                const speechSettings = JSON.parse(localStorage.getItem('speech-settings') || '{}');
                const isSisterVoice = speechSettings.voice === '5118' || !speechSettings.voice;
                
                // 调用百度TTS服务 - 使用御姐音参数
                const response = await fetch(`${this.baseURL}/api/ai/enhanced/text-to-speech`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...this.getAuthHeaders()
                    },
                    body: JSON.stringify({
                        text: cleanText,
                        voice: isSisterVoice ? '5118' : (speechSettings.voice || '0'),
                        speed: isSisterVoice ? 5 : (speechSettings.rate || 4),
                        pitch: isSisterVoice ? 8 : (speechSettings.pitch || 6),
                        volume: isSisterVoice ? 9 : (speechSettings.volume || 8)
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP错误: ${response.status}`);
                }

                const result = await response.json();

                if (!result.success) {
                    throw new Error(result.message || '语音合成失败');
                }

                if (!result.data.audio) {
                    throw new Error('语音合成返回空数据');
                }

                // 存储播放记录
                this.lastPlayedText = text;
                this.lastPlayedTime = Date.now();
                this.currentMessageId = options.messageId;

                // 释放之前的音频URL
                this.releaseAudioUrl();

                // 将base64音频数据转换为Blob
                const audioBlob = this.base64ToBlob(result.data.audio, `audio/${result.data.format || 'mp3'}`);
                const audioUrl = URL.createObjectURL(audioBlob);
                this.currentAudioUrl = audioUrl;

                // 创建Audio对象播放
                const audio = new Audio(audioUrl);
                audio.volume = options.volume || 1.0;

                // 存储当前Promise的resolve/reject
                this.currentResolve = resolve;
                this.currentReject = reject;

                // 设置一次性事件监听器
                const onPlay = () => {
                    this.isSpeaking = true;
                    this.isPaused = false;
                    console.log('语音开始播放');
                    if (options.onStart) options.onStart();
                    if (this.playbackCallbacks.onStart) this.playbackCallbacks.onStart(this.currentMessageId);
                    audio.removeEventListener('play', onPlay);
                };

                const onPause = () => {
                    this.isPaused = true;
                    console.log('语音暂停');
                    if (this.playbackCallbacks.onPause) this.playbackCallbacks.onPause(this.currentMessageId);
                };

                const onEnded = () => {
                    this.isSpeaking = false;
                    this.isPaused = false;
                    this.currentAudio = null;
                    this.currentMessageId = null;
                    console.log('语音播放结束');
                    this.releaseAudioUrl();
                    if (options.onEnd) options.onEnd();
                    if (this.playbackCallbacks.onEnd) this.playbackCallbacks.onEnd(this.currentMessageId);
                    if (this.currentResolve) {
                        this.currentResolve();
                        this.currentResolve = null;
                    }
                    // 清理事件监听器
                    audio.removeEventListener('pause', onPause);
                    audio.removeEventListener('ended', onEnded);
                    audio.removeEventListener('error', onError);
                };

                const onError = (event) => {
                    this.isSpeaking = false;
                    this.isPaused = false;
                    this.currentAudio = null;
                    this.currentMessageId = null;
                    console.error('音频播放错误:', event);
                    this.releaseAudioUrl();
                    const errorMsg = this.getAudioError(audio.error);
                    if (options.onError) options.onError(errorMsg);
                    if (this.playbackCallbacks.onError) this.playbackCallbacks.onError(this.currentMessageId, errorMsg);
                    if (this.currentReject) {
                        this.currentReject(new Error(errorMsg));
                        this.currentReject = null;
                    }
                    // 清理事件监听器
                    audio.removeEventListener('play', onPlay);
                    audio.removeEventListener('pause', onPause);
                    audio.removeEventListener('ended', onEnded);
                    audio.removeEventListener('error', onError);
                };

                // 绑定事件监听器
                audio.addEventListener('play', onPlay);
                audio.addEventListener('pause', onPause);
                audio.addEventListener('ended', onEnded);
                audio.addEventListener('error', onError);

                this.currentAudio = audio;
                
                // 开始播放
                try {
                    await audio.play();
                } catch (playError) {
                    console.error('播放失败:', playError);
                    this.releaseAudioUrl();
                    reject(new Error('播放失败: ' + playError.message));
                }

            } catch (error) {
                console.error('语音合成异常:', error);
                reject(error);
            }
        });
    }

    // 新增：防重复播放检查
    isDuplicatePlayback(text, messageId) {
        // 相同消息ID且正在播放
        if (this.isSpeaking && this.currentMessageId === messageId) {
            return true;
        }
        
        // 相同文本内容在短时间内重复播放
        const timeSinceLastPlay = Date.now() - this.lastPlayedTime;
        if (text === this.lastPlayedText && timeSinceLastPlay < 2000) {
            return true;
        }
        
        return false;
    }

    // 新增：释放音频URL资源
    releaseAudioUrl() {
        if (this.currentAudioUrl) {
            URL.revokeObjectURL(this.currentAudioUrl);
            this.currentAudioUrl = null;
        }
    }

    // 暂停语音播放
    pause() {
        if (this.currentAudio && !this.currentAudio.paused) {
            this.currentAudio.pause();
            this.isPaused = true;
            console.log('语音已暂停');
            if (this.playbackCallbacks.onPause) this.playbackCallbacks.onPause(this.currentMessageId);
            return true;
        }
        return false;
    }

    // 继续语音播放
    resume() {
        if (this.currentAudio && this.currentAudio.paused) {
            this.currentAudio.play().then(() => {
                this.isPaused = false;
                console.log('语音继续播放');
                if (this.playbackCallbacks.onResume) this.playbackCallbacks.onResume(this.currentMessageId);
            }).catch(error => {
                console.error('继续播放失败:', error);
            });
            return true;
        }
        return false;
    }

    // 增强停止语音播放方法
    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
        
        this.releaseAudioUrl();
        
        this.isSpeaking = false;
        this.isPaused = false;
        
        if (this.playbackCallbacks.onStop) {
            this.playbackCallbacks.onStop(this.currentMessageId);
        }
        
        // 清理未完成的Promise
        if (this.currentReject) {
            this.currentReject(new Error('语音播放被停止'));
            this.currentReject = null;
        }
        
        this.currentMessageId = null;
        
        // 清除防抖计时器
        if (this.playDebounceTimer) {
            clearTimeout(this.playDebounceTimer);
            this.playDebounceTimer = null;
        }
    }

    // 获取当前播放的消息ID
    getCurrentMessageId() {
        return this.currentMessageId;
    }

    // 设置播放回调
    setPlaybackCallbacks(callbacks) {
        this.playbackCallbacks = { ...this.playbackCallbacks, ...callbacks };
    }

    // 辅助方法：base64转Blob
    base64ToBlob(base64, mimeType) {
        try {
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            return new Blob([byteArray], { type: mimeType });
        } catch (error) {
            console.error('Base64转换失败:', error);
            throw new Error('音频数据格式错误');
        }
    }

    // 辅助方法：获取音频错误信息
    getAudioError(error) {
        if (!error) return '未知音频错误';
        
        switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
                return '音频播放被中止';
            case error.MEDIA_ERR_NETWORK:
                return '音频网络错误';
            case error.MEDIA_ERR_DECODE:
                return '音频解码错误';
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                return '音频格式不支持';
            default:
                return `音频错误: ${error.message}`;
        }
    }

    // 增强文本清洗方法
    cleanTextForSpeech(text) {
        if (!text) return '';

        let cleanText = text
            // 移除Markdown格式
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/_(.*?)_/g, '$1')
            .replace(/~(.*?)~/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/```[\s\S]*?```/g, (match) => {
                return '代码内容：' + match.replace(/```[\w]*\n?/g, '').replace(/```/g, '');
            })
            // 移除链接和HTML标签
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/<[^>]*>/g, '')
            // 特殊符号替换为文字描述或直接移除
            .replace(/#/g, '井号')
            .replace(/\*/g, '')
            .replace(/_/g, '')
            .replace(/~/g, '')
            .replace(/`/g, '')
            .replace(/@/g, '')
            .replace(/\$/g, '')
            .replace(/%/g, '百分之')
            .replace(/\^/g, '')
            .replace(/&/g, '和')
            .replace(/\|/g, '或')
            .replace(/\\/g, '')
            .replace(/\//g, '')
            .replace(/=/g, '等于')
            .replace(/\+/g, '加')
            .replace(/-/g, '减')
            .replace(/</g, '小于')
            .replace(/>/g, '大于')
            // 处理标点符号
            .replace(/\.{3,}/g, '。')
            .replace(/\?/g, '？')
            .replace(/!/g, '！')
            .replace(/,/g, '，')
            .replace(/;/g, '；')
            .replace(/:/g, '：')
            .replace(/"/g, '')
            .replace(/'/g, '')
            .replace(/\(/g, '')
            .replace(/\)/g, '')
            .replace(/\[/g, '')
            .replace(/\]/g, '')
            .replace(/\{/g, '')
            .replace(/\}/g, '')
            // 处理重复空格和换行
            .replace(/\s+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        // 进一步处理：如果文本仍然包含特殊字符，直接过滤掉
        cleanText = cleanText.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s，。！？：；""''()（）【】《》]/g, '');

        // 内容安全过滤
        cleanText = this.filterSensitiveContent(cleanText);

        console.log('清洗后的文本:', cleanText);
        return cleanText;
    }

    // 内容安全过滤
    filterSensitiveContent(text) {
        const sensitiveWords = ['暴力', '色情', '政治敏感词'];
        sensitiveWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            text = text.replace(regex, '***');
        });
        return text;
    }

    // 获取认证头
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (window.unifiedAuthManager) {
            const authHeaders = window.unifiedAuthManager.getAuthHeaders();
            Object.keys(authHeaders).forEach(key => {
                headers[key] = authHeaders[key];
            });
        }
        return headers;
    }

    // 语音服务状态检查
    isSupported() {
        return true;
    }

    // 获取语音状态
    getStatus() {
        return {
            isSpeaking: this.isSpeaking,
            isPaused: this.isPaused,
            isSupported: this.isSupported(),
            isInitialized: this.isInitialized,
            availableVoices: 5,
            preferredVoice: '御姐音',
            service: '百度AI TTS',
            currentMessageId: this.currentMessageId
        };
    }

    // 获取语音列表（百度TTS）- 添加御姐音选项
    getVoices() {
        return [
            {
                id: '5118',
                name: '御姐音',
                lang: 'zh-CN',
                gender: 'female',
                service: 'baidu',
                description: '成熟优雅的御姐音色，声音富有磁性'
            },
            {
                id: '0',
                name: '标准女声',
                lang: 'zh-CN',
                gender: 'female',
                service: 'baidu',
                description: '清晰自然的成熟女声'
            },
            {
                id: '1', 
                name: '标准男声',
                lang: 'zh-CN',
                gender: 'male',
                service: 'baidu',
                description: '沉稳的男声'
            },
            {
                id: '3',
                name: '度逍遥',
                lang: 'zh-CN', 
                gender: 'male',
                service: 'baidu',
                description: '磁性男声'
            },
            {
                id: '4',
                name: '度丫丫',
                lang: 'zh-CN',
                gender: 'female',
                service: 'baidu',
                description: '可爱女声'
            }
        ];
    }

    // 设置语音
    setVoice(voiceId) {
        const voices = this.getVoices();
        return voices.some(voice => voice.id === voiceId);
    }

    // 获取当前播放时间
    getCurrentTime() {
        return this.currentAudio ? this.currentAudio.currentTime : 0;
    }

    // 获取总时长
    getDuration() {
        return this.currentAudio ? this.currentAudio.duration : 0;
    }

    // 跳转到指定时间
    seekTo(time) {
        if (this.currentAudio && time >= 0 && time <= this.getDuration()) {
            this.currentAudio.currentTime = time;
            return true;
        }
        return false;
    }

    // 设置播放速度
    setPlaybackRate(rate) {
        if (this.currentAudio && rate >= 0.5 && rate <= 2.0) {
            this.currentAudio.playbackRate = rate;
            return true;
        }
        return false;
    }

    // 获取播放速度
    getPlaybackRate() {
        return this.currentAudio ? this.currentAudio.playbackRate : 1.0;
    }
}

// 创建全局语音服务实例
window.AIVoiceService = AIVoiceService;