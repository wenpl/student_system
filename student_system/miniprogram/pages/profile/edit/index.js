// pages/profile/edit/index.js
const app = getApp();
const { showLoading, hideLoading, showSuccess, showError } = require('../../../utils/util');
const db = require('../../../utils/db');

Page({
  data: {
    userId: '',
    nickName: '',
    phone: '',
    avatarUrl: '',
    role: '',
    roleText: '',
    // 老师扩展字段
    teacherId: '',
    nameEn: '',
    gender: '',
    birthday: '',
    bio: ''
  },

  onLoad: function () {
    this.loadUserInfo();
  },

  // 从云数据库加载用户信息
  loadUserInfo: function () {
    var self = this;
    var openid = app.globalData.openid;
    var role = app.globalData.role;

    var roleMap = {
      parent: '家长',
      teacher: '老师',
      admin: '管理员'
    };

    showLoading('加载中...');

    // 先按 _id 查，再按 openid 字段查
    db.queryById('users', openid).then(function(user) {
      if (user) return user;
      // fallback: 按 openid 字段查询
      return db.query('users', { where: { openid: openid } }).then(function(users) {
        return users.length > 0 ? users[0] : null;
      });
    }).then(function(user) {
      hideLoading();
      if (user) {
        self.setData({
          userId: user._id,
          nickName: user.nickName || '',
          phone: user.phone || '',
          avatarUrl: user.avatarUrl || '',
          role: role,
          roleText: roleMap[role] || '未知'
        });
      }
    }).catch(function(err) {
      hideLoading();
      console.error('加载用户信息失败:', err);
    });
  },

  onNameInput: function (e) {
    this.setData({ nickName: e.detail.value });
  },

  onPhoneInput: function (e) {
    this.setData({ phone: e.detail.value });
  },

  onNameEnInput: function (e) {
    this.setData({ nameEn: e.detail.value });
  },

  onGenderChange: function (e) {
    this.setData({ gender: e.detail.value });
  },

  onBirthdayChange: function (e) {
    this.setData({ birthday: e.detail.value });
  },

  onBioInput: function (e) {
    this.setData({ bio: e.detail.value });
  },

  // 跳转到修改密码
  goToChangePassword: function () {
    wx.navigateTo({
      url: '/pages/profile/change-password/index'
    });
  },

  // 选择头像
  chooseAvatar: function () {
    var self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        var tempFilePath = res.tempFiles[0].tempFilePath;
        self.setData({ avatarUrl: tempFilePath });
      }
    });
  },

  // 保存
  save: function () {
    var self = this;
    var { userId, nickName, phone, avatarUrl } = self.data;

    if (!nickName.trim()) {
      showError('请输入姓名');
      return;
    }

    showLoading('保存中...');

    var updateData = {
      nickName: nickName.trim(),
      phone: phone
    };

    // 如果选了新头像，先上传到云存储
    if (avatarUrl && avatarUrl.indexOf('tmp') !== -1) {
      // 临时文件，需要上传
      var cloudPath = 'avatars/' + app.globalData.openid + '_' + Date.now() + '.jpg';
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: avatarUrl,
        success: function(uploadRes) {
          updateData.avatarUrl = uploadRes.fileID;
          self.doSave(userId, updateData);
        },
        fail: function(err) {
          console.error('上传头像失败:', err);
          // 头像上传失败，仍然保存其他信息
          self.doSave(userId, updateData);
        }
      });
    } else {
      self.doSave(userId, updateData);
    }
  },

  // 执行保存
  doSave: function (userId, updateData) {
    var self = this;
    var role = self.data.role;

    // 更新 users 表
    var saveUserPromise = db.update('users', userId, updateData);

    // 若为老师，同时更新 teachers 表
    var saveTeacherPromise;
    if (role === 'teacher' && self.data.teacherId) {
      var teacherData = {
        nameEn: self.data.nameEn,
        gender: self.data.gender,
        birthday: self.data.birthday,
        bio: self.data.bio,
        nickName: updateData.nickName
      };
      if (updateData.avatarUrl) {
        teacherData.avatarUrl = updateData.avatarUrl;
      }
      saveTeacherPromise = db.update('teachers', self.data.teacherId, teacherData);
    } else {
      saveTeacherPromise = Promise.resolve();
    }

    Promise.all([saveUserPromise, saveTeacherPromise]).then(function() {
      // 同步更新本地缓存
      var userInfo = app.globalData.userInfo || {};
      userInfo.nickName = updateData.nickName;
      if (updateData.avatarUrl) {
        userInfo.avatarUrl = updateData.avatarUrl;
      }
      app.globalData.userInfo = userInfo;
      wx.setStorageSync('userInfo', userInfo);

      hideLoading();
      showSuccess('保存成功');
      setTimeout(function() {
        wx.navigateBack();
      }, 1500);
    }).catch(function(err) {
      hideLoading();
      console.error('保存失败:', err);
      showError('保存失败');
    });
  }
});
