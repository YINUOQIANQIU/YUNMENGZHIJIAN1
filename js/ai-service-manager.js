// [file name]: js/ai-service-manager.js
class AIServiceManager {
    constructor() {
        this.currentService = 'bot';
        this.serviceStatus = {
            bot: { enabled: true, priority: 'primary', name: '扣子智能体' },
            zhipu: { enabled: true, priority: 'fallback', name: '智普AI' }
        };
    }

    // 获取推荐的服务
    getRecommendedService() {
        if (this.serviceStatus.bot.enabled) {
            return 'bot';
        }
        return 'zhipu';
    }

    // 更新服务状态
    async updateServiceStatus() {
        try {
            const apiService = new window.AIApiService();
            const status = await apiService.getAIServiceStatus();
            
            if (status) {
                this.serviceStatus.bot.enabled = status.bot_service.enabled;
                this.serviceStatus.zhipu.enabled = status.zhipu_ai.enabled;
                
                // 更新前端显示
                this.updateServiceDisplay();
            }
        } catch (error) {
            console.error('更新服务状态失败:', error);
        }
    }

    // 更新前端服务显示
    updateServiceDisplay() {
        const serviceElement = document.getElementById('current-ai-service');
        if (!serviceElement) return;

        const service = this.getRecommendedService();
        this.currentService = service;

        if (service === 'bot') {
            serviceElement.innerHTML = '<i class="fas fa-robot mr-1"></i>扣子智能体';
            serviceElement.className = 'px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium';
        } else {
            serviceElement.innerHTML = '<i class="fas fa-brain mr-1"></i>智普AI';
            serviceElement.className = 'px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium';
        }
    }

    // 获取当前服务信息
    getCurrentServiceInfo() {
        return {
            service: this.currentService,
            name: this.serviceStatus[this.currentService].name,
            priority: this.serviceStatus[this.currentService].priority
        };
    }
}

// 创建全局服务管理器实例
window.AIServiceManager = AIServiceManager;