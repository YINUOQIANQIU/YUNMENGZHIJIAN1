// [file name]: 云梦智间统一认证.js
class UnifiedAuthManager {
    constructor() {
        this.tokenKey = 'moyu_token';
        this.userKey = 'moyu_user';
        this.authStateKey = 'moyu_auth_state';
        this.baseURL = window.location.origin;
        this.currentUser = null;
        this.isInitialized = false;
        this.authListeners = [];
        this.globalState = {
            isLoggedIn: false,
            lastLogin: null,
            sessionExpiry: null,
            permissions: [],
            learningProgress: {}
        };
        
        // 绑定方法到全局
        window.unifiedAuthManager = this;
        window.authManager = this;
    }

    // 增强初始化方法
    async init() {
        if (this.isInitialized) return;
        
        console.log('🚀 初始化全局统一认证系统...');
        
        // 从本地存储恢复完整的认证状态
        await this.restoreGlobalAuthState();
        
        // 验证会话有效性
        await this.validateSession();
        
        this.isInitialized = true;
        
        console.log('✅ 全局认证系统初始化完成', this.getAuthState());
        
        // 立即通知状态变化
        this.notifyAuthChange();
        
        // 立即更新所有页面的UI状态
        this.updateAllPagesUI();
    }

    // 更新所有页面的UI状态
    updateAllPagesUI() {
        // 触发全局UI更新事件
        document.dispatchEvent(new CustomEvent('authSystemReady', {
            detail: this.getAuthState()
        }));
        
        // 更新所有UI组件
        this.updateAllUIComponents();
        
        // 如果UI管理器存在，强制更新UI
        if (window.uiManager) {
            window.uiManager.handleAuthStateChange(
                this.isLoggedIn(), 
                this.currentUser, 
                this.getAuthState()
            );
        }
    }

    // 恢复全局认证状态
    async restoreGlobalAuthState() {
        const token = localStorage.getItem(this.tokenKey);
        const userStr = localStorage.getItem(this.userKey);
        const stateStr = localStorage.getItem(this.authStateKey);
        
        // 恢复用户基本信息
        if (token && userStr) {
            try {
                this.currentUser = JSON.parse(userStr);
                console.log('📥 从本地存储恢复用户状态:', this.currentUser);
            } catch (error) {
                console.error('❌ 解析用户数据失败:', error);
                this.clearAuthData();
                return;
            }
        }

        // 恢复全局状态
        if (stateStr) {
            try {
                this.globalState = JSON.parse(stateStr);
                
                // 检查会话是否过期
                if (this.globalState.sessionExpiry && new Date() > new Date(this.globalState.sessionExpiry)) {
                    console.log('⏰ 会话已过期，自动登出');
                    this.clearAuthData();
                    return;
                }
            } catch (error) {
                console.error('❌ 解析全局状态失败:', error);
                this.globalState = this.getDefaultState();
            }
        }

        this.globalState.isLoggedIn = !!this.currentUser;
    }

    // 获取默认状态
    getDefaultState() {
        return {
            isLoggedIn: false,
            lastLogin: null,
            sessionExpiry: null,
            permissions: ['guest'],
            learningProgress: {
                streak: 0,
                lastStudyDate: null,
                totalStudyTime: 0
            }
        };
    }

    // 验证会话有效性
    async validateSession() {
        if (!this.currentUser) return false;

        try {
            const response = await fetch(`${this.baseURL}/api/user`, {
                headers: this.getAuthHeaders()
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // 更新用户信息
                    this.currentUser = result.data.user;
                    localStorage.setItem(this.userKey, JSON.stringify(this.currentUser));
                    
                    // 更新全局状态
                    this.updateGlobalState({
                        isLoggedIn: true,
                        lastLogin: new Date().toISOString(),
                        sessionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天后过期
                        permissions: ['user', 'study', 'assessment']
                    });
                    
                    return true;
                }
            }
            
            // 验证失败，清除数据
            this.clearAuthData();
            return false;
        } catch (error) {
            console.error('❌ Token验证失败:', error);
            // 网络错误时保持当前状态
            return true;
        }
    }

    // 更新全局状态
    updateGlobalState(updates) {
        this.globalState = { ...this.globalState, ...updates };
        this.saveGlobalState();
        this.notifyAuthChange();
    }

    // 保存全局状态
    saveGlobalState() {
        try {
            localStorage.setItem(this.authStateKey, JSON.stringify(this.globalState));
        } catch (error) {
            console.error('❌ 保存全局状态失败:', error);
        }
    }

    // 获取认证状态
    getAuthState() {
        return {
            isLoggedIn: this.globalState.isLoggedIn,
            user: this.currentUser,
            permissions: this.globalState.permissions,
            learningProgress: this.globalState.learningProgress,
            sessionExpiry: this.globalState.sessionExpiry
        };
    }

    // 增强登录方法
    async login(username, password, loginType = 'password') {
        try {
            console.log('🔐 开始登录:', { username, loginType });
            
            const response = await fetch(`${this.baseURL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    password,
                    loginType
                })
            });

            const result = await response.json();
            
            if (result.success) {
                // 保存token和用户信息
                localStorage.setItem(this.tokenKey, result.data.token);
                localStorage.setItem(this.userKey, JSON.stringify(result.data.user));
                
                this.currentUser = result.data.user;
                
                // 更新全局状态
                this.updateGlobalState({
                    isLoggedIn: true,
                    lastLogin: new Date().toISOString(),
                    sessionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    permissions: ['user', 'study', 'assessment', 'community']
                });

                console.log('✅ 登录成功:', this.getAuthState());
                
                // 更新所有页面的用户状态
                this.updateGlobalUserState();
                this.updateAllPagesUI();
                
                return result;
            } else {
                console.log('❌ 登录失败:', result.message);
                return result;
            }
        } catch (error) {
            console.error('❌ 登录请求失败:', error);
            return {
                success: false,
                message: '网络错误，请检查连接'
            };
        }
    }

    // 增强注册方法
    async register(userData) {
        try {
            const response = await fetch(`${this.baseURL}/api/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();
            
            if (result.success) {
                // 保存token和用户信息
                localStorage.setItem(this.tokenKey, result.data.token);
                localStorage.setItem(this.userKey, JSON.stringify(result.data.user));
                
                this.currentUser = result.data.user;
                
                // 更新全局状态
                this.updateGlobalState({
                    isLoggedIn: true,
                    lastLogin: new Date().toISOString(),
                    sessionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    permissions: ['user', 'study', 'assessment', 'community']
                });

                // 更新全局用户状态
                this.updateGlobalUserState();
                this.updateAllPagesUI();
                
                return result;
            } else {
                return result;
            }
        } catch (error) {
            console.error('❌ 注册失败:', error);
            return {
                success: false,
                message: '网络错误，请检查连接'
            };
        }
    }

    // 增强登出方法
    logout() {
        console.log('🚪 用户登出');
        
        // 记录登出时间
        if (this.globalState.isLoggedIn) {
            this.recordLearningActivity('logout', {
                duration: this.calculateSessionDuration()
            });
        }
        
        this.clearAuthData();
        this.notifyAuthChange();
        this.updateAllPagesUI();
        
        // 更新全局用户状态
        this.updateGlobalUserState();
        
        // 跳转到登录页
        setTimeout(() => {
            window.location.href = '云梦智间登录.html';
        }, 500);
    }

    // 计算会话时长
    calculateSessionDuration() {
        if (!this.globalState.lastLogin) return 0;
        const start = new Date(this.globalState.lastLogin);
        const end = new Date();
        return Math.round((end - start) / 1000); // 返回秒数
    }

    // 清理认证数据
    clearAuthData() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        localStorage.removeItem(this.authStateKey);
        this.currentUser = null;
        this.globalState = this.getDefaultState();
    }

    // 检查权限
    hasPermission(permission) {
        return this.globalState.permissions.includes(permission);
    }

    // 检查学习权限
    hasStudyPermission() {
        return this.hasPermission('study') && this.isLoggedIn();
    }

    // 检查评估权限
    hasAssessmentPermission() {
        return this.hasPermission('assessment') && this.isLoggedIn();
    }

    // 更新学习进度
    updateLearningProgress(progress) {
        if (!this.isLoggedIn()) return;
        
        this.globalState.learningProgress = {
            ...this.globalState.learningProgress,
            ...progress,
            lastUpdate: new Date().toISOString()
        };
        
        this.saveGlobalState();
        
        // 触发学习进度更新事件
        document.dispatchEvent(new CustomEvent('learningProgressUpdated', {
            detail: this.globalState.learningProgress
        }));
    }

    // 获取学习统计
    getLearningStats() {
        return this.globalState.learningProgress;
    }

    // 增强：验证学习会话
    async validateStudySession() {
        if (!this.isLoggedIn()) {
            return false;
        }
        
        // 检查会话过期
        if (this.globalState.sessionExpiry && new Date() > new Date(this.globalState.sessionExpiry)) {
            console.log('⏰ 学习会话已过期');
            this.clearAuthData();
            return false;
        }
        
        try {
            const response = await fetch(`${this.baseURL}/api/user/study-status`, {
                headers: this.getAuthHeaders()
            });
            
            return response.ok;
        } catch (error) {
            console.error('❌ 验证学习会话失败:', error);
            return false;
        }
    }

    // 增强：记录学习活动
    async recordLearningActivity(activityType, data = {}) {
        if (!this.isLoggedIn()) return;
        
        // 更新本地进度
        if (activityType === 'study_complete') {
            this.updateLearningProgress({
                streak: (this.globalState.learningProgress.streak || 0) + 1,
                lastStudyDate: new Date().toISOString(),
                totalStudyTime: (this.globalState.learningProgress.totalStudyTime || 0) + (data.duration || 0)
            });
        }
        
        try {
            await fetch(`${this.baseURL}/api/learning/activity`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    activityType,
                    data,
                    timestamp: new Date().toISOString(),
                    authState: this.getAuthState()
                })
            });
        } catch (error) {
            console.error('❌ 记录学习活动失败:', error);
        }
    }

    // 更新用户学习统计
    async updateUserLearningStats(activityData) {
        if (!this.isLoggedIn()) return;
        
        try {
            const response = await fetch(`${this.baseURL}/api/user/learning-stats`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(activityData)
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // 更新本地学习进度
                    this.updateLearningProgress(result.data.updatedProgress);
                }
            }
        } catch (error) {
            console.error('❌ 更新学习统计失败:', error);
        }
    }

    // 获取用户中心数据
    async getUserCenterData() {
        if (!this.isLoggedIn()) {
            return null;
        }
        
        try {
            const response = await fetch(`${this.baseURL}/api/user/profile`, {
                headers: this.getAuthHeaders()
            });
            
            if (response.ok) {
                const result = await response.json();
                return result.success ? result.data : null;
            }
        } catch (error) {
            console.error('❌ 获取用户中心数据失败:', error);
        }
        
        return null;
    }

    // 检查用户权限
    checkUserPermission(permission) {
        const userPermissions = {
            'basic': ['study', 'assessment', 'community_basic'],
            'premium': ['study', 'assessment', 'community', 'ai_tutor', 'premium_courses'],
            'vip': ['study', 'assessment', 'community', 'ai_tutor', 'premium_courses', 'live_courses', 'advanced_analytics']
        };
        
        const userLevel = this.currentUser?.memberLevel || 'basic';
        return userPermissions[userLevel]?.includes(permission) || false;
    }

    // 增强：强制同步用户状态到所有页面
    async syncUserStateToAllPages() {
        if (!this.isLoggedIn()) return;
        
        try {
            // 获取最新的用户信息
            const response = await fetch('/api/user/basic-info', {
                headers: this.getAuthHeaders()
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.currentUser = result.data.user;
                    localStorage.setItem(this.userKey, JSON.stringify(this.currentUser));
                    
                    // 通知所有监听器
                    this.notifyAuthChange();
                    
                    // 更新所有UI组件
                    this.updateAllUIComponents();
                }
            }
        } catch (error) {
            console.error('同步用户状态失败:', error);
        }
    }

    // 更新所有UI组件
    updateAllUIComponents() {
        // 更新导航栏
        this.updateNavigationBar();
        
        // 更新用户中心（如果存在）
        this.updateUserCenter();
        
        // 触发全局事件
        document.dispatchEvent(new CustomEvent('userStateUpdated', {
            detail: this.getAuthState()
        }));
    }

    // 更新导航栏
    updateNavigationBar() {
        // 更新导航栏用户信息
        const userAvatar = document.getElementById('user-avatar-sidebar');
        const userName = document.getElementById('user-name-sidebar');
        const userStatus = document.getElementById('user-status-sidebar');
        const authSection = document.getElementById('auth-section');
        
        if (this.currentUser) {
            // 更新头像
            if (userAvatar) {
                userAvatar.src = this.getValidAvatarUrl(this.currentUser.avatar);
                userAvatar.onerror = () => {
                    userAvatar.src = this.generateDefaultAvatar(this.currentUser.name || this.currentUser.username);
                };
            }
            
            // 更新用户名
            if (userName) {
                userName.textContent = this.currentUser.name || this.currentUser.username;
            }
            
            // 更新用户状态
            if (userStatus) {
                userStatus.textContent = this.getMemberLevelText(this.currentUser.memberLevel);
                userStatus.className = this.getMemberStatusClass(this.currentUser.memberLevel);
            }
            
            // 更新认证区域
            if (authSection) {
                authSection.innerHTML = this.generateLoggedInNavbar();
            }
        } else {
            // 显示登录按钮
            if (authSection) {
                authSection.innerHTML = this.generateLoggedOutNavbar();
            }
            
            // 重置侧边栏显示
            if (userName) userName.textContent = '游客';
            if (userStatus) {
                userStatus.textContent = '请登录';
                userStatus.className = 'text-xs text-gray-500';
            }
            if (userAvatar) {
                userAvatar.src = this.generateDefaultAvatar('Guest');
            }
        }
    }

    // 生成登录状态的导航栏HTML
    generateLoggedInNavbar() {
        return `
            <div class="flex items-center gap-4">
                <div class="flex items-center gap-3 bg-gray-50 rounded-full px-4 py-2">
                    <img src="${this.getValidAvatarUrl(this.currentUser.avatar)}" 
                         class="w-8 h-8 rounded-full" 
                         alt="用户头像"
                         onerror="this.src='${this.generateDefaultAvatar(this.currentUser.name || this.currentUser.username)}'">
                    <span class="text-sm font-medium text-gray-700">${this.currentUser.name || this.currentUser.username}</span>
                </div>
                <div class="flex items-center gap-2">
                    <a href="云梦智间用户.html" class="p-2 text-gray-600 hover:text-primary transition-colors" title="个人中心">
                        <i class="fas fa-user-circle"></i>
                    </a>
                    <button onclick="unifiedAuthManager.logout()" class="p-2 text-gray-600 hover:text-red-500 transition-colors" title="退出登录">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // 生成未登录状态的导航栏HTML
    generateLoggedOutNavbar() {
        return `
            <div class="flex items-center gap-3">
                <a href="云梦智间登录.html" class="px-4 py-2 bg-primary text-white rounded-button hover:bg-secondary transition-colors text-sm font-medium">
                    <i class="fas fa-sign-in-alt mr-2"></i>登录
                </a>
                <a href="云梦智间注册.html" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-button hover:bg-gray-50 transition-colors text-sm font-medium">
                    注册
                </a>
            </div>
        `;
    }

    // 获取有效的头像URL
    getValidAvatarUrl(avatarUrl) {
        if (!avatarUrl) {
            return this.generateDefaultAvatar('User');
        }
        
        // 检查URL是否有效
        try {
            new URL(avatarUrl);
            return avatarUrl;
        } catch {
            return this.generateDefaultAvatar('User');
        }
    }

    // 生成默认头像
    generateDefaultAvatar(name) {
        const colors = ['FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7', 'DDA0DD', '98D8C8', 'F7DC6F', 'BB8FCE', '85C1E9'];
        const color = colors[name.length % colors.length];
        const initial = name ? name.charAt(0).toUpperCase() : 'U';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=${color}&color=fff&size=128`;
    }

    // 获取会员等级文本
    getMemberLevelText(level) {
        const levels = {
            'vip': 'VIP会员',
            'premium': '高级会员',
            'basic': '普通会员'
        };
        return levels[level] || '普通会员';
    }

    // 获取会员状态样式
    getMemberStatusClass(level) {
        const classes = {
            'vip': 'text-xs text-yellow-600 font-medium',
            'premium': 'text-xs text-purple-600 font-medium', 
            'basic': 'text-xs text-gray-500'
        };
        return classes[level] || 'text-xs text-gray-500';
    }

    // 强制同步所有页面UI状态
    syncAllPagesUI() {
        console.log('🔄 强制同步所有页面UI状态');
        
        // 更新导航栏
        this.updateNavigationBar();
        
        // 更新用户中心（如果存在）
        this.updateUserCenter();
        
        // 触发全局事件
        document.dispatchEvent(new CustomEvent('authStateSynced', {
            detail: this.getAuthState()
        }));
        
        // 如果UI管理器存在，强制更新
        if (window.uiManager) {
            window.uiManager.handleAuthStateChange(
                this.isLoggedIn(), 
                this.currentUser, 
                this.getAuthState()
            );
        }
    }

    // 更新用户中心页面
    updateUserCenter() {
        // 如果当前在用户中心页面，触发重新加载
        if (window.location.pathname.includes('云梦智间用户.html')) {
            if (window.enhancedUserProfileManager) {
                // 直接调用用户中心管理器的处理方法
                window.enhancedUserProfileManager.handleAuthStateChange(
                    this.isLoggedIn(),
                    this.currentUser,
                    this.getAuthState()
                );
            } else {
                // 如果用户中心管理器尚未初始化，重新加载页面
                console.log('🔄 重新加载用户中心页面以同步状态');
                window.location.reload();
            }
        }
    }

    // 修复获取认证头的方法
    getAuthHeaders() {
        const token = this.getToken();
        console.log('🔐 当前Token:', token ? `存在 (${token.length}字符)` : '不存在');
        
        if (!token) {
            console.warn('⚠️ 未找到认证Token');
            return { 'Content-Type': 'application/json' };
        }
        
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        
        console.log('📤 发送认证头:', headers.Authorization ? '已设置' : '未设置');
        return headers;
    }

    // 其余现有方法保持不变...
    isLoggedIn() { return this.globalState.isLoggedIn; }
    getCurrentUser() { return this.currentUser; }
    getToken() { return localStorage.getItem(this.tokenKey); }
    addAuthListener(callback) { this.authListeners.push(callback); }
    removeAuthListener(callback) {
        this.authListeners = this.authListeners.filter(listener => listener !== callback);
    }
    notifyAuthChange() {
        console.log('🔔 通知认证状态变化:', this.getAuthState());
        this.authListeners.forEach(callback => {
            try { callback(this.isLoggedIn(), this.currentUser, this.getAuthState()); }
            catch (error) { console.error('❌ 认证监听器执行错误:', error); }
        });
        
        // 触发UI更新事件
        document.dispatchEvent(new CustomEvent('uiAuthStateUpdated', {
            detail: {
                isLoggedIn: this.isLoggedIn(),
                user: this.currentUser,
                authState: this.getAuthState()
            }
        }));
    }
    checkUsernameAvailable(username) {
        return fetch(`${this.baseURL}/api/check-username/${username}`)
            .then(response => response.json())
            .catch(error => {
                console.error('❌ 检查用户名失败:', error);
                return { available: false };
            });
    }
    showLoginPrompt() {
        if (window.uiManager && window.uiManager.showMessage) {
            window.uiManager.showMessage('请先登录后使用此功能', 'error');
        } else {
            alert('请先登录后使用此功能');
        }
        setTimeout(() => { window.location.href = '云梦智间登录.html'; }, 2000);
    }
    updateGlobalUserState() {
        // 更新所有UI组件
        this.updateAllUIComponents();
    }
}

// 创建全局统一认证管理器实例
const unifiedAuthManager = new UnifiedAuthManager();

// 页面加载完成后初始化认证系统
document.addEventListener('DOMContentLoaded', function() {
    unifiedAuthManager.init().then(() => {
        console.log('✅ 页面认证状态初始化完成:', unifiedAuthManager.getAuthState());
        
        // 立即更新用户状态显示
        unifiedAuthManager.updateGlobalUserState();
        
        // 触发全局认证就绪事件
        document.dispatchEvent(new CustomEvent('authSystemReady', {
            detail: unifiedAuthManager.getAuthState()
        }));
    });
});