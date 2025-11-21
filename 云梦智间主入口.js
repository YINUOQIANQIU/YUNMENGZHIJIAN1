// [file name]: 云梦智间主入口.js
// 应用程序主入口 - 协调所有模块
class AppMain {
    constructor() {
        this.modules = {};
        this.learningModules = {};
        this.analysisModules = {};
        this.globalState = {
            auth: null,
            learning: {},
            ui: {}
        };
        this.init();
    }

    async init() {
        console.log('🎯 初始化云梦智间应用程序...');
        
        // 等待认证系统初始化
        await this.waitForAuthSystem();
        
        // 初始化全局状态管理
        await this.initGlobalStateManager();
        
        // 初始化学习模块
        await this.initLearningModules();
        
        // 初始化AI分析模块
        await this.initAIAnalysisModules();
        
        // 根据当前页面初始化相应模块
        this.initPageSpecificModules();
        
        // 启动全局状态同步
        this.startGlobalStateSync();
        
        console.log('✅ 应用程序初始化完成', this.getGlobalState());
    }

    // 初始化全局状态管理器
    async initGlobalStateManager() {
        // 监听认证状态变化
        document.addEventListener('authSystemReady', (event) => {
            this.globalState.auth = event.detail;
            this.syncGlobalState();
        });

        // 监听UI状态更新
        document.addEventListener('uiAuthStateUpdated', (event) => {
            this.globalState.ui = event.detail;
            this.syncGlobalState();
        });

        // 监听学习进度更新
        document.addEventListener('learningProgressUpdated', (event) => {
            this.globalState.learning = event.detail;
            this.syncGlobalState();
        });

        // 初始同步
        this.syncGlobalState();
    }

    // 同步全局状态
    syncGlobalState() {
        // 保存到本地存储
        try {
            localStorage.setItem('moyu_global_state', JSON.stringify(this.globalState));
        } catch (error) {
            console.error('❌ 保存全局状态失败:', error);
        }

        // 触发全局状态更新事件
        document.dispatchEvent(new CustomEvent('globalStateUpdated', {
            detail: this.globalState
        }));

        console.log('🔄 全局状态已同步', this.globalState);
    }

    // 启动全局状态同步
    startGlobalStateSync() {
        // 定期同步学习进度到服务器
        setInterval(() => {
            this.syncLearningProgressToServer();
        }, 30000); // 每30秒同步一次

        // 定期检查会话状态
        setInterval(() => {
            this.checkSessionStatus();
        }, 60000); // 每1分钟检查一次
    }

    // 同步学习进度到服务器
    async syncLearningProgressToServer() {
        if (!this.isLoggedIn()) return;

        try {
            const authState = this.getAuthState();
            if (authState?.learningProgress) {
                await fetch('/api/learning/progress/sync', {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({
                        progress: authState.learningProgress,
                        timestamp: new Date().toISOString()
                    })
                });
            }
        } catch (error) {
            console.error('❌ 同步学习进度失败:', error);
        }
    }

    // 检查会话状态
    async checkSessionStatus() {
        if (this.isLoggedIn()) {
            const isValid = await window.unifiedAuthManager.validateSession();
            if (!isValid) {
                console.log('🔐 会话无效，需要重新登录');
                this.showSessionExpiredPrompt();
            }
        }
    }

    // 显示会话过期提示
    showSessionExpiredPrompt() {
        if (window.uiManager) {
            window.uiManager.showLearningConfirmation(
                '您的登录会话已过期，需要重新登录以继续使用完整功能',
                '立即登录',
                '稍后'
            ).then((confirmed) => {
                if (confirmed) {
                    window.location.href = '云梦智间登录.html';
                }
            });
        }
    }

    // 获取全局状态
    getGlobalState() {
        return this.globalState;
    }

    // 获取认证状态
    getAuthState() {
        return window.unifiedAuthManager ? window.unifiedAuthManager.getAuthState() : null;
    }

    // 获取认证头信息
    getAuthHeaders() {
        return window.unifiedAuthManager ? window.unifiedAuthManager.getAuthHeaders() : {};
    }

    // 等待认证系统就绪
    waitForAuthSystem() {
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

    // 初始化AI分析模块
    async initAIAnalysisModules() {
        // 初始化AI学习分析管理器
        if (window.AILearningAnalysis) {
            this.analysisModules.learningAnalysis = new AILearningAnalysis();
            
            // 如果用户已登录，初始化分析数据
            if (this.isLoggedIn()) {
                const user = this.getCurrentUser();
                await this.analysisModules.learningAnalysis.initialize(user.id);
                
                // 显示学习提醒
                this.analysisModules.learningAnalysis.showLearningReminder();
            }
        }

        // 初始化全局学习统计
        await this.initGlobalLearningStats();
    }

    // 初始化全局学习统计
    async initGlobalLearningStats() {
        if (!this.isLoggedIn()) return;

        try {
            const response = await fetch('/api/learning/global-stats', {
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.updateGlobalLearningStats(result.data);
                }
            }
        } catch (error) {
            console.error('❌ 获取全局学习统计失败:', error);
        }
    }

    // 更新全局学习统计
    updateGlobalLearningStats(stats) {
        // 更新导航栏或侧边栏的学习统计显示
        const statsElements = {
            'learning-streak': stats.streakDays || 0,
            'weekly-progress': stats.weeklyProgress || 0,
            'mastered-words': stats.masteredWords || 0,
            'today-tasks': stats.todayTasks || 0
        };

        Object.keys(statsElements).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = statsElements[id];
            }
        });

        // 触发全局学习统计更新事件
        document.dispatchEvent(new CustomEvent('learningStatsUpdated', {
            detail: stats
        }));
    }

    // 初始化学习模块
    async initLearningModules() {
        // 初始化学习统计
        if (window.LearningStatistics) {
            this.learningModules.statistics = new LearningStatistics();
        }

        // 初始化词汇学习管理器
        if (window.VocabularyManager) {
            this.learningModules.vocabulary = new VocabularyManager();
        }

        // 初始化预置词汇库
        if (window.PrebuiltVocabularyManager) {
            this.learningModules.prebuiltVocabulary = new PrebuiltVocabularyManager();
        }

        // 检查学习状态
        await this.checkLearningStatus();
    }

    // 检查学习状态
    async checkLearningStatus() {
        if (!this.isLoggedIn()) return;

        try {
            const response = await fetch('/api/learning/status', {
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.handleLearningStatus(result.data);
                }
            }
        } catch (error) {
            console.error('❌ 检查学习状态失败:', error);
        }
    }

    // 处理学习状态
    handleLearningStatus(status) {
        // 显示今日学习提醒
        if (status.hasPendingReviews) {
            this.showReviewReminder(status.pendingReviewCount);
        }

        // 显示学习成就
        if (status.newAchievements && status.newAchievements.length > 0) {
            status.newAchievements.forEach(achievement => {
                this.showAchievement(achievement);
            });
        }
    }

    // 显示复习提醒
    showReviewReminder(count) {
        if (count > 0) {
            const reminder = window.uiManager.showLearningNotification(
                `您有 ${count} 个单词需要复习`, 
                'info', 
                5000
            );
            
            // 添加点击事件跳转到学习页面
            setTimeout(() => {
                const notification = document.querySelector(`[data-notification-id="${reminder}"]`);
                if (notification) {
                    notification.style.cursor = 'pointer';
                    notification.addEventListener('click', () => {
                        this.startReviewSession();
                    });
                }
            }, 100);
        }
    }

    // 显示成就
    showAchievement(achievement) {
        window.uiManager.showLearningAchievement(
            achievement.title,
            achievement.description,
            achievement.icon
        );
    }

    // 开始复习会话
    startReviewSession() {
        if (this.learningModules.vocabulary) {
            this.learningModules.vocabulary.startIntelligentLearning();
        }
    }

    // 初始化页面特定模块
    initPageSpecificModules() {
        const path = window.location.pathname;
        const page = path.split('/').pop() || '';
        
        console.log('📍 当前页面:', page);

        // 新增测试页面识别
        if (page.includes('云梦智间测试') || page === '云梦智间测试.html') {
            this.initAssessmentModule();
        } else if (page.includes('云梦智间学习分析') || page === '云梦智间学习分析.html') {
            this.initLearningAnalysisModule();
        } else if (page.includes('云梦智间词汇') || page === '云梦智间词汇.html') {
            this.initVocabularyModule();
        } else if (page.includes('云梦智间社区') || page === '云梦智间社区.html') {
            this.initCommunityModule();
        } else if (page.includes('云梦智间首页') || page === '云梦智间首页.html' || page === '') {
            this.initHomeModule();
        } else if (page.includes('云梦智间拼写练习') || page === '云梦智间拼写练习.html') {
            this.initSpellingPracticeModule();
        } else if (page.includes('云梦智间用户') || page === '云梦智间用户.html') {
            this.initUserCenterModule();
        } else if (page.includes('云梦智间AI聊天') || page === '云梦智间AI聊天.html') {
            this.initAIChatModule();
        }
    }

    // 初始化评估模块
    initAssessmentModule() {
        console.log('📊 初始化能力评估模块');
        
        // 确保必要的JS文件已加载
        const scripts = [
            'js/assessment-questions.js',
            'js/ai-learning-analysis.js'
        ];
        
        this.loadScripts(scripts)
            .then(() => {
                console.log('✅ 能力评估模块加载完成');
                
                // 如果用户未登录，显示提示
                if (!this.isLoggedIn()) {
                    this.showAssessmentLoginPrompt();
                }
            })
            .catch(error => {
                console.error('❌ 能力评估模块加载失败:', error);
            });
    }

    // 初始化学习分析模块
    initLearningAnalysisModule() {
        console.log('📈 初始化学习分析模块');
        
        const scripts = [
            'js/ai-learning-analysis.js'
        ];
        
        this.loadScripts(scripts)
            .then(async () => {
                console.log('✅ 学习分析模块加载完成');
                
                // 如果用户已登录，初始化分析数据
                if (this.isLoggedIn()) {
                    const user = this.getCurrentUser();
                    await window.ailLearningAnalysis.initialize(user.id);
                    
                    // 触发分析数据加载完成事件
                    document.dispatchEvent(new CustomEvent('learningAnalysisReady'));
                } else {
                    // 未登录用户跳转到测试页面
                    window.location.href = '云梦智间测试.html';
                }
            })
            .catch(error => {
                console.error('❌ 学习分析模块加载失败:', error);
            });
    }

    // 初始化用户中心模块
    initUserCenterModule() {
        if (window.UserProfileManager && !window.userProfileManager) {
            window.userProfileManager = new UserProfileManager();
            this.modules.userCenter = window.userProfileManager;
        }
        
        // 初始化头像上传器
        if (window.AvatarUploader && !window.avatarUploader) {
            window.avatarUploader = new AvatarUploader();
        }
    }

    // 初始化词汇模块
    initVocabularyModule() {
        if (window.VocabularyManager && !window.vocabularyManager) {
            window.vocabularyManager = new VocabularyManager();
            this.modules.vocabulary = window.vocabularyManager;
            this.learningModules.vocabulary = window.vocabularyManager;
        }
        
        // 自动检查词汇库状态
        setTimeout(() => {
            this.checkVocabularyLibrary();
        }, 1000);
    }

    // 检查词汇库状态
    async checkVocabularyLibrary() {
        if (!this.isLoggedIn()) return;

        try {
            const response = await fetch('/api/vocabulary/status', {
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data.needInitialize) {
                    // 显示词汇库初始化提示
                    this.showVocabularyInitPrompt();
                }
            }
        } catch (error) {
            console.error('❌ 检查词汇库状态失败:', error);
        }
    }

    // 显示词汇库初始化提示
    showVocabularyInitPrompt() {
        const promptHTML = `
            <div class="fixed bottom-4 right-4 z-50">
                <div class="bg-white rounded-xl shadow-lg p-4 border-l-4 border-blue-500 max-w-sm">
                    <div class="flex items-start">
                        <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 mr-3">
                            <i class="fas fa-books"></i>
                        </div>
                        <div class="flex-1">
                            <h4 class="font-semibold text-gray-800 mb-1">初始化词汇库</h4>
                            <p class="text-sm text-gray-600 mb-3">开始使用完整的词汇学习功能</p>
                            <div class="flex gap-2">
                                <button id="init-vocabulary-now" class="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors">
                                    立即初始化
                                </button>
                                <button id="dismiss-vocabulary-prompt" class="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors">
                                    稍后
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', promptHTML);

        document.getElementById('init-vocabulary-now').addEventListener('click', () => {
            if (window.prebuiltVocabularyManager) {
                window.prebuiltVocabularyManager.showInitializationDialog();
            }
            document.querySelector('.fixed.bottom-4.right-4').remove();
        });

        document.getElementById('dismiss-vocabulary-prompt').addEventListener('click', () => {
            document.querySelector('.fixed.bottom-4.right-4').remove();
        });
    }

    // 初始化社区模块
    initCommunityModule() {
        // 先初始化社区认证管理器
        if (window.CommunityAuthManager && !window.communityAuthManager) {
            window.communityAuthManager = new CommunityAuthManager();
        }
        
        // 再初始化社区管理器
        if (window.CommunityManager && !window.communityManager) {
            window.communityManager = new CommunityManager();
            this.modules.community = window.communityManager;
        }
    }

    // 初始化首页模块
    initHomeModule() {
        // 首页特定的初始化逻辑
        console.log('🏠 初始化首页模块');
    }

    // 初始化拼写练习模块
    initSpellingPracticeModule() {
        if (window.SpellingPracticeManager && !window.spellingPracticeManager) {
            window.spellingPracticeManager = new SpellingPracticeManager();
            this.modules.spellingPractice = window.spellingPracticeManager;
        }
    }

    // 初始化AI聊天模块
    initAIChatModule() {
        console.log('🤖 初始化AI聊天模块');
        // 确保必要的JS文件已加载
        const scripts = [
            'js/ai-api-service.js',
            'js/ai-chat-manager.js'
        ];
        
        this.loadScripts(scripts)
            .then(() => {
                console.log('✅ AI聊天模块加载完成');
            })
            .catch(error => {
                console.error('❌ AI聊天模块加载失败:', error);
            });
    }

    // 动态加载多个JS文件
    loadScripts(sources) {
        return new Promise((resolve, reject) => {
            let loaded = 0;
            const total = sources.length;
            
            if (total === 0) {
                resolve();
                return;
            }
            
            sources.forEach(src => {
                this.loadScript(src)
                    .then(() => {
                        loaded++;
                        if (loaded === total) {
                            resolve();
                        }
                    })
                    .catch(reject);
            });
        });
    }

    // 动态加载单个JS文件
    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // 显示评估登录提示
    showAssessmentLoginPrompt() {
        const promptHTML = `
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div class="bg-white rounded-xl p-6 max-w-sm mx-4">
                    <div class="text-center mb-4">
                        <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 text-2xl mx-auto mb-3">
                            <i class="fas fa-graduation-cap"></i>
                        </div>
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">开始能力评估</h3>
                        <p class="text-gray-600 text-sm">登录后即可进行全面的能力评估，获取个性化学习路径</p>
                    </div>
                    
                    <div class="flex gap-3">
                        <button id="assessment-login-btn" class="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-secondary transition-colors">
                            立即登录
                        </button>
                        <button id="assessment-cancel-btn" class="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                            稍后再说
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', promptHTML);

        document.getElementById('assessment-login-btn').addEventListener('click', () => {
            window.location.href = '云梦智间登录.html?redirect=' + encodeURIComponent(window.location.href);
        });

        document.getElementById('assessment-cancel-btn').addEventListener('click', () => {
            document.querySelector('.fixed.inset-0').remove();
        });
    }

    // 获取模块实例
    getModule(name) {
        return this.modules[name];
    }

    // 获取学习模块
    getLearningModule(name) {
        return this.learningModules[name];
    }

    // 获取分析模块
    getAnalysisModule(name) {
        return this.analysisModules[name];
    }

    // 获取认证状态
    isLoggedIn() {
        return window.unifiedAuthManager ? window.unifiedAuthManager.isLoggedIn() : false;
    }

    // 获取当前用户
    getCurrentUser() {
        return window.unifiedAuthManager ? window.unifiedAuthManager.getCurrentUser() : null;
    }

    // 记录学习活动（增强版）
    recordLearningActivity(activityType, data) {
        if (window.unifiedAuthManager) {
            window.unifiedAuthManager.recordLearningActivity(activityType, data);
        }

        // 同时通知分析模块
        if (this.analysisModules.learningAnalysis) {
            this.analysisModules.learningAnalysis.recordLearningActivity({
                type: activityType,
                ...data,
                timestamp: new Date().toISOString()
            });
        }

        // 触发全局学习活动事件
        document.dispatchEvent(new CustomEvent('learningActivityRecorded', {
            detail: { type: activityType, data }
        }));
    }
}

// 创建全局应用程序实例
window.appMain = new AppMain();