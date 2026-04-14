// pages/admin/notice/edit/index.js
const app = getApp();
const { showLoading, hideLoading } = require('../../../../utils/util');
const db = require('../../../../utils/db');

Page({
  data: {
    id: '',
    title: '',
    content: '',
    type: 'normal', // normal, important, activity
    status: 'draft', // draft, published
    typeOptions: ['普通通知', '重要通知', '活动公告'],
    typeIndex: 0
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ id: options.id });
      this.loadNotice(options.id);
    }
  },

  loadNotice: function (id) {
    var self = this;
    showLoading('加载中...');

    db.queryById('notices', id).then(function(notice) {
      if (notice) {
        var typeIndex = 0;
        if (notice.type === 'important') typeIndex = 1;
        else if (notice.type === 'activity') typeIndex = 2;

        self.setData({
          title: notice.title,
          content: notice.content,
          type: notice.type,
          status: notice.status,
          typeIndex: typeIndex
        });
      }
      hideLoading();
    }).catch(function(err) {
      hideLoading();
      console.error('加载公告失败:', err);
    });
  },

  onTitleInput: function (e) {
    this.setData({ title: e.detail.value });
  },

  onContentInput: function (e) {
    this.setData({ content: e.detail.value });
  },

  onTypeChange: function (e) {
    var index = e.detail.value;
    var types = ['normal', 'important', 'activity'];
    this.setData({ typeIndex: index, type: types[index] });
  },

  saveDraft: function () {
    this.saveNotice('draft');
  },

  publish: function () {
    this.saveNotice('published');
  },

  saveNotice: function (status) {
    var self = this;

    if (!this.data.title.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }

    if (!this.data.content.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    showLoading('保存中...');

    var data = {
      title: this.data.title.trim(),
      content: this.data.content.trim(),
      type: this.data.type,
      status: status,
      authorId: app.globalData.openid
    };

    var promise;
    if (this.data.id) {
      promise = db.update('notices', this.data.id, data);
    } else {
      // 新增时初始化 readBy 和 deletedBy
      data.readBy = [];
      data.deletedBy = [];
      promise = db.add('notices', data);
    }

    promise.then(function() {
      hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(function() {
        wx.navigateBack();
      }, 1500);
    }).catch(function(err) {
      hideLoading();
      console.error('保存失败:', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    });
  }
});
