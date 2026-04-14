// pages/admin/class/edit/index.js
const app = getApp();
const { showLoading, hideLoading, showSuccess, showError } = require('../../../../utils/util');
const db = require('../../../../utils/db');

Page({
  data: {
    id: '',
    name: '',
    courseType: '',
    scheduleTime: '',
    teacherId: '',
    teacherName: '',
    teacherList: [],
    isEdit: false
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ id: options.id, isEdit: true });
      this.loadClass(options.id);
    }
    this.loadTeachers();
  },

  loadTeachers: function () {
    const self = this;
    db.query('users', { where: { role: 'teacher' } }).then(function(teachers) {
      self.setData({ teacherList: teachers });
    }).catch(function() {
      // 模拟数据
      self.setData({
        teacherList: [
          { _id: 'teacher1', nickName: '王老师' },
          { _id: 'teacher2', nickName: '李老师' }
        ]
      });
    });
  },

  loadClass: function (id) {
    const self = this;
    showLoading('加载中...');
    db.queryById('classes', id).then(function(cls) {
      hideLoading();
      if (cls) {
        self.setData({
          name: cls.name || '',
          courseType: cls.courseType || '',
          scheduleTime: cls.scheduleTime || '',
          teacherId: cls.teacherId || '',
          teacherName: cls.teacherName || ''
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

  onCourseTypeInput: function (e) {
    this.setData({ courseType: e.detail.value });
  },

  onScheduleInput: function (e) {
    this.setData({ scheduleTime: e.detail.value });
  },

  onTeacherChange: function (e) {
    const index = e.detail.value;
    const teacher = this.data.teacherList[index];
    this.setData({
      teacherId: teacher._id,
      teacherName: teacher.nickName
    });
  },

  save: function () {
    const self = this;
    const { id, name, courseType, scheduleTime, teacherId, teacherName, isEdit } = self.data;

    if (!name.trim()) {
      showError('请输入班级名称');
      return;
    }

    showLoading('保存中...');

    const data = {
      name: name,
      courseType: courseType,
      scheduleTime: scheduleTime,
      teacherId: teacherId,
      teacherName: teacherName
    };

    if (isEdit) {
      db.update('classes', id, data).then(function() {
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
      db.add('classes', {
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
