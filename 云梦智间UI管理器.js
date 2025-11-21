// [file name]: 云梦智间UI管理器.js
// 统一UI管理器 - 处理所有页面的用户界面更新
class UIManager {
    constructor() {
        this.authManager = window.unifiedAuthManager || window.authManager;
        this.learningNotifications = [];
        this.pageModules = {};
        this.init();
    }

    async init() {
        // 等待认证系统初始化完成
        await this.waitForAuthManager();
        
        // 注册认证状态监听 - 增强版本
        if (this.authManager && this.authManager.addAuthListener) {
            this.authManager.addAuthListener((isLoggedIn, user, authState) => {
                console.log('🎯 UI管理器收到认证状态变化:', { isLoggedIn, user, authState });
                this.handleAuthStateChange(isLoggedIn, user, authState);
            });
        }

        // 初始更新UI
        this.handleAuthStateChange(
            this.authManager.isLoggedIn(), 
            this.authManager.getCurrentUser(),
            this.authManager.getAuthState()
        );
    }

    // 等待认证管理器初始化
    waitForAuthManager() {
        return new Promise((resolve) => {
            const check = () => {
                if (this.authManager && this.authManager.isInitialized) {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    // 处理认证状态变化 - 增强同步机制
    handleAuthStateChange(isLoggedIn, user, authState) {
        console.log('🔄 UI管理器处理认证状态变化:', { isLoggedIn, user });
        
        // 立即更新所有UI组件
        this.updateNavigationUI(isLoggedIn, user, authState);
        this.updateUserDropdown(isLoggedIn, user, authState);
        this.updatePageSpecificUI(isLoggedIn, user, authState);
        this.updateGlobalLearningStats(authState);
        this.updateUserInfo(user);
        this.updateAuthButtons(isLoggedIn, user);
        
        // 特别处理用户中心页面的同步
        this.syncUserCenterPage(isLoggedIn, user, authState);
        
        // 新增：特别处理日记页面的同步
        this.syncDiaryPage(isLoggedIn, user, authState);
        
        // 触发UI更新完成事件
        document.dispatchEvent(new CustomEvent('uiAuthStateUpdated', {
            detail: { isLoggedIn, user, authState }
        }));
    }

    // 同步用户中心页面
    syncUserCenterPage(isLoggedIn, user, authState) {
        // 如果当前在用户中心页面
        if (this.getCurrentPage() === 'user-center') {
            console.log('🔄 同步用户中心页面状态');
            
            // 如果用户中心管理器存在，直接调用其处理方法
            if (window.enhancedUserProfileManager) {
                window.enhancedUserProfileManager.handleAuthStateChange(isLoggedIn, user, authState);
            } else {
                // 如果管理器不存在，显示加载状态
                this.showUserCenterLoading();
            }
        }
    }

    // 同步日记页面
    syncDiaryPage(isLoggedIn, user, authState) {
        // 如果当前在日记页面
        if (this.getCurrentPage() === 'diary') {
            console.log('🔄 同步日记页面状态');
            
            // 如果日记管理器存在，直接调用其处理方法
            if (window.diaryManager) {
                window.diaryManager.handleGlobalAuthChange(isLoggedIn, user, authState);
            } else {
                // 如果管理器不存在，显示加载状态
                this.showDiaryLoading();
            }
        }
    }

    // 显示日记页面加载状态
    showDiaryLoading() {
        const contentList = document.getElementById('content-list');
        if (contentList) {
            contentList.innerHTML = `
                <div class="text-center py-12">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p class="text-gray-600">同步日记数据中...</p>
                </div>
            `;
        }
    }

    // 显示用户中心加载状态
    showUserCenterLoading() {
        const profileCard = document.getElementById('user-profile-card');
        if (profileCard) {
            profileCard.innerHTML = `
                <div class="text-center py-8">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p class="text-gray-600">同步用户数据中...</p>
                </div>
            `;
        }
    }

    // 增强状态同步方法
    enhancedSyncAllAuthStates() {
        console.log('🔄 UI管理器增强状态同步');
        
        // 获取最新认证状态
        const isLoggedIn = this.authManager.isLoggedIn();
        const user = this.authManager.getCurrentUser();
        const authState = this.authManager.getAuthState();
        
        // 同步所有UI组件
        this.updateNavigationUI(isLoggedIn, user, authState);
        this.updateUserDropdown(isLoggedIn, user, authState);
        this.updatePageSpecificUI(isLoggedIn, user, authState);
        this.updateGlobalLearningStats(authState);
        this.updateUserInfo(user);
        this.updateAuthButtons(isLoggedIn, user);
        
        // 特别处理关键页面
        this.syncCriticalPages(isLoggedIn, user, authState);
    }

    // 同步关键页面
    syncCriticalPages(isLoggedIn, user, authState) {
        const currentPage = this.getCurrentPage();
        console.log(`📍 同步关键页面: ${currentPage}`);
        
        switch (currentPage) {
            case 'diary':
                this.syncDiaryPageImmediately(isLoggedIn, user, authState);
                break;
            case 'user-center':
                this.syncUserCenterPageImmediately(isLoggedIn, user, authState);
                break;
            case 'test':
                this.syncTestPageImmediately(isLoggedIn, user, authState);
                break;
            case 'correction':
                this.syncCorrectionPageImmediately(isLoggedIn, user, authState);
                break;
            case 'listening':
                this.syncListeningPageImmediately(isLoggedIn, user, authState);
                break;
        }
    }

    // 立即同步日记页面
    syncDiaryPageImmediately(isLoggedIn, user, authState) {
        console.log('🚀 立即同步日记页面');
        if (window.diaryManager) {
            window.diaryManager.handleGlobalAuthChange(isLoggedIn, user, authState);
        } else {
            // 如果日记管理器不存在，显示加载状态
            this.showDiaryLoading();
            
            // 尝试重新初始化日记管理器
            setTimeout(() => {
                if (!window.diaryManager && window.DiaryManager) {
                    window.diaryManager = new window.DiaryManager();
                }
            }, 1000);
        }
    }

    // 立即同步用户中心
    syncUserCenterPageImmediately(isLoggedIn, user, authState) {
        console.log('🚀 立即同步用户中心');
        if (window.enhancedUserProfileManager) {
            window.enhancedUserProfileManager.handleAuthStateChange(isLoggedIn, user, authState);
        } else {
            this.showUserCenterLoading();
        }
    }

    // 立即同步测试页面
    syncTestPageImmediately(isLoggedIn, user, authState) {
        console.log('🚀 立即同步测试页面');
        this.updateTestUI(isLoggedIn, user, authState);
    }

    // 立即同步批改页面
    syncCorrectionPageImmediately(isLoggedIn, user, authState) {
        console.log('🚀 立即同步批改页面');
        this.updateCorrectionUI(isLoggedIn, user, authState);
    }

    // 立即同步听力页面
    syncListeningPageImmediately(isLoggedIn, user, authState) {
        console.log('🚀 立即同步听力页面');
        this.updateListeningUI(isLoggedIn, user, authState);
    }

    // 更新用户信息显示
    updateUserInfo(userData) {
        if (!userData) return;
        
        // 更新导航栏用户信息
        const userAvatar = document.getElementById('user-avatar-sidebar');
        const userName = document.getElementById('user-name-sidebar');
        const userStatus = document.getElementById('user-status-sidebar');
        
        if (userAvatar) {
            userAvatar.src = userData.avatar || 'https://ui-avatars.com/api/?name=User&background=2962FF&color=fff&size=128';
        }
        if (userName) {
            userName.textContent = userData.name || '用户';
        }
        if (userStatus) {
            userStatus.textContent = userData.memberLevel === 'vip' ? 'VIP会员' : 
                                   userData.memberLevel === 'premium' ? '高级会员' : '普通用户';
            userStatus.className = userData.memberLevel === 'vip' ? 
                'text-xs text-yellow-600 font-medium' : 
                userData.memberLevel === 'premium' ? 'text-xs text-purple-600 font-medium' : 
                'text-xs text-gray-500';
        }
    }

    // 更新认证按钮状态
    updateAuthButtons(isLoggedIn, userData) {
        const loginBtnContainer = document.getElementById('login-btn-container');
        if (!loginBtnContainer) return;
        
        if (isLoggedIn && userData) {
            loginBtnContainer.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="flex items-center gap-2 bg-gray-100 rounded-full pl-2 pr-4 py-1">
                        <img src="${userData.avatar || 'https://ui-avatars.com/api/?name=User&background=2962FF&color=fff&size=32'}" 
                             class="w-8 h-8 rounded-full" alt="用户头像">
                        <span class="text-sm font-medium text-gray-700">${userData.name || '用户'}</span>
                    </div>
                    <button onclick="unifiedAuthManager.logout()" 
                            class="text-sm text-gray-600 hover:text-gray-800 transition-colors">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            `;
        } else {
            loginBtnContainer.innerHTML = `
                <div class="flex items-center gap-3">
                    <a href="云梦智间登录.html" 
                       class="px-4 py-2 bg-primary text-white rounded-button hover:bg-secondary transition-colors text-sm font-medium">
                        <i class="fas fa-sign-in-alt mr-2"></i>登录
                    </a>
                    <a href="云梦智间注册.html" 
                       class="px-4 py-2 border border-gray-300 text-gray-700 rounded-button hover:bg-gray-50 transition-colors text-sm font-medium">
                        注册
                    </a>
                </div>
            `;
        }
    }

    // 更新全局学习统计显示
    updateGlobalLearningStats(authState) {
        const stats = authState?.learningProgress || {};
        
        // 更新学习统计显示元素
        const statsElements = {
            'learning-streak': stats.streak || 0,
            'total-study-time': this.formatStudyTime(stats.totalStudyTime || 0),
            'last-study-date': this.formatLastStudyDate(stats.lastStudyDate)
        };

        Object.keys(statsElements).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = statsElements[id];
            }
        });

        // 更新连续学习徽章
        this.updateStreakBadge(stats.streak);
    }

    // 格式化学习时间
    formatStudyTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;
    }

    // 格式化最后学习日期
    formatLastStudyDate(dateString) {
        if (!dateString) return '从未学习';
        const date = new Date(dateString);
        const today = new Date();
        const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return '今天';
        if (diffDays === 1) return '昨天';
        if (diffDays < 7) return `${diffDays}天前`;
        return date.toLocaleDateString();
    }

    // 更新连续学习徽章
    updateStreakBadge(streak) {
        const badge = document.getElementById('streak-badge');
        if (!badge) return;

        if (streak > 0) {
            badge.innerHTML = `
                <div class="flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                    <i class="fas fa-fire"></i>
                    <span>连续学习 ${streak} 天</span>
                </div>
            `;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    // 更新所有UI元素
    updateAllUI(isLoggedIn, user) {
        console.log('更新UI状态:', { isLoggedIn, user });
        
        this.updateNavigationUI(isLoggedIn, user);
        this.updateUserDropdown(isLoggedIn, user);
        this.updatePageSpecificUI(isLoggedIn, user);
        this.updateUserInfo(user);
        this.updateAuthButtons(isLoggedIn, user);
    }

    // 增强导航栏UI更新
    updateNavigationUI(isLoggedIn, user, authState) {
        const authSection = document.getElementById('auth-section');
        const loginBtnContainer = document.getElementById('login-btn-container');
        const userStatsSection = document.getElementById('user-stats-section');
        
        const targets = [];
        if (authSection) targets.push(authSection);
        if (loginBtnContainer) targets.push(loginBtnContainer);

        targets.forEach(container => {
            if (!container) return;

            if (isLoggedIn && user) {
                container.innerHTML = this.getEnhancedLoggedInHTML(user, authState);
                this.bindLogoutEvent(container);
            } else {
                container.innerHTML = this.getLoggedOutHTML();
            }
        });

        // 更新用户统计区域
        if (userStatsSection) {
            if (isLoggedIn && authState) {
                userStatsSection.innerHTML = this.getUserStatsHTML(authState);
            } else {
                userStatsSection.innerHTML = this.getGuestStatsHTML();
            }
        }
    }

    // 更新用户下拉菜单
    updateUserDropdown(isLoggedIn, user, authState) {
        const userDropdown = document.getElementById('user-dropdown');
        if (userDropdown) {
            if (isLoggedIn && user) {
                userDropdown.innerHTML = this.getEnhancedUserDropdownHTML(user, authState);
                this.bindLogoutEvent(userDropdown);
            } else {
                userDropdown.remove();
            }
        }
    }

    // 更新页面特定UI
    updatePageSpecificUI(isLoggedIn, user, authState) {
        const page = this.getCurrentPage();
        
        switch (page) {
            case 'vocabulary':
                this.updateVocabularyUI(isLoggedIn, user, authState);
                break;
            case 'spelling-practice':
                this.updateSpellingPracticeUI(isLoggedIn, user, authState);
                break;
            case 'community':
                this.updateCommunityUI(isLoggedIn, user, authState);
                break;
            case 'home':
                this.updateHomeUI(isLoggedIn, user, authState);
                break;
            case 'user-center':
                this.updateUserCenterUI(isLoggedIn, user, authState);
                break;
            case 'login':
                // 如果已经登录，重定向到首页或测试页
                if (isLoggedIn && user) {
                    const redirectParam = new URLSearchParams(window.location.search).get('redirect');
                    if (redirectParam) {
                        window.location.href = redirectParam;
                    } else {
                        window.location.href = '云梦智间首页.html';
                    }
                }
                break;
            case 'test':
                this.updateTestUI(isLoggedIn, user, authState);
                break;
            case 'correction':
                this.updateCorrectionUI(isLoggedIn, user, authState);
                break;
            case 'diary':
                this.updateDiaryUI(isLoggedIn, user, authState);
                break;
            case 'listening': // 新增听力页面处理
                this.updateListeningUI(isLoggedIn, user, authState);
                break;
        }
    }

    // 新增听力页面UI更新方法
    updateListeningUI(isLoggedIn, user, authState) {
        if (!isLoggedIn) {
            // 显示游客模式提示
            this.showGuestModeMessage();
            
            // 禁用部分功能或显示提示
            const guestMessage = document.getElementById('guest-mode-message');
            if (guestMessage) {
                guestMessage.style.display = 'block';
            }
        } else {
            // 隐藏游客提示
            const guestMessage = document.getElementById('guest-mode-message');
            if (guestMessage) {
                guestMessage.style.display = 'none';
            }
        }
    }

    // 更新日记页面UI
    updateDiaryUI(isLoggedIn, user, authState) {
        if (!isLoggedIn) {
            // 显示登录要求
            if (window.diaryManager) {
                window.diaryManager.showLoginRequired();
            }
        } else {
            // 确保日记管理器加载数据
            if (window.diaryManager && window.diaryManager.entries.length === 0) {
                window.diaryManager.loadInitialData();
            }
        }
    }

    // 获取当前页面类型
    getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('云梦智间词汇')) return 'vocabulary';
        if (path.includes('云梦智间拼写练习')) return 'spelling-practice';
        if (path.includes('云梦智间社区')) return 'community';
        if (path.includes('云梦智间首页') || path === '/') return 'home';
        if (path.includes('云梦智间登录')) return 'login';
        if (path.includes('云梦智间注册')) return 'register';
        if (path.includes('云梦智间用户')) return 'user-center';
        if (path.includes('云梦智间测试')) return 'test';
        if (path.includes('云梦智间批改')) return 'correction';
        if (path.includes('云梦智间日记')) return 'diary';
        if (path.includes('云梦智间听力')) return 'listening'; // 新增听力页面
        return 'other';
    }

    // 更新批改页面UI
    updateCorrectionUI(isLoggedIn, user, authState) {
        if (!isLoggedIn) {
            this.showGuestModeMessage();
            
            // 禁用批改功能
            const submitBtn = document.getElementById('submit-correction');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-lock mr-2"></i>请登录后使用';
                submitBtn.classList.remove('bg-primary', 'hover:bg-secondary');
                submitBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
            }
        } else {
            // 启用批改功能
            const submitBtn = document.getElementById('submit-correction');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-magic mr-2"></i>开始AI批改';
                submitBtn.classList.add('bg-primary', 'hover:bg-secondary');
                submitBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
            }
        }
    }

    // 更新测试页面UI
    updateTestUI(isLoggedIn, user, authState) {
        if (!isLoggedIn) {
            // 显示游客模式提示
            this.showGuestModeMessage();
            
            // 禁用部分测试功能
            const restrictedElements = document.querySelectorAll('.test-restricted');
            restrictedElements.forEach(element => {
                element.style.opacity = '0.6';
                element.style.pointerEvents = 'none';
                
                // 添加提示信息
                const tooltip = document.createElement('div');
                tooltip.className = 'text-sm text-gray-500 mt-2';
                tooltip.textContent = '请登录后使用此功能';
                element.appendChild(tooltip);
            });
        } else {
            // 启用所有测试功能
            const restrictedElements = document.querySelectorAll('.test-restricted');
            restrictedElements.forEach(element => {
                element.style.opacity = '1';
                element.style.pointerEvents = 'auto';
                
                // 移除提示信息
                const tooltip = element.querySelector('.text-sm.text-gray-500');
                if (tooltip) {
                    tooltip.remove();
                }
            });
        }
    }

    // 更新用户中心特定UI
    updateUserCenterUI(isLoggedIn, user, authState) {
        if (!isLoggedIn || !user) {
            // 如果未登录，跳转到登录页
            window.location.href = '云梦智间登录.html';
            return;
        }

        // 更新用户中心页面的用户信息
        this.updateUserProfileSection(user, authState);
    }

    // 更新用户资料区域
    updateUserProfileSection(user, authState) {
        const userAvatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');
        const userLevel = document.getElementById('member-level');
        const userId = document.getElementById('user-id');
        const userStats = document.getElementById('user-stats');

        if (userAvatar) userAvatar.src = user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=1580&auto=format&fit=crop';
        if (userName) userName.textContent = user.name;
        if (userLevel) userLevel.textContent = this.getUserLevel(authState?.learningProgress || {});
        if (userId) userId.textContent = `ID: ${user.username}`;
        if (userStats && authState) {
            userStats.innerHTML = this.getUserStatsHTML(authState);
        }
    }

    // 更新词汇页面UI
    updateVocabularyUI(isLoggedIn, user, authState) {
        if (!isLoggedIn) {
            // 显示游客模式内容
            this.showGuestModeMessage();
            
            // 更新进度显示
            const progressElements = {
                '#today-progress': this.getGuestProgressHTML(),
                '#mastered-words': this.getGuestMasteredHTML(),
                '#review-words': this.getGuestReviewHTML()
            };
            
            Object.keys(progressElements).forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    element.innerHTML = progressElements[selector];
                }
            });
        } else if (authState) {
            // 更新登录用户的学习数据
            this.updateUserLearningData(authState);
        }
    }

    // 更新拼写练习页面UI
    updateSpellingPracticeUI(isLoggedIn, user, authState) {
        if (!isLoggedIn) {
            this.showGuestModeMessage();
        }
    }

    // 更新社区页面UI
    updateCommunityUI(isLoggedIn, user, authState) {
        const newPostBtn = document.getElementById('new-post-btn');
        if (newPostBtn) {
            newPostBtn.style.display = isLoggedIn ? 'block' : 'none';
        }
    }

    // 更新首页UI
    updateHomeUI(isLoggedIn, user, authState) {
        // 首页特定的UI更新
        console.log('更新首页UI');
    }

    // 获取用户等级
    getUserLevel(stats) {
        const streak = stats.streak || 0;
        if (streak >= 30) return '学习大师';
        if (streak >= 15) return '学习达人';
        if (streak >= 7) return '积极学习者';
        return '新同学';
    }

    // 增强已登录状态的HTML
    getEnhancedLoggedInHTML(user, authState) {
        const stats = authState?.learningProgress || {};
        
        return `
            <div class="flex items-center gap-4">
                <!-- 学习统计 -->
                ${stats.streak ? `
                    <div class="hidden md:flex items-center gap-2 px-3 py-1 bg-orange-50 border border-orange-200 rounded-lg">
                        <i class="fas fa-fire text-orange-500"></i>
                        <span class="text-sm font-medium text-orange-700">${stats.streak}天</span>
                    </div>
                ` : ''}
                
                <!-- 用户菜单 -->
                <div class="relative group" id="user-dropdown">
                    <div class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        <img src="${user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=1580&auto=format&fit=crop'}" 
                             alt="${user.name}" 
                             class="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm">
                        <div class="hidden md:block text-left">
                            <p class="text-sm font-semibold text-gray-900 truncate max-w-[120px]">${user.name}</p>
                            <p class="text-xs text-gray-500">${this.getUserLevel(stats)}</p>
                        </div>
                        <i class="fas fa-chevron-down text-gray-400 text-xs"></i>
                    </div>
                    
                    <!-- 下拉菜单 -->
                    <div class="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 origin-top-right border border-gray-200">
                        <!-- 用户信息区域 -->
                        <div class="p-4 border-b border-gray-100">
                            <div class="flex items-center gap-3 mb-3">
                                <img src="${user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=1580&auto=format&fit=crop'}" 
                                     alt="${user.name}" 
                                     class="w-12 h-12 rounded-full object-cover border-2 border-blue-100">
                                <div class="flex-1 min-w-0">
                                    <p class="font-semibold text-gray-900 truncate">${user.name}</p>
                                    <p class="text-sm text-gray-500 truncate">${user.username}</p>
                                    <p class="text-xs text-blue-600 font-medium">${this.getUserLevel(stats)}</p>
                                </div>
                            </div>
                            
                            <!-- 学习统计 -->
                            ${this.getMiniStatsHTML(stats)}
                        </div>
                        
                        <!-- 菜单项 -->
                        <div class="py-2">
                            <a href="云梦智间用户.html" class="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-primary transition-colors group">
                                <i class="fas fa-user mr-3 w-4 text-center text-gray-400 group-hover:text-primary"></i>
                                <span>个人中心</span>
                            </a>
                            <a href="云梦智间学习分析.html" class="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-primary transition-colors group">
                                <i class="fas fa-chart-line mr-3 w-4 text-center text-gray-400 group-hover:text-primary"></i>
                                <span>学习分析</span>
                            </a>
                            <a href="云梦智间测试.html" class="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-primary transition-colors group">
                                <i class="fas fa-graduation-cap mr-3 w-4 text-center text-gray-400 group-hover:text-primary"></i>
                                <span>能力评估</span>
                            </a>
                            <a href="云梦智间日记.html" class="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-primary transition-colors group">
                                <i class="fas fa-book mr-3 w-4 text-center text-gray-400 group-hover:text-primary"></i>
                                <span>学习日记</span>
                            </a>
                            <div class="border-t border-gray-100 my-2"></div>
                            <a href="#" class="flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors group logout-btn">
                                <i class="fas fa-sign-out-alt mr-3 w-4 text-center"></i>
                                <span>退出登录</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 获取迷你统计HTML
    getMiniStatsHTML(stats) {
        return `
            <div class="grid grid-cols-3 gap-2 text-center">
                <div class="p-2 bg-gray-50 rounded-lg">
                    <p class="text-lg font-bold text-gray-900">${stats.streak || 0}</p>
                    <p class="text-xs text-gray-500">连续天数</p>
                </div>
                <div class="p-2 bg-gray-50 rounded-lg">
                    <p class="text-lg font-bold text-gray-900">${Math.round((stats.totalStudyTime || 0) / 3600)}</p>
                    <p class="text-xs text-gray-500">学习小时</p>
                </div>
                <div class="p-2 bg-gray-50 rounded-lg">
                    <p class="text-lg font-bold text-gray-900">${stats.lastStudyDate ? '🔥' : '😴'}</p>
                    <p class="text-xs text-gray-500">今日状态</p>
                </div>
            </div>
        `;
    }

    // 获取用户统计HTML
    getUserStatsHTML(authState) {
        const stats = authState.learningProgress || {};
        return `
            <div class="flex items-center gap-4 text-sm">
                <div class="flex items-center gap-2">
                    <i class="fas fa-fire text-orange-500"></i>
                    <span>连续学习 <strong>${stats.streak || 0}</strong> 天</span>
                </div>
                <div class="flex items-center gap-2">
                    <i class="fas fa-clock text-blue-500"></i>
                    <span>总计 <strong>${Math.round((stats.totalStudyTime || 0) / 3600)}</strong> 小时</span>
                </div>
            </div>
        `;
    }

    // 获取游客统计HTML
    getGuestStatsHTML() {
        return `
            <div class="flex items-center gap-2 text-sm text-gray-500">
                <i class="fas fa-info-circle"></i>
                <span>登录后记录学习进度</span>
            </div>
        `;
    }

    // 获取未登录状态的HTML
    getLoggedOutHTML() {
        return `
            <a href="云梦智间登录.html" class="flex items-center px-4 lg:px-6 py-2 bg-blue-50 text-primary rounded-button hover:bg-blue-100 transition-colors shadow-sm">
                <i class="fas fa-sign-in-alt mr-2"></i>
                <span class="whitespace-nowrap font-medium text-sm lg:text-base">登录</span>
            </a>
        `;
    }

    // 增强用户下拉菜单HTML
    getEnhancedUserDropdownHTML(user, authState) {
        const stats = authState?.learningProgress || {};
        
        return `
            <div class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <img src="${user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=1580&auto=format&fit=crop'}" 
                     alt="${user.name}" 
                     class="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm">
                <div class="hidden md:block text-left">
                    <p class="text-sm font-semibold text-gray-900 truncate max-w-[120px]">${user.name}</p>
                    <p class="text-xs text-gray-500">${this.getUserLevel(stats)}</p>
                </div>
                <i class="fas fa-chevron-down text-gray-400 text-xs"></i>
            </div>
            <div class="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 origin-top-right border border-gray-200">
                <!-- 用户信息区域 -->
                <div class="p-4 border-b border-gray-100">
                    <div class="flex items-center gap-3 mb-3">
                        <img src="${user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=1580&auto=format&fit=crop'}" 
                             alt="${user.name}" 
                             class="w-12 h-12 rounded-full object-cover border-2 border-blue-100">
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-gray-900 truncate">${user.name}</p>
                            <p class="text-sm text-gray-500 truncate">${user.username}</p>
                            <p class="text-xs text-blue-600 font-medium">${this.getUserLevel(stats)}</p>
                        </div>
                    </div>
                    
                    <!-- 学习统计 -->
                    ${this.getMiniStatsHTML(stats)}
                </div>
                
                <!-- 菜单项 -->
                <div class="py-2">
                    <a href="云梦智间用户.html" class="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-primary transition-colors group">
                        <i class="fas fa-user mr-3 w-4 text-center text-gray-400 group-hover:text-primary"></i>
                        <span>个人中心</span>
                    </a>
                    <a href="云梦智间学习分析.html" class="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-primary transition-colors group">
                        <i class="fas fa-chart-line mr-3 w-4 text-center text-gray-400 group-hover:text-primary"></i>
                        <span>学习分析</span>
                    </a>
                    <a href="云梦智间测试.html" class="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-primary transition-colors group">
                        <i class="fas fa-graduation-cap mr-3 w-4 text-center text-gray-400 group-hover:text-primary"></i>
                        <span>能力评估</span>
                    </a>
                    <a href="云梦智间日记.html" class="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-primary transition-colors group">
                        <i class="fas fa-book mr-3 w-4 text-center text-gray-400 group-hover:text-primary"></i>
                        <span>学习日记</span>
                    </a>
                    <div class="border-t border-gray-100 my-2"></div>
                    <a href="#" class="flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors group logout-btn">
                        <i class="fas fa-sign-out-alt mr-3 w-4 text-center"></i>
                        <span>退出登录</span>
                    </a>
                </div>
            </div>
        `;
    }

    // 绑定登出事件
    bindLogoutEvent(container) {
        const logoutBtn = container.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.authManager.logout();
            });
        }
    }

    // 显示游客模式提示
    showGuestModeMessage() {
        // 避免重复显示
        if (document.querySelector('.guest-mode-message')) return;

        const messageEl = document.createElement('div');
        messageEl.className = 'guest-mode-message fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-3 bg-blue-500 text-white rounded-lg z-50 shadow-lg';
        messageEl.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fas fa-info-circle"></i>
                <span>游客模式，部分功能受限。<a href="云梦智间登录.html" class="underline ml-1 font-semibold">立即登录</a></span>
            </div>
        `;
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 5000);
    }

    // 获取游客模式进度HTML
    getGuestProgressHTML() {
        return `
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-secondary mb-2">今日学习进度</h3>
                    <p class="text-gray-600 text-sm">请登录后查看学习进度</p>
                </div>
                <div class="w-16 h-16 relative">
                    <svg class="w-full h-full" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="none" stroke="#E0E0E0" stroke-width="2"/>
                        <circle cx="18" cy="18" r="16" fill="none" stroke="#E0E0E0" stroke-width="2" stroke-dasharray="100" stroke-linecap="round"/>
                    </svg>
                    <span class="absolute inset-0 flex items-center justify-center font-bold text-gray-400">0%</span>
                </div>
            </div>
            <div class="mt-4">
                <a href="云梦智间登录.html" class="w-full py-2 bg-blue-50 text-primary rounded-button hover:bg-blue-100 transition-colors block text-center font-medium">
                    <i class="fas fa-sign-in-alt mr-2"></i>立即登录
                </a>
            </div>
        `;
    }

    // 获取游客模式已掌握词汇HTML
    getGuestMasteredHTML() {
        return `
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-secondary mb-2">已掌握词汇</h3>
                    <p class="text-gray-600 text-sm">请登录后查看学习数据</p>
                </div>
                <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 text-2xl">
                    <i class="fas fa-user"></i>
                </div>
            </div>
        `;
    }

    // 获取游客模式复习词汇HTML
    getGuestReviewHTML() {
        return `
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-secondary mb-2">待复习词汇</h3>
                    <p class="text-gray-600 text-sm">请登录后使用复习功能</p>
                </div>
                <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 text-2xl">
                    <i class="fas fa-lock"></i>
                </div>
            </div>
        `;
    }

    // 更新用户学习数据
    updateUserLearningData(authState) {
        const stats = authState.learningProgress || {};
        
        // 更新学习进度显示
        const progressElements = {
            '#today-progress': this.getUserProgressHTML(stats),
            '#mastered-words': this.getUserMasteredHTML(stats),
            '#review-words': this.getUserReviewHTML(stats)
        };
        
        Object.keys(progressElements).forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.innerHTML = progressElements[selector];
            }
        });
    }

    // 获取用户进度HTML
    getUserProgressHTML(stats) {
        const progress = stats.todayProgress || 0;
        return `
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-secondary mb-2">今日学习进度</h3>
                    <p class="text-gray-600 text-sm">已完成 ${progress}%</p>
                </div>
                <div class="w-16 h-16 relative">
                    <svg class="w-full h-full" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="none" stroke="#E0E0E0" stroke-width="2"/>
                        <circle cx="18" cy="18" r="16" fill="none" stroke="#4F46E5" stroke-width="2" stroke-dasharray="100" stroke-dashoffset="${100 - progress}" stroke-linecap="round" transform="rotate(-90 18 18)"/>
                    </svg>
                    <span class="absolute inset-0 flex items-center justify-center font-bold text-primary">${progress}%</span>
                </div>
            </div>
        `;
    }

    // 获取用户已掌握词汇HTML
    getUserMasteredHTML(stats) {
        const mastered = stats.masteredWords || 0;
        return `
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-secondary mb-2">已掌握词汇</h3>
                    <p class="text-gray-600 text-sm">${mastered} 个词汇</p>
                </div>
                <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-500 text-2xl">
                    <i class="fas fa-check-circle"></i>
                </div>
            </div>
        `;
    }

    // 获取用户复习词汇HTML
    getUserReviewHTML(stats) {
        const review = stats.reviewWords || 0;
        return `
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-secondary mb-2">待复习词汇</h3>
                    <p class="text-gray-600 text-sm">${review} 个词汇待复习</p>
                </div>
                <div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-500 text-2xl">
                    <i class="fas fa-clock"></i>
                </div>
            </div>
        `;
    }

    // 显示消息提示
    showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `fixed top-20 right-6 px-6 py-3 rounded-lg z-50 transform transition-all duration-300 ${
            type === 'success' ? 'bg-green-500 text-white' : 
            type === 'error' ? 'bg-red-500 text-white' : 
            'bg-blue-500 text-white'
        } shadow-lg`;
        messageEl.textContent = message;
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 3000);
    }

    // 显示学习通知
    showLearningNotification(message, type = 'info', duration = 3000) {
        const notification = {
            id: Date.now(),
            message,
            type,
            duration
        };
        
        this.learningNotifications.push(notification);
        this.renderLearningNotifications();
        
        if (duration > 0) {
            setTimeout(() => {
                this.removeLearningNotification(notification.id);
            }, duration);
        }
        
        return notification.id;
    }

    // 渲染学习通知
    renderLearningNotifications() {
        let container = document.getElementById('learning-notifications');
        if (!container) {
            container = document.createElement('div');
            container.id = 'learning-notifications';
            container.className = 'fixed top-20 right-4 z-50 space-y-2';
            document.body.appendChild(container);
        }

        container.innerHTML = this.learningNotifications.map(notification => `
            <div class="learning-notification p-4 rounded-lg shadow-lg border-l-4 ${
                notification.type === 'success' ? 'bg-green-50 border-green-500 text-green-700' :
                notification.type === 'error' ? 'bg-red-50 border-red-500 text-red-700' :
                notification.type === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-700' :
                'bg-blue-50 border-blue-500 text-blue-700'
            } max-w-sm animate-slide-in-right" data-notification-id="${notification.id}">
                <div class="flex items-start">
                    <i class="fas ${
                        notification.type === 'success' ? 'fa-check-circle' :
                        notification.type === 'error' ? 'fa-exclamation-circle' :
                        notification.type === 'warning' ? 'fa-exclamation-triangle' :
                        'fa-info-circle'
                    } mt-1 mr-3"></i>
                    <div class="flex-1">
                        <p class="text-sm font-medium">${notification.message}</p>
                    </div>
                    <button onclick="window.uiManager.removeLearningNotification(${notification.id})" 
                            class="ml-4 text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // 移除学习通知
    removeLearningNotification(id) {
        this.learningNotifications = this.learningNotifications.filter(n => n.id !== id);
        this.renderLearningNotifications();
    }

    // 显示学习进度条
    showLearningProgress(message = '处理中...') {
        this.hideLearningProgress(); // 先隐藏已有的
        
        const progressHTML = `
            <div id="learning-progress" class="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
                <div class="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
                    <div class="flex items-center justify-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
                        <div>
                            <p class="text-gray-700 font-medium">${message}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', progressHTML);
    }

    // 隐藏学习进度条
    hideLearningProgress() {
        const progress = document.getElementById('learning-progress');
        if (progress) {
            progress.remove();
        }
    }

    // 显示学习确认对话框
    showLearningConfirmation(message, confirmText = '确认', cancelText = '取消') {
        return new Promise((resolve) => {
            const modalHTML = `
                <div id="learning-confirm-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
                    <div class="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
                        <div class="text-center mb-6">
                            <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 text-2xl mx-auto mb-4">
                                <i class="fas fa-question"></i>
                            </div>
                            <h3 class="text-lg font-semibold text-gray-800 mb-2">确认操作</h3>
                            <p class="text-gray-600">${message}</p>
                        </div>
                        
                        <div class="flex gap-3">
                            <button id="confirm-cancel" class="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                                ${cancelText}
                            </button>
                            <button id="confirm-ok" class="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-secondary transition-colors">
                                ${confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);

            const modal = document.getElementById('learning-confirm-modal');
            
            document.getElementById('confirm-cancel').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });

            document.getElementById('confirm-ok').addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    resolve(false);
                }
            });
        });
    }

    // 显示学习成就
    showLearningAchievement(title, description, icon = 'trophy') {
        const achievementHTML = `
            <div class="fixed top-4 left-1/2 transform -translate-x-1/2 z-60 animate-bounce-in">
                <div class="bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-xl p-4 shadow-2xl max-w-sm">
                    <div class="flex items-center">
                        <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-3">
                            <i class="fas fa-${icon} text-xl"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-lg">${title}</h4>
                            <p class="text-sm opacity-90">${description}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const existing = document.querySelector('.fixed.top-4.left-1\\/2');
        if (existing) {
            existing.remove();
        }

        document.body.insertAdjacentHTML('beforeend', achievementHTML);

        // 3秒后自动消失
        setTimeout(() => {
            const achievement = document.querySelector('.fixed.top-4.left-1\\/2');
            if (achievement) {
                achievement.remove();
            }
        }, 3000);
    }
}

// 创建全局UI管理器实例
const uiManager = new UIManager();

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slide-in-right {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes bounce-in {
        0% {
            transform: translateX(-50%) scale(0.3);
            opacity: 0;
        }
        50% {
            transform: translateX(-50%) scale(1.05);
        }
        70% {
            transform: translateX(-50%) scale(0.9);
        }
        100% {
            transform: translateX(-50%) scale(1);
            opacity: 1;
        }
    }
    
    .animate-slide-in-right {
        animation: slide-in-right 0.3s ease-out;
    }
    
    .animate-bounce-in {
        animation: bounce-in 0.6s ease-out;
    }
    
    .learning-notification {
        backdrop-filter: blur(8px);
    }
`;
document.head.appendChild(style);