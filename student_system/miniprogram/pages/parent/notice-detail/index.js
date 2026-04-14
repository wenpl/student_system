// pages/parent/notice-detail/index.js
var app = getApp();
var util = require('../../../utils/util');
var formatDate = util.formatDate;
var db = require('../../../utils/db');

Page({
  data: {
    notice: null
  },

  onLoad: function (options) {
    if (options.id) {
      this.loadNotice(options.id);
    }
  },

  loadNotice: function (id) {
    var self = this;
    db.queryById('notices', id).then(function (notice) {
      if (notice) {
        notice.timeText = formatDate(notice.createTime, 'YYYY-MM-DD HH:mm');
        notice.typeText = notice.type === 'important' ? '重要通知' : notice.type === 'activity' ? '活动公告' : '普通通知';
        self.setData({ notice: notice });
        wx.setNavigationBarTitle({ title: notice.title });

        // 标记已读
        self.markAsRead(id, notice);
      }
    }).catch(function (err) {
      console.error('加载通知详情失败:', err);
    });
  },

  // 标记已读
  markAsRead: function (id, notice) {
    var openid = app.globalData.openid || '';
    if (!openid) return;

    var readBy = notice.readBy || [];
    if (readBy.indexOf(openid) === -1) {
      readBy.push(openid);
      db.update('notices', id, { readBy: readBy }).catch(function (err) {
        console.error('标记已读失败:', err);
      });
    }
  }
});
