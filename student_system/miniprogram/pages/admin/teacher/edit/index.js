// pages/admin/teacher/edit/index.js
const app = getApp();
const { showLoading, hideLoading, showSuccess, showError } = require('../../../../utils/util');
const db = require('../../../../utils/db');

Page({
  data: {
    id: '',
    nickName: '',
    phone: '',
    isEdit: false,
    showPasswordSection: false,
    newPassword: '',
    confirmPassword: ''
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ id: options.id, isEdit: true });
      this.loadTeacher(options.id);
    }
  },

  loadTeacher: function (id) {
    const self = this;
    showLoading('加载中...');
    db.queryById('users', id).then(function(teacher) {
      hideLoading();
      if (teacher) {
        self.setData({
          nickName: teacher.nickName || '',
          phone: teacher.phone || ''
        });
      }
    }).catch(function(err) {
      hideLoading();
      showError('加载失败');
    });
  },

  onNameInput: function (e) {
    this.setData({ nickName: e.detail.value });
  },

  onPhoneInput: function (e) {
    this.setData({ phone: e.detail.value });
  },

  onNewPasswordInput: function (e) {
    this.setData({ newPassword: e.detail.value });
  },

  onConfirmPasswordInput: function (e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  togglePasswordSection: function () {
    this.setData({ showPasswordSection: !this.data.showPasswordSection });
  },

  // 设置自定义密码
  setPassword: function () {
    var self = this;
    var id = self.data.id;
    var newPassword = self.data.newPassword;
    var confirmPassword = self.data.confirmPassword;

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

    wx.showModal({
      title: '确认修改',
      content: '确定要修改该老师的密码吗？',
      success: function (res) {
        if (res.confirm) {
          showLoading('修改中...');
          db.update('users', id, { password: newPassword }).then(function () {
            hideLoading();
            showSuccess('密码已修改');
            self.setData({ newPassword: '', confirmPassword: '', showPasswordSection: false });
          }).catch(function () {
            hideLoading();
            showError('修改失败');
          });
        }
      }
    });
  },

  // 重置密码为默认
  resetPassword: function () {
    var self = this;
    var id = self.data.id;
    wx.showModal({
      title: '重置密码',
      content: '确定将该老师密码重置为默认密码（123456）吗？',
      success: function (res) {
        if (res.confirm) {
          showLoading('重置中...');
          db.update('users', id, { password: '123456' }).then(function () {
            hideLoading();
            showSuccess('密码已重置');
          }).catch(function () {
            hideLoading();
            showError('重置失败');
          });
        }
      }
    });
  },

  save: function () {
    const self = this;
    const { id, nickName, phone, isEdit } = self.data;

    if (!nickName.trim()) {
      showError('请输入老师姓名');
      return;
    }

    showLoading('保存中...');

    const data = {
      nickName: nickName,
      phone: phone,
      role: 'teacher'
    };

    if (isEdit) {
      db.update('users', id, data).then(function() {
        hideLoading();
        showSuccess('保存成功');
        setTimeout(function() {
          wx.navigateBack();
        }, 1500);
      }).catch(function(err) {
        hideLoading();
        showError('保存失败');
      });
    } else {
      db.add('users', {
        ...data,
        password: '123456',
        createTime: new Date()
      }).then(function() {
        hideLoading();
        showSuccess('添加成功');
        setTimeout(function() {
          wx.navigateBack();
        }, 1500);
      }).catch(function(err) {
        hideLoading();
        showError('添加失败');
      });
    }
  }
});
