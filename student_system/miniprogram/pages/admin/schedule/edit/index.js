// pages/admin/schedule/edit/index.js
const app = getApp();
const { formatDate, showLoading, hideLoading, showSuccess, showError } = require('../../../../utils/util');
const db = require('../../../../utils/db');

Page({
  data: {
    id: '',
    date: '',
    startTime: '',
    endTime: '',
    courseName: '',
    classId: '',
    className: '',
    teacherId: '',
    teacherName: '',
    location: '',
    classList: [],
    teacherList: [],
    isEdit: false
  },

  onLoad: function (options) {
    this.setData({
      date: formatDate(new Date(), 'YYYY-MM-DD')
    });
    if (options.id) {
      this.setData({ id: options.id, isEdit: true });
      this.loadSchedule(options.id);
    }
    this.loadOptions();
  },

  loadOptions: function () {
    const self = this;
    // 加载班级列表
    db.query('classes', {}).then(function(classes) {
      self.setData({ classList: classes });
    }).catch(function() {
      self.setData({
        classList: [
          { _id: 'class1', name: '幼儿英语A班' },
          { _id: 'class2', name: '少儿英语B班' },
          { _id: 'class3', name: '口语提高班' }
        ]
      });
    });

    // 加载老师列表
    db.query('users', { where: { role: 'teacher' } }).then(function(teachers) {
      self.setData({ teacherList: teachers });
    }).catch(function() {
      self.setData({
        teacherList: [
          { _id: 'teacher1', nickName: '王老师' },
          { _id: 'teacher2', nickName: '李老师' }
        ]
      });
    });
  },

  loadSchedule: function (id) {
    const self = this;
    showLoading('加载中...');
    db.queryById('schedules', id).then(function(schedule) {
      hideLoading();
      if (schedule) {
        self.setData({
          date: schedule.date || '',
          startTime: schedule.startTime || '',
          endTime: schedule.endTime || '',
          courseName: schedule.courseName || '',
          classId: schedule.classId || '',
          className: schedule.className || '',
          teacherId: schedule.teacherId || '',
          teacherName: schedule.teacherName || '',
          location: schedule.location || ''
        });
      }
    }).catch(function(err) {
      hideLoading();
      showError('加载失败');
    });
  },

  onDateChange: function (e) {
    this.setData({ date: e.detail.value });
  },

  onStartTimeChange: function (e) {
    this.setData({ startTime: e.detail.value });
  },

  onEndTimeChange: function (e) {
    this.setData({ endTime: e.detail.value });
  },

  onCourseNameInput: function (e) {
    this.setData({ courseName: e.detail.value });
  },

  onClassChange: function (e) {
    const index = e.detail.value;
    const cls = this.data.classList[index];
    this.setData({
      classId: cls._id,
      className: cls.name
    });
  },

  onTeacherChange: function (e) {
    const index = e.detail.value;
    const teacher = this.data.teacherList[index];
    this.setData({
      teacherId: teacher._id,
      teacherName: teacher.nickName
    });
  },

  onLocationInput: function (e) {
    this.setData({ location: e.detail.value });
  },

  save: function () {
    const self = this;
    const { id, date, startTime, endTime, courseName, classId, className, teacherId, teacherName, location, isEdit } = self.data;

    if (!date) {
      showError('请选择日期');
      return;
    }
    if (!startTime || !endTime) {
      showError('请选择上课时间');
      return;
    }
    if (!courseName.trim()) {
      showError('请输入课程名称');
      return;
    }

    showLoading('保存中...');

    const data = {
      date: date,
      startTime: startTime,
      endTime: endTime,
      courseName: courseName,
      classId: classId,
      className: className,
      teacherId: teacherId,
      teacherName: teacherName,
      location: location
    };

    if (isEdit) {
      db.update('schedules', id, data).then(function() {
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
      db.add('schedules', {
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
