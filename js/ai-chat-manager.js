// [file name]: js/ai-chat-manager.js
class AIChatManager {
    constructor() {
        this.currentSessionId = `session_${Date.now()}`;
        this.conversationHistory = [];
        this.assistantType = 'learning';
        this.userLimits = {
            dailyMessages: 10,
            maxMessageLength: 2000,
            canUseVoice: false,
            canUploadFiles: false
        };
        this.isProcessing = false;
        this.voiceService = null;
        this.isFirstResponse = true;
        this.currentSpeechMessageId = null;
        
        // 语音录制相关属性
        this.mediaRecorder = null;
        this.mediaStream = null;
        this.audioContext = null;
        this.audioChunks = [];
        this.recordingTimeout = null;
        
        this.init();
    }

    async init() {
        console.log('🚀 初始化AI聊天管理器...');
        
        try {
            // 等待认证系统就绪
            await this.waitForAuth();
            
            // 初始化语音服务
            await this.initVoiceService();
            
            // 初始化事件监听
            this.initEventListeners();
            
            // 更新用户限制
            this.updateUserLimits();
            
            // 加载历史记录
            await this.loadChatHistory();
            
            console.log('✅ AI聊天管理器初始化完成');
        } catch (error) {
            console.error('❌ AI聊天管理器初始化失败:', error);
            this.showMessage('AI服务初始化失败，请刷新页面重试', 'error');
        }
    }

    // 修复语音服务初始化
    async initVoiceService() {
        try {
            if (typeof AIVoiceService === 'undefined') {
                console.warn('⚠️ AIVoiceService未定义，等待加载...');
                // 等待一段时间让脚本加载
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                if (typeof AIVoiceService === 'undefined') {
                    console.error('❌ 语音服务加载失败');
                    return;
                }
            }
            
            this.voiceService = new AIVoiceService();
            await this.voiceService.init();
            
            console.log('✅ 语音服务初始化完成:', this.voiceService.getStatus());
        } catch (error) {
            console.error('❌ 语音服务初始化失败:', error);
            this.voiceService = null;
        }
    }

    // 增强语音播放方法 - 支持完整的播放控制
    async speakAIResponse(text, options = {}) {
        if (!this.voiceService) {
            console.warn('⚠️ 语音服务未初始化');
            return;
        }

        try {
            // 检查语音服务支持状态
            const status = this.voiceService.getStatus();
            if (!status.isSupported || !status.isInitialized) {
                console.warn('⚠️ 语音合成服务不可用');
                return;
            }

            // 检查用户设置是否开启语音
            const speechToggle = document.getElementById('speech-toggle');
            if (!speechToggle || !speechToggle.checked) {
                console.log('🔇 语音播放被用户关闭');
                return;
            }

            // 过滤文本
            const cleanText = this.filterSpeechText(text);
            if (!cleanText || cleanText.trim() === '') {
                console.warn('⚠️ 清洗后文本为空，跳过朗读');
                return;
            }

            console.log('🔊 准备使用百度TTS朗读文本:', cleanText.substring(0, 100) + '...');

            await this.voiceService.speak(cleanText, {
                messageId: options.messageId,
                onStart: () => {
                    this.showSpeechIndicator(options.messageId);
                    this.updateAllPlayButtons(options.messageId, 'playing');
                    if (options.onStart) options.onStart();
                },
                onEnd: () => {
                    this.hideSpeechIndicator();
                    this.updateAllPlayButtons(options.messageId, 'stopped');
                    if (options.onEnd) options.onEnd();
                },
                onError: (error) => {
                    console.error('❌ 语音播放失败:', error);
                    this.hideSpeechIndicator();
                    this.updateAllPlayButtons(options.messageId, 'stopped');
                    this.showMessage(`语音播放失败: ${error}`, 'error');
                    if (options.onError) options.onError(error);
                }
            });
        } catch (error) {
            console.error('❌ 语音播放错误:', error);
            this.hideSpeechIndicator();
            this.updateAllPlayButtons(options.messageId, 'stopped');
        }
    }

    // 更新所有播放按钮状态
    updateAllPlayButtons(messageId, state) {
        const playButtons = document.querySelectorAll('.speak-btn');
        playButtons.forEach(btn => {
            const btnMessageId = btn.closest('.message-container').id;
            if (btnMessageId === messageId) {
                this.updatePlayButtonState(btn, state);
            } else if (state === 'playing') {
                // 其他消息的按钮恢复为初始状态
                this.updatePlayButtonState(btn, 'stopped');
            }
        });
    }

    // 更新单个播放按钮状态
    updatePlayButtonState(button, state) {
        switch (state) {
            case 'playing':
                button.innerHTML = '<i class="fas fa-pause text-xs"></i>';
                button.classList.add('bg-yellow-500');
                button.classList.remove('bg-blue-500', 'bg-green-500');
                button.title = '暂停播放';
                break;
            case 'paused':
                button.innerHTML = '<i class="fas fa-play text-xs"></i>';
                button.classList.add('bg-green-500');
                button.classList.remove('bg-blue-500', 'bg-yellow-500');
                button.title = '继续播放';
                break;
            case 'stopped':
                button.innerHTML = '<i class="fas fa-volume-up text-xs"></i>';
                button.classList.add('bg-blue-500');
                button.classList.remove('bg-yellow-500', 'bg-green-500');
                button.title = '播放语音';
                break;
        }
    }

    // 获取播放按钮状态
    getPlayButtonState(button) {
        if (button.classList.contains('bg-yellow-500')) return 'playing';
        if (button.classList.contains('bg-green-500')) return 'paused';
        return 'stopped';
    }

    // 增强显示语音指示器
    showSpeechIndicator(messageId) {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            this.currentSpeechMessageId = messageId;
            
            let indicator = messageElement.querySelector('.speech-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'speech-indicator flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-100 rounded-lg border border-purple-200 mt-2';
                indicator.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="flex items-center gap-2 text-purple-700">
                            <i class="fas fa-volume-up text-purple-600"></i>
                            <span class="text-sm font-medium">AI语音朗读中</span>
                            <span class="text-xs text-purple-500 bg-purple-200 px-2 py-1 rounded-full">御姐音</span>
                        </div>
                        <div class="flex items-center gap-1 text-xs text-purple-600">
                            <i class="fas fa-info-circle"></i>
                            <span>成熟优雅 · 磁性声线</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button class="pause-speech-btn px-3 py-1 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2">
                            <i class="fas fa-pause"></i>
                            <span>暂停</span>
                        </button>
                        <button class="stop-speech-btn px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2">
                            <i class="fas fa-stop"></i>
                            <span>停止</span>
                        </button>
                    </div>
                `;
                
                const messageContent = messageElement.querySelector('.ai-response');
                if (messageContent) {
                    messageContent.parentNode.insertBefore(indicator, messageContent.nextSibling);
                    
                    // 绑定暂停/继续按钮事件
                    const pauseBtn = indicator.querySelector('.pause-speech-btn');
                    pauseBtn.addEventListener('click', () => {
                        this.toggleSpeechPlayback();
                    });
                    
                    // 绑定停止按钮事件
                    const stopBtn = indicator.querySelector('.stop-speech-btn');
                    stopBtn.addEventListener('click', () => {
                        this.stopSpeechPlayback();
                    });
                }
            }
        }
    }

    // 切换语音播放状态（暂停/继续）
    toggleSpeechPlayback() {
        if (!this.voiceService) return;
        
        const status = this.voiceService.getStatus();
        const pauseBtns = document.querySelectorAll('.pause-speech-btn');
        
        if (status.isPaused) {
            // 继续播放
            if (this.voiceService.resume()) {
                pauseBtns.forEach(btn => {
                    btn.innerHTML = '<i class="fas fa-pause"></i><span>暂停</span>';
                    btn.classList.remove('bg-green-500');
                    btn.classList.add('bg-purple-500');
                });
                console.log('▶️ 语音继续播放');
            }
        } else {
            // 暂停播放
            if (this.voiceService.pause()) {
                pauseBtns.forEach(btn => {
                    btn.innerHTML = '<i class="fas fa-play"></i><span>继续</span>';
                    btn.classList.remove('bg-purple-500');
                    btn.classList.add('bg-green-500');
                });
                console.log('⏸️ 语音已暂停');
            }
        }
        
        // 更新播放按钮状态
        if (status.currentMessageId) {
            this.updateAllPlayButtons(status.currentMessageId, status.isPaused ? 'paused' : 'playing');
        }
    }

    // 停止语音播放
    stopSpeechPlayback() {
        if (this.voiceService) {
            const currentMessageId = this.voiceService.getCurrentMessageId();
            this.voiceService.stop();
            this.hideSpeechIndicator();
            if (currentMessageId) {
                this.updateAllPlayButtons(currentMessageId, 'stopped');
            }
            console.log('⏹️ 语音播放已停止');
        }
    }

    // 隐藏语音播放指示器
    hideSpeechIndicator() {
        const indicators = document.querySelectorAll('.speech-indicator');
        indicators.forEach(indicator => {
            indicator.remove();
        });
        this.currentSpeechMessageId = null;
    }

    // 增强语音过滤方法
    filterSpeechText(text) {
        if (!text) return '';
        
        let cleanText = text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/```[\s\S]*?```/g, (match) => {
                const codeContent = match.replace(/```[\w]*\n?/g, '').replace(/```/g, '');
                return `代码内容：${codeContent}`;
            })
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/<[^>]*>/g, '')
            .replace(/#/g, '井号')
            .replace(/\*/g, '')
            .replace(/_/g, '')
            .replace(/~/g, '')
            .replace(/`/g, '')
            .replace(/\.{3,}/g, '。')
            .replace(/\?/g, '？')
            .replace(/!/g, '！')
            .replace(/,/g, '，')
            .replace(/;/g, '；')
            .replace(/:/g, '：')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/\s+/g, ' ')
            .trim();

        // 进一步清理特殊字符
        cleanText = cleanText.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s，。！？：；""''()（）【】《》]/g, '');

        if (cleanText.length > 500) {
            cleanText = cleanText.substring(0, 500) + '...';
        }

        return cleanText;
    }

    // 等待认证系统
    waitForAuth() {
        return new Promise((resolve) => {
            const checkAuth = () => {
                if (window.unifiedAuthManager && window.unifiedAuthManager.isInitialized) {
                    resolve();
                } else {
                    setTimeout(checkAuth, 100);
                }
            };
            checkAuth();
        });
    }

    // 初始化事件监听
    initEventListeners() {
        const userInput = document.getElementById('user-input');
        const sendBtn = document.getElementById('send-btn');
        const newChatBtn = document.getElementById('new-chat-btn');
        const imageBtn = document.getElementById('image-btn');

        sendBtn.addEventListener('click', () => this.handleSendMessage());
        
        newChatBtn.addEventListener('click', () => this.createNewChat());
        
        userInput.addEventListener('input', this.handleInputChange.bind(this));
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        document.getElementById('voice-btn').addEventListener('click', () => {
            this.handleVoiceInput();
        });
        
        document.getElementById('file-btn').addEventListener('click', () => {
            this.handleFileUpload();
        });
        
        imageBtn.addEventListener('click', () => {
            if (!this.userLimits.canUploadFiles) {
                this.showMessage('请登录后使用图片识别功能', 'error');
                return;
            }
            
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';
            
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.processImageRecognition(file);
                }
            });
            
            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
        });

        if (window.unifiedAuthManager) {
            window.unifiedAuthManager.addAuthListener((isLoggedIn, user) => {
                this.onAuthStateChange(isLoggedIn, user);
            });
        }

        // 助手类型切换按钮 - 使用一次性绑定避免重复
        const learningBtn = document.getElementById('learning-assistant-btn');
        const translationBtn = document.getElementById('translation-assistant-btn');
        const writingBtn = document.getElementById('writing-assistant-btn');

        // 移除之前的事件监听器（如果存在）
        if (learningBtn) {
            learningBtn.replaceWith(learningBtn.cloneNode(true));
        }
        if (translationBtn) {
            translationBtn.replaceWith(translationBtn.cloneNode(true));
        }
        if (writingBtn) {
            writingBtn.replaceWith(writingBtn.cloneNode(true));
        }

        // 重新绑定事件
        document.getElementById('learning-assistant-btn')?.addEventListener('click', () => this.switchAssistant('learning'));
        document.getElementById('translation-assistant-btn')?.addEventListener('click', () => this.switchAssistant('translation'));
        document.getElementById('writing-assistant-btn')?.addEventListener('click', () => this.switchAssistant('writing'));
    }

    // 处理认证状态变化
    onAuthStateChange(isLoggedIn, user) {
        console.log('🔐 AI聊天管理器收到认证状态变化:', { isLoggedIn, user });
        
        this.updateUserLimits();
        this.updateUIState();
        
        if (isLoggedIn) {
            this.loadChatHistory();
            this.showWelcomeMessage();
            
            const userStatus = document.getElementById('user-status-sidebar');
            if (userStatus) {
                userStatus.textContent = user.memberLevel === 'vip' ? 'VIP会员' : '普通用户';
                userStatus.className = user.memberLevel === 'vip' ? 
                    'text-xs text-yellow-600 font-medium' : 'text-xs text-gray-500';
            }
        } else {
            this.showGuestWelcome();
            
            const userStatus = document.getElementById('user-status-sidebar');
            if (userStatus) {
                userStatus.textContent = '请登录';
                userStatus.className = 'text-xs text-gray-500';
            }
        }
    }

    // 更新用户限制
    updateUserLimits() {
        const isLoggedIn = window.unifiedAuthManager ? window.unifiedAuthManager.isLoggedIn() : false;
        const user = window.unifiedAuthManager ? window.unifiedAuthManager.getCurrentUser() : null;

        if (isLoggedIn && user) {
            this.userLimits = {
                dailyMessages: user.memberLevel === 'vip' ? 100 : 30,
                maxMessageLength: 4000,
                canUseVoice: true,
                canUploadFiles: true,
                canUseAdvancedFeatures: user.memberLevel === 'vip'
            };
        } else {
            this.userLimits = {
                dailyMessages: 5,
                maxMessageLength: 1000,
                canUseVoice: false,
                canUploadFiles: false,
                canUseAdvancedFeatures: false
            };
        }

        this.updateFeatureAvailability();
    }

    // 更新功能可用性
    updateFeatureAvailability() {
        const voiceBtn = document.getElementById('voice-btn');
        const fileBtn = document.getElementById('file-btn');
        const imageBtn = document.getElementById('image-btn');

        if (voiceBtn) {
            if (this.userLimits.canUseVoice) {
                voiceBtn.disabled = false;
                voiceBtn.title = '语音输入';
                voiceBtn.classList.remove('text-gray-400');
            } else {
                voiceBtn.disabled = true;
                voiceBtn.title = '请登录后使用语音功能';
                voiceBtn.classList.add('text-gray-400');
            }
        }

        if (fileBtn) {
            if (this.userLimits.canUploadFiles) {
                fileBtn.disabled = false;
                fileBtn.title = '文件上传';
                fileBtn.classList.remove('text-gray-400');
            } else {
                fileBtn.disabled = true;
                fileBtn.title = '请登录后使用文件上传';
                fileBtn.classList.add('text-gray-400');
            }
        }

        if (imageBtn) {
            if (this.userLimits.canUploadFiles) {
                imageBtn.disabled = false;
                imageBtn.title = '图片识别';
                imageBtn.classList.remove('text-gray-400');
            } else {
                imageBtn.disabled = true;
                imageBtn.title = '请登录后使用图片识别';
                imageBtn.classList.add('text-gray-400');
            }
        }
    }

    // 更新UI状态
    updateUIState() {
        const userInput = document.getElementById('user-input');
        const sendBtn = document.getElementById('send-btn');
        const isLoggedIn = window.unifiedAuthManager ? window.unifiedAuthManager.isLoggedIn() : false;

        if (userInput && sendBtn) {
            if (isLoggedIn) {
                userInput.disabled = false;
                userInput.placeholder = '输入消息，按 Shift+Enter 换行';
                sendBtn.disabled = userInput.value.trim().length === 0;
            } else {
                userInput.disabled = false;
                userInput.placeholder = '游客模式，每日可发送5条消息';
                sendBtn.disabled = userInput.value.trim().length === 0;
            }
        }
    }

    // 处理输入变化
    handleInputChange() {
        const userInput = document.getElementById('user-input');
        const sendBtn = document.getElementById('send-btn');
        
        if (!userInput || !sendBtn) return;

        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 200) + 'px';
        
        const message = userInput.value.trim();
        const isOverLimit = message.length > this.userLimits.maxMessageLength;
        
        if (isOverLimit) {
            userInput.classList.add('border-red-500');
            sendBtn.disabled = true;
            
            this.showLengthWarning(message.length);
        } else {
            userInput.classList.remove('border-red-500');
            sendBtn.disabled = message.length === 0 || this.isProcessing;
        }
    }

    // 显示长度警告
    showLengthWarning(currentLength) {
        let warning = document.getElementById('length-warning');
        if (!warning) {
            warning = document.createElement('div');
            warning.id = 'length-warning';
            warning.className = 'text-red-500 text-sm mt-2';
            document.querySelector('.input-wrapper').appendChild(warning);
        }
        
        warning.textContent = `消息过长 (${currentLength}/${this.userLimits.maxMessageLength} 字符)`;
    }

    // 处理发送消息
    async handleSendMessage() {
        const userInput = document.getElementById('user-input');
        const message = userInput.value.trim();
        
        if (!message || this.isProcessing) return;
        
        if (message.length > this.userLimits.maxMessageLength) {
            this.showMessage('消息过长，请缩短后重试', 'error');
            return;
        }
        
        if (!await this.checkDailyLimit()) {
            return;
        }

        this.isProcessing = true;
        this.updateSendButtonState();

        try {
            const user = window.unifiedAuthManager ? window.unifiedAuthManager.getCurrentUser() : null;
            const userAvatar = user ? user.avatar : null;
            this.addMessageToChat('user', message, userAvatar);
            
            userInput.value = '';
            userInput.style.height = 'auto';
            this.handleInputChange();
            
            this.showThinkingIndicator();
            
            const response = await this.sendMessageToServer(message);
            
            if (response.success) {
                this.addMessageToChat('assistant', response.data.message, '/image/机械人助手.jpg');
                
                // 检查语音开关并播放语音
                const speechToggle = document.getElementById('speech-toggle');
                if (speechToggle && speechToggle.checked) {
                    // 延迟一下让消息先显示出来
                    setTimeout(() => {
                        const lastAIMessage = document.querySelector('.message-assistant:last-child');
                        if (lastAIMessage) {
                            this.speakAIResponse(response.data.message, { messageId: lastAIMessage.id });
                        }
                    }, 500);
                }
                
                this.recordMessageUsage();
                
                await this.updateChatHistory();
            } else {
                throw new Error(response.message);
            }
            
        } catch (error) {
            console.error('❌ 发送消息失败:', error);
            this.showMessage('发送失败: ' + error.message, 'error');
            this.removeThinkingIndicator();
        } finally {
            this.isProcessing = false;
            this.updateSendButtonState();
        }
    }

    // 检查每日限制
    async checkDailyLimit() {
        const isLoggedIn = window.unifiedAuthManager ? window.unifiedAuthManager.isLoggedIn() : false;
        
        if (!isLoggedIn) {
            const guestUsage = this.getGuestUsage();
            if (guestUsage.todayCount >= this.userLimits.dailyMessages) {
                this.showLimitExceededModal();
                return false;
            }
        } else {
            try {
                const response = await fetch('/api/ai/usage', {
                    headers: window.unifiedAuthManager.getAuthHeaders()
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (!result.data.canSend) {
                        this.showLimitExceededModal(result.data.remaining);
                        return false;
                    }
                }
            } catch (error) {
                console.error('❌ 检查使用限制失败:', error);
            }
        }
        
        return true;
    }

    // 获取游客使用情况
    getGuestUsage() {
        const storageKey = 'guest_ai_usage';
        const today = new Date().toDateString();
        const usage = JSON.parse(localStorage.getItem(storageKey) || '{}');
        
        if (usage.date !== today) {
            return { date: today, todayCount: 0 };
        }
        
        return usage;
    }

    // 记录消息使用
    recordMessageUsage() {
        const isLoggedIn = window.unifiedAuthManager ? window.unifiedAuthManager.isLoggedIn() : false;
        
        if (!isLoggedIn) {
            const storageKey = 'guest_ai_usage';
            const usage = this.getGuestUsage();
            usage.todayCount += 1;
            localStorage.setItem(storageKey, JSON.stringify(usage));
            
            this.updateRemainingCount();
        }
    }

    // 更新剩余次数显示
    updateRemainingCount() {
        const isLoggedIn = window.unifiedAuthManager ? window.unifiedAuthManager.isLoggedIn() : false;
        
        if (!isLoggedIn) {
            const usage = this.getGuestUsage();
            const remaining = this.userLimits.dailyMessages - usage.todayCount;
            
            let counter = document.getElementById('guest-counter');
            if (!counter) {
                counter = document.createElement('div');
                counter.id = 'guest-counter';
                counter.className = 'text-center text-sm text-gray-600 mt-2';
                document.querySelector('.input-wrapper').appendChild(counter);
            }
            
            counter.textContent = `今日剩余: ${remaining}/${this.userLimits.dailyMessages} 条消息`;
            
            if (remaining <= 2) {
                counter.className = 'text-center text-sm text-orange-500 mt-2 font-medium';
            } else {
                counter.className = 'text-center text-sm text-gray-600 mt-2';
            }
        } else {
            const counter = document.getElementById('guest-counter');
            if (counter) counter.remove();
        }
    }

    // 显示限制超出模态框
    showLimitExceededModal(remaining = 0) {
        const isLoggedIn = window.unifiedAuthManager ? window.unifiedAuthManager.isLoggedIn() : false;
        
        const modalHTML = `
            <div id="limit-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div class="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                    <div class="text-center mb-6">
                        <div class="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 text-2xl mx-auto mb-4">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">消息次数已用完</h3>
                        <p class="text-gray-600">
                            ${isLoggedIn ? 
                                `今日AI对话次数已用完，剩余 ${remaining} 次` : 
                                '游客模式每日限制5条消息，请登录后继续使用'}
                        </p>
                    </div>
                    
                    <div class="flex gap-3">
                        <button id="limit-cancel" class="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                            稍后再说
                        </button>
                        <button id="limit-login" class="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-secondary transition-colors">
                            ${isLoggedIn ? '升级会员' : '立即登录'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('limit-modal');
        
        document.getElementById('limit-cancel').addEventListener('click', () => {
            modal.remove();
        });

        document.getElementById('limit-login').addEventListener('click', () => {
            modal.remove();
            if (isLoggedIn) {
                window.location.href = '云梦智间会员.html';
            } else {
                window.location.href = '云梦智间登录.html';
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // 发送消息到服务器 - 更新日志信息
    async sendMessageToServer(message) {
        const isLoggedIn = window.unifiedAuthManager ? window.unifiedAuthManager.isLoggedIn() : false;
        
        const requestBody = {
            message: message,
            sessionId: this.currentSessionId,
            assistantType: this.assistantType
        };

        let headers = {
            'Content-Type': 'application/json'
        };

        if (isLoggedIn) {
            headers = window.unifiedAuthManager.getAuthHeaders();
        }

        console.log('🚀 发送消息到扣子智能体服务...');
        
        const response = await fetch('/api/ai/chat/message', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        
        if (result.success) {
            console.log('✅ 扣子智能体回复成功');
        } else {
            console.error('❌ 扣子智能体服务错误:', result.message);
        }

        return result;
    }

    // 消息去重检查
    isDuplicateMessage(content, role) {
        if (this.conversationHistory.length === 0) return false;
        
        const lastMessage = this.conversationHistory[this.conversationHistory.length - 1];
        const timeDiff = Date.now() - lastMessage.timestamp.getTime();
        
        // 检查是否在2秒内发送了相同内容的相同角色消息
        return (timeDiff < 2000 && 
                lastMessage.content === content && 
                lastMessage.role === role);
    }

    // 添加消息到聊天界面
    addMessageToChat(role, content, avatar = null) {
        // 检查是否重复消息
        if (this.isDuplicateMessage(content, role)) {
            console.log('检测到重复消息，跳过添加');
            return;
        }

        const chatContent = document.getElementById('chat-content');
        const welcomeContainer = document.getElementById('welcome-container');
        
        if (welcomeContainer) {
            welcomeContainer.style.display = 'none';
        }
        
        this.removeThinkingIndicator();
        
        const messageId = `msg_${Date.now()}`;
        
        let userAvatar = avatar;
        if (role === 'user' && window.unifiedAuthManager && window.unifiedAuthManager.isLoggedIn()) {
            const user = window.unifiedAuthManager.getCurrentUser();
            userAvatar = user.avatar;
        }
        
        let messageHTML = '';
        
        if (role === 'user') {
            messageHTML = `
                <div id="${messageId}" class="message-container user">
                    <div class="message-content">
                        <div class="message-user p-4 shadow-message">
                            <div class="user-message-text">${this.formatMessage(content, role)}</div>
                            <div class="flex items-center justify-between mt-3 text-xs message-actions">
                                <span class="message-time">${new Date().toLocaleTimeString()}</span>
                                <div class="flex items-center gap-2">
                                    <button class="copy-btn hover:text-white transition-colors" data-content="${this.escapeHtml(content)}" title="复制内容">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="avatar-container">
                        <img src="${userAvatar || '94B2FFC12D41C799B69B2668BBA16BE7.jpg'}" class="user-avatar" alt="用户">
                    </div>
                </div>
            `;
        } else {
            messageHTML = `
                <div id="${messageId}" class="message-container assistant">
                    <div class="avatar-container">
                        <img src="${avatar || '/image/机械人助手.jpg'}" class="ai-avatar" alt="AI助手">
                    </div>
                    <div class="message-content">
                        <div class="message-assistant p-4 shadow-message">
                            <div class="ai-response">${this.formatMessage(content, role)}</div>
                            <div class="flex items-center justify-between mt-3 text-xs text-gray-500">
                                <span>${new Date().toLocaleTimeString()}</span>
                                <div class="flex items-center gap-2">
                                    <button class="copy-btn hover:text-primary transition-colors" data-content="${this.escapeHtml(content)}" title="复制内容">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                    <button class="like-btn hover:text-green-500 transition-colors" title="点赞">
                                        <i class="far fa-thumbs-up"></i>
                                    </button>
                                    <button class="speak-btn bg-blue-500 text-white w-8 h-8 rounded-full hover:bg-blue-600 transition-colors shadow-md flex items-center justify-center" 
                                            data-text="${this.escapeHtml(content)}"
                                            title="朗读消息">
                                        <i class="fas fa-volume-up text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        chatContent.insertAdjacentHTML('beforeend', messageHTML);
        
        this.scrollToBottom();
        
        this.bindCopyButton(messageId);
        
        if (role === 'assistant') {
            this.bindSpeakButton(messageId);
            
            if (this.isFirstResponse) {
                this.isFirstResponse = false;
                setTimeout(() => {
                    this.speakAIResponse(content, { messageId: messageId });
                }, 500);
            }
        }
        
        this.conversationHistory.push({
            id: messageId,
            role: role,
            content: content,
            timestamp: new Date(),
            avatar: role === 'user' ? userAvatar : (avatar || '/image/机械人助手.jpg')
        });
    }

    // 格式化消息内容
    formatMessage(content, role) {
        if (role === 'user') {
            return content.replace(/\n/g, '<br>');
        }
        
        let formatted = content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
        
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
        
        return formatted;
    }

    // HTML转义
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // 绑定复制按钮
    bindCopyButton(messageId) {
        const messageElement = document.getElementById(messageId);
        const copyBtn = messageElement.querySelector('.copy-btn');
        
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const content = copyBtn.getAttribute('data-content');
                navigator.clipboard.writeText(content).then(() => {
                    const originalIcon = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                    copyBtn.classList.add('text-green-500');
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = originalIcon;
                        copyBtn.classList.remove('text-green-500');
                    }, 2000);
                });
            });
        }
    }

    // 增强语音按钮绑定
    bindSpeakButton(messageId) {
        const messageElement = document.getElementById(messageId);
        const speakBtn = messageElement.querySelector('.speak-btn');
        
        if (speakBtn && this.voiceService) {
            speakBtn.addEventListener('click', async () => {
                const text = speakBtn.getAttribute('data-text');
                const currentState = this.getPlayButtonState(speakBtn);
                
                // 获取语音服务状态
                const voiceStatus = this.voiceService.getStatus();
                
                // 如果正在播放同一消息，则暂停/继续
                if (voiceStatus.currentMessageId === messageId && voiceStatus.isSpeaking) {
                    if (voiceStatus.isPaused) {
                        this.voiceService.resume();
                    } else {
                        this.voiceService.pause();
                    }
                    return;
                }
                
                // 如果正在播放其他消息，先停止
                if (voiceStatus.isSpeaking) {
                    this.voiceService.stop();
                }
                
                // 开始播放新消息
                speakBtn.innerHTML = '<i class="fas fa-spinner fa-spin text-xs"></i>';
                speakBtn.disabled = true;
                
                try {
                    await this.speakAIResponse(text, {
                        messageId: messageId,
                        onStart: () => {
                            speakBtn.disabled = false;
                        },
                        onEnd: () => {
                            speakBtn.disabled = false;
                        },
                        onError: () => {
                            speakBtn.disabled = false;
                        }
                    });
                } catch (error) {
                    console.error('❌ 手动播放失败:', error);
                    speakBtn.innerHTML = '<i class="fas fa-volume-up text-xs"></i>';
                    speakBtn.disabled = false;
                    speakBtn.classList.remove('bg-yellow-500', 'bg-green-500');
                    speakBtn.classList.add('bg-blue-500');
                }
            });
        }
    }

    // 显示思考指示器
    showThinkingIndicator() {
        const chatContent = document.getElementById('chat-content');
        const thinkingHTML = `
            <div id="thinking-indicator" class="message-container assistant">
                <div class="avatar-container">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-white flex-shrink-0">
                        <i class="fas fa-robot text-sm"></i>
                    </div>
                </div>
                <div class="message-content">
                    <div class="message-assistant p-4 shadow-message">
                        <div class="flex items-center gap-3">
                            <div class="typing-indicator flex items-center gap-1">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                            <div class="text-xs text-gray-500">AI正在思考中...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        chatContent.insertAdjacentHTML('beforeend', thinkingHTML);
        this.scrollToBottom();
    }

    // 移除思考指示器
    removeThinkingIndicator() {
        const thinkingIndicator = document.getElementById('thinking-indicator');
        if (thinkingIndicator) {
            thinkingIndicator.remove();
        }
    }

    // 滚动到底部
    scrollToBottom() {
        const chatContainer = document.getElementById('chat-content-container');
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }

    // 更新发送按钮状态
    updateSendButtonState() {
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
            sendBtn.disabled = this.isProcessing;
            sendBtn.innerHTML = this.isProcessing ? 
                '<i class="fas fa-spinner fa-spin"></i>' : 
                '<i class="fas fa-paper-plane"></i>';
        }
    }

    // 创建新对话
    createNewChat() {
        if (this.conversationHistory.length > 0) {
            this.showNewChatConfirmation();
        } else {
            this.startNewChat();
        }
    }

    // 显示新对话确认
    showNewChatConfirmation() {
        if (window.uiManager && window.uiManager.showLearningConfirmation) {
            window.uiManager.showLearningConfirmation(
                '确定要开始新对话吗？当前对话内容将保存到历史记录中。',
                '开始新对话',
                '继续当前对话'
            ).then(confirmed => {
                if (confirmed) {
                    this.startNewChat();
                }
            });
        } else {
            if (confirm('确定要开始新对话吗？当前对话内容将保存到历史记录中。')) {
                this.startNewChat();
            }
        }
    }

    // 开始新对话
    startNewChat() {
        this.currentSessionId = `session_${Date.now()}`;
        this.conversationHistory = [];
        this.isFirstResponse = true;
        
        const chatContent = document.getElementById('chat-content');
        chatContent.innerHTML = '';
        
        this.showWelcomeMessage();
        
        this.updateSessionTitle('新对话');
        
        this.addToHistoryList();
    }

    // 更新会话标题
    updateSessionTitle(title) {
        const sessionTitle = document.getElementById('session-title');
        if (sessionTitle) {
            sessionTitle.textContent = title;
        }
    }

    // 添加到历史记录列表
    addToHistoryList() {
        console.log('📝 添加到历史记录:', this.currentSessionId);
    }

    // 加载聊天历史
    async loadChatHistory() {
        const isLoggedIn = window.unifiedAuthManager ? window.unifiedAuthManager.isLoggedIn() : false;
        
        if (isLoggedIn) {
            try {
                const response = await fetch('/api/ai/chat/sessions', {
                    headers: window.unifiedAuthManager.getAuthHeaders()
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        this.renderHistoryList(result.data);
                    }
                }
            } catch (error) {
                console.error('❌ 加载聊天历史失败:', error);
            }
        }
    }

    // 渲染历史记录列表
    renderHistoryList(sessions) {
        const historyList = document.getElementById('chat-history-list');
        if (!historyList) return;

        if (sessions.length === 0) {
            historyList.innerHTML = `
                <div class="text-center text-gray-500 py-4">
                    <i class="fas fa-comments text-2xl mb-2 block"></i>
                    <p class="text-sm">暂无对话历史</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = sessions.map(session => `
            <div class="history-item p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-gray-100" data-session-id="${session.id}">
                <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-gray-900 truncate">${session.title}</div>
                        <div class="text-xs text-gray-500 mt-1">
                            ${new Date(session.lastActivity).toLocaleDateString()} · 
                            ${session.messageCount} 条消息
                        </div>
                    </div>
                    <button class="history-delete-btn text-gray-400 hover:text-red-500 ml-2 opacity-0 transition-opacity">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `).join('');

        this.bindHistoryItemEvents();
    }

    // 绑定历史项事件
    bindHistoryItemEvents() {
        document.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.history-delete-btn')) {
                    const sessionId = item.getAttribute('data-session-id');
                    this.loadSession(sessionId);
                }
            });
        });

        document.querySelectorAll('.history-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const sessionId = e.target.closest('.history-item').getAttribute('data-session-id');
                this.deleteSession(sessionId);
            });
        });
    }

    // 加载会话
    async loadSession(sessionId) {
        try {
            const response = await fetch(`/api/ai/chat/history?sessionId=${sessionId}`, {
                headers: window.unifiedAuthManager.getAuthHeaders()
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.displaySessionHistory(result.data.history);
                    this.currentSessionId = sessionId;
                    this.isFirstResponse = false;
                }
            }
        } catch (error) {
            console.error('❌ 加载会话失败:', error);
        }
    }

    // 显示会话历史
    displaySessionHistory(history) {
        const chatContent = document.getElementById('chat-content');
        chatContent.innerHTML = '';
        
        history.forEach(message => {
            this.addMessageToChat(message.role, message.content, message.avatar);
        });
        
        this.scrollToBottom();
    }

    // 删除会话
    async deleteSession(sessionId) {
        if (window.uiManager && window.uiManager.showLearningConfirmation) {
            const confirmed = await window.uiManager.showLearningConfirmation(
                '确定要删除这个对话吗？此操作无法撤销。',
                '删除对话',
                '取消'
            );
            
            if (!confirmed) return;
        } else if (!confirm('确定要删除这个对话吗？此操作无法撤销。')) {
            return;
        }

        try {
            const response = await fetch(`/api/ai/chat/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: window.unifiedAuthManager.getAuthHeaders()
            });
            
            if (response.ok) {
                this.loadChatHistory();
            }
        } catch (error) {
            console.error('❌ 删除会话失败:', error);
        }
    }

    // 更新对话历史
    async updateChatHistory() {
        const isLoggedIn = window.unifiedAuthManager ? window.unifiedAuthManager.isLoggedIn() : false;
        
        if (isLoggedIn) {
            this.loadChatHistory();
        }
    }

    // 修改：切换助手类型 - 修复重复消息
    switchAssistant(assistantType) {
        // 如果已经是当前助手，不重复切换
        if (this.assistantType === assistantType) {
            return;
        }
        
        this.assistantType = assistantType;
        
        this.updateAssistantButtons();
        
        // 只在真正切换时显示一次消息
        this.showAssistantSwitchedMessage(assistantType);
    }

    // 更新助手按钮状态
    updateAssistantButtons() {
        const buttons = {
            'learning': document.getElementById('learning-assistant-btn'),
            'translation': document.getElementById('translation-assistant-btn'),
            'writing': document.getElementById('writing-assistant-btn')
        };

        Object.keys(buttons).forEach(type => {
            const btn = buttons[type];
            if (btn) {
                if (type === this.assistantType) {
                    btn.classList.remove('text-gray-700', 'hover:bg-gray-50');
                    btn.classList.add('bg-blue-50', 'text-primary');
                } else {
                    btn.classList.remove('bg-blue-50', 'text-primary');
                    btn.classList.add('text-gray-700', 'hover:bg-gray-50');
                }
            }
        });
    }

    // 显示助手切换消息 - 更新为扣子智能体
    showAssistantSwitchedMessage(assistantType) {
        const messages = {
            'learning': '👋 已切换到学习助手模式，我是扣子智能体，可以帮你解答英语学习问题！',
            'translation': '🌐 已切换到翻译助手模式，扣子智能体提供专业的中英文翻译服务！',
            'writing': '✍️ 已切换到写作助手模式，扣子智能体帮你提升英文写作水平！'
        };

        this.addMessageToChat('assistant', messages[assistantType]);
    }

    // 显示欢迎消息
    showWelcomeMessage() {
        const welcomeContainer = document.getElementById('welcome-container');
        if (welcomeContainer) {
            welcomeContainer.style.display = 'block';
        }
        
        this.updateRemainingCount();
    }

    // 显示游客欢迎消息
    showGuestWelcome() {
        const welcomeContainer = document.getElementById('welcome-container');
        if (welcomeContainer) {
            const guestWelcomeHTML = `
                <div class="message-assistant p-6 shadow-message">
                    <h2 class="text-xl font-semibold text-gray-800 mb-4">👋 欢迎使用云梦智间 AI</h2>
                    <p class="font-content text-gray-700 mb-4">您现在处于游客模式，每日可以体验 <strong>5 次</strong> AI对话。登录后解锁完整功能：</p>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div class="bg-blue-50/50 p-4 rounded-lg">
                            <h3 class="font-semibold text-primary mb-2">🚀 登录后享受</h3>
                            <ul class="font-content text-gray-700 space-y-1">
                                <li>• 每日30次AI对话</li>
                                <li>• 语音输入和文件上传</li>
                                <li>• 对话历史保存</li>
                                <li>• 个性化学习建议</li>
                            </ul>
                        </div>
                        <div class="bg-green-50/50 p-4 rounded-lg">
                            <h3 class="font-semibold text-green-600 mb-2">⭐ VIP会员特权</h3>
                            <ul class="font-content text-gray-700 space-y-1">
                                <li>• 无限次AI对话</li>
                                <li>• 优先响应服务</li>
                                <li>• 高级学习功能</li>
                                <li>• 专属客服支持</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="flex gap-3">
                        <a href="云梦智间登录.html" class="flex-1 bg-gradient-to-r from-primary to-secondary text-white py-3 px-4 rounded-lg text-center hover:opacity-90 transition-opacity">
                            <i class="fas fa-sign-in-alt mr-2"></i>立即登录
                        </a>
                        <a href="云梦智间注册.html" class="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg text-center hover:bg-gray-200 transition-colors">
                            <i class="fas fa-user-plus mr-2"></i>注册账号
                        </a>
                    </div>
                </div>
            `;
            
            welcomeContainer.innerHTML = guestWelcomeHTML;
            welcomeContainer.style.display = 'block';
        }
        
        this.updateRemainingCount();
    }

    // 增强语音输入功能
    async handleVoiceInput() {
        if (!this.userLimits.canUseVoice) {
            this.showMessage('请登录后使用语音输入功能', 'error');
            return;
        }

        try {
            const voiceBtn = document.getElementById('voice-btn');
            const isRecording = voiceBtn.classList.contains('recording');

            if (isRecording) {
                // 停止录音
                this.stopVoiceRecording();
                voiceBtn.classList.remove('recording');
                voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                this.hideVoiceIndicator();
            } else {
                // 开始录音
                const success = await this.startVoiceRecording();
                if (success) {
                    voiceBtn.classList.add('recording');
                    voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
                    this.showVoiceIndicator();
                }
            }
        } catch (error) {
            console.error('❌ 语音输入处理失败:', error);
            this.showMessage('语音输入失败: ' + error.message, 'error');
        }
    }

    // 开始语音录制
    async startVoiceRecording() {
        try {
            // 检查浏览器支持
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('浏览器不支持语音录制');
            }

            // 创建音频上下文
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });

            // 获取麦克风权限
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // 创建录音处理器
            this.mediaRecorder = new MediaRecorder(this.mediaStream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                await this.processVoiceRecording();
            };

            // 开始录制
            this.mediaRecorder.start(1000); // 每1秒收集一次数据
            console.log('🎤 开始语音录制');

            // 设置超时自动停止
            this.recordingTimeout = setTimeout(() => {
                this.stopVoiceRecording();
                this.showMessage('录音已自动停止（最长60秒）', 'info');
            }, 60000);

            return true;

        } catch (error) {
            console.error('❌ 启动语音录制失败:', error);
            this.showMessage('无法访问麦克风: ' + error.message, 'error');
            return false;
        }
    }

    // 停止语音录制
    stopVoiceRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }

        if (this.audioContext) {
            this.audioContext.close();
        }

        if (this.recordingTimeout) {
            clearTimeout(this.recordingTimeout);
        }

        console.log('⏹️ 停止语音录制');
    }

    // 处理语音录制结果
    async processVoiceRecording() {
        try {
            this.showMessage('正在转换语音...', 'info');

            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            
            // 转换为WAV格式以提高识别准确率
            const wavBlob = await this.convertToWav(audioBlob);
            
            const apiService = new window.AIApiService();
            const result = await apiService.enhancedSpeechToText(wavBlob);

            if (result.success) {
                const userInput = document.getElementById('user-input');
                const currentText = userInput.value.trim();
                
                if (currentText) {
                    userInput.value = currentText + ' ' + result.data.text;
                } else {
                    userInput.value = result.data.text;
                }
                
                this.handleInputChange();
                this.showMessage(`语音识别完成 (置信度: ${(result.data.confidence * 100).toFixed(1)}%)`, 'success');
                
                // 自动发送消息（可选）
                // await this.handleSendMessage();
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error('❌ 语音处理失败:', error);
            this.showMessage(`语音识别失败: ${error.message}`, 'error');
        } finally {
            this.cleanupVoiceRecording();
        }
    }

    // 转换为WAV格式
    async convertToWav(audioBlob) {
        return new Promise((resolve) => {
            // 简化处理，实际项目中应使用音频转换库
            // 这里直接返回原blob
            resolve(audioBlob);
        });
    }

    // 清理语音录制资源
    cleanupVoiceRecording() {
        this.audioChunks = [];
        this.mediaStream = null;
        this.mediaRecorder = null;
        this.audioContext = null;
        
        const voiceBtn = document.getElementById('voice-btn');
        voiceBtn.classList.remove('recording');
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        
        this.hideVoiceIndicator();
    }

    // 显示语音录制指示器
    showVoiceIndicator() {
        let indicator = document.getElementById('voice-recording-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'voice-recording-indicator';
            indicator.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2';
            indicator.innerHTML = `
                <div class="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                <span>语音录制中...</span>
                <span class="text-xs">(点击停止按钮或等待自动结束)</span>
            `;
            document.body.appendChild(indicator);
        }
    }

    // 隐藏语音录制指示器
    hideVoiceIndicator() {
        const indicator = document.getElementById('voice-recording-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    // 增强文件上传处理
    async handleFileUpload() {
        if (!this.userLimits.canUploadFiles) {
            this.showMessage('请登录后使用文件上传功能', 'error');
            return;
        }

        try {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = this.getAcceptedFileTypes();
            fileInput.multiple = true;
            fileInput.style.display = 'none';

            fileInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files);
                for (const file of files) {
                    await this.processUploadedFile(file);
                }
            });

            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);

        } catch (error) {
            console.error('❌ 文件上传处理失败:', error);
            this.showMessage('文件上传失败: ' + error.message, 'error');
        }
    }

    // 获取支持的文件类型
    getAcceptedFileTypes() {
        const apiService = new window.AIApiService();
        const types = apiService.getSupportedFileTypes();
        
        return [
            ...types.images.map(ext => `image/${ext.substring(1)}`),
            ...types.documents.map(ext => `application/${ext.substring(1)}`),
            ...types.audio.map(ext => `audio/${ext.substring(1)}`),
            'image/*',
            'text/plain',
            'application/pdf'
        ].join(',');
    }

    // 修改：增强文件处理 - 根据文件类型调用不同API，添加文件预处理
    async processUploadedFile(file) {
        try {
            // 文件验证
            const validation = this.validateFile(file);
            if (!validation.valid) {
                this.showMessage(validation.message, 'error');
                return;
            }

            this.showMessage(`正在处理文件: ${file.name}`, 'info');

            const apiService = new window.AIApiService();
            let result;

            // 根据文件类型调用不同的API，并添加重试机制
            if (file.type.startsWith('image/')) {
                // 对图片文件进行预处理
                const processedFile = await this.preprocessImageFile(file);
                result = await apiService.enhancedImageRecognition(processedFile, {
                    forceJpeg: true,
                    maxRetries: 2
                });
            } else if (file.type.startsWith('audio/')) {
                result = await apiService.enhancedSpeechToText(file);
            } else {
                // 对于文档文件，使用OCR处理
                result = await apiService.documentOCR(file, {
                    forceJpeg: true
                });
            }

            if (result.success) {
                await this.handleFileProcessingResult(file, result.data);
                this.showMessage(`文件处理完成: ${file.name}`, 'success');
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error('❌ 文件处理失败:', error);
            this.showMessage(`文件处理失败: ${error.message}`, 'error');
        }
    }

    // 新增：图片文件预处理方法
    async preprocessImageFile(file) {
        return new Promise((resolve) => {
            // 创建图片对象进行预处理
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            img.onload = () => {
                // 调整图片大小（如果需要）
                const maxWidth = 1024;
                const maxHeight = 1024;
                let { width, height } = img;
                
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    } else {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // 绘制图片到canvas
                ctx.drawImage(img, 0, 0, width, height);
                
                // 转换为JPEG格式（避免PNG透明度问题）
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.85);
            };
            
            img.onerror = () => {
                console.warn('⚠️ 图片预处理失败，使用原文件');
                resolve(file);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }

    // 文件验证
    validateFile(file) {
        const apiService = new window.AIApiService();
        
        // 检查文件类型
        if (!apiService.isFileSupported(file)) {
            return {
                valid: false,
                message: `不支持的文件格式: ${file.name}`
            };
        }

        // 检查文件大小
        const maxSize = apiService.getFileSizeLimit();
        if (file.size > maxSize) {
            return {
                valid: false,
                message: `文件大小超过限制: ${(file.size / 1024 / 1024).toFixed(2)}MB > 10MB`
            };
        }

        // 检查文件是否为空
        if (file.size === 0) {
            return {
                valid: false,
                message: '文件为空'
            };
        }

        return { valid: true };
    }

    // 修改：处理文件处理结果 - 根据文件类型构建不同提示
    async handleFileProcessingResult(file, data) {
        const userInput = document.getElementById('user-input');
        let prefix = '';
        let content = '';

        if (file.type.startsWith('image/')) {
            prefix = '请分析这张图片：';
            content = `图片描述: ${data.description || '未提供描述'}\n识别到的物体: ${data.primaryObjects ? data.primaryObjects.map(obj => obj.name).join(', ') : '未识别到物体'}`;
        } else if (file.type.startsWith('audio/')) {
            prefix = '请分析这段语音内容：';
            content = data.text || '语音识别结果为空';
        } else {
            // 文档文件
            prefix = '请分析以下文档内容：';
            content = data.text || data.content || '文档内容为空';
        }

        // 如果内容过长，进行截断
        if (content.length > 1000) {
            content = content.substring(0, 1000) + '...\n(内容已截断，完整内容请查看原文件)';
        }

        const currentText = userInput.value.trim();
        if (currentText) {
            userInput.value = currentText + '\n\n' + prefix + '\n' + content;
        } else {
            userInput.value = prefix + '\n' + content;
        }

        this.handleInputChange();

        // 添加文件信息到聊天记录
        this.addFileInfoMessage(file, data);
    }

    // 添加文件信息消息
    addFileInfoMessage(file, data) {
        const fileId = `file_${Date.now()}`;
        const fileInfoHTML = `
            <div id="${fileId}" class="message-container user">
                <div class="message-content">
                    <div class="message-user p-4 shadow-message">
                        <div class="flex items-center gap-3 mb-2">
                            <i class="fas fa-file-upload text-blue-500"></i>
                            <span class="font-medium">已上传文件: ${file.name}</span>
                        </div>
                        <div class="text-sm text-white/80">
                            <div>类型: ${this.getFileTypeDisplayName(data.fileType)}</div>
                            <div>大小: ${this.formatFileSize(file.size)}</div>
                            ${data.metadata ? `<div>信息: ${this.getFileMetadataDisplay(data.metadata)}</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        const chatContent = document.getElementById('chat-content');
        chatContent.insertAdjacentHTML('beforeend', fileInfoHTML);
        this.scrollToBottom();
    }

    // 获取文件类型显示名称
    getFileTypeDisplayName(fileType) {
        const names = {
            'image': '图片',
            'audio': '音频',
            'text': '文本',
            'pdf': 'PDF文档',
            'document': '文档'
        };
        return names[fileType] || fileType;
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 获取文件元数据显示
    getFileMetadataDisplay(metadata) {
        if (metadata.primaryObjects) {
            return `识别到 ${metadata.primaryObjects.length} 个物体`;
        } else if (metadata.words) {
            return `${metadata.words} 个单词`;
        } else if (metadata.lines) {
            return `${metadata.lines} 行文本`;
        }
        return '处理完成';
    }

    // 增强图片识别处理
    async processImageRecognition(file) {
        return await this.processUploadedFile(file);
    }

    // 处理语音录制（旧方法，保持兼容性）
    async processVoiceRecording(audioBlob) {
        try {
            this.showMessage('正在转换语音...', 'info');
            
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.wav');

            const response = await fetch('/api/ai/enhanced/speech-to-text', {
                method: 'POST',
                headers: {
                    'Authorization': window.unifiedAuthManager.getToken() ? 
                        `Bearer ${window.unifiedAuthManager.getToken()}` : ''
                },
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                const userInput = document.getElementById('user-input');
                userInput.value = result.data.text;
                this.handleInputChange();
                this.showMessage('语音识别完成', 'success');
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('❌ 语音识别失败:', error);
            this.showMessage(`语音识别失败: ${error.message}`, 'error');
        }
    }

    // 显示消息提示
    showMessage(message, type = 'info') {
        if (window.uiManager && window.uiManager.showMessage) {
            window.uiManager.showMessage(message, type);
        } else {
            alert(message);
        }
    }

    // 显示快速操作反馈
    showQuickActionFeedback(action) {
        this.showMessage(`已准备${action}，请在输入框中补充详细信息`, 'info');
    }

    // 修改：获取服务标识徽章 - 移除智普字样
    getServiceBadge(service) {
        const badges = {
            'bot': `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <i class="fas fa-robot mr-1"></i>AI助手
                    </span>`,
            'zhipu': `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                         <i class="fas fa-brain mr-1"></i>AI助手
                     </span>`,
            'unknown': `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <i class="fas fa-robot mr-1"></i>AI助手
                       </span>`
        };
        
        return badges[service] || badges['unknown'];
    }
}

// 创建全局AI聊天管理器实例
window.AIChatManager = AIChatManager;