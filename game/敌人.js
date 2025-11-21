// game/敌人.js
class Enemy {
    constructor(question) {
        this.question = question;
        this.type = question.type;
        this.radius = 25;
        this.x = Math.random() * (800 - this.radius * 2) + this.radius;
        this.y = -this.radius;
        this.speed = this.getBaseSpeed();
        this.color = this.getColorByType();
        this.hitPoints = 1;
        this.maxHitPoints = 1;
        this.isActive = true;
        this.waveOffset = Math.random() * Math.PI * 2;
        this.waveSpeed = Math.random() * 2 + 1;
        this.waveAmplitude = Math.random() * 20 + 10;
        this.startX = this.x;
        
        // 特殊效果
        this.effectTimer = 0;
        this.isFlashing = false;
    }

    getBaseSpeed() {
        const baseSpeeds = {
            'spelling': 1.5,
            'fillBlank': 2.0,
            'synonym': 1.8,
            'grammar': 1.2
        };
        return baseSpeeds[this.type] || 2.0;
    }

    getColorByType() {
        const colors = {
            'spelling': '#FF6B6B',    // 红色 - 拼写错误
            'fillBlank': '#4ECDC4',   // 青色 - 填空
            'synonym': '#FFE66D',     // 黄色 - 同义词
            'grammar': '#6A0572'      // 紫色 - 语法
        };
        return colors[this.type] || '#95E1D3';
    }

    update(deltaTime) {
        // 基础移动
        this.y += this.speed;
        
        // 波浪移动
        this.x = this.startX + Math.sin(this.waveOffset + this.y * 0.01 * this.waveSpeed) * this.waveAmplitude;
        
        // 更新特效计时器
        if (this.effectTimer > 0) {
            this.effectTimer -= deltaTime;
            this.isFlashing = this.effectTimer > 0 && Math.floor(this.effectTimer * 10) % 2 === 0;
        }
        
        // 屏幕边界检查
        if (this.x < this.radius) this.x = this.radius;
        if (this.x > 800 - this.radius) this.x = 800 - this.radius;
    }

    draw(ctx) {
        ctx.save();
        
        // 绘制敌人主体
        if (this.isFlashing) {
            ctx.fillStyle = '#FFFFFF';
        } else {
            ctx.fillStyle = this.color;
        }
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制敌人边框
        ctx.strokeStyle = '#2C2C54';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 绘制生命条（如果有多条命）
        if (this.hitPoints > 1) {
            this.drawHealthBar(ctx);
        }
        
        // 绘制类型图标
        this.drawTypeIcon(ctx);
        
        // 绘制问题文本
        this.drawQuestionText(ctx);
        
        ctx.restore();
    }

    drawHealthBar(ctx) {
        const barWidth = 30;
        const barHeight = 4;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.radius - 10;
        
        // 背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // 生命值
        const healthWidth = (this.hitPoints / this.maxHitPoints) * barWidth;
        ctx.fillStyle = this.getHealthColor();
        ctx.fillRect(barX, barY, healthWidth, barHeight);
    }

    getHealthColor() {
        const ratio = this.hitPoints / this.maxHitPoints;
        if (ratio > 0.7) return '#4ECDC4';
        if (ratio > 0.3) return '#FFE66D';
        return '#FF6B6B';
    }

    drawTypeIcon(ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const icons = {
            'spelling': '✏️',
            'fillBlank': '📝',
            'synonym': '🔄',
            'grammar': '⚡'
        };
        
        ctx.fillText(icons[this.type] || '❓', this.x, this.y);
    }

    drawQuestionText(ctx) {
        ctx.fillStyle = '#2C2C54';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        // 简化的题目显示
        const displayText = this.getDisplayText();
        const lines = this.wrapText(ctx, displayText, this.radius * 1.8);
        
        lines.forEach((line, index) => {
            ctx.fillText(line, this.x, this.y + this.radius + 5 + index * 14);
        });
    }

    getDisplayText() {
        switch (this.type) {
            case 'spelling':
                return `拼写: ${this.question.displayText || this.question.wrongSpelling}`;
            case 'fillBlank':
                return `填空: ${this.question.sentence}`;
            case 'synonym':
                return `同义词: ${this.question.word}`;
            case 'grammar':
                return `语法: ${this.question.sentence.substring(0, 20)}...`;
            default:
                return this.question.text.substring(0, 25);
        }
    }

    wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }

    takeDamage(amount = 1) {
        this.hitPoints -= amount;
        this.effectTimer = 0.3; // 受伤闪烁效果
        return this.hitPoints <= 0;
    }

    setSpeedMultiplier(multiplier) {
        this.speed *= multiplier;
    }

    // 特殊敌人行为
    activateSpecialBehavior() {
        switch (this.type) {
            case 'spelling':
                // 拼写敌人会分裂
                this.speed *= 0.7;
                break;
            case 'grammar':
                // 语法敌人更耐打
                this.hitPoints = 3;
                this.maxHitPoints = 3;
                break;
        }
    }
}