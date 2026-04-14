// pages/index/index.js
const app = getApp();

Page({
  onLoad: function () {
    // 检查登录状态并跳转
    this.checkAndRedirect();
  },

  checkAndRedirect: function () {
    if (app.isLoggedIn()) {
      // 已登录，根据角色跳转
      this.redirectByRole();
    } else {
      // 未登录，跳转到登录页
      wx.reLaunch({
        url: '/pages/login/index'
      });
    }
  },

  redirectByRole: function () {
    const role = app.globalData.role;

    let url = '/pages/parent/index';
    if (role === 'teacher') {
      url = '/pages/teacher/index';
    } else if (role === 'admin') {
      url = '/pages/admin/index';
    }

    wx.reLaunch({ url });
  }
});
