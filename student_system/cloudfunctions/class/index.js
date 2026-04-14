// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, data } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  switch (action) {
    case 'list':
      return await getClassList(data, openid);
    case 'detail':
      return await getClassDetail(data);
    case 'add':
      return await addClass(data, openid);
    case 'update':
      return await updateClass(data);
    case 'delete':
      return await deleteClass(data);
    default:
      return { code: -1, message: '未知操作' };
  }
};

// 获取班级列表
async function getClassList(data, openid) {
  const { teacherId, page = 1, pageSize = 20 } = data;

  try {
    let where = {};

    // 如果指定了老师ID，只返回该老师的班级
    if (teacherId) {
      where.teacherId = teacherId;
    }

    const skip = (page - 1) * pageSize;
    const result = await db.collection('classes')
      .where(where)
      .skip(skip)
      .limit(pageSize)
      .orderBy('createTime', 'desc')
      .get();

    // 获取每个班级的学员数量
    const classesWithCount = await Promise.all(result.data.map(async (cls) => {
      const count = await db.collection('students').where({
        classId: cls._id
      }).count();
      return {
        ...cls,
        studentCount: count.total
      };
    }));

    const total = await db.collection('classes').where(where).count();

    return {
      code: 0,
      message: 'success',
      data: {
        list: classesWithCount,
        total: total.total,
        page,
        pageSize
      }
    };
  } catch (err) {
    console.error('获取班级列表失败:', err);
    return { code: -1, message: '获取班级列表失败', error: err };
  }
}

// 获取班级详情
async function getClassDetail(data) {
  const { id } = data;

  try {
    const result = await db.collection('classes').doc(id).get();

    // 获取老师信息
    if (result.data.teacherId) {
      const teacherResult = await db.collection('users').doc(result.data.teacherId).get();
      result.data.teacherName = teacherResult.data.nickName;
    }

    // 获取学员列表
    const students = await db.collection('students').where({
      classId: id
    }).get();
    result.data.students = students.data;

    return {
      code: 0,
      message: 'success',
      data: result.data
    };
  } catch (err) {
    console.error('获取班级详情失败:', err);
    return { code: -1, message: '获取班级详情失败', error: err };
  }
}

// 新增班级
async function addClass(data, openid) {
  try {
    const result = await db.collection('classes').add({
      data: {
        ...data,
        status: 'active',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });

    // 记录操作日志
    await logOperation(openid, '新增班级', `新增班级: ${data.name}`);

    return {
      code: 0,
      message: 'success',
      data: { id: result._id }
    };
  } catch (err) {
    console.error('新增班级失败:', err);
    return { code: -1, message: '新增班级失败', error: err };
  }
}

// 更新班级
async function updateClass(data) {
  const { id, ...updateData } = data;

  try {
    await db.collection('classes').doc(id).update({
      data: {
        ...updateData,
        updateTime: db.serverDate()
      }
    });

    return {
      code: 0,
      message: 'success'
    };
  } catch (err) {
    console.error('更新班级失败:', err);
    return { code: -1, message: '更新班级失败', error: err };
  }
}

// 删除班级
async function deleteClass(data) {
  const { id } = data;

  try {
    // 检查班级是否有学员
    const studentCount = await db.collection('students').where({
      classId: id
    }).count();

    if (studentCount.total > 0) {
      return { code: -1, message: '班级内还有学员，无法删除' };
    }

    await db.collection('classes').doc(id).remove();

    return {
      code: 0,
      message: 'success'
    };
  } catch (err) {
    console.error('删除班级失败:', err);
    return { code: -1, message: '删除班级失败', error: err };
  }
}

// 记录操作日志
async function logOperation(openid, action, content) {
  try {
    await db.collection('logs').add({
      data: {
        operatorId: openid,
        action: action,
        content: content,
        createTime: db.serverDate()
      }
    });
  } catch (err) {
    console.error('记录日志失败:', err);
  }
}
