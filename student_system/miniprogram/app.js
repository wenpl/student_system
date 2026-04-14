// app.js
App({
  globalData: {
    userInfo: null,
    openid: null,
    role: null, // parent, teacher, admin
    envId: null // 云开发环境ID
  },

  onLaunch: function () {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: this.getEnvId(),
        traceUser: true,
      });
    }

    // 检查登录状态
    this.checkLoginStatus();
  },

  // 获取云开发环境ID
  getEnvId: function () {
    // 云开发环境ID，需要在开通云开发后填入
    // 可以在云开发控制台 -> 设置 -> 环境ID 获取
    // 格式类似：cloud1-xxx 或 your-env-name
    return 'your-cloud-env-id';
  },

  // 设置云开发环境ID
  setEnvId: function (envId) {
    this.globalData.envId = envId;
    wx.setStorageSync('envId', envId);
  },

  // 检查登录状态
  checkLoginStatus: function () {
    const userInfo = wx.getStorageSync('userInfo');
    const openid = wx.getStorageSync('openid');
    const role = wx.getStorageSync('role');

    if (userInfo && openid && role) {
      this.globalData.userInfo = userInfo;
      this.globalData.openid = openid;
      this.globalData.role = role;
    }
  },

  // 手机号+密码登录
  phoneLogin: function (phone, password, role) {
    var self = this;
    var db = require('./utils/db');

    return db.query('users', {
      where: { phone: phone, role: role }
    }).then(function (users) {
      if (users.length === 0) {
        throw new Error('该手机号未注册或角色不匹配');
      }

      var user = users[0];
      if (user.password !== password) {
        throw new Error('密码错误');
      }

      var userInfo = {
        nickName: user.nickName,
        avatarUrl: user.avatarUrl || ''
      };

      self.setUserInfo({
        userInfo: userInfo,
        openid: user._id,
        role: user.role
      });

      return {
        userInfo: userInfo,
        openid: user._id,
        role: user.role
      };
    });
  },

  // 设置用户信息
  setUserInfo: function (data) {
    this.globalData.userInfo = data.userInfo;
    this.globalData.openid = data.openid;
    this.globalData.role = data.role;

    wx.setStorageSync('userInfo', data.userInfo);
    wx.setStorageSync('openid', data.openid);
    wx.setStorageSync('role', data.role);
  },

  // 清除用户信息（退出登录）
  clearUserInfo: function () {
    this.globalData.userInfo = null;
    this.globalData.openid = null;
    this.globalData.role = null;

    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('openid');
    wx.removeStorageSync('role');
  },

  // 判断是否已登录
  isLoggedIn: function () {
    return !!this.globalData.openid && !!this.globalData.role;
  },

  // 判断是否已授权
  isAuthorized: function () {
    return !!this.globalData.userInfo;
  }
});
