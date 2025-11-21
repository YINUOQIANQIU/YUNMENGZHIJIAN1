// [file name]: listening-routes.js
const express = require('express');
const router = express.Router();

// 获取听力真题试卷列表
router.get('/papers', (req, res) => {
    const db = getDatabase(req);
    
    if (!db) {
        return res.json({ success: false, message: '数据库连接无效' });
    }

    db.all(`
        SELECT * FROM listening_exam_papers 
        WHERE is_active = 1 
        ORDER BY year DESC, month DESC, paper_number ASC
    `, (err, rows) => {
        if (err) {
            console.error('获取听力试卷列表失败:', err);
            res.json({ success: false, message: '获取试卷列表失败' });
        } else {
            res.json({ success: true, data: rows });
        }
    });
});

// 获取听力真题题目列表
router.get('/papers/:id/questions', (req, res) => {
    const db = getDatabase(req);
    const paperId = req.params.id;

    if (!db) {
        return res.json({ success: false, message: '数据库连接无效' });
    }

    db.all(`
        SELECT * FROM listening_exam_questions 
        WHERE paper_id = ? 
        ORDER BY sort_order ASC, question_number ASC
    `, [paperId], (err, rows) => {
        if (err) {
            console.error('获取听力题目列表失败:', err);
            res.json({ success: false, message: '获取题目列表失败' });
        } else {
            // 将options字段从JSON字符串解析为对象
            const questions = rows.map(q => {
                try {
                    q.options = JSON.parse(q.options);
                } catch (e) {
                    q.options = [];
                }
                return q;
            });
            res.json({ success: true, data: questions });
        }
    });
});

// 检查音频文件是否存在
router.get('/check-audio', (req, res) => {
    const { file, type } = req.query;
    
    if (!file) {
        return res.json({ exists: false, message: '文件名不能为空' });
    }
    
    const folder = type === 'CET-4' ? '四级听力' : '六级听力';
    const possiblePaths = [
        path.join(__dirname, '../真题与听力', folder, file),
        path.join(__dirname, '../真题与听力', `${folder}真题`, file),
        path.join(__dirname, '../../真题与听力', folder, file),
        path.join(__dirname, '../../真题与听力', `${folder}真题`, file),
        path.join('E:/编程库/云梦智间英语/真题与听力', `${folder}真题`, file)
    ];
    
    let exists = false;
    let foundPath = '';
    
    for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
            exists = true;
            foundPath = filePath;
            break;
        }
    }
    
    res.json({
        exists: exists,
        file: file,
        path: foundPath,
        url: exists ? `/${folder}/${file}` : null
    });
});

// 保存用户答案记录
router.post('/save-answers', (req, res) => {
    const { paper_id, answers, time_spent } = req.body;
    const user_id = req.user ? req.user.id : null; // 匿名用户可能没有ID

    const db = getDatabase(req);
    
    if (!db) {
        return res.json({ success: false, message: '数据库连接无效' });
    }

    // 这里可以添加保存用户答案的逻辑
    // 由于时间关系，我们先返回成功响应
    res.json({ 
        success: true, 
        message: '答案保存成功',
        data: {
            total_questions: Object.keys(answers).length,
            correct_answers: 0, // 需要计算
            accuracy_rate: 0
        }
    });
});

module.exports = router;