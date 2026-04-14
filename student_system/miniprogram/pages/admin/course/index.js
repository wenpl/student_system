// pages/admin/course/index.js
const app = getApp();
const { showLoading, hideLoading, showSuccess, showError } = require('../../../utils/util');
const db = require('../../../utils/db');

Page({
  data: {
    courses: []
  },

  onLoad: function () {
    this.loadCourses();
  },

  onShow: function () {
    this.loadCourses();
  },

  loadCourses: function () {
    const self = this;
    showLoading('加载中...');

    db.query('courses', {}).then(function(courses) {
      hideLoading();
      self.setData({ courses: courses });
    }).catch(function(err) {
      hideLoading();
      // 模拟数据
      self.setData({
        courses: [
          { _id: 'course1', name: '幼儿英语基础班', price: 2000, hours: 20, description: '适合3-6岁儿童' },
          { _id: 'course2', name: '少儿英语进阶班', price: 2800, hours: 30, description: '适合7-12岁儿童' },
          { _id: 'course3', name: '口语强化训练', price: 3200, hours: 24, description: '提高口语表达能力' }
        ]
      });
    });
  },

  addCourse: function () {
    wx.navigateTo({ url: '/pages/admin/course/edit/index' });
  },

  editCourse: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/admin/course/edit/index?id=' + id });
  },

  deleteCourse: function (e) {
    const self = this;
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '提示',
      content: '确定要删除该课程吗？',
      success: function(res) {
        if (res.confirm) {
          showLoading('删除中...');
          db.remove('courses', id).then(function() {
            hideLoading();
            showSuccess('删除成功');
            self.loadCourses();
          }).catch(function(err) {
            hideLoading();
            showError('删除失败');
          });
        }
      }
    });
  }
});
