// [file name]: listening-core.js
class ListeningCore {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.audioElement = null;
        this.isPlaying = false;
        this.currentPlaybackRate = 1.0;
        this.waveformData = null;
        this.audioBuffer = null;
        
        this.initAudioContext();
    }
    
    // 初始化音频上下文
    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
        } catch (error) {
            console.warn('Web Audio API不支持，使用基础音频播放');
        }
    }
    
    // 加载音频文件
    async loadAudio(url) {
        return new Promise((resolve, reject) => {
            this.audioElement = new Audio();
            this.audioElement.src = url;
            this.audioElement.preload = 'metadata';
            
            if (this.audioContext) {
                this.source = this.audioContext.createMediaElementSource(this.audioElement);
                this.source.connect(this.analyser);
                this.analyser.connect(this.audioContext.destination);
            }
            
            this.audioElement.addEventListener('loadedmetadata', () => {
                resolve(this.audioElement);
            });
            
            this.audioElement.addEventListener('error', (e) => {
                reject(new Error(`音频加载失败: ${e.message}`));
            });
        });
    }
    
    // 播放音频片段
    async playSegment(startTime, endTime, onProgress, onEnd) {
        if (!this.audioElement) {
            throw new Error('音频未加载');
        }
        
        this.audioElement.currentTime = startTime;
        this.audioElement.playbackRate = this.currentPlaybackRate;
        
        const playPromise = this.audioElement.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.isPlaying = true;
                
                // 设置进度更新
                const progressInterval = setInterval(() => {
                    if (onProgress) {
                        onProgress(this.audioElement.currentTime, endTime);
                    }
                    
                    // 检查是否到达结束时间
                    if (this.audioElement.currentTime >= endTime) {
                        this.pause();
                        clearInterval(progressInterval);
                        if (onEnd) onEnd();
                    }
                }, 100);
                
                // 监听暂停事件
                this.audioElement.addEventListener('pause', () => {
                    clearInterval(progressInterval);
                    this.isPlaying = false;
                });
                
            }).catch(error => {
                console.error('播放失败:', error);
            });
        }
    }
    
    // 暂停播放
    pause() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.isPlaying = false;
        }
    }
    
    // 设置播放速度
    setPlaybackRate(rate) {
        this.currentPlaybackRate = rate;
        if (this.audioElement) {
            this.audioElement.playbackRate = rate;
        }
    }
    
    // 获取波形数据（用于可视化）
    getWaveformData() {
        if (!this.analyser) return null;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        
        return dataArray;
    }
    
    // 跳转到指定时间
    seekTo(time) {
        if (this.audioElement) {
            this.audioElement.currentTime = time;
        }
    }
    
    // 获取当前时间
    getCurrentTime() {
        return this.audioElement ? this.audioElement.currentTime : 0;
    }
    
    // 获取总时长
    getDuration() {
        return this.audioElement ? this.audioElement.duration : 0;
    }
    
    // 清理资源
    cleanup() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

// 导出到全局
window.ListeningCore = ListeningCore;