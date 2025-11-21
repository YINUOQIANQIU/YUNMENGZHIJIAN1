/**
 * 单词爆破手游戏 - 前端客户端  文件：game/game.js
 */

class WordBusterClient {
    constructor() {
        this.socket = null;
        this.gameState = {
            connected: false,
            playerId: null,
            sessionId: null,
            currentScreen: 'menu',
            score: 0,
            lives: 3,
            level: 1,
            vocabularyLoaded: false // 新增：词汇库加载状态
        };
        
        this.initialize();
    }

    /**
     * 初始化游戏客户端
     */
    async initialize() {
        await this.setupEventListeners();
        await this.connectToServer();
        this.setupGameLoop();
    }

    /**
     * 连接到游戏服务器
     */
    async connectToServer() {
        try {
            // 获取服务器地址（在实际部署中这应该是配置的）
            const serverUrl = window.location.origin;
            this.socket = io(serverUrl);

            this.socket.on('connect', () => {
                console.log('✅ 连接到游戏服务器');
                this.gameState.connected = true;
                this.updateConnectionStatus();
            });

            this.socket.on('disconnect', () => {
                console.log('❌ 与服务器断开连接');
                this.gameState.connected = false;
                this.updateConnectionStatus();
            });

            // 设置消息处理器
            this.setupMessageHandlers();

        } catch (error) {
            console.error('连接服务器失败:', error);
            this.showError('无法连接到游戏服务器，请刷新页面重试');
        }
    }

    /**
     * 设置消息处理器
     */
    setupMessageHandlers() {
        this.socket.on('player_joined', (data) => {
            this.handlePlayerJoined(data);
        });

        this.socket.on('game_started', (data) => {
            this.handleGameStarted(data);
        });

        this.socket.on('new_question', (data) => {
            this.handleNewQuestion(data);
        });

        this.socket.on('answer_result', (data) => {
            this.handleAnswerResult(data);
        });

        this.socket.on('player_scored', (data) => {
            this.handlePlayerScored(data);
        });

        this.socket.on('level_up', (data) => {
            this.handleLevelUp(data);
        });

        this.socket.on('game_over', (data) => {
            this.handleGameOver(data);
        });

        this.socket.on('error', (data) => {
            this.showError(data.message);
        });
    }

    /**
     * 加入游戏
     */
    async joinGame(playerName, difficulty = 'medium') {
        // 先检查词汇库是否为空
        try {
            const isEmpty = await this.checkVocabularyEmpty();
            if (isEmpty) {
                this.showError('词汇库为空！请先导入词汇数据再开始游戏。');
                this.switchScreen('vocabulary');
                return;
            }
        } catch (error) {
            console.error('检查词汇库失败:', error);
            this.showError('检查词汇库失败，请确保服务器正常运行');
            return;
        }

        const playerId = this.generatePlayerId();
        this.gameState.playerId = playerId;

        // 创建游戏会话
        fetch('/api/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playerId,
                difficulty
            })
        })
        .then(response => response.json())
        .then(data => {
            this.gameState.sessionId = data.sessionId;
            
            // 通过WebSocket加入会话
            this.socket.emit('player_join', {
                playerId,
                playerName,
                sessionId: data.sessionId
            });

            this.switchScreen('lobby');
        })
        .catch(error => {
            console.error('创建游戏会话失败:', error);
            this.showError('创建游戏失败，请重试');
        });
    }

    /**
     * 开始游戏
     */
    startGame() {
        if (!this.gameState.sessionId) {
            this.showError('没有活动的游戏会话');
            return;
        }

        this.socket.emit('game_start', {
            sessionId: this.gameState.sessionId
        });
    }

    /**
     * 检查词汇库是否为空
     */
    async checkVocabularyEmpty() {
        try {
            const response = await fetch('/api/vocabulary/vocabulary-statistics');
            const result = await response.json();
            
            if (result.success) {
                const totalWords = result.data.total_words?.[0]?.count || 0;
                return totalWords === 0;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('检查词汇库失败:', error);
            throw error;
        }
    }

    /**
     * 提交答案
     */
    submitAnswer(answer, responseTime) {
        this.socket.emit('answer_submit', {
            sessionId: this.gameState.sessionId,
            playerId: this.gameState.playerId,
            answer,
            responseTime
        });
    }

    /**
     * 处理新题目
     */
    handleNewQuestion(data) {
        if (!data.question) {
            this.showError('无法生成题目，词汇库可能为空');
            return;
        }
        this.displayQuestion(data.question);
        this.startQuestionTimer();
    }

    /**
     * 显示题目
     */
    displayQuestion(question) {
        const questionElement = document.getElementById('question-container');
        if (!questionElement) return;

        questionElement.innerHTML = `
            <div class="question">
                <h3>${question.question}</h3>
                <div class="options">
                    ${question.options.map((option, index) => `
                        <button class="option-btn" onclick="gameClient.submitAnswer('${option}', ${Date.now() - this.questionStartTime})">
                            ${option}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        this.questionStartTime = Date.now();
    }

    /**
     * 开始题目计时器
     */
    startQuestionTimer() {
        // 实现题目计时逻辑
    }

    /**
     * 处理答案结果
     */
    handleAnswerResult(data) {
        if (data.correct) {
            this.showFeedback('correct', `+${data.score} 分!`);
            this.gameState.score = data.totalScore;
            this.updateScoreDisplay();
        } else {
            this.showFeedback('incorrect', '答案错误!');
            this.gameState.lives = data.lives;
            this.updateLivesDisplay();
        }
    }

    /**
     * 工具方法
     */
    generatePlayerId() {
        return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    switchScreen(screenName) {
        this.gameState.currentScreen = screenName;
        // 更新UI显示对应的屏幕
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(`${screenName}-screen`).classList.add('active');
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = this.gameState.connected ? '已连接' : '断开连接';
            statusElement.className = this.gameState.connected ? 'connected' : 'disconnected';
        }
    }

    updateScoreDisplay() {
        const scoreElement = document.getElementById('score');
        if (scoreElement) {
            scoreElement.textContent = this.gameState.score;
        }
    }

    updateLivesDisplay() {
        const livesElement = document.getElementById('lives');
        if (livesElement) {
            livesElement.textContent = '❤️'.repeat(this.gameState.lives);
        }
    }

    showFeedback(type, message) {
        // 显示反馈消息
        const feedbackElement = document.getElementById('feedback');
        if (feedbackElement) {
            feedbackElement.textContent = message;
            feedbackElement.className = `feedback ${type}`;
            feedbackElement.style.display = 'block';
            
            setTimeout(() => {
                feedbackElement.style.display = 'none';
            }, 2000);
        }
    }

    showError(message) {
        alert(`错误: ${message}`);
    }

    setupEventListeners() {
        // 设置UI事件监听器
        const startButton = document.getElementById('start-game-btn');
        if (startButton) {
            startButton.addEventListener('click', () => {
                const playerName = document.getElementById('player-name').value || '玩家';
                const difficulty = document.getElementById('difficulty-select').value;
                this.joinGame(playerName, difficulty);
            });
        }

        // 更多事件监听器...
    }

    setupGameLoop() {
        // 游戏主循环
        const gameLoop = () => {
            this.updateGameState();
            requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }

    updateGameState() {
        // 更新游戏状态
        if (this.gameState.currentScreen === 'game') {
            // 游戏逻辑更新
        }
    }

    // 处理其他游戏事件
    handlePlayerJoined(data) {
        console.log('玩家加入:', data);
    }

    handleGameStarted(data) {
        console.log('游戏开始:', data);
        this.switchScreen('game');
    }

    handlePlayerScored(data) {
        console.log('玩家得分:', data);
    }

    handleLevelUp(data) {
        console.log('等级提升:', data);
    }

    handleGameOver(data) {
        console.log('游戏结束:', data);
        this.switchScreen('gameOver');
    }
}

// 初始化游戏客户端
const gameClient = new WordBusterClient();
window.gameClient = gameClient;