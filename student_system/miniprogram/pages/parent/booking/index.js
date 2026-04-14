// pages/parent/booking/index.js
var app = getApp();
var formatDate = require('../../../utils/util').formatDate;
var showLoading = require('../../../utils/util').showLoading;
var hideLoading = require('../../../utils/util').hideLoading;
var showSuccess = require('../../../utils/util').showSuccess;
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
    studentId: '',
    studentInfo: {},
    classInfo: {},
    teacherInfo: {},
    dateList: [],
    selectedDate: '',
    timeSlots: [],
    selectedSlot: '',
    loadingSlots: false,
    // 学员选择
    studentList: [],
    showStudentPicker: false,
    // 老师选择
    teacherList: [],
    selectedTeacherId: '',
    selectedTeacherName: ''
  },

  onLoad: function (options) {
    var studentId = options.studentId || '';
    this.initDateList();
    this.loadTeachers(); // 页面加载时就获取老师列表

    if (studentId) {
      // 先检查学员是否已分班
      var self = this;
      db.queryById('students', studentId).then(function (student) {
        if (student && student.classId) {
          showError('已分班学员无需约课');
          setTimeout(function () { wx.navigateBack(); }, 1500);
          return;
        }
        self.setData({ studentId: studentId });
        self.loadStudentInfo(studentId);
      });
    } else {
      // 未指定学员，加载家长绑定的学员列表让用户选择
      this.loadMyStudents();
    }
  },

  onShow: function () {
    if (this.data.selectedDate && this.data.studentId) {
      this.loadBookedSlots(this.data.selectedDate);
    }
  },

  // 加载当前家长绑定的学员列表
  loadMyStudents: function () {
    var self = this;
    var openid = app.globalData.openid;

    db.query('bindings', {
      where: {
        userId: openid,
        status: 'approved'
      }
    }).then(function (bindings) {
      if (bindings.length === 0) {
        self.setData({ studentList: [], showStudentPicker: true });
        return;
      }

      var studentIds = bindings.map(function (b) { return b.studentId; });

      return db.query('students', { limit: 100 }).then(function (allStudents) {
        var myStudents = allStudents.filter(function (s) {
          return studentIds.indexOf(s._id) !== -1 && !s.classId;
        });

        self.setData({ studentList: myStudents });

        if (myStudents.length === 1) {
          // 只有一个孩子，自动选中
          self.selectStudent(myStudents[0]);
        } else if (myStudents.length > 1) {
          // 多个孩子，显示选择器
          self.setData({ showStudentPicker: true });
        } else {
          self.setData({ showStudentPicker: true });
        }
      });
    }).catch(function (err) {
      console.error('加载学员列表失败:', err);
    });
  },

  // 选择学员
  selectStudent: function (student) {
    if (!student) return;
    this.setData({
      studentId: student._id,
      showStudentPicker: false
    });
    this.loadStudentInfo(student._id);
    this.loadTeachers();
  },

  // 加载老师列表
  loadTeachers: function () {
    var self = this;
    db.query('users', {
      where: { role: 'teacher' },
      limit: 100
    }).then(function (teachers) {
      var list = teachers.map(function (t) {
        return {
          _id: t._id,
          name: t.name || t.nickName || '未知老师'
        };
      });
      self.setData({ teacherList: list });
    }).catch(function (err) {
      console.error('加载老师列表失败:', err);
    });
  },

  // 选择老师
  onTeacherChange: function (e) {
    var index = e.detail.value;
    var teacher = this.data.teacherList[index];
    if (teacher) {
      this.setData({
        selectedTeacherId: teacher._id,
        selectedTeacherName: teacher.name,
        selectedSlot: '' // 清空已选时段
      });
      // 重新加载该老师的已约时段
      if (this.data.selectedDate) {
        this.loadBookedSlots(this.data.selectedDate);
      }
    }
  },

  // 点击选择学员（从模板调用）
  onSelectStudent: function (e) {
    var index = e.currentTarget.dataset.index;
    var student = this.data.studentList[index];
    this.selectStudent(student);
  },

  // 切换学员
  changeStudent: function () {
    this.setData({
      showStudentPicker: true,
      studentId: '',
      studentInfo: {},
      classInfo: {},
      teacherInfo: {},
      selectedSlot: '',
      timeSlots: [],
      selectedTeacherId: '',
      selectedTeacherName: ''
    });
  },

  // 初始化日期列表（当前周+下一周，共14天）
  initDateList: function () {
    var days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    var today = new Date();
    var todayStr = formatDate(today, 'YYYY-MM-DD');
    var dateList = [];

    var dayOfWeek = today.getDay() || 7;
    var monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);

    for (var i = 0; i < 14; i++) {
      var d = new Date(monday);
      d.setDate(monday.getDate() + i);
      var dateStr = formatDate(d, 'YYYY-MM-DD');
      dateList.push({
        dateStr: dateStr,
        dateText: formatDate(d, 'MM/DD'),
        dayText: days[d.getDay()],
        isPast: dateStr < todayStr
      });
    }

    this.setData({
      dateList: dateList,
      selectedDate: todayStr
    });
  },

  // 加载学员信息
  loadStudentInfo: function (studentId) {
    var self = this;
    showLoading('加载中...');

    db.queryById('students', studentId).then(function (student) {
      if (!student) {
        hideLoading();
        showError('学员不存在');
        return;
      }
      self.setData({ studentInfo: student });

      var promises = [];

      if (student.classId) {
        promises.push(
          db.queryById('classes', student.classId).then(function (cls) {
            if (cls) self.setData({ classInfo: cls });
            return cls;
          })
        );
      }

      if (student.teacherId) {
        promises.push(
          db.queryById('users', student.teacherId).then(function (teacher) {
            if (teacher) {
              self.setData({ teacherInfo: { _id: teacher._id, name: teacher.name || teacher.nickName || '未知' } });
            }
            return teacher;
          })
        );
      } else if (student.classId) {
        promises.push(
          db.queryById('classes', student.classId).then(function (cls) {
            if (cls && cls.teacherId) {
              return db.queryById('users', cls.teacherId).then(function (teacher) {
                if (teacher) {
                  self.setData({ teacherInfo: { _id: teacher._id, name: teacher.name || teacher.nickName || '未知' } });
                }
                return teacher;
              });
            }
          })
        );
      }

      return Promise.all(promises);
    }).then(function () {
      hideLoading();
      if (self.data.selectedDate) {
        self.loadBookedSlots(self.data.selectedDate);
      }
    }).catch(function (err) {
      hideLoading();
      console.error('加载学员信息失败:', err);
      showError('加载失败');
    });
  },

  // 选择日期
  selectDate: function (e) {
    var date = e.currentTarget.dataset.date;
    var isPast = e.currentTarget.dataset.past;

    if (isPast) {
      showError('不能选择过去的日期');
      return;
    }

    this.setData({
      selectedDate: date,
      selectedSlot: ''
    });

    this.loadBookedSlots(date);
  },

  // 加载已约时段（按老师维度查询，一个老师一个时段只能约一次）
  loadBookedSlots: function (date) {
    var self = this;
    var teacherId = self.data.selectedTeacherId;

    if (!teacherId) {
      // 未选择老师时，显示所有时段可选
      var slots = TIME_SLOTS.map(function (slot) {
        return { timeSlot: slot, booked: false };
      });
      self.setData({ timeSlots: slots });
      return;
    }

    self.setData({ loadingSlots: true });

    // 查询该老师在选定日期的已约时段
    db.query('bookings', {
      where: {
        teacherId: teacherId,
        date: date,
        status: 'booked'
      },
      limit: 100
    }).then(function (bookings) {
      var bookedSlots = {};
      bookings.forEach(function (b) {
        bookedSlots[b.timeSlot] = true;
      });

      var slots = TIME_SLOTS.map(function (slot) {
        return {
          timeSlot: slot,
          booked: !!bookedSlots[slot]
        };
      });

      self.setData({
        timeSlots: slots,
        loadingSlots: false
      });
    }).catch(function (err) {
      console.error('查询约课失败:', err);
      self.setData({ loadingSlots: false });
    });
  },

  // 选择时段
  selectSlot: function (e) {
    var slot = e.currentTarget.dataset.slot;
    var booked = e.currentTarget.dataset.booked;

    if (booked) return;

    this.setData({ selectedSlot: slot });
  },

  // 提交约课
  submitBooking: function () {
    var self = this;
    var studentId = self.data.studentId;
    var teacherId = self.data.selectedTeacherId || '';
    var classId = self.data.studentInfo.classId || '';
    var parentId = app.globalData.openid;
    var date = self.data.selectedDate;
    var timeSlot = self.data.selectedSlot;

    if (!studentId) {
      showError('请先选择学员');
      return;
    }
    if (!teacherId) {
      showError('请选择老师');
      return;
    }
    if (!date || !timeSlot) {
      showError('请选择日期和时段');
      return;
    }

    wx.showModal({
      title: '确认预约',
      content: '预约 ' + date + ' ' + timeSlot + ' 的课程？',
      success: function (res) {
        if (res.confirm) {
          showLoading('提交中...');

          // 查重：检查该学员在该日期该时段是否已预约
          var checkPromise = db.query('bookings', {
            where: {
              studentId: studentId,
              date: date,
              timeSlot: timeSlot,
              status: 'booked'
            }
          });

          checkPromise.then(function (existing) {
            if (existing.length > 0) {
              hideLoading();
              showError('该时段已被预约');
              self.loadBookedSlots(date);
              return;
            }

            var bookingData = {
              studentId: studentId,
              teacherId: teacherId,
              classId: classId,
              parentId: parentId,
              date: date,
              timeSlot: timeSlot,
              status: 'booked'
            };
            // 无班级学员标记为试听课
            if (!classId) {
              bookingData.type = 'trial';
            }
            return db.add('bookings', bookingData).then(function () {
              hideLoading();
              showSuccess('预约成功');
              self.setData({ selectedSlot: '' });
              self.loadBookedSlots(date);
            });
          }).catch(function (err) {
            hideLoading();
            console.error('提交约课失败:', err);
            showError('预约失败: ' + (err.message || '请检查网络'));
          });
        }
      }
    });
  },

  // 跳转约课记录
  goToBookingList: function () {
    wx.navigateTo({
      url: '/pages/parent/booking-list/index'
    });
  }
});
