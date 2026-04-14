// utils/util.js - 通用工具函数

/**
 * 格式化日期
 * @param {Date|string|number} date 日期对象或时间戳
 * @param {string} format 格式化模板
 * @returns {string} 格式化后的日期字符串
 */
const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return '';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

/**
 * 格式化金额
 * @param {number} amount 金额
 * @returns {string} 格式化后的金额
 */
const formatMoney = (amount) => {
  if (amount === null || amount === undefined) return '0.00';
  return Number(amount).toFixed(2);
};

/**
 * 手机号脱敏
 * @param {string} phone 手机号
 * @returns {string} 脱敏后的手机号
 */
const maskPhone = (phone) => {
  if (!phone || phone.length !== 11) return phone;
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

/**
 * 显示加载提示
 * @param {string} title 提示文字
 */
const showLoading = (title = '加载中...') => {
  wx.showLoading({
    title,
    mask: true
  });
};

/**
 * 隐藏加载提示
 */
const hideLoading = () => {
  wx.hideLoading();
};

/**
 * 显示成功提示
 * @param {string} title 提示文字
 */
const showSuccess = (title) => {
  wx.showToast({
    title,
    icon: 'success',
    duration: 2000
  });
};

/**
 * 显示错误提示
 * @param {string} title 提示文字
 */
const showError = (title) => {
  wx.showToast({
    title,
    icon: 'error',
    duration: 2000
  });
};

/**
 * 显示确认弹窗
 * @param {string} content 内容
 * @param {string} title 标题
 * @returns {Promise<boolean>} 用户是否确认
 */
const showConfirm = (content, title = '提示') => {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: (res) => {
        resolve(res.confirm);
      },
      fail: () => {
        resolve(false);
      }
    });
  });
};

/**
 * 计算年龄
 * @param {string} birthday 生日 (YYYY-MM-DD)
 * @returns {number} 年龄
 */
const calculateAge = (birthday) => {
  if (!birthday) return 0;
  const birth = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
};

/**
 * 获取本周日期范围
 * @returns {Object} {start, end}
 */
const getWeekRange = () => {
  const today = new Date();
  const dayOfWeek = today.getDay() || 7; // 周日为0，转为7
  const start = new Date(today);
  start.setDate(today.getDate() - dayOfWeek + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    start: formatDate(start, 'YYYY-MM-DD'),
    end: formatDate(end, 'YYYY-MM-DD')
  };
};

/**
 * 获取当月日期范围
 * @returns {Object} {start, end}
 */
const getMonthRange = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    start: formatDate(start, 'YYYY-MM-DD'),
    end: formatDate(end, 'YYYY-MM-DD')
  };
};

/**
 * 防抖函数
 * @param {Function} fn 要执行的函数
 * @param {number} delay 延迟时间
 * @returns {Function}
 */
const debounce = (fn, delay = 300) => {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

/**
 * 节流函数
 * @param {Function} fn 要执行的函数
 * @param {number} interval 间隔时间
 * @returns {Function}
 */
const throttle = (fn, interval = 300) => {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
};

module.exports = {
  formatDate,
  formatMoney,
  maskPhone,
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  showConfirm,
  calculateAge,
  getWeekRange,
  getMonthRange,
  debounce,
  throttle
};
