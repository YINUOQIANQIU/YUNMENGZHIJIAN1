// [file name]: server_modules/routes/community.js
const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../auth-middleware');

const router = express.Router();

// 获取社区帖子列表
router.get('/posts', (req, res) => {
    const { category, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
        SELECT p.*, u.name as author_name, u.avatar as author_avatar
        FROM community_posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.is_active = 1
    `;
    let countQuery = `SELECT COUNT(*) as total FROM community_posts p WHERE p.is_active = 1`;
    let params = [];
    
    if (category && category !== '全部') {
        query += ' AND p.category = ?';
        countQuery += ' AND p.category = ?';
        params.push(category);
    }
    
    query += ' ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.get(countQuery, params.slice(0, -2), (err, countResult) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        db.all(query, params, (err, posts) => {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            res.json({
                success: true,
                data: {
                    posts,
                    total: countResult.total,
                    page: parseInt(page),
                    totalPages: Math.ceil(countResult.total / limit)
                }
            });
        });
    });
});

// 获取热门话题
router.get('/hot-topics', (req, res) => {
    const query = `
        SELECT category, COUNT(*) as count
        FROM community_posts 
        WHERE is_active = 1 
        GROUP BY category 
        ORDER BY count DESC 
        LIMIT 10
    `;
    
    db.all(query, [], (err, topics) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        res.json({
            success: true,
            data: topics
        });
    });
});

// 获取活跃用户
router.get('/active-users', (req, res) => {
    const query = `
        SELECT u.id, u.name, u.avatar, COUNT(p.id) as post_count
        FROM users u
        LEFT JOIN community_posts p ON u.id = p.user_id
        WHERE p.is_active = 1
        GROUP BY u.id
        ORDER BY post_count DESC
        LIMIT 5
    `;
    
    db.all(query, [], (err, users) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        res.json({
            success: false,
            data: users
        });
    });
});

// 获取社区统计数据
router.get('/stats', (req, res) => {
    const queries = {
        todayActive: `SELECT COUNT(DISTINCT user_id) as count FROM community_posts WHERE DATE(created_at) = DATE('now')`,
        totalPosts: `SELECT COUNT(*) as count FROM community_posts WHERE is_active = 1`,
        totalComments: `SELECT COUNT(*) as count FROM community_comments WHERE is_active = 1`
    };
    
    const stats = {};
    let completed = 0;
    
    Object.keys(queries).forEach(key => {
        db.get(queries[key], [], (err, result) => {
            if (!err && result) {
                stats[key] = result.count;
            } else {
                stats[key] = 0;
            }
            
            completed++;
            if (completed === Object.keys(queries).length) {
                res.json({
                    success: true,
                    data: stats
                });
            }
        });
    });
});

// 创建新帖子
router.post('/posts', authenticateToken, (req, res) => {
    const { title, content, category, tags } = req.body;
    
    if (!title || !content || !category) {
        return res.status(400).json({ 
            success: false, 
            message: '请填写完整信息' 
        });
    }
    
    const insertPost = `
        INSERT INTO community_posts (user_id, title, content, category, tags)
        VALUES (?, ?, ?, ?, ?)
    `;
    
    db.run(insertPost, [req.user.userId, title, content, category, tags || ''], function(err) {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '创建帖子失败' 
            });
        }
        
        res.status(201).json({
            success: true,
            message: '帖子发布成功',
            data: {
                postId: this.lastID
            }
        });
    });
});

// 获取帖子详情
router.get('/posts/:id', (req, res) => {
    const { id } = req.params;
    
    // 更新浏览量
    db.run('UPDATE community_posts SET view_count = view_count + 1 WHERE id = ?', [id]);
    
    const query = `
        SELECT p.*, u.name as author_name, u.avatar as author_avatar
        FROM community_posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = ? AND p.is_active = 1
    `;
    
    db.get(query, [id], (err, post) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!post) {
            return res.status(404).json({ 
                success: false, 
                message: '帖子不存在' 
            });
        }
        
        res.json({
            success: true,
            data: { post }
        });
    });
});

// 点赞帖子
router.post('/posts/:id/like', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    
    // 检查是否已经点赞
    db.get('SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?', [id, userId], (err, existingLike) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (existingLike) {
            // 取消点赞
            db.run('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [id, userId], function(err) {
                if (err) {
                    return res.status(500).json({ 
                        success: false, 
                        message: '取消点赞失败' 
                    });
                }
                
                // 更新帖子点赞数
                db.run('UPDATE community_posts SET like_count = like_count - 1 WHERE id = ?', [id]);
                
                res.json({
                    success: true,
                    message: '取消点赞成功',
                    data: { liked: false }
                });
            });
        } else {
            // 添加点赞
            db.run('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [id, userId], function(err) {
                if (err) {
                    return res.status(500).json({ 
                        success: false, 
                        message: '点赞失败' 
                    });
                }
                
                // 更新帖子点赞数
                db.run('UPDATE community_posts SET like_count = like_count + 1 WHERE id = ?', [id]);
                
                res.json({
                    success: true,
                    message: '点赞成功',
                    data: { liked: true }
                });
            });
        }
    });
});

// 获取帖子评论
router.get('/posts/:id/comments', (req, res) => {
    const { id } = req.params;
    
    const query = `
        SELECT c.*, u.name as author_name, u.avatar as author_avatar
        FROM community_comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ? AND c.is_active = 1
        ORDER BY c.created_at ASC
    `;
    
    db.all(query, [id], (err, comments) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        res.json({
            success: true,
            data: { comments }
        });
    });
});

// 添加评论
router.post('/posts/:id/comments', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;
    
    if (!content) {
        return res.status(400).json({ 
            success: false, 
            message: '评论内容不能为空' 
        });
    }
    
    const insertComment = `
        INSERT INTO community_comments (post_id, user_id, content)
        VALUES (?, ?, ?)
    `;
    
    db.run(insertComment, [id, userId, content], function(err) {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '评论失败' 
            });
        }
        
        // 更新帖子评论数
        db.run('UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = ?', [id]);
        
        res.status(201).json({
            success: true,
            message: '评论成功',
            data: {
                commentId: this.lastID
            }
        });
    });
});

// 关注用户
router.post('/users/:id/follow', authenticateToken, (req, res) => {
    const { id } = req.params;
    const followerId = req.user.userId;
    
    if (parseInt(id) === followerId) {
        return res.status(400).json({ 
            success: false, 
            message: '不能关注自己' 
        });
    }
    
    // 检查是否已经关注
    db.get('SELECT * FROM user_follows WHERE follower_id = ? AND following_id = ?', [followerId, id], (err, existingFollow) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (existingFollow) {
            // 取消关注
            db.run('DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?', [followerId, id], function(err) {
                if (err) {
                    return res.status(500).json({ 
                        success: false, 
                        message: '取消关注失败' 
                    });
                }
                
                res.json({
                    success: true,
                    message: '取消关注成功',
                    data: { following: false }
                });
            });
        } else {
            // 添加关注
            db.run('INSERT INTO user_follows (follower_id, following_id) VALUES (?, ?)', [followerId, id], function(err) {
                if (err) {
                    return res.status(500).json({ 
                        success: false, 
                        message: '关注失败' 
                    });
                }
                
                res.json({
                    success: true,
                    message: '关注成功',
                    data: { following: true }
                });
            });
        }
    });
});

module.exports = router;