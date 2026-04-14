// pages/parent/index.js
const app = getApp();
const { formatDate, showLoading, hideLoading } = require('../../utils/util');
const db = require('../../utils/db');

Page({
  data: {
    userInfo: null,
    students: [],
    todayCourses: [],
    pendingBindings: [],
    hasBinding: false,
    unreadNoticeCount: 0,
    // 创建学员弹窗
    showAddStudent: false,
    newStudentName: '',
    newStudentGender: '',
    newStudentSchool: ''
  },

  onLoad: function () {
    this.setData({
      userInfo: app.globalData.userInfo || { nickName: '用户' }
    });
  },

  onShow: function () {
    this.loadData();
  },

  onPullDownRefresh: function () {
    var self = this;
    this.loadData().then(function() {
      wx.stopPullDownRefresh();
    }).catch(function() {
      wx.stopPullDownRefresh();
    });
  },

  // 加载数据
  loadData: function () {
    var self = this;
    showLoading('加载中...');

    return self.loadBindings().then(function() {
      return Promise.all([
        self.loadStudents(),
        self.loadTodayCourses(),
        self.loadUnreadNoticeCount()
      ]);
    }).then(function() {
      hideLoading();
    }).catch(function(err) {
      hideLoading();
      console.error('加载数据失败:', err);
    });
  },

  // 加载绑定关系
  loadBindings: function () {
    var self = this;
    return db.query('bindings', {
      where: {
        userId: app.globalData.openid,
        status: 'approved'
      }
    }).then(function(bindings) {
      var studentIds = bindings.map(function(b) { return b.studentId; });
      self.setData({
        bindings: bindings,
        studentIds: studentIds,
        hasBinding: studentIds.length > 0
      });

      // 同时查询待审核的绑定
      return db.query('bindings', {
        where: {
          userId: app.globalData.openid,
          status: 'pending'
        }
      });
    }).then(function(pendingBindings) {
      self.setData({ pendingBindings: pendingBindings });
    });
  },

  // 加载学员列表
  loadStudents: function () {
    var self = this;
    var studentIds = self.data.studentIds || [];

    if (studentIds.length === 0) {
      self.setData({ students: [] });
      return Promise.resolve();
    }

    return db.query('students', {}).then(function(allStudents) {
      var students = allStudents.filter(function(s) {
        return studentIds.indexOf(s._id) !== -1;
      });

      // 获取班级名称
      var classIds = [];
      students.forEach(function(s) {
        if (s.classId && classIds.indexOf(s.classId) === -1) {
          classIds.push(s.classId);
        }
      });

      if (classIds.length === 0) {
        self.setData({ students: students });
        return;
      }

      return db.query('classes', {}).then(function(classes) {
        var classMap = {};
        classes.forEach(function(c) {
          classMap[c._id] = c.name;
        });

        var studentsWithClass = students.map(function(s) {
          return {
            ...s,
            className: classMap[s.classId] || '未分班'
          };
        });

        self.setData({ students: studentsWithClass });
      });
    });
  },

  // 加载今日课程
  loadTodayCourses: function () {
    var self = this;
    var today = formatDate(new Date(), 'YYYY-MM-DD');
    var studentIds = self.data.studentIds || [];

    if (studentIds.length === 0) {
      self.setData({ todayCourses: [] });
      return Promise.resolve();
    }

    // 获取学员所在班级
    return db.query('students', {}).then(function(allStudents) {
      var students = allStudents.filter(function(s) {
        return studentIds.indexOf(s._id) !== -1;
      });

      var classIds = students.map(function(s) { return s.classId; }).filter(Boolean);

      if (classIds.length === 0) {
        self.setData({ todayCourses: [] });
        return;
      }

      return db.query('schedules', {
        where: { date: today }
      }).then(function(schedules) {
        var todayCourses = schedules.filter(function(s) {
          return classIds.indexOf(s.classId) !== -1;
        });
        self.setData({ todayCourses: todayCourses });
      });
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
        var deletedBy = n.deletedBy || [];
        if (readBy.indexOf(openid) === -1 && deletedBy.indexOf(openid) === -1) {
          unreadCount++;
        }
      });
      self.setData({ unreadNoticeCount: unreadCount });
    }).catch(function () {
      // 忽略错误
    });
  },

  // 跳转到绑定学员
  goToBindStudent: function () {
    wx.navigateTo({
      url: '/pages/parent/bind-student/index'
    });
  },

  // 跳转到学员详情
  goToStudentDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/parent/student-detail/index?id=' + id
    });
  },

  // 跳转到课表
  goToSchedule: function () {
    wx.navigateTo({
      url: '/pages/parent/schedule/index'
    });
  },

  // 跳转到约课
  goToBooking: function () {
    wx.navigateTo({
      url: '/pages/parent/booking/index'
    });
  },

  // 跳转到公告
  goToNotice: function () {
    wx.navigateTo({
      url: '/pages/parent/message/index?tab=notice'
    });
  },

  // 跳转到消息
  goToMessage: function () {
    wx.navigateTo({
      url: '/pages/parent/message/index'
    });
  },


  // ===== 创建学员 =====
  showAddStudentModal: function () {
    this.setData({ showAddStudent: true, newStudentName: '', newStudentGender: '', newStudentSchool: '' });
  },

  hideAddStudentModal: function () {
    this.setData({ showAddStudent: false });
  },

  onNewStudentNameInput: function (e) {
    this.setData({ newStudentName: e.detail.value });
  },

  onNewStudentGenderChange: function (e) {
    this.setData({ newStudentGender: e.currentTarget.dataset.value });
  },

  onNewStudentSchoolInput: function (e) {
    this.setData({ newStudentSchool: e.detail.value });
  },

  submitAddStudent: function () {
    var self = this;
    var name = self.data.newStudentName.trim();
    var gender = self.data.newStudentGender;
    var school = self.data.newStudentSchool.trim();
    var openid = app.globalData.openid;
    var parentName = app.globalData.userInfo ? app.globalData.userInfo.nickName : '';

    if (!name) {
      wx.showToast({ title: '请输入孩子姓名', icon: 'none' });
      return;
    }

    showLoading('创建中...');

    // 1. 创建学员记录
    db.add('students', {
      nameCn: name,
      gender: gender,
      school: school,
      parentName: parentName,
      parentIds: [openid],
    }).then(function (studentId) {
      // 2. 自动创建已通过的绑定记录
      return db.add('bindings', {
        userId: openid,
        userName: parentName,
        studentId: studentId,
        studentName: name,
        relation: 'parent',
        status: 'approved',
        approveTime: new Date()
      }).then(function () {
        hideLoading();
        wx.showToast({ title: '添加成功', icon: 'success' });
        self.setData({ showAddStudent: false });
        self.loadData();
      });
    }).catch(function (err) {
      hideLoading();
      console.error('创建学员失败:', err);
      wx.showToast({ title: '创建失败', icon: 'none' });
    });
  },

  // 跳转到个人中心
  goToProfile: function () {
    wx.navigateTo({
      url: '/pages/profile/index'
    });
  }
});
