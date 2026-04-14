// pages/teacher/class-detail/index.js
const app = getApp();
const { formatDate, showLoading, hideLoading } = require('../../../utils/util');
const db = require('../../../utils/db');

Page({
  data: {
    classInfo: {},
    students: [],
    schedules: [],
    stats: {
      studentCount: 0,
      totalCourses: 0
    },
    currentTab: 'students' // students, schedule, stats
  },

  onLoad: function (options) {
    if (options.id) {
      this.loadClassDetail(options.id);
    }
  },

  loadClassDetail: function (id) {
    var self = this;
    showLoading('加载中...');

    // 获取班级信息
    db.queryById('classes', id).then(function(classInfo) {
      if (!classInfo) {
        hideLoading();
        wx.showToast({ title: '班级不存在', icon: 'none' });
        return;
      }

      // 获取课程信息
      if (classInfo.courseId) {
        db.queryById('courses', classInfo.courseId).then(function(course) {
          if (course) {
            classInfo.courseName = course.name;
            classInfo.courseType = course.type;
          }
          self.setData({ classInfo: classInfo });
        });
      }

      self.setData({ classInfo: classInfo });
      self.loadStudents(id);
      self.loadSchedules(id);
      self.loadStats(id);
      hideLoading();
    }).catch(function(err) {
      hideLoading();
      console.error('加载班级详情失败:', err);
    });
  },

  loadStudents: function (classId) {
    var self = this;
    db.query('students', {
      where: { classId: classId }
    }).then(function(students) {
      var formattedStudents = students.map(function(s) {
        return { ...s };
      });
      self.setData({ students: formattedStudents });
    }).catch(function(err) {
      console.error('加载学员失败:', err);
    });
  },

  loadSchedules: function (classId) {
    var self = this;
    var today = formatDate(new Date(), 'YYYY-MM-DD');

    db.query('schedules', {
      where: { classId: classId },
      orderBy: 'date',
      order: 'asc',
      limit: 10
    }).then(function(schedules) {
      var formattedSchedules = schedules.map(function(s) {
        return {
          ...s,
          dateText: formatDate(s.date, 'MM月DD日'),
          weekText: self.getWeekText(s.date),
          isToday: s.date === today,
          isPast: s.date < today
        };
      });
      self.setData({ schedules: formattedSchedules });
    }).catch(function(err) {
      console.error('加载课程安排失败:', err);
    });
  },

  loadStats: function (classId) {
    var self = this;

    // 学员数量
    db.query('students', { where: { classId: classId } }).then(function(students) {
      self.setData({
        stats: {
          studentCount: students.length,
          totalCourses: 0
        }
      });
    }).catch(function(err) {
      console.error('加载学员统计失败:', err);
    });
  },

  getWeekText: function (dateStr) {
    var days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    var date = new Date(dateStr);
    return days[date.getDay()];
  },

  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
  },

  goToStudentDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/teacher/student-detail/index?id=' + id
    });
  },

  // 跳转到约课信息
  goToBooking: function () {
    wx.navigateTo({
      url: '/pages/teacher/booking/index'
    });
  }
});
