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
      return await getScheduleList(data, openid);
    case 'add':
      return await addSchedule(data, openid);
    case 'update':
      return await updateSchedule(data);
    case 'delete':
      return await deleteSchedule(data);
    case 'checkConflict':
      return await checkScheduleConflict(data);
    default:
      return { code: -1, message: '未知操作' };
  }
};

// 获取排课列表
async function getScheduleList(data, openid) {
  const { classId, teacherId, date, startDate, endDate, page = 1, pageSize = 20 } = data;

  try {
    let where = {};

    if (classId) {
      where.classId = classId;
    }
    if (teacherId) {
      where.teacherId = teacherId;
    }
    if (date) {
      where.date = date;
    }
    if (startDate && endDate) {
      where.date = _.gte(startDate).and(_.lte(endDate));
    }

    const skip = (page - 1) * pageSize;
    const result = await db.collection('schedules')
      .where(where)
      .skip(skip)
      .limit(pageSize)
      .orderBy('date', 'asc')
      .orderBy('startTime', 'asc')
      .get();

    const total = await db.collection('schedules').where(where).count();

    return {
      code: 0,
      message: 'success',
      data: {
        list: result.data,
        total: total.total,
        page,
        pageSize
      }
    };
  } catch (err) {
    console.error('获取排课列表失败:', err);
    return { code: -1, message: '获取排课列表失败', error: err };
  }
}

// 新增排课
async function addSchedule(data, openid) {
  try {
    // 检查时间冲突
    const conflict = await checkScheduleConflictInternal(data);
    if (conflict.hasConflict) {
      return { code: -1, message: '时间冲突：该时间段已有课程安排' };
    }

    const result = await db.collection('schedules').add({
      data: {
        ...data,
        status: 'scheduled',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });

    // 记录操作日志
    await logOperation(openid, '新增排课', `新增排课: ${data.date} ${data.startTime}`);

    return {
      code: 0,
      message: 'success',
      data: { id: result._id }
    };
  } catch (err) {
    console.error('新增排课失败:', err);
    return { code: -1, message: '新增排课失败', error: err };
  }
}

// 更新排课
async function updateSchedule(data) {
  const { id, ...updateData } = data;

  try {
    await db.collection('schedules').doc(id).update({
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
    console.error('更新排课失败:', err);
    return { code: -1, message: '更新排课失败', error: err };
  }
}

// 删除排课
async function deleteSchedule(data) {
  const { id } = data;

  try {
    await db.collection('schedules').doc(id).remove();

    return {
      code: 0,
      message: 'success'
    };
  } catch (err) {
    console.error('删除排课失败:', err);
    return { code: -1, message: '删除排课失败', error: err };
  }
}

// 检查时间冲突
async function checkScheduleConflict(data) {
  const conflict = await checkScheduleConflictInternal(data);
  return {
    code: 0,
    data: conflict
  };
}

// 内部检查冲突方法
async function checkScheduleConflictInternal(data) {
  const { teacherId, location, date, startTime, endTime, excludeId } = data;

  // 检查老师时间冲突
  const teacherSchedules = await db.collection('schedules').where({
    teacherId: teacherId,
    date: date,
    _id: excludeId ? _.neq(excludeId) : _.exists(true)
  }).get();

  for (const schedule of teacherSchedules.data) {
    if (isTimeOverlap(startTime, endTime, schedule.startTime, schedule.endTime)) {
      return { hasConflict: true, type: 'teacher', message: '老师该时间段已有课程' };
    }
  }

  // 检查教室冲突
  const locationSchedules = await db.collection('schedules').where({
    location: location,
    date: date,
    _id: excludeId ? _.neq(excludeId) : _.exists(true)
  }).get();

  for (const schedule of locationSchedules.data) {
    if (isTimeOverlap(startTime, endTime, schedule.startTime, schedule.endTime)) {
      return { hasConflict: true, type: 'location', message: '该教室该时间段已被占用' };
    }
  }

  return { hasConflict: false };
}

// 判断时间是否重叠
function isTimeOverlap(start1, end1, start2, end2) {
  return (start1 < end2 && end1 > start2);
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
