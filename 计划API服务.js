// [file name]: 计划API服务.js
const express = require('express');
const router = express.Router();
const db = require('./server_modules/database').db;

class PlanService {
    constructor() {
        this.initTemplates();
    }

    async initTemplates() {
        // 初始化模板数据到数据库
        const templates = [
            {
                name: 'daily_study',
                title: "每日学习计划",
                description: "高效安排每日学习任务，建立持续学习习惯",
                fields: JSON.stringify(["学习目标", "重点内容", "时间安排", "完成标准", "复习计划"]),
                category: 'daily'
            },
            {
                name: 'weekly_review',
                title: "周度复习计划",
                description: "系统化周度复习安排，巩固学习成果",
                fields: JSON.stringify(["本周目标", "每日任务", "重点难点", "自我评估", "下周计划"]),
                category: 'weekly'
            },
            {
                name: 'vocabulary_mastery',
                title: "词汇突破计划",
                description: "系统化词汇记忆与复习，快速提升词汇量",
                fields: JSON.stringify(["每日词汇量", "记忆方法", "复习周期", "测试方式", "重点词汇"]),
                category: 'vocabulary'
            },
            {
                name: 'listening_training',
                title: "听力强化训练",
                description: "提升英语听力理解能力，突破听力瓶颈",
                fields: JSON.stringify(["训练材料", "训练时长", "精听/泛听", "笔记方法", "重点训练"]),
                category: 'listening'
            },
            {
                name: 'reading_comprehension',
                title: "阅读理解提升",
                description: "提高阅读速度和理解能力，掌握阅读技巧",
                fields: JSON.stringify(["阅读材料", "阅读目标", "理解练习", "词汇积累", "技巧训练"]),
                category: 'reading'
            },
            {
                name: 'writing_practice',
                title: "写作技能训练",
                description: "系统化写作能力提升，掌握高分写作技巧",
                fields: JSON.stringify(["写作类型", "练习频率", "批改方式", "范文学习", "常见错误"]),
                category: 'writing'
            },
            {
                name: 'exam_preparation',
                title: "考试冲刺计划",
                description: "考前系统复习与模拟训练，全面提升应试能力",
                fields: JSON.stringify(["考试目标", "复习重点", "模拟测试", "时间安排", "心态调整"]),
                category: 'exam'
            },
            {
                name: 'comprehensive_improvement',
                title: "综合能力提升",
                description: "全面提升英语综合能力，均衡发展各项技能",
                fields: JSON.stringify(["能力评估", "重点突破", "训练计划", "进度跟踪", "效果评估"]),
                category: 'comprehensive'
            }
        ];

        for (const template of templates) {
            await this.upsertTemplate(template);
        }
    }

    upsertTemplate(templateData) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT OR REPLACE INTO plan_templates (name, title, description, fields, category, is_active)
                VALUES (?, ?, ?, ?, ?, 1)
            `;
            db.run(query, [
                templateData.name,
                templateData.title,
                templateData.description,
                templateData.fields,
                templateData.category
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    // AI分析学习数据生成计划
    async generateAIPlan(userId, learningStats) {
        const { studyTime, weakAreas, progress, goals } = learningStats;
        
        let planType = 'daily';
        let focusAreas = [];
        
        // 基于学习数据分析
        if (weakAreas && weakAreas.length > 0) {
            focusAreas = weakAreas.slice(0, 2);
        }
        
        if (progress < 30) {
            planType = 'foundation';
        } else if (progress >= 30 && progress < 70) {
            planType = 'improvement';
        } else {
            planType = 'advanced';
        }

        const aiPlan = {
            title: `AI智能学习计划 - ${new Date().toLocaleDateString()}`,
            type: planType,
            source: 'ai',
            description: this.generateAIDescription(learningStats),
            content: JSON.stringify(this.generateAIContent(learningStats, focusAreas)),
            duration: 7,
            duration_unit: 'days',
            progress: 0,
            ai_analysis: JSON.stringify(this.generateAIAnalysis(learningStats)),
            focus_areas: JSON.stringify(focusAreas),
            recommended_actions: JSON.stringify(this.generateRecommendations(learningStats))
        };

        return await this.createPlan(userId, aiPlan);
    }

    // 获取用户计划
    getUserPlans(userId, filter = 'all') {
        return new Promise((resolve, reject) => {
            let query = `SELECT * FROM learning_plans WHERE user_id = ?`;
            const params = [userId];

            switch (filter) {
                case 'ai':
                    query += ' AND source = ?';
                    params.push('ai');
                    break;
                case 'custom':
                    query += ' AND source = ?';
                    params.push('custom');
                    break;
                case 'completed':
                    query += ' AND progress = 100';
                    break;
                case 'active':
                    query += ' AND progress < 100';
                    break;
                default:
                    break;
            }

            query += ' ORDER BY created_at DESC';

            db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                // 解析JSON字段
                const plans = rows.map(row => {
                    try {
                        row.content = row.content ? JSON.parse(row.content) : {};
                        row.ai_analysis = row.ai_analysis ? JSON.parse(row.ai_analysis) : null;
                        row.focus_areas = row.focus_areas ? JSON.parse(row.focus_areas) : [];
                        row.recommended_actions = row.recommended_actions ? JSON.parse(row.recommended_actions) : [];
                    } catch (e) {
                        console.error('解析计划数据失败:', e);
                    }
                    return row;
                });

                resolve(plans);
            });
        });
    }

    // 创建新计划 - 修复版本
    createPlan(userId, planData) {
        return new Promise((resolve, reject) => {
            const {
                title, type, source = 'custom', description, content, 
                duration = 7, duration_unit = 'days', progress = 0,
                ai_analysis, focus_areas, recommended_actions
            } = planData;

            const query = `
                INSERT INTO learning_plans 
                (user_id, title, type, source, description, content, duration, duration_unit, progress, ai_analysis, focus_areas, recommended_actions)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const self = this; // 保存this引用
            
            db.run(query, [
                userId, title, type, source, description, 
                typeof content === 'string' ? content : JSON.stringify(content),
                duration, duration_unit, progress,
                typeof ai_analysis === 'string' ? ai_analysis : JSON.stringify(ai_analysis),
                typeof focus_areas === 'string' ? focus_areas : JSON.stringify(focus_areas),
                typeof recommended_actions === 'string' ? recommended_actions : JSON.stringify(recommended_actions)
            ], function(err) {  // 使用普通函数
                if (err) {
                    reject(err);
                    return;
                }

                // 获取刚插入的计划 - 现在 this 指向正确
                const planId = this.lastID;
                self.getPlanById(planId, userId)
                    .then(plan => resolve(plan))
                    .catch(reject);
            });
        });
    }

    // 根据ID获取计划
    getPlanById(planId, userId) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM learning_plans WHERE id = ? AND user_id = ?',
                [planId, userId],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!row) {
                        reject(new Error('计划未找到'));
                        return;
                    }

                    // 解析JSON字段
                    try {
                        row.content = row.content ? JSON.parse(row.content) : {};
                        row.ai_analysis = row.ai_analysis ? JSON.parse(row.ai_analysis) : null;
                        row.focus_areas = row.focus_areas ? JSON.parse(row.focus_areas) : [];
                        row.recommended_actions = row.recommended_actions ? JSON.parse(row.recommended_actions) : [];
                    } catch (e) {
                        console.error('解析计划数据失败:', e);
                    }

                    resolve(row);
                }
            );
        });
    }

    // 更新计划进度 - 修复版本
    updatePlanProgress(userId, planId, progress) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE learning_plans 
                SET progress = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
            `;
            const self = this; // 保存this引用
            
            db.run(query, [progress, planId, userId], function(err) {
                if (err) {
                    reject(err);
                    return;
                }

                if (this.changes === 0) {
                    reject(new Error('计划未找到'));
                    return;
                }

                self.getPlanById(planId, userId)
                    .then(plan => resolve(plan))
                    .catch(reject);
            });
        });
    }

    // 更新计划内容 - 修复版本
    updatePlan(userId, planId, planData) {
        return new Promise((resolve, reject) => {
            const {
                title, type, description, content,
                duration, duration_unit, progress,
                ai_analysis, focus_areas, recommended_actions
            } = planData;

            const query = `
                UPDATE learning_plans 
                SET title = ?, type = ?, description = ?, content = ?, 
                    duration = ?, duration_unit = ?, progress = ?,
                    ai_analysis = ?, focus_areas = ?, recommended_actions = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
            `;
            
            const self = this; // 保存this引用
            
            db.run(query, [
                title, type, description,
                typeof content === 'string' ? content : JSON.stringify(content),
                duration, duration_unit, progress,
                typeof ai_analysis === 'string' ? ai_analysis : JSON.stringify(ai_analysis),
                typeof focus_areas === 'string' ? focus_areas : JSON.stringify(focus_areas),
                typeof recommended_actions === 'string' ? recommended_actions : JSON.stringify(recommended_actions),
                planId, userId
            ], function(err) {
                if (err) {
                    reject(err);
                    return;
                }

                if (this.changes === 0) {
                    reject(new Error('计划未找到'));
                    return;
                }

                self.getPlanById(planId, userId)
                    .then(plan => resolve(plan))
                    .catch(reject);
            });
        });
    }

    // 添加日记条目
    addDiaryEntry(userId, planId, entry) {
        return new Promise((resolve, reject) => {
            const { content, mood = 'normal', achievements = [], challenges = [], reflection = '' } = entry;

            const query = `
                INSERT INTO plan_diary_entries 
                (plan_id, user_id, content, mood, achievements, challenges, reflection)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            db.run(query, [
                planId, userId, content, mood,
                JSON.stringify(achievements),
                JSON.stringify(challenges),
                reflection
            ], function(err) {
                if (err) {
                    reject(err);
                    return;
                }

                // 获取刚插入的日记条目
                db.get(
                    'SELECT * FROM plan_diary_entries WHERE id = ?',
                    [this.lastID],
                    (err, row) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        // 解析JSON字段
                        try {
                            row.achievements = row.achievements ? JSON.parse(row.achievements) : [];
                            row.challenges = row.challenges ? JSON.parse(row.challenges) : [];
                        } catch (e) {
                            console.error('解析日记数据失败:', e);
                        }

                        resolve(row);
                    }
                );
            });
        });
    }

    // 获取计划的日记条目
    getPlanDiaries(planId, userId) {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM plan_diary_entries WHERE plan_id = ? AND user_id = ? ORDER BY date DESC',
                [planId, userId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // 解析JSON字段
                    const diaries = rows.map(row => {
                        try {
                            row.achievements = row.achievements ? JSON.parse(row.achievements) : [];
                            row.challenges = row.challenges ? JSON.parse(row.challenges) : [];
                        } catch (e) {
                            console.error('解析日记数据失败:', e);
                        }
                        return row;
                    });

                    resolve(diaries);
                }
            );
        });
    }

    // 获取计划模板
    getPlanTemplates() {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM plan_templates WHERE is_active = 1 ORDER BY category, name',
                (err, rows) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const templates = {};
                    rows.forEach(row => {
                        try {
                            row.fields = row.fields ? JSON.parse(row.fields) : [];
                        } catch (e) {
                            row.fields = [];
                        }
                        templates[row.name] = row;
                    });

                    resolve(templates);
                }
            );
        });
    }

    // 获取学习统计
    getLearningStats(userId) {
        return new Promise((resolve, reject) => {
            this.getUserPlans(userId)
                .then(plans => {
                    const totalPlans = plans.length;
                    const completedPlans = plans.filter(p => p.progress === 100).length;
                    const averageProgress = totalPlans > 0 ? 
                        Math.round(plans.reduce((sum, p) => sum + p.progress, 0) / totalPlans) : 0;

                    // 分析薄弱环节
                    const allWeakAreas = plans.flatMap(p => p.focus_areas || []);
                    const weakAreaCount = allWeakAreas.reduce((acc, area) => {
                        acc[area] = (acc[area] || 0) + 1;
                        return acc;
                    }, {});
                    
                    const weakAreas = Object.entries(weakAreaCount)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([area]) => area);

                    const stats = {
                        totalPlans,
                        completedPlans,
                        averageProgress,
                        completionRate: totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0,
                        weakAreas,
                        planDistribution: this.calculatePlanDistribution(plans),
                        recentActivity: this.getRecentActivity(plans)
                    };

                    resolve(stats);
                })
                .catch(reject);
        });
    }

    calculatePlanDistribution(plans) {
        const distribution = {
            vocabulary: 0,
            listening: 0,
            reading: 0,
            writing: 0,
            translation: 0,
            comprehensive: 0,
            foundation: 0,
            improvement: 0,
            advanced: 0
        };
        
        plans.forEach(plan => {
            if (distribution.hasOwnProperty(plan.type)) {
                distribution[plan.type]++;
            }
        });
        
        return distribution;
    }

    getRecentActivity(plans) {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        
        return plans.filter(plan => 
            new Date(plan.updated_at) > lastWeek
        ).length;
    }

    // 以下为AI生成相关方法（保持不变）
    generateAIDescription(stats) {
        const { studyTime, progress, weakAreas } = stats;
        let desc = "基于您的学习数据生成的个性化计划。";
        
        if (weakAreas && weakAreas.length > 0) {
            desc += ` 重点提升: ${weakAreas.join('、')}`;
        }
        
        if (progress < 50) {
            desc += " 建议加强基础学习。";
        } else if (progress >= 50 && progress < 80) {
            desc += " 稳步提升阶段，保持学习节奏。";
        } else {
            desc += " 优秀的学习进度，继续坚持！";
        }
        
        return desc;
    }

    generateAIContent(stats, focusAreas) {
        const content = {
            dailyGoals: [],
            studySchedule: [],
            keyPoints: [],
            selfAssessment: ""
        };

        if (focusAreas.length > 0) {
            content.dailyGoals = focusAreas.map(area => 
                `专注${area}领域的学习和练习`
            );
        } else {
            content.dailyGoals = ["完成基础词汇学习", "进行听力练习", "阅读一篇文章"];
        }

        const studyTime = stats.studyTime || 120;
        content.studySchedule = [
            `早晨 ${Math.floor(studyTime * 0.3)}分钟: 词汇记忆`,
            `下午 ${Math.floor(studyTime * 0.4)}分钟: 专项练习`,
            `晚上 ${Math.floor(studyTime * 0.3)}分钟: 复习巩固`
        ];

        content.keyPoints = [
            "保持每日学习习惯",
            "重点突破薄弱环节",
            "及时复习巩固知识"
        ];

        content.selfAssessment = "每日记录学习感受和收获";

        return content;
    }

    generateAIAnalysis(stats) {
        return {
            learningEfficiency: this.calculateEfficiency(stats),
            recommendationLevel: this.getRecommendationLevel(stats),
            predictedProgress: this.predictProgress(stats),
            riskAreas: this.identifyRisks(stats)
        };
    }

    calculateEfficiency(stats) {
        const { studyTime, progress } = stats;
        if (!studyTime || studyTime === 0) return "未知";
        
        const efficiency = progress / (studyTime / 60);
        if (efficiency > 2) return "优秀";
        if (efficiency > 1) return "良好";
        if (efficiency > 0.5) return "一般";
        return "需提升";
    }

    getRecommendationLevel(stats) {
        const { progress, consistency } = stats;
        if (progress > 80 && consistency > 0.8) return "高级";
        if (progress > 60 && consistency > 0.6) return "中级";
        return "初级";
    }

    predictProgress(stats) {
        const { progress, studyTime, consistency } = stats;
        const baseProgress = progress || 0;
        const dailyGrowth = (studyTime || 60) / 60 * (consistency || 0.5) * 2;
        return Math.min(100, baseProgress + dailyGrowth * 7);
    }

    identifyRisks(stats) {
        const risks = [];
        const { consistency, lastStudyDate, weakAreas } = stats;
        
        if (consistency < 0.5) risks.push("学习连续性不足");
        if (lastStudyDate) {
            const daysSinceLastStudy = (new Date() - new Date(lastStudyDate)) / (1000 * 60 * 60 * 24);
            if (daysSinceLastStudy > 3) risks.push("学习间隔过长");
        }
        if (weakAreas && weakAreas.length > 2) risks.push("薄弱环节较多");
        
        return risks;
    }

    generateRecommendations(stats) {
        const recommendations = [];
        const { progress, studyTime, weakAreas } = stats;
        
        if (progress < 30) {
            recommendations.push("建议从基础词汇和语法开始");
            recommendations.push("每日保持至少30分钟学习时间");
        } else if (progress < 60) {
            recommendations.push("加强专项练习，特别是听力阅读");
            recommendations.push("尝试模拟测试检验学习效果");
        } else {
            recommendations.push("进行真题演练，熟悉考试模式");
            recommendations.push("重点突破高分题型");
        }
        
        if (weakAreas && weakAreas.length > 0) {
            recommendations.push(`专项提升: ${weakAreas.join('、')}`);
        }
        
        if (!studyTime || studyTime < 60) {
            recommendations.push("增加每日学习时间至60分钟以上");
        }
        
        return recommendations;
    }
}

// 创建服务实例
const planService = new PlanService();

// API路由 - 修改所有路由路径，去掉 /plans 前缀
router.get('/', async (req, res) => {
    try {
        const userId = req.user?.id || 'default';
        const { filter } = req.query;
        
        const plans = await planService.getUserPlans(userId, filter);
        res.json({ success: true, data: plans });
    } catch (error) {
        console.error('获取计划失败:', error);
        res.json({ success: false, message: '获取计划失败' });
    }
});

router.post('/', async (req, res) => {
    try {
        const userId = req.user?.id || 'default';
        const planData = req.body;
        
        const newPlan = await planService.createPlan(userId, planData);
        res.json({ success: true, data: newPlan });
    } catch (error) {
        console.error('创建计划失败:', error);
        res.json({ success: false, message: '创建计划失败' });
    }
});

// 更新计划API
router.put('/:id', async (req, res) => {
    try {
        const userId = req.user?.id || 'default';
        const { id } = req.params;
        const planData = req.body;
        
        const updatedPlan = await planService.updatePlan(userId, parseInt(id), planData);
        res.json({ success: true, data: updatedPlan });
    } catch (error) {
        console.error('更新计划失败:', error);
        res.json({ success: false, message: error.message || '更新计划失败' });
    }
});

router.put('/:id/progress', async (req, res) => {
    try {
        const userId = req.user?.id || 'default';
        const { id } = req.params;
        const { progress } = req.body;
        
        const updatedPlan = await planService.updatePlanProgress(userId, parseInt(id), progress);
        res.json({ success: true, data: updatedPlan });
    } catch (error) {
        console.error('更新进度失败:', error);
        res.json({ success: false, message: error.message || '更新进度失败' });
    }
});

router.post('/:id/diary', async (req, res) => {
    try {
        const userId = req.user?.id || 'default';
        const { id } = req.params;
        const entry = req.body;
        
        const diaryEntry = await planService.addDiaryEntry(userId, parseInt(id), entry);
        res.json({ success: true, data: diaryEntry });
    } catch (error) {
        console.error('添加日记失败:', error);
        res.json({ success: false, message: '添加日记失败' });
    }
});

router.get('/:id/diaries', async (req, res) => {
    try {
        const userId = req.user?.id || 'default';
        const { id } = req.params;
        
        const diaries = await planService.getPlanDiaries(parseInt(id), userId);
        res.json({ success: true, data: diaries });
    } catch (error) {
        console.error('获取日记失败:', error);
        res.json({ success: false, message: '获取日记失败' });
    }
});

router.get('/templates', async (req, res) => {
    try {
        const templates = await planService.getPlanTemplates();
        res.json({ success: true, data: templates });
    } catch (error) {
        console.error('获取模板失败:', error);
        res.json({ success: false, message: '获取模板失败' });
    }
});

// AI生成计划路由 - 修改路径
router.post('/ai/generate', async (req, res) => {
    try {
        const userId = req.user?.id || 'default';
        const { learningStats } = req.body;
        
        const aiPlan = await planService.generateAIPlan(userId, learningStats);
        res.json({ success: true, data: aiPlan });
    } catch (error) {
        console.error('AI生成计划失败:', error);
        res.json({ success: false, message: 'AI生成计划失败: ' + error.message });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const userId = req.user?.id || 'default';
        
        const stats = await planService.getLearningStats(userId);
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('获取统计失败:', error);
        res.json({ success: false, message: '获取统计失败' });
    }
});

// 删除计划
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user?.id || 'default';
        const { id } = req.params;
        
        db.run(
            'DELETE FROM learning_plans WHERE id = ? AND user_id = ?',
            [parseInt(id), userId],
            function(err) {
                if (err) {
                    res.json({ success: false, message: '删除计划失败' });
                    return;
                }
                
                if (this.changes === 0) {
                    res.json({ success: false, message: '计划未找到' });
                    return;
                }
                
                // 同时删除相关的日记条目
                db.run('DELETE FROM plan_diary_entries WHERE plan_id = ?', [parseInt(id)]);
                
                res.json({ success: true, message: '计划删除成功' });
            }
        );
    } catch (error) {
        console.error('删除计划失败:', error);
        res.json({ success: false, message: '删除计划失败' });
    }
});

module.exports = router;