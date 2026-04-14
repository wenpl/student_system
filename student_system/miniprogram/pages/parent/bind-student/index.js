// pages/parent/bind-student/index.js
const app = getApp();
const { showLoading, hideLoading, showSuccess, showError } = require('../../../utils/util');
const db = require('../../../utils/db');

Page({
  data: {
    name: '',
    phone: '',
    school: '',
    relation: '',
    classList: [],
    selectedClassId: '',
    selectedClassName: '',
    studentList: [],
    selectedStudentId: '',
    selectedStudentName: '',
    step: 1 // 1: 选择班级, 2: 选择学员, 3: 填写信息
  },

  onLoad: function () {
    this.loadClassList();
  },

  // 加载班级列表
  loadClassList: function () {
    var self = this;
    db.query('classes', {}).then(function(classes) {
      self.setData({ classList: classes });
    }).catch(function(err) {
      console.error('加载班级失败:', err);
    });
  },

  // 选择班级
  onClassChange: function (e) {
    var index = e.detail.value;
    var selectedClass = this.data.classList[index];
    this.setData({
      selectedClassId: selectedClass._id,
      selectedClassName: selectedClass.name
    });
    this.loadStudentList(selectedClass._id);
  },

  // 加载学员列表
  loadStudentList: function (classId) {
    var self = this;
    db.query('students', {
      where: { classId: classId }
    }).then(function(students) {
      self.setData({ studentList: students });
    }).catch(function(err) {
      console.error('加载学员失败:', err);
    });
  },

  // 选择学员
  onStudentChange: function (e) {
    var index = e.detail.value;
    var selectedStudent = this.data.studentList[index];
    this.setData({
      selectedStudentId: selectedStudent._id,
      selectedStudentName: selectedStudent.nameCn
    });
  },

  // 输入就读学校
  onSchoolInput: function (e) {
    this.setData({ school: e.detail.value });
  },

  // 输入联系电话
  onPhoneInput: function (e) {
    this.setData({ phone: e.detail.value });
  },

  // 选择关系
  selectRelation: function (e) {
    var value = e.currentTarget.dataset.value;
    this.setData({ relation: value });
  },

  // 提交申请
  submitBind: function () {
    var self = this;
    var data = this.data;

    // 表单验证
    if (!data.selectedClassId) {
      showError('请选择班级');
      return;
    }
    if (!data.selectedStudentId) {
      showError('请选择学员');
      return;
    }
    if (!data.relation) {
      showError('请选择与学员关系');
      return;
    }
    if (!data.phone.trim() || data.phone.length !== 11) {
      showError('请输入正确的手机号');
      return;
    }

    showLoading('提交中...');

    // 检查是否已绑定
    db.query('bindings', {
      where: {
        userId: app.globalData.openid,
        studentId: data.selectedStudentId
      }
    }).then(function(existing) {
      if (existing.length > 0) {
        hideLoading();
        var status = existing[0].status;
        if (status === 'approved') {
          showError('您已绑定该学员');
        } else if (status === 'pending') {
          showError('已有待审核的绑定申请');
        } else {
          showError('该学员绑定申请曾被拒绝，请联系管理员');
        }
        return;
      }

      // 如果填写了就读学校，同步更新学员信息
      if (data.school.trim()) {
        db.update('students', data.selectedStudentId, {
          school: data.school
        }).catch(function(err) {
          console.error('更新学校信息失败:', err);
        });
      }

      // 创建绑定申请
      db.add('bindings', {
        userId: app.globalData.openid,
        userName: app.globalData.userInfo ? app.globalData.userInfo.nickName : '用户',
        studentId: data.selectedStudentId,
        studentName: data.selectedStudentName,
        classId: data.selectedClassId,
        className: data.selectedClassName,
        relation: data.relation,
        phone: data.phone,
        school: data.school,
        status: 'pending'
      }).then(function() {
        hideLoading();
        showSuccess('申请已提交，请等待审核');
        setTimeout(function() {
          wx.navigateBack();
        }, 1500);
      }).catch(function(err) {
        hideLoading();
        console.error('提交失败:', err);
        showError('提交失败，请重试');
      });
    }).catch(function(err) {
      hideLoading();
      console.error('查询失败:', err);
      showError('提交失败，请重试');
    });
  }
});
