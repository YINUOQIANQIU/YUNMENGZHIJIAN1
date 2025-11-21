// 文件上传管理器
class FileUploadManager {
    constructor() {
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // 标签切换
        document.getElementById('text-input-tab').addEventListener('click', () => this.switchToTextInput());
        document.getElementById('file-input-tab').addEventListener('click', () => this.switchToFileInput());
        
        // 文件操作
        document.getElementById('browse-files').addEventListener('click', () => this.triggerFileSelect());
        document.getElementById('file-upload').addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('remove-file').addEventListener('click', () => this.removeSelectedFile());
        
        // 文本操作
        document.getElementById('clear-text').addEventListener('click', () => this.clearText());
        document.getElementById('paste-text').addEventListener('click', () => this.pasteText());
        document.getElementById('essay-text').addEventListener('input', () => this.updateWordCount());
    }

    switchToTextInput() {
        document.getElementById('text-input-tab').classList.add('bg-white', 'text-primary', 'shadow-sm');
        document.getElementById('file-input-tab').classList.remove('bg-white', 'text-primary', 'shadow-sm');
        document.getElementById('text-input-area').classList.remove('hidden');
        document.getElementById('file-input-area').classList.add('hidden');
    }

    switchToFileInput() {
        document.getElementById('file-input-tab').classList.add('bg-white', 'text-primary', 'shadow-sm');
        document.getElementById('text-input-tab').classList.remove('bg-white', 'text-primary', 'shadow-sm');
        document.getElementById('file-input-area').classList.remove('hidden');
        document.getElementById('text-input-area').classList.add('hidden');
    }

    triggerFileSelect() {
        document.getElementById('file-upload').click();
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // 验证文件类型
        const allowedTypes = ['.txt', '.doc', '.docx', '.pdf'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!allowedTypes.includes(fileExtension)) {
            this.showMessage('请上传 .txt, .doc, .docx 或 .pdf 格式的文件', 'error');
            return;
        }

        // 验证文件大小 (5MB限制)
        if (file.size > 5 * 1024 * 1024) {
            this.showMessage('文件大小不能超过 5MB', 'error');
            return;
        }

        await this.processFile(file);
    }

    async processFile(file) {
        try {
            // 显示文件信息
            this.displayFileInfo(file);
            
            // 提取文本内容
            const text = await this.extractTextFromFile(file);
            document.getElementById('essay-text').value = text;
            this.updateWordCount();
            
            this.showMessage('文件上传成功！文本已加载到编辑区', 'success');
            
            // 自动切换到文本输入标签
            this.switchToTextInput();
            
        } catch (error) {
            console.error('文件处理错误:', error);
            this.showMessage('文件处理失败，请重试', 'error');
        }
    }

    async extractTextFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                resolve(e.target.result);
            };
            
            reader.onerror = reject;
            
            if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
                reader.readAsText(file);
            } else {
                // 对于其他格式，这里简化处理
                // 实际项目中应该使用专门的库处理 doc, docx, pdf
                resolve(`[文件内容提取] ${file.name}\n\n由于格式限制，请手动复制文件内容到文本区域进行批改。`);
            }
        });
    }

    displayFileInfo(file) {
        const fileInfo = document.getElementById('file-info');
        const fileName = document.getElementById('file-name');
        const fileSize = document.getElementById('file-size');
        
        fileName.textContent = file.name;
        fileSize.textContent = this.formatFileSize(file.size);
        fileInfo.classList.remove('hidden');
    }

    removeSelectedFile() {
        document.getElementById('file-upload').value = '';
        document.getElementById('file-info').classList.add('hidden');
        document.getElementById('essay-text').value = '';
        this.updateWordCount();
    }

    clearText() {
        document.getElementById('essay-text').value = '';
        this.updateWordCount();
        this.showMessage('文本已清空', 'info');
    }

    async pasteText() {
        try {
            const text = await navigator.clipboard.readText();
            document.getElementById('essay-text').value = text;
            this.updateWordCount();
            this.showMessage('文本已粘贴', 'success');
        } catch (error) {
            // 如果剪贴板API不可用，使用传统方式
            document.getElementById('essay-text').focus();
            this.showMessage('请使用 Ctrl+V 粘贴文本', 'info');
        }
    }

    updateWordCount() {
        const text = document.getElementById('essay-text').value;
        const wordCount = text.trim() ? text.split(/\s+/).length : 0;
        document.getElementById('word-count').textContent = `${wordCount} 单词`;
        
        // 根据字数改变颜色
        const wordCountElement = document.getElementById('word-count');
        if (wordCount < 50) {
            wordCountElement.classList.add('text-red-500');
            wordCountElement.classList.remove('text-green-500', 'text-gray-500');
        } else if (wordCount > 300) {
            wordCountElement.classList.add('text-yellow-500');
            wordCountElement.classList.remove('text-green-500', 'text-red-500');
        } else {
            wordCountElement.classList.add('text-green-500');
            wordCountElement.classList.remove('text-red-500', 'text-yellow-500');
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showMessage(message, type = 'info') {
        if (window.uiManager && window.uiManager.showMessage) {
            window.uiManager.showMessage(message, type);
        } else {
            // 备用提示
            alert(message);
        }
    }
}