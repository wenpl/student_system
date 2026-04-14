// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { role, phone } = event;
  const openid = wxContext.OPENID;

  // 只允许选择 parent 或 teacher，admin 不可自选
  if (role === 'admin') {
    return {
      code: -1,
      message: '管理员账号需要由系统预设，请联系管理员'
    };
  }

  const validRoles = ['parent', 'teacher'];
  if (!validRoles.includes(role)) {
    return {
      code: -1,
      message: '无效的角色类型'
    };
  }

  try {
    // 查询当前登录用户
    const userResult = await db.collection('users').where({
      openid: openid
    }).get();

    if (userResult.data.length === 0) {
      return {
        code: -1,
        message: '用户不存在'
      };
    }

    const user = userResult.data[0];

    // 老师角色需要手机号验证
    if (role === 'teacher') {
      if (!phone) {
        return {
          code: -1,
          message: '请输入手机号进行验证'
        };
      }

      // 查找管理员预注册的老师记录（role=teacher，有phone，未绑定openid）
      const allTeachers = await db.collection('users').where({
        role: 'teacher',
        phone: phone
      }).get();

      // 过滤出未绑定 openid 的记录
      const preRegistered = allTeachers.data.filter(function(t) {
        return !t.openid || t.openid === '';
      });

      if (preRegistered.length === 0) {
        return {
          code: -1,
          message: '未找到对应老师信息，请确认手机号或联系管理员'
        };
      }

      const teacherRecord = preRegistered[0];

      // 将当前用户的 openid 绑定到预注册的老师记录
      try {
        await db.collection('users').doc(teacherRecord._id).update({
          data: {
            openid: openid,
            nickName: user.nickName || teacherRecord.nickName || '',
            avatarUrl: user.avatarUrl || '',
            updateTime: db.serverDate()
          }
        });
      } catch (updateErr) {
        console.error('绑定老师记录失败:', updateErr);
        return {
          code: -1,
          message: '绑定老师记录失败，请联系管理员'
        };
      }

      // 删除登录时自动创建的空角色用户记录（避免重复）
      if (user._id !== teacherRecord._id) {
        try {
          await db.collection('users').doc(user._id).remove();
        } catch (removeErr) {
          console.warn('删除临时用户记录失败:', removeErr);
        }
      }

      // 在 teachers 表创建/更新记录
      const existingTeacher = await db.collection('teachers').where({
        userId: openid
      }).get();

      if (existingTeacher.data.length === 0) {
        await db.collection('teachers').add({
          data: {
            userId: openid,
            name: teacherRecord.nickName || user.nickName || '老师',
            nickName: user.nickName || teacherRecord.nickName || '',
            phone: phone,
            avatar: user.avatarUrl || '',
            status: 'active',
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        });
      }

      return {
        code: 0,
        message: '验证成功',
        data: { role: 'teacher' }
      };
    }

    // 家长角色，直接设置
    await db.collection('users').doc(user._id).update({
      data: {
        role: 'parent',
        updateTime: db.serverDate()
      }
    });

    return {
      code: 0,
      message: 'success',
      data: { role: 'parent' }
    };
  } catch (err) {
    console.error('更新角色失败:', err);
    return {
      code: -1,
      message: '更新角色失败',
      error: err
    };
  }
};
