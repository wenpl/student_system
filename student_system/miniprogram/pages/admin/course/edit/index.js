// pages/admin/course/edit/index.js
const app = getApp();
const { showLoading, hideLoading, showSuccess, showError } = require('../../../../utils/util');
const db = require('../../../../utils/db');

Page({
  data: {
    id: '',
    name: '',
    price: '',
    hours: '',
    description: '',
    isEdit: false
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ id: options.id, isEdit: true });
      this.loadCourse(options.id);
    }
  },

  loadCourse: function (id) {
    const self = this;
    showLoading('加载中...');
    db.queryById('courses', id).then(function(course) {
      hideLoading();
      if (course) {
        self.setData({
          name: course.name || '',
          price: String(course.price || ''),
          hours: String(course.hours || ''),
          description: course.description || ''
        });
      }
    }).catch(function(err) {
      hideLoading();
      showError('加载失败');
    });
  },

  onNameInput: function (e) {
    this.setData({ name: e.detail.value });
  },

  onPriceInput: function (e) {
    this.setData({ price: e.detail.value });
  },

  onHoursInput: function (e) {
    this.setData({ hours: e.detail.value });
  },

  onDescInput: function (e) {
    this.setData({ description: e.detail.value });
  },

  save: function () {
    const self = this;
    const { id, name, price, hours, description, isEdit } = self.data;

    if (!name.trim()) {
      showError('请输入课程名称');
      return;
    }

    showLoading('保存中...');

    const data = {
      name: name,
      price: parseFloat(price) || 0,
      hours: parseInt(hours) || 0,
      description: description
    };

    if (isEdit) {
      db.update('courses', id, data).then(function() {
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
      db.add('courses', {
        ...data,
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
