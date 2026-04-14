// pages/parent/student-detail/index.js
const app = getApp();
const { formatDate, calculateAge, showLoading, hideLoading } = require('../../../utils/util');
const db = require('../../../utils/db');

Page({
  data: {
    student: {},
    comments: [],
    growthLevel: '启蒙1级',
    currentTab: 'info' // info, growth
  },

  onLoad: function (options) {
    const id = options.id;
    if (id) {
      this.loadStudentDetail(id);
    }
  },

  loadStudentDetail: function (id) {
    const self = this;
    showLoading('加载中...');

    db.queryById('students', id).then(function(student) {
      if (!student) {
        hideLoading();
        wx.showToast({ title: '学员不存在', icon: 'none' });
        return;
      }

      // 计算年龄
      if (student.birthday) {
        student.age = calculateAge(student.birthday);
      }

      // 获取班级名称
      if (student.classId) {
        db.queryById('classes', student.classId).then(function(classInfo) {
          if (classInfo) {
            student.className = classInfo.name;
            self.setData({ student: student });
          }
        });
      }

      // 成长等级（默认）
      student.growthLevel = '启蒙1级';

      self.setData({ student: student });
      self.loadComments(id);
      self.loadTeacherName(student.classId);
      hideLoading();
    }).catch(function(err) {
      hideLoading();
      console.error('加载学员详情失败:', err);
    });
  },

  // 加载课堂评语
  loadComments: function (studentId) {
    var self = this;
    db.query('comments', {
      where: { studentId: studentId },
      orderBy: { createTime: 'desc' },
      limit: 20
    }).then(function(comments) {
      var formattedComments = comments.map(function(c) {
        return {
          ...c,
          dateText: formatDate(c.createTime, 'YYYY-MM-DD')
        };
      });
      self.setData({ comments: formattedComments });
    }).catch(function(err) {
      console.error('加载课堂评语失败:', err);
    });
  },

  // 加载在读老师名称
  loadTeacherName: function (classId) {
    if (!classId) return;
    var self = this;
    db.queryById('classes', classId).then(function(classInfo) {
      if (classInfo && classInfo.teacherName) {
        self.setData({
          'student.teacherName': classInfo.teacherName
        });
      }
    }).catch(function(err) {
      console.error('加载老师信息失败:', err);
    });
  },

  // 切换标签
  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
  },

  goToSchedule: function () {
    wx.navigateTo({
      url: '/pages/parent/schedule/index'
    });
  },

  goToBooking: function () {
    wx.navigateTo({
      url: '/pages/parent/booking/index?studentId=' + this.data.student._id
    });
  }
});
