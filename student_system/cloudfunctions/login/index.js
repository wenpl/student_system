// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { userInfo } = event;
  const openid = wxContext.OPENID;

  try {
    // 查询用户是否存在
    const userResult = await db.collection('users').where({
      openid: openid
    }).get();

    let user;
    const nickName = (userInfo && userInfo.nickName) ? userInfo.nickName : '';
    const avatarUrl = (userInfo && userInfo.avatarUrl) ? userInfo.avatarUrl : '';

    if (userResult.data.length === 0) {
      // 新用户，创建记录
      const result = await db.collection('users').add({
        data: {
          openid: openid,
          nickName: nickName,
          avatarUrl: avatarUrl,
          role: '',
          phone: '',
          status: 'active',
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });

      user = {
        _id: result._id,
        openid: openid,
        nickName: nickName,
        avatarUrl: avatarUrl,
        role: ''
      };
    } else {
      // 已有用户
      user = userResult.data[0];

      // 只在有新信息时才更新
      const updateData = { updateTime: db.serverDate() };
      if (nickName) updateData.nickName = nickName;
      if (avatarUrl) updateData.avatarUrl = avatarUrl;

      try {
        await db.collection('users').doc(user._id).update({
          data: updateData
        });
      } catch (updateErr) {
        // 更新失败不影响登录（可能是控制台手动创建的记录）
        console.warn('更新用户信息失败，不影响登录:', updateErr);
      }
    }

    return {
      code: 0,
      message: 'success',
      data: {
        userInfo: {
          nickName: user.nickName || nickName,
          avatarUrl: user.avatarUrl || avatarUrl
        },
        openid: openid,
        role: user.role || ''
      }
    };
  } catch (err) {
    console.error('登录失败:', err);
    return {
      code: -1,
      message: '登录失败',
      error: err
    };
  }
};
