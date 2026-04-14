// pages/admin/class/index.js
const app = getApp();
const { showLoading, hideLoading, showSuccess, showError } = require('../../../utils/util');
const db = require('../../../utils/db');

Page({
  data: {
    classes: []
  },

  onLoad: function () {
    this.loadClasses();
  },

  onShow: function () {
    this.loadClasses();
  },

  loadClasses: function () {
    const self = this;
    showLoading('加载中...');

    db.query('classes', {}).then(function(classes) {
      // 获取每个班级的学员数量
      const countPromises = classes.map(function(cls) {
        return db.count('students', { classId: cls._id }).then(function(count) {
          cls.studentCount = count;
          return cls;
        });
      });

      return Promise.all(countPromises);
    }).then(function(classesWithCount) {
      hideLoading();
      self.setData({ classes: classesWithCount });
    }).catch(function(err) {
      hideLoading();
      console.error('加载班级失败:', err);
    });
  },

  addClass: function () {
    wx.navigateTo({ url: '/pages/admin/class/edit/index' });
  },

  editClass: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/admin/class/edit/index?id=' + id });
  },

  viewDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/teacher/class-detail/index?id=' + id });
  },

  deleteClass: function (e) {
    const self = this;
    const id = e.currentTarget.dataset.id;
    const classItem = self.data.classes.find(function(c) { return c._id === id; });

    if (classItem && classItem.studentCount > 0) {
      showError('该班级下有学员，无法删除');
      return;
    }

    wx.showModal({
      title: '提示',
      content: '确定要删除该班级吗？',
      success: function(res) {
        if (res.confirm) {
          showLoading('删除中...');
          db.remove('classes', id).then(function() {
            hideLoading();
            showSuccess('删除成功');
            self.loadClasses();
          }).catch(function(err) {
            hideLoading();
            showError('删除失败');
          });
        }
      }
    });
  }
});
