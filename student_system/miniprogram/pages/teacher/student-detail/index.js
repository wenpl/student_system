// pages/teacher/student-detail/index.js
var app = getApp();
var { calculateAge, formatDate, showLoading, hideLoading, showSuccess, showError } = require('../../../utils/util');
var db = require('../../../utils/db');

Page({
  data: {
    studentId: '',
    student: {},
    editNameEn: '',
    editEnglishLevel: '',
    englishLevelIndex: 0,
    englishLevelList: ['零基础', '简单单词', '简单句型'],
    commentContent: '',
    comments: []
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ studentId: options.id });
      this.loadStudent(options.id);
      this.loadComments(options.id);
    }
  },

  onShow: function () {
    if (this.data.studentId) {
      this.loadComments(this.data.studentId);
    }
  },

  // 加载学员信息
  loadStudent: function (id) {
    var self = this;
    showLoading('加载中...');
    db.queryById('students', id).then(function(student) {
      hideLoading();
      if (!student) {
        showError('学员不存在');
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

      var englishLevelIndex = self.data.englishLevelList.indexOf(student.englishLevel || '');

      self.setData({
        student: student,
        editNameEn: student.nameEn || '',
        editEnglishLevel: student.englishLevel || '',
        englishLevelIndex: englishLevelIndex >= 0 ? englishLevelIndex : 0
      });
    }).catch(function(err) {
      hideLoading();
      console.error('加载学员信息失败:', err);
      showError('加载失败');
    });
  },

  // 加载历史评语
  loadComments: function (studentId) {
    var self = this;
    db.query('comments', {
      where: { studentId: studentId },
      orderBy: { createTime: 'desc' },
      limit: 30
    }).then(function(comments) {
      var formattedComments = comments.map(function(c) {
        return {
          ...c,
          dateText: formatDate(c.createTime, 'YYYY-MM-DD')
        };
      });
      self.setData({ comments: formattedComments });
    }).catch(function(err) {
      console.error('加载评语失败:', err);
    });
  },

  // 输入英文名
  onNameEnInput: function (e) {
    this.setData({ editNameEn: e.detail.value });
  },

  // 选择英语水平
  onEnglishLevelChange: function (e) {
    var index = e.detail.value;
    this.setData({
      editEnglishLevel: this.data.englishLevelList[index],
      englishLevelIndex: index
    });
  },

  // 保存英文名
  saveNameEn: function () {
    var self = this;
    var nameEn = self.data.editNameEn.trim();

    if (!nameEn) {
      showError('请输入英文名');
      return;
    }

    showLoading('保存中...');
    db.update('students', self.data.studentId, {
      nameEn: nameEn
    }).then(function() {
      hideLoading();
      showSuccess('保存成功');
      self.setData({
        'student.nameEn': nameEn
      });
    }).catch(function(err) {
      hideLoading();
      console.error('保存英文名失败:', err);
      showError('保存失败');
    });
  },

  // 保存英语水平
  saveEnglishLevel: function () {
    var self = this;
    var englishLevel = self.data.editEnglishLevel;

    if (!englishLevel) {
      showError('请选择英语水平');
      return;
    }

    showLoading('保存中...');
    db.update('students', self.data.studentId, {
      englishLevel: englishLevel
    }).then(function() {
      hideLoading();
      showSuccess('保存成功');
      self.setData({
        'student.englishLevel': englishLevel
      });
    }).catch(function(err) {
      hideLoading();
      console.error('保存英语水平失败:', err);
      showError('保存失败');
    });
  },

  // 输入评语内容
  onCommentInput: function (e) {
    this.setData({ commentContent: e.detail.value });
  },

  // 提交课堂评语
  submitComment: function () {
    var self = this;
    var content = self.data.commentContent.trim();

    if (!content) {
      showError('请输入评语内容');
      return;
    }

    showLoading('提交中...');

    var teacherName = '';
    if (app.globalData.userInfo && app.globalData.userInfo.nickName) {
      teacherName = app.globalData.userInfo.nickName;
    }

    db.add('comments', {
      studentId: self.data.studentId,
      studentName: self.data.student.nameCn || '',
      teacherId: app.globalData.openid || '',
      teacherName: teacherName,
      content: content,
      createTime: new Date()
    }).then(function() {
      hideLoading();
      showSuccess('提交成功');
      self.setData({ commentContent: '' });
      // 重新加载评语列表
      self.loadComments(self.data.studentId);
    }).catch(function(err) {
      hideLoading();
      console.error('提交评语失败:', err);
      showError('提交失败');
    });
  }
});
