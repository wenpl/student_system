// pages/admin/notice/index.js
const app = getApp();
const { formatDate, showLoading, hideLoading } = require('../../../utils/util');
const db = require('../../../utils/db');

Page({
  data: {
    notices: [],
    currentTab: 'published', // published, draft
    filteredNotices: []
  },

  onLoad: function () {
    this.loadNotices();
  },

  onShow: function () {
    this.loadNotices();
  },

  loadNotices: function () {
    var self = this;
    showLoading('加载中...');

    db.query('notices', {
      orderBy: 'createTime',
      order: 'desc'
    }).then(function(notices) {
      var formattedNotices = notices.map(function(n) {
        return {
          ...n,
          timeText: formatDate(n.createTime, 'YYYY-MM-DD HH:mm'),
          typeText: n.type === 'important' ? '重要通知' : n.type === 'activity' ? '活动公告' : '普通通知',
          statusText: n.status === 'published' ? '已发布' : '草稿'
        };
      });

      var published = formattedNotices.filter(function(n) { return n.status === 'published'; });
      var draft = formattedNotices.filter(function(n) { return n.status === 'draft'; });

      self.setData({
        notices: formattedNotices,
        filteredNotices: self.data.currentTab === 'published' ? published : draft
      });
      hideLoading();
    }).catch(function(err) {
      hideLoading();
      console.error('加载公告失败:', err);
    });
  },

  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    var notices = this.data.notices;
    var filtered = tab === 'published'
      ? notices.filter(function(n) { return n.status === 'published'; })
      : notices.filter(function(n) { return n.status === 'draft'; });

    this.setData({ currentTab: tab, filteredNotices: filtered });
  },

  goToAdd: function () {
    wx.navigateTo({
      url: '/pages/admin/notice/edit/index'
    });
  },

  editNotice: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/admin/notice/edit/index?id=' + id
    });
  },

  deleteNotice: function (e) {
    var self = this;
    var id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条公告吗？',
      success: function(res) {
        if (res.confirm) {
          showLoading('删除中...');
          db.remove('notices', id).then(function() {
            hideLoading();
            wx.showToast({ title: '删除成功', icon: 'success' });
            self.loadNotices();
          }).catch(function(err) {
            hideLoading();
            console.error('删除失败:', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          });
        }
      }
    });
  },

  publishNotice: function (e) {
    var self = this;
    var id = e.currentTarget.dataset.id;

    showLoading('发布中...');
    db.update('notices', id, { status: 'published' }).then(function() {
      hideLoading();
      wx.showToast({ title: '发布成功', icon: 'success' });
      self.loadNotices();
    }).catch(function(err) {
      hideLoading();
      console.error('发布失败:', err);
      wx.showToast({ title: '发布失败', icon: 'none' });
    });
  }
});
