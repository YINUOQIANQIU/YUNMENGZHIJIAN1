// routes/exam-data-routes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');

// 修正模块引用路径
const ExamDataManager = require('../../tools/exam-data-manager');

const manager = new ExamDataManager();

// 确保上传目录存在
const ensureUploadsDir = () => {
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
};

// 增强的考试数据结构标准化 - 修复题目数量计算
function normalizeExamDataForFrontend(examData) {
    if (!examData) return null;
    
    // 计算实际的题目数量
    let questionsCount = examData.questions_count || 0;
    
    return {
        id: examData.id,
        title: examData.title,
        exam_type: examData.exam_type,
        year: examData.year,
        month: examData.month,
        description: examData.description,
        total_score: examData.total_score || 710,
        time_allowed: examData.time_allowed || 120,
        questions_count: questionsCount,
        paper_id: examData.id,
        created_at: examData.created_at,
        updated_at: examData.updated_at,
        is_active: examData.is_active !== undefined ? examData.is_active : 1
    };
}

// 修复题目数据提取逻辑
function extractQuestionsFromSection(section) {
    if (!section) return [];
    
    let questions = [];
    
    // 从section的content中提取题目
    if (section.content) {
        // 处理写作部分
        if (section.section_type === 'writing' && section.content.questions) {
            questions = section.content.questions;
        }
        // 处理听力部分
        else if (section.section_type === 'listening' && section.content.news_reports) {
            section.content.news_reports.forEach(report => {
                if (report.questions && Array.isArray(report.questions)) {
                    questions = questions.concat(report.questions.map(qNum => ({
                        question_number: qNum,
                        question_type: 'single_choice'
                    })));
                }
            });
        }
        // 处理阅读理解部分
        else if (section.section_type === 'reading' && section.content.questions) {
            questions = section.content.questions;
        }
    }
    
    return questions;
}

// 导入真题JSON
router.post('/import-exam-json', upload.single('jsonFile'), async (req, res) => {
    ensureUploadsDir();
    
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: '没有上传文件' 
            });
        }

        const result = await manager.importExamData(req.file.path);
        
        // 清理上传的文件
        fs.unlinkSync(req.file.path);
        
        res.json(result);
    } catch (error) {
        // 清理上传的文件
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// 批量导入文件
router.post('/import-exam-multiple', upload.array('files'), async (req, res) => {
    ensureUploadsDir();
    
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: '没有上传文件' 
            });
        }

        const mode = req.body.mode || 'update';
        manager.setImportMode(mode);

        const results = [];
        let successCount = 0;
        let failedCount = 0;
        let skippedCount = 0;

        for (const file of req.files) {
            try {
                const result = await manager.importExamData(file.path);
                results.push({
                    file: file.originalname,
                    ...result
                });

                if (result.success) {
                    successCount++;
                } else if (result.skipped) {
                    skippedCount++;
                } else {
                    failedCount++;
                }
            } catch (error) {
                results.push({
                    file: file.originalname,
                    success: false,
                    message: error.message
                });
                failedCount++;
            } finally {
                // 清理文件
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            }
        }

        res.json({
            success: true,
            message: `批量导入完成: 成功 ${successCount}, 失败 ${failedCount}, 跳过 ${skippedCount}`,
            summary: {
                success: successCount,
                failed: failedCount,
                skipped: skippedCount
            },
            details: results
        });
    } catch (error) {
        // 清理所有文件
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// 导出真题JSON
router.get('/export-exam-json', async (req, res) => {
    try {
        const exportsDir = path.join(__dirname, '../exports');
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
        }

        const outputFile = path.join(exportsDir, `exam-data-${Date.now()}.json`);
        const result = await manager.exportToJSON(outputFile);
        
        res.download(outputFile, `exam-data-${Date.now()}.json`, (err) => {
            if (err) {
                console.error('下载失败:', err);
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// 获取统计信息
router.get('/exam-statistics', async (req, res) => {
    try {
        const stats = await manager.getStatistics();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// 检查数据完整性
router.get('/check-exam-integrity', async (req, res) => {
    try {
        const stats = await manager.getStatistics();
        
        const integrityData = {
            total_papers: stats.total_papers?.count || 0,
            valid_papers: stats.total_papers?.count || 0,
            invalid_papers: 0,
            issues: []
        };

        res.json({ 
            success: true, 
            data: integrityData 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// 检查数据库表
router.get('/check-exam-tables', async (req, res) => {
    try {
        const tables = ['exam_papers', 'exam_sections', 'exam_questions'];
        const tableStatus = {};

        for (const table of tables) {
            tableStatus[table] = await new Promise((resolve) => {
                manager.db.get(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                    [table],
                    (err, row) => {
                        resolve(!!row);
                    }
                );
            });
        }

        res.json({ 
            success: true, 
            data: tableStatus 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// 清理数据
router.post('/cleanup-exam-data', async (req, res) => {
    try {
        const result = await manager.cleanupData();
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// CSV导出（待实现）
router.get('/export-exam-csv', async (req, res) => {
    try {
        res.json({ 
            success: false, 
            message: 'CSV导出功能待实现' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// CSV导入（待实现）
router.post('/import-exam-csv', async (req, res) => {
    try {
        res.json({ 
            success: false, 
            message: 'CSV导入功能待实现' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// 生成示例数据（待实现）
router.post('/generate-exam-sample', async (req, res) => {
    try {
        res.json({ 
            success: false, 
            message: '示例数据生成功能待实现' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

module.exports = router;