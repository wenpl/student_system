// pages/teacher/booking/index.js
var app = getApp();
var formatDate = require('../../../utils/util').formatDate;
var showLoading = require('../../../utils/util').showLoading;
var hideLoading = require('../../../utils/util').hideLoading;
var showError = require('../../../utils/util').showError;
var db = require('../../../utils/db');

// 14个时间段
var TIME_SLOTS = [
  '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00',
  '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00',
  '16:00-17:00', '17:00-18:00', '18:00-19:00', '19:00-20:00',
  '20:00-21:00', '21:00-22:00'
];

Page({
  data: {
    selectedDate: '',
    teacherId: '',
    timeSlots: [],
    allBookings: [],
    showAll: false,
    loading: false
  },

  onLoad: function () {
    var today = formatDate(new Date(), 'YYYY-MM-DD');
    this.setData({ selectedDate: today });
    this.loadTeacherInfo();
  },

  onShow: function () {
    if (this.data.teacherId) {
      this.loadBookings();
    }
  },

  // 加载老师信息
  loadTeacherInfo: function () {
    var self = this;
    var openid = app.globalData.openid;

    db.query('users', {
      where: { openid: openid, role: 'teacher' }
    }).then(function (users) {
      if (users.length > 0) {
        self.setData({ teacherId: users[0]._id });
      } else {
        self.setData({ teacherId: openid });
      }
      self.loadBookings();
    }).catch(function (err) {
      console.error('加载老师信息失败:', err);
    });
  },

  // 日期选择
  onDateChange: function (e) {
    this.setData({ selectedDate: e.detail.value, showAll: false });
    this.loadBookings();
  },

  // 显示全部约课
  showAllBookings: function () {
    this.setData({ showAll: true });
    this.loadAllBookings();
  },

  // 返回按日期查看
  showByDate: function () {
    this.setData({ showAll: false });
    this.loadBookings();
  },

  // 加载全部约课数据
  loadAllBookings: function () {
    var self = this;
    var teacherId = self.data.teacherId;
    if (!teacherId) return;

    self.setData({ loading: true });

    db.query('bookings', {
      where: {
        teacherId: teacherId,
        status: 'booked'
      },
      limit: 100
    }).then(function (bookings) {
      var studentIds = [];
      var parentIds = [];
      bookings.forEach(function (b) {
        if (b.studentId && studentIds.indexOf(b.studentId) === -1) studentIds.push(b.studentId);
        if (b.parentId && parentIds.indexOf(b.parentId) === -1) parentIds.push(b.parentId);
      });

      var studentMap = {};
      var parentMap = {};
      var promises = [];

      if (studentIds.length > 0) {
        promises.push(
          db.query('students', { limit: 100 }).then(function (students) {
            students.forEach(function (s) { studentMap[s._id] = s.nameCn || s.nameEn || '未知'; });
          })
        );
      }
      if (parentIds.length > 0) {
        promises.push(
          db.query('users', { where: { role: 'parent' }, limit: 100 }).then(function (parents) {
            parents.forEach(function (p) { parentMap[p._id] = p.name || p.nickName || '未知'; });
          })
        );
      }

      return Promise.all(promises).then(function () {
        var list = bookings.map(function (b) {
          return {
            _id: b._id,
            date: b.date || '',
            timeSlot: b.timeSlot || '',
            studentName: studentMap[b.studentId] || '--',
            parentName: parentMap[b.parentId] || '--',
            type: b.type === 'trial' ? '试听' : '正式'
          };
        });
        // 按日期+时间段排序
        list.sort(function (a, b) {
          if (a.date !== b.date) return a.date > b.date ? -1 : 1;
          return a.timeSlot > b.timeSlot ? 1 : -1;
        });
        self.setData({ allBookings: list, loading: false });
      });
    }).catch(function (err) {
      console.error('加载全部约课失败:', err);
      self.setData({ loading: false });
    });
  },

  // 加载约课数据
  loadBookings: function () {
    var self = this;
    var teacherId = self.data.teacherId;
    var date = self.data.selectedDate;

    if (!teacherId || !date) {
      return;
    }

    self.setData({ loading: true });

    db.query('bookings', {
      where: {
        teacherId: teacherId,
        date: date,
        status: 'booked'
      },
      limit: 100
    }).then(function (bookings) {
      // 收集需要查询的学员ID和家长ID
      var studentIds = [];
      var parentIds = [];
      bookings.forEach(function (b) {
        if (b.studentId && studentIds.indexOf(b.studentId) === -1) {
          studentIds.push(b.studentId);
        }
        if (b.parentId && parentIds.indexOf(b.parentId) === -1) {
          parentIds.push(b.parentId);
        }
      });

      var studentMap = {};
      var parentMap = {};
      var promises = [];

      // 查询学员姓名
      if (studentIds.length > 0) {
        promises.push(
          db.query('students', { limit: 100 }).then(function (students) {
            students.forEach(function (s) {
              studentMap[s._id] = s.nameCn || s.nameEn || '未知';
            });
          })
        );
      }

      // 查询家长姓名
      if (parentIds.length > 0) {
        promises.push(
          db.query('users', {
            where: { role: 'parent' },
            limit: 100
          }).then(function (parents) {
            parents.forEach(function (p) {
              parentMap[p._id] = p.name || p.nickName || '未知';
            });
          })
        );
      }

      return Promise.all(promises).then(function () {
        // 按时段分组
        var slotBookingMap = {};
        bookings.forEach(function (b) {
          if (!slotBookingMap[b.timeSlot]) {
            slotBookingMap[b.timeSlot] = [];
          }
          slotBookingMap[b.timeSlot].push({
            _id: b._id,
            studentName: studentMap[b.studentId] || '--',
            parentName: parentMap[b.parentId] || '--'
          });
        });

        var timeSlots = TIME_SLOTS.map(function (slot) {
          var slotBookings = slotBookingMap[slot] || [];
          return {
            timeSlot: slot,
            hasBooking: slotBookings.length > 0,
            bookings: slotBookings
          };
        });

        self.setData({
          timeSlots: timeSlots,
          loading: false
        });
      });
    }).catch(function (err) {
      console.error('加载约课数据失败:', err);
      self.setData({ loading: false });
    });
  }
});