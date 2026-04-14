// utils/mockDb.js - 开发模式模拟数据库（带本地持久化）

var STORAGE_KEY = 'mockDb_data';

// 获取今日日期
function getTodayDate() {
  var now = new Date();
  var year = now.getFullYear();
  var month = String(now.getMonth() + 1).padStart(2, '0');
  var day = String(now.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

// 生成唯一ID
function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 默认数据（空集合，通过管理员注册添加）
var defaultData = {
  classes: [],
  students: [],
  schedules: [],
  attendance: [],
  bookings: [],
  bindings: [],
  leaves: [],
  messages: [],
  notices: [],
  users: [
    // 内置管理员账号（系统需要至少一个管理员才能运行）
    { _id: 'admin1', openid: 'admin1', nickName: '管理员', role: 'admin', phone: '13800000000', password: 'admin123', notificationSettings: { classReminder: true, reminderTime: 30, noticeAlert: true } }
  ]
};

// 持久化：保存到本地缓存
function saveToDisk() {
  try {
    wx.setStorageSync(STORAGE_KEY, JSON.stringify(mockData));
  } catch (e) {
    console.error('mockDb 持久化失败:', e);
  }
}

// 持久化：从本地缓存加载
function loadFromDisk() {
  try {
    var raw = wx.getStorageSync(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('mockDb 加载缓存失败:', e);
  }
  return null;
}

// 数据迁移：确保旧缓存包含新增的集合和字段
function migrateData(saved) {
  // 补齐缺失的集合
  Object.keys(defaultData).forEach(function (key) {
    if (!saved[key]) {
      saved[key] = JSON.parse(JSON.stringify(defaultData[key]));
    }
  });
  // 确保 users 有 phone 和 openid 字段
  var defaultUsers = {};
  defaultData.users.forEach(function (u) {
    defaultUsers[u._id] = u;
  });
  saved.users.forEach(function (u) {
    var def = defaultUsers[u._id];
    if (def) {
      if (!u.phone) u.phone = def.phone;
      if (!u.openid) u.openid = def.openid;
      if (!u.password) u.password = def.password;
    }
  });
  // 补充缓存中缺失的默认用户
  defaultData.users.forEach(function (def) {
    var exists = saved.users.some(function (u) { return u._id === def._id; });
    if (!exists) {
      saved.users.push(JSON.parse(JSON.stringify(def)));
    }
  });
  return saved;
}

// 初始化：优先从缓存加载，否则使用默认数据
var savedData = loadFromDisk();
var mockData = savedData ? migrateData(savedData) : JSON.parse(JSON.stringify(defaultData));

// 模拟数据库操作
var mockDb = {
  // 模拟 command
  _: {
    eq: function (val) { return { __type: 'eq', value: val }; },
    neq: function (val) { return { __type: 'neq', value: val }; },
    in: function (arr) { return { __type: 'in', value: arr }; },
    gte: function (val) { return { __type: 'gte', value: val }; },
    lte: function (val) { return { __type: 'lte', value: val }; },
    elemMatch: function (condition) { return { __type: 'elemMatch', value: condition }; }
  },

  // 服务器时间
  serverDate: function () { return new Date(); },

  // 查询
  query: function (collection, options) {
    options = options || {};
    var where = options.where || {};
    var limit = options.limit || 20;
    var skip = options.skip || 0;
    var data = mockData[collection] || [];

    // 应用查询条件
    if (Object.keys(where).length > 0) {
      data = data.filter(function (item) {
        for (var key in where) {
          if (!where.hasOwnProperty(key)) continue;
          var condition = where[key];
          if (condition && typeof condition === 'object' && condition.__type) {
            if (condition.__type === 'eq') {
              if (item[key] !== condition.value) return false;
            } else if (condition.__type === 'neq') {
              if (item[key] === condition.value) return false;
            } else if (condition.__type === 'in') {
              if (!condition.value.includes(item[key])) return false;
            } else if (condition.__type === 'gte') {
              if (item[key] < condition.value) return false;
            } else if (condition.__type === 'lte') {
              if (item[key] > condition.value) return false;
            } else if (condition.__type === 'elemMatch') {
              if (!Array.isArray(item[key])) return false;
              if (condition.value.__type === 'eq') {
                if (!item[key].includes(condition.value.value)) return false;
              }
            }
          } else {
            if (item[key] !== condition) return false;
          }
        }
        return true;
      });
    }

    // 应用分页
    return Promise.resolve(data.slice(skip, skip + limit));
  },

  // 查询单条
  queryById: function (collection, id) {
    var data = mockData[collection] || [];
    var item = data.find(function (d) { return d._id === id; });
    return Promise.resolve(item || null);
  },

  // 新增
  add: function (collection, data) {
    if (!mockData[collection]) {
      mockData[collection] = [];
    }
    var id = generateId();
    var newItem = Object.assign({ _id: id }, data, {
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString()
    });
    mockData[collection].push(newItem);
    saveToDisk();
    return Promise.resolve(id);
  },

  // 更新
  update: function (collection, id, data) {
    var items = mockData[collection] || [];
    var index = items.findIndex(function (d) { return d._id === id; });
    if (index > -1) {
      mockData[collection][index] = Object.assign({}, mockData[collection][index], data, {
        updateTime: new Date().toISOString()
      });
      saveToDisk();
    }
    return Promise.resolve(true);
  },

  // 删除
  remove: function (collection, id) {
    var items = mockData[collection] || [];
    var index = items.findIndex(function (d) { return d._id === id; });
    if (index > -1) {
      mockData[collection].splice(index, 1);
      saveToDisk();
    }
    return Promise.resolve(true);
  },

  // 统计
  count: function (collection, where) {
    where = where || {};
    var data = mockData[collection] || [];

    if (Object.keys(where).length > 0) {
      data = data.filter(function (item) {
        for (var key in where) {
          if (!where.hasOwnProperty(key)) continue;
          var condition = where[key];
          if (condition && typeof condition === 'object' && condition.__type) {
            if (condition.__type === 'eq') {
              if (item[key] !== condition.value) return false;
            } else if (condition.__type === 'neq') {
              if (item[key] === condition.value) return false;
            } else if (condition.__type === 'lte') {
              if (item[key] > condition.value) return false;
            }
          } else {
            if (item[key] !== condition) return false;
          }
        }
        return true;
      });
    }

    return Promise.resolve(data.length);
  },

  // 重置数据（开发调试用）
  resetData: function () {
    var fresh = JSON.parse(JSON.stringify(defaultData));
    Object.keys(fresh).forEach(function (key) {
      mockData[key] = fresh[key];
    });
    saveToDisk();
  },

  // 获取模拟数据（用于调试）
  getMockData: function () { return mockData; }
};

module.exports = mockDb;
