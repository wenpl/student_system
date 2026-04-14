// pages/profile/notification-settings/index.js
const app = getApp();
const db = require('../../../utils/db');

Page({
  data: {
    classReminder: true,
    reminderTime: 30,
    noticeAlert: true
  },

  onLoad: function () {
    this.loadSettings();
  },

  loadSettings: function () {
    var self = this;
    var openid = app.globalData.openid;
    if (!openid) return;

    db.query('users', {
      where: { openid: openid }
    }).then(function (users) {
      if (users.length > 0 && users[0].notificationSettings) {
        var settings = users[0].notificationSettings;
        self.setData({
          classReminder: settings.classReminder !== false,
          reminderTime: settings.reminderTime || 30,
          noticeAlert: settings.noticeAlert !== false
        });
      }
    }).catch(function () {});
  },

  onClassReminderChange: function (e) {
    this.setData({ classReminder: e.detail.value });
    this.saveSettings();
  },

  onReminderTimeChange: function (e) {
    var times = [15, 30, 60];
    this.setData({ reminderTime: times[e.detail.value] });
    this.saveSettings();
  },

  onNoticeAlertChange: function (e) {
    this.setData({ noticeAlert: e.detail.value });
    this.saveSettings();
  },

  saveSettings: function () {
    var self = this;
    var openid = app.globalData.openid;
    if (!openid) return;

    db.query('users', {
      where: { openid: openid }
    }).then(function (users) {
      if (users.length > 0) {
        db.update('users', users[0]._id, {
          notificationSettings: {
            classReminder: self.data.classReminder,
            reminderTime: self.data.reminderTime,
            noticeAlert: self.data.noticeAlert
          }
        });
      }
    }).catch(function (err) {
      console.error('保存设置失败:', err);
    });
  }
});