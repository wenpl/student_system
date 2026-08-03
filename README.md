# 英语启蒙培训班管理系统

基于微信小程序云开发的学生管理系统，适用于英语培训班、兴趣班等教育培训机构。

## 功能特性

### 家长端
- 查看孩子基本信息、课时余额
- 查看课程表和上课安排
- 接收班级通知和公告
- 约课功能
- 绑定学员（需管理员审核）

### 教师端
- 查看所带班级信息
- 查看学员详情
- 发布班级通知
- 处理约课请求

### 管理员端
- 学员管理（添加、编辑、查看）
- 班级管理
- 课程管理
- 排课管理
- 教师管理
- 公告管理
- 数据统计
- 审核管理（家长绑定学员审核）

## 技术栈

- **前端**: 微信小程序
- **后端**: 微信云开发（云函数）
- **数据库**: 云开发数据库

## 项目结构

```
├── miniprogram/          # 小程序前端代码
│   ├── pages/            # 页面
│   │   ├── index/        # 首页
│   │   ├── login/        # 登录页
│   │   ├── parent/       # 家长端页面
│   │   ├── teacher/      # 教师端页面
│   │   ├── admin/        # 管理员端页面
│   │   └── profile/      # 个人中心页面
│   ├── utils/            # 工具函数
│   ├── images/           # 图片资源
│   └── app.js            # 小程序入口
├── cloudfunctions/       # 云函数
│   ├── login/            # 登录
│   ├── student/          # 学员相关
│   ├── class/            # 班级相关
│   ├── schedule/         # 排课相关
│   ├── init/             # 初始化
│   └── updateUserRole/   # 更新用户角色
└── database/             # 数据库初始化文件
```

## 数据库设计

| 集合 | 说明 |
|------|------|
| users | 用户表（家长、教师、管理员） |
| students | 学员表 |
| classes | 班级表 |
| teachers | 教师表 |
| courses | 课程类型表 |
| schedules | 排课表 |
| attendance | 签到记录表 |
| bindings | 家长-学员绑定表 |
| notices | 公告表 |
| bookings | 约课记录表 |

## 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/wenpl/student_system.git
```

### 2. 导入微信开发者工具
- 打开微信开发者工具
- 导入项目根目录
- 填入你的 AppID

### 3. 配置云开发环境
1. 开通云开发
2. 在 `miniprogram/app.js` 中修改云环境 ID：
```javascript
return 'your-cloud-env-id';
```
3. 在 `project.config.json` 中填入你的 AppID：
```json
"appid": "your-appid-here"
```

### 4. 初始化数据库
在云开发控制台创建以下集合：
- users, students, classes, teachers, courses
- schedules, attendance, bindings, notices, bookings

### 5. 创建管理员账号
在 `users` 集合中添加管理员记录：
```json
{
  "phone": "管理员手机号",
  "password": "密码",
  "role": "admin",
  "nickName": "管理员",
  "status": "active"
}
```

## 环境要求

- 微信开发者工具 >= 1.02.1904090
- 基础库 >= 2.2.3
- 已开通云开发

## License

MIT
