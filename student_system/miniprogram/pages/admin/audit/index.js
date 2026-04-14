// pages/admin/audit/index.js
const app = getApp();
const { formatDate, showLoading, hideLoading, showSuccess, showError } = require('../../../utils/util');
const db = require('../../../utils/db');

Page({
  data: {
    pendingList: [],
    processedList: [],
    currentTab: 'pending'
  },

  onLoad: function () {
    this.loadData();
  },

  onShow: function () {
    this.loadData();
  },

  loadData: function () {
    var self = this;
    showLoading('加载中...');

    Promise.all([
      self.loadPendingList(),
      self.loadProcessedList()
    ]).then(function() {
      hideLoading();
    }).catch(function(err) {
      hideLoading();
      console.error('加载数据失败:', err);
    });
  },

  // 加载待审核列表
  loadPendingList: function () {
    var self = this;
    return db.query('bindings', {
      where: { status: 'pending' }
    }).then(function(list) {
      var formattedList = list.map(function(item) {
        return {
          ...item,
          createTimeText: formatDate(item.createTime, 'MM-DD HH:mm'),
          relationText: self.getRelationText(item.relation)
        };
      });
      self.setData({ pendingList: formattedList });
    });
  },

  // 加载已处理列表
  loadProcessedList: function () {
    var self = this;
    return db.query('bindings', {
      where: { status: 'approved' },
      limit: 20
    }).then(function(approvedList) {
      return db.query('bindings', {
        where: { status: 'rejected' },
        limit: 20
      }).then(function(rejectedList) {
        var list = approvedList.concat(rejectedList);
        var formattedList = list.map(function(item) {
          return {
            ...item,
            statusText: item.status === 'approved' ? '已通过' : '已拒绝',
            relationText: self.getRelationText(item.relation)
          };
        });
        self.setData({ processedList: formattedList });
      });
    });
  },

  // 获取关系文本
  getRelationText: function (relation) {
    var relationMap = {
      'father': '父亲',
      'mother': '母亲',
      'other': '其他'
    };
    return relationMap[relation] || relation;
  },

  // 切换标签
  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
  },

  // 通过审核
  approve: function (e) {
    var self = this;
    var id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '提示',
      content: '确定通过该绑定申请？',
      success: function(res) {
        if (res.confirm) {
          showLoading('处理中...');

          // 先查询绑定记录获取 studentId 和 userId
          db.queryById('bindings', id).then(function(binding) {
            if (!binding) {
              hideLoading();
              showError('绑定记录不存在');
              return;
            }

            // 更新绑定状态
            return db.update('bindings', id, {
              status: 'approved',
              approveTime: new Date(),
              approverId: app.globalData.openid
            }).then(function() {
              // 同步更新学员的 parentIds
              return db.queryById('students', binding.studentId);
            }).then(function(student) {
              if (student) {
                var parentIds = student.parentIds || [];
                if (parentIds.indexOf(binding.userId) === -1) {
                  parentIds.push(binding.userId);
                  return db.update('students', binding.studentId, {
                    parentIds: parentIds
                  });
                }
              }
            }).then(function() {
              hideLoading();
              showSuccess('已通过');
              self.loadData();
            });
          }).catch(function(err) {
            hideLoading();
            console.error('操作失败:', err);
            showError('操作失败');
          });
        }
      }
    });
  },

  // 拒绝审核
  reject: function (e) {
    var self = this;
    var id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '提示',
      content: '确定拒绝该绑定申请？',
      success: function(res) {
        if (res.confirm) {
          showLoading('处理中...');

          db.update('bindings', id, {
            status: 'rejected',
            approveTime: new Date(),
            approverId: app.globalData.openid
          }).then(function() {
            hideLoading();
            showSuccess('已拒绝');
            self.loadData();
          }).catch(function(err) {
            hideLoading();
            console.error('操作失败:', err);
            showError('操作失败');
          });
        }
      }
    });
  }
});
