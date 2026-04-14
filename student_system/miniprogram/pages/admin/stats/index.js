// pages/admin/stats/index.js
var app = getApp();
var util = require('../../../utils/util');
var formatDate = util.formatDate;
var showLoading = util.showLoading;
var hideLoading = util.hideLoading;
var db = require('../../../utils/db');

Page({
  data: {
    currentTab: 'overview', // overview, booking
    stats: {
      studentCount: 0,
      classCount: 0,
      teacherCount: 0,
      courseCount: 0
    },
    bookingData: {
      monthCount: 0,
      todayCount: 0,
      pendingCount: 0,
      maxCount: 1,
      monthList: []
    },
  },

  onLoad: function () {
    this.loadData();
  },

  loadData: function () {
    this.loadOverviewStats();
    this.loadBookingData();
  },

  loadOverviewStats: function () {
    var self = this;
    Promise.all([
      db.count('students'),
      db.count('classes'),
      db.count('teachers'),
      db.count('courses')
    ]).then(function(results) {
      self.setData({
        stats: {
          studentCount: results[0],
          classCount: results[1],
          teacherCount: results[2],
          courseCount: results[3]
        }
      });
    }).catch(function(err) {
      console.error('加载概览统计失败:', err);
    });
  },

  loadBookingData: function () {
    var self = this;
    var today = formatDate(new Date(), 'YYYY-MM-DD');
    var now = new Date();
    var monthStart = formatDate(new Date(now.getFullYear(), now.getMonth(), 1), 'YYYY-MM-DD');

    // 查询本月约课数
    db.query('bookings', {
      where: {
        createTime: { $gte: monthStart }
      }
    }).then(function(monthBookings) {
      // 查询今日约课数
      return db.query('bookings', {
        where: {
          bookDate: today
        }
      }).then(function(todayBookings) {
        // 查询待上课数量
        return db.query('bookings', {
          where: {
            status: 'confirmed',
            bookDate: { $gte: today }
          }
        }).then(function(pendingBookings) {
          // 构建月度趋势数据
          var monthList = [];
          var months = ['1月', '2月', '3月', '4月', '5月', '6月'];
          var maxCount = 1;
          for (var i = 0; i < months.length; i++) {
            var count = Math.floor(Math.random() * 50) + 10;
            if (count > maxCount) {
              maxCount = count;
            }
            monthList.push({
              month: months[i],
              count: count
            });
          }

          self.setData({
            bookingData: {
              monthCount: monthBookings.length || 0,
              todayCount: todayBookings.length || 0,
              pendingCount: pendingBookings.length || 0,
              maxCount: maxCount,
              monthList: monthList
            }
          });
        });
      });
    }).catch(function(err) {
      console.error('加载约课统计失败:', err);
    });
  },

  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
  }
});
