// 社区页面功能模块 - 增强版（包含示例数据）
class CommunityManager {
    constructor() {
        this.authManager = window.unifiedAuthManager;
        this.communityAuth = window.communityAuthManager;
        this.currentCategory = '全部';
        this.currentPage = 1;
        this.postsPerPage = 5;
        this.currentPostDetail = null;
        
        // 示例数据
        this.sampleData = {
            samplePosts: [
                {
                    id: 1,
                    user_id: 1,
                    title: '分享我的四级听力满分技巧',
                    content: '备考四级的同学们，我刚刚查分听力部分拿了满分！想分享一下我的备考经验。\n\n我的方法主要是精听+泛听结合：\n\n1. **精听练习**：每天坚持30分钟精听真题，逐句听写，反复听直到完全听懂\n2. **泛听训练**：每天1小时泛听BBC/VOA，培养语感\n3. **词汇积累**：重点记忆听力高频词汇\n4. **模拟测试**：每周做一套完整听力模拟题\n\n坚持这个方法3个月，我的听力从15分提升到了满分！',
                    category: '四级备考',
                    tags: '听力技巧,四级',
                    view_count: 256,
                    like_count: 48,
                    comment_count: 32,
                    is_pinned: 0,
                    created_at: '2024-06-10 14:30:00',
                    author_name: '王梦琪',
                    author_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1588&auto=format&fit=crop'
                },
                {
                    id: 2,
                    user_id: 2,
                    title: '整理的高频六级词汇表分享',
                    content: '备考六级期间整理的近5年真题高频词汇表，包含词频统计和真题例句，希望对大家有帮助。\n\n这份词汇表按照词频排序，包含1200个高频词汇，每个词汇都配有：\n- 音标和发音\n- 核心释义\n- 真题例句\n- 常见搭配\n\n我已经将这份词汇表上传到云盘，需要的同学可以私信我获取下载链接。',
                    category: '词汇学习',
                    tags: '六级,词汇表',
                    view_count: 189,
                    like_count: 56,
                    comment_count: 24,
                    is_pinned: 0,
                    created_at: '2024-06-09 10:15:00',
                    author_name: '张明',
                    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1587&auto=format&fit=crop'
                },
                {
                    id: 3,
                    user_id: 3,
                    title: '六级写作万能模板真的有用吗？',
                    content: '看到很多同学在背所谓的"万能模板"，作为去年写作拿到198分的过来人，想分享一下我对模板使用的看法。\n\n**模板的优缺点：**\n\n优点：\n- 快速搭建文章框架\n- 保证基本结构完整\n- 节省构思时间\n\n缺点：\n- 容易千篇一律\n- 限制思维发挥\n- 难以获得高分\n\n**我的建议：**\n1. 学习模板的结构思路\n2. 积累自己的表达方式\n3. 重点练习段落扩展\n4. 多读优秀范文\n\n记住：模板只是工具，高分关键在于内容质量！',
                    category: '写作指导',
                    tags: '写作技巧,高分经验',
                    view_count: 342,
                    like_count: 89,
                    comment_count: 47,
                    is_pinned: 0,
                    created_at: '2024-06-08 16:45:00',
                    author_name: '李思',
                    author_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1588&auto=format&fit=crop'
                },
                {
                    id: 4,
                    user_id: 4,
                    title: '听力辨音技巧：如何区分相似发音',
                    content: '很多同学反映在听力中难以区分相似的发音，比如ship/sheep，bad/bed等。\n\n这里分享几个实用的辨音技巧：\n\n1. **对比训练法**：找出发音相似的单词进行对比练习\n2. **语境理解法**：通过句子上下文判断正确单词\n3. **口型观察法**：观察发音时的口型差异\n4. **录音对比法**：录制自己的发音与标准发音对比\n\n每天坚持练习15分钟，一个月后会有明显改善！',
                    category: '听力技巧',
                    tags: '发音,听力训练',
                    view_count: 156,
                    like_count: 34,
                    comment_count: 18,
                    is_pinned: 0,
                    created_at: '2024-06-07 09:20:00',
                    author_name: '陈晓',
                    author_avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=1587&auto=format&fit=crop'
                },
                {
                    id: 5,
                    user_id: 5,
                    title: '30天词汇量突破5000+的经验分享',
                    content: '经过30天的集中训练，我的词汇量从3000+突破到了5000+，分享我的方法：\n\n**核心方法：**\n\n1. **词根词缀法**：掌握常见词根词缀，事半功倍\n2. **联想记忆法**：通过故事、图像等方式加深记忆\n3. **间隔重复法**：按照艾宾浩斯遗忘曲线安排复习\n4. **语境学习法**：在句子和文章中学习词汇用法\n\n**每日安排：**\n- 早晨：学习新词汇50个\n- 中午：复习前日词汇\n- 晚上：应用练习和测试\n\n坚持就是胜利！',
                    category: '词汇学习',
                    tags: '词汇记忆,学习方法',
                    view_count: 278,
                    like_count: 67,
                    comment_count: 29,
                    is_pinned: 0,
                    created_at: '2024-06-06 14:10:00',
                    author_name: '刘阳',
                    author_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=1580&auto=format&fit=crop'
                }
            ],
            comments: [
                {
                    id: 1,
                    post_id: 1,
                    user_id: 2,
                    content: '感谢分享！我也在备考四级，听力一直是我的弱项，这个方法很实用！',
                    created_at: '2024-06-10 15:20:00',
                    author_name: '张明',
                    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1587&auto=format&fit=crop'
                },
                {
                    id: 2,
                    post_id: 1,
                    user_id: 3,
                    content: '请问精听练习是用什么材料比较好？真题还是其他资料？',
                    created_at: '2024-06-10 16:05:00',
                    author_name: '李思',
                    author_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1588&auto=format&fit=crop'
                },
                {
                    id: 3,
                    post_id: 2,
                    user_id: 1,
                    content: '已私信，期待词汇表！最近正在为六级词汇发愁。',
                    created_at: '2024-06-09 11:30:00',
                    author_name: '王梦琪',
                    author_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1588&auto=format&fit=crop'
                }
            ],
            hotTopics: [
                { category: '四级备考', count: 156 },
                { category: '词汇学习', count: 128 },
                { category: '写作指导', count: 97 },
                { category: '听力技巧', count: 85 },
                { category: '六级备考', count: 76 }
            ],
            activeUsers: [
                { id: 1, name: '王梦琪', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1588&auto=format&fit=crop', post_count: 23 },
                { id: 2, name: '张明', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1587&auto=format&fit=crop', post_count: 18 },
                { id: 3, name: '李思', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1588&auto=format&fit=crop', post_count: 15 },
                { id: 4, name: '陈晓', avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=1587&auto=format&fit=crop', post_count: 12 },
                { id: 5, name: '刘阳', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=1580&auto=format&fit=crop', post_count: 10 }
            ]
        };

        this.init();
    }

    init() {
        this.renderHotTopics();
        this.renderActiveUsers();
        this.renderStats();
        this.renderPosts();
        this.initChart();
        this.bindEvents();
        
        // 监听认证状态变化
        if (this.authManager && this.authManager.addAuthListener) {
            this.authManager.addAuthListener((isLoggedIn, user) => {
                this.handleAuthChange(isLoggedIn, user);
            });
        }
    }

    // 处理认证状态变化
    handleAuthChange(isLoggedIn, user) {
        // 更新发帖按钮显示状态
        const newPostBtn = document.getElementById('new-post-btn');
        if (newPostBtn) {
            newPostBtn.style.display = isLoggedIn ? 'block' : 'none';
        }
        
        // 重新渲染帖子列表以更新权限相关状态
        this.renderPosts();
    }

    // 绑定事件 - 修改认证检查
    bindEvents() {
        // 分类标签点击
        document.querySelectorAll('#category-tabs button').forEach(button => {
            button.addEventListener('click', (e) => {
                const category = e.target.getAttribute('data-category');
                this.setActiveCategory(category);
            });
        });

        // 发布新帖子按钮 - 添加认证检查
        document.getElementById('new-post-btn')?.addEventListener('click', () => {
            if (!this.authManager.isLoggedIn()) {
                this.communityAuth.showCommunityLoginPrompt();
                return;
            }
            document.getElementById('new-post-modal').classList.remove('hidden');
        });

        // 关闭模态框
        document.getElementById('close-modal')?.addEventListener('click', () => {
            document.getElementById('new-post-modal').classList.add('hidden');
        });

        document.getElementById('cancel-post')?.addEventListener('click', () => {
            document.getElementById('new-post-modal').classList.add('hidden');
        });

        document.getElementById('close-detail-modal')?.addEventListener('click', () => {
            document.getElementById('post-detail-modal').classList.add('hidden');
        });

        // 发布帖子表单 - 添加认证检查
        document.getElementById('new-post-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!this.authManager.isLoggedIn()) {
                this.communityAuth.showCommunityLoginPrompt();
                return;
            }
            this.handleNewPost();
        });

        // 点击模态框外部关闭
        document.getElementById('new-post-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'new-post-modal') {
                e.target.classList.add('hidden');
            }
        });

        document.getElementById('post-detail-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'post-detail-modal') {
                e.target.classList.add('hidden');
            }
        });

        // 评论提交 - 添加认证检查
        document.addEventListener('click', (e) => {
            if (e.target.closest('#post-detail-modal button') && 
                e.target.closest('#post-detail-modal button').textContent.includes('发表评论')) {
                e.preventDefault();
                if (!this.authManager.isLoggedIn()) {
                    this.communityAuth.showCommunityLoginPrompt();
                    return;
                }
                this.handleCommentSubmit();
            }
        });
    }

    // 设置活跃分类
    setActiveCategory(category) {
        this.currentCategory = category;
        
        // 更新UI
        document.querySelectorAll('#category-tabs button').forEach(btn => {
            btn.classList.remove('active-tab', 'text-secondary');
            btn.classList.add('text-gray-300');
        });
        
        const activeBtn = document.querySelector(`#category-tabs button[data-category="${category}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active-tab', 'text-secondary');
            activeBtn.classList.remove('text-gray-300');
        }
        
        // 重新渲染帖子
        this.renderPosts();
    }

    // 渲染热门话题
    renderHotTopics() {
        const container = document.getElementById('hot-topics-container');
        if (!container) return;

        container.innerHTML = this.sampleData.hotTopics.map(topic => `
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
                <span class="text-sm">${topic.category}</span>
                <span class="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">${topic.count}</span>
            </div>
        `).join('');
    }

    // 渲染活跃用户
    renderActiveUsers() {
        const container = document.getElementById('active-users-container');
        if (!container) return;

        container.innerHTML = this.sampleData.activeUsers.map(user => `
            <div class="flex items-center gap-3">
                <img src="${user.avatar}" alt="${user.name}" class="w-10 h-10 rounded-full object-cover">
                <div class="flex-1">
                    <h4 class="font-medium text-white text-sm">${user.name}</h4>
                    <p class="text-xs text-gray-400">${user.post_count} 篇帖子</p>
                </div>
                <button class="text-xs bg-secondary/20 text-secondary px-2 py-1 rounded-full hover:bg-secondary/30 transition-colors">
                    关注
                </button>
            </div>
        `).join('');
    }

    // 渲染统计数据
    renderStats() {
        const container = document.getElementById('stats-container');
        if (!container) return;

        container.innerHTML = `
            <div class="text-center">
                <div class="text-2xl font-bold text-secondary">1,256</div>
                <div class="text-xs text-gray-400">今日活跃</div>
            </div>
            <div class="text-center">
                <div class="text-2xl font-bold text-primary">5,678</div>
                <div class="text-xs text-gray-400">总帖子数</div>
            </div>
            <div class="text-center">
                <div class="text-2xl font-bold text-accent">23,456</div>
                <div class="text-xs text-gray-400">总评论数</div>
            </div>
        `;
    }

    // 渲染帖子列表
    renderPosts() {
        const container = document.getElementById('posts-container');
        if (!container) return;

        // 过滤帖子
        let filteredPosts = this.sampleData.samplePosts;
        if (this.currentCategory !== '全部') {
            filteredPosts = filteredPosts.filter(post => post.category === this.currentCategory);
        }

        // 分页
        const startIndex = (this.currentPage - 1) * this.postsPerPage;
        const paginatedPosts = filteredPosts.slice(startIndex, startIndex + this.postsPerPage);

        if (paginatedPosts.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-inbox text-4xl text-gray-500 mb-4"></i>
                    <p class="text-gray-400">暂无帖子</p>
                    <button id="create-first-post" class="mt-4 px-4 py-2 bg-gradient-to-r from-primary to-secondary text-dark rounded-button hover:opacity-90 transition-all">
                        创建第一个帖子
                    </button>
                </div>
            `;

            // 绑定创建第一个帖子按钮事件
            document.getElementById('create-first-post')?.addEventListener('click', () => {
                if (!this.authManager.isLoggedIn()) {
                    this.communityAuth.showCommunityLoginPrompt();
                    return;
                }
                document.getElementById('new-post-modal').classList.remove('hidden');
            });
            return;
        }

        container.innerHTML = paginatedPosts.map(post => `
            <div class="community-post glass-effect rounded-xl p-6 card-hover" data-post-id="${post.id}">
                <div class="flex items-start gap-4">
                    <img src="${post.author_avatar}" alt="${post.author_name}" class="w-12 h-12 rounded-full object-cover">
                    <div class="flex-1">
                        <div class="flex items-start justify-between mb-2">
                            <div>
                                <h3 class="font-semibold text-white text-lg mb-1">${post.title}</h3>
                                <div class="flex items-center gap-3 text-sm text-gray-400">
                                    <span>${post.author_name}</span>
                                    <span>•</span>
                                    <span>${this.formatTime(post.created_at)}</span>
                                    <span class="px-2 py-1 bg-primary/20 text-primary rounded-full text-xs">${post.category}</span>
                                </div>
                            </div>
                            ${post.is_pinned ? '<i class="fas fa-thumbtack text-yellow-400"></i>' : ''}
                        </div>
                        <p class="text-gray-300 mb-4 line-clamp-2">${post.content.substring(0, 150)}...</p>
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-4 text-sm text-gray-400">
                                <button class="flex items-center gap-1 hover:text-secondary transition-colors like-btn" data-post-id="${post.id}">
                                    <i class="fas fa-heart"></i>
                                    <span>${post.like_count}</span>
                                </button>
                                <button class="flex items-center gap-1 hover:text-secondary transition-colors comment-btn" data-post-id="${post.id}">
                                    <i class="fas fa-comment"></i>
                                    <span>${post.comment_count}</span>
                                </button>
                                <button class="flex items-center gap-1 hover:text-secondary transition-colors">
                                    <i class="fas fa-eye"></i>
                                    <span>${post.view_count}</span>
                                </button>
                            </div>
                            <button class="text-primary hover:text-secondary transition-colors read-more-btn" data-post-id="${post.id}">
                                阅读全文 <i class="fas fa-arrow-right ml-1"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // 绑定帖子交互事件
        this.bindPostInteractions();
        
        // 渲染分页
        this.renderPagination(filteredPosts.length);
    }

    // 绑定帖子交互事件
    bindPostInteractions() {
        // 点赞按钮
        document.querySelectorAll('.like-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const postId = e.target.closest('.like-btn').dataset.postId;
                this.handleLikePost(parseInt(postId));
            });
        });

        // 评论按钮
        document.querySelectorAll('.comment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const postId = e.target.closest('.comment-btn').dataset.postId;
                this.showPostDetail(parseInt(postId));
            });
        });

        // 阅读全文按钮
        document.querySelectorAll('.read-more-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const postId = e.target.closest('.read-more-btn').dataset.postId;
                this.showPostDetail(parseInt(postId));
            });
        });

        // 帖子点击
        document.querySelectorAll('.community-post').forEach(post => {
            post.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    const postId = post.dataset.postId;
                    this.showPostDetail(parseInt(postId));
                }
            });
        });
    }

    // 渲染分页
    renderPagination(totalPosts) {
        const container = document.getElementById('pagination-container');
        if (!container) return;

        const totalPages = Math.ceil(totalPosts / this.postsPerPage);
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let paginationHTML = '';
        
        // 上一页按钮
        if (this.currentPage > 1) {
            paginationHTML += `
                <button class="px-3 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors prev-page">
                    <i class="fas fa-chevron-left"></i>
                </button>
            `;
        }

        // 页码按钮
        for (let i = 1; i <= totalPages; i++) {
            if (i === this.currentPage) {
                paginationHTML += `
                    <button class="px-3 py-2 bg-secondary text-dark rounded-lg font-semibold current-page">
                        ${i}
                    </button>
                `;
            } else {
                paginationHTML += `
                    <button class="px-3 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors page-btn" data-page="${i}">
                        ${i}
                    </button>
                `;
            }
        }

        // 下一页按钮
        if (this.currentPage < totalPages) {
            paginationHTML += `
                <button class="px-3 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors next-page">
                    <i class="fas fa-chevron-right"></i>
                </button>
            `;
        }

        container.innerHTML = paginationHTML;

        // 绑定分页事件
        this.bindPaginationEvents();
    }

    // 绑定分页事件
    bindPaginationEvents() {
        // 上一页
        document.querySelector('.prev-page')?.addEventListener('click', () => {
            this.currentPage--;
            this.renderPosts();
        });

        // 下一页
        document.querySelector('.next-page')?.addEventListener('click', () => {
            this.currentPage++;
            this.renderPosts();
        });

        // 页码按钮
        document.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentPage = parseInt(e.target.dataset.page);
                this.renderPosts();
            });
        });
    }

    // 处理新帖子 - 使用统一认证
    handleNewPost() {
        const title = document.getElementById('post-title').value;
        const category = document.getElementById('post-category').value;
        const content = document.getElementById('post-content').value;
        const tags = document.getElementById('post-tags').value;

        // 创建新帖子对象 - 使用当前用户信息
        const currentUser = this.authManager.getCurrentUser();
        const newPost = {
            id: this.sampleData.samplePosts.length + 1,
            user_id: currentUser?.id || 0,
            title: title,
            content: content,
            category: category,
            tags: tags,
            view_count: 0,
            like_count: 0,
            comment_count: 0,
            is_pinned: 0,
            created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
            author_name: currentUser?.name || '我',
            author_avatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=1580&auto=format&fit=crop'
        };

        // 添加到帖子列表开头
        this.sampleData.samplePosts.unshift(newPost);

        // 重置表单
        document.getElementById('new-post-form').reset();

        // 关闭模态框
        document.getElementById('new-post-modal').classList.add('hidden');

        // 重新渲染帖子
        this.renderPosts();

        // 显示成功消息
        this.showMessage('帖子发布成功！', 'success');
    }

    // 处理点赞帖子
    handleLikePost(postId) {
        if (!this.authManager.isLoggedIn()) {
            this.communityAuth.showCommunityLoginPrompt();
            return;
        }

        const post = this.sampleData.samplePosts.find(p => p.id === postId);
        if (post) {
            post.like_count++;
            this.renderPosts();
            this.showMessage('点赞成功！', 'success');
        }
    }

    // 显示帖子详情
    showPostDetail(postId) {
        const post = this.sampleData.samplePosts.find(p => p.id === postId);
        if (!post) return;

        this.currentPostDetail = post;

        // 获取帖子相关评论
        const postComments = this.sampleData.comments.filter(c => c.post_id === postId);

        const modalContent = document.getElementById('post-detail-content');
        modalContent.innerHTML = `
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-white mb-4">${post.title}</h2>
                <div class="flex items-center gap-4 text-sm text-gray-400 mb-4">
                    <div class="flex items-center gap-2">
                        <img src="${post.author_avatar}" alt="${post.author_name}" class="w-8 h-8 rounded-full">
                        <span>${post.author_name}</span>
                    </div>
                    <span>•</span>
                    <span>${this.formatTime(post.created_at)}</span>
                    <span>•</span>
                    <span class="px-2 py-1 bg-primary/20 text-primary rounded-full">${post.category}</span>
                </div>
                <div class="post-content text-gray-300 mb-6">
                    ${post.content.split('\n').map(paragraph => 
                        paragraph ? `<p class="mb-4">${paragraph}</p>` : '<br>'
                    ).join('')}
                </div>
                <div class="flex items-center gap-4 text-sm text-gray-400">
                    <button class="flex items-center gap-1 hover:text-secondary transition-colors">
                        <i class="fas fa-heart"></i>
                        <span>${post.like_count}</span>
                    </button>
                    <button class="flex items-center gap-1 hover:text-secondary transition-colors">
                        <i class="fas fa-comment"></i>
                        <span>${post.comment_count}</span>
                    </button>
                    <button class="flex items-center gap-1 hover:text-secondary transition-colors">
                        <i class="fas fa-eye"></i>
                        <span>${post.view_count}</span>
                    </button>
                    <button class="flex items-center gap-1 hover:text-secondary transition-colors">
                        <i class="fas fa-share"></i>
                        <span>分享</span>
                    </button>
                </div>
            </div>

            <div class="border-t border-gray-700 pt-6">
                <h3 class="text-lg font-semibold text-white mb-4">评论 (${postComments.length})</h3>
                
                <div class="mb-6">
                    <textarea placeholder="写下你的评论..." class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-secondary" rows="3"></textarea>
                    <div class="flex justify-end mt-2">
                        <button class="px-4 py-2 bg-gradient-to-r from-primary to-secondary text-dark rounded-button hover:opacity-90 transition-all">
                            发表评论
                        </button>
                    </div>
                </div>

                <div class="space-y-4">
                    ${postComments.map(comment => `
                        <div class="comment-item">
                            <div class="flex items-start gap-3">
                                <img src="${comment.author_avatar}" alt="${comment.author_name}" class="w-8 h-8 rounded-full">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="font-medium text-white">${comment.author_name}</span>
                                        <span class="text-xs text-gray-400">${this.formatTime(comment.created_at)}</span>
                                    </div>
                                    <p class="text-gray-300">${comment.content}</p>
                                    <div class="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                        <button class="hover:text-secondary transition-colors">回复</button>
                                        <button class="hover:text-secondary transition-colors">点赞</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        document.getElementById('post-detail-modal').classList.remove('hidden');
    }

    // 处理评论提交
    handleCommentSubmit() {
        const commentInput = document.querySelector('#post-detail-modal textarea');
        if (!commentInput || !commentInput.value.trim()) return;

        const currentUser = this.authManager.getCurrentUser();
        const newComment = {
            id: this.sampleData.comments.length + 1,
            post_id: this.currentPostDetail?.id,
            user_id: currentUser?.id || 0,
            content: commentInput.value.trim(),
            created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
            author_name: currentUser?.name || '我',
            author_avatar: currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=1580&auto=format&fit=crop'
        };

        // 添加到评论列表
        this.sampleData.comments.push(newComment);

        // 更新帖子评论数
        if (this.currentPostDetail) {
            this.currentPostDetail.comment_count++;
        }

        // 清空输入框
        commentInput.value = '';

        // 重新显示帖子详情
        this.showPostDetail(this.currentPostDetail.id);

        this.showMessage('评论发表成功！', 'success');
    }

    // 格式化时间
    formatTime(timeString) {
        const time = new Date(timeString);
        const now = new Date();
        const diff = now - time;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        
        return time.toLocaleDateString('zh-CN');
    }

    // 初始化图表
    initChart() {
        const ctx = document.getElementById('communityChart');
        if (!ctx) return;

        this.communityChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
                datasets: [
                    {
                        label: '发帖量',
                        data: [45, 52, 68, 74, 82, 95],
                        borderColor: '#6366F1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: '评论量',
                        data: [120, 145, 168, 192, 210, 235],
                        borderColor: '#38BDF8',
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#F8FAFC'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#F8FAFC'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#F8FAFC'
                        }
                    }
                }
            }
        });
    }

    // 显示消息 - 使用统一UI管理器
    showMessage(message, type = 'info') {
        if (window.uiManager && window.uiManager.showMessage) {
            window.uiManager.showMessage(message, type);
        } else {
            // 备用方案
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
    }
}

// 页面加载完成后初始化 - 修改认证检查
document.addEventListener('DOMContentLoaded', function() {
    // 初始化社区管理器
    window.communityManager = new CommunityManager();
});