// pages/parent/message/index.js
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

  onLoad: function (options) {
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

  // 加载通知公告
  loadNotices: function () {
    var self = this;
    var openid = app.globalData.openid || '';

    return db.query('notices', {
      where: { status: 'published' },
      limit: 50
    }).then(function (notices) {
      // 过滤当前用户已删除的公告
      var visibleNotices = notices.filter(function (n) {
        var deletedBy = n.deletedBy || [];
        return deletedBy.indexOf(openid) === -1;
      });

      var unreadCount = 0;
      var formattedNotices = visibleNotices.map(function (n) {
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
      console.error('加载通知失败:', err);
    });
  },

  // 查看通知详情
  viewNotice: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/parent/notice-detail/index?id=' + id
    });
  },

  // 长按删除通知
  onLongPressNotice: function (e) {
    var self = this;
    var id = e.currentTarget.dataset.id;
    var openid = app.globalData.openid || '';

    wx.showModal({
      title: '删除通知',
      content: '确定删除这条通知吗？',
      success: function (res) {
        if (res.confirm) {
          // 获取当前 deletedBy 数组并加入当前用户
          db.queryById('notices', id).then(function (notice) {
            if (notice) {
              var deletedBy = notice.deletedBy || [];
              if (deletedBy.indexOf(openid) === -1) {
                deletedBy.push(openid);
              }
              return db.update('notices', id, { deletedBy: deletedBy });
            }
          }).then(function () {
            // 从本地列表移除
            var notices = self.data.notices.filter(function (n) {
              return n._id !== id;
            });
            var unreadCount = notices.filter(function (n) { return !n.isRead; }).length;
            self.setData({ notices: notices, unreadCount: unreadCount });
            wx.showToast({ title: '已删除', icon: 'success' });
          }).catch(function () {
            wx.showToast({ title: '删除失败', icon: 'none' });
          });
        }
      }
    });
  }
});
