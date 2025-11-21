// [file name]: js/assessment-utils.js
window.assessmentQuestions = {
    // 获取所有维度
    getAllDimensions() {
        return ['vocabulary', 'grammar', 'reading', 'translation'];
    },
    
    // 获取测试配置
    getTestConfig(examType) {
        const configs = {
            CET4: {
                totalTime: 1800,
                dimensions: {
                    vocabulary: { count: 5, time: 300 },
                    grammar: { count: 5, time: 300 },
                    reading: { count: 5, time: 600 },
                    translation: { count: 5, time: 600 }
                }
            },
            CET6: {
                totalTime: 2100,
                dimensions: {
                    vocabulary: { count: 5, time: 300 },
                    grammar: { count: 5, time: 300 },
                    reading: { count: 5, time: 600 },
                    translation: { count: 5, time: 900 }
                }
            }
        };
        return configs[examType] || configs.CET4;
    },
    
    // 获取题目 - 修改为从本地获取
    async getQuestions(examType, dimension) {
        try {
            // 直接从本地数据获取
            if (window.localQuestions && window.localQuestions[examType] && window.localQuestions[examType][dimension]) {
                return window.localQuestions[examType][dimension];
            }
            
            // 备用：返回空数组
            console.warn(`未找到本地题目: ${examType} - ${dimension}`);
            return [];
            
        } catch (error) {
            console.error('获取题目失败:', error);
            return [];
        }
    }
};