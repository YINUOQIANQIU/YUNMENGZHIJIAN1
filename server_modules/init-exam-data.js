// [file name]: init-exam-data.js
const db = require('./database.js');

// 初始化考试数据
function initExamData() {
    console.log('🎯 开始初始化考试数据...');
    
    // 插入示例考试试卷
    const samplePapers = [
        {
            exam_type: 'CET-4',
            year: 2023,
            month: 6,
            paper_number: 1,
            title: '2023年6月大学英语四级考试真题（第一套）',
            description: '包含听力、阅读、写作等完整题型',
            total_score: 710,
            time_allowed: 125,
            sections_count: 4,
            questions_count: 57,
            is_active: 1
        },
        {
            exam_type: 'CET-4',
            year: 2022,
            month: 12,
            paper_number: 1,
            title: '2022年12月大学英语四级考试真题（第一套）',
            description: '完整四级考试真题',
            total_score: 710,
            time_allowed: 125,
            sections_count: 4,
            questions_count: 57,
            is_active: 1
        },
        {
            exam_type: 'CET-6',
            year: 2023,
            month: 6,
            paper_number: 1,
            title: '2023年6月大学英语六级考试真题（第一套）',
            description: '包含听力、阅读、写作等完整题型',
            total_score: 710,
            time_allowed: 130,
            sections_count: 4,
            questions_count: 57,
            is_active: 1
        }
    ];

    samplePapers.forEach(paper => {
        db.db.run(`
            INSERT OR IGNORE INTO exam_papers 
            (exam_type, year, month, paper_number, title, description, total_score, time_allowed, sections_count, questions_count, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            paper.exam_type, paper.year, paper.month, paper.paper_number, 
            paper.title, paper.description, paper.total_score, paper.time_allowed,
            paper.sections_count, paper.questions_count, paper.is_active
        ], function(err) {
            if (err) {
                console.error('插入试卷失败:', err.message);
            } else if (this.lastID) {
                console.log(`✅ 插入试卷: ${paper.title}`);
                insertSampleSections(this.lastID, paper.exam_type);
            }
        });
    });
}

// 插入示例部分
function insertSampleSections(paperId, examType) {
    const sections = [
        {
            paper_id: paperId,
            section_type: 'listening',
            section_name: '听力理解',
            section_order: 1,
            time_allowed: '25分钟',
            directions: '本部分测试理解英语听力材料的能力。',
            questions_count: 25
        },
        {
            paper_id: paperId,
            section_type: 'reading',
            section_name: '阅读理解',
            section_order: 2,
            time_allowed: '40分钟',
            directions: '本部分测试阅读理解能力。',
            questions_count: 30
        },
        {
            paper_id: paperId,
            section_type: 'writing',
            section_name: '写作',
            section_order: 3,
            time_allowed: '30分钟',
            directions: '本部分测试英语写作能力。',
            questions_count: 1
        },
        {
            paper_id: paperId,
            section_type: 'translation',
            section_name: '翻译',
            section_order: 4,
            time_allowed: '30分钟',
            directions: '本部分测试汉译英能力。',
            questions_count: 1
        }
    ];

    sections.forEach(section => {
        db.db.run(`
            INSERT OR IGNORE INTO exam_sections 
            (paper_id, section_type, section_name, section_order, time_allowed, directions, questions_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            section.paper_id, section.section_type, section.section_name, 
            section.section_order, section.time_allowed, section.directions, 
            section.questions_count
        ], function(err) {
            if (err) {
                console.error('插入部分失败:', err.message);
            } else if (this.lastID) {
                console.log(`   ✅ 插入部分: ${section.section_name}`);
                insertSampleQuestions(this.lastID, section.section_type, examType);
            }
        });
    });
}

// 插入示例题目
function insertSampleQuestions(sectionId, sectionType, examType) {
    let questions = [];
    
    if (sectionType === 'listening') {
        questions = [
            {
                section_id: sectionId,
                question_type: 'single_choice',
                question_number: 1,
                question_text: 'What does the woman mean?',
                options: JSON.stringify(['A. She agrees with the man', 'B. She disagrees with the man', 'C. She is not sure', 'D. She wants to change the topic']),
                correct_answer: 'A',
                score: 1,
                question_order: 1
            },
            {
                section_id: sectionId,
                question_type: 'single_choice',
                question_number: 2,
                question_text: 'Where does this conversation most probably take place?',
                options: JSON.stringify(['A. In a restaurant', 'B. In a library', 'C. At an airport', 'D. In a hotel']),
                correct_answer: 'C',
                score: 1,
                question_order: 2
            }
        ];
    } else if (sectionType === 'reading') {
        questions = [
            {
                section_id: sectionId,
                question_type: 'single_choice',
                question_number: 26,
                question_text: 'What is the main idea of the passage?',
                options: JSON.stringify(['A. The importance of education', 'B. The benefits of exercise', 'C. The impact of technology', 'D. The value of friendship']),
                correct_answer: 'C',
                score: 2,
                question_order: 1
            }
        ];
    } else if (sectionType === 'writing') {
        questions = [
            {
                section_id: sectionId,
                question_type: 'essay',
                question_number: 57,
                question_text: 'Write an essay on the topic: The Importance of Learning English',
                options: null,
                correct_answer: '',
                score: 106,
                question_order: 1
            }
        ];
    }

    questions.forEach(question => {
        db.db.run(`
            INSERT OR IGNORE INTO exam_questions 
            (section_id, question_type, question_number, question_text, options, correct_answer, score, question_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            question.section_id, question.question_type, question.question_number,
            question.question_text, question.options, question.correct_answer,
            question.score, question.question_order
        ], function(err) {
            if (err) {
                console.error('插入题目失败:', err.message);
            } else {
                console.log(`      ✅ 插入题目: ${question.question_text.substring(0, 30)}...`);
            }
        });
    });
}

// 检查并初始化考试数据
function checkAndInitExamData() {
    db.db.get('SELECT COUNT(*) as count FROM exam_papers WHERE is_active = 1', (err, result) => {
        if (err) {
            console.error('检查考试数据失败:', err);
            return;
        }
        
        if (result.count === 0) {
            console.log('📝 考试数据为空，开始初始化...');
            initExamData();
        } else {
            console.log(`📊 现有考试试卷: ${result.count} 套`);
        }
    });
}

module.exports = {
    initExamData,
    checkAndInitExamData
};