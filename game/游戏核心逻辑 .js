// game/游戏核心逻辑 .js
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentScreen = 'menu';
        
        // 游戏状态
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.lives = 3;
        this.level = 1;
        this.timer = 60;
        this.gameTime = 0;
        this.isPaused = false;
        this.gameOver = false;
        
        // 游戏对象
        this.player = new Player(this.canvas.width / 2, this.canvas.height - 50);
        this.enemies = [];
        this.bullets = [];
        this.particles = [];
        
        // 游戏设置
        this.difficulty = 'medium';
        this.enemySpawnRate = 0.02; // 敌人生成概率
        this.gameLoopId = null;
        this.lastTime = 0;
        
        // 当前激活的敌人（需要回答问题的敌人）
        this.activeEnemy = null;
        
        this.initializeEventListeners();
        this.loadAchievements();
    }

    initializeEventListeners() {
        // 菜单按钮
        document.getElementById('startButton').addEventListener('click', () => this.startGame());
        document.getElementById('restartButton').addEventListener('click', () => this.restartGame());
        document.getElementById('menuButton').addEventListener('click', () => this.showScreen('menu'));
        document.getElementById('viewAchievements').addEventListener('click', () => this.showAchievements());
        document.getElementById('backToMenu').addEventListener('click', () => this.showScreen('menu'));
        
        // 难度选择 - 修复事件监听
        const difficultySelect = document.getElementById('difficultySelect');
        if (difficultySelect) {
            difficultySelect.addEventListener('change', (e) => {
                this.difficulty = e.target.value;
                console.log('难度设置为:', this.difficulty); // 调试用
            });
            
            // 设置初始难度
            this.difficulty = difficultySelect.value;
        } else {
            console.warn('未找到难度选择元素，使用默认难度');
            this.difficulty = 'medium';
        }

        // 键盘控制
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // 鼠标移动控制炮台
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        
        // 触摸屏支持
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });
    }

    async startGame() {
        console.log('开始游戏，难度:', this.difficulty);
        
        // 检查词汇库是否为空
        try {
            const response = await fetch('/api/game/vocabulary/vocabulary-status');
            const result = await response.json();
            
            if (result.success && result.data.isEmpty) {
                alert('词汇库为空！请先导入词汇数据再开始游戏。');
                this.showScreen('vocabulary');
                return;
            }
        } catch (error) {
            console.error('检查词汇库失败:', error);
            alert('检查词汇库失败，请确保服务器正常运行');
            return;
        }
        
        // 验证难度设置
        const validDifficulties = ['easy', 'medium', 'hard'];
        if (!validDifficulties.includes(this.difficulty)) {
            console.warn('无效难度，重置为中等难度');
            this.difficulty = 'medium';
        }
        
        // 重置游戏前先清除所有状态
        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        this.resetGame();
        this.showScreen('game');
        this.lastTime = performance.now();
        this.gameLoopId = requestAnimationFrame((time) => this.gameLoop(time));
        
        // 开始计时器
        this.timerInterval = setInterval(() => {
            if (!this.isPaused && !this.gameOver) {
                this.timer--;
                this.updateUI();
                
                if (this.timer <= 0) {
                    this.levelUp();
                }
            }
        }, 1000);
    }

    gameLoop(currentTime) {
        if (this.gameOver) return;
        
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        this.gameTime += deltaTime;

        if (!this.isPaused) {
            this.update(deltaTime);
            this.render();
        }
        
        this.gameLoopId = requestAnimationFrame((time) => this.gameLoop(time));
    }

    update(deltaTime) {
        // 生成敌人
        this.spawnEnemies();
        
        // 更新敌人
        this.updateEnemies(deltaTime);
        
        // 更新子弹
        this.updateBullets(deltaTime);
        
        // 更新粒子效果
        this.updateParticles(deltaTime);
        
        // 检测碰撞
        this.checkCollisions();
        
        // 检查游戏结束条件
        this.checkGameOver();
    }

    spawnEnemies() {
        const baseRates = {
            easy: 0.015,
            medium: 0.02,
            hard: 0.025
        };
        
        const baseRate = baseRates[this.difficulty] || 0.02;
        const levelMultiplier = 1 + (this.level - 1) * 0.15; // 降低等级增长系数
        const currentRate = baseRate * levelMultiplier;
        
        // 限制最大敌人数量和生成概率
        const maxEnemies = {
            easy: 8,
            medium: 10,
            hard: 12
        };
        
        const currentMaxEnemies = maxEnemies[this.difficulty] || 10;
        
        if (Math.random() < currentRate && this.enemies.length < currentMaxEnemies) {
            try {
                const question = QuestionManager.generateQuestion(this.difficulty);
                if (question && question.options && question.options.length >= 2) {
                    const enemy = new Enemy(question);
                    this.enemies.push(enemy);
                } else {
                    console.warn('生成的题目无效，跳过敌人创建');
                }
            } catch (error) {
                console.error('生成敌人时出错:', error);
            }
        }
    }

    updateEnemies(deltaTime) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(deltaTime);
            
            // 检查敌人是否到达底部
            if (enemy.y > this.canvas.height) {
                this.lives--;
                this.enemies.splice(i, 1);
                this.updateUI();
                this.createParticleEffect(enemy.x, enemy.y, '#ff0000');
            }
        }
    }

    updateBullets(deltaTime) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.update(deltaTime);
            
            // 移除超出屏幕的子弹
            if (bullet.y < 0 || bullet.x < 0 || bullet.x > this.canvas.width) {
                this.bullets.splice(i, 1);
            }
        }
    }

    updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.update(deltaTime);
            
            if (particle.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    checkCollisions() {
        // 子弹与敌人碰撞检测
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                const enemy = this.enemies[j];
                
                if (this.isColliding(bullet, enemy)) {
                    // 击中敌人，显示问题
                    this.showQuestion(enemy);
                    this.bullets.splice(i, 1);
                    break;
                }
            }
        }
    }

    isColliding(obj1, obj2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (obj1.radius + obj2.radius);
    }

    showQuestion(enemy) {
        if (!enemy || !enemy.question) {
            console.error('无效的敌人或题目');
            this.isPaused = false;
            return;
        }
        
        try {
            this.activeEnemy = enemy;
            this.isPaused = true;
            
            const questionText = document.getElementById('questionText');
            const answerButtons = document.getElementById('answerButtons');
            const answerContainer = document.getElementById('answerContainer');
            
            if (!questionText || !answerButtons || !answerContainer) {
                console.error('未找到答题界面元素');
                this.isPaused = false;
                return;
            }
            
            questionText.textContent = enemy.question.text || '请选择正确答案：';
            answerButtons.innerHTML = '';
            
            // 创建答案按钮
            if (enemy.question.options && Array.isArray(enemy.question.options)) {
                enemy.question.options.forEach((option, index) => {
                    const button = document.createElement('button');
                    button.textContent = option || `选项 ${index + 1}`;
                    button.className = 'answer-btn';
                    button.addEventListener('click', () => this.handleAnswer(option));
                    answerButtons.appendChild(button);
                });
            } else {
                console.error('题目选项无效');
                this.isPaused = false;
                return;
            }
            
            answerContainer.classList.remove('hidden');
        } catch (error) {
            console.error('显示题目时出错:', error);
            this.isPaused = false;
        }
    }

    handleAnswer(selectedAnswer) {
        const answerContainer = document.getElementById('answerContainer');
        answerContainer.classList.add('hidden');
        this.isPaused = false;
        
        if (this.activeEnemy && this.activeEnemy.question.correctAnswer === selectedAnswer) {
            // 回答正确
            this.combo++;
            this.maxCombo = Math.max(this.maxCombo, this.combo);
            const points = 10 * this.combo; // 连击加分
            this.score += points;
            
            // 移除敌人并创建特效
            const enemyIndex = this.enemies.indexOf(this.activeEnemy);
            if (enemyIndex > -1) {
                this.createParticleEffect(this.activeEnemy.x, this.activeEnemy.y, '#00ff00');
                this.enemies.splice(enemyIndex, 1);
            }
            
            // 显示得分飘字
            this.createScorePopup(this.activeEnemy.x, this.activeEnemy.y, `+${points}`);
            
        } else {
            // 回答错误
            this.combo = 0;
            this.createParticleEffect(this.activeEnemy.x, this.activeEnemy.y, '#ff6b6b');
        }
        
        this.activeEnemy = null;
        this.updateUI();
        this.checkAchievements();
    }

    createParticleEffect(x, y, color) {
        for (let i = 0; i < 15; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    createScorePopup(x, y, text) {
        const particle = new Particle(x, y, '#ffff00');
        particle.vx = (Math.random() - 0.5) * 2;
        particle.vy = -2;
        particle.text = text;
        particle.life = 1.0;
        this.particles.push(particle);
    }

    handleKeyDown(e) {
        if (this.currentScreen !== 'game') return;
        
        if (e.code === 'Space' && !this.isPaused) {
            this.shoot();
        } else if (e.code === 'Escape') {
            this.isPaused = !this.isPaused;
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        this.player.x = Math.max(20, Math.min(this.canvas.width - 20, mouseX));
    }

    shoot() {
        const bullet = {
            x: this.player.x,
            y: this.player.y - 20,
            radius: 4,
            speed: 8,
            color: '#ffff00',
            update: function(deltaTime) {
                this.y -= this.speed;
            },
            draw: function(ctx) {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
                
                // 子弹拖尾效果
                ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
                ctx.beginPath();
                ctx.arc(this.x, this.y + 5, this.radius * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        };
        
        this.bullets.push(bullet);
    }

    render() {
        // 清空画布
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制背景网格
        this.drawGrid();
        
        // 绘制所有游戏对象
        this.particles.forEach(particle => particle.draw(this.ctx));
        this.enemies.forEach(enemy => enemy.draw(this.ctx));
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
        this.player.draw(this.ctx);
        
        // 绘制连击特效
        if (this.combo >= 3) {
            this.drawComboEffect();
        }
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        
        // 垂直线
        for (let x = 0; x <= this.canvas.width; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // 水平线
        for (let y = 0; y <= this.canvas.height; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawComboEffect() {
        const intensity = Math.min(this.combo / 10, 1);
        this.ctx.strokeStyle = `rgba(255, 215, 0, ${intensity * 0.5})`;
        this.ctx.lineWidth = 3 + intensity * 2;
        this.ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
    }

    levelUp() {
        this.level++;
        this.timer = 60;
        this.enemySpawnRate *= 1.2; // 增加敌人生成率
        
        // 等级提升特效
        this.createParticleEffect(this.canvas.width / 2, this.canvas.height / 2, '#ff00ff');
        this.createScorePopup(this.canvas.width / 2, this.canvas.height / 2, `Level ${this.level}!`);
    }

    checkGameOver() {
        if (this.lives <= 0) {
            this.endGame();
        }
    }

    endGame() {
        this.gameOver = true;
        cancelAnimationFrame(this.gameLoopId);
        clearInterval(this.timerInterval);
        
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('maxCombo').textContent = this.maxCombo;
        this.showScreen('gameOver');
        
        this.saveAchievements();
    }

    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('combo').textContent = this.combo;
        document.getElementById('lives').textContent = this.lives;
        document.getElementById('level').textContent = this.level;
        document.getElementById('timer').textContent = this.timer;
    }

    showScreen(screenName) {
        this.currentScreen = screenName;
        
        // 隐藏所有屏幕
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // 显示目标屏幕
        document.getElementById(screenName + 'Screen').classList.remove('hidden');
    }

    resetGame() {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.lives = 3;
        this.level = 1;
        this.timer = 60;
        this.gameTime = 0;
        this.isPaused = false;
        this.gameOver = false;
        
        this.enemies = [];
        this.bullets = [];
        this.particles = [];
        this.activeEnemy = null;
        
        this.enemySpawnRate = 0.02;
        this.updateUI();
    }

    restartGame() {
        this.resetGame();
        this.startGame();
    }

    // 成就系统
    loadAchievements() {
        this.achievements = JSON.parse(localStorage.getItem('wordBusterAchievements') || '{}');
    }

    saveAchievements() {
        localStorage.setItem('wordBusterAchievements', JSON.stringify(this.achievements));
    }

    checkAchievements() {
        const newAchievements = [];
        
        if (this.score >= 1000 && !this.achievements.score1000) {
            this.achievements.score1000 = true;
            newAchievements.push('得分达人：获得1000分');
        }
        
        if (this.maxCombo >= 10 && !this.achievements.combo10) {
            this.achievements.combo10 = true;
            newAchievements.push('连击大师：达成10连击');
        }
        
        if (this.level >= 5 && !this.achievements.level5) {
            this.achievements.level5 = true;
            newAchievements.push('进阶高手：达到第5关');
        }
        
        if (newAchievements.length > 0) {
            this.showAchievementPopup(newAchievements);
            this.saveAchievements();
        }
    }

    showAchievementPopup(achievements) {
        achievements.forEach(achievement => {
            console.log('成就解锁：', achievement);
            // 这里可以添加成就弹窗效果
        });
    }

    showAchievements() {
        this.showScreen('achievements');
        const list = document.getElementById('achievementsList');
        list.innerHTML = '';
        
        const allAchievements = [
            { id: 'score1000', name: '得分达人', desc: '获得1000分' },
            { id: 'combo10', name: '连击大师', desc: '达成10连击' },
            { id: 'level5', name: '进阶高手', desc: '达到第5关' }
        ];
        
        allAchievements.forEach(ach => {
            const div = document.createElement('div');
            div.className = `achievement-item ${this.achievements[ach.id] ? 'unlocked' : 'locked'}`;
            div.innerHTML = `
                <h3>${ach.name}</h3>
                <p>${ach.desc}</p>
                <span>${this.achievements[ach.id] ? '✓ 已解锁' : '🔒 未解锁'}</span>
            `;
            list.appendChild(div);
        });
    }
}

// 粒子效果类
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.radius = Math.random() * 3 + 1;
        this.color = color;
        this.alpha = 1;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.02;
        this.text = null;
    }

    update(deltaTime) {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // 重力
        this.life -= this.decay;
        this.alpha = this.life;
    }

    draw(ctx) {
        if (this.text) {
            // 绘制文字粒子
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = this.color;
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.text, this.x, this.y);
            ctx.restore();
        } else {
            // 绘制圆形粒子
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});