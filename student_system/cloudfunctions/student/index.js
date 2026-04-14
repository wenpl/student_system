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
      return await getStudentList(data, openid);
    case 'detail':
      return await getStudentDetail(data);
    case 'add':
      return await addStudent(data, openid);
    case 'update':
      return await updateStudent(data);
    case 'delete':
      return await deleteStudent(data);
    case 'bind':
      return await bindStudent(data, openid);
    case 'audit':
      return await auditBindRequest(data);
    default:
      return { code: -1, message: '未知操作' };
  }
};

// 获取学员列表
async function getStudentList(data, openid) {
  const { role, classId, page = 1, pageSize = 20 } = data;

  try {
    let where = {};

    // 根据角色过滤
    if (role === 'parent') {
      where.parentIds = _.elemMatch(_.eq(openid));
    } else if (role === 'teacher') {
      // 老师只能看到自己班级的学员
      const classes = await db.collection('classes').where({
        teacherId: openid
      }).get();
      const classIds = classes.data.map(c => c._id);
      where.classId = _.in(classIds);
    }
    // admin 可以看到所有学员

    if (classId) {
      where.classId = classId;
    }

    const skip = (page - 1) * pageSize;
    const result = await db.collection('students')
      .where(where)
      .skip(skip)
      .limit(pageSize)
      .orderBy('createTime', 'desc')
      .get();

    const total = await db.collection('students').where(where).count();

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
    console.error('获取学员列表失败:', err);
    return { code: -1, message: '获取学员列表失败', error: err };
  }
}

// 获取学员详情
async function getStudentDetail(data) {
  const { id } = data;

  try {
    const result = await db.collection('students').doc(id).get();

    // 获取班级信息
    if (result.data.classId) {
      const classResult = await db.collection('classes').doc(result.data.classId).get();
      result.data.className = classResult.data.name;
    }

    return {
      code: 0,
      message: 'success',
      data: result.data
    };
  } catch (err) {
    console.error('获取学员详情失败:', err);
    return { code: -1, message: '获取学员详情失败', error: err };
  }
}

// 新增学员
async function addStudent(data, openid) {
  try {
    const result = await db.collection('students').add({
      data: {
        ...data,
        parentIds: [],
        status: '正常',
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });

    // 记录操作日志
    await logOperation(openid, '新增学员', `新增学员: ${data.nameCn}`);

    return {
      code: 0,
      message: 'success',
      data: { id: result._id }
    };
  } catch (err) {
    console.error('新增学员失败:', err);
    return { code: -1, message: '新增学员失败', error: err };
  }
}

// 更新学员
async function updateStudent(data) {
  const { id, ...updateData } = data;

  try {
    await db.collection('students').doc(id).update({
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
    console.error('更新学员失败:', err);
    return { code: -1, message: '更新学员失败', error: err };
  }
}

// 删除学员
async function deleteStudent(data) {
  const { id } = data;

  try {
    await db.collection('students').doc(id).remove();

    return {
      code: 0,
      message: 'success'
    };
  } catch (err) {
    console.error('删除学员失败:', err);
    return { code: -1, message: '删除学员失败', error: err };
  }
}

// 绑定学员申请
async function bindStudent(data, openid) {
  const { studentId, relation } = data;

  try {
    // 创建绑定申请
    const result = await db.collection('bindings').add({
      data: {
        userId: openid,
        studentId: studentId,
        relation: relation, // 父亲/母亲/其他
        status: 'pending',
        createTime: db.serverDate()
      }
    });

    return {
      code: 0,
      message: '申请已提交，请等待审核',
      data: { id: result._id }
    };
  } catch (err) {
    console.error('绑定学员失败:', err);
    return { code: -1, message: '绑定学员失败', error: err };
  }
}

// 审核绑定申请
async function auditBindRequest(data) {
  const { id, approved } = data;

  try {
    const request = await db.collection('bindings').doc(id).get();
    const { userId, studentId } = request.data;

    // 更新申请状态
    await db.collection('bindings').doc(id).update({
      data: {
        status: approved ? 'approved' : 'rejected',
        approveTime: db.serverDate(),
        approverId: data.approverId,
        updateTime: db.serverDate()
      }
    });

    // 如果通过，更新学员的parentIds
    if (approved) {
      await db.collection('students').doc(studentId).update({
        data: {
          parentIds: _.push(userId),
          updateTime: db.serverDate()
        }
      });
    }

    return {
      code: 0,
      message: approved ? '审核通过' : '审核拒绝'
    };
  } catch (err) {
    console.error('审核失败:', err);
    return { code: -1, message: '审核失败', error: err };
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
