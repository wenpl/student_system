// pages/admin/student/index.js
const app = getApp();
const { formatDate, showLoading, hideLoading, showSuccess, showError } = require('../../../utils/util');
const db = require('../../../utils/db');

Page({
  data: {
    students: [],
    classList: [],
    keyword: '',
    filterClass: '',
    showFilter: false
  },

  onLoad: function () {
    this.loadData();
  },

  onShow: function () {
    this.loadData();
  },

  loadData: function () {
    const self = this;
    showLoading('加载中...');

    Promise.all([
      self.loadStudents(),
      self.loadClasses()
    ]).then(function() {
      hideLoading();
    }).catch(function(err) {
      hideLoading();
      console.error('加载数据失败:', err);
    });
  },

  loadClasses: function () {
    const self = this;
    return db.query('classes', {}).then(function(classes) {
      self.setData({ classList: classes });
    });
  },

  loadStudents: function () {
    const self = this;
    const keyword = self.data.keyword;
    const filterClass = self.data.filterClass;

    return db.query('students', {}).then(function(students) {
      // 过滤搜索
      let filtered = students;
      if (keyword) {
        filtered = filtered.filter(function(s) {
          return s.nameCn.indexOf(keyword) > -1 || (s.nameEn && s.nameEn.toLowerCase().indexOf(keyword.toLowerCase()) > -1);
        });
      }
      if (filterClass) {
        filtered = filtered.filter(function(s) {
          return s.classId === filterClass;
        });
      }

      // 格式化数据
      const formattedStudents = filtered.map(function(s) {
        return {
          ...s
        };
      });

      self.setData({ students: formattedStudents });
    });
  },

  // 搜索
  onSearch: function (e) {
    this.setData({ keyword: e.detail.value });
    this.loadStudents();
  },

  // 显示筛选
  toggleFilter: function () {
    this.setData({ showFilter: !this.data.showFilter });
  },

  // 选择班级筛选
  selectClass: function (e) {
    const classId = e.currentTarget.dataset.id;
    this.setData({
      filterClass: classId === this.data.filterClass ? '' : classId,
      showFilter: false
    });
    this.loadStudents();
  },

  // 清除筛选
  clearFilter: function () {
    this.setData({
      keyword: '',
      filterClass: '',
      showFilter: false
    });
    this.loadStudents();
  },

  // 新增学员
  addStudent: function () {
    wx.navigateTo({ url: '/pages/admin/student/edit/index' });
  },

  // 编辑学员
  editStudent: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/admin/student/edit/index?id=' + id });
  },

  // 查看详情
  viewDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/parent/student-detail/index?id=' + id });
  },

  // 删除学员
  deleteStudent: function (e) {
    const self = this;
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '提示',
      content: '确定要删除该学员吗？',
      success: function(res) {
        if (res.confirm) {
          showLoading('删除中...');
          db.remove('students', id).then(function() {
            hideLoading();
            showSuccess('删除成功');
            self.loadStudents();
          }).catch(function(err) {
            hideLoading();
            showError('删除失败');
          });
        }
      }
    });
  }
});
