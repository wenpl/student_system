// pages/profile/index.js
const app = getApp();
const { showConfirm, showSuccess } = require('../../utils/util');
const db = require('../../utils/db');

Page({
  data: {
    userInfo: null,
    role: '',
    roleText: ''
  },

  onLoad: function () {
    this.initData();
  },

  onShow: function () {
    this.initData();
  },

  initData: function () {
    var self = this;
    var openid = app.globalData.openid;

    var roleMap = {
      parent: '家长',
      teacher: '老师',
      admin: '管理员'
    };

    self.setData({
      role: app.globalData.role || 'parent',
      roleText: roleMap[app.globalData.role] || '家长'
    });

    // 从云数据库加载真实用户信息
    if (openid) {
      // 先按 _id 查，再按 openid 字段查
      db.queryById('users', openid).then(function(user) {
        if (user) return user;
        return db.query('users', { where: { openid: openid } }).then(function(users) {
          return users.length > 0 ? users[0] : null;
        });
      }).then(function(user) {
        if (user) {
          var userInfo = {
            nickName: user.nickName || '未设置姓名',
            avatarUrl: user.avatarUrl || ''
          };
          self.setData({ userInfo: userInfo });
          app.globalData.userInfo = userInfo;
        } else {
          self.setData({
            userInfo: app.globalData.userInfo || { nickName: '未登录' }
          });
        }
      }).catch(function() {
        self.setData({
          userInfo: app.globalData.userInfo || { nickName: '未登录' }
        });
      });
    } else {
      self.setData({
        userInfo: app.globalData.userInfo || { nickName: '未登录' }
      });
    }
  },

  // 切换角色
  switchRole: function (e) {
    console.log('switchRole called');
    const role = e.currentTarget.dataset.role;
    console.log('切换到角色:', role);

    const roleMap = {
      parent: '家长',
      teacher: '老师',
      admin: '管理员'
    };

    // 更新角色
    app.globalData.role = role;
    try {
      wx.setStorageSync('role', role);
    } catch (err) {
      console.error('存储角色失败:', err);
    }

    this.setData({
      role: role,
      roleText: roleMap[role]
    });

    showSuccess('已切换到' + roleMap[role]);

    // 跳转到对应首页
    setTimeout(() => {
      this.redirectToHome(role);
    }, 500);
  },

  // 跳转到首页
  redirectToHome: function (role) {
    let url = '/pages/parent/index';
    if (role === 'teacher') {
      url = '/pages/teacher/index';
    } else if (role === 'admin') {
      url = '/pages/admin/index';
    }

    console.log('跳转到:', url);
    wx.reLaunch({ url });
  },

  // 返回工作台
  goToHome: function () {
    const role = this.data.role;
    this.redirectToHome(role);
  },

  // 编辑资料
  goToEditProfile: function () {
    wx.navigateTo({
      url: '/pages/profile/edit/index'
    });
  },

  // 通知设置
  goToNotificationSettings: function () {
    wx.navigateTo({
      url: '/pages/profile/notification-settings/index'
    });
  },

  // 帮助中心
  goToHelp: function () {
    wx.navigateTo({
      url: '/pages/profile/help/index'
    });
  },

  // 关于我们
  goToAbout: function () {
    wx.navigateTo({
      url: '/pages/profile/about/index'
    });
  },

  // 退出登录
  handleLogout: function () {
    const that = this;
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: function (res) {
        if (res.confirm) {
          app.clearUserInfo();
          showSuccess('已退出登录');
          setTimeout(function () {
            wx.reLaunch({
              url: '/pages/login/index'
            });
          }, 1500);
        }
      }
    });
  }
});
