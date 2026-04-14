// pages/teacher/index.js
const app = getApp();
const { formatDate, showLoading, hideLoading } = require('../../utils/util');
const db = require('../../utils/db');

Page({
  data: {
    userInfo: null,
    teacherId: '',
    classes: [],
    todayCourses: [],
    recentBookings: [],
    todayCourseCount: 0,
    unreadNoticeCount: 0
  },

  onLoad: function () {
    this.setData({
      userInfo: app.globalData.userInfo || { nickName: '老师' }
    });
  },

  onShow: function () {
    this.loadTeacherInfo();
  },

  onPullDownRefresh: function () {
    var self = this;
    this.loadData().then(function() {
      wx.stopPullDownRefresh();
    }).catch(function() {
      wx.stopPullDownRefresh();
    });
  },

  // 加载老师信息
  loadTeacherInfo: function () {
    var self = this;
    var openid = app.globalData.openid;

    if (!openid) {
      hideLoading();
      return;
    }

    // 查询 users 表中当前用户的 _id（班级里的 teacherId 存的是这个）
    db.query('users', {
      where: { openid: openid, role: 'teacher' }
    }).then(function(users) {
      if (users.length > 0) {
        var userId = users[0]._id;
        self.setData({ teacherId: userId });
        self.loadData(userId);
      } else {
        // 兜底：用 openid 查
        self.setData({ teacherId: openid });
        self.loadData(openid);
      }
    }).catch(function(err) {
      console.error('加载老师信息失败:', err);
      hideLoading();
    });
  },

  // 加载数据
  loadData: function (teacherId) {
    var self = this;
    showLoading('加载中...');

    Promise.all([
      self.loadClasses(teacherId),
      self.loadTodayCourses(teacherId),
      self.loadRecentBookings(teacherId),
      self.loadUnreadNoticeCount()
    ]).then(function() {
      hideLoading();
    }).catch(function(err) {
      hideLoading();
      console.error('加载数据失败:', err);
    });
  },

  // 加载班级列表
  loadClasses: function (teacherId) {
    var self = this;

    return db.query('classes', {
      where: { teacherId: teacherId }
    }).then(function(classes) {
      // 获取每个班级的学员数量
      var promises = classes.map(function(cls) {
        return db.query('students', {
          where: { classId: cls._id }
        }).then(function(students) {
          cls.studentCount = students.length;
          return cls;
        });
      });

      return Promise.all(promises).then(function(classesWithCount) {
        self.setData({ classes: classesWithCount });
      });
    }).catch(function(err) {
      console.error('加载班级失败:', err);
    });
  },

  // 加载今日课程
  loadTodayCourses: function (teacherId) {
    var self = this;
    var today = formatDate(new Date(), 'YYYY-MM-DD');

    return db.query('schedules', {
      where: {
        teacherId: teacherId,
        date: today
      }
    }).then(function(courses) {
      self.setData({
        todayCourses: courses,
        todayCourseCount: courses.length
      });
    }).catch(function(err) {
      console.error('加载今日课程失败:', err);
    });
  },

  // 加载最近约课
  loadRecentBookings: function (teacherId) {
    var self = this;

    return db.query('bookings', {
      where: {
        teacherId: teacherId,
        status: 'booked'
      },
      limit: 10
    }).then(function(bookings) {
      if (bookings.length === 0) {
        self.setData({ recentBookings: [] });
        return;
      }

      // 收集学员ID和家长ID
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
            students.forEach(function (s) { studentMap[s._id] = s.nameCn || '未知'; });
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
        // 按日期倒序
        list.sort(function (a, b) {
          if (a.date !== b.date) return a.date > b.date ? -1 : 1;
          return a.timeSlot > b.timeSlot ? 1 : -1;
        });
        self.setData({ recentBookings: list.slice(0, 5) });
      });
    }).catch(function(err) {
      console.error('加载最近约课失败:', err);
    });
  },

  // 加载未读公告数量
  loadUnreadNoticeCount: function () {
    var self = this;
    var openid = app.globalData.openid || '';

    return db.query('notices', {
      where: { status: 'published' },
      limit: 50
    }).then(function (notices) {
      var unreadCount = 0;
      notices.forEach(function (n) {
        var readBy = n.readBy || [];
        if (readBy.indexOf(openid) === -1) {
          unreadCount++;
        }
      });
      self.setData({ unreadNoticeCount: unreadCount });
    }).catch(function () {});
  },

  // 跳转到班级详情
  goToClassDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/teacher/class-detail/index?id=' + id
    });
  },

  // 跳转到约课信息
  goToBooking: function () {
    wx.navigateTo({
      url: '/pages/teacher/booking/index'
    });
  },

  // 跳转到公告查看
  goToNotice: function () {
    wx.navigateTo({
      url: '/pages/teacher/notice/index'
    });
  },

  // 跳转到课堂管理（跳转到第一个班级详情）
  goToClassManage: function () {
    var classes = this.data.classes;
    if (classes.length > 0) {
      wx.navigateTo({
        url: '/pages/teacher/class-detail/index?id=' + classes[0]._id
      });
    } else {
      wx.showToast({
        title: '暂无班级',
        icon: 'none'
      });
    }
  },

  // 跳转到个人中心
  goToProfile: function () {
    wx.navigateTo({
      url: '/pages/profile/index'
    });
  }
});
