// [file name]: 云梦智间词汇.js
// 修复版词汇管理器 - 专注于拼写练习功能
class SimplifiedVocabularyManager {
    constructor() {
        this.vocabularyData = null;
        this.userProgress = null;
        this.isAuthenticated = false;
        this.currentUser = null;
        this.authToken = null;
        this.currentPractice = null;
        this.currentWordIndex = 0;
        this.correctAnswers = 0;
        this.totalQuestions = 0;
        this.currentWords = [];
        
        // 数据管理器
        this.dataManager = null;
        
        // 绑定方法到全局
        window.vocabularyManager = this;
        
        console.log('🚀 词汇管理器已创建');
    }

    async init() {
        console.log('🚀 初始化简化版词汇管理器');
        
        try {
            // 立即绑定事件
            this.bindEvents();
            
            // 等待统一认证系统初始化
            await this.waitForAuthSystem();
            
            // 检查认证状态
            await this.checkAuthentication();
            
            // 初始化数据管理器，传递当前实例
            this.dataManager = new VocabularyDataManager(this);
            
            console.log('🔐 最终认证状态:', {
                isAuthenticated: this.isAuthenticated,
                hasToken: !!this.authToken,
                user: this.currentUser ? this.currentUser.username : '无用户'
            });
            
            // 初始UI状态更新
            this.updateAuthUI();
            
            // 如果已登录，加载数据
            if (this.isAuthenticated) {
                await this.loadVocabularyData();
                await this.loadUserProgress();
                this.updateProgressCards();
                this.loadFlashcards();
            }
            
            console.log('✅ 词汇管理器初始化完成');
            
            // 如果已登录，尝试同步待处理的活动
            if (this.isAuthenticated && this.dataManager) {
                setTimeout(() => {
                    this.dataManager.syncPendingActivities();
                }, 2000);
            }
        } catch (error) {
            console.error('❌ 词汇管理器初始化失败:', error);
        }
    }

    // 等待统一认证系统初始化
    async waitForAuthSystem() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // 最多等待5秒
            
            const checkAuth = () => {
                attempts++;
                
                if (window.unifiedAuthManager && window.unifiedAuthManager.isInitialized) {
                    console.log('✅ 统一认证系统已就绪');
                    resolve();
                } 
                else if (window.unifiedAuthManager) {
                    // 认证系统存在但未初始化，手动初始化
                    console.log('🔧 手动初始化统一认证系统...');
                    window.unifiedAuthManager.init().then(() => {
                        console.log('✅ 统一认证系统手动初始化完成');
                        resolve();
                    }).catch(error => {
                        console.error('❌ 统一认证系统初始化失败:', error);
                        // 继续等待或使用备用方案
                        if (attempts < maxAttempts) {
                            setTimeout(checkAuth, 100);
                        } else {
                            console.warn('⚠️ 认证系统初始化超时，使用本地模式');
                            resolve();
                        }
                    });
                }
                else if (window.uiManager && window.uiManager.authManager) {
                    console.log('✅ UI管理器认证系统已就绪');
                    resolve();
                } 
                else {
                    console.log(`⏳ 等待认证系统初始化... (${attempts}/${maxAttempts})`);
                    if (attempts < maxAttempts) {
                        setTimeout(checkAuth, 100);
                    } else {
                        console.warn('⚠️ 认证系统等待超时，使用本地模式');
                        resolve();
                    }
                }
            };
            
            checkAuth();
        });
    }

    // 认证检查方法
    async checkAuthentication() {
        try {
            console.log('🔐 开始认证检查...');
            
            // 优先使用统一认证系统
            if (window.unifiedAuthManager && window.unifiedAuthManager.isInitialized) {
                this.isAuthenticated = window.unifiedAuthManager.isLoggedIn();
                this.currentUser = window.unifiedAuthManager.getCurrentUser();
                this.authToken = window.unifiedAuthManager.getToken();
                
                console.log('🔐 统一认证系统状态:', {
                    isAuthenticated: this.isAuthenticated,
                    user: this.currentUser ? this.currentUser.username : '无用户',
                    hasToken: !!this.authToken,
                    token: this.authToken ? `***${this.authToken.slice(-8)}` : '无token'
                });
            } 
            // 备用：检查本地存储
            else {
                console.log('🔐 使用本地存储检查认证');
                this.authToken = localStorage.getItem('moyu_token') || 
                               localStorage.getItem('auth_token');
                
                const userData = localStorage.getItem('moyu_user') || 
                               localStorage.getItem('user_data');
                
                this.isAuthenticated = !!(this.authToken && userData);
                
                if (userData) {
                    try {
                        this.currentUser = JSON.parse(userData);
                    } catch (e) {
                        console.error('解析用户数据失败:', e);
                    }
                }
                
                console.log('🔐 本地存储认证状态:', {
                    isAuthenticated: this.isAuthenticated,
                    user: this.currentUser ? this.currentUser.username : '无用户',
                    hasToken: !!this.authToken
                });
            }
            
            // 如果认证系统存在但未初始化，等待初始化
            if (window.unifiedAuthManager && !window.unifiedAuthManager.isInitialized) {
                console.log('⏳ 等待统一认证系统初始化...');
                await window.unifiedAuthManager.init();
                // 重新检查认证状态
                return this.checkAuthentication();
            }
            
        } catch (error) {
            console.error('❌ 认证检查失败:', error);
            this.isAuthenticated = false;
            this.currentUser = null;
            this.authToken = null;
        }
    }

    // 更新认证UI
    updateAuthUI() {
        console.log('🔄 更新认证UI:', { 
            isAuthenticated: this.isAuthenticated, 
            user: this.currentUser,
            hasToken: !!this.authToken
        });
        
        if (this.isAuthenticated && this.currentUser) {
            this.showAuthenticatedUI();
        } else {
            this.showLoginRequired();
        }
    }

    // 显示已登录UI
    showAuthenticatedUI() {
        console.log('✅ 显示已登录状态UI');
        
        // 启用所有功能按钮
        this.enableAllFeatures();
        
        // 隐藏所有游客遮罩
        this.hideAllGuestOverlays();
        
        // 更新进度显示
        this.updateProgressCards();
    }

    // 显示登录要求
    showLoginRequired() {
        console.log('🔐 显示登录要求');
        
        // 禁用所有功能按钮
        this.disableAllFeatures();
        
        // 显示所有游客遮罩
        this.showAllGuestOverlays();
        
        // 显示登录提示内容
        this.showLoginRequiredContent();
    }

    // 启用所有功能
    enableAllFeatures() {
        console.log('🔓 启用所有功能');
        
        // 启用主按钮
        const mainButtons = ['start-smart-learning', 'refresh-flashcards', 'shuffle-flashcards'];
        mainButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });

        // 启用练习按钮
        const practiceButtons = document.querySelectorAll('.start-practice-btn');
        practiceButtons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        });
    }

    // 禁用所有功能
    disableAllFeatures() {
        console.log('🔒 禁用所有功能');
        
        // 禁用主按钮
        const mainButtons = ['start-smart-learning', 'refresh-flashcards', 'shuffle-flashcards'];
        mainButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        });

        // 禁用练习按钮
        const practiceButtons = document.querySelectorAll('.start-practice-btn');
        practiceButtons.forEach(btn => {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        });
    }

    // 隐藏所有游客遮罩
    hideAllGuestOverlays() {
        const guestOverlays = [
            'flashcard-practice-guest-overlay', 
            'choice-practice-guest-overlay',
            'spelling-practice-guest-overlay'
        ];
        
        guestOverlays.forEach(overlayId => {
            const overlay = document.getElementById(overlayId);
            if (overlay) {
                overlay.classList.add('hidden');
            }
        });
    }

    // 显示所有游客遮罩
    showAllGuestOverlays() {
        const guestOverlays = [
            'flashcard-practice-guest-overlay', 
            'choice-practice-guest-overlay',
            'spelling-practice-guest-overlay'
        ];
        
        guestOverlays.forEach(overlayId => {
            const overlay = document.getElementById(overlayId);
            if (overlay) {
                overlay.classList.remove('hidden');
            }
        });
    }

    // 显示登录要求内容
    showLoginRequiredContent() {
        console.log('📝 显示登录要求内容');
        
        // 学习状态面板显示登录提示
        const statusContainers = [
            'today-progress', 'mastered-words', 'review-words'
        ];
        
        statusContainers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = this.getLoginRequiredCardHTML('学习统计');
            }
        });

        // 词卡容器显示登录提示
        const flashcardContainer = document.getElementById('flashcard-container');
        if (flashcardContainer) {
            flashcardContainer.innerHTML = `
                <div class="col-span-4 text-center py-8">
                    ${this.getLoginRequiredCardHTML('词卡练习')}
                </div>
            `;
        }
    }

    // 获取登录要求卡片HTML
    getLoginRequiredCardHTML(title) {
        return `
            <div class="login-required-card">
                <i class="fas fa-user-lock"></i>
                <p>${title}</p>
                <button onclick="vocabularyManager.handleLogin()" class="btn-primary">
                    <i class="fas fa-sign-in-alt mr-2"></i>立即登录
                </button>
            </div>
        `;
    }

    // 处理登录
    handleLogin() {
        window.location.href = '云梦智间登录.html';
    }

    // 绑定事件
    bindEvents() {
        console.log('🔗 绑定事件');
        
        // 学习模式卡片
        document.querySelectorAll('.study-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('start-practice-btn')) {
                    if (!this.isAuthenticated) {
                        this.showLoginRequired();
                        this.showMessage('请先登录后使用此功能', 'warning');
                        return;
                    }
                    
                    this.startPractice(card.dataset.type);
                }
            });
        });

        // 智能学习
        const smartLearningBtn = document.getElementById('start-smart-learning');
        if (smartLearningBtn) {
            smartLearningBtn.addEventListener('click', () => {
                if (!this.isAuthenticated) {
                    this.showLoginRequired();
                    this.showMessage('请先登录后使用此功能', 'warning');
                    return;
                }
                this.startSmartLearning();
            });
        }

        // 刷新词卡
        const refreshBtn = document.getElementById('refresh-flashcards');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (!this.isAuthenticated) {
                    this.showLoginRequired();
                    this.showMessage('请先登录后使用此功能', 'warning');
                    return;
                }
                this.loadFlashcards();
            });
        }

        // 随机词卡
        const shuffleBtn = document.getElementById('shuffle-flashcards');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => {
                if (!this.isAuthenticated) {
                    this.showLoginRequired();
                    this.showMessage('请先登录后使用此功能', 'warning');
                    return;
                }
                this.loadFlashcards();
            });
        }

        // 模态框关闭
        const practiceOverlay = document.getElementById('practice-overlay');
        const closePracticeModal = document.getElementById('close-practice-modal');
        
        if (practiceOverlay) {
            practiceOverlay.addEventListener('click', () => {
                document.getElementById('practice-modal').classList.add('hidden');
            });
        }
        
        if (closePracticeModal) {
            closePracticeModal.addEventListener('click', () => {
                document.getElementById('practice-modal').classList.add('hidden');
            });
        }

        // 设置认证监听器
        this.setupAuthListeners();
        
        // 绑定词卡点击事件
        this.bindFlashcardEvents();
    }

    // 设置认证监听器
    setupAuthListeners() {
        console.log('🎯 设置认证监听器');
        
        // 监听统一认证系统的状态变化
        if (window.unifiedAuthManager) {
            window.unifiedAuthManager.addAuthListener((isLoggedIn, user, authState) => {
                console.log('🔔 词汇系统收到认证状态变化:', { isLoggedIn, user });
                this.isAuthenticated = isLoggedIn;
                this.currentUser = user;
                this.authToken = window.unifiedAuthManager.getToken();
                this.updateAuthUI();
                
                if (isLoggedIn) {
                    // 重新加载数据
                    this.loadVocabularyData();
                    this.loadUserProgress();
                    this.updateProgressCards();
                    this.loadFlashcards();
                }
            });
        }
        
        // 监听UI管理器的认证状态变化
        document.addEventListener('uiAuthStateUpdated', (event) => {
            console.log('🔔 词汇系统收到UI认证状态变化:', event.detail);
            this.isAuthenticated = event.detail.isLoggedIn;
            this.currentUser = event.detail.user;
            this.authToken = localStorage.getItem('moyu_token') || localStorage.getItem('auth_token');
            this.updateAuthUI();
        });
    }

    // 加载词汇数据
    async loadVocabularyData() {
        try {
            console.log('📚 加载词汇数据...');
            
            // 尝试从服务器加载
            const response = await fetch('/api/vocabulary/data');
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.vocabularyData = result.data;
                    console.log('✅ 从服务器加载词汇库成功');
                    return;
                }
            }
            
            // 如果服务器加载失败，使用示例数据
            console.log('⚠️ 从服务器加载失败，使用示例数据');
            this.vocabularyData = this.getSampleData();
            
        } catch (error) {
            console.error('❌ 加载词汇数据失败:', error);
            // 使用示例数据
            this.vocabularyData = this.getSampleData();
        }
    }

    // 加载用户进度 - 修复API端点
    async loadUserProgress() {
        try {
            console.log('📊 加载用户进度...');
            
            if (!this.isAuthenticated) {
                console.log('⚠️ 用户未登录，使用默认进度数据');
                this.userProgress = this.getDefaultProgress();
                return;
            }

            console.log('📊 加载用户进度，用户:', this.currentUser);
            
            const response = await fetch(`/api/vocabulary/user-stats/${this.currentUser.id || this.currentUser.userId}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.userProgress = result.data;
                console.log('✅ 从服务器加载用户进度成功');
                return;
            } else {
                throw new Error(result.message || '加载进度失败');
            }
            
        } catch (error) {
            console.warn('⚠️ 从服务器加载失败，使用默认进度:', error.message);
            this.userProgress = this.getDefaultProgress();
        }
    }

    // 更新进度卡片
    updateProgressCards() {
        if (!this.userProgress) return;
        
        const stats = this.userProgress.statistics || {};
        
        console.log('📈 更新进度卡片:', stats);
        
        // 更新统计数字
        const statElements = {
            'today-words': stats.todayWords || 12,
            'mastered-words-count': stats.masteredWords || 156,
            'review-words-count': stats.reviewWords || 23,
            'accuracy-rate': (stats.accuracyRate || 87) + '%',
            'due-words': stats.dueWords || 18,
            'learned-words': stats.learnedWords || 156,
            'total-words': stats.totalWords || 324,
            'study-days': stats.studyDays || 24
        };
        
        Object.keys(statElements).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = statElements[id];
            }
        });
    }

    // 加载快速词卡
    loadFlashcards() {
        if (!this.isAuthenticated || !this.vocabularyData) {
            console.log('⚠️ 未登录或无词汇数据，跳过加载词卡');
            return;
        }
        
        const container = document.getElementById('flashcard-container');
        if (!container) return;
        
        const words = this.getRandomWords(4);
        
        container.innerHTML = words.map(word => `
            <div class="flashcard-item bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-all duration-300 text-center" data-word="${word.word}">
                <h4 class="font-bold text-secondary mb-2">${word.word}</h4>
                <p class="text-xs text-gray-500 mb-3">${word.phonetic || ''}</p>
                <button class="text-xs text-primary hover:text-secondary transition-colors view-definition-btn">
                    <i class="fas fa-eye mr-1"></i>查看释义
                </button>
                <div class="definition hidden mt-3 text-sm text-gray-700">
                    ${word.meanings[0]?.definition || '暂无释义'}
                </div>
            </div>
        `).join('');
        
        // 重新绑定词卡点击事件
        this.bindFlashcardEvents();
        
        console.log('✅ 加载词卡完成');
    }

    // 绑定词卡事件
    bindFlashcardEvents() {
        document.querySelectorAll('.flashcard-item').forEach(card => {
            const viewBtn = card.querySelector('.view-definition-btn');
            const definition = card.querySelector('.definition');
            
            if (viewBtn && definition) {
                viewBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    definition.classList.toggle('hidden');
                    viewBtn.innerHTML = definition.classList.contains('hidden') ? 
                        '<i class="fas fa-eye mr-1"></i>查看释义' : 
                        '<i class="fas fa-eye-slash mr-1"></i>隐藏释义';
                });
            }
        });
    }

    // 获取随机词汇
    getRandomWords(count) {
        const allWords = this.getAllWords();
        return allWords
            .sort(() => Math.random() - 0.5)
            .slice(0, count);
    }

    // 获取所有词汇
    getAllWords() {
        let allWords = [];
        if (this.vocabularyData && this.vocabularyData.vocabulary) {
            allWords = [...this.vocabularyData.vocabulary];
        }
        return allWords;
    }

    // 开始练习
    startPractice(type) {
        if (!this.isAuthenticated) {
            this.showLoginRequired();
            this.showMessage('请先登录后使用此功能', 'warning');
            return;
        }
        
        console.log('🎯 开始练习:', type);
        
        this.currentPractice = type;
        this.currentWordIndex = 0;
        this.correctAnswers = 0;
        this.totalQuestions = 5; // 简化练习，每次5个单词
        this.currentWords = this.getPracticeWords(this.totalQuestions);
        
        // 开始训练会话记录
        this.dataManager.startTrainingSession(type);
        
        const modal = document.getElementById('practice-modal');
        const title = document.getElementById('practice-title');
        const content = document.getElementById('practice-content');
        
        if (!modal || !title || !content) {
            console.error('❌ 练习模态框元素未找到');
            return;
        }
        
        title.textContent = this.getPracticeTitle(type);
        content.innerHTML = this.getPracticeContent(type);
        
        modal.classList.remove('hidden');
        
        // 开始第一个问题
        this.showNextQuestion();
    }

    // 获取练习标题
    getPracticeTitle(type) {
        const titles = {
            'flashcard': '词卡记忆练习',
            'multiple-choice': '选择题练习',
            'spelling': '拼写练习'
        };
        return titles[type] || '词汇练习';
    }

    // 获取练习内容
    getPracticeContent(type) {
        return `
            <div class="text-center">
                <div id="practice-area" class="mb-6">
                    <!-- 练习内容动态加载 -->
                </div>
                <div class="flex justify-between items-center text-sm text-gray-500">
                    <span>进度: <span id="progress-text">0/${this.totalQuestions}</span></span>
                    <span>正确率: <span id="accuracy-text">0%</span></span>
                </div>
                <div id="practice-controls" class="mt-6 flex justify-center gap-4">
                    <!-- 控制按钮动态加载 -->
                </div>
            </div>
        `;
    }

    // 显示下一个问题
    showNextQuestion() {
        if (this.currentWordIndex >= this.totalQuestions) {
            this.finishPractice();
            return;
        }
        
        const currentWord = this.currentWords[this.currentWordIndex];
        
        const practiceArea = document.getElementById('practice-area');
        const progressText = document.getElementById('progress-text');
        const accuracyText = document.getElementById('accuracy-text');
        const controls = document.getElementById('practice-controls');
        
        if (!practiceArea || !progressText || !accuracyText || !controls) {
            console.error('❌ 练习区域元素未找到');
            return;
        }
        
        progressText.textContent = `${this.currentWordIndex + 1}/${this.totalQuestions}`;
        const accuracy = this.currentWordIndex > 0 ? 
            Math.round((this.correctAnswers / this.currentWordIndex) * 100) : 0;
        accuracyText.textContent = `${accuracy}%`;
        
        switch (this.currentPractice) {
            case 'flashcard':
                practiceArea.innerHTML = this.getFlashcardQuestion(currentWord);
                controls.innerHTML = this.getFlashcardControls();
                this.bindFlashcardPracticeEvents(currentWord);
                break;
            case 'multiple-choice':
                practiceArea.innerHTML = this.getMultipleChoiceQuestion(currentWord);
                controls.innerHTML = this.getMultipleChoiceControls();
                this.bindMultipleChoiceEvents(currentWord);
                break;
            case 'spelling':
                practiceArea.innerHTML = this.getSpellingQuestion(currentWord);
                controls.innerHTML = this.getSpellingControls();
                this.bindSpellingEvents(currentWord);
                break;
        }
        
        this.currentWordIndex++;
    }

    // 获取练习词汇
    getPracticeWords(count) {
        return this.getRandomWords(count);
    }

    // 词卡问题
    getFlashcardQuestion(word) {
        return `
            <div class="flashcard-practice bg-white border-2 border-primary rounded-xl p-8 max-w-md mx-auto min-h-[200px] flex items-center justify-center cursor-pointer mb-4">
                <div class="flashcard-practice-front text-center">
                    <h4 class="text-2xl font-bold text-secondary mb-2">${word.word}</h4>
                    <p class="text-gray-500">${word.phonetic || ''}</p>
                    <p class="text-sm text-gray-400 mt-4">点击卡片查看释义</p>
                </div>
                <div class="flashcard-practice-back text-center hidden">
                    <p class="text-lg text-gray-700 mb-2">${word.meanings[0]?.definition || '暂无释义'}</p>
                    <p class="text-sm text-gray-500 italic">${word.meanings[0]?.examples?.[0] || ''}</p>
                    <p class="text-sm text-gray-400 mt-4">你认识这个单词吗？</p>
                </div>
            </div>
        `;
    }

    // 词卡控制
    getFlashcardControls() {
        return `
            <button class="px-6 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors" id="dont-know-btn">
                <i class="fas fa-times mr-2"></i>不认识
            </button>
            <button class="px-6 py-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors" id="know-btn">
                <i class="fas fa-check mr-2"></i>认识
            </button>
        `;
    }

    // 绑定词卡练习事件
    bindFlashcardPracticeEvents(currentWord) {
        const flashcard = document.querySelector('.flashcard-practice');
        const knowBtn = document.getElementById('know-btn');
        const dontKnowBtn = document.getElementById('dont-know-btn');
        
        if (flashcard) {
            flashcard.addEventListener('click', () => {
                const front = flashcard.querySelector('.flashcard-practice-front');
                const back = flashcard.querySelector('.flashcard-practice-back');
                
                if (front && back) {
                    front.classList.toggle('hidden');
                    back.classList.toggle('hidden');
                }
            });
        }
        
        if (knowBtn) {
            knowBtn.addEventListener('click', () => {
                // 记录答题结果
                this.dataManager.recordAnswer(
                    currentWord.word, 
                    '认识', 
                    true, 
                    0 // 简化处理，不记录具体时间
                );
                this.correctAnswers++;
                this.showNextQuestion();
            });
        }
        
        if (dontKnowBtn) {
            dontKnowBtn.addEventListener('click', () => {
                // 记录答题结果
                this.dataManager.recordAnswer(
                    currentWord.word, 
                    '不认识', 
                    false, 
                    0
                );
                this.showNextQuestion();
            });
        }
    }

    // 选择题问题
    getMultipleChoiceQuestion(word) {
        const options = this.generateMultipleChoiceOptions(word, 4);
        
        return `
            <div class="text-center">
                <h4 class="text-xl font-bold text-secondary mb-6">"${word.word}" 的正确释义是？</h4>
                <div class="grid grid-cols-1 gap-3 mb-6">
                    ${options.map((option, index) => `
                        <button class="option-btn w-full p-4 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-left" data-correct="${option.correct}">
                            <span class="font-medium">${String.fromCharCode(65 + index)}.</span> ${option.text}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 生成选择题选项
    generateMultipleChoiceOptions(correctWord, count) {
        const allWords = this.getAllWords();
        const options = [{
            text: correctWord.meanings[0]?.definition || '暂无释义',
            correct: true
        }];
        
        // 添加干扰项
        const otherWords = allWords
            .filter(w => w.id !== correctWord.id)
            .sort(() => Math.random() - 0.5)
            .slice(0, count - 1);
        
        otherWords.forEach(word => {
            options.push({
                text: word.meanings[0]?.definition || '暂无释义',
                correct: false
            });
        });
        
        // 随机排序
        return options.sort(() => Math.random() - 0.5);
    }

    // 选择题控制
    getMultipleChoiceControls() {
        return `
            <button class="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors hidden" id="next-question-btn">
                下一题
            </button>
        `;
    }

    // 绑定选择题事件
    bindMultipleChoiceEvents(currentWord) {
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const isCorrect = e.target.dataset.correct === 'true';
                const userAnswer = e.target.textContent.replace(/^[A-Z]\.\s/, '');
                
                // 记录答题结果
                this.dataManager.recordAnswer(
                    currentWord.word, 
                    userAnswer, 
                    isCorrect, 
                    0
                );
                
                // 显示所有选项的正确/错误状态
                document.querySelectorAll('.option-btn').forEach(b => {
                    b.classList.remove('correct', 'incorrect');
                    if (b.dataset.correct === 'true') {
                        b.classList.add('correct');
                    } else {
                        b.classList.add('incorrect');
                    }
                    b.disabled = true;
                });
                
                // 更新正确计数
                if (isCorrect) {
                    this.correctAnswers++;
                }
                
                // 显示下一题按钮
                const nextBtn = document.getElementById('next-question-btn');
                if (nextBtn) {
                    nextBtn.classList.remove('hidden');
                }
            });
        });
        
        const nextBtn = document.getElementById('next-question-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.showNextQuestion();
            });
        }
    }

    // 拼写问题
    getSpellingQuestion(word) {
        const definition = word.meanings[0]?.definition || '暂无释义';
        
        return `
            <div class="spelling-practice">
                <div class="text-center mb-8">
                    <h4 class="text-xl font-bold text-secondary mb-4">根据释义拼写单词</h4>
                    <div class="bg-blue-50 p-4 rounded-lg mb-4">
                        <p class="text-lg text-gray-700">${definition}</p>
                    </div>
                </div>
                
                <div class="spelling-input-area mb-6">
                    <input type="text" 
                           class="w-full p-4 border-2 border-gray-300 rounded-lg focus:border-primary focus:outline-none text-center text-xl" 
                           placeholder="输入英文单词" 
                           id="spelling-input"
                           autocomplete="off"
                           autocorrect="off"
                           autocapitalize="off"
                           spellcheck="false">
                </div>
                
                <div class="spelling-hints mb-4">
                    <div class="flex justify-between items-center text-sm text-gray-500">
                        <span>单词长度: <span id="word-length">${word.word.length}</span> 个字母</span>
                        <button class="text-primary hover:text-secondary transition-colors" id="show-first-letter">
                            <i class="fas fa-lightbulb mr-1"></i>显示首字母
                        </button>
                    </div>
                    <div class="mt-2 text-center hidden" id="first-letter-hint">
                        <span class="text-lg font-mono bg-yellow-100 px-2 py-1 rounded">${word.word[0]}</span>
                    </div>
                </div>
                
                <div class="spelling-feedback hidden" id="spelling-feedback">
                    <!-- 反馈内容动态生成 -->
                </div>
            </div>
        `;
    }

    // 拼写控制
    getSpellingControls() {
        return `
            <button class="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors" id="skip-spelling-btn">
                <i class="fas fa-forward mr-2"></i>跳过
            </button>
            <button class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors" id="check-spelling-btn">
                <i class="fas fa-check mr-2"></i>检查
            </button>
            <button class="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors hidden" id="next-spelling-btn">
                <i class="fas fa-arrow-right mr-2"></i>下一题
            </button>
        `;
    }

    // 绑定拼写事件
    bindSpellingEvents(currentWord) {
        const spellingInput = document.getElementById('spelling-input');
        const checkBtn = document.getElementById('check-spelling-btn');
        const skipBtn = document.getElementById('skip-spelling-btn');
        const nextBtn = document.getElementById('next-spelling-btn');
        const showFirstLetterBtn = document.getElementById('show-first-letter');
        const firstLetterHint = document.getElementById('first-letter-hint');
        
        // 聚焦输入框
        if (spellingInput) spellingInput.focus();
        
        // 检查按钮点击事件
        if (checkBtn) {
            checkBtn.addEventListener('click', () => {
                this.checkSpellingAnswer(currentWord);
            });
        }
        
        // 跳过按钮点击事件
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                // 记录跳过答题
                this.dataManager.recordAnswer(
                    currentWord.word, 
                    '跳过', 
                    false, 
                    0
                );
                this.showSpellingFeedback(currentWord, false);
            });
        }
        
        // 下一题按钮点击事件
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.showNextQuestion();
            });
        }
        
        // 显示首字母提示
        if (showFirstLetterBtn && firstLetterHint) {
            showFirstLetterBtn.addEventListener('click', () => {
                firstLetterHint.classList.remove('hidden');
                showFirstLetterBtn.disabled = true;
                showFirstLetterBtn.classList.add('opacity-50', 'cursor-not-allowed');
            });
        }
        
        // 回车键检查答案
        if (spellingInput) {
            spellingInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.checkSpellingAnswer(currentWord);
                }
            });
            
            // 实时验证输入（只允许字母和空格）
            spellingInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^a-zA-Z\s]/g, '');
            });
        }
    }

    // 检查拼写答案
    checkSpellingAnswer(currentWord) {
        const spellingInput = document.getElementById('spelling-input');
        if (!spellingInput) return;
        
        const userAnswer = spellingInput.value.trim().toLowerCase();
        const correctAnswer = currentWord.word.toLowerCase();
        
        if (!userAnswer) {
            this.showMessage('请输入单词', 'warning');
            return;
        }
        
        const isCorrect = userAnswer === correctAnswer;
        
        // 记录答题结果
        this.dataManager.recordAnswer(
            currentWord.word, 
            userAnswer, 
            isCorrect, 
            0
        );
        
        if (isCorrect) {
            this.correctAnswers++;
        }
        
        this.showSpellingFeedback(currentWord, isCorrect);
    }

    // 显示拼写反馈
    showSpellingFeedback(currentWord, isCorrect) {
        const spellingInput = document.getElementById('spelling-input');
        const checkBtn = document.getElementById('check-spelling-btn');
        const skipBtn = document.getElementById('skip-spelling-btn');
        const nextBtn = document.getElementById('next-spelling-btn');
        const feedbackArea = document.getElementById('spelling-feedback');
        
        // 禁用输入和检查按钮
        if (spellingInput) spellingInput.disabled = true;
        if (checkBtn) checkBtn.classList.add('hidden');
        if (skipBtn) skipBtn.classList.add('hidden');
        if (nextBtn) nextBtn.classList.remove('hidden');
        
        // 显示反馈
        const feedbackHTML = this.getSpellingFeedbackHTML(currentWord, isCorrect);
        if (feedbackArea) {
            feedbackArea.innerHTML = feedbackHTML;
            feedbackArea.classList.remove('hidden');
        }
        
        // 如果答案错误，显示正确拼写
        if (spellingInput) {
            if (!isCorrect) {
                spellingInput.value = currentWord.word;
                spellingInput.classList.add('incorrect');
            } else {
                spellingInput.classList.add('correct');
            }
        }
    }

    // 获取拼写反馈HTML
    getSpellingFeedbackHTML(currentWord, isCorrect) {
        const definition = currentWord.meanings[0]?.definition || '暂无释义';
        const example = currentWord.meanings[0]?.examples?.[0] || '';
        const phonetic = currentWord.phonetic || '';
        
        return `
            <div class="bg-${isCorrect ? 'green' : 'red'}-50 border border-${isCorrect ? 'green' : 'red'}-200 rounded-lg p-4 mt-4">
                <div class="flex items-center mb-3">
                    <i class="fas fa-${isCorrect ? 'check-circle text-green-500' : 'times-circle text-red-500'} text-xl mr-2"></i>
                    <span class="font-semibold text-${isCorrect ? 'green' : 'red'}-700">
                        ${isCorrect ? '拼写正确！' : '拼写错误'}
                    </span>
                </div>
                
                <div class="word-details bg-white rounded p-3">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xl font-bold text-secondary">${currentWord.word}</span>
                        <span class="text-gray-500">${phonetic}</span>
                    </div>
                    
                    <div class="text-left">
                        <p class="text-gray-700 mb-2">${definition}</p>
                        ${example ? `<p class="text-sm text-gray-500 italic">例句: ${example}</p>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // 完成练习
    async finishPractice() {
        const accuracy = Math.round((this.correctAnswers / this.totalQuestions) * 100);
        const practiceArea = document.getElementById('practice-area');
        const controls = document.getElementById('practice-controls');
        
        if (!practiceArea || !controls) return;
        
        practiceArea.innerHTML = `
            <div class="text-center py-8">
                <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-500 text-2xl mx-auto mb-4">
                    <i class="fas fa-trophy"></i>
                </div>
                <h3 class="text-xl font-bold text-secondary mb-2">练习完成！</h3>
                <p class="text-gray-600 mb-4">你在本次练习中的表现</p>
                <div class="text-3xl font-bold text-primary mb-2">${accuracy}%</div>
                <p class="text-gray-500">正确率</p>
                
                <div class="mt-6 grid grid-cols-2 gap-4 max-w-xs mx-auto">
                    <div class="bg-blue-50 p-3 rounded-lg">
                        <div class="text-2xl font-bold text-blue-600">${this.correctAnswers}</div>
                        <div class="text-sm text-gray-600">正确</div>
                    </div>
                    <div class="bg-red-50 p-3 rounded-lg">
                        <div class="text-2xl font-bold text-red-600">${this.totalQuestions - this.correctAnswers}</div>
                        <div class="text-sm text-gray-600">错误</div>
                    </div>
                </div>
            </div>
        `;
        
        controls.innerHTML = `
            <button class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors" id="restart-practice-btn">
                <i class="fas fa-redo mr-2"></i>再练习一次
            </button>
            <button class="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors" id="close-practice-btn">
                <i class="fas fa-times mr-2"></i>结束练习
            </button>
        `;
        
        const restartBtn = document.getElementById('restart-practice-btn');
        const closeBtn = document.getElementById('close-practice-btn');
        
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                this.startPractice(this.currentPractice);
            });
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('practice-modal').classList.add('hidden');
            });
        }
        
        // 保存训练数据
        await this.dataManager.endTrainingSession({
            accuracy_rate: accuracy,
            total_questions: this.totalQuestions,
            correct_answers: this.correctAnswers
        });
        
        // 更新用户进度
        this.updateUserProgress(accuracy);
    }

    // 更新用户进度
    updateUserProgress(accuracy) {
        console.log(`用户练习完成，正确率: ${accuracy}%`);
        this.showMessage(`练习完成！正确率: ${accuracy}%`, 'success');
    }

    // 开始智能学习
    startSmartLearning() {
        if (!this.isAuthenticated) {
            this.showLoginRequired();
            this.showMessage('请先登录后使用此功能', 'warning');
            return;
        }
        
        console.log('🧠 开始智能学习');
        
        // 基于用户进度选择最佳学习模式
        const reviewWords = this.getWordsForReview();
        if (reviewWords.length > 0) {
            this.startPractice('flashcard');
        } else {
            this.startPractice('multiple-choice');
        }
    }

    // 获取需要复习的词汇
    getWordsForReview() {
        if (!this.userProgress?.wordProgress) return [];
        
        const now = new Date();
        return Object.entries(this.userProgress.wordProgress)
            .filter(([id, progress]) => 
                progress.status === 'reviewing' && 
                new Date(progress.nextReview) <= now
            )
            .slice(0, 10)
            .map(([id, progress]) => {
                const word = this.findWordById(id);
                return word ? { ...word, progress } : null;
            })
            .filter(Boolean);
    }

    // 通过ID查找词汇
    findWordById(id) {
        if (!this.vocabularyData || !this.vocabularyData.vocabulary) return null;
        
        return this.vocabularyData.vocabulary.find(w => w.id === id) || null;
    }

    // 显示消息
    showMessage(message, type = 'info') {
        const toast = document.getElementById('message-toast');
        const icon = document.getElementById('message-icon');
        const text = document.getElementById('message-text');
        
        if (!toast || !icon || !text) return;
        
        // 设置图标和颜色
        const icons = {
            success: 'fa-check-circle text-green-500',
            error: 'fa-exclamation-circle text-red-500',
            warning: 'fa-exclamation-triangle text-yellow-500',
            info: 'fa-info-circle text-primary'
        };
        
        const borderColors = {
            success: 'border-green-500',
            error: 'border-red-500',
            warning: 'border-yellow-500',
            info: 'border-primary'
        };
        
        icon.className = `fas ${icons[type] || icons.info} text-xl mr-3`;
        toast.className = `fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg border-l-4 p-4 min-w-80 transform transition-all fade-in ${borderColors[type] || borderColors.info}`;
        text.textContent = message;
        
        toast.classList.remove('hidden');
        
        // 3秒后自动隐藏
        setTimeout(() => {
            this.hideMessage();
        }, 3000);
    }

    hideMessage() {
        const messageToast = document.getElementById('message-toast');
        if (messageToast) {
            messageToast.classList.add('hidden');
        }
    }

    // 添加重新同步方法
    async resyncData() {
        if (!this.isAuthenticated) return;
        
        console.log('🔄 手动重新同步数据');
        
        if (this.dataManager) {
            await this.dataManager.syncPendingActivities();
        }
        
        // 重新加载进度数据
        await this.loadUserProgress();
        this.updateProgressCards();
    }

    // 示例数据
    getSampleData() {
        return {
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
                }
            ]
        };
    }

    // 默认进度数据
    getDefaultProgress() {
        return {
            userId: this.currentUser?.id || 1,
            statistics: {
                totalWordsLearned: 156,
                masteredWords: 120,
                wordsToReview: 23,
                todayWords: 12,
                accuracyRate: 87,
                dueWords: 18,
                learnedWords: 156,
                totalWords: 324,
                studyDays: 24
            },
            wordProgress: {},
            lastStudyDate: new Date().toISOString()
        };
    }
}

// 修复版词汇训练数据管理器
class VocabularyDataManager {
    constructor(vocabularyManager) {
        this.vocabularyManager = vocabularyManager;
        this.currentSession = null;
        this.questionStartTime = null;
        this.pendingActivities = []; // 待同步的活动
    }

    // 开始训练会话
    startTrainingSession(activityType) {
        this.currentSession = {
            activity_type: activityType,
            start_time: Date.now(),
            activity_data: {
                correct_answers: 0,
                incorrect_answers: 0,
                words_studied: [],
                answers: []
            }
        };
        this.questionStartTime = Date.now();
        
        console.log(`🎯 开始${activityType}训练会话`);
    }

    // 记录答题结果
    recordAnswer(word, userAnswer, isCorrect, timeSpent) {
        if (!this.currentSession) return;

        // 计算时间花费（如果未提供）
        const actualTimeSpent = timeSpent || Math.floor((Date.now() - this.questionStartTime) / 1000);
        
        this.currentSession.activity_data.answers.push({
            word,
            user_answer: userAnswer,
            is_correct: isCorrect,
            time_spent: actualTimeSpent,
            timestamp: new Date().toISOString()
        });

        if (isCorrect) {
            this.currentSession.activity_data.correct_answers++;
        } else {
            this.currentSession.activity_data.incorrect_answers++;
        }

        // 记录学习的单词
        if (!this.currentSession.activity_data.words_studied.includes(word)) {
            this.currentSession.activity_data.words_studied.push(word);
        }

        // 重置问题开始时间
        this.questionStartTime = Date.now();
        
        console.log(`📝 记录答题: ${word}, 正确: ${isCorrect}, 用时: ${actualTimeSpent}s`);
    }

    // 结束训练会话并保存数据
    async endTrainingSession(additionalData = {}) {
        if (!this.currentSession) {
            console.warn('⚠️ 没有活跃的训练会话');
            return null;
        }

        const endTime = Date.now();
        const duration = Math.floor((endTime - this.currentSession.start_time) / 1000);
        
        const {
            correct_answers = 0,
            incorrect_answers = 0,
            words_studied = []
        } = this.currentSession.activity_data;

        const total_questions = correct_answers + incorrect_answers;
        const score = total_questions > 0 ? Math.round((correct_answers / total_questions) * 100) : 0;

        const activityData = {
            activity_type: this.currentSession.activity_type,
            activity_data: this.currentSession.activity_data,
            duration: duration,
            time_spent: duration,
            score: score,
            total_questions: total_questions,
            correct_answers: correct_answers,
            study_words_count: words_studied.length,
            mastered_words_count: Math.floor(correct_answers * 0.8), // 假设80%的正确率算掌握
            date: new Date().toISOString().split('T')[0], // 确保日期格式正确
            ...additionalData
        };

        console.log('💾 准备保存训练数据:', activityData);

        try {
            const result = await this.saveTrainingData(activityData);
            this.currentSession = null;
            return result;
        } catch (error) {
            console.error('保存训练数据失败:', error);
            
            // 保存到待同步队列
            this.saveToPending(activityData);
            
            this.currentSession = null;
            return { 
                activity_id: 'pending_' + Date.now(),
                message: '保存失败，已加入待同步队列'
            };
        }
    }

    // 保存数据到后端 - 修复数据格式
    async saveTrainingData(activityData) {
        console.log('🔐 开始保存训练数据...');
        
        // 检查认证状态
        if (!this.vocabularyManager || !this.vocabularyManager.isAuthenticated) {
            console.warn('⚠️ 用户未登录，使用本地模式');
            return this.saveToLocalStorage(activityData);
        }

        const authToken = this.vocabularyManager.authToken;
        
        if (!authToken) {
            console.warn('⚠️ Token不存在，使用本地模式');
            return this.saveToLocalStorage(activityData);
        }

        // 确保数据格式完全匹配数据库字段
        const formattedData = {
            activity_type: activityData.activity_type,
            activity_data: activityData.activity_data, // 确保这是对象，API会处理JSON.stringify
            duration: parseInt(activityData.duration) || 0,
            time_spent: parseInt(activityData.time_spent) || 0,
            score: parseFloat(activityData.score) || 0,
            total_questions: parseInt(activityData.total_questions) || 0,
            correct_answers: parseInt(activityData.correct_answers) || 0,
            study_words_count: parseInt(activityData.study_words_count) || 0,
            mastered_words_count: parseInt(activityData.mastered_words_count) || 0,
            streak_bonus: parseInt(activityData.streak_bonus) || 0,
            date: activityData.date || new Date().toISOString().split('T')[0]
        };

        console.log('📤 发送格式化后的训练数据:', formattedData);

        try {
            const response = await fetch('/api/vocabulary/save-activity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(formattedData)
            });

            console.log('📥 服务器响应状态:', response.status, response.statusText);

            if (!response.ok) {
                let errorMessage = `HTTP错误: ${response.status}`;
                let errorDetails = '';
                
                try {
                    const errorResult = await response.json();
                    errorMessage = errorResult.message || errorMessage;
                    errorDetails = errorResult.error || '';
                    console.error('❌ 服务器错误详情:', errorResult);
                } catch (e) {
                    console.error('❌ 无法解析错误响应:', e);
                }
                
                if (response.status === 401 || response.status === 403) {
                    console.error('❌ 认证失败，清除本地状态');
                    this.handleAuthFailure();
                }
                
                throw new Error(`${errorMessage} ${errorDetails ? `- ${errorDetails}` : ''}`);
            }

            const result = await response.json();
            console.log('✅ 服务器响应数据:', result);
            
            if (result.success) {
                console.log('✅ 训练数据保存成功，ID:', result.data.activity_id);
                return result.data;
            } else {
                throw new Error(result.message || '保存失败');
            }
            
        } catch (error) {
            console.error('❌ 保存训练数据失败:', error);
            
            // 网络错误或服务器错误，保存到本地
            const localResult = this.saveToLocalStorage(activityData);
            
            // 显示友好的错误消息
            this.showSaveErrorToast(error.message);
            
            return localResult;
        }
    }

    // 保存到本地存储
    saveToLocalStorage(activityData) {
        const key = `vocab_activity_${Date.now()}`;
        const data = {
            ...activityData,
            saved_locally: true,
            local_timestamp: new Date().toISOString(),
            sync_status: 'pending'
        };
        
        try {
            localStorage.setItem(key, JSON.stringify(data));
            
            // 保存到待同步队列
            const pending = JSON.parse(localStorage.getItem('pending_vocab_activities') || '[]');
            pending.push({
                key: key,
                timestamp: data.local_timestamp,
                activity_type: activityData.activity_type
            });
            localStorage.setItem('pending_vocab_activities', JSON.stringify(pending));
            
            console.log('💾 数据已保存到本地存储:', key);
            
            return { 
                activity_id: 'local_' + Date.now(),
                local_key: key,
                message: '数据已保存到本地（网络连接问题）'
            };
        } catch (e) {
            console.error('❌ 本地存储失败:', e);
            return { 
                activity_id: 'memory_' + Date.now(),
                message: '数据仅保存在内存中'
            };
        }
    }

    // 保存到待同步队列
    saveToPending(activityData) {
        const pending = JSON.parse(localStorage.getItem('pending_vocab_activities') || '[]');
        pending.push({
            data: activityData,
            timestamp: new Date().toISOString(),
            attempts: 0
        });
        localStorage.setItem('pending_vocab_activities', JSON.stringify(pending));
    }

    // 认证失败处理
    handleAuthFailure() {
        console.log('🔐 认证失败，清除本地认证信息');
        
        // 清除所有可能的token存储
        const tokenKeys = ['moyu_token', 'auth_token', 'token'];
        const userKeys = ['moyu_user', 'user_data', 'user'];
        
        tokenKeys.forEach(key => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        });
        userKeys.forEach(key => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        });
        
        // 通知词汇管理器更新状态
        if (this.vocabularyManager) {
            this.vocabularyManager.isAuthenticated = false;
            this.vocabularyManager.currentUser = null;
            this.vocabularyManager.authToken = null;
            this.vocabularyManager.updateAuthUI();
        }
        
        // 显示重新登录提示
        this.showAuthErrorToast();
    }

    // 显示认证错误提示
    showAuthErrorToast() {
        if (window.unifiedAuthManager && window.unifiedAuthManager.showLoginPrompt) {
            window.unifiedAuthManager.showLoginPrompt('登录状态已过期，请重新登录');
        } else {
            // 创建自定义提示
            const toast = document.createElement('div');
            toast.className = 'fixed top-4 right-4 z-50 bg-red-50 border border-red-200 rounded-lg p-4 min-w-80 fade-in shadow-lg';
            toast.innerHTML = `
                <div class="flex items-start">
                    <i class="fas fa-exclamation-triangle text-red-500 text-xl mr-3 mt-0.5"></i>
                    <div class="flex-1">
                        <p class="font-semibold text-red-700 mb-1">登录状态已过期</p>
                        <p class="text-sm text-red-600 mb-2">学习数据将保存在本地，重新登录后自动同步</p>
                        <div class="flex gap-2">
                            <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                    class="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors">
                                稍后
                            </button>
                            <button onclick="window.location.href='云梦智间登录.html'" 
                                    class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors">
                                立即登录
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(toast);
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 10000);
        }
    }

    // 显示保存错误提示
    showSaveErrorToast(errorMessage) {
        const toast = document.createElement('div');
        toast.className = 'fixed top-20 right-4 z-50 bg-yellow-50 border border-yellow-200 rounded-lg p-4 min-w-80 fade-in shadow-lg';
        toast.innerHTML = `
            <div class="flex items-start">
                <i class="fas fa-info-circle text-yellow-500 text-xl mr-3 mt-0.5"></i>
                <div class="flex-1">
                    <p class="font-semibold text-yellow-700 mb-1">数据保存提示</p>
                    <p class="text-sm text-yellow-600 mb-1">学习数据已保存到本地</p>
                    <p class="text-xs text-yellow-500">错误: ${errorMessage}</p>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" 
                        class="text-yellow-500 hover:text-yellow-700 ml-2">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }

    // 尝试同步待处理的活动
    async syncPendingActivities() {
        if (!this.vocabularyManager?.isAuthenticated) return;
        
        const pending = JSON.parse(localStorage.getItem('pending_vocab_activities') || '[]');
        if (pending.length === 0) return;
        
        console.log(`🔄 尝试同步 ${pending.length} 个待处理活动`);
        
        const successfulSyncs = [];
        
        for (const item of pending) {
            try {
                const activityData = JSON.parse(localStorage.getItem(item.key));
                if (activityData) {
                    const result = await this.saveTrainingData(activityData);
                    if (result && !result.local_key) {
                        successfulSyncs.push(item.key);
                        localStorage.removeItem(item.key);
                    }
                }
            } catch (error) {
                console.error(`同步活动 ${item.key} 失败:`, error);
            }
        }
        
        // 更新待同步队列
        const updatedPending = pending.filter(item => !successfulSyncs.includes(item.key));
        localStorage.setItem('pending_vocab_activities', JSON.stringify(updatedPending));
        
        if (successfulSyncs.length > 0) {
            console.log(`✅ 成功同步 ${successfulSyncs.length} 个活动`);
            this.showSyncSuccessToast(successfulSyncs.length);
        }
    }

    // 显示同步成功提示
    showSyncSuccessToast(count) {
        const toast = document.createElement('div');
        toast.className = 'fixed top-20 right-4 z-50 bg-green-50 border border-green-200 rounded-lg p-4 min-w-80 fade-in shadow-lg';
        toast.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-check-circle text-green-500 text-xl mr-3"></i>
                <div>
                    <p class="font-semibold text-green-700">同步成功</p>
                    <p class="text-sm text-green-600">${count} 个学习记录已同步到服务器</p>
                </div>
            </div>
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }
}

// 初始化词汇管理器
let vocabularyManager;

document.addEventListener('DOMContentLoaded', function() {
    console.log('📚 初始化简化版词汇系统...');
    vocabularyManager = new SimplifiedVocabularyManager();
    vocabularyManager.init();
});

// 全局导出
window.vocabularyManager = vocabularyManager;
window.VocabularyDataManager = VocabularyDataManager;