// pages/login/index.js
const app = getApp();
const { showLoading, hideLoading, showSuccess, showError } = require('../../utils/util');
const db = require('../../utils/db');

Page({
  data: {
    pageMode: 'login',        // 'login' or 'register'
    loading: false,
    // 登录字段
    phoneNumber: '',
    phonePassword: '',
    phoneRole: 'parent',
    // 注册字段
    regName: '',
    regPhone: '',
    regPassword: '',
    regConfirmPassword: ''
  },

  onLoad: function () {
    if (app.isLoggedIn()) {
      this.redirectToHome();
    }
  },

  // 切换登录/注册
  switchPageMode: function (e) {
    this.setData({ pageMode: e.currentTarget.dataset.mode });
  },

  // ===== 手机号+密码登录 =====
  onPhoneNumberInput: function (e) {
    this.setData({ phoneNumber: e.detail.value });
  },

  onPhonePasswordInput: function (e) {
    this.setData({ phonePassword: e.detail.value });
  },

  selectPhoneRole: function (e) {
    this.setData({ phoneRole: e.currentTarget.dataset.role });
  },

  handlePhoneLogin: function () {
    var self = this;
    var phoneNumber = self.data.phoneNumber;
    var phonePassword = self.data.phonePassword;
    var phoneRole = self.data.phoneRole;

    if (!phoneNumber || phoneNumber.length !== 11) {
      showError('请输入正确的手机号');
      return;
    }
    if (!phonePassword) {
      showError('请输入密码');
      return;
    }

    if (self.data.loading) return;
    self.setData({ loading: true });
    showLoading('登录中...');

    app.phoneLogin(phoneNumber, phonePassword, phoneRole).then(function () {
      hideLoading();
      self.setData({ loading: false });
      self.redirectToHome();
    }).catch(function (err) {
      hideLoading();
      self.setData({ loading: false });
      showError(err.message || '登录失败');
    });
  },

  // ===== 家长注册 =====
  onRegNameInput: function (e) {
    this.setData({ regName: e.detail.value });
  },

  onRegPhoneInput: function (e) {
    this.setData({ regPhone: e.detail.value });
  },

  onRegPasswordInput: function (e) {
    this.setData({ regPassword: e.detail.value });
  },

  onRegConfirmPasswordInput: function (e) {
    this.setData({ regConfirmPassword: e.detail.value });
  },

  handleRegister: function () {
    var self = this;
    var name = self.data.regName.trim();
    var phone = self.data.regPhone;
    var password = self.data.regPassword;
    var confirmPassword = self.data.regConfirmPassword;

    if (!name) {
      showError('请输入姓名');
      return;
    }
    if (!phone || phone.length !== 11) {
      showError('请输入正确的手机号');
      return;
    }
    if (!password || password.length < 6 || password.length > 20) {
      showError('密码需6-20位');
      return;
    }
    if (password !== confirmPassword) {
      showError('两次密码不一致');
      return;
    }

    if (self.data.loading) return;
    self.setData({ loading: true });
    showLoading('注册中...');

    db.query('users', {
      where: { phone: phone }
    }).then(function (users) {
      if (users.length > 0) {
        hideLoading();
        self.setData({ loading: false });
        showError('该手机号已注册');
        return;
      }

      return db.add('users', {
        nickName: name,
        phone: phone,
        password: password,
        role: 'parent',
        status: 'active',
        notificationSettings: {
          classReminder: true,
          reminderTime: 30,
          noticeAlert: true
        }
      }).then(function (newId) {
        hideLoading();
        self.setData({ loading: false });
        showSuccess('注册成功');

        app.setUserInfo({
          userInfo: { nickName: name, avatarUrl: '' },
          openid: newId,
          role: 'parent'
        });

        setTimeout(function () {
          self.redirectToHome();
        }, 1000);
      });
    }).catch(function (err) {
      hideLoading();
      self.setData({ loading: false });
      console.error('注册失败:', err);
      showError('注册失败，请重试');
    });
  },

  // 跳转到首页
  redirectToHome: function () {
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
