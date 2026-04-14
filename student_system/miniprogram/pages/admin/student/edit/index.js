// pages/admin/student/edit/index.js
const app = getApp();
const { showLoading, hideLoading, showSuccess, showError } = require('../../../../utils/util');
const db = require('../../../../utils/db');

Page({
  data: {
    id: '',
    nameCn: '',
    nameEn: '',
    gender: '',
    birthday: '',
    school: '',
    classId: '',
    className: '',
    parentName: '',
    phone: '',
    emergencyPhone: '',
    englishLevel: '',
    englishLevelIndex: 0,
    englishLevelList: ['零基础', '简单单词', '简单句型'],
    enrollDate: '',
    classList: [],
    isEdit: false
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ id: options.id, isEdit: true });
      this.loadStudent(options.id);
    }
    this.loadClasses();
  },

  loadClasses: function () {
    var self = this;
    db.query('classes', {}).then(function(classes) {
      self.setData({ classList: classes });
    });
  },

  loadStudent: function (id) {
    var self = this;
    showLoading('加载中...');
    db.queryById('students', id).then(function(student) {
      hideLoading();
      if (student) {
        var englishLevelIndex = self.data.englishLevelList.indexOf(student.englishLevel || '');
        self.setData({
          nameCn: student.nameCn || '',
          nameEn: student.nameEn || '',
          gender: student.gender || '',
          birthday: student.birthday || '',
          school: student.school || '',
          classId: student.classId || '',
          className: student.className || '',
          parentName: student.parentName || '',
          phone: student.phone || '',
          emergencyPhone: student.emergencyPhone || '',
          englishLevel: student.englishLevel || '',
          englishLevelIndex: englishLevelIndex >= 0 ? englishLevelIndex : 0,
          enrollDate: student.enrollDate || ''
        });
      }
    }).catch(function(err) {
      hideLoading();
      showError('加载失败');
    });
  },

  // 输入姓名
  onNameCnInput: function (e) {
    this.setData({ nameCn: e.detail.value });
  },

  onNameEnInput: function (e) {
    this.setData({ nameEn: e.detail.value });
  },

  // 选择性别
  onGenderChange: function (e) {
    var value = e.currentTarget.dataset.value;
    this.setData({ gender: value });
  },

  // 选择出生日期
  onBirthdayChange: function (e) {
    this.setData({ birthday: e.detail.value });
  },

  // 输入就读学校
  onSchoolInput: function (e) {
    this.setData({ school: e.detail.value });
  },

  // 选择班级
  onClassChange: function (e) {
    var index = e.detail.value;
    var selectedClass = this.data.classList[index];
    this.setData({
      classId: selectedClass._id,
      className: selectedClass.name
    });
  },

  // 输入家长姓名
  onParentNameInput: function (e) {
    this.setData({ parentName: e.detail.value });
  },

  // 输入电话
  onPhoneInput: function (e) {
    this.setData({ phone: e.detail.value });
  },

  // 输入紧急联系电话
  onEmergencyPhoneInput: function (e) {
    this.setData({ emergencyPhone: e.detail.value });
  },

  // 选择英语基础
  onEnglishLevelChange: function (e) {
    var index = e.detail.value;
    this.setData({
      englishLevel: this.data.englishLevelList[index],
      englishLevelIndex: index
    });
  },

  // 选择报名日期
  onEnrollDateChange: function (e) {
    this.setData({ enrollDate: e.detail.value });
  },

  // 保存
  save: function () {
    var self = this;
    var formData = self.data;

    // 验证
    if (!formData.nameCn.trim()) {
      showError('请输入学员姓名');
      return;
    }
    if (!formData.classId) {
      showError('请选择班级');
      return;
    }

    showLoading('保存中...');

    var data = {
      nameCn: formData.nameCn,
      nameEn: formData.nameEn,
      gender: formData.gender,
      birthday: formData.birthday,
      school: formData.school,
      classId: formData.classId,
      className: formData.className,
      parentName: formData.parentName,
      phone: formData.phone,
      emergencyPhone: formData.emergencyPhone,
      englishLevel: formData.englishLevel,
      enrollDate: formData.enrollDate
    };

    if (formData.isEdit) {
      db.update('students', formData.id, data).then(function() {
        hideLoading();
        showSuccess('保存成功');
        setTimeout(function() {
          wx.navigateBack();
        }, 1500);
      }).catch(function(err) {
        hideLoading();
        showError('保存失败');
      });
    } else {
      db.add('students', {
        ...data,
        parentIds: [],
        createTime: new Date()
      }).then(function() {
        hideLoading();
        showSuccess('添加成功');
        setTimeout(function() {
          wx.navigateBack();
        }, 1500);
      }).catch(function(err) {
        hideLoading();
        showError('添加失败');
      });
    }
  }
});
