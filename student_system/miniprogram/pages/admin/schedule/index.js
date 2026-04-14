// pages/admin/schedule/index.js
const app = getApp();
const { formatDate, showLoading, hideLoading, showSuccess, showError } = require('../../../utils/util');
const db = require('../../../utils/db');

Page({
  data: {
    schedules: [],
    currentDate: '',
    viewMode: 'list' // list or calendar
  },

  onLoad: function () {
    this.setData({
      currentDate: formatDate(new Date(), 'YYYY-MM-DD')
    });
    this.loadSchedules();
  },

  onShow: function () {
    this.loadSchedules();
  },

  loadSchedules: function () {
    const self = this;
    showLoading('加载中...');

    db.query('schedules', {
      orderBy: { date: 'asc', startTime: 'asc' }
    }).then(function(schedules) {
      // 格式化数据
      const formattedSchedules = schedules.map(function(s) {
        const scheduleDate = new Date(s.date);
        const today = new Date();
        const isToday = formatDate(scheduleDate, 'YYYY-MM-DD') === formatDate(today, 'YYYY-MM-DD');
        const isPast = scheduleDate < today;

        return {
          ...s,
          dateText: formatDate(scheduleDate, 'MM月DD日'),
          dayText: self.getDayText(scheduleDate),
          isToday: isToday,
          isPast: isPast
        };
      });

      hideLoading();
      self.setData({ schedules: formattedSchedules });
    }).catch(function(err) {
      hideLoading();
      console.error('加载排课失败:', err);
    });
  },

  getDayText: function (date) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[date.getDay()];
  },

  // 切换视图模式
  toggleView: function () {
    this.setData({
      viewMode: this.data.viewMode === 'list' ? 'calendar' : 'list'
    });
  },

  addSchedule: function () {
    wx.navigateTo({ url: '/pages/admin/schedule/edit/index' });
  },

  editSchedule: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/admin/schedule/edit/index?id=' + id });
  },

  deleteSchedule: function (e) {
    const self = this;
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '提示',
      content: '确定要删除该排课吗？',
      success: function(res) {
        if (res.confirm) {
          showLoading('删除中...');
          db.remove('schedules', id).then(function() {
            hideLoading();
            showSuccess('删除成功');
            self.loadSchedules();
          }).catch(function(err) {
            hideLoading();
            showError('删除失败');
          });
        }
      }
    });
  }
});
