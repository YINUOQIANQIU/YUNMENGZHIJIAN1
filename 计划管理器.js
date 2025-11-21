// [file name]: 计划管理器.js
class PlanManager {
    constructor() {
        this.baseURL = window.location.origin;
        this.currentUser = null;
        this.plans = [];
        this.templates = {};
        this.init();
    }

    async init() {
        try {
            console.log('🔧 开始初始化计划管理器...');
            
            // 等待认证系统初始化
            await this.waitForAuth();
            
            // 先加载模板，确保立即显示
            await this.loadTemplates();
            
            // 然后加载计划数据
            await this.loadPlans();
            
            // 初始化事件监听
            this.initEventListeners();
            
            console.log('✅ 计划管理器初始化完成');
        } catch (error) {
            console.error('❌ 计划管理器初始化失败，使用本地模式:', error);
            // 即使认证失败，也允许使用本地功能
            this.setupLocalMode();
        }
    }

    // 增强本地模式设置
    setupLocalMode() {
        console.log('🔧 进入本地模式，功能受限但可用');
        this.currentUser = { id: 'local_user', username: '本地用户' };
        
        // 加载本地存储的计划
        this.loadLocalPlans();
        
        // 设置基础模板
        this.setupLocalTemplates();
        
        // 初始化UI
        this.renderPlans();
        this.renderTemplates();
        this.updateStats();
        
        this.showMessage('已进入本地模式，部分功能受限', 'info');
    }

    // 修改：设置本地模板，增强模板信息
    setupLocalTemplates() {
        console.log('🔧 设置本地模板');
        this.templates = {
            'daily_study': {
                name: 'daily_study',
                title: '每日学习计划',
                description: '高效安排每日学习任务，建立持续学习习惯',
                fields: ['学习目标', '重点内容', '时间安排', '完成标准', '复习计划'],
                category: 'daily',
                duration: 1,
                durationUnit: 'days',
                icon: 'fa-calendar-day',
                color: 'blue'
            },
            'weekly_review': {
                name: 'weekly_review',
                title: '周度复习计划', 
                description: '系统化周度复习安排，巩固学习成果',
                fields: ['本周目标', '每日任务', '重点难点', '自我评估', '下周计划'],
                category: 'weekly',
                duration: 7,
                durationUnit: 'days',
                icon: 'fa-calendar-week',
                color: 'green'
            },
            'vocabulary_mastery': {
                name: 'vocabulary_mastery',
                title: '词汇突破计划',
                description: '系统化词汇记忆与复习，快速提升词汇量',
                fields: ['每日词汇量', '记忆方法', '复习周期', '测试方式', '重点词汇'],
                category: 'vocabulary',
                duration: 30,
                durationUnit: 'days',
                icon: 'fa-book',
                color: 'purple'
            },
            'listening_training': {
                name: 'listening_training',
                title: '听力强化训练', 
                description: '提升英语听力理解能力，突破听力瓶颈',
                fields: ['训练材料', '训练时长', '精听/泛听', '笔记方法', '重点训练'],
                category: 'listening',
                duration: 21,
                durationUnit: 'days',
                icon: 'fa-headphones',
                color: 'indigo'
            },
            'reading_comprehension': {
                name: 'reading_comprehension',
                title: '阅读理解提升',
                description: '提高阅读速度和理解能力，掌握阅读技巧', 
                fields: ['阅读材料', '阅读目标', '理解练习', '词汇积累', '技巧训练'],
                category: 'reading',
                duration: 28,
                durationUnit: 'days',
                icon: 'fa-search',
                color: 'teal'
            },
            'writing_practice': {
                name: 'writing_practice',
                title: '写作技能训练',
                description: '系统化写作能力提升，掌握高分写作技巧',
                fields: ['写作类型', '练习频率', '批改方式', '范文学习', '常见错误'],
                category: 'writing',
                duration: 30,
                durationUnit: 'days',
                icon: 'fa-pen',
                color: 'amber'
            },
            'exam_preparation': {
                name: 'exam_preparation',
                title: '考试冲刺计划',
                description: '考前系统复习与模拟训练，全面提升应试能力',
                fields: ['考试目标', '复习重点', '模拟测试', '时间安排', '心态调整'],
                category: 'exam',
                duration: 60,
                durationUnit: 'days',
                icon: 'fa-graduation-cap',
                color: 'red'
            },
            'comprehensive_improvement': {
                name: 'comprehensive_improvement',
                title: '综合能力提升',
                description: '全面提升英语综合能力，均衡发展各项技能',
                fields: ['能力评估', '重点突破', '训练计划', '进度跟踪', '效果评估'],
                category: 'comprehensive',
                duration: 90,
                durationUnit: 'days',
                icon: 'fa-star',
                color: 'pink'
            }
        };
        
        // 增强模板数据
        this.enhanceTemplateData();
    }

    // 新增：增强模板数据确保完整性
    enhanceTemplateData() {
        // 确保每个模板都有必要的属性
        Object.keys(this.templates).forEach(key => {
            const template = this.templates[key];
            if (template) {
                // 设置默认图标
                if (!template.icon) {
                    const iconMap = {
                        'daily_study': 'fa-calendar-day',
                        'weekly_review': 'fa-calendar-week',
                        'vocabulary_mastery': 'fa-book',
                        'listening_training': 'fa-headphones',
                        'reading_comprehension': 'fa-search',
                        'writing_practice': 'fa-pen',
                        'exam_preparation': 'fa-graduation-cap',
                        'comprehensive_improvement': 'fa-star'
                    };
                    template.icon = iconMap[key] || 'fa-clone';
                }
                
                // 设置默认颜色
                if (!template.color) {
                    const colorMap = {
                        'daily_study': 'blue',
                        'weekly_review': 'green', 
                        'vocabulary_mastery': 'purple',
                        'listening_training': 'indigo',
                        'reading_comprehension': 'teal',
                        'writing_practice': 'amber',
                        'exam_preparation': 'red',
                        'comprehensive_improvement': 'pink'
                    };
                    template.color = colorMap[key] || 'blue';
                }
                
                // 设置默认时长
                if (!template.duration) {
                    const durationMap = {
                        'daily_study': 1,
                        'weekly_review': 7,
                        'vocabulary_mastery': 30,
                        'listening_training': 21,
                        'reading_comprehension': 28,
                        'writing_practice': 30,
                        'exam_preparation': 60,
                        'comprehensive_improvement': 90
                    };
                    template.duration = durationMap[key] || 7;
                }
                
                if (!template.durationUnit) {
                    template.durationUnit = 'days';
                }
            }
        });
    }

    // 修改 waitForAuth 方法，增加超时处理
    async waitForAuth() {
        return new Promise((resolve) => {
            const maxWaitTime = 5000; // 最多等待5秒
            const startTime = Date.now();
            
            const checkAuth = () => {
                if (window.unifiedAuthManager && window.unifiedAuthManager.isInitialized) {
                    this.currentUser = window.unifiedAuthManager.getCurrentUser();
                    console.log('✅ 认证系统初始化完成，用户:', this.currentUser);
                    resolve();
                } else if (Date.now() - startTime > maxWaitTime) {
                    console.log('⏰ 认证等待超时，使用本地模式');
                    this.setupLocalMode();
                    resolve();
                } else {
                    setTimeout(checkAuth, 100);
                }
            };
            checkAuth();
        });
    }

    // 修改 loadPlans 方法，添加本地回退
    async loadPlans(filter = 'all') {
        try {
            // 如果未登录，使用本地模式
            if (!this.currentUser || this.currentUser.id === 'local_user') {
                this.loadLocalPlans(filter);
                return;
            }

            const response = await fetch(`${this.baseURL}/api/plans?filter=${filter}`, {
                headers: this.getAuthHeaders()
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.plans = result.data;
                    this.renderPlans();
                    this.updateStats();
                    // 保存到本地存储
                    this.saveToLocalStorage();
                }
            } else {
                throw new Error('API请求失败');
            }
        } catch (error) {
            console.error('加载计划失败，使用本地数据:', error);
            this.loadLocalPlans(filter);
        }
    }

    // 修改 loadTemplates 方法，添加数据增强
    async loadTemplates() {
        try {
            const response = await fetch(`${this.baseURL}/api/plans/templates`, {
                headers: this.getAuthHeaders()
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.templates = result.data;
                    // 增强模板数据
                    this.enhanceTemplateData();
                    this.renderTemplates();
                    return;
                }
            }
            throw new Error('API请求失败');
        } catch (error) {
            console.error('加载模板失败，使用本地模板:', error);
            // 如果模板加载失败，使用本地模板
            this.setupLocalTemplates();
            this.enhanceTemplateData();
            this.renderTemplates();
        }
    }

    // 修改：渲染模板，统一卡片样式 - 修复版本
    renderTemplates() {
        const container = document.getElementById('templates-container');
        if (!container) {
            console.warn('模板容器未找到');
            return;
        }

        // 确保模板数据已加载和增强
        if (!this.templates || Object.keys(this.templates).length === 0) {
            console.warn('模板数据为空，使用本地模板');
            this.setupLocalTemplates();
        } else {
            // 确保模板数据已增强
            this.enhanceTemplateData();
        }

        // 定义颜色映射
        const colorClasses = {
            'blue': 'bg-blue-100 text-blue-500',
            'green': 'bg-green-100 text-green-500',
            'purple': 'bg-purple-100 text-purple-500',
            'indigo': 'bg-indigo-100 text-indigo-500',
            'teal': 'bg-teal-100 text-teal-500',
            'amber': 'bg-amber-100 text-amber-500',
            'red': 'bg-red-100 text-red-500',
            'pink': 'bg-pink-100 text-pink-500'
        };

        // 生成模板HTML
        const templatesHTML = Object.entries(this.templates).map(([key, template]) => {
            // 确保模板有必要的属性
            if (!template) return '';
            
            const colorClass = colorClasses[template.color] || 'bg-blue-100 text-blue-500';
            const durationText = template.duration ? `${template.duration} ${this.getDurationUnitName(template.durationUnit)}` : '7天';
            const categoryName = this.getCategoryName(template.category);
            
            return `
                <div class="template-card uniform-card p-6 rounded-xl cursor-pointer border-2 border-dashed border-gray-300 hover:border-primary transition-all duration-300" 
                     onclick="planManager.useTemplate('${key}')">
                    <div class="text-center h-full flex flex-col">
                        <div class="template-icon ${colorClass} w-16 h-16 rounded-xl mx-auto mb-4 flex items-center justify-center">
                            <i class="fas ${template.icon || 'fa-clone'} text-xl"></i>
                        </div>
                        <h4 class="font-semibold text-gray-800 mb-2 text-lg">${template.title || '未命名模板'}</h4>
                        <p class="text-gray-600 text-sm mb-4 flex-grow leading-relaxed">${template.description || '暂无描述'}</p>
                        <div class="flex justify-between items-center text-xs text-gray-500 mb-3">
                            <span class="flex items-center gap-1">
                                <i class="far fa-clock"></i>
                                ${durationText}
                            </span>
                            <span class="px-2 py-1 rounded-full ${colorClass} text-xs font-medium">
                                ${categoryName}
                            </span>
                        </div>
                        <button class="mt-2 w-full py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors font-medium text-sm">
                            使用模板
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // 如果生成了模板HTML，就显示，否则显示错误信息
        if (templatesHTML) {
            container.innerHTML = templatesHTML;
            console.log(`✅ 成功渲染 ${Object.keys(this.templates).length} 个模板`);
        } else {
            container.innerHTML = `
                <div class="col-span-4 text-center py-8">
                    <i class="fas fa-exclamation-triangle text-3xl text-yellow-500 mb-3"></i>
                    <p class="text-gray-500">模板加载失败</p>
                    <button onclick="planManager.loadTemplates()" class="mt-3 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors text-sm">
                        重新加载
                    </button>
                </div>
            `;
        }
    }

    // 修改 createPlan 方法，添加本地支持
    async createPlan(planData) {
        try {
            // 如果未登录，使用本地存储
            if (!this.currentUser || this.currentUser.id === 'local_user') {
                return this.createLocalPlan(planData);
            }

            const response = await fetch(`${this.baseURL}/api/plans`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(planData)
            });
            
            const result = await response.json();
            if (result.success) {
                const newPlan = result.data;
                this.plans.unshift(newPlan);
                this.renderPlans();
                this.updateStats();
                this.saveToLocalStorage();
                this.showMessage('计划创建成功', 'success');
                return newPlan;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('创建计划失败，使用本地存储:', error);
            return this.createLocalPlan(planData);
        }
    }

    // 新增：创建本地计划
    createLocalPlan(planData) {
        const newPlan = {
            id: Date.now(), // 使用时间戳作为ID
            ...planData,
            createdAt: new Date().toISOString(),
            progress: 0,
            source: 'custom'
        };
        
        this.plans.unshift(newPlan);
        this.renderPlans();
        this.updateStats();
        this.saveToLocalStorage();
        this.showMessage('计划创建成功（本地模式）', 'success');
        return newPlan;
    }

    // 修复后的AI生成计划方法
    async generateAIPlan() {
        try {
            // 如果未登录，使用本地模拟
            if (!this.currentUser || this.currentUser.id === 'local_user') {
                return this.generateLocalAIPlan();
            }

            // 获取学习统计
            const statsResponse = await fetch(`${this.baseURL}/api/plans/stats`, {
                headers: this.getAuthHeaders()
            });
            
            let learningStats = {
                studyTime: 120,
                progress: 50,
                weakAreas: ['词汇记忆', '听力理解'],
                consistency: 0.7
            };
            
            if (statsResponse.ok) {
                const statsResult = await statsResponse.json();
                if (statsResult.success) {
                    learningStats = { ...learningStats, ...statsResult.data };
                }
            }

            const response = await fetch(`${this.baseURL}/api/plans/ai/generate`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ learningStats })
            });
            
            const result = await response.json();
            if (result.success) {
                const aiPlan = result.data;
                this.showAIPlanPreview(aiPlan);
                return aiPlan;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('AI生成计划失败:', error);
            // 如果API失败，使用本地模拟
            return this.generateLocalAIPlan();
        }
    }

    // 新增：生成本地AI计划
    generateLocalAIPlan() {
        const aiPlan = {
            title: 'AI智能学习计划',
            description: '基于您的学习习惯生成的个性化学习方案',
            type: 'comprehensive',
            duration: 30,
            durationUnit: 'days',
            progress: 0,
            source: 'ai',
            aiAnalysis: {
                learningEfficiency: '良好',
                recommendationLevel: '中级',
                predictedProgress: 85,
                riskAreas: ['学习时间不规律', '复习频率不足']
            },
            focusAreas: ['词汇记忆', '听力理解', '阅读理解'],
            recommendedActions: [
                '每天固定时间学习',
                '每周进行复习测试',
                '记录学习心得',
                '调整学习节奏'
            ],
            content: {
                dailyGoals: [
                    '学习30个新单词',
                    '完成1篇听力练习',
                    '阅读1篇英文文章'
                ],
                studySchedule: [
                    '早晨: 词汇记忆 (30分钟)',
                    '下午: 听力训练 (30分钟)',
                    '晚上: 阅读练习 (40分钟)'
                ]
            }
        };
        
        this.showAIPlanPreview(aiPlan);
        return aiPlan;
    }

    showAIPlanPreview(aiPlan) {
        const modalHTML = `
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div class="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-bold text-secondary">AI智能学习计划</h3>
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="space-y-4">
                        <div class="bg-blue-50 p-4 rounded-lg">
                            <h4 class="font-semibold text-blue-800 mb-2">${aiPlan.title}</h4>
                            <p class="text-blue-700">${aiPlan.description}</p>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="bg-gray-50 p-4 rounded-lg">
                                <h5 class="font-semibold mb-2">📊 AI分析</h5>
                                <div class="space-y-2 text-sm">
                                    <div>学习效率: <span class="font-medium">${aiPlan.aiAnalysis.learningEfficiency}</span></div>
                                    <div>推荐级别: <span class="font-medium">${aiPlan.aiAnalysis.recommendationLevel}</span></div>
                                    <div>预测进度: <span class="font-medium">${aiPlan.aiAnalysis.predictedProgress}%</span></div>
                                </div>
                            </div>
                            
                            <div class="bg-orange-50 p-4 rounded-lg">
                                <h5 class="font-semibold mb-2">🎯 重点关注</h5>
                                <ul class="list-disc list-inside text-sm space-y-1">
                                    ${aiPlan.focusAreas.map(area => `<li>${area}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                        
                        <div class="bg-green-50 p-4 rounded-lg">
                            <h5 class="font-semibold mb-2">💡 推荐行动</h5>
                            <ul class="list-disc list-inside text-sm space-y-1">
                                ${aiPlan.recommendedActions.map(action => `<li>${action}</li>`).join('')}
                            </ul>
                        </div>
                        
                        ${aiPlan.aiAnalysis.riskAreas.length > 0 ? `
                            <div class="bg-red-50 p-4 rounded-lg">
                                <h5 class="font-semibold mb-2">⚠️ 风险提示</h5>
                                <ul class="list-disc list-inside text-sm space-y-1">
                                    ${aiPlan.aiAnalysis.riskAreas.map(risk => `<li>${risk}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        
                        <div class="bg-white border p-4 rounded-lg">
                            <h5 class="font-semibold mb-2">📝 计划内容</h5>
                            <div class="space-y-3">
                                <div>
                                    <h6 class="font-medium text-gray-700">每日目标</h6>
                                    <ul class="list-disc list-inside text-sm text-gray-600">
                                        ${aiPlan.content.dailyGoals.map(goal => `<li>${goal}</li>`).join('')}
                                    </ul>
                                </div>
                                <div>
                                    <h6 class="font-medium text-gray-700">学习安排</h6>
                                    <ul class="list-disc list-inside text-sm text-gray-600">
                                        ${aiPlan.content.studySchedule.map(schedule => `<li>${schedule}</li>`).join('')}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex gap-3 justify-end mt-6 pt-4 border-t">
                        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                            取消
                        </button>
                        <button onclick="planManager.confirmAIPlan(${JSON.stringify(aiPlan).replace(/"/g, '&quot;')})" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors">
                            确认使用此计划
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    async confirmAIPlan(aiPlan) {
        const createdPlan = await this.createPlan(aiPlan);
        if (createdPlan) {
            document.querySelector('.fixed.inset-0').remove();
            this.showMessage('AI计划已成功创建', 'success');
        }
    }

    // 修改添加日记方法
    async addDiaryEntry(planId, entry) {
        try {
            // 如果未登录，使用本地存储
            if (!this.currentUser || this.currentUser.id === 'local_user') {
                return this.addLocalDiaryEntry(planId, entry);
            }

            const response = await fetch(`${this.baseURL}/api/plans/${planId}/diary`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(entry)
            });
            
            const result = await response.json();
            if (result.success) {
                this.showMessage('日记记录成功', 'success');
                return result.data;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('记录日记失败，使用本地存储:', error);
            return this.addLocalDiaryEntry(planId, entry);
        }
    }

    // 新增：添加本地日记
    addLocalDiaryEntry(planId, entry) {
        const diaryKey = `moyu_diary_${planId}`;
        let diaries = [];
        
        try {
            const localDiaries = localStorage.getItem(diaryKey);
            if (localDiaries) {
                diaries = JSON.parse(localDiaries);
            }
        } catch (error) {
            console.error('加载本地日记失败:', error);
        }
        
        const newEntry = {
            id: Date.now(),
            ...entry,
            date: new Date().toISOString()
        };
        
        diaries.unshift(newEntry);
        
        try {
            localStorage.setItem(diaryKey, JSON.stringify(diaries));
            this.showMessage('日记记录成功（本地模式）', 'success');
        } catch (error) {
            console.error('保存日记失败:', error);
            this.showMessage('日记保存失败', 'error');
        }
        
        return newEntry;
    }

    // 修改删除计划方法
    async deletePlan(planId) {
        if (!confirm('确定要删除这个计划吗？此操作不可恢复。')) {
            return;
        }

        try {
            // 如果未登录，直接本地删除
            if (!this.currentUser || this.currentUser.id === 'local_user') {
                this.plans = this.plans.filter(p => p.id !== planId);
                this.renderPlans();
                this.updateStats();
                this.saveToLocalStorage();
                this.showMessage('计划删除成功', 'success');
                return;
            }

            const response = await fetch(`${this.baseURL}/api/plans/${planId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            
            const result = await response.json();
            if (result.success) {
                this.plans = this.plans.filter(p => p.id !== planId);
                this.renderPlans();
                this.updateStats();
                this.saveToLocalStorage();
                this.showMessage('计划删除成功', 'success');
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('删除计划失败，使用本地删除:', error);
            this.plans = this.plans.filter(p => p.id !== planId);
            this.renderPlans();
            this.updateStats();
            this.saveToLocalStorage();
            this.showMessage('计划删除成功（本地模式）', 'success');
        }
    }

    // 修改获取计划详情方法
    async getPlanDetail(planId) {
        try {
            // 如果未登录，使用本地存储
            if (!this.currentUser || this.currentUser.id === 'local_user') {
                return this.getLocalPlanDetail(planId);
            }

            const response = await fetch(`${this.baseURL}/api/plans/${planId}/diaries`, {
                headers: this.getAuthHeaders()
            });
            
            const result = await response.json();
            if (result.success) {
                return result.data;
            }
            return [];
        } catch (error) {
            console.error('获取计划详情失败，使用本地数据:', error);
            return this.getLocalPlanDetail(planId);
        }
    }

    // 新增：获取本地计划详情
    getLocalPlanDetail(planId) {
        const diaryKey = `moyu_diary_${planId}`;
        try {
            const localDiaries = localStorage.getItem(diaryKey);
            if (localDiaries) {
                return JSON.parse(localDiaries);
            }
        } catch (error) {
            console.error('获取本地日记失败:', error);
        }
        return [];
    }

    // 导出计划为PDF
    async exportPlanToPDF(planId) {
        const plan = this.plans.find(p => p.id === planId);
        if (!plan) return;

        // 创建打印友好的HTML
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${plan.title}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    .header { text-align: center; border-bottom: 2px solid #2962FF; padding-bottom: 20px; margin-bottom: 30px; }
                    .section { margin-bottom: 25px; }
                    .section-title { font-size: 18px; font-weight: bold; color: #2962FF; margin-bottom: 10px; }
                    .progress-bar { background: #f0f0f0; height: 20px; border-radius: 10px; margin: 10px 0; }
                    .progress-fill { background: #2962FF; height: 100%; border-radius: 10px; width: ${plan.progress}%; }
                    .diary-entry { border-left: 3px solid #2962FF; padding-left: 15px; margin: 15px 0; }
                    .print-date { text-align: right; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${plan.title}</h1>
                    <p>${plan.description}</p>
                    <div class="print-date">导出时间: ${new Date().toLocaleString()}</div>
                </div>
                
                <div class="section">
                    <div class="section-title">基本信息</div>
                    <p><strong>计划类型:</strong> ${this.getTypeInfo(plan.type).name}</p>
                    <p><strong>创建时间:</strong> ${new Date(plan.createdAt).toLocaleDateString()}</p>
                    <p><strong>计划时长:</strong> ${plan.duration} ${this.getDurationUnitName(plan.durationUnit)}</p>
                </div>
                
                <div class="section">
                    <div class="section-title">完成进度</div>
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <p>${plan.progress}% 已完成</p>
                </div>
                
                ${plan.aiAnalysis ? `
                <div class="section">
                    <div class="section-title">AI分析</div>
                    <p><strong>学习效率:</strong> ${plan.aiAnalysis.learningEfficiency}</p>
                    <p><strong>推荐级别:</strong> ${plan.aiAnalysis.recommendationLevel}</p>
                    <p><strong>预测进度:</strong> ${plan.aiAnalysis.predictedProgress}%</p>
                </div>
                ` : ''}
                
                <div class="section">
                    <div class="section-title">计划内容</div>
                    ${plan.content && plan.content.dailyGoals ? `
                    <p><strong>每日目标:</strong></p>
                    <ul>
                        ${plan.content.dailyGoals.map(goal => `<li>${goal}</li>`).join('')}
                    </ul>
                    ` : ''}
                    
                    ${plan.content && plan.content.studySchedule ? `
                    <p><strong>学习安排:</strong></p>
                    <ul>
                        ${plan.content.studySchedule.map(schedule => `<li>${schedule}</li>`).join('')}
                    </ul>
                    ` : ''}
                </div>
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.print();
    }

    // 分享计划
    sharePlan(planId) {
        const plan = this.plans.find(p => p.id === planId);
        if (!plan) return;

        if (navigator.share) {
            navigator.share({
                title: plan.title,
                text: plan.description,
                url: window.location.href
            }).catch(console.error);
        } else {
            // 复制到剪贴板
            const textToCopy = `${plan.title}\n${plan.description}\n\n查看详情: ${window.location.href}`;
            navigator.clipboard.writeText(textToCopy).then(() => {
                this.showMessage('计划链接已复制到剪贴板', 'success');
            }).catch(() => {
                this.showMessage('复制失败，请手动复制链接', 'error');
            });
        }
    }

    renderPlans() {
        const container = document.getElementById('plans-container');
        if (!container) return;

        if (this.plans.length === 0) {
            container.innerHTML = `
                <div class="col-span-3 py-12 text-center">
                    <i class="fas fa-clipboard-list text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500 mb-4">暂无学习计划</p>
                    <button onclick="planManager.showCreatePlanModal()" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors">
                        创建第一个计划
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.plans.map(plan => this.createPlanCard(plan)).join('');
    }

    // 修改：更新计划卡片，统一样式
    createPlanCard(plan) {
        const progressRing = this.createProgressRing(plan.progress);
        const typeInfo = this.getTypeInfo(plan.type);
        
        // 获取日记数量
        const diaryCount = this.getPlanDiaryCount(plan.id);
        
        return `
            <div class="bg-white rounded-lg shadow-sm card-hover overflow-hidden plan-card" data-plan-id="${plan.id}">
                <div class="p-6 plan-card-content">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-3">
                                <span class="px-3 py-1 rounded-full text-xs ${typeInfo.color}">
                                    <i class="fas ${typeInfo.icon} mr-1"></i>
                                    ${typeInfo.name}
                                </span>
                                ${plan.source === 'ai' ? 
                                    '<span class="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-600">AI生成</span>' : 
                                    plan.source === 'template' ?
                                    '<span class="px-2 py-1 rounded-full text-xs bg-green-100 text-green-600">模板</span>' :
                                    '<span class="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-600">自定义</span>'
                                }
                            </div>
                            <h3 class="text-lg font-semibold text-secondary mb-2 line-clamp-2">${plan.title}</h3>
                            <p class="text-gray-600 text-sm mb-4 line-clamp-2">${plan.description}</p>
                            
                            ${plan.aiAnalysis ? `
                                <div class="bg-gray-50 p-3 rounded-lg mb-3">
                                    <div class="flex items-center gap-2 mb-2">
                                        <i class="fas fa-robot text-purple-500"></i>
                                        <span class="text-sm font-medium">AI分析</span>
                                    </div>
                                    <div class="grid grid-cols-2 gap-2 text-xs">
                                        <div>效率: ${plan.aiAnalysis.learningEfficiency}</div>
                                        <div>预测: ${plan.aiAnalysis.predictedProgress}%</div>
                                    </div>
                                </div>
                            ` : ''}
                            
                            <div class="flex items-center justify-between text-sm text-gray-500 mb-4">
                                <div class="flex items-center gap-4">
                                    <span><i class="far fa-calendar-alt mr-1"></i>${plan.duration} ${this.getDurationUnitName(plan.durationUnit)}</span>
                                    <span><i class="fas fa-book mr-1"></i>${diaryCount}篇日记</span>
                                </div>
                                <span><i class="far fa-clock mr-1"></i>${new Date(plan.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div class="relative w-16 h-16 ml-4 flex-shrink-0">
                            ${progressRing}
                            <div class="absolute inset-0 flex items-center justify-center text-sm font-medium">
                                ${plan.progress}%
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="border-t border-gray-200 px-6 py-4 bg-gray-50">
                    <div class="flex justify-between items-center">
                        <div class="flex gap-3">
                            <button onclick="planManager.showPlanDetail(${plan.id})" 
                                    class="text-primary hover:text-secondary text-sm font-medium flex items-center gap-1">
                                <i class="fas fa-eye"></i>查看
                            </button>
                            <button onclick="planManager.showDiaryModal(${plan.id})" 
                                    class="text-green-600 hover:text-green-700 text-sm font-medium flex items-center gap-1">
                                <i class="fas fa-book"></i>写日记
                            </button>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="planManager.sharePlan(${plan.id})" 
                                    class="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                                    title="分享">
                                <i class="fas fa-share-alt text-sm"></i>
                            </button>
                            <button onclick="planManager.exportPlanToPDF(${plan.id})" 
                                    class="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                                    title="导出">
                                <i class="fas fa-download text-sm"></i>
                            </button>
                            <button onclick="planManager.editPlan(${plan.id})" 
                                    class="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                                    title="编辑">
                                <i class="fas fa-edit text-sm"></i>
                            </button>
                            <button onclick="planManager.deletePlan(${plan.id})" 
                                    class="w-8 h-8 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                                    title="删除">
                                <i class="fas fa-trash text-sm"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 修改：进度环颜色根据进度变化
    createProgressRing(progress) {
        const circumference = 2 * Math.PI * 28;
        const offset = circumference - (progress / 100) * circumference;
        
        // 根据进度选择颜色
        let strokeColor = '#2962FF'; // 默认蓝色
        if (progress >= 80) strokeColor = '#10B981'; // 完成度高用绿色
        else if (progress <= 30) strokeColor = '#EF4444'; // 进度低用红色
        
        return `
            <svg class="progress-ring" width="64" height="64">
                <circle stroke="#E0E0E0" stroke-width="4" fill="transparent" r="28" cx="32" cy="32"/>
                <circle stroke="${strokeColor}" stroke-width="4" fill="transparent" r="28" cx="32" cy="32" 
                        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
            </svg>
        `;
    }

    getTypeInfo(type) {
        const types = {
            'vocabulary': { name: '词汇记忆', icon: 'fa-book', color: 'bg-blue-100 text-blue-600' },
            'listening': { name: '听力训练', icon: 'fa-headphones', color: 'bg-purple-100 text-purple-600' },
            'reading': { name: '阅读理解', icon: 'fa-search', color: 'bg-green-100 text-green-600' },
            'writing': { name: '写作提升', icon: 'fa-pen', color: 'bg-yellow-100 text-yellow-600' },
            'translation': { name: '翻译练习', icon: 'fa-language', color: 'bg-red-100 text-red-600' },
            'comprehensive': { name: '综合提升', icon: 'fa-star', color: 'bg-indigo-100 text-indigo-600' },
            'foundation': { name: '基础学习', icon: 'fa-graduation-cap', color: 'bg-blue-100 text-blue-600' },
            'improvement': { name: '提升阶段', icon: 'fa-chart-line', color: 'bg-green-100 text-green-600' },
            'advanced': { name: '高级阶段', icon: 'fa-trophy', color: 'bg-purple-100 text-purple-600' },
            'daily': { name: '每日计划', icon: 'fa-calendar-day', color: 'bg-blue-100 text-blue-600' },
            'weekly': { name: '周度计划', icon: 'fa-calendar-week', color: 'bg-green-100 text-green-600' },
            'exam': { name: '考试冲刺', icon: 'fa-graduation-cap', color: 'bg-red-100 text-red-600' }
        };
        return types[type] || types['comprehensive'];
    }

    getDurationUnitName(unit) {
        const units = {
            'days': '天',
            'weeks': '周',
            'months': '月'
        };
        return units[unit] || '天';
    }

    // 使用模板
    useTemplate(templateKey) {
        const template = this.templates[templateKey];
        if (!template) return;
        
        // 基于模板创建计划数据
        const planData = {
            title: template.title,
            type: template.category,
            description: template.description,
            duration: template.duration,
            durationUnit: template.durationUnit,
            source: 'template',
            content: {
                templateFields: template.fields,
                dailyGoals: this.generateTemplateGoals(template),
                studySchedule: this.generateTemplateSchedule(template)
            }
        };
        
        this.showCreatePlanModal(template, planData);
    }

    // 新增：生成模板目标
    generateTemplateGoals(template) {
        const goalsMap = {
            'daily_study': [
                '完成当日重点学习内容',
                '记录学习心得和问题',
                '制定明日学习计划'
            ],
            'weekly_review': [
                '完成本周所有学习任务',
                '进行周度自我评估',
                '制定下周学习目标'
            ],
            'vocabulary_mastery': [
                '记忆新词汇并复习旧词汇',
                '完成词汇测试练习',
                '整理词汇笔记'
            ],
            'listening_training': [
                '完成精听和泛听训练',
                '记录听力难点和生词',
                '模仿发音和语调'
            ],
            'reading_comprehension': [
                '阅读指定材料并理解内容',
                '完成阅读理解练习',
                '积累阅读中的重点词汇'
            ],
            'writing_practice': [
                '完成写作练习并修改',
                '学习优秀范文结构',
                '总结写作技巧'
            ],
            'exam_preparation': [
                '完成模拟测试练习',
                '分析错题并总结',
                '复习重点知识点'
            ],
            'comprehensive_improvement': [
                '均衡训练各项英语技能',
                '跟踪学习进度',
                '调整学习策略'
            ]
        };
        
        return goalsMap[template.name] || ['完成学习任务', '记录学习心得', '制定下一步计划'];
    }

    // 新增：生成模板日程
    generateTemplateSchedule(template) {
        const schedulesMap = {
            'daily_study': [
                '早晨: 记忆重点内容 (60分钟)',
                '下午: 练习与应用 (90分钟)',
                '晚上: 复习与总结 (30分钟)'
            ],
            'weekly_review': [
                '周一至周五: 按计划学习',
                '周六: 周度复习与总结',
                '周日: 制定下周计划'
            ],
            'vocabulary_mastery': [
                '早晨: 记忆新词汇 (30分钟)',
                '中午: 复习昨日词汇 (20分钟)',
                '晚上: 词汇测试与应用 (40分钟)'
            ]
        };
        
        return schedulesMap[template.name] || [
            '合理安排学习时间',
            '保持学习连续性',
            '及时复习巩固'
        ];
    }

    // 新增：获取分类名称
    getCategoryName(category) {
        const categories = {
            'daily': '每日计划',
            'weekly': '周度计划',
            'vocabulary': '词汇学习',
            'listening': '听力训练',
            'reading': '阅读理解',
            'writing': '写作提升',
            'exam': '考试冲刺',
            'comprehensive': '综合提升'
        };
        return categories[category] || '学习计划';
    }

    // 修改创建计划模态框，支持编辑
    showCreatePlanModal(template = null, existingPlan = null) {
        const isEdit = !!existingPlan;
        const modalHTML = `
            <div id="create-plan-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-xl shadow-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-bold text-secondary">${isEdit ? '编辑计划' : template ? '使用模板创建计划' : '创建新学习计划'}</h3>
                        <button onclick="planManager.hideCreatePlanModal()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <form id="new-plan-form" class="space-y-6">
                        <div>
                            <label for="plan-title" class="block text-sm font-medium text-gray-700 mb-2">计划标题</label>
                            <input type="text" id="plan-title" value="${existingPlan ? existingPlan.title : template ? template.title : ''}" 
                                   class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" 
                                   placeholder="例如：CET-6词汇突破计划" required>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="plan-type" class="block text-sm font-medium text-gray-700 mb-2">计划类型</label>
                                <select id="plan-type" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" required>
                                    <option value="">选择计划类型</option>
                                    <option value="vocabulary" ${existingPlan?.type === 'vocabulary' ? 'selected' : ''}>词汇记忆</option>
                                    <option value="listening" ${existingPlan?.type === 'listening' ? 'selected' : ''}>听力训练</option>
                                    <option value="reading" ${existingPlan?.type === 'reading' ? 'selected' : ''}>阅读理解</option>
                                    <option value="writing" ${existingPlan?.type === 'writing' ? 'selected' : ''}>写作提升</option>
                                    <option value="translation" ${existingPlan?.type === 'translation' ? 'selected' : ''}>翻译练习</option>
                                    <option value="comprehensive" ${existingPlan?.type === 'comprehensive' ? 'selected' : ''}>综合提升</option>
                                    <option value="foundation" ${existingPlan?.type === 'foundation' ? 'selected' : ''}>基础学习</option>
                                    <option value="improvement" ${existingPlan?.type === 'improvement' ? 'selected' : ''}>提升阶段</option>
                                    <option value="advanced" ${existingPlan?.type === 'advanced' ? 'selected' : ''}>高级阶段</option>
                                    <option value="daily" ${existingPlan?.type === 'daily' ? 'selected' : ''}>每日计划</option>
                                    <option value="weekly" ${existingPlan?.type === 'weekly' ? 'selected' : ''}>周度计划</option>
                                    <option value="exam" ${existingPlan?.type === 'exam' ? 'selected' : ''}>考试冲刺</option>
                                </select>
                            </div>
                            
                            <div>
                                <label for="plan-progress" class="block text-sm font-medium text-gray-700 mb-2">完成进度</label>
                                <div class="flex items-center gap-3">
                                    <input type="range" id="plan-progress" min="0" max="100" value="${existingPlan?.progress || 0}" 
                                           class="flex-1" ${isEdit ? '' : 'disabled'}>
                                    <span id="progress-value" class="w-12 text-sm font-medium">${existingPlan?.progress || 0}%</span>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label for="plan-duration" class="block text-sm font-medium text-gray-700 mb-2">计划时长</label>
                            <div class="flex items-center gap-4">
                                <input type="number" id="plan-duration" min="1" max="365" value="${existingPlan?.duration || 30}"
                                       class="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" required>
                                <select id="duration-unit" class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary">
                                    <option value="days" ${existingPlan?.durationUnit === 'days' ? 'selected' : ''}>天</option>
                                    <option value="weeks" ${existingPlan?.durationUnit === 'weeks' ? 'selected' : ''}>周</option>
                                    <option value="months" ${existingPlan?.durationUnit === 'months' ? 'selected' : ''}>月</option>
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label for="plan-description" class="block text-sm font-medium text-gray-700 mb-2">计划描述</label>
                            <textarea id="plan-description" rows="3" 
                                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" 
                                      placeholder="详细描述你的学习目标和计划内容">${existingPlan ? existingPlan.description : template ? template.description : ''}</textarea>
                        </div>
                        
                        ${template ? `
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">模板字段</label>
                                <div class="space-y-3 bg-gray-50 p-4 rounded-lg">
                                    ${template.fields.map(field => `
                                        <div>
                                            <label class="block text-sm font-medium text-gray-600 mb-1">${field}</label>
                                            <textarea rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" 
                                                      placeholder="填写${field}..."></textarea>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="flex justify-end gap-4 pt-4">
                            <button type="button" onclick="planManager.hideCreatePlanModal()" 
                                    class="px-6 py-2 bg-white text-gray-700 border border-gray-300 rounded-button hover:bg-gray-50 transition-colors">
                                取消
                            </button>
                            <button type="submit" 
                                    class="px-6 py-2 bg-gradient-to-r from-primary to-secondary text-white rounded-button hover:opacity-90 transition-colors">
                                ${isEdit ? '更新计划' : '创建计划'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 进度条事件
        const progressSlider = document.getElementById('plan-progress');
        const progressValue = document.getElementById('progress-value');
        if (progressSlider) {
            progressSlider.addEventListener('input', (e) => {
                progressValue.textContent = e.target.value + '%';
            });
        }
        
        // 绑定表单提交事件
        document.getElementById('new-plan-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreatePlan(existingPlan?.id);
        });
    }

    hideCreatePlanModal() {
        const modal = document.getElementById('create-plan-modal');
        if (modal) {
            modal.remove();
        }
    }

    // 处理创建或更新计划
    async handleCreatePlan(planId = null) {
        const formData = {
            title: document.getElementById('plan-title').value,
            type: document.getElementById('plan-type').value,
            duration: parseInt(document.getElementById('plan-duration').value),
            durationUnit: document.getElementById('duration-unit').value,
            description: document.getElementById('plan-description').value
        };

        if (planId) {
            // 更新计划
            formData.progress = parseInt(document.getElementById('plan-progress').value);
            await this.updatePlan(planId, formData);
        } else {
            // 创建新计划
            await this.createPlan(formData);
        }
        
        this.hideCreatePlanModal();
    }

    // 编辑计划
    async editPlan(planId) {
        const plan = this.plans.find(p => p.id === planId);
        if (!plan) return;

        this.showCreatePlanModal(null, plan);
    }

    // 修改 updatePlan 方法中的API路径
    async updatePlan(planId, planData) {
        try {
            // 如果未登录，使用本地存储
            if (!this.currentUser || this.currentUser.id === 'local_user') {
                const index = this.plans.findIndex(p => p.id === planId);
                if (index !== -1) {
                    this.plans[index] = { ...this.plans[index], ...planData };
                    this.renderPlans();
                    this.updateStats();
                    this.saveToLocalStorage();
                    this.showMessage('计划更新成功（本地模式）', 'success');
                }
                return;
            }

            const response = await fetch(`${this.baseURL}/api/plans/${planId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(planData)
            });
            
            const result = await response.json();
            if (result.success) {
                const index = this.plans.findIndex(p => p.id === planId);
                if (index !== -1) {
                    this.plans[index] = { ...this.plans[index], ...planData };
                    this.renderPlans();
                    this.updateStats();
                    this.saveToLocalStorage();
                    this.showMessage('计划更新成功', 'success');
                }
            } else {
                this.showMessage('更新计划失败: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('更新计划失败:', error);
            this.showMessage('网络错误，更新计划失败', 'error');
        }
    }

    // 增强计划详情显示
    async showPlanDetail(planId) {
        const plan = this.plans.find(p => p.id === planId);
        if (!plan) return;

        // 获取计划的日记条目
        const diaries = await this.getPlanDetail(planId);

        const modalHTML = `
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-xl shadow-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-bold text-secondary">${plan.title}</h3>
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="bg-blue-50 p-4 rounded-lg">
                                <div class="text-sm text-blue-600 mb-1">计划类型</div>
                                <div class="font-semibold">${this.getTypeInfo(plan.type).name}</div>
                            </div>
                            <div class="bg-green-50 p-4 rounded-lg">
                                <div class="text-sm text-green-600 mb-1">完成进度</div>
                                <div class="font-semibold">${plan.progress}%</div>
                            </div>
                            <div class="bg-purple-50 p-4 rounded-lg">
                                <div class="text-sm text-purple-600 mb-1">创建时间</div>
                                <div class="font-semibold">${new Date(plan.createdAt).toLocaleDateString()}</div>
                            </div>
                        </div>
                        
                        <div>
                            <h4 class="font-semibold text-gray-800 mb-3">计划描述</h4>
                            <p class="text-gray-600">${plan.description}</p>
                        </div>
                        
                        ${plan.aiAnalysis ? `
                            <div class="bg-gray-50 p-4 rounded-lg">
                                <h4 class="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                    <i class="fas fa-robot text-purple-500"></i>
                                    AI分析报告
                                </h4>
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <div class="text-gray-500">学习效率</div>
                                        <div class="font-semibold">${plan.aiAnalysis.learningEfficiency}</div>
                                    </div>
                                    <div>
                                        <div class="text-gray-500">推荐级别</div>
                                        <div class="font-semibold">${plan.aiAnalysis.recommendationLevel}</div>
                                    </div>
                                    <div>
                                        <div class="text-gray-500">预测进度</div>
                                        <div class="font-semibold">${plan.aiAnalysis.predictedProgress}%</div>
                                    </div>
                                    <div>
                                        <div class="text-gray-500">风险提示</div>
                                        <div class="font-semibold ${plan.aiAnalysis.riskAreas.length > 0 ? 'text-red-500' : 'text-green-500'}">
                                            ${plan.aiAnalysis.riskAreas.length > 0 ? '需关注' : '无风险'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 class="font-semibold text-gray-800 mb-3">计划内容</h4>
                                ${plan.content && plan.content.dailyGoals ? `
                                    <div class="mb-4">
                                        <h5 class="font-medium text-gray-700 mb-2">每日目标</h5>
                                        <ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
                                            ${plan.content.dailyGoals.map(goal => `<li>${goal}</li>`).join('')}
                                        </ul>
                                    </div>
                                ` : ''}
                                
                                ${plan.content && plan.content.studySchedule ? `
                                    <div class="mb-4">
                                        <h5 class="font-medium text-gray-700 mb-2">学习安排</h5>
                                        <ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
                                            ${plan.content.studySchedule.map(schedule => `<li>${schedule}</li>`).join('')}
                                        </ul>
                                    </div>
                                ` : ''}
                            </div>
                            
                            <div>
                                <div class="flex justify-between items-center mb-3">
                                    <h4 class="font-semibold text-gray-800">学习日记</h4>
                                    <span class="text-sm text-gray-500">${diaries.length} 条记录</span>
                                </div>
                                
                                ${diaries.length > 0 ? `
                                    <div class="space-y-3 max-h-60 overflow-y-auto">
                                        ${diaries.slice(0, 5).map(diary => `
                                            <div class="diary-entry ${this.getMoodClass(diary.mood)} p-3 rounded-lg">
                                                <div class="flex justify-between items-center mb-2">
                                                    <span class="text-sm text-gray-500">${new Date(diary.date).toLocaleDateString()}</span>
                                                    <span class="text-sm ${this.getMoodColor(diary.mood)}">${this.getMoodText(diary.mood)}</span>
                                                </div>
                                                <p class="text-gray-700 text-sm">${diary.content}</p>
                                                ${diary.achievements && diary.achievements.length > 0 ? `
                                                    <div class="mt-2">
                                                        <span class="text-xs text-green-600 font-medium">成就:</span>
                                                        <ul class="list-disc list-inside text-xs text-gray-600">
                                                            ${diary.achievements.map(ach => `<li>${ach}</li>`).join('')}
                                                        </ul>
                                                    </div>
                                                ` : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : `
                                    <div class="text-center py-8 bg-gray-50 rounded-lg">
                                        <i class="fas fa-book-open text-2xl text-gray-300 mb-2"></i>
                                        <p class="text-gray-500 text-sm">暂无日记记录</p>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex gap-3 justify-end mt-6 pt-4 border-t">
                        <button onclick="planManager.showDiaryModal(${planId})" class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                            <i class="fas fa-book mr-2"></i>写日记
                        </button>
                        <button onclick="planManager.exportPlanToPDF(${planId})" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                            <i class="fas fa-download mr-2"></i>导出PDF
                        </button>
                        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                            关闭
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    showDiaryModal(planId) {
        const modalHTML = `
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-xl shadow-lg p-6 w-full max-w-2xl">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-bold text-secondary">记录学习日记</h3>
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <form id="diary-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">今日心情</label>
                            <div class="flex gap-2">
                                ${['happy', 'normal', 'sad', 'tired', 'excited'].map(mood => `
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="mood" value="${mood}" class="hidden peer">
                                        <div class="w-10 h-10 rounded-full border-2 border-gray-300 peer-checked:border-blue-500 flex items-center justify-center text-lg">
                                            ${this.getMoodEmoji(mood)}
                                        </div>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div>
                            <label for="diary-content" class="block text-sm font-medium text-gray-700 mb-2">日记内容</label>
                            <textarea id="diary-content" rows="6" 
                                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" 
                                      placeholder="记录今天的学习情况、收获和感想..."></textarea>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="achievements" class="block text-sm font-medium text-gray-700 mb-2">今日成就</label>
                                <textarea id="achievements" rows="3" 
                                          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" 
                                          placeholder="今天完成了哪些学习任务..."></textarea>
                            </div>
                            <div>
                                <label for="challenges" class="block text-sm font-medium text-gray-700 mb-2">遇到困难</label>
                                <textarea id="challenges" rows="3" 
                                          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" 
                                          placeholder="学习中遇到的困难和问题..."></textarea>
                            </div>
                        </div>
                        
                        <div>
                            <label for="reflection" class="block text-sm font-medium text-gray-700 mb-2">反思总结</label>
                            <textarea id="reflection" rows="3" 
                                      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" 
                                      placeholder="对今天学习的反思和明天计划..."></textarea>
                        </div>
                    </form>
                    
                    <div class="flex gap-3 justify-end mt-6 pt-4 border-t">
                        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                            取消
                        </button>
                        <button onclick="planManager.submitDiary(${planId})" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors">
                            保存日记
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    async submitDiary(planId) {
        const form = document.getElementById('diary-form');
        const formData = new FormData(form);
        
        const entry = {
            content: document.getElementById('diary-content').value,
            mood: formData.get('mood') || 'normal',
            achievements: document.getElementById('achievements').value.split('\n').filter(line => line.trim()),
            challenges: document.getElementById('challenges').value.split('\n').filter(line => line.trim()),
            reflection: document.getElementById('reflection').value
        };
        
        if (!entry.content.trim()) {
            this.showMessage('请填写日记内容', 'error');
            return;
        }
        
        await this.addDiaryEntry(planId, entry);
        document.querySelector('.fixed.inset-0').remove();
    }

    getMoodEmoji(mood) {
        const emojis = {
            'happy': '😊',
            'normal': '😐',
            'sad': '😔',
            'tired': '😴',
            'excited': '😄'
        };
        return emojis[mood] || '😐';
    }

    getMoodText(mood) {
        const texts = {
            'happy': '开心',
            'normal': '一般',
            'sad': '难过',
            'tired': '疲惫',
            'excited': '兴奋'
        };
        return texts[mood] || '一般';
    }

    getMoodColor(mood) {
        const colors = {
            'happy': 'text-green-500',
            'normal': 'text-blue-500',
            'sad': 'text-red-500',
            'tired': 'text-yellow-500',
            'excited': 'text-purple-500'
        };
        return colors[mood] || 'text-blue-500';
    }

    getMoodClass(mood) {
        const classes = {
            'happy': 'bg-green-50 border-l-green-400',
            'normal': 'bg-blue-50 border-l-blue-400',
            'sad': 'bg-red-50 border-l-red-400',
            'tired': 'bg-yellow-50 border-l-yellow-400',
            'excited': 'bg-purple-50 border-l-purple-400'
        };
        return classes[mood] || 'bg-blue-50 border-l-blue-400';
    }

    initEventListeners() {
        // 计划分类切换
        document.getElementById('all-plans-tab')?.addEventListener('click', () => this.loadPlans('all'));
        document.getElementById('ai-plans-tab')?.addEventListener('click', () => this.loadPlans('ai'));
        document.getElementById('custom-plans-tab')?.addEventListener('click', () => this.loadPlans('custom'));
        document.getElementById('completed-plans-tab')?.addEventListener('click', () => this.loadPlans('completed'));
        document.getElementById('active-plans-tab')?.addEventListener('click', () => this.loadPlans('active'));
        
        // AI生成计划按钮
        document.getElementById('ai-generate-btn')?.addEventListener('click', () => this.generateAIPlan());
    }

    updateStats() {
        // 更新学习统计显示
        const totalPlans = this.plans.length;
        const completedPlans = this.plans.filter(p => p.progress === 100).length;
        const averageProgress = totalPlans > 0 ? 
            Math.round(this.plans.reduce((sum, p) => sum + p.progress, 0) / totalPlans) : 0;
        
        // 更新UI显示
        const statsElements = {
            'total-plans-count': totalPlans,
            'completed-plans-count': completedPlans,
            'average-progress': averageProgress + '%'
        };
        
        Object.entries(statsElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    // 修改 getAuthHeaders 方法
    getAuthHeaders() {
        if (window.unifiedAuthManager && window.unifiedAuthManager.getAuthHeaders) {
            const headers = window.unifiedAuthManager.getAuthHeaders();
            // 确保包含 Content-Type
            if (!headers['Content-Type']) {
                headers['Content-Type'] = 'application/json';
            }
            return headers;
        }
        
        // 回退到基础头信息
        return { 
            'Content-Type': 'application/json'
        };
    }

    // 新增：保存到本地存储
    saveToLocalStorage() {
        try {
            localStorage.setItem('moyu_plans', JSON.stringify(this.plans));
            localStorage.setItem('moyu_plans_updated', new Date().toISOString());
        } catch (error) {
            console.error('保存到本地存储失败:', error);
        }
    }

    // 修改 loadLocalPlans 方法
    loadLocalPlans(filter = 'all') {
        try {
            const localPlans = localStorage.getItem('moyu_plans');
            if (localPlans) {
                let plans = JSON.parse(localPlans);
                
                // 应用过滤器
                switch (filter) {
                    case 'ai':
                        plans = plans.filter(p => p.source === 'ai');
                        break;
                    case 'custom':
                        plans = plans.filter(p => p.source === 'custom');
                        break;
                    case 'completed':
                        plans = plans.filter(p => p.progress === 100);
                        break;
                    case 'active':
                        plans = plans.filter(p => p.progress < 100);
                        break;
                    default:
                        break;
                }
                
                this.plans = plans;
                this.renderPlans();
                this.updateStats();
            } else {
                // 如果没有本地数据，创建一些示例计划
                this.createSamplePlans();
            }
        } catch (error) {
            console.error('加载本地计划失败:', error);
            this.createSamplePlans();
        }
    }

    // 新增：创建示例计划
    createSamplePlans() {
        this.plans = [
            {
                id: 1,
                title: '四级词汇突破计划',
                type: 'vocabulary',
                source: 'custom',
                description: '30天掌握四级核心词汇',
                content: {
                    dailyGoals: ['学习50个新单词', '复习前日单词', '完成词汇测试'],
                    studySchedule: ['早晨: 记忆新单词', '下午: 复习巩固', '晚上: 测试检验']
                },
                duration: 30,
                durationUnit: 'days',
                progress: 45,
                createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 2,
                title: '听力精讲训练',
                type: 'listening',
                source: 'ai',
                description: 'AI推荐的听力提升方案',
                content: {
                    dailyGoals: ['精听1篇短文', '泛听30分钟', '完成听力练习'],
                    studySchedule: ['上午: 精听训练', '下午: 泛听材料', '晚上: 练习巩固']
                },
                duration: 21,
                durationUnit: 'days',
                progress: 75,
                aiAnalysis: {
                    learningEfficiency: '良好',
                    recommendationLevel: '中级',
                    predictedProgress: 85
                },
                createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
        
        this.saveToLocalStorage();
        this.renderPlans();
        this.updateStats();
    }

    // 新增：获取计划日记数量
    getPlanDiaryCount(planId) {
        // 这里应该从本地存储或服务器获取实际的日记数量
        // 暂时返回模拟数据
        return Math.floor(Math.random() * 5);
    }

    showMessage(message, type = 'info') {
        if (window.uiManager && window.uiManager.showMessage) {
            window.uiManager.showMessage(message, type);
        } else {
            alert(message);
        }
    }
}

// 创建全局计划管理器实例
window.planManager = new PlanManager();