// pages/admin/index.js
const app = getApp();
const { formatDate, showLoading, hideLoading } = require('../../utils/util');
const db = require('../../utils/db');

Page({
  data: {
    today: '',
    stats: {
      studentCount: 0,
      classCount: 0,
      teacherCount: 0,
      monthBookingCount: 0,
      todayBookingCount: 0,
      pendingBookingCount: 0
    },
    pendingAudits: 0,
    pendingLeaves: 0,
  },

  onLoad: function () {
    this.setData({
      today: formatDate(new Date(), 'YYYY年MM月DD日')
    });
  },

  onShow: function () {
    this.loadData();
  },

  onPullDownRefresh: function () {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载数据
  loadData: async function () {
    try {
      showLoading('加载中...');

      await Promise.all([
        this.loadStats(),
        this.loadPendingCount()
      ]);

      hideLoading();
    } catch (err) {
      hideLoading();
      console.error('加载数据失败:', err);
    }
  },

  // 加载统计数据
  loadStats: async function () {
    try {
      // 学员总数
      const studentCount = await db.count('students');

      // 班级总数
      const classCount = await db.count('classes');

      // 老师总数
      const teacherCount = await db.count('users', {
        role: 'teacher'
      });

      // 约课统计
      const today = formatDate(new Date(), 'YYYY-MM-DD');
      var now = new Date();
      var monthStart = formatDate(new Date(now.getFullYear(), now.getMonth(), 1), 'YYYY-MM-DD');

      var monthBookings = await db.query('bookings', {
        where: { date: db._.gte(monthStart) },
        limit: 100
      });
      var todayBookings = await db.query('bookings', {
        where: { date: today }
      });
      var pendingBookings = await db.query('bookings', {
        where: { status: 'booked', date: db._.gte(today) },
        limit: 100
      });

      this.setData({
        stats: {
          studentCount: studentCount,
          classCount: classCount,
          teacherCount: teacherCount,
          monthBookingCount: monthBookings.length || 0,
          todayBookingCount: todayBookings.length || 0,
          pendingBookingCount: pendingBookings.length || 0
        }
      });
    } catch (err) {
      console.error('加载统计数据失败:', err);
    }
  },

  // 加载待处理数量
  loadPendingCount: function () {
    var self = this;

    // 待审核（学员绑定申请）- 使用 bindings 集合
    db.query('bindings', {
      where: { status: 'pending' }
    }).then(function(pendingBindings) {
      self.setData({
        pendingAudits: pendingBindings.length
      });
    }).catch(function(err) {
      console.error('加载绑定申请失败:', err);
    });

    // 待审核请假
    db.query('leaves', {
      where: { status: 'pending' }
    }).then(function(pendingLeaves) {
      self.setData({
        pendingLeaves: pendingLeaves.length
      });
    }).catch(function(err) {
      console.error('加载请假申请失败:', err);
    });

  },

  // 跳转到审核
  goToAudit: function () {
    wx.navigateTo({
      url: '/pages/admin/audit/index'
    });
  },

  // 跳转到约课管理
  goToBooking: function () {
    wx.navigateTo({
      url: '/pages/admin/booking/index'
    });
  },

  // 跳转到学员管理
  goToStudent: function () {
    wx.navigateTo({
      url: '/pages/admin/student/index'
    });
  },

  // 跳转到班级管理
  goToClass: function () {
    wx.navigateTo({
      url: '/pages/admin/class/index'
    });
  },

  // 跳转到排课管理
  goToSchedule: function () {
    wx.navigateTo({
      url: '/pages/admin/schedule/index'
    });
  },

  // 跳转到老师管理
  goToTeacher: function () {
    wx.navigateTo({
      url: '/pages/admin/teacher/index'
    });
  },

  // 跳转到公告管理
  goToNotice: function () {
    wx.navigateTo({
      url: '/pages/admin/notice/index'
    });
  },

  // 跳转到约课管理
  goToBooking: function () {
    wx.navigateTo({
      url: '/pages/admin/booking/index'
    });
  },

  // 跳转到数据统计
  goToStats: function () {
    wx.navigateTo({
      url: '/pages/admin/stats/index'
    });
  },

  // 跳转到个人中心
  goToProfile: function () {
    wx.navigateTo({
      url: '/pages/profile/index'
    });
  }
});
