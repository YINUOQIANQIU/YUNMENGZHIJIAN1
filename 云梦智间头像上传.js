// [file name]: 云梦智间头像上传.js
class AvatarUploader {
    constructor() {
        this.authManager = window.unifiedAuthManager;
        this.uploadUrl = '/api/user/avatar';
        this.init();
    }

    init() {
        this.createUploadModal();
        this.bindEvents();
    }

    createUploadModal() {
        const modalHTML = `
            <div id="avatar-upload-modal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden">
                <div class="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                    <h3 class="text-xl font-bold text-secondary mb-4">更换头像</h3>
                    <div class="space-y-4">
                        <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                            <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-3"></i>
                            <p class="text-gray-600 mb-2">点击选择图片或拖拽到此处</p>
                            <p class="text-sm text-gray-500">支持 JPG、PNG 格式，大小不超过 2MB</p>
                            <input type="file" id="avatar-file-input" class="hidden" accept="image/*">
                        </div>
                        <div class="text-center">
                            <p class="text-sm text-gray-600 mb-2">或使用在线图片链接</p>
                            <input type="url" id="avatar-url-input" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary" placeholder="https://example.com/avatar.jpg">
                        </div>
                        <div class="flex gap-3">
                            <button id="cancel-avatar-upload" class="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                                取消
                            </button>
                            <button id="confirm-avatar-upload" class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors">
                                确认
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (!document.getElementById('avatar-upload-modal')) {
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }
    }

    bindEvents() {
        const modal = document.getElementById('avatar-upload-modal');
        const fileInput = document.getElementById('avatar-file-input');
        const urlInput = document.getElementById('avatar-url-input');
        const cancelBtn = document.getElementById('cancel-avatar-upload');
        const confirmBtn = document.getElementById('confirm-avatar-upload');
        const dropZone = modal.querySelector('.border-dashed');

        // 打开文件选择
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        // 文件选择变化
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        // 拖拽功能
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-primary', 'bg-blue-50');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-primary', 'bg-blue-50');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-primary', 'bg-blue-50');
            
            if (e.dataTransfer.files.length > 0) {
                this.handleFileSelect(e.dataTransfer.files[0]);
            }
        });

        // 取消上传
        cancelBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            this.resetInputs();
        });

        // 确认上传
        confirmBtn.addEventListener('click', () => {
            this.confirmUpload();
        });

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                this.resetInputs();
            }
        });
    }

    handleFileSelect(file) {
        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            window.uiManager.showMessage('请选择图片文件', 'error');
            return;
        }

        // 验证文件大小 (2MB)
        if (file.size > 2 * 1024 * 1024) {
            window.uiManager.showMessage('图片大小不能超过 2MB', 'error');
            return;
        }

        // 创建预览
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('avatar-url-input').value = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    async confirmUpload() {
        const avatarUrl = document.getElementById('avatar-url-input').value.trim();
        
        if (!avatarUrl) {
            window.uiManager.showMessage('请选择图片或输入图片链接', 'error');
            return;
        }

        try {
            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                headers: this.authManager.getAuthHeaders(),
                body: JSON.stringify({ avatarUrl })
            });

            const result = await response.json();

            if (result.success) {
                window.uiManager.showMessage('头像更新成功', 'success');
                
                // 更新页面头像
                document.getElementById('user-avatar').src = avatarUrl;
                
                // 更新全局用户信息
                this.authManager.currentUser.avatar = avatarUrl;
                localStorage.setItem(this.authManager.userKey, JSON.stringify(this.authManager.currentUser));
                this.authManager.notifyAuthChange();
                
                // 关闭模态框
                document.getElementById('avatar-upload-modal').classList.add('hidden');
                this.resetInputs();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('上传头像失败:', error);
            window.uiManager.showMessage('上传头像失败: ' + error.message, 'error');
        }
    }

    resetInputs() {
        document.getElementById('avatar-file-input').value = '';
        document.getElementById('avatar-url-input').value = '';
    }

    show() {
        document.getElementById('avatar-upload-modal').classList.remove('hidden');
    }
}

// 创建全局头像上传器实例
window.avatarUploader = new AvatarUploader();