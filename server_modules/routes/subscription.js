// [file name]: server_modules/routes/subscription.js
const express = require('express');
const router = express.Router();

// 获取订阅计划列表
router.get('/plans', async (req, res) => {
    try {
        const subscriptionPlans = [
    {
        id: 1,
        name: '基础版',
        tagline: '适合尝鲜用户',
        duration: 1,
        duration_unit: 'month',
        original_price: 49,
        current_price: 29, // 引入入门优惠
        discount: 41,
        monthly_equivalent: 29, // 突出月均费用
        features: [
            '每日30次 AI 对话',
            '基础学习计划',
            '标准客服支持',
            '基础词汇库',
            '基础学习分析'
        ],
        popular: false,
        recommended: false,
        cta_text: '开始体验',
        limit_notice: '适合轻度使用'
    },
    {
        id: 2,
        name: '专业版',
        tagline: '最受学员欢迎',
        duration: 12,
        duration_unit: 'month',
        original_price: 588,
        current_price: 399,
        discount: 32,
        monthly_equivalent: 33.25, // 强调性价比
        features: [
            '无限次 AI 对话 ✓',
            '智能学习规划 ✓',
            '优先客服支持 ✓',
            '完整词汇库 ✓',
            '高级学习分析 ✓',
            '学习进度追踪 ✓',
            'AI作文批改 ✓',
            '专属学习报告'
        ],
        popular: true,
        recommended: true,
        cta_text: '选择专业版',
        best_value: true,
        savings: '省189元' // 突出节省金额
    },
    {
        id: 3,
        name: '尊享版',
        tagline: '极致学习体验',
        duration: 36,
        duration_unit: 'month',
        original_price: 1764,
        current_price: 999,
        discount: 43,
        monthly_equivalent: 27.75, // 最低月均费用
        features: [
            '无限次 AI 对话 ✓',
            '智能学习规划 ✓',
            '24小时专属客服 ✓',
            '完整词汇库 ✓',
            '高级学习分析 ✓',
            '学习进度追踪 ✓',
            'AI作文批改 ✓',
            '专属学习报告 ✓',
            '专属学习顾问',
            '优先新功能体验',
            '个性化学习路径'
        ],
        popular: false,
        recommended: false,
        cta_text: '选择尊享版',
        savings: '省765元',
        limited_offer: true // 营造稀缺感
    }
];

        res.json({
            success: true,
            data: subscriptionPlans
        });
    } catch (error) {
        console.error('获取订阅计划失败:', error);
        res.json({ success: false, message: '获取订阅计划失败' });
    }
});

// 创建订阅订单
router.post('/create-order', async (req, res) => {
    try {
        const { plan_id, payment_method } = req.body;
        const user_id = req.user.id;

        // 生成订单号
        const order_id = `SUB${Date.now()}${Math.random().toString(36).substr(2, 9)}`.toUpperCase();

        // 获取订阅计划信息
        const plans = await getSubscriptionPlans();
        const plan = plans.find(p => p.id === plan_id);

        if (!plan) {
            return res.json({ success: false, message: '订阅计划不存在' });
        }

        const order = {
            id: order_id,
            user_id: user_id,
            plan_id: plan_id,
            plan_name: plan.name,
            amount: plan.current_price,
            status: 'pending',
            payment_method: payment_method,
            created_at: new Date().toISOString(),
            expires_at: calculateExpiryDate(plan.duration, plan.duration_unit)
        };

        // 这里应该将订单保存到数据库
        // await saveOrderToDatabase(order);

        res.json({
            success: true,
            data: {
                order: order,
                payment_data: generatePaymentData(order, payment_method)
            }
        });
    } catch (error) {
        console.error('创建订阅订单失败:', error);
        res.json({ success: false, message: '创建订单失败' });
    }
});

// 检查订阅状态
router.get('/status', async (req, res) => {
    try {
        const user_id = req.user.id;
        
        // 这里应该从数据库获取用户订阅状态
        const subscription = {
            is_active: false,
            current_plan: null,
            expiry_date: null,
            auto_renew: false
        };

        res.json({
            success: true,
            data: subscription
        });
    } catch (error) {
        console.error('检查订阅状态失败:', error);
        res.json({ success: false, message: '检查订阅状态失败' });
    }
});

// 辅助函数
function calculateExpiryDate(duration, unit) {
    const date = new Date();
    switch (unit) {
        case 'month':
            date.setMonth(date.getMonth() + duration);
            break;
        case 'year':
            date.setFullYear(date.getFullYear() + duration);
            break;
        default:
            date.setMonth(date.getMonth() + duration);
    }
    return date.toISOString();
}

function generatePaymentData(order, method) {
    // 根据支付方式生成支付数据
    return {
        order_id: order.id,
        amount: order.amount,
        payment_method: method,
        timestamp: Date.now()
    };
}

async function getSubscriptionPlans() {
    // 这里应该从数据库获取订阅计划
    return [
        // 同上面的订阅计划数据
    ];
}

module.exports = router;