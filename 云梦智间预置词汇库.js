// [file name]: 云梦智间预置词汇库.js
class PrebuiltVocabularyManager {
    constructor() {
        this.authManager = window.unifiedAuthManager;
        this.apiBase = '/api';
        this.initialized = false;
        this.initializationCallbacks = [];
    }

    // 初始化用户词汇库
    async initializeUserVocabulary(level = 'CET4') {
        if (!this.authManager.isLoggedIn()) {
            throw new Error('请先登录');
        }

        try {
            window.uiManager.showLearningProgress('正在初始化词汇库...');

            const response = await fetch(`${this.apiBase}/vocabulary/initialize`, {
                method: 'POST',
                headers: this.authManager.getAuthHeaders(),
                body: JSON.stringify({ level })
            });

            const result = await response.json();
            
            window.uiManager.hideLearningProgress();

            if (result.success) {
                this.initialized = true;
                
                // 通知初始化完成
                this.notifyInitializationComplete(level, result.data.importedCount);
                
                // 显示成功消息
                window.uiManager.showLearningNotification(
                    `词汇库初始化成功！已导入 ${result.data.importedCount} 个单词`,
                    'success',
                    5000
                );

                return result;
            } else {
                throw new Error(result.message || '初始化失败');
            }
        } catch (error) {
            window.uiManager.hideLearningProgress();
            console.error('初始化词汇库失败:', error);
            throw error;
        }
    }

    // 检查用户词汇库状态
    async checkVocabularyStatus() {
        if (!this.authManager.isLoggedIn()) {
            return { hasVocabulary: false, needInitialize: false };
        }

        try {
            const response = await fetch(`${this.apiBase}/vocabulary/status`, {
                headers: this.authManager.getAuthHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                return result.data;
            }
            return { hasVocabulary: false, needInitialize: true };
        } catch (error) {
            console.error('检查词汇状态失败:', error);
            return { hasVocabulary: false, needInitialize: true };
        }
    }

    // 新增方法：获取词汇统计
    async getVocabularyStats() {
        if (!this.authManager.isLoggedIn()) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiBase}/vocabulary/stats`, {
                headers: this.authManager.getAuthHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    return result.data;
                }
            }
            return null;
        } catch (error) {
            console.error('获取词汇统计失败:', error);
            return null;
        }
    }

    // 显示词汇库统计面板
    async showStatisticsPanel() {
        if (!this.authManager.isLoggedIn()) {
            this.authManager.showLoginPrompt();
            return;
        }

        const stats = await this.getVocabularyStats();
        if (!stats) {
            window.uiManager.showMessage('获取统计信息失败', 'error');
            return;
        }

        const modalHTML = `
            <div id="vocabulary-stats-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div class="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-semibold text-secondary">词汇库统计</h3>
                        <button id="close-stats-modal" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        ${this.generateStatsHTML(stats)}
                    </div>

                    <div class="bg-blue-50 rounded-lg p-4 mb-6">
                        <div class="flex items-start">
                            <i class="fas fa-info-circle text-blue-500 mt-1 mr-3"></i>
                            <div class="text-sm text-blue-700">
                                <p class="font-medium">词汇库说明</p>
                                <p class="mt-1">系统已预置完整的四六级词汇库，包含标准发音、释义和例句，支持科学的间隔重复学习算法。</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex gap-3">
                        <button id="close-stats" class="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">关闭</button>
                        <button id="manage-vocabulary" class="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-secondary transition-colors">管理词汇库</button>
                    </div>
                </div>
            </div>
        `;

        // 移除已存在的模态框
        const existingModal = document.getElementById('vocabulary-stats-modal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.bindStatsEvents();
    }

    // 生成统计信息HTML
    generateStatsHTML(stats) {
        let html = '';

        // 用户学习统计
        if (stats.userStats && stats.userStats.length > 0) {
            stats.userStats.forEach(levelStat => {
                const levelName = levelStat.level === 'CET4' ? '四级词汇' : '六级词汇';
                const progress = levelStat.total > 0 ? Math.round((levelStat.mastered / levelStat.total) * 100) : 0;
                
                html += `
                    <div class="bg-white border border-gray-200 rounded-lg p-4">
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="font-semibold text-gray-900">${levelName}</h4>
                            <span class="text-sm px-2 py-1 bg-blue-100 text-blue-700 rounded-full">${progress}%</span>
                        </div>
                        <div class="space-y-2">
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">已掌握</span>
                                <span class="font-medium">${levelStat.mastered}/${levelStat.total}</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">待复习</span>
                                <span class="font-medium">${levelStat.due_for_review}</span>
                            </div>
                        </div>
                        <div class="mt-3 bg-gray-200 rounded-full h-2">
                            <div class="bg-green-500 h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                        </div>
                    </div>
                `;
            });
        } else {
            html += `
                <div class="bg-white border border-gray-200 rounded-lg p-4 col-span-2">
                    <div class="text-center py-4">
                        <i class="fas fa-books text-3xl text-gray-300 mb-3"></i>
                        <p class="text-gray-500">尚未开始学习，快去初始化词汇库吧！</p>
                    </div>
                </div>
            `;
        }

        // 基础词汇库统计
        if (stats.baseStats && stats.baseStats.length > 0) {
            stats.baseStats.forEach(baseStat => {
                const levelName = baseStat.level === 'CET4' ? '四级词汇库' : '六级词汇库';
                html += `
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="font-semibold text-gray-900">${levelName}</h4>
                            <span class="text-sm px-2 py-1 bg-gray-200 text-gray-700 rounded-full">总计</span>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-primary">${baseStat.total}</div>
                            <div class="text-sm text-gray-600 mt-1">个词汇</div>
                        </div>
                        <div class="mt-3 text-xs text-gray-500">
                            <p>• 标准发音和释义</p>
                            <p>• 实用例句</p>
                            <p>• 科学的难度分级</p>
                        </div>
                    </div>
                `;
            });
        }

        return html;
    }

    // 绑定统计面板事件
    bindStatsEvents() {
        const modal = document.getElementById('vocabulary-stats-modal');
        const closeBtn = document.getElementById('close-stats-modal');
        const closeBtn2 = document.getElementById('close-stats');
        const manageBtn = document.getElementById('manage-vocabulary');

        // 关闭模态框
        [closeBtn, closeBtn2].forEach(btn => {
            btn.addEventListener('click', () => {
                modal.remove();
            });
        });

        // 管理词汇库
        manageBtn.addEventListener('click', () => {
            modal.remove();
            if (window.vocabularyManager) {
                window.vocabularyManager.showVocabularyManagement();
            }
        });

        // 点击外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // 修改初始化方法，添加统计信息
    async showInitializationDialog() {
        if (!this.authManager.isLoggedIn()) {
            this.authManager.showLoginPrompt();
            return;
        }

        const status = await this.checkVocabularyStatus();
        const stats = await this.getVocabularyStats();
        
        if (!status.needInitialize) {
            // 如果已经初始化，显示统计面板
            this.showStatisticsPanel();
            return;
        }

        // 原有的初始化对话框代码，添加统计信息展示
        const modalHTML = `
            <div id="vocabulary-init-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div class="bg-white rounded-xl p-6 w-full max-w-2xl mx-4">
                    <div class="text-center mb-6">
                        <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 text-2xl mx-auto mb-4">
                            <i class="fas fa-database"></i>
                        </div>
                        <h3 class="text-xl font-semibold text-secondary mb-2">初始化词汇库</h3>
                        <p class="text-gray-600">选择要学习的词汇级别，系统将为您加载完整的预置词汇库</p>
                    </div>
                    
                    <!-- 添加词汇库统计 -->
                    ${stats && stats.baseStats ? this.renderBaseStats(stats.baseStats) : ''}
                    
                    <div class="space-y-4 mb-6">
                        <div class="level-option">
                            <input type="radio" id="level-cet4" name="vocabulary-level" value="CET4" class="hidden" checked>
                            <label for="level-cet4" class="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors level-label">
                                <div class="w-6 h-6 rounded-full border-2 border-gray-300 mr-3 flex items-center justify-center level-radio">
                                    <div class="w-3 h-3 rounded-full bg-white"></div>
                                </div>
                                <div class="flex-1">
                                    <h4 class="font-semibold text-gray-900">大学英语四级词汇</h4>
                                    <p class="text-sm text-gray-600">约4500个核心词汇，适合四级备考</p>
                                </div>
                                <div class="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                    推荐
                                </div>
                            </label>
                        </div>
                        
                        <div class="level-option">
                            <input type="radio" id="level-cet6" name="vocabulary-level" value="CET6" class="hidden">
                            <label for="level-cet6" class="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-green-300 transition-colors level-label">
                                <div class="w-6 h-6 rounded-full border-2 border-gray-300 mr-3 flex items-center justify-center level-radio">
                                    <div class="w-3 h-3 rounded-full bg-white"></div>
                                </div>
                                <div class="flex-1">
                                    <h4 class="font-semibold text-gray-900">大学英语六级词汇</h4>
                                    <p class="text-sm text-gray-600">约5500个高级词汇，适合六级备考</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="bg-blue-50 rounded-lg p-4 mb-6">
                        <div class="flex items-start">
                            <i class="fas fa-info-circle text-blue-500 mt-1 mr-3"></i>
                            <div class="text-sm text-blue-700">
                                <p class="font-medium">完整预置词汇库</p>
                                <p class="mt-1">系统已包含完整的四六级词汇表，每个单词都有标准发音、释义、例句和科学的难度分级</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex gap-3">
                        <button id="cancel-init" class="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">稍后再说</button>
                        <button id="start-init" class="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-secondary transition-colors">开始学习</button>
                    </div>
                </div>
            </div>
        `;

        // 移除已存在的模态框
        const existingModal = document.getElementById('vocabulary-init-modal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.bindInitEvents();
    }

    // 渲染基础词汇库统计
    renderBaseStats(baseStats) {
        let html = '<div class="grid grid-cols-2 gap-4 mb-6">';
        
        baseStats.forEach(stat => {
            const levelName = stat.level === 'CET4' ? '四级词汇库' : '六级词汇库';
            html += `
                <div class="bg-gray-50 rounded-lg p-4 text-center">
                    <div class="text-2xl font-bold text-primary">${stat.total}</div>
                    <div class="text-sm text-gray-600 mt-1">${levelName}</div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    // 绑定初始化事件
    bindInitEvents() {
        const modal = document.getElementById('vocabulary-init-modal');
        const cancelBtn = document.getElementById('cancel-init');
        const startBtn = document.getElementById('start-init');
        const levelLabels = document.querySelectorAll('.level-label');

        // 级别选择效果
        levelLabels.forEach(label => {
            label.addEventListener('click', () => {
                // 移除所有选中状态
                levelLabels.forEach(l => {
                    l.classList.remove('border-blue-500', 'border-green-500', 'bg-blue-50', 'bg-green-50');
                    const radio = l.querySelector('.level-radio');
                    radio.classList.remove('border-blue-500', 'border-green-500');
                    radio.querySelector('div').classList.remove('bg-blue-500', 'bg-green-500');
                });

                // 设置当前选中状态
                const input = label.querySelector('input');
                const level = input.value;
                
                if (level === 'CET4') {
                    label.classList.add('border-blue-500', 'bg-blue-50');
                    const radio = label.querySelector('.level-radio');
                    radio.classList.add('border-blue-500');
                    radio.querySelector('div').classList.add('bg-blue-500');
                } else {
                    label.classList.add('border-green-500', 'bg-green-50');
                    const radio = label.querySelector('.level-radio');
                    radio.classList.add('border-green-500');
                    radio.querySelector('div').classList.add('bg-green-500');
                }
            });
        });

        // 默认选中CET4
        document.querySelector('#level-cet4').checked = true;
        document.querySelector('label[for="level-cet4"]').click();

        // 取消初始化
        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });

        // 开始初始化
        startBtn.addEventListener('click', async () => {
            const selectedLevel = document.querySelector('input[name="vocabulary-level"]:checked').value;
            
            startBtn.disabled = true;
            startBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>初始化中...';

            try {
                await this.initializeUserVocabulary(selectedLevel);
                window.uiManager.showMessage('词汇库初始化成功！', 'success');
                modal.remove();
                
                // 刷新页面数据
                if (window.vocabularyManager) {
                    await window.vocabularyManager.loadVocabularyList();
                    await window.vocabularyManager.loadProgress();
                }
            } catch (error) {
                window.uiManager.showMessage(`初始化失败: ${error.message}`, 'error');
                startBtn.disabled = false;
                startBtn.innerHTML = '开始学习';
            }
        });

        // 点击外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // 切换词汇级别
    async switchVocabularyLevel(level) {
        if (!this.authManager.isLoggedIn()) {
            throw new Error('请先登录');
        }

        try {
            const response = await fetch(`${this.apiBase}/vocabulary/switch-level`, {
                method: 'POST',
                headers: this.authManager.getAuthHeaders(),
                body: JSON.stringify({ level })
            });

            const result = await response.json();
            
            if (result.success) {
                return result;
            } else {
                throw new Error(result.message || '切换失败');
            }
        } catch (error) {
            console.error('切换词汇级别失败:', error);
            throw error;
        }
    }

    // 显示级别切换界面
    showLevelSwitchDialog() {
        if (!this.authManager.isLoggedIn()) {
            this.authManager.showLoginPrompt();
            return;
        }

        const modalHTML = `
            <div id="level-switch-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div class="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-xl font-semibold text-secondary">切换词汇级别</h3>
                        <button id="close-switch-modal" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="space-y-4 mb-6">
                        <div class="level-option">
                            <input type="radio" id="switch-cet4" name="switch-level" value="CET4" class="hidden">
                            <label for="switch-cet4" class="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors switch-level-label">
                                <div class="w-6 h-6 rounded-full border-2 border-gray-300 mr-3 flex items-center justify-center switch-radio">
                                    <div class="w-3 h-3 rounded-full bg-white"></div>
                                </div>
                                <div class="flex-1">
                                    <h4 class="font-semibold text-gray-900">大学英语四级词汇</h4>
                                    <p class="text-sm text-gray-600">约4500个核心词汇</p>
                                </div>
                            </label>
                        </div>
                        
                        <div class="level-option">
                            <input type="radio" id="switch-cet6" name="switch-level" value="CET6" class="hidden">
                            <label for="switch-cet6" class="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-green-300 transition-colors switch-level-label">
                                <div class="w-6 h-6 rounded-full border-2 border-gray-300 mr-3 flex items-center justify-center switch-radio">
                                    <div class="w-3 h-3 rounded-full bg-white"></div>
                                </div>
                                <div class="flex-1">
                                    <h4 class="font-semibold text-gray-900">大学英语六级词汇</h4>
                                    <p class="text-sm text-gray-600">约5500个高级词汇</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="bg-yellow-50 rounded-lg p-4 mb-6">
                        <div class="flex items-start">
                            <i class="fas fa-exclamation-triangle text-yellow-500 mt-1 mr-3"></i>
                            <div class="text-sm text-yellow-700">
                                <p class="font-medium">注意：切换级别将重置学习进度</p>
                                <p class="mt-1">当前级别的学习数据将被保存，但新级别将从零开始</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex gap-3">
                        <button id="cancel-switch" class="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">取消</button>
                        <button id="confirm-switch" class="flex-1 px-4 py-3 bg-primary text-white rounded-lg hover:bg-secondary transition-colors">确认切换</button>
                    </div>
                </div>
            </div>
        `;

        // 移除已存在的模态框
        const existingModal = document.getElementById('level-switch-modal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.bindSwitchEvents();
    }

    // 绑定切换事件
    bindSwitchEvents() {
        const modal = document.getElementById('level-switch-modal');
        const closeBtn = document.getElementById('close-switch-modal');
        const cancelBtn = document.getElementById('cancel-switch');
        const confirmBtn = document.getElementById('confirm-switch');
        const levelLabels = document.querySelectorAll('.switch-level-label');

        // 级别选择效果
        levelLabels.forEach(label => {
            label.addEventListener('click', () => {
                // 移除所有选中状态
                levelLabels.forEach(l => {
                    l.classList.remove('border-blue-500', 'border-green-500', 'bg-blue-50', 'bg-green-50');
                    const radio = l.querySelector('.switch-radio');
                    radio.classList.remove('border-blue-500', 'border-green-500');
                    radio.querySelector('div').classList.remove('bg-blue-500', 'bg-green-500');
                });

                // 设置当前选中状态
                const input = label.querySelector('input');
                const level = input.value;
                
                if (level === 'CET4') {
                    label.classList.add('border-blue-500', 'bg-blue-50');
                    const radio = label.querySelector('.switch-radio');
                    radio.classList.add('border-blue-500');
                    radio.querySelector('div').classList.add('bg-blue-500');
                } else {
                    label.classList.add('border-green-500', 'bg-green-50');
                    const radio = label.querySelector('.switch-radio');
                    radio.classList.add('border-green-500');
                    radio.querySelector('div').classList.add('bg-green-500');
                }
            });
        });

        // 关闭模态框
        [closeBtn, cancelBtn].forEach(btn => {
            btn.addEventListener('click', () => {
                modal.remove();
            });
        });

        // 确认切换
        confirmBtn.addEventListener('click', async () => {
            const selectedLevel = document.querySelector('input[name="switch-level"]:checked');
            
            if (!selectedLevel) {
                window.uiManager.showMessage('请选择要切换的级别', 'error');
                return;
            }

            const level = selectedLevel.value;
            
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>切换中...';

            try {
                await this.switchVocabularyLevel(level);
                window.uiManager.showMessage(`已切换到${level}词汇库`, 'success');
                modal.remove();
                
                // 刷新页面数据
                if (window.vocabularyManager) {
                    await window.vocabularyManager.loadVocabularyList();
                    await window.vocabularyManager.loadProgress();
                    await window.vocabularyManager.loadLearningData();
                }
            } catch (error) {
                window.uiManager.showMessage(`切换失败: ${error.message}`, 'error');
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '确认切换';
            }
        });

        // 点击外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // 新增：添加初始化回调
    onInitialized(callback) {
        this.initializationCallbacks.push(callback);
    }

    // 新增：通知初始化完成
    notifyInitializationComplete(level, wordCount) {
        this.initializationCallbacks.forEach(callback => {
            try {
                callback(level, wordCount);
            } catch (error) {
                console.error('初始化回调执行失败:', error);
            }
        });
    }

    // 新增：获取词汇学习建议
    async getLearningSuggestions() {
        if (!this.authManager.isLoggedIn()) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiBase}/vocabulary/suggestions`, {
                headers: this.authManager.getAuthHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    return result.data;
                }
            }
            return null;
        } catch (error) {
            console.error('获取学习建议失败:', error);
            return null;
        }
    }

    // 新增：显示学习建议
    async showLearningSuggestions() {
        const suggestions = await this.getLearningSuggestions();
        if (!suggestions) return;

        const suggestionsHTML = `
            <div id="learning-suggestions-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div class="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-semibold text-secondary">学习建议</h3>
                        <button id="close-suggestions-modal" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="space-y-4">
                        ${suggestions.map(suggestion => `
                            <div class="border border-gray-200 rounded-lg p-4 hover:border-primary transition-colors cursor-pointer suggestion-item" data-type="${suggestion.type}">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="font-semibold text-gray-900">${suggestion.title}</h4>
                                        <p class="text-sm text-gray-600 mt-1">${suggestion.description}</p>
                                    </div>
                                    <i class="fas fa-chevron-right text-gray-400"></i>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="mt-6">
                        <button id="close-suggestions" class="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                            关闭
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', suggestionsHTML);
        this.bindSuggestionsEvents();
    }

    // 新增：绑定建议事件
    bindSuggestionsEvents() {
        const modal = document.getElementById('learning-suggestions-modal');
        const closeBtn = document.getElementById('close-suggestions-modal');
        const closeBtn2 = document.getElementById('close-suggestions');

        [closeBtn, closeBtn2].forEach(btn => {
            btn.addEventListener('click', () => {
                modal.remove();
            });
        });

        // 建议项点击事件
        document.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                this.handleSuggestionClick(type);
                modal.remove();
            });
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // 新增：处理建议点击
    handleSuggestionClick(type) {
        switch (type) {
            case 'start_learning':
                if (window.vocabularyManager) {
                    window.vocabularyManager.startIntelligentLearning();
                }
                break;
            case 'review_words':
                if (window.vocabularyManager) {
                    window.vocabularyManager.startReviewSession();
                }
                break;
            case 'practice_spelling':
                window.location.href = '云梦智间拼写练习.html';
                break;
            case 'view_progress':
                if (window.learningStatistics) {
                    window.learningStatistics.showStatisticsPanel();
                }
                break;
        }
    }
}

// 创建全局实例
window.prebuiltVocabularyManager = new PrebuiltVocabularyManager();