// pages/profile/change-password/index.js
var app = getApp();
var util = require('../../../utils/util');
var showLoading = util.showLoading;
var hideLoading = util.hideLoading;
var showSuccess = util.showSuccess;
var showError = util.showError;
var db = require('../../../utils/db');

Page({
  data: {
    userId: '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  },

  onLoad: function () {
    this.loadUserId();
  },

  loadUserId: function () {
    var self = this;
    var openid = app.globalData.openid;
    db.query('users', {
      where: { openid: openid }
    }).then(function (users) {
      if (users.length > 0) {
        self.setData({ userId: users[0]._id });
      }
    });
  },

  onOldPasswordInput: function (e) {
    this.setData({ oldPassword: e.detail.value });
  },

  onNewPasswordInput: function (e) {
    this.setData({ newPassword: e.detail.value });
  },

  onConfirmPasswordInput: function (e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  submit: function () {
    var self = this;
    var oldPassword = self.data.oldPassword;
    var newPassword = self.data.newPassword;
    var confirmPassword = self.data.confirmPassword;

    if (!oldPassword) {
      showError('请输入旧密码');
      return;
    }
    if (!newPassword) {
      showError('请输入新密码');
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 20) {
      showError('密码需6-20位');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('两次密码不一致');
      return;
    }
    if (oldPassword === newPassword) {
      showError('新密码不能与旧密码相同');
      return;
    }

    showLoading('验证中...');

    // 验证旧密码
    db.queryById('users', self.data.userId).then(function (user) {
      if (!user) {
        hideLoading();
        showError('用户不存在');
        return;
      }
      if (user.password && user.password !== oldPassword) {
        hideLoading();
        showError('旧密码错误');
        return;
      }
      // 更新密码
      return db.update('users', self.data.userId, {
        password: newPassword
      }).then(function () {
        hideLoading();
        showSuccess('修改成功');
        setTimeout(function () {
          wx.navigateBack();
        }, 1500);
      });
    }).catch(function () {
      hideLoading();
      showError('修改失败');
    });
  }
});
