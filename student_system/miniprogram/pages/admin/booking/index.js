// pages/admin/booking/index.js
var app = getApp();
var formatDate = require('../../../utils/util').formatDate;
var showLoading = require('../../../utils/util').showLoading;
var hideLoading = require('../../../utils/util').hideLoading;
var showError = require('../../../utils/util').showError;
var db = require('../../../utils/db');

Page({
  data: {
    teacherOptions: [{ _id: '', name: '全部' }],
    teacherIndex: 0,
    selectedDate: '',
    allBookings: [],
    filteredBookings: [],
    loading: false
  },

  onLoad: function () {
    this.loadTeachers();
    this.loadBookings();
  },

  onShow: function () {
    this.loadBookings();
  },

  // 加载老师列表
  loadTeachers: function () {
    var self = this;

    db.query('users', {
      where: { role: 'teacher' },
      limit: 100
    }).then(function (teachers) {
      var options = [{ _id: '', name: '全部' }];
      teachers.forEach(function (t) {
        options.push({
          _id: t._id,
          name: t.name || t.nickName || '未知老师'
        });
      });
      self.setData({ teacherOptions: options });
    }).catch(function (err) {
      console.error('加载老师列表失败:', err);
    });
  },

  // 加载所有约课记录
  loadBookings: function () {
    var self = this;
    self.setData({ loading: true });
    showLoading('加载中...');

    db.query('bookings', {
      orderBy: { date: 'desc' },
      limit: 100
    }).then(function (bookings) {
      // 收集需要查询的ID
      var studentIds = [];
      var teacherIds = [];
      var parentIds = [];

      bookings.forEach(function (b) {
        if (b.studentId && studentIds.indexOf(b.studentId) === -1) {
          studentIds.push(b.studentId);
        }
        if (b.teacherId && teacherIds.indexOf(b.teacherId) === -1) {
          teacherIds.push(b.teacherId);
        }
        if (b.parentId && parentIds.indexOf(b.parentId) === -1) {
          parentIds.push(b.parentId);
        }
      });

      var studentMap = {};
      var teacherMap = {};
      var parentMap = {};
      var promises = [];

      // 查询学员
      if (studentIds.length > 0) {
        promises.push(
          db.query('students', { limit: 100 }).then(function (students) {
            students.forEach(function (s) {
              studentMap[s._id] = s.nameCn || s.nameEn || '未知';
            });
          })
        );
      }

      // 查询老师
      if (teacherIds.length > 0) {
        promises.push(
          db.query('users', {
            where: { role: 'teacher' },
            limit: 100
          }).then(function (teachers) {
            teachers.forEach(function (t) {
              teacherMap[t._id] = t.name || t.nickName || '未知';
            });
          })
        );
      }

      // 查询家长
      if (parentIds.length > 0) {
        promises.push(
          db.query('users', {
            where: { role: 'parent' },
            limit: 100
          }).then(function (parents) {
            parents.forEach(function (p) {
              // 用 _id 作为 key，因为 parentId 存的是用户的 _id
              parentMap[p._id] = {
                name: p.name || p.nickName || '未知',
                phone: p.phone || '--'
              };
            });
          })
        );
      }

      return Promise.all(promises).then(function () {
        var statusMap = {
          booked: '已预约',
          cancelled: '已取消',
          completed: '已完成'
        };

        var formattedBookings = bookings.map(function (b) {
          var parentInfo = parentMap[b.parentId] || { name: '--', phone: '--' };
          return {
            _id: b._id,
            date: b.date,
            timeSlot: b.timeSlot,
            status: b.status,
            statusText: statusMap[b.status] || b.status,
            studentId: b.studentId,
            teacherId: b.teacherId,
            parentId: b.parentId,
            studentName: studentMap[b.studentId] || '--',
            teacherName: teacherMap[b.teacherId] || '--',
            parentName: parentInfo.name,
            parentPhone: parentInfo.phone
          };
        });

        self.setData({
          allBookings: formattedBookings,
          loading: false
        });
        self.applyFilter();
        hideLoading();
      });
    }).catch(function (err) {
      hideLoading();
      self.setData({ loading: false });
      console.error('加载约课记录失败:', err);
    });
  },

  // 老师筛选
  onTeacherChange: function (e) {
    this.setData({ teacherIndex: e.detail.value });
    this.applyFilter();
  },

  // 日期筛选
  onDateChange: function (e) {
    this.setData({ selectedDate: e.detail.value });
    this.applyFilter();
  },

  // 重置筛选
  resetFilter: function () {
    this.setData({
      teacherIndex: 0,
      selectedDate: ''
    });
    this.applyFilter();
  },

  // 应用筛选
  applyFilter: function () {
    var self = this;
    var allBookings = self.data.allBookings;
    var teacherId = self.data.teacherOptions[self.data.teacherIndex]._id;
    var date = self.data.selectedDate;

    var filtered = allBookings.filter(function (b) {
      var matchTeacher = !teacherId || b.teacherId === teacherId;
      var matchDate = !date || b.date === date;
      return matchTeacher && matchDate;
    });

    self.setData({ filteredBookings: filtered });
  }
});