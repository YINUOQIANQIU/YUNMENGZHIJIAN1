// server_modules/init-writing-data.js
function initWritingSampleData() {
    const sampleEssays = [
        {
            exam_type: 'CET4',
            essay_type: '议论文',
            title: 'The Impact of Social Media on Interpersonal Communication',
            content: `In the digital age, social media has revolutionized the way people communicate, bringing both positive transformations and significant challenges to interpersonal relationships.

On the positive side, social media platforms have made communication more accessible and efficient. People can now maintain connections with friends and family across great distances, sharing life updates through photos, videos, and messages. This has been particularly valuable during the pandemic, when physical distancing measures made traditional communication difficult. Furthermore, social media has enabled the formation of communities based on shared interests, allowing people to connect with like-minded individuals worldwide.

However, the overuse of social media has also created barriers to meaningful communication. Many users report feeling lonely and isolated despite having hundreds of online friends. The curated nature of social media content often leads to social comparison and anxiety. Additionally, the prevalence of digital communication has eroded face-to-face interaction skills, with many young people struggling with in-person conversations.

In conclusion, while social media has undoubtedly expanded our communication capabilities, we must be mindful of its limitations. A balanced approach that combines digital tools with genuine personal interactions is essential for maintaining healthy relationships in the modern world.`,
            score: '28',
            word_count: 245,
            analysis: '本文结构清晰，采用经典的五段式结构。第一段引出话题，第二段讨论积极影响，第三段分析负面影响，第四段提出解决方案，最后一段总结。文章使用了丰富的连接词（furthermore, however, additionally, in conclusion）和高级词汇（revolutionized, accessible, prevalent, eroded）。论证充分，例子具体。',
            highlights: 'digital age, revolutionized, accessible, prevalent, eroded, balanced approach',
            tags: JSON.stringify(['社会媒体', '人际关系', '沟通技巧']),
            view_count: 0
        },
        {
            exam_type: 'CET4', 
            essay_type: '图表作文',
            title: 'Analysis of Online Learning Trends During Pandemic',
            content: `The bar chart illustrates the dramatic shift in educational methods during the COVID-19 pandemic, comparing the percentage of students using online learning platforms before and after March 2020.

According to the data, online learning adoption rates skyrocketed from a mere 15% in February 2020 to 85% by May 2020. This represents an astonishing 467% increase within just three months. The most significant growth occurred in higher education institutions, where online course enrollment reached 92% by the end of the academic year.

Several factors contributed to this rapid transition. First, government-mandated lockdowns made traditional classroom learning impossible. Second, educational institutions quickly adapted by implementing digital platforms and training teachers in online instruction methods. Third, technological advancements in video conferencing and learning management systems facilitated this transition.

While online learning provided continuity in education during the crisis, it also revealed significant challenges. The digital divide became apparent as students from low-income families struggled with inadequate internet access and devices. Additionally, many students reported difficulties with concentration and motivation in the online environment.

In summary, the pandemic served as a catalyst for digital transformation in education. The experience has demonstrated both the potential and limitations of online learning, suggesting that a hybrid approach combining online and traditional methods may be the future of education.`,
            score: '26',
            word_count: 230,
            analysis: '图表描述准确，数据引用恰当。文章结构完整，包含图表概述、数据分析、原因解释、问题讨论和结论。使用了准确的数字和百分比，语言表达专业。连接词使用恰当，逻辑清晰。',
            highlights: 'illustrates, skyrocketed, adoption rates, transition, digital divide, hybrid approach',
            tags: JSON.stringify(['在线教育', '疫情', '数据分析']),
            view_count: 0
        },
        {
            exam_type: 'CET6',
            essay_type: '议论文', 
            title: 'Artificial Intelligence and the Future of Employment',
            content: `The rapid advancement of artificial intelligence has sparked intense debate about its implications for the future of work. While some fear widespread job displacement, others envision a future where AI enhances human capabilities and creates new opportunities.

Proponents of AI emphasize its potential to eliminate repetitive and dangerous tasks, thereby improving workplace safety and efficiency. In manufacturing, AI-powered robots can work around the clock without fatigue, increasing productivity. In healthcare, AI algorithms can analyze medical images with greater accuracy than human experts, leading to earlier disease detection. Furthermore, AI is creating entirely new job categories, such as machine learning engineers and data ethicists.

However, critics point to the disruptive impact of AI on traditional employment patterns. Routine jobs in sectors like customer service, transportation, and data entry are particularly vulnerable to automation. This could exacerbate income inequality and require significant workforce retraining. The psychological impact of job insecurity cannot be overlooked, as many workers face anxiety about being replaced by machines.

A balanced perspective suggests that the future lies in human-AI collaboration rather than competition. Educational systems must adapt to equip students with skills that complement AI, such as critical thinking, creativity, and emotional intelligence. Governments and businesses should invest in lifelong learning programs to help workers transition to new roles.

In conclusion, while AI will undoubtedly transform the employment landscape, it is within our power to shape this transformation positively. By focusing on education, social safety nets, and ethical AI development, we can harness AI\'s potential while mitigating its risks.`,
            score: '29',
            word_count: 280,
            analysis: '六级水平的优秀议论文。论点全面，既讨论了AI的积极影响也分析了挑战。词汇丰富（proponents, disruptive, exacerbate, mitigate），句式多样，使用了复杂句和插入语。论证逻辑严密，例子具体且有说服力。结尾提出了建设性解决方案。',
            highlights: 'implications, proponents, disruptive, exacerbate, collaboration, mitigate',
            tags: JSON.stringify(['人工智能', '就业', '技术影响']),
            view_count: 0
        },
        {
            exam_type: 'CET6',
            essay_type: '应用文',
            title: 'A Letter to the University President About Campus Sustainability',
            content: `Dear President Johnson,

I am writing to express my concerns about environmental sustainability on our campus and to propose several concrete measures that could enhance our university\'s ecological footprint.

As an environmentally conscious student, I have noticed several areas where we could improve our sustainability practices. Firstly, our campus generates substantial amounts of single-use plastic waste, particularly from dining facilities and vending machines. Secondly, many buildings lack adequate recycling facilities, leading to contamination of recyclable materials. Thirdly, energy consumption remains high due to outdated lighting and heating systems in some older buildings.

To address these issues, I would like to propose the following initiatives:

1. Phase out single-use plastics in all campus dining facilities by introducing reusable containers and implementing a deposit system.
2. Install comprehensive recycling stations throughout campus with clear signage to educate users about proper waste sorting.
3. Conduct an energy audit of all campus buildings and prioritize upgrades to energy-efficient systems.
4. Establish a student-led sustainability committee to monitor progress and propose additional improvements.

These measures would not only reduce our environmental impact but also position our university as a leader in campus sustainability. Furthermore, they would provide valuable learning opportunities for students interested in environmental management.

I would be delighted to discuss these proposals further and assist in their implementation. Thank you for considering my suggestions.

Yours sincerely,
[Your Name]
Environmental Science Major`,
            score: '27',
            word_count: 265,
            analysis: '格式规范的应用文，符合书信写作要求。开篇表明目的，中间分段提出具体问题和解决方案，结尾礼貌请求考虑。语言正式得体，使用了恰当的礼貌用语和专业术语。建议具体可行，体现了批判性思维和解决问题的能力。',
            highlights: 'sustainability, ecological footprint, phase out, comprehensive, energy audit',
            tags: JSON.stringify(['校园环保', '建议信', '可持续发展']),
            view_count: 0
        }
    ];

    sampleEssays.forEach(essay => {
        const query = `
            INSERT OR IGNORE INTO writing_sample_essays 
            (exam_type, essay_type, title, content, score, word_count, analysis, highlights, tags, view_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(query, [
            essay.exam_type,
            essay.essay_type,
            essay.title,
            essay.content,
            essay.score,
            essay.word_count,
            essay.analysis,
            essay.highlights,
            essay.tags,
            essay.view_count
        ], (err) => {
            if (err) {
                console.error('插入范文失败:', err);
            } else {
                console.log(`范文已创建: ${essay.title}`);
            }
        });
    });

    // 插入更多写作题目
    const writingQuestions = [
        {
            exam_type: 'CET4',
            question_type: '议论文',
            title: 'Should University Education Be Free for All Students?',
            content: 'There is an ongoing debate about whether university education should be free for all students. Some argue that free education would promote social equality, while others believe it would place too much financial burden on taxpayers.',
            requirements: '1. Discuss the potential benefits of free university education\n2. Analyze the possible drawbacks\n3. Present your own viewpoint with supporting arguments',
            word_limit: 150,
            time_limit: 30,
            difficulty: 'medium',
            tags: JSON.stringify(['教育公平', '大学教育', '社会政策'])
        },
        {
            exam_type: 'CET4',
            question_type: '图表作文', 
            title: 'Changes in Reading Habits Among Young People',
            content: 'Write a report based on the chart showing the changes in reading habits among young people (aged 15-25) from 2010 to 2020. The chart compares the percentage of time spent on digital reading versus traditional book reading.',
            requirements: '1. Describe the main trends shown in the chart\n2. Analyze possible reasons for these changes\n3. Discuss the implications of these trends',
            word_limit: 150,
            time_limit: 30,
            difficulty: 'medium',
            tags: JSON.stringify(['阅读习惯', '数字阅读', '年轻人'])
        },
        {
            exam_type: 'CET6',
            question_type: '议论文',
            title: 'The Ethical Implications of Genetic Engineering',
            content: 'Advances in genetic engineering have raised important ethical questions about the boundaries of scientific intervention in human life. While these technologies offer potential medical benefits, they also pose significant moral dilemmas.',
            requirements: '1. Examine the ethical concerns surrounding genetic engineering\n2. Discuss potential benefits in medicine and agriculture\n3. Present a balanced argument about appropriate regulations',
            word_limit: 180,
            time_limit: 30,
            difficulty: 'hard',
            tags: JSON.stringify(['基因工程', '伦理问题', '科学技术'])
        }
    ];

    writingQuestions.forEach(question => {
        const query = `
            INSERT OR IGNORE INTO writing_questions 
            (exam_type, question_type, title, content, requirements, word_limit, time_limit, difficulty, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(query, [
            question.exam_type,
            question.question_type,
            question.title,
            question.content,
            question.requirements,
            question.word_limit,
            question.time_limit,
            question.difficulty,
            question.tags
        ], (err) => {
            if (err) {
                console.error('插入写作题目失败:', err);
            } else {
                console.log(`写作题目已创建: ${question.title}`);
            }
        });
    });
}

// 在数据库初始化时调用
module.exports = { initWritingSampleData };