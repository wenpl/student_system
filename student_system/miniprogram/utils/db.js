// utils/db.js - 云数据库操作封装

// 开发模式标识（设为false使用云数据库，true使用模拟数据）
const isDevMode = false;

// 模拟数据库
const mockDb = require('./mockDb');

// 云数据库（仅在非开发模式使用）
let cloudDb = null;
let cloudCommand = null;

if (!isDevMode) {
  try {
    cloudDb = wx.cloud.database();
    cloudCommand = cloudDb.command;
  } catch (err) {
    console.error('云数据库初始化失败:', err);
  }
}

// 根据模式选择数据库
const db = isDevMode ? mockDb : cloudDb;
const _ = isDevMode ? mockDb._ : cloudCommand;

/**
 * 通用查询方法
 * @param {string} collection 集合名称
 * @param {Object} options 查询选项
 * @returns {Promise<Array>} 查询结果
 */
const query = async (collection, options = {}) => {
  if (isDevMode) {
    return mockDb.query(collection, options);
  }

  const {
    where = {},
    field = {},
    orderBy = { createTime: 'desc' },
    limit = 20,
    skip = 0
  } = options;

  try {
    let query = cloudDb.collection(collection);

    if (Object.keys(where).length > 0) {
      query = query.where(where);
    }

    if (Object.keys(field).length > 0) {
      query = query.field(field);
    }

    // 应用排序
    for (const [key, order] of Object.entries(orderBy)) {
      query = query.orderBy(key, order);
    }

    const res = await query.skip(skip).limit(limit).get();
    return res.data;
  } catch (err) {
    console.error(`查询 ${collection} 失败:`, err);
    throw err;
  }
};

/**
 * 查询单条记录
 * @param {string} collection 集合名称
 * @param {string} id 记录ID
 * @returns {Promise<Object>} 查询结果
 */
const queryById = async (collection, id) => {
  if (isDevMode) {
    return mockDb.queryById(collection, id);
  }

  try {
    const res = await cloudDb.collection(collection).doc(id).get();
    return res.data;
  } catch (err) {
    console.error(`查询 ${collection} 记录失败:`, err);
    throw err;
  }
};

/**
 * 新增记录
 * @param {string} collection 集合名称
 * @param {Object} data 数据
 * @returns {Promise<string>} 新记录ID
 */
const add = async (collection, data) => {
  if (isDevMode) {
    return mockDb.add(collection, data);
  }

  try {
    const res = await cloudDb.collection(collection).add({
      data: {
        ...data,
        createTime: cloudDb.serverDate(),
        updateTime: cloudDb.serverDate()
      }
    });
    return res._id;
  } catch (err) {
    console.error(`新增 ${collection} 记录失败:`, err);
    throw err;
  }
};

/**
 * 更新记录
 * @param {string} collection 集合名称
 * @param {string} id 记录ID
 * @param {Object} data 更新数据
 * @returns {Promise<boolean>} 是否成功
 */
const update = async (collection, id, data) => {
  if (isDevMode) {
    return mockDb.update(collection, id, data);
  }

  try {
    await cloudDb.collection(collection).doc(id).update({
      data: {
        ...data,
        updateTime: cloudDb.serverDate()
      }
    });
    return true;
  } catch (err) {
    console.error(`更新 ${collection} 记录失败:`, err);
    throw err;
  }
};

/**
 * 删除记录
 * @param {string} collection 集合名称
 * @param {string} id 记录ID
 * @returns {Promise<boolean>} 是否成功
 */
const remove = async (collection, id) => {
  if (isDevMode) {
    return mockDb.remove(collection, id);
  }

  try {
    await cloudDb.collection(collection).doc(id).remove();
    return true;
  } catch (err) {
    console.error(`删除 ${collection} 记录失败:`, err);
    throw err;
  }
};

/**
 * 统计记录数
 * @param {string} collection 集合名称
 * @param {Object} where 查询条件
 * @returns {Promise<number>} 记录数
 */
const count = async (collection, where = {}) => {
  if (isDevMode) {
    return mockDb.count(collection, where);
  }

  try {
    const res = await cloudDb.collection(collection).where(where).count();
    return res.total;
  } catch (err) {
    console.error(`统计 ${collection} 记录数失败:`, err);
    throw err;
  }
};

/**
 * 批量查询（分页）
 * @param {string} collection 集合名称
 * @param {Object} options 查询选项
 * @returns {Promise<Object>} {data, hasMore}
 */
const queryWithPaging = async (collection, options = {}) => {
  const {
    where = {},
    field = {},
    orderBy = { createTime: 'desc' },
    pageSize = 20,
    pageNum = 1
  } = options;

  const skip = (pageNum - 1) * pageSize;
  const limit = pageSize + 1; // 多查一条判断是否有更多

  try {
    const data = await query(collection, { where, field, orderBy, limit, skip });
    const hasMore = data.length > pageSize;
    return {
      data: hasMore ? data.slice(0, pageSize) : data,
      hasMore
    };
  } catch (err) {
    throw err;
  }
};

module.exports = {
  db: { serverDate: () => isDevMode ? mockDb.serverDate() : cloudDb.serverDate() },
  _,
  query,
  queryById,
  add,
  update,
  remove,
  count,
  queryWithPaging
};
