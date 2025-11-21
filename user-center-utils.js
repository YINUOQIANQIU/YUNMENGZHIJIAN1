// 用户中心工具函数
class UserCenterUtils {
  // 格式化学习时间
  static formatStudyTime(seconds) {
    if (!seconds) return '0分钟';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  }

  // 格式化日期
  static formatDate(dateString, includeTime = false) {
    if (!dateString) return '--';
    
    const date = new Date(dateString);
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };
    
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    
    return date.toLocaleDateString('zh-CN', options);
  }

  // 计算学习连续天数
  static calculateStudyStreak(studyDates) {
    if (!studyDates || studyDates.length === 0) return 0;
    
    // 按日期排序
    const sortedDates = studyDates
      .map(date => new Date(date).toISOString().split('T')[0])
      .sort()
      .reverse();
    
    let streak = 0;
    let currentDate = new Date();
    
    // 检查今天是否学习
    const today = currentDate.toISOString().split('T')[0];
    if (sortedDates.includes(today)) {
      streak = 1;
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    // 检查连续学习天数
    while (true) {
      const checkDate = currentDate.toISOString().split('T')[0];
      if (sortedDates.includes(checkDate)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    return streak;
  }

  // 获取成就徽章图标
  static getBadgeIcon(badgeType) {
    const icons = {
      'study_master': 'fas fa-graduation-cap',
      'study_expert': 'fas fa-user-graduate',
      'study_enthusiast': 'fas fa-book-reader',
      'study_beginner': 'fas fa-book',
      
      'consistency_champion': 'fas fa-fire',
      'consistency_expert': 'fas fa-calendar-check',
      'consistency_enthusiast': 'fas fa-calendar-alt',
      'consistency_beginner': 'fas fa-calendar',
      
      'vocabulary_master': 'fas fa-language',
      'vocabulary_expert': 'fas fa-font',
      'vocabulary_enthusiast': 'fas fa-spell-check',
      'vocabulary_beginner': 'fas fa-a'
    };
    
    return icons[badgeType] || 'fas fa-star';
  }

  // 获取成就徽章颜色
  static getBadgeColor(badgeType) {
    const colors = {
      'study_master': 'from-yellow-400 to-orange-500',
      'study_expert': 'from-purple-500 to-pink-500',
      'study_enthusiast': 'from-blue-500 to-blue-700',
      'study_beginner': 'from-gray-400 to-gray-600',
      
      'consistency_champion': 'from-red-500 to-pink-500',
      'consistency_expert': 'from-green-500 to-teal-500',
      'consistency_enthusiast': 'from-blue-400 to-blue-600',
      'consistency_beginner': 'from-gray-400 to-gray-600',
      
      'vocabulary_master': 'from-indigo-500 to-purple-500',
      'vocabulary_expert': 'from-teal-500 to-green-500',
      'vocabulary_enthusiast': 'from-blue-400 to-blue-600',
      'vocabulary_beginner': 'from-gray-400 to-gray-600'
    };
    
    return colors[badgeType] || 'from-gray-400 to-gray-600';
  }

  // 验证头像URL
  static validateAvatarUrl(url) {
    if (!url) return false;
    
    // 基本URL格式验证
    try {
      new URL(url);
    } catch {
      return false;
    }
    
    // 检查支持的图片格式
    const supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    return supportedFormats.some(format => 
      url.toLowerCase().includes(format)
    );
  }

  // 生成默认头像URL
  static generateDefaultAvatar(username) {
    const colors = [
      'FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7',
      'DDA0DD', '98D8C8', 'F7DC6F', 'BB8FCE', '85C1E9'
    ];
    
    const color = colors[username.length % colors.length];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=${color}&color=fff&size=128`;
  }

  // 计算学习目标完成度
  static calculateGoalCompletion(current, target) {
    if (!target || target === 0) return 0;
    return Math.min(Math.round((current / target) * 100), 100);
  }

  // 获取学习建议
  static getStudySuggestions(stats) {
    const suggestions = [];
    
    if ((stats.activeDays7 || 0) < 3) {
      suggestions.push({
        type: 'consistency',
        message: '建议增加学习频率，保持每周至少3天学习',
        icon: 'calendar-plus',
        priority: 'high'
      });
    }
    
    if ((stats.totalStudyTime || 0) < 3600) {
      suggestions.push({
        type: 'duration',
        message: '学习时长较短，建议每天保持30分钟以上学习',
        icon: 'clock',
        priority: 'medium'
      });
    }
    
    if ((stats.masteredWords || 0) < 100) {
      suggestions.push({
        type: 'vocabulary',
        message: '已掌握词汇较少，建议加强词汇学习',
        icon: 'book',
        priority: 'medium'
      });
    }
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
}

// 导出工具类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UserCenterUtils;
} else {
  window.UserCenterUtils = UserCenterUtils;
}