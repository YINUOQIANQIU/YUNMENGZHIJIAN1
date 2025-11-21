// game/玩家.js
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 60;
        this.color = '#4ECDC4';
        this.gunColor = '#FF6B6B';
        this.rotation = 0;
        this.targetRotation = 0;
        this.health = 100;
        this.isShooting = false;
        this.shootCooldown = 0;
        this.maxCooldown = 0.2; // 射击冷却时间（秒）
    }

    update(deltaTime) {
        // 更新射击冷却
        if (this.shootCooldown > 0) {
            this.shootCooldown -= deltaTime;
        }

        // 平滑旋转炮台
        this.rotation += (this.targetRotation - this.rotation) * 0.1;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // 绘制炮台底座
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        
        // 绘制炮台细节
        ctx.fillStyle = '#45B7AF';
        ctx.fillRect(-this.width / 2 + 5, -this.height / 2 + 5, this.width - 10, 10);
        
        // 绘制炮管
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.gunColor;
        ctx.fillRect(-5, -25, 10, 30);
        
        // 绘制炮口闪光（射击时）
        if (this.isShooting) {
            ctx.fillStyle = '#FFFF00';
            ctx.fillRect(-3, -35, 6, 10);
            this.isShooting = false;
        }
        
        ctx.restore();
        
        // 绘制玩家生命条
        this.drawHealthBar(ctx);
    }

    drawHealthBar(ctx) {
        const barWidth = 60;
        const barHeight = 6;
        const barX = this.x - barWidth / 2;
        const barY = this.y + this.height / 2 + 10;
        
        // 背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // 生命值
        const healthWidth = (this.health / 100) * barWidth;
        ctx.fillStyle = this.getHealthColor();
        ctx.fillRect(barX, barY, healthWidth, barHeight);
        
        // 边框
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    getHealthColor() {
        if (this.health > 70) return '#4ECDC4';
        if (this.health > 30) return '#FFE66D';
        return '#FF6B6B';
    }

    setTargetRotation(angle) {
        this.targetRotation = angle;
    }

    shoot() {
        if (this.shootCooldown <= 0) {
            this.isShooting = true;
            this.shootCooldown = this.maxCooldown;
            return true;
        }
        return false;
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        return this.health <= 0;
    }

    heal(amount) {
        this.health = Math.min(100, this.health + amount);
    }
}