// pages/parent/schedule/index.js
const app = getApp();
const { formatDate, showLoading, hideLoading } = require('../../../utils/util');
const db = require('../../../utils/db');

Page({
  data: {
    weekText: '',
    dateList: [],
    courses: [],
    allCourses: [],
    selectedDate: '',
    currentWeekStart: null
  },

  onLoad: function () {
    this.initWeek();
  },

  initWeek: function () {
    const today = new Date();
    const dayOfWeek = today.getDay() || 7;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek + 1);
    this.setData({ currentWeekStart: weekStart });
    this.loadWeekData();
  },

  prevWeek: function () {
    const newStart = new Date(this.data.currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    this.setData({ currentWeekStart: newStart });
    this.loadWeekData();
  },

  nextWeek: function () {
    const newStart = new Date(this.data.currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    this.setData({ currentWeekStart: newStart });
    this.loadWeekData();
  },

  loadWeekData: async function () {
    const { currentWeekStart } = this.data;
    const dayNames = ['一', '二', '三', '四', '五', '六', '日'];
    const today = formatDate(new Date(), 'YYYY-MM-DD');

    // 生成日期列表
    const dateList = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      const dateStr = formatDate(date, 'YYYY-MM-DD');
      dateList.push({
        date: date.getDate(),
        dayName: '周' + dayNames[i],
        fullDate: dateStr,
        isToday: dateStr === today
      });
    }

    // 周文本
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);
    const weekText = `${formatDate(currentWeekStart, 'MM月DD日')} - ${formatDate(weekEnd, 'MM月DD日')}`;

    // 默认选中今天，若今天不在本周则选周一
    var selectedDate = today;
    var inThisWeek = dateList.some(function (d) { return d.fullDate === today; });
    if (!inThisWeek) {
      selectedDate = dateList[0].fullDate;
    }

    this.setData({ dateList, weekText, selectedDate });
    await this.loadCourses();
  },

  loadCourses: async function () {
    try {
      showLoading('加载中...');
      const { dateList } = this.data;
      const dates = dateList.map(d => d.fullDate);
      const openid = app.globalData.openid;

      // 1. 获取家长绑定的学员
      const bindings = await db.query('bindings', {
        where: { userId: openid, status: 'approved' }
      });

      if (bindings.length === 0) {
        this.setData({ allCourses: [], courses: [] });
        hideLoading();
        return;
      }

      const studentIds = bindings.map(b => b.studentId);

      // 2. 获取学员信息
      const allStudents = await db.query('students', { limit: 100 });
      const myStudents = allStudents.filter(s => studentIds.indexOf(s._id) !== -1);

      // 3. 获取学员所在班级ID
      const classIds = [...new Set(myStudents.map(s => s.classId).filter(Boolean))];

      if (classIds.length === 0) {
        this.setData({ allCourses: [], courses: [] });
        hideLoading();
        return;
      }

      // 4. 获取班级信息
      const allClasses = await db.query('classes', { limit: 100 });
      const classMap = {};
      allClasses.forEach(c => {
        classMap[c._id] = c;
      });

      // 5. 建立班级-学员映射
      const classStudentsMap = {};
      myStudents.forEach(s => {
        if (s.classId) {
          if (!classStudentsMap[s.classId]) {
            classStudentsMap[s.classId] = [];
          }
          classStudentsMap[s.classId].push(s.nameCn || s.nameEn || '未知');
        }
      });

      // 6. 获取课程安排
      const schedules = await db.query('schedules', {
        where: { date: db._.in(dates) }
      });

      // 7. 过滤并组装课程信息
      const courses = schedules.filter(s => classIds.indexOf(s.classId) !== -1).map(s => {
        const cls = classMap[s.classId] || {};
        const studentsInClass = classStudentsMap[s.classId] || [];
        return {
          _id: s._id,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          courseName: s.courseName || cls.name || '课程',
          teacherName: s.teacherName || '未知老师',
          className: cls.name || '未知班级',
          location: s.location || '',
          students: studentsInClass.join('、')
        };
      });

      this.setData({ allCourses: courses });
      this.filterCourses();
      hideLoading();
    } catch (err) {
      hideLoading();
      console.error('加载课程失败:', err);
    }
  },

  // 点击日期
  selectDate: function (e) {
    var date = e.currentTarget.dataset.date;
    this.setData({ selectedDate: date });
    this.filterCourses();
  },

  // 按选中日期过滤课程
  filterCourses: function () {
    var selectedDate = this.data.selectedDate;
    var allCourses = this.data.allCourses;

    var filtered = allCourses.filter(function (c) {
      return c.date === selectedDate;
    });

    // 按开始时间排序
    filtered.sort(function (a, b) {
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    this.setData({ courses: filtered });
  }
});
