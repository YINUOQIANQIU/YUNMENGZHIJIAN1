// [file name]: server_modules/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, getRandomAvatar } = require('../database');
const { JWT_SECRET } = require('../auth-middleware');

const router = express.Router();

// 用户注册接口
router.post('/register', async (req, res) => {
    try {
        const { username, password, name, phone } = req.body;

        // 验证输入
        if (!username || !password || !name) {
            return res.status(400).json({ 
                success: false, 
                message: '请填写完整信息' 
            });
        }

        if (username.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: '用户名至少6位字符' 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: '密码至少6位字符' 
            });
        }

        // 检查用户名是否已存在
        db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username], async (err, userExists) => {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }

            if (userExists) {
                return res.status(400).json({ 
                    success: false, 
                    message: '用户名已存在' 
                });
            }

            // 加密密码
            const hashedPassword = await bcrypt.hash(password, 10);

            // 创建用户，随机分配头像
            const avatar = getRandomAvatar();

            db.run(
                'INSERT INTO users (username, password, name, phone, avatar) VALUES (?, ?, ?, ?, ?)',
                [username, hashedPassword, name, phone || null, avatar],
                function(err) {
                    if (err) {
                        return res.status(500).json({ 
                            success: false, 
                            message: '创建用户失败' 
                        });
                    }

                    // 生成JWT token
                    const token = jwt.sign(
                        { userId: this.lastID, username: username },
                        JWT_SECRET,
                        { expiresIn: '7d' }
                    );

                    res.status(201).json({
                        success: true,
                        message: '注册成功',
                        data: {
                            user: {
                                id: this.lastID,
                                username: username,
                                name: name,
                                phone: phone || null,
                                avatar: avatar
                            },
                            token
                        }
                    });
                }
            );
        });

    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误，请稍后重试' 
        });
    }
});

// 用户登录接口
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username) {
            return res.status(400).json({ 
                success: false, 
                message: '请输入用户名' 
            });
        }

        if (!password) {
            return res.status(400).json({ 
                success: false, 
                message: '请输入密码' 
            });
        }

        // 查找用户
        db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username], async (err, user) => {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }

            if (!user) {
                return res.status(400).json({ 
                    success: false, 
                    message: '用户不存在' 
                });
            }

            // 验证密码
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(400).json({ 
                    success: false, 
                    message: '密码错误' 
                });
            }

            // 生成JWT token
            const token = jwt.sign(
                { userId: user.id, username: user.username },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            // 更新最后登录时间
            db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

            res.json({
                success: true,
                message: '登录成功',
                data: {
                    user: {
                        id: user.id,
                        username: user.username,
                        name: user.name,
                        phone: user.phone,
                        avatar: user.avatar
                    },
                    token
                }
            });
        });

    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器错误，请稍后重试' 
        });
    }
});

// 检查用户名是否可用
router.get('/check-username/:username', (req, res) => {
    const { username } = req.params;
    
    db.get('SELECT id FROM users WHERE username = ? AND is_active = 1', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        res.json({
            available: !user
        });
    });
});

module.exports = router;