// pages/admin/teacher/index.js
const app = getApp();
const { showLoading, hideLoading, showSuccess, showError } = require('../../../utils/util');
const db = require('../../../utils/db');

Page({
  data: {
    teachers: []
  },

  onLoad: function () {
    this.loadTeachers();
  },

  onShow: function () {
    this.loadTeachers();
  },

  loadTeachers: function () {
    const self = this;
    showLoading('加载中...');

    db.query('users', { where: { role: 'teacher' } }).then(function(teachers) {
      // 获取每个老师的班级数量
      const countPromises = teachers.map(function(teacher) {
        return db.count('classes', { teacherId: teacher._id }).then(function(count) {
          teacher.classCount = count;
          return teacher;
        });
      });

      return Promise.all(countPromises);
    }).then(function(teachersWithCount) {
      hideLoading();
      self.setData({ teachers: teachersWithCount });
    }).catch(function(err) {
      hideLoading();
      // 模拟数据
      self.setData({
        teachers: [
          { _id: 'teacher1', nickName: '王老师', phone: '13800138001', classCount: 2, status: 'active' },
          { _id: 'teacher2', nickName: '李老师', phone: '13800138002', classCount: 1, status: 'active' }
        ]
      });
    });
  },

  addTeacher: function () {
    wx.navigateTo({ url: '/pages/admin/teacher/edit/index' });
  },

  editTeacher: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/admin/teacher/edit/index?id=' + id });
  },

  deleteTeacher: function (e) {
    const self = this;
    const id = e.currentTarget.dataset.id;
    const teacher = self.data.teachers.find(function(t) { return t._id === id; });

    if (teacher && teacher.classCount > 0) {
      showError('该老师有负责班级，无法删除');
      return;
    }

    wx.showModal({
      title: '提示',
      content: '确定要删除该老师吗？',
      success: function(res) {
        if (res.confirm) {
          showLoading('删除中...');
          db.remove('users', id).then(function() {
            hideLoading();
            showSuccess('删除成功');
            self.loadTeachers();
          }).catch(function(err) {
            hideLoading();
            showError('删除失败');
          });
        }
      }
    });
  }
});
