// pages/teacher/notice/index.js
var app = getApp();
var util = require('../../../utils/util');
var formatDate = util.formatDate;
var showLoading = util.showLoading;
var hideLoading = util.hideLoading;
var db = require('../../../utils/db');

Page({
  data: {
    notices: [],
    unreadCount: 0
  },

  onLoad: function () {
    this.loadNotices();
  },

  onShow: function () {
    this.loadNotices();
  },

  onPullDownRefresh: function () {
    var self = this;
    this.loadNotices().then(function () {
      wx.stopPullDownRefresh();
    }).catch(function () {
      wx.stopPullDownRefresh();
    });
  },

  loadNotices: function () {
    var self = this;
    var openid = app.globalData.openid || '';

    return db.query('notices', {
      where: { status: 'published' },
      limit: 50
    }).then(function (notices) {
      var unreadCount = 0;
      var formattedNotices = notices.map(function (n) {
        var readBy = n.readBy || [];
        var isRead = readBy.indexOf(openid) !== -1;
        if (!isRead) unreadCount++;
        return {
          _id: n._id,
          title: n.title,
          content: n.content,
          type: n.type,
          isRead: isRead,
          timeText: formatDate(n.createTime, 'MM-DD HH:mm'),
          typeText: n.type === 'important' ? '重要通知' : n.type === 'activity' ? '活动公告' : '普通通知'
        };
      });

      self.setData({
        notices: formattedNotices,
        unreadCount: unreadCount
      });
    }).catch(function (err) {
      console.error('加载公告失败:', err);
    });
  },

  goToDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/parent/notice-detail/index?id=' + id
    });
  }
});
