// 社区认证管理器 - 专门处理社区相关认证
class CommunityAuthManager {
    constructor() {
        this.authManager = window.unifiedAuthManager;
        this.uiManager = window.uiManager;
        this.requiredPermissions = ['read_posts', 'write_posts', 'comment'];
        this.init();
    }

    init() {
        // 注册认证状态监听
        if (this.authManager && this.authManager.addAuthListener) {
            this.authManager.addAuthListener((isLoggedIn, user) => {
                this.handleAuthChange(isLoggedIn, user);
            });
        }

        // 初始状态处理
        this.handleAuthChange(this.authManager.isLoggedIn(), this.authManager.getCurrentUser());
    }

    // 处理认证状态变化
    handleAuthChange(isLoggedIn, user) {
        if (isLoggedIn && user) {
            this.handleCommunityLogin(user);
        } else {
            this.handleCommunityLogout();
        }
    }

    // 处理社区登录
    handleCommunityLogin(userData) {
        console.log('社区认证: 用户登录成功', userData);
        this.loadCommunityPermissions(userData.id);
    }

    // 处理社区登出
    handleCommunityLogout() {
        console.log('社区认证: 用户登出');
        this.clearCommunityData();
    }

    // 加载社区权限
    async loadCommunityPermissions(userId) {
        try {
            const permissions = await this.fetchUserPermissions(userId);
            this.storePermissions(permissions);
        } catch (error) {
            console.error('加载社区权限失败:', error);
        }
    }

    // 获取用户权限
    async fetchUserPermissions(userId) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    can_post: true,
                    can_comment: true,
                    can_like: true,
                    can_follow: true,
                    is_moderator: false
                });
            }, 500);
        });
    }

    // 存储权限
    storePermissions(permissions) {
        localStorage.setItem('community_permissions', JSON.stringify(permissions));
    }

    // 获取权限
    getPermissions() {
        const permissionsStr = localStorage.getItem('community_permissions');
        return permissionsStr ? JSON.parse(permissionsStr) : null;
    }

    // 清理社区数据
    clearCommunityData() {
        localStorage.removeItem('community_permissions');
    }

    // 检查社区访问权限
    checkCommunityAccess() {
        if (!this.authManager.isLoggedIn()) {
            this.showCommunityLoginPrompt();
            return false;
        }
        return true;
    }

    // 检查发帖权限
    checkPostPermission() {
        if (!this.checkCommunityAccess()) return false;
        
        const permissions = this.getPermissions();
        if (!permissions || !permissions.can_post) {
            this.showPermissionDenied('发帖');
            return false;
        }
        return true;
    }

    // 检查评论权限
    checkCommentPermission() {
        if (!this.checkCommunityAccess()) return false;
        
        const permissions = this.getPermissions();
        if (!permissions || !permissions.can_comment) {
            this.showPermissionDenied('评论');
            return false;
        }
        return true;
    }

    // 检查点赞权限
    checkLikePermission() {
        if (!this.checkCommunityAccess()) return false;
        
        const permissions = this.getPermissions();
        if (!permissions || !permissions.can_like) {
            this.showPermissionDenied('点赞');
            return false;
        }
        return true;
    }

    // 显示社区登录提示
    showCommunityLoginPrompt() {
        this.uiManager.showMessage('请先登录后参与社区讨论', 'error');
        setTimeout(() => {
            window.location.href = '云梦智间登录.html?redirect=' + encodeURIComponent(window.location.href);
        }, 2000);
    }

    // 显示权限不足提示
    showPermissionDenied(action) {
        this.uiManager.showMessage(`您没有${action}的权限`, 'error');
    }
}

// 创建社区认证管理器实例
const communityAuthManager = new CommunityAuthManager();