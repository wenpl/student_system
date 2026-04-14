// 云函数入口文件 - 初始化数据库
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 初始数据
const initData = {
  courses: [
    { name: '幼儿英语启蒙', type: '启蒙课程', description: '适合3-5岁零基础儿童', price: 2980, hours: 30, status: 'active' },
    { name: '少儿英语基础', type: '基础课程', description: '适合5-8岁有基础儿童', price: 3980, hours: 40, status: 'active' },
    { name: '口语提高班', type: '提高课程', description: '适合8-12岁儿童', price: 4980, hours: 50, status: 'active' }
  ],
  teachers: [
    { name: '李老师', nickName: 'Teacher Li', phone: '13800138001', status: 'active' },
    { name: '王老师', nickName: 'Teacher Wang', phone: '13800138002', status: 'active' },
    { name: '张老师', nickName: 'Teacher Zhang', phone: '13800138003', status: 'active' }
  ],
  classes: [
    { name: '幼儿英语A班', studentCount: 8, maxStudents: 12, status: 'active' },
    { name: '少儿英语B班', studentCount: 10, maxStudents: 15, status: 'active' },
    { name: '口语提高班', studentCount: 6, maxStudents: 10, status: 'active' }
  ],
  students: [
    { nameCn: '张小明', nameEn: 'Tom', gender: '男', phone: '13900139001', remainHours: 25, totalHours: 30, status: '正常', englishLevel: '零基础' },
    { nameCn: '李小红', nameEn: 'Lucy', gender: '女', phone: '13900139002', remainHours: 18, totalHours: 40, status: '正常', englishLevel: '有基础' },
    { nameCn: '王小刚', nameEn: 'Jack', gender: '男', phone: '13900139003', remainHours: 5, totalHours: 50, status: '即将到期', englishLevel: '良好' }
  ]
};

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action } = event;

  try {
    let result = {};

    switch (action) {
      case 'initCourses':
        result = await initCollection('courses', initData.courses);
        break;
      case 'initTeachers':
        result = await initCollection('teachers', initData.teachers);
        break;
      case 'initClasses':
        result = await initCollection('classes', initData.classes);
        break;
      case 'initStudents':
        result = await initCollection('students', initData.students, 'nameCn');
        break;
      case 'initAll':
        result = {
          courses: await initCollection('courses', initData.courses, 'name'),
          teachers: await initCollection('teachers', initData.teachers, 'name'),
          classes: await initCollection('classes', initData.classes, 'name'),
          students: await initCollection('students', initData.students, 'nameCn')
        };
        break;
      case 'clearAll':
        result = await clearAllCollections();
        break;
      default:
        return {
          code: -1,
          message: '未知操作'
        };
    }

    return {
      code: 0,
      message: 'success',
      data: result
    };
  } catch (err) {
    console.error('初始化失败:', err);
    return {
      code: -1,
      message: '初始化失败',
      error: err
    };
  }
};

// 初始化集合数据
async function initCollection(collectionName, data, checkField = 'name') {
  const collection = db.collection(collectionName);
  const result = {
    total: data.length,
    added: 0,
    skipped: 0
  };

  for (const item of data) {
    try {
      // 检查是否已存在
      const existResult = await collection.where({
        [checkField]: item[checkField]
      }).count();

      if (existResult.total > 0) {
        result.skipped++;
        continue;
      }

      // 添加数据
      await collection.add({
        data: {
          ...item,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });
      result.added++;
    } catch (err) {
      console.error(`添加 ${collectionName} 数据失败:`, err);
    }
  }

  return result;
}

// 清空所有集合
async function clearAllCollections() {
  const collections = ['courses', 'teachers', 'classes', 'students', 'attendance', 'leaves', 'bindings', 'payments', 'notices', 'chats', 'comments', 'schedules'];
  const result = {};

  for (const name of collections) {
    try {
      const collection = db.collection(name);
      const { data } = await collection.limit(100).get();

      for (const item of data) {
        await collection.doc(item._id).remove();
      }
      result[name] = 'cleared';
    } catch (err) {
      result[name] = err.message;
    }
  }

  return result;
}
