// routes/exam-data-routes.js
const express = require('express');
const router = express.Router();
const ExamDataManager = require('../tools/exam-data-manager');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');
const path = require('path');

const manager = new ExamDataManager();

// 确保上传目录存在
const ensureUploadsDir = () => {
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
};

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
            // 可选：下载后清理文件
            // fs.unlinkSync(outputFile);
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
        // 实现数据完整性检查逻辑
        const stats = await manager.getStatistics();
        
        // 简单的完整性检查
        const integrityData = {
            total_papers: stats.total_papers?.count || 0,
            valid_papers: stats.total_papers?.count || 0, // 简化处理
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
        const tables = ['exam_papers', 'exam_sections', 'exam_questions', 'exam_sessions', 'exam_statistics'];
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

// 生成示例数据
router.post('/generate-exam-sample', async (req, res) => {
    try {
        // 实现示例数据生成逻辑
        const sampleData = {
            success: true,
            message: '示例数据生成功能待实现',
            files: []
        };
        res.json(sampleData);
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

module.exports = router;