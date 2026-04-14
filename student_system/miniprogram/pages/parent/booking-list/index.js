// pages/parent/booking-list/index.js
var app = getApp();
var formatDate = require('../../../utils/util').formatDate;
var showLoading = require('../../../utils/util').showLoading;
var hideLoading = require('../../../utils/util').hideLoading;
var showSuccess = require('../../../utils/util').showSuccess;
var showError = require('../../../utils/util').showError;
var db = require('../../../utils/db');

Page({
  data: {
    bookings: [],
    loading: false
  },

  onLoad: function () {
    this.loadBookings();
  },

  onShow: function () {
    this.loadBookings();
  },

  // 加载约课记录
  loadBookings: function () {
    var self = this;
    var parentId = app.globalData.openid;

    self.setData({ loading: true });
    showLoading('加载中...');

    db.query('bookings', {
      where: {
        parentId: parentId
      },
      orderBy: { date: 'desc' },
      limit: 100
    }).then(function (bookings) {
      var today = formatDate(new Date(), 'YYYY-MM-DD');

      // 需要查询学员和老师名称
      var studentIds = [];
      var teacherIds = [];
      bookings.forEach(function (b) {
        if (b.studentId && studentIds.indexOf(b.studentId) === -1) {
          studentIds.push(b.studentId);
        }
        if (b.teacherId && teacherIds.indexOf(b.teacherId) === -1) {
          teacherIds.push(b.teacherId);
        }
      });

      var studentMap = {};
      var teacherMap = {};

      var promises = [];

      // 批量查学员
      if (studentIds.length > 0) {
        promises.push(
          db.query('students', { limit: 100 }).then(function (students) {
            students.forEach(function (s) {
              studentMap[s._id] = s.nameCn || s.nameEn || '未知';
            });
          })
        );
      }

      // 批量查老师
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

      return Promise.all(promises).then(function () {
        var statusMap = {
          booked: '已预约',
          cancelled: '已取消',
          completed: '已完成'
        };

        var formattedBookings = bookings.map(function (b) {
          var canCancel = b.status === 'booked' && b.date >= today;
          return {
            _id: b._id,
            date: b.date,
            timeSlot: b.timeSlot,
            status: b.status,
            statusText: statusMap[b.status] || b.status,
            teacherName: teacherMap[b.teacherId] || '--',
            studentName: studentMap[b.studentId] || '--',
            canCancel: canCancel
          };
        });

        self.setData({
          bookings: formattedBookings,
          loading: false
        });
        hideLoading();
      });
    }).catch(function (err) {
      hideLoading();
      self.setData({ loading: false });
      console.error('加载约课记录失败:', err);
    });
  },

  // 取消预约
  cancelBooking: function (e) {
    var self = this;
    var id = e.currentTarget.dataset.id;
    var index = e.currentTarget.dataset.index;
    var booking = self.data.bookings[index];

    wx.showModal({
      title: '取消预约',
      content: '确定取消 ' + booking.date + ' ' + booking.timeSlot + ' 的预约？',
      success: function (res) {
        if (res.confirm) {
          showLoading('取消中...');

          db.update('bookings', id, {
            status: 'cancelled'
          }).then(function () {
            hideLoading();
            showSuccess('已取消');
            self.loadBookings();
          }).catch(function (err) {
            hideLoading();
            console.error('取消预约失败:', err);
            showError('取消失败');
          });
        }
      }
    });
  }
});