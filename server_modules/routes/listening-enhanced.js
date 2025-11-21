// [file name]: server_modules/routes/listening-enhanced.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// 获取数据库连接的辅助函数
function getDatabase(req) {
    const dbObj = req.app.locals.db;
    
    let db;
    if (dbObj && dbObj.db && typeof dbObj.db.get === 'function') {
        db = dbObj.db;
    } else if (dbObj && typeof dbObj.get === 'function') {
        db = dbObj;
    } else {
        console.error('❌ 数据库连接无效');
        return null;
    }
    
    return db;
}

// 获取试卷信息的辅助函数
function getPaperById(paperId) {
    return new Promise((resolve, reject) => {
        const db = getDatabase(this);
        if (!db) {
            reject(new Error('数据库连接无效'));
            return;
        }
        
        db.get('SELECT * FROM listening_exam_papers WHERE id = ? AND is_active = 1', [paperId], (err, paper) => {
            if (err) {
                reject(err);
            } else {
                resolve(paper);
            }
        });
    });
}

// 获取题目列表的辅助函数
function getQuestionsByPaperId(paperId) {
    return new Promise((resolve, reject) => {
        const db = getDatabase(this);
        if (!db) {
            reject(new Error('数据库连接无效'));
            return;
        }
        
        db.all('SELECT * FROM listening_exam_questions WHERE paper_id = ? ORDER BY sort_order ASC, question_number ASC', [paperId], (err, questions) => {
            if (err) {
                reject(err);
            } else {
                resolve(questions);
            }
        });
    });
}

// 生成备用题目
function generateBackupQuestions(paperId, examType) {
    console.log(`🚨 使用紧急备用题目 for paper ${paperId}, type: ${examType}`);
    
    const baseQuestions = [
        {
            id: 1,
            paper_id: parseInt(paperId),
            section_type: 'short',
            question_type: 'single_choice',
            question_number: '1',
            question_text: 'What does the woman suggest the man do?',
            options: JSON.stringify([
                { option: 'A', text: 'Go to the library' },
                { option: 'B', text: 'Ask the professor' },
                { option: 'C', text: 'Check the website' },
                { option: 'D', text: 'Talk to classmates' }
            ]),
            correct_answer: 'B',
            audio_start_time: 15,
            audio_end_time: 25,
            analysis: '本题考查听力理解中的建议类问题',
            explanation: '女士在对话中明确建议男士去询问教授',
            sort_order: 1
        },
        {
            id: 2,
            paper_id: parseInt(paperId),
            section_type: 'short', 
            question_type: 'single_choice',
            question_number: '2',
            question_text: 'Where will the speakers go first?',
            options: JSON.stringify([
                { option: 'A', text: 'To the cafeteria' },
                { option: 'B', text: 'To the bookstore' },
                { option: 'C', text: 'To the classroom' },
                { option: 'D', text: 'To the library' }
            ]),
            correct_answer: 'D',
            audio_start_time: 30,
            audio_end_time: 45,
            analysis: '本题考查对话地点的理解',
            explanation: '对话中提到先去图书馆还书',
            sort_order: 2
        },
        {
            id: 3,
            paper_id: parseInt(paperId),
            section_type: 'long',
            question_type: 'single_choice',
            question_number: '3',
            question_text: 'What is the main purpose of the announcement?',
            options: JSON.stringify([
                { option: 'A', text: 'To introduce a new course' },
                { option: 'B', text: 'To announce schedule changes' },
                { option: 'C', text: 'To remind about deadlines' },
                { option: 'D', text: 'To welcome new students' }
            ]),
            correct_answer: 'B',
            audio_start_time: 60,
            audio_end_time: 90,
            analysis: '本题考查对公告主旨的理解',
            explanation: '公告主要说明课程时间表的变更',
            sort_order: 3
        }
    ];
    
    return baseQuestions;
}

// 获取听力真题试卷列表 - 修复版
router.get('/papers', (req, res) => {
    const db = getDatabase(req);
    
    if (!db) {
        return res.status(500).json({ 
            success: false, 
            message: '数据库连接无效' 
        });
    }

    console.log('📋 获取听力试卷列表...');
    
    db.all(`
        SELECT * FROM listening_exam_papers 
        WHERE is_active = 1 
        ORDER BY year DESC, month DESC, paper_number ASC
    `, (err, rows) => {
        if (err) {
            console.error('❌ 获取听力试卷列表失败:', err);
            return res.status(500).json({ 
                success: false, 
                message: '获取试卷列表失败: ' + err.message 
            });
        }
        
        console.log(`✅ 找到 ${rows.length} 套听力试卷`);
        res.json({ 
            success: true, 
            data: rows,
            message: `成功加载 ${rows.length} 套听力试卷`
        });
    });
});

// 修复获取题目接口 - 确保始终返回正确的JSON格式
router.get('/papers/:id/questions', async (req, res) => {
    try {
        const paperId = req.params.id;
        const db = getDatabase(req);
        
        if (!db) {
            return res.json({ 
                success: false, 
                message: '数据库连接无效' 
            });
        }
        
        console.log(`📝 获取试卷 ${paperId} 的题目...`);
        
        // 首先获取试卷信息
        const paper = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM listening_exam_papers WHERE id = ? AND is_active = 1', [paperId], (err, paper) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(paper);
                }
            });
        });
        
        if (!paper) {
            return res.json({ 
                success: false, 
                message: '试卷不存在' 
            });
        }
        
        console.log(`📄 找到试卷: ${paper.title}`);
        
        // 获取题目
        const questions = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM listening_exam_questions WHERE paper_id = ? ORDER BY sort_order ASC, question_number ASC', [paperId], (err, questions) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(questions);
                }
            });
        });
        
        console.log(`✅ 为试卷 ${paperId} 找到 ${questions.length} 道题目`);
        
        // 如果题目为空，使用备用题目
        let finalQuestions = questions;
        if (questions.length === 0) {
            console.log('⚠️ 数据库中有试卷但无题目，使用备用题目');
            finalQuestions = generateBackupQuestions(paperId, paper.exam_type);
        }
        
        // 处理题目数据 - 确保格式正确
        const processedQuestions = finalQuestions.map((q, index) => {
            // 确保选项是数组格式
            let options = [];
            try {
                if (q.options && typeof q.options === 'string') {
                    options = JSON.parse(q.options);
                } else if (Array.isArray(q.options)) {
                    options = q.options;
                }
            } catch (e) {
                console.warn(`⚠️ 解析题目 ${q.id} 的选项失败:`, e.message);
                options = [
                    { option: 'A', text: '选项A' },
                    { option: 'B', text: '选项B' },
                    { option: 'C', text: '选项C' },
                    { option: 'D', text: '选项D' }
                ];
            }
            
            return {
                id: q.id || index + 1,
                paper_id: q.paper_id || paperId,
                section_type: q.section_type || 'short',
                question_type: q.question_type || 'single_choice',
                question_number: q.question_number || index + 1,
                question_text: q.question_text || `听力题目 ${index + 1}`,
                options: options,
                correct_answer: q.correct_answer || 'A',
                audio_start_time: q.audio_start_time || 0,
                audio_end_time: q.audio_end_time || 0,
                analysis: q.analysis || '题目解析',
                explanation: q.explanation || '正确答案解析',
                sort_order: q.sort_order || index + 1
            };
        });
        
        // 确保返回标准JSON格式
        const responseData = {
            success: true,
            paper: paper,
            data: processedQuestions,
            count: processedQuestions.length,
            message: `成功加载 ${processedQuestions.length} 道题目`
        };
        
        console.log(`📤 返回数据: ${processedQuestions.length} 道题目`);
        res.json(responseData);
        
    } catch (error) {
        console.error('❌ 获取题目失败:', error);
        
        // 确保错误也返回标准JSON格式
        res.json({
            success: false,
            message: '获取题目失败: ' + error.message,
            data: [],
            count: 0
        });
    }
});

// 检查音频文件是否存在 - 增强版
router.get('/check-audio', (req, res) => {
    const { file, type, paper_id } = req.query;
    
    if (!file) {
        return res.status(400).json({ 
            exists: false, 
            message: '文件名不能为空' 
        });
    }
    
    const folder = type === 'CET-4' ? '四级听力' : '六级听力';
    const possiblePaths = [
        path.join(__dirname, '../../真题与听力', folder, file),
        path.join(__dirname, '../../真题与听力', `${folder}真题`, file),
        path.join(__dirname, '../../../真题与听力', folder, file),
        path.join(__dirname, '../../../真题与听力', `${folder}真题`, file),
        path.join('E:/编程库/云梦智间英语/真题与听力', `${folder}真题`, file),
        // 新增：直接从文件名查找
        path.join(__dirname, '../../真题与听力', file),
        path.join(__dirname, '../../../真题与听力', file)
    ];
    
    let exists = false;
    let foundPath = '';
    
    for (const filePath of possiblePaths) {
        try {
            if (fs.existsSync(filePath)) {
                exists = true;
                foundPath = filePath;
                break;
            }
        } catch (error) {
            console.warn(`⚠️ 检查音频文件路径失败: ${filePath}`, error.message);
        }
    }
    
    console.log(`🎵 检查音频文件: ${file}, 存在: ${exists}`);
    
    // 如果文件不存在，尝试从数据库获取正确的文件名
    if (!exists && paper_id) {
        const db = getDatabase(req);
        if (db) {
            db.get('SELECT audio_file FROM listening_exam_papers WHERE id = ?', [paper_id], (err, paper) => {
                if (!err && paper && paper.audio_file) {
                    console.log(`🔍 尝试使用数据库中的文件名: ${paper.audio_file}`);
                    // 这里可以递归调用或返回建议的文件名
                }
            });
        }
    }
    
    res.json({
        exists: exists,
        file: file,
        path: foundPath,
        url: exists ? `/audio/${folder}/${file}` : null,
        message: exists ? '音频文件找到' : '音频文件未找到'
    });
});

// 保存听力练习结果 - 增强版
router.post('/save-result', (req, res) => {
    const { paper_id, answers, time_spent, score } = req.body;
    const user_id = req.user ? req.user.id : null;

    const db = getDatabase(req);
    
    if (!db) {
        return res.status(500).json({ 
            success: false, 
            message: '数据库连接无效' 
        });
    }

    // 计算正确率
    let correctCount = 0;
    let totalAnswers = 0;
    
    if (answers && typeof answers === 'object') {
        totalAnswers = Object.keys(answers).length;
        Object.values(answers).forEach(answer => {
            if (answer && answer.is_correct) {
                correctCount++;
            }
        });
    }

    const accuracy = totalAnswers > 0 ? (correctCount / totalAnswers) * 100 : 0;

    // 只有登录用户才保存结果
    if (!user_id) {
        return res.json({ 
            success: true, 
            message: '练习完成（匿名用户，结果未保存）',
            data: {
                total_questions: totalAnswers,
                correct_answers: correctCount,
                accuracy_rate: accuracy.toFixed(2)
            }
        });
    }

    // 首先验证试卷是否存在
    db.get('SELECT * FROM listening_exam_papers WHERE id = ?', [paper_id], (err, paper) => {
        if (err || !paper) {
            console.error('❌ 验证试卷失败:', err);
            return res.status(404).json({ 
                success: false, 
                message: '试卷不存在' 
            });
        }

        // 插入练习记录
        const insertSessionSQL = `
            INSERT INTO listening_practice_sessions 
            (user_id, paper_id, start_time, end_time, status, time_spent, score, accuracy)
            VALUES (?, ?, datetime('now'), datetime('now'), 'completed', ?, ?, ?)
        `;

        db.run(insertSessionSQL, [user_id, paper_id, time_spent, score, accuracy], function(err) {
            if (err) {
                console.error('❌ 保存听力练习结果失败:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '保存结果失败: ' + err.message 
                });
            }

            const sessionId = this.lastID;

            // 保存每个题目的答案
            if (answers && typeof answers === 'object' && totalAnswers > 0) {
                const insertAnswerSQL = `
                    INSERT INTO listening_user_answers 
                    (session_id, question_id, user_answer, is_correct, time_spent)
                    VALUES (?, ?, ?, ?, ?)
                `;

                let completed = 0;
                let errors = 0;

                Object.entries(answers).forEach(([questionId, answerData]) => {
                    if (answerData && questionId) {
                        db.run(insertAnswerSQL, [
                            sessionId,
                            questionId,
                            answerData.user_answer || '',
                            answerData.is_correct || false,
                            answerData.time_spent || 0
                        ], (err) => {
                            if (err) {
                                console.error('❌ 保存题目答案失败:', err);
                                errors++;
                            }

                            completed++;
                            if (completed === totalAnswers) {
                                // 更新听力进度统计
                                updateListeningProgress(db, user_id, paper_id, correctCount, totalAnswers, time_spent);
                                
                                res.json({ 
                                    success: true, 
                                    message: errors > 0 ? '练习结果保存完成（部分题目答案保存失败）' : '练习结果保存成功',
                                    data: {
                                        session_id: sessionId,
                                        total_questions: totalAnswers,
                                        correct_answers: correctCount,
                                        accuracy_rate: accuracy.toFixed(2),
                                        errors: errors
                                    }
                                });
                            }
                        });
                    } else {
                        completed++;
                        if (completed === totalAnswers) {
                            res.json({ 
                                success: true, 
                                message: '练习结果保存成功',
                                data: {
                                    session_id: sessionId,
                                    total_questions: totalAnswers,
                                    correct_answers: correctCount,
                                    accuracy_rate: accuracy.toFixed(2)
                                }
                            });
                        }
                    }
                });
            } else {
                // 没有答案数据的情况
                updateListeningProgress(db, user_id, paper_id, 0, 0, time_spent);
                
                res.json({ 
                    success: true, 
                    message: '练习结果保存成功',
                    data: {
                        session_id: sessionId,
                        total_questions: 0,
                        correct_answers: 0,
                        accuracy_rate: 0
                    }
                });
            }
        });
    });
});

// 更新听力进度统计 - 增强版
function updateListeningProgress(db, user_id, paper_id, correctCount, totalQuestions, timeSpent) {
    if (!user_id) return; // 匿名用户不记录进度

    // 获取试卷类型
    db.get('SELECT exam_type FROM listening_exam_papers WHERE id = ?', [paper_id], (err, paper) => {
        if (err || !paper) {
            console.warn('⚠️ 获取试卷类型失败:', err);
            return;
        }

        const examType = paper.exam_type;

        // 检查是否已有进度记录
        db.get(`
            SELECT * FROM listening_progress 
            WHERE user_id = ? AND exam_type = ?
        `, [user_id, examType], (err, existing) => {
            if (err) {
                console.warn('⚠️ 查询听力进度失败:', err);
                return;
            }

            const now = new Date().toISOString().split('T')[0];

            if (existing) {
                // 更新现有记录
                db.run(`
                    UPDATE listening_progress SET
                    total_practices = total_practices + 1,
                    total_questions = total_questions + ?,
                    correct_answers = correct_answers + ?,
                    total_time = total_time + ?,
                    accuracy_rate = ROUND((correct_answers + ?) * 100.0 / (total_questions + ?), 2),
                    last_practice_date = ?,
                    updated_at = datetime('now')
                    WHERE user_id = ? AND exam_type = ?
                `, [totalQuestions, correctCount, timeSpent, correctCount, totalQuestions, now, user_id, examType], (err) => {
                    if (err) {
                        console.warn('⚠️ 更新听力进度失败:', err);
                    } else {
                        console.log('✅ 听力进度更新成功');
                    }
                });
            } else {
                // 插入新记录
                const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
                db.run(`
                    INSERT INTO listening_progress 
                    (user_id, exam_type, total_practices, total_questions, correct_answers, total_time, accuracy_rate, last_practice_date)
                    VALUES (?, ?, 1, ?, ?, ?, ?, ?)
                `, [user_id, examType, totalQuestions, correctCount, timeSpent, accuracy, now], (err) => {
                    if (err) {
                        console.warn('⚠️ 插入听力进度失败:', err);
                    } else {
                        console.log('✅ 听力进度插入成功');
                    }
                });
            }
        });
    });
}

// 获取用户的听力进度统计 - 增强版
router.get('/progress', (req, res) => {
    const user_id = req.user ? req.user.id : null;
    const db = getDatabase(req);

    if (!user_id) {
        return res.status(401).json({ 
            success: false, 
            message: '请先登录以查看学习进度' 
        });
    }

    if (!db) {
        return res.status(500).json({ 
            success: false, 
            message: '数据库连接无效' 
        });
    }

    db.all(`
        SELECT * FROM listening_progress 
        WHERE user_id = ? 
        ORDER BY updated_at DESC
    `, [user_id], (err, rows) => {
        if (err) {
            console.error('❌ 获取听力进度失败:', err);
            res.status(500).json({ 
                success: false, 
                message: '获取进度失败: ' + err.message 
            });
        } else {
            // 计算总体统计
            const overallStats = {
                total_practices: 0,
                total_questions: 0,
                correct_answers: 0,
                total_time: 0,
                overall_accuracy: 0
            };

            rows.forEach(row => {
                overallStats.total_practices += row.total_practices;
                overallStats.total_questions += row.total_questions;
                overallStats.correct_answers += row.correct_answers;
                overallStats.total_time += row.total_time;
            });

            if (overallStats.total_questions > 0) {
                overallStats.overall_accuracy = 
                    (overallStats.correct_answers / overallStats.total_questions * 100).toFixed(2);
            }

            res.json({ 
                success: true, 
                data: rows,
                overall: overallStats,
                message: `找到 ${rows.length} 条进度记录`
            });
        }
    });
});

// 获取听力练习历史 - 增强版
router.get('/history', (req, res) => {
    const user_id = req.user ? req.user.id : null;
    const db = getDatabase(req);

    if (!user_id) {
        return res.status(401).json({ 
            success: false, 
            message: '请先登录以查看练习历史' 
        });
    }

    if (!db) {
        return res.status(500).json({ 
            success: false, 
            message: '数据库连接无效' 
        });
    }

    db.all(`
        SELECT s.*, p.title, p.exam_type, p.year, p.month, p.audio_file
        FROM listening_practice_sessions s
        JOIN listening_exam_papers p ON s.paper_id = p.id
        WHERE s.user_id = ?
        ORDER BY s.end_time DESC
        LIMIT 20
    `, [user_id], (err, rows) => {
        if (err) {
            console.error('❌ 获取练习历史失败:', err);
            res.status(500).json({ 
                success: false, 
                message: '获取历史失败: ' + err.message 
            });
        } else {
            res.json({ 
                success: true, 
                data: rows,
                message: `找到 ${rows.length} 条历史记录`
            });
        }
    });
});

// 听力数据统计接口 - 增强版
router.get('/statistics', (req, res) => {
    const db = getDatabase(req);
    
    if (!db) {
        return res.status(500).json({ 
            success: false, 
            message: '数据库连接无效' 
        });
    }

    // 获取试卷统计
    db.get("SELECT COUNT(*) as total_papers FROM listening_exam_papers WHERE is_active = 1", (err, paperResult) => {
        if (err) {
            console.error('❌ 获取试卷统计失败:', err);
            return res.status(500).json({ 
                success: false, 
                message: '获取统计失败' 
            });
        }
        
        // 获取题目统计
        db.get("SELECT COUNT(*) as total_questions FROM listening_exam_questions", (err, questionResult) => {
            if (err) {
                console.error('❌ 获取题目统计失败:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '获取统计失败' 
                });
            }
            
            // 获取四级试卷统计
            db.get("SELECT COUNT(*) as cet4_papers FROM listening_exam_papers WHERE exam_type = 'CET-4' AND is_active = 1", (err, cet4Result) => {
                if (err) {
                    console.error('❌ 获取四级统计失败:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '获取统计失败' 
                    });
                }
                
                // 获取六级试卷统计
                db.get("SELECT COUNT(*) as cet6_papers FROM listening_exam_papers WHERE exam_type = 'CET-6' AND is_active = 1", (err, cet6Result) => {
                    if (err) {
                        console.error('❌ 获取六级统计失败:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: '获取统计失败' 
                        });
                    }
                    
                    // 获取最新试卷年份
                    db.get("SELECT MAX(year) as latest_year FROM listening_exam_papers WHERE is_active = 1", (err, yearResult) => {
                        if (err) {
                            console.error('❌ 获取最新年份失败:', err);
                        }
                        
                        res.json({
                            success: true,
                            data: {
                                total_papers: paperResult.total_papers,
                                total_questions: questionResult.total_questions,
                                cet4_papers: cet4Result.cet4_papers,
                                cet6_papers: cet6Result.cet6_papers,
                                latest_year: yearResult ? yearResult.latest_year : '未知'
                            },
                            message: '听力数据统计获取成功'
                        });
                    });
                });
            });
        });
    });
});

// 新增：获取试卷详情接口
router.get('/papers/:id', (req, res) => {
    const db = getDatabase(req);
    const paperId = req.params.id;

    if (!db) {
        return res.status(500).json({ 
            success: false, 
            message: '数据库连接无效' 
        });
    }

    db.get('SELECT * FROM listening_exam_papers WHERE id = ? AND is_active = 1', [paperId], (err, paper) => {
        if (err) {
            console.error('❌ 获取试卷详情失败:', err);
            return res.status(500).json({ 
                success: false, 
                message: '获取试卷详情失败' 
            });
        }
        
        if (!paper) {
            return res.status(404).json({ 
                success: false, 
                message: '试卷不存在或已被禁用' 
            });
        }

        res.json({
            success: true,
            data: paper,
            message: '试卷详情获取成功'
        });
    });
});

module.exports = router;