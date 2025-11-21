// [file name]: server_modules/listening-manager.js
const { db } = require('./database');
const path = require('path');
const fs = require('fs');

class ListeningManager {
    constructor() {
        this.baseURL = process.env.BASE_URL || 'http://localhost:3000';
    }

    // 获取听力试卷列表（增强版）
    async getListeningPapers(filters = {}) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    ep.id, ep.exam_type, ep.year, ep.month, ep.paper_number,
                    ep.title, ep.description, ep.audio_files, ep.time_limit,
                    COUNT(eq.id) as question_count,
                    AVG(uer.total_score) as avg_score,
                    COUNT(uer.id) as practice_count
                FROM exam_papers ep
                LEFT JOIN exam_questions eq ON ep.id = eq.paper_id AND eq.section_type = 'listening'
                LEFT JOIN user_exam_records uer ON ep.id = uer.paper_id
                WHERE ep.is_active = 1
            `;
            
            const params = [];
            
            if (filters.exam_type) {
                query += ' AND ep.exam_type = ?';
                params.push(filters.exam_type);
            }
            
            if (filters.level) {
                query += ' AND ep.exam_type = ?';
                params.push(filters.level === '四级' ? 'CET4' : 'CET6');
            }
            
            if (filters.year) {
                query += ' AND ep.year = ?';
                params.push(filters.year);
            }
            
            query += ' GROUP BY ep.id ORDER BY ep.year DESC, ep.month DESC';
            
            db.all(query, params, (err, papers) => {
                if (err) {
                    reject(err);
                } else {
                    // 解析audio_files JSON
                    papers.forEach(paper => {
                        try {
                            paper.audio_files = JSON.parse(paper.audio_files || '{}');
                        } catch (e) {
                            paper.audio_files = {};
                        }
                        paper.avg_score = paper.avg_score ? Math.round(paper.avg_score) : 0;
                    });
                    resolve(papers);
                }
            });
        });
    }

    // 获取听力试卷详情（增强版）
    async getListeningPaperDetail(paperId) {
        return new Promise((resolve, reject) => {
            // 获取试卷基本信息
            const paperQuery = `
                SELECT * FROM exam_papers 
                WHERE id = ? AND is_active = 1
            `;
            
            // 获取听力题目（按section分类）
            const questionsQuery = `
                SELECT 
                    eq.*,
                    laf.file_path as audio_file_path,
                    laf.duration as audio_duration
                FROM exam_questions eq
                LEFT JOIN listening_audio_files laf ON (
                    eq.audio_url IS NOT NULL AND 
                    laf.exam_type = (SELECT exam_type FROM exam_papers WHERE id = eq.paper_id) AND
                    laf.year = (SELECT year FROM exam_papers WHERE id = eq.paper_id) AND
                    laf.month = (SELECT month FROM exam_papers WHERE id = eq.paper_id)
                )
                WHERE eq.paper_id = ? AND eq.section_type = 'listening'
                ORDER BY 
                    CASE 
                        WHEN eq.question_type = 'short_conversation' THEN 1
                        WHEN eq.question_type = 'long_conversation' THEN 2
                        WHEN eq.question_type = 'passage' THEN 3
                        WHEN eq.question_type = 'lecture' THEN 4
                        ELSE 5
                    END,
                    eq.sort_order ASC, eq.question_number ASC
            `;
            
            db.get(paperQuery, [paperId], (err, paper) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (!paper) {
                    reject(new Error('试卷不存在'));
                    return;
                }
                
                // 解析audio_files
                try {
                    paper.audio_files = JSON.parse(paper.audio_files || '{}');
                } catch (e) {
                    paper.audio_files = {};
                }
                
                db.all(questionsQuery, [paperId], (err, questions) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // 处理题目数据
                    const processedQuestions = questions.map(q => {
                        try {
                            q.options = q.options ? JSON.parse(q.options) : [];
                        } catch (e) {
                            q.options = [];
                        }
                        
                        // 如果有音频文件路径，构建完整URL
                        if (q.audio_file_path) {
                            q.audio_url = `${this.baseURL}${q.audio_file_path}`;
                        }
                        
                        return q;
                    });
                    
                    // 按section分类题目
                    const sections = this.groupQuestionsBySection(processedQuestions);
                    
                    resolve({
                        paper: paper,
                        questions: processedQuestions,
                        sections: sections
                    });
                });
            });
        });
    }

    // 按section分类题目
    groupQuestionsBySection(questions) {
        const sections = {
            short_conversation: {
                title: '短对话',
                description: 'Section A: Short Conversations',
                questions: [],
                audio_type: 'short'
            },
            long_conversation: {
                title: '长对话', 
                description: 'Section B: Long Conversations',
                questions: [],
                audio_type: 'long'
            },
            passage: {
                title: '短文理解',
                description: 'Section C: Passages',
                questions: [],
                audio_type: 'passage'
            },
            lecture: {
                title: '讲座/讲话',
                description: 'Section D: Lectures/Talks',
                questions: [],
                audio_type: 'lecture'
            }
        };
        
        questions.forEach(question => {
            const sectionType = question.question_type || 'short_conversation';
            if (sections[sectionType]) {
                sections[sectionType].questions.push(question);
            } else {
                sections.short_conversation.questions.push(question);
            }
        });
        
        return sections;
    }

    // 开始听力练习会话
    async startListeningPractice(userId, paperId) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO listening_practice_sessions 
                (user_id, paper_id, start_time, status) 
                VALUES (?, ?, CURRENT_TIMESTAMP, 'in_progress')
            `;
            
            db.run(query, [userId, paperId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    // 提交听力答案
    async submitListeningAnswer(sessionId, questionId, userAnswer, timeSpent = 0) {
        return new Promise((resolve, reject) => {
            // 首先获取正确答案
            const correctAnswerQuery = `
                SELECT correct_answer, score FROM exam_questions WHERE id = ?
            `;
            
            db.get(correctAnswerQuery, [questionId], (err, question) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const is_correct = question.correct_answer === userAnswer;
                const score = is_correct ? question.score : 0;
                
                const insertQuery = `
                    INSERT OR REPLACE INTO listening_user_answers 
                    (session_id, question_id, user_answer, is_correct, time_spent, score)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                
                db.run(insertQuery, [sessionId, questionId, userAnswer, is_correct, timeSpent, score], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            is_correct: is_correct,
                            correct_answer: question.correct_answer,
                            score: score
                        });
                    }
                });
            });
        });
    }

    // 完成听力练习
    async completeListeningPractice(sessionId) {
        return new Promise((resolve, reject) => {
            const updateQuery = `
                UPDATE listening_practice_sessions 
                SET end_time = CURRENT_TIMESTAMP, status = 'completed'
                WHERE id = ?
            `;
            
            db.run(updateQuery, [sessionId], function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                
                // 计算详细统计
                this.calculatePracticeStats(sessionId).then(stats => {
                    resolve(stats);
                }).catch(reject);
            }.bind(this));
        });
    }

    // 计算练习统计
    async calculatePracticeStats(sessionId) {
        return new Promise((resolve, reject) => {
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_questions,
                    SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
                    SUM(score) as total_score,
                    AVG(time_spent) as avg_time_spent,
                    MAX(time_spent) as max_time_spent,
                    MIN(time_spent) as min_time_spent
                FROM listening_user_answers
                WHERE session_id = ?
            `;
            
            db.get(statsQuery, [sessionId], (err, stats) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const accuracy = stats.total_questions > 0 ? 
                    Math.round((stats.correct_count / stats.total_questions) * 100) : 0;
                
                // 获取试卷信息用于计算总分
                const paperQuery = `
                    SELECT ep.total_score as paper_total_score
                    FROM listening_practice_sessions lps
                    JOIN exam_papers ep ON lps.paper_id = ep.id
                    WHERE lps.id = ?
                `;
                
                db.get(paperQuery, [sessionId], (err, paper) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    const result = {
                        total_questions: stats.total_questions || 0,
                        correct_count: stats.correct_count || 0,
                        accuracy: accuracy,
                        total_score: stats.total_score || 0,
                        paper_total_score: paper.paper_total_score || 710,
                        avg_time_spent: Math.round(stats.avg_time_spent || 0),
                        max_time_spent: stats.max_time_spent || 0,
                        min_time_spent: stats.min_time_spent || 0
                    };
                    
                    // 更新用户听力进度统计
                    this.updateUserListeningProgress(sessionId, result);
                    
                    resolve(result);
                });
            });
        });
    }

    // 更新用户听力进度统计
    async updateUserListeningProgress(sessionId, stats) {
        return new Promise((resolve, reject) => {
            // 获取会话信息
            const sessionQuery = `
                SELECT lps.user_id, ep.exam_type 
                FROM listening_practice_sessions lps
                JOIN exam_papers ep ON lps.paper_id = ep.id
                WHERE lps.id = ?
            `;
            
            db.get(sessionQuery, [sessionId], (err, session) => {
                if (err || !session.user_id) {
                    resolve(); // 游客模式不记录
                    return;
                }
                
                const updateQuery = `
                    INSERT OR REPLACE INTO listening_progress 
                    (user_id, exam_type, total_practices, total_questions, correct_answers, total_time, last_practice_date, updated_at)
                    VALUES (?, ?, 
                        COALESCE((SELECT total_practices FROM listening_progress WHERE user_id = ? AND exam_type = ?), 0) + 1,
                        COALESCE((SELECT total_questions FROM listening_progress WHERE user_id = ? AND exam_type = ?), 0) + ?,
                        COALESCE((SELECT correct_answers FROM listening_progress WHERE user_id = ? AND exam_type = ?), 0) + ?,
                        COALESCE((SELECT total_time FROM listening_progress WHERE user_id = ? AND exam_type = ?), 0) + ?,
                        CURRENT_DATE, CURRENT_TIMESTAMP
                    )
                `;
                
                const params = [
                    session.user_id, session.exam_type,
                    session.user_id, session.exam_type,
                    session.user_id, session.exam_type, stats.total_questions,
                    session.user_id, session.exam_type, stats.correct_count,
                    session.user_id, session.exam_type, stats.avg_time_spent * stats.total_questions
                ];
                
                db.run(updateQuery, params, function(err) {
                    if (err) {
                        console.error('更新听力进度失败:', err);
                    }
                    resolve();
                });
            });
        });
    }

    // 获取用户听力统计
    async getUserListeningStats(userId) {
        return new Promise((resolve, reject) => {
            if (!userId) {
                resolve({
                    total_practices: 0,
                    total_questions: 0,
                    accuracy: 0,
                    total_time: 0,
                    by_exam_type: {}
                });
                return;
            }
            
            const statsQuery = `
                SELECT 
                    exam_type,
                    total_practices,
                    total_questions,
                    correct_answers,
                    total_time,
                    last_practice_date
                FROM listening_progress 
                WHERE user_id = ?
            `;
            
            db.all(statsQuery, [userId], (err, stats) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const result = {
                    total_practices: 0,
                    total_questions: 0,
                    total_time: 0,
                    by_exam_type: {}
                };
                
                let totalCorrect = 0;
                
                stats.forEach(stat => {
                    result.total_practices += stat.total_practices;
                    result.total_questions += stat.total_questions;
                    result.total_time += stat.total_time;
                    totalCorrect += stat.correct_answers;
                    
                    result.by_exam_type[stat.exam_type] = {
                        total_practices: stat.total_practices,
                        total_questions: stat.total_questions,
                        correct_answers: stat.correct_answers,
                        accuracy: stat.total_questions > 0 ? 
                            Math.round((stat.correct_answers / stat.total_questions) * 100) : 0,
                        total_time: stat.total_time,
                        last_practice_date: stat.last_practice_date
                    };
                });
                
                result.accuracy = result.total_questions > 0 ? 
                    Math.round((totalCorrect / result.total_questions) * 100) : 0;
                result.total_time = Math.round(result.total_time / 60); // 转换为分钟
                
                resolve(result);
            });
        });
    }

    // 获取推荐练习
    async getRecommendedPractices(userId, limit = 8) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    ep.id, ep.exam_type, ep.year, ep.month, ep.title,
                    ep.description, ep.audio_files,
                    COUNT(eq.id) as question_count,
                    (SELECT COUNT(*) FROM listening_practice_sessions lps 
                     WHERE lps.paper_id = ep.id AND lps.user_id = ?) as user_practice_count
                FROM exam_papers ep
                LEFT JOIN exam_questions eq ON ep.id = eq.paper_id AND eq.section_type = 'listening'
                WHERE ep.is_active = 1
                GROUP BY ep.id
                ORDER BY 
                    user_practice_count ASC,
                    ep.year DESC, ep.month DESC
                LIMIT ?
            `;
            
            db.all(query, [userId, limit], (err, practices) => {
                if (err) {
                    reject(err);
                } else {
                    // 解析audio_files
                    practices.forEach(practice => {
                        try {
                            practice.audio_files = JSON.parse(practice.audio_files || '{}');
                        } catch (e) {
                            practice.audio_files = {};
                        }
                    });
                    resolve(practices);
                }
            });
        });
    }

    // 获取音频文件信息
    async getAudioFiles(examType, year, month) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM listening_audio_files 
                WHERE exam_type = ? AND year = ? AND month = ? AND is_active = 1
                ORDER BY audio_type
            `;
            
            db.all(query, [examType, year, month], (err, files) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(files);
                }
            });
        });
    }
}

module.exports = new ListeningManager();