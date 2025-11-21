// [file name]: js/subscription-manager.js
class SubscriptionManager {
    constructor() {
        this.baseURL = window.location.origin;
        this.authManager = window.unifiedAuthManager;
        this.currentPlans = [];
        this.userSubscription = null;
    }

    async init() {
        await this.loadSubscriptionPlans();
        await this.checkUserSubscription();
        this.renderSubscriptionPlans();
        this.initEventListeners();
        this.initFeatureCards(); // 新增：初始化功能卡片
    }

    async loadSubscriptionPlans() {
        try {
            const response = await fetch(`${this.baseURL}/api/subscription/plans`);
            const result = await response.json();
            
            if (result.success) {
                this.currentPlans = result.data;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('加载订阅计划失败:', error);
            // 使用默认数据
            this.currentPlans = this.getDefaultPlans();
        }
    }

    async checkUserSubscription() {
        if (!this.authManager.isLoggedIn()) return;

        try {
            const response = await fetch(`${this.baseURL}/api/subscription/status`, {
                headers: this.authManager.getAuthHeaders()
            });
            const result = await response.json();
            
            if (result.success) {
                this.userSubscription = result.data;
            }
        } catch (error) {
            console.error('检查用户订阅状态失败:', error);
        }
    }

getDefaultPlans() {
    return [
        {
            id: 1,
            name: '月度入门',
            duration: 1,
            duration_unit: 'month',
            original_price: 49,
            current_price: 29,
            discount: 41,
            monthly_equivalent: 29,
            features: [
                '每日30次 AI 对话',
                '基础学习计划',
                '标准客服支持',
                '基础词汇库',
                '百次学习分析'
            ],
            popular: false,
            recommended: false,
            tagline: '新用户专享',
            cta_text: '立即体验',
            limit_notice: '适合尝鲜用户'
        },
        {
            id: 2,
            name: '季度进阶',
            duration: 3,
            duration_unit: 'month',
            original_price: 147,
            current_price: 87,
            discount: 41,
            monthly_equivalent: 29,
            features: [
                '每日50次 AI 对话',
                '专属学习计划',
                '优先客服支持',
                '完整词汇库',
                '高级学习分析',
                '学习进度追踪'
            ],
            popular: false,
            recommended: false,
            tagline: '性价比之选',
            cta_text: '选择进阶',
            savings: '省60元'
        },
        {
            id: 3,
            name: '半年度专业',
            duration: 6,
            duration_unit: 'month',
            original_price: 294,
            current_price: 159,
            discount: 46,
            monthly_equivalent: 26.5,
            features: [
                '无限次 AI 对话',
                '智能学习规划',
                '优先客服支持',
                '完整词汇库',
                '高级学习分析',
                '学习进度追踪',
                '专属学习报告'
            ],
            popular: true,
            recommended: true,
            tagline: '最受欢迎',
            cta_text: '选择专业',
            best_value: true,
            savings: '省135元'
        },
        {
            id: 4,
            name: '年度尊享',
            duration: 12,
            duration_unit: 'month',
            original_price: 588,
            current_price: 299,
            discount: 49,
            monthly_equivalent: 24.92,
            student_discount: true,
            student_original_price: 299,
            student_price: 199,
            student_monthly_equivalent: 16.58,
            student_discount_percent: 33,
            features: [
                '无限次 AI 对话',
                '智能学习规划',
                '24小时专属客服',
                '完整词汇库',
                '高级学习分析',
                '学习进度追踪',
                '专属学习报告',
                'AI作文批改'
            ],
            popular: false,
            recommended: false,
            tagline: '尊享体验',
            cta_text: '选择尊享',
            savings: '省289元',
            student_savings: '学生认证再省100元'
        },
        {
            id: 5,
            name: '三年至尊',
            duration: 36,
            duration_unit: 'month',
            original_price: 1764,
            current_price: 699,
            discount: 60,
            monthly_equivalent: 19.42,
            student_discount: true,
            student_original_price: 699,
            student_price: 399,
            student_monthly_equivalent: 11.08,
            student_discount_percent: 43,
            features: [
                '无限次 AI 对话',
                '智能学习规划',
                '24小时专属客服',
                '完整词汇库',
                '高级学习分析',
                '学习进度追踪',
                '专属学习报告',
                'AI作文批改',
                '专属学习顾问',
                '优先新功能体验'
            ],
            popular: false,
            recommended: false,
            tagline: '终极性价比',
            cta_text: '选择至尊',
            savings: '省1065元',
            student_savings: '学生认证再省300元',
            limited_offer: true
        }
    ];
}

    renderSubscriptionPlans() {
        const container = document.getElementById('subscription-plans-container');
        if (!container) return;

        container.innerHTML = this.currentPlans.map(plan => this.createPlanCard(plan)).join('');
    }

    createPlanCard(plan) {
        const monthlyPrice = (plan.current_price / plan.duration).toFixed(2);
        const discountBadge = plan.discount > 0 ? 
            `<div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-1 rounded-full text-sm font-medium z-10">
                节省 ${plan.discount}%
            </div>` : '';

        const popularBadge = plan.popular ? 
            `<div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-white px-4 py-1 rounded-full text-sm font-medium z-10">
                最受欢迎
            </div>` : '';

        const recommendedBadge = plan.recommended ? 
            `<div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-medium z-10">
                推荐
            </div>` : '';

        const badge = discountBadge || popularBadge || recommendedBadge;

        const originalPrice = plan.original_price !== plan.current_price ? 
            `<div class="text-gray-400 line-through text-sm">¥${plan.original_price}</div>` : '';

        return `
            <div class="subscription-plan-card bg-white rounded-lg shadow-lg hover:-translate-y-2 transition-all duration-300 relative flex flex-col h-full border border-gray-200" data-plan-id="${plan.id}">
                ${badge}
                
                <div class="p-6 flex flex-col flex-1">
                    <!-- 标题区域 -->
                    <div class="text-center mb-6">
                        <h3 class="text-lg font-semibold text-gray-900 mb-2">${plan.name}</h3>
                        <div class="flex items-baseline justify-center gap-1 mb-2">
                            <span class="text-3xl font-bold text-primary">¥${plan.current_price}</span>
                            <span class="text-gray-500 text-sm">/${plan.duration_unit === 'month' ? '月' : '年'}</span>
                        </div>
                        ${originalPrice}
                        <div class="text-green-600 text-sm font-medium mt-1">
                            月均 ¥${monthlyPrice}
                        </div>
                    </div>

                    <!-- 特性列表 - 固定高度区域 -->
                    <div class="flex-1 mb-6 min-h-[200px]">
                        <ul class="space-y-3">
                            ${plan.features.map(feature => `
                                <li class="flex items-start">
                                    <i class="fas fa-check text-green-500 mt-1 mr-3 flex-shrink-0"></i>
                                    <span class="text-gray-700 text-sm leading-relaxed">${feature}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>

                    <!-- 按钮区域 -->
                    <button class="w-full py-3 px-4 rounded-lg font-medium transition-all mt-auto ${
                        plan.recommended ? 
                        'bg-gradient-to-r from-primary to-secondary text-white hover:from-blue-600 hover:to-blue-800 shadow-lg' : 
                        'bg-primary text-white hover:bg-secondary border border-transparent hover:border-primary'
                    } subscribe-btn" data-plan-id="${plan.id}">
                        ${this.getSubscribeButtonText(plan)}
                    </button>
                </div>
            </div>
        `;
    }

    getSubscribeButtonText(plan) {
        if (!this.authManager.isLoggedIn()) {
            return '立即订阅';
        }
        
        if (this.userSubscription && this.userSubscription.is_active) {
            const currentPlan = this.userSubscription.current_plan;
            if (currentPlan && currentPlan.id === plan.id) {
                return '当前套餐';
            }
            return '升级套餐';
        }
        
        return '立即订阅';
    }

    initEventListeners() {
        // 订阅按钮事件
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('subscribe-btn')) {
                const planId = parseInt(e.target.dataset.planId);
                this.handleSubscribe(planId);
            }
        });

        // 支付方式选择
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('payment-method')) {
                this.selectPaymentMethod(e.target.dataset.method);
            }
        });

        // 新增：功能卡片点击事件
        document.addEventListener('click', (e) => {
            const featureCard = e.target.closest('.feature-card');
            if (featureCard) {
                this.handleFeatureCardClick(featureCard);
            }
        });

        // 新增：功能卡片悬停效果
        document.addEventListener('mouseover', (e) => {
            const featureCard = e.target.closest('.feature-card');
            if (featureCard) {
                featureCard.classList.add('feature-card-hover');
            }
        });

        document.addEventListener('mouseout', (e) => {
            const featureCard = e.target.closest('.feature-card');
            if (featureCard) {
                featureCard.classList.remove('feature-card-hover');
            }
        });
    }

    // 新增：初始化功能卡片
    initFeatureCards() {
        const featureCards = document.querySelectorAll('.feature-card');
        featureCards.forEach(card => {
            // 为每个功能卡片添加数据属性
            const planId = this.getPlanIdForFeature(card);
            if (planId) {
                card.setAttribute('data-plan-id', planId);
                card.setAttribute('data-feature-type', this.getFeatureType(card));
            }
            
            // 添加点击效果样式
            card.style.cursor = 'pointer';
            card.style.transition = 'all 0.3s ease';
        });
    }

    // 新增：处理功能卡片点击
    handleFeatureCardClick(card) {
        const planId = card.getAttribute('data-plan-id');
        const featureType = card.getAttribute('data-feature-type');
        
        // 添加点击反馈
        this.animateFeatureCardClick(card);
        
        if (planId) {
            // 滚动到对应的订阅计划
            this.scrollToPlan(parseInt(planId));
            
            // 高亮对应的订阅计划
            this.highlightPlan(parseInt(planId));
        } else {
            // 如果没有特定计划，显示所有计划
            this.showAllPlans();
        }
        
        // 记录功能点击分析
        this.trackFeatureClick(featureType);
    }

    // 新增：功能卡片点击动画
    animateFeatureCardClick(card) {
        card.style.transform = 'scale(0.95)';
        card.style.boxShadow = '0 8px 25px rgba(41, 98, 255, 0.3)';
        
        setTimeout(() => {
            card.style.transform = 'scale(1)';
            card.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.1)';
        }, 150);
    }

    // 新增：滚动到指定计划
    scrollToPlan(planId) {
        const planElement = document.querySelector(`[data-plan-id="${planId}"]`);
        if (planElement) {
            const offsetTop = planElement.offsetTop - 100;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    }

    // 新增：高亮订阅计划
    highlightPlan(planId) {
        // 移除所有高亮
        document.querySelectorAll('.subscription-plan-card').forEach(card => {
            card.classList.remove('plan-highlighted');
        });
        
        // 添加高亮
        const planCard = document.querySelector(`[data-plan-id="${planId}"]`);
        if (planCard) {
            planCard.classList.add('plan-highlighted');
            
            // 3秒后移除高亮
            setTimeout(() => {
                planCard.classList.remove('plan-highlighted');
            }, 3000);
        }
    }

    // 新增：显示所有计划
    showAllPlans() {
        const container = document.getElementById('subscription-plans-container');
        if (container) {
            container.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // 新增：根据功能类型获取对应的计划ID
    getPlanIdForFeature(card) {
        const featureText = card.querySelector('h3')?.textContent || '';
        
        // 根据功能内容映射到对应的订阅计划
        const featureMap = {
            '无限次智能对话': 1, // 月度订阅起
            '专属学习计划': 2,    // 季度订阅起
            '高级学习分析': 3,    // 半年度订阅起
            '优先客服支持': 4     // 年度订阅起
        };
        
        for (const [feature, planId] of Object.entries(featureMap)) {
            if (featureText.includes(feature)) {
                return planId;
            }
        }
        
        return null;
    }

    // 新增：获取功能类型
    getFeatureType(card) {
        const icon = card.querySelector('i');
        if (icon) {
            const classList = icon.className;
            if (classList.includes('fa-comments')) return 'ai-chat';
            if (classList.includes('fa-book')) return 'learning-plan';
            if (classList.includes('fa-chart-line')) return 'analysis';
            if (classList.includes('fa-headset')) return 'support';
        }
        return 'general';
    }

    // 新增：跟踪功能点击
    trackFeatureClick(featureType) {
        // 这里可以发送分析数据到后端
        console.log(`功能点击: ${featureType}`);
        
        // 显示轻量级提示
        this.showFeatureTooltip(featureType);
    }

    // 新增：显示功能提示
    showFeatureTooltip(featureType) {
        const messages = {
            'ai-chat': 'AI对话功能从月度订阅开始提供',
            'learning-plan': '专属学习计划从季度订阅开始提供',
            'analysis': '高级学习分析从半年度订阅开始提供',
            'support': '优先客服支持从年度订阅开始提供'
        };
        
        const message = messages[featureType] || '查看对应的订阅计划';
        
        // 使用现有的消息系统
        if (window.uiManager) {
            window.uiManager.showMessage(message, 'info', 2000);
        }
    }

    async handleSubscribe(planId) {
        if (!this.authManager.isLoggedIn()) {
            window.uiManager.showMessage('请先登录后再订阅', 'error');
            setTimeout(() => {
                window.location.href = '云梦智间登录.html?redirect=' + encodeURIComponent(window.location.href);
            }, 1500);
            return;
        }

        const plan = this.currentPlans.find(p => p.id === planId);
        if (!plan) return;

        // 显示支付确认模态框
        this.showPaymentModal(plan);
    }

    showPaymentModal(plan) {
        const modalHTML = `
            <div id="payment-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div class="bg-white rounded-xl p-8 w-full max-w-md mx-4">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-bold text-secondary">确认订阅</h3>
                        <button id="close-payment-modal" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>

                    <div class="bg-blue-50 rounded-lg p-4 mb-6">
                        <div class="flex justify-between items-center mb-2">
                            <span class="font-semibold">${plan.name}</span>
                            <span class="text-2xl font-bold text-primary">¥${plan.current_price}</span>
                        </div>
                        <div class="text-sm text-gray-600">
                            订阅周期: ${plan.duration} ${plan.duration_unit === 'month' ? '个月' : '年'}
                        </div>
                    </div>

                    <div class="mb-6">
                        <h4 class="font-medium mb-3">选择支付方式</h4>
                        <div class="grid grid-cols-3 gap-3">
                            <div class="payment-method border-2 border-gray-200 rounded-lg p-3 text-center cursor-pointer hover:border-primary transition-colors" data-method="wechat">
                                <i class="fab fa-weixin text-[#07C160] text-2xl mb-2"></i>
                                <div class="text-sm">微信支付</div>
                            </div>
                            <div class="payment-method border-2 border-gray-200 rounded-lg p-3 text-center cursor-pointer hover:border-primary transition-colors" data-method="alipay">
                                <i class="fab fa-alipay text-[#1677FF] text-2xl mb-2"></i>
                                <div class="text-sm">支付宝</div>
                            </div>
                            <div class="payment-method border-2 border-gray-200 rounded-lg p-3 text-center cursor-pointer hover:border-primary transition-colors" data-method="card">
                                <i class="fas fa-credit-card text-gray-600 text-2xl mb-2"></i>
                                <div class="text-sm">银行卡</div>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 text-sm text-gray-500 mb-6">
                        <i class="fas fa-shield-alt"></i>
                        <span>支付安全由国家认证的第三方支付机构保障</span>
                    </div>

                    <div class="flex gap-3">
                        <button id="cancel-payment" class="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                            取消
                        </button>
                        <button id="confirm-payment" class="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-secondary transition-colors" disabled>
                            确认支付
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 初始化模态框事件
        this.initPaymentModalEvents(plan);
    }

    initPaymentModalEvents(plan) {
        const modal = document.getElementById('payment-modal');
        let selectedMethod = null;

        // 关闭模态框
        document.getElementById('close-payment-modal').addEventListener('click', () => {
            modal.remove();
        });

        document.getElementById('cancel-payment').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // 选择支付方式
        document.querySelectorAll('.payment-method').forEach(method => {
            method.addEventListener('click', () => {
                // 移除所有选中状态
                document.querySelectorAll('.payment-method').forEach(m => {
                    m.classList.remove('border-primary', 'bg-blue-50');
                });
                
                // 设置当前选中
                method.classList.add('border-primary', 'bg-blue-50');
                selectedMethod = method.dataset.method;
                
                // 启用确认按钮
                document.getElementById('confirm-payment').disabled = false;
            });
        });

        // 确认支付
        document.getElementById('confirm-payment').addEventListener('click', async () => {
            if (!selectedMethod) {
                window.uiManager.showMessage('请选择支付方式', 'error');
                return;
            }

            await this.processPayment(plan, selectedMethod);
            modal.remove();
        });
    }

    async processPayment(plan, paymentMethod) {
        try {
            window.uiManager.showLearningProgress('处理支付中...');

            const response = await fetch(`${this.baseURL}/api/subscription/create-order`, {
                method: 'POST',
                headers: this.authManager.getAuthHeaders(),
                body: JSON.stringify({
                    plan_id: plan.id,
                    payment_method: paymentMethod
                })
            });

            const result = await response.json();

            window.uiManager.hideLearningProgress();

            if (result.success) {
                window.uiManager.showMessage('订阅成功！即将开通服务', 'success');
                
                // 更新用户订阅状态
                await this.checkUserSubscription();
                
                // 重新渲染订阅计划
                this.renderSubscriptionPlans();

                // 3秒后跳转到用户中心
                setTimeout(() => {
                    window.location.href = '云梦智间用户.html';
                }, 3000);
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            window.uiManager.hideLearningProgress();
            window.uiManager.showMessage(`支付失败: ${error.message}`, 'error');
        }
    }

    selectPaymentMethod(method) {
        // 移除所有选中状态
        document.querySelectorAll('.payment-method').forEach(m => {
            m.classList.remove('border-primary', 'bg-blue-50');
        });
        
        // 设置当前选中
        event.target.classList.add('border-primary', 'bg-blue-50');
    }
}

// 创建全局订阅管理器实例
window.subscriptionManager = new SubscriptionManager();