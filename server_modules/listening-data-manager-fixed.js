const { db } = require('./database');
const fs = require('fs');
const path = require('path');

class ListeningDataManagerFixed {
    constructor() {
        this.baseURL = process.env.BASE_URL || 'http://localhost:3000';
    }

    // 修复JSON解析方法
    async parseJSONData(filePath) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const jsonData = JSON.parse(data);
            
            console.log('📄 解析的JSON数据结构:', Object.keys(jsonData));
            
            // 处理多种可能的JSON格式
            if (jsonData.exam_papers) {
                console.log('✅ 识别为exam_papers格式');
                return this.processExamPapersFormat(jsonData);
            } else if (jsonData.papers) {
                console.log('✅ 识别为papers格式');
                return this.processPapersFormat(jsonData);
            } else if (Array.isArray(jsonData)) {
                console.log('✅ 识别为数组格式');
                return this.processArrayFormat(jsonData);
            } else if (jsonData.listening_papers) {
                console.log('✅ 识别为listening_papers格式');
                return this.processListeningPapersFormat(jsonData);
            } else {
                console.log('❌ 无法识别的数据格式，尝试通用解析');
                return this.processGenericFormat(jsonData);
            }
        } catch (error) {
            console.error('❌ JSON解析错误:', error);
            throw new Error(`JSON解析失败: ${error.message}`);
        }
    }

    processExamPapersFormat(data) {
        const papers = data.exam_papers || [];
        const questions = [];
        
        papers.forEach(paper => {
            if (paper.questions && Array.isArray(paper.questions)) {
                paper.questions.forEach(q => {
                    questions.push({
                        paper_id: paper.id,
                        ...q
                    });
                });
            }
        });
        
        return { papers, questions };
    }

    processPapersFormat(data) {
        const papers = data.papers || [];
        const questions = [];
        
        papers.forEach(paper => {
            if (paper.questions && Array.isArray(paper.questions)) {
                paper.questions.forEach(q => {
                    questions.push({
                        paper_id: paper.id,
                        ...q
                    });
                });
            }
        });
        
        return { papers, questions };
    }

    processArrayFormat(data) {
        // 假设数组中的每个元素都是试卷
        const papers = data.filter(item => item.title && item.exam_type);
        const questions = [];
        
        papers.forEach(paper => {
            if (paper.questions && Array.isArray(paper.questions)) {
                paper.questions.forEach(q => {
                    questions.push({
                        paper_id: paper.id,
                        ...q
                    });
                });
            }
        });
        
        return { papers, questions };
    }

    processListeningPapersFormat(data) {
        const papers = data.listening_papers || [];
        const questions = [];
        
        papers.forEach(paper => {
            if (paper.questions && Array.isArray(paper.questions)) {
                paper.questions.forEach(q => {
                    questions.push({
                        paper_id: paper.id,
                        ...q
                    });
                });
            }
        });
        
        return { papers, questions };
    }

    processGenericFormat(data) {
        // 尝试从对象中提取试卷和题目
        const papers = [];
        const questions = [];
        
        Object.keys(data).forEach(key => {
            const item = data[key];
            if (item && typeof item === 'object') {
                if (item.title && item.exam_type) {
                    papers.push(item);
                }
                if (Array.isArray(item) && item.length > 0 && item[0].question_text) {
                    questions.push(...item);
                }
            }
        });
        
        return { papers, questions };
    }

    // 生成21-25年静态数据
    generateStaticListeningData() {
        const papers = [];
        const questions = [];
        
        const years = [2021, 2022, 2023, 2024, 2025];
        const months = [6, 12]; // 6月和12月考试
        
        let paperId = 1;
        let questionId = 1;
        
        years.forEach(year => {
            months.forEach(month => {
                // 四级试卷
                const cet4Paper = {
                    id: paperId++,
                    exam_type: 'CET-4',
                    year: year,
                    month: month,
                    paper_number: 1,
                    title: `${year}年${month}月大学英语四级考试听力真题`,
                    description: `大学英语四级${year}年${month}月听力部分`,
                    audio_file: `cet4_${year}_${month.toString().padStart(2, '0')}_1.mp3`,
                    audio_url: `/四级听力/cet4_${year}_${month.toString().padStart(2, '0')}_1.mp3`,
                    total_questions: 25,
                    difficulty: 'medium',
                    is_active: 1,
                    created_at: new Date().toISOString()
                };
                papers.push(cet4Paper);
                
                // 六级试卷
                const cet6Paper = {
                    id: paperId++,
                    exam_type: 'CET-6',
                    year: year,
                    month: month,
                    paper_number: 1,
                    title: `${year}年${month}月大学英语六级考试听力真题`,
                    description: `大学英语六级${year}年${month}月听力部分`,
                    audio_file: `cet6_${year}_${month.toString().padStart(2, '0')}_1.mp3`,
                    audio_url: `/六级听力/cet6_${year}_${month.toString().padStart(2, '0')}_1.mp3`,
                    total_questions: 25,
                    difficulty: 'hard',
                    is_active: 1,
                    created_at: new Date().toISOString()
                };
                papers.push(cet6Paper);
                
                // 为每套试卷生成题目
                [cet4Paper, cet6Paper].forEach(paper => {
                    // 短对话 (8题)
                    for (let i = 1; i <= 8; i++) {
                        questions.push(this.createShortConversationQuestion(questionId++, paper.id, i));
                    }
                    
                    // 长对话 (7题)
                    for (let i = 9; i <= 15; i++) {
                        questions.push(this.createLongConversationQuestion(questionId++, paper.id, i));
                    }
                    
                    // 短文理解 (10题)
                    for (let i = 16; i <= 25; i++) {
                        questions.push(this.createPassageQuestion(questionId++, paper.id, i));
                    }
                });
            });
        });
        
        return { papers, questions };
    }

    createShortConversationQuestion(id, paperId, number) {
        const options = ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'];
        return {
            id: id,
            paper_id: paperId,
            question_number: number,
            section_type: 'short',
            question_text: `这是第${number}题短对话的问题内容`,
            options: JSON.stringify(options),
            correct_answer: 'A',
            explanation: '这是题目的解析和说明',
            sort_order: number,
            score: 1,
            audio_start: (number - 1) * 10,
            audio_end: number * 10,
            created_at: new Date().toISOString()
        };
    }

    createLongConversationQuestion(id, paperId, number) {
        const options = ['A. 长对话选项A', 'B. 长对话选项B', 'C. 长对话选项C', 'D. 长对话选项D'];
        return {
            id: id,
            paper_id: paperId,
            question_number: number,
            section_type: 'long',
            question_text: `这是第${number}题长对话的问题内容`,
            options: JSON.stringify(options),
            correct_answer: 'B',
            explanation: '这是长对话题目的解析和说明',
            sort_order: number,
            score: 1,
            audio_start: 80 + (number - 9) * 15,
            audio_end: 80 + (number - 8) * 15,
            created_at: new Date().toISOString()
        };
    }

    createPassageQuestion(id, paperId, number) {
        const options = ['A. 短文选项A', 'B. 短文选项B', 'C. 短文选项C', 'D. 短文选项D'];
        return {
            id: id,
            paper_id: paperId,
            question_number: number,
            section_type: 'passage',
            question_text: `这是第${number}题短文理解的问题内容`,
            options: JSON.stringify(options),
            correct_answer: 'C',
            explanation: '这是短文理解题目的解析和说明',
            sort_order: number,
            score: 1,
            audio_start: 200 + (number - 16) * 20,
            audio_end: 200 + (number - 15) * 20,
            created_at: new Date().toISOString()
        };
    }

    // 初始化静态数据到数据库
    async initializeStaticData() {
        try {
            console.log('🎯 开始初始化静态听力数据...');
            
            const { papers, questions } = this.generateStaticListeningData();
            
            // 清空现有数据
            await this.clearExistingData();
            
            // 插入试卷数据
            for (const paper of papers) {
                await this.insertPaper(paper);
            }
            
            // 插入题目数据
            for (const question of questions) {
                await this.insertQuestion(question);
            }
            
            console.log(`✅ 静态数据初始化完成: ${papers.length}套试卷, ${questions.length}道题目`);
            
            return {
                success: true,
                papers: papers.length,
                questions: questions.length,
                message: '静态听力数据初始化成功'
            };
        } catch (error) {
            console.error('❌ 静态数据初始化失败:', error);
            return {
                success: false,
                message: `初始化失败: ${error.message}`
            };
        }
    }

    async clearExistingData() {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('DELETE FROM listening_exam_questions', (err) => {
                    if (err) console.error('清理题目表失败:', err);
                });
                db.run('DELETE FROM listening_exam_papers', (err) => {
                    if (err) console.error('清理试卷表失败:', err);
                    resolve();
                });
            });
        });
    }

    async insertPaper(paper) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT OR REPLACE INTO listening_exam_papers 
                (id, exam_type, year, month, paper_number, title, description, 
                 audio_file, audio_url, total_questions, difficulty, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            db.run(query, [
                paper.id, paper.exam_type, paper.year, paper.month, paper.paper_number,
                paper.title, paper.description, paper.audio_file, paper.audio_url,
                paper.total_questions, paper.difficulty, paper.is_active, paper.created_at
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async insertQuestion(question) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT OR REPLACE INTO listening_exam_questions 
                (id, paper_id, question_number, section_type, question_text, 
                 options, correct_answer, explanation, sort_order, score, 
                 audio_start, audio_end, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            db.run(query, [
                question.id, question.paper_id, question.question_number, question.section_type,
                question.question_text, question.options, question.correct_answer,
                question.explanation, question.sort_order, question.score,
                question.audio_start, question.audio_end, question.created_at
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    // 获取所有静态试卷
    async getAllStaticPapers() {
        const { papers } = this.generateStaticListeningData();
        return papers;
    }

    // 获取静态试卷详情
    async getStaticPaperDetail(paperId) {
        const { papers, questions } = this.generateStaticListeningData();
        const paper = papers.find(p => p.id == paperId);
        
        if (!paper) {
            throw new Error('试卷不存在');
        }
        
        const paperQuestions = questions.filter(q => q.paper_id == paperId);
        
        // 按section分类题目
        const sections = this.groupQuestionsBySection(paperQuestions);
        
        return {
            paper: paper,
            questions: paperQuestions,
            sections: sections
        };
    }

    groupQuestionsBySection(questions) {
        const sections = {};
        
        questions.forEach(question => {
            const sectionType = question.section_type || 'short';
            if (!sections[sectionType]) {
                sections[sectionType] = {
                    id: sectionType,
                    name: this.getSectionName(sectionType),
                    title: this.getSectionTitle(sectionType),
                    questions: [],
                    audio_type: sectionType
                };
            }
            sections[sectionType].questions.push(question);
        });
        
        return Object.values(sections);
    }

    getSectionName(sectionType) {
        const names = {
            'short': '短对话',
            'long': '长对话', 
            'passage': '短文理解',
            'lecture': '讲座听力'
        };
        return names[sectionType] || '听力';
    }

    getSectionTitle(sectionType) {
        const titles = {
            'short': 'Section A: Short Conversations',
            'long': 'Section B: Long Conversations',
            'passage': 'Section C: Passages', 
            'lecture': 'Section D: Lectures/Talks'
        };
        return titles[sectionType] || 'Listening Comprehension';
    }
}

module.exports = ListeningDataManagerFixed;