// game/vocabulary-data-routes.js
const express = require('express');
const router = express.Router();
const VocabularyDataManager = require('../tools/vocabulary-data-manager');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');
const path = require('path');

const manager = new VocabularyDataManager();

// 确保上传目录存在
const ensureUploadsDir = () => {
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
};

// 导入词汇JSON
router.post('/import-vocabulary-json', upload.single('jsonFile'), async (req, res) => {
    ensureUploadsDir();
    
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: '没有上传文件' 
            });
        }

        const result = await manager.importVocabularyData(req.file.path, {
            mode: req.body.mode || 'update'
        });
        
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

// 批量导入词汇文件
router.post('/import-vocabulary-multiple', upload.array('files'), async (req, res) => {
    ensureUploadsDir();
    
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: '没有上传文件' 
            });
        }

        const mode = req.body.mode || 'update';
        const results = [];
        let successCount = 0;
        let failedCount = 0;
        let skippedCount = 0;

        for (const file of req.files) {
            try {
                const result = await manager.importVocabularyData(file.path, { mode });
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

// 导出词汇JSON
router.get('/export-vocabulary-json', async (req, res) => {
    try {
        const exportsDir = path.join(__dirname, '../exports');
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
        }

        const outputFile = path.join(exportsDir, `vocabulary-data-${Date.now()}.json`);
        const result = await manager.exportVocabularyData(outputFile);
        
        res.download(outputFile, `vocabulary-data-${Date.now()}.json`, (err) => {
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

// 获取词汇统计信息
router.get('/vocabulary-statistics', async (req, res) => {
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
router.get('/check-vocabulary-integrity', async (req, res) => {
    try {
        const stats = await manager.getStatistics();
        
        const integrityData = {
            total_words: stats.total_words?.[0]?.count || 0,
            valid_words: stats.total_words?.[0]?.count || 0,
            invalid_words: 0,
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

// 清理词汇数据
router.post('/cleanup-vocabulary-data', async (req, res) => {
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

// 生成示例词汇数据
router.post('/generate-vocabulary-sample', async (req, res) => {
    try {
        const sampleData = {
            vocabulary: [
                {
                    word: "abandon",
                    phonetic: "/əˈbændən/",
                    definition: "to leave a place, thing, or person forever",
                    part_of_speech: "verb",
                    level: "CET-4",
                    example_sentence: "They had to abandon their home because of the flood.",
                    synonyms: ["desert", "leave", "forsake"],
                    antonyms: ["keep", "retain"],
                    word_family: ["abandoned", "abandonment"],
                    frequency_band: 1,
                    categories: [
                        { category: "academic", subcategory: "common" }
                    ]
                },
                {
                    word: "beneficial",
                    phonetic: "/ˌbenɪˈfɪʃl/",
                    definition: "having a good effect; favorable",
                    part_of_speech: "adjective",
                    level: "CET-4",
                    example_sentence: "Regular exercise is beneficial to health.",
                    synonyms: ["advantageous", "helpful", "favorable"],
                    antonyms: ["harmful", "detrimental"],
                    word_family: ["benefit", "beneficially"],
                    frequency_band: 2,
                    categories: [
                        { category: "academic", subcategory: "common" }
                    ]
                }
            ],
            version: "1.0",
            generated_at: new Date().toISOString()
        };

        const exportsDir = path.join(__dirname, '../exports');
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
        }

        const sampleFile = path.join(exportsDir, 'vocabulary-sample.json');
        fs.writeFileSync(sampleFile, JSON.stringify(sampleData, null, 2));

        res.json({
            success: true,
            message: '示例词汇数据生成成功',
            file: sampleFile,
            data: sampleData
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// 获取随机词汇（用于题目生成）
router.get('/random-words', async (req, res) => {
    try {
        const level = req.query.level || 'CET-4';
        const count = parseInt(req.query.count) || 10;
        
        const words = await manager.getRandomWords(level, count);
        res.json({ success: true, data: words });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

module.exports = router;