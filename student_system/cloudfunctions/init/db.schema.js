// 数据库集合定义
// 在云开发控制台 -> 数据库 中创建以下集合

const collections = [
  {
    name: 'users',
    description: '用户表',
    fields: {
      openid: 'string',        // 微信openid
      unionid: 'string',       // 微信unionid（可选）
      nickName: 'string',      // 昵称
      avatarUrl: 'string',     // 头像
      role: 'string',          // 角色：parent/teacher/admin
      phone: 'string',         // 手机号
      password: 'string',      // 密码（老师/管理员）
      notificationSettings: 'object', // 通知设置 {classReminder, reminderTime, noticeAlert}
      status: 'string',        // 状态：active/inactive
      createTime: 'date',      // 创建时间
      updateTime: 'date'       // 更新时间
    },
    indexes: ['openid'],
    permissions: {
      read: true,              // 用户只能读取自己的数据
      write: 'doc.openid == auth.openid'
    }
  },
  {
    name: 'students',
    description: '学员表',
    fields: {
      nameCn: 'string',        // 中文名
      nameEn: 'string',        // 英文名
      gender: 'string',        // 性别
      birthday: 'date',        // 生日
      phone: 'string',         // 联系电话
      photo: 'string',         // 照片
      school: 'string',        // 学校
      parentName: 'string',    // 家长姓名
      emergencyPhone: 'string',// 紧急联系电话
      classId: 'string',       // 班级ID
      remainHours: 'number',   // 剩余课时
      totalHours: 'number',    // 总课时
      status: 'string',        // 状态：正常/即将到期/已过期
      englishLevel: 'string',  // 英语基础
      enrollDate: 'date',      // 报名日期
      createTime: 'date',
      updateTime: 'date'
    },
    indexes: ['classId', 'status'],
    permissions: {
      read: true,
      write: 'auth.role == "admin"'
    }
  },
  {
    name: 'classes',
    description: '班级表',
    fields: {
      name: 'string',          // 班级名称
      courseId: 'string',      // 课程ID
      teacherId: 'string',     // 老师ID
      studentCount: 'number',  // 学员数量
      maxStudents: 'number',   // 最大人数
      status: 'string',        // 状态：active/inactive
      createTime: 'date',
      updateTime: 'date'
    },
    indexes: ['teacherId', 'courseId'],
    permissions: {
      read: true,
      write: 'auth.role == "admin"'
    }
  },
  {
    name: 'teachers',
    description: '老师表',
    fields: {
      userId: 'string',        // 关联用户ID
      name: 'string',          // 姓名
      nickName: 'string',      // 昵称
      phone: 'string',         // 电话
      avatar: 'string',        // 头像
      status: 'string',        // 状态：active/inactive
      createTime: 'date',
      updateTime: 'date'
    },
    indexes: ['userId'],
    permissions: {
      read: true,
      write: 'auth.role == "admin"'
    }
  },
  {
    name: 'courses',
    description: '课程类型表',
    fields: {
      name: 'string',          // 课程名称
      type: 'string',          // 类型
      description: 'string',   // 描述
      price: 'number',         // 价格
      hours: 'number',         // 课时数
      status: 'string',        // 状态
      createTime: 'date',
      updateTime: 'date'
    },
    indexes: ['type'],
    permissions: {
      read: true,
      write: 'auth.role == "admin"'
    }
  },
  {
    name: 'schedules',
    description: '排课表',
    fields: {
      classId: 'string',       // 班级ID
      courseId: 'string',      // 课程ID
      teacherId: 'string',     // 老师ID
      date: 'string',          // 日期 YYYY-MM-DD
      startTime: 'string',     // 开始时间 HH:mm
      endTime: 'string',       // 结束时间 HH:mm
      classroom: 'string',     // 教室
      status: 'string',        // 状态
      createTime: 'date',
      updateTime: 'date'
    },
    indexes: ['classId', 'teacherId', 'date'],
    permissions: {
      read: true,
      write: 'auth.role == "admin" || auth.role == "teacher"'
    }
  },
  {
    name: 'attendance',
    description: '签到记录表',
    fields: {
      studentId: 'string',     // 学员ID
      classId: 'string',       // 班级ID
      scheduleId: 'string',    // 排课ID
      status: 'string',        // 状态：checked/leave/absent
      checkInTime: 'date',     // 签到时间
      operatorId: 'string',    // 操作人ID
      remark: 'string',        // 备注
      createTime: 'date',
      updateTime: 'date'
    },
    indexes: ['studentId', 'classId', 'scheduleId'],
    permissions: {
      read: true,
      write: 'auth.role == "admin" || auth.role == "teacher"'
    }
  },
  {
    name: 'bindings',
    description: '学员绑定表（家长-学员关系）',
    fields: {
      userId: 'string',        // 用户ID（家长）
      studentId: 'string',     // 学员ID
      relation: 'string',      // 关系：父亲/母亲/其他
      status: 'string',        // 状态：pending/approved/rejected
      proof: 'string',         // 关系证明图片
      createTime: 'date',
      updateTime: 'date'
    },
    indexes: ['userId', 'studentId', 'status'],
    permissions: {
      read: true,
      write: true
    }
  },
  {
    name: 'notices',
    description: '公告表',
    fields: {
      title: 'string',         // 标题
      content: 'string',       // 内容
      type: 'string',          // 类型：normal/important/activity
      status: 'string',        // 状态：draft/published
      authorId: 'string',      // 作者ID
      publishTime: 'date',     // 发布时间
      readCount: 'number',     // 阅读数
      readBy: 'array',         // 已读用户ID列表
      deletedBy: 'array',      // 已删除用户ID列表
      createTime: 'date',
      updateTime: 'date'
    },
    indexes: ['status', 'type'],
    permissions: {
      read: true,
      write: 'auth.role == "admin"'
    }
  },
  {
    name: 'bookings',
    description: '约课记录表',
    fields: {
      studentId: 'string',     // 学员ID
      teacherId: 'string',     // 老师ID
      classId: 'string',       // 班级ID
      parentId: 'string',      // 家长ID
      date: 'string',          // 日期 YYYY-MM-DD
      timeSlot: 'string',      // 时间段，如 "08:00-09:00"
      status: 'string',        // 状态：booked/cancelled/completed
      createdAt: 'date',       // 创建时间
      updatedAt: 'date'        // 更新时间
    },
    indexes: ['studentId', 'teacherId', 'date', 'status'],
    permissions: {
      read: true,
      write: true
    }
  },
  {
    name: 'comments',
    description: '学员评语表',
    fields: {
      studentId: 'string',     // 学员ID
      classId: 'string',       // 班级ID
      teacherId: 'string',     // 老师ID
      content: 'string',       // 评语内容
      date: 'string',          // 日期
      createTime: 'date',
      updateTime: 'date'
    },
    indexes: ['studentId', 'classId'],
    permissions: {
      read: true,
      write: 'auth.role == "admin" || auth.role == "teacher"'
    }
  }
];

// 导出集合定义
module.exports = collections;
