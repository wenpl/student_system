// pages/profile/help/index.js
Page({
  data: {
    faqList: [
      { id: 1, question: '如何绑定学员？', answer: '进入家长端首页，点击「绑定学员」按钮，输入学员姓名和班级信息，等待管理员审核通过即可。', expanded: false },
      { id: 2, question: '如何查看课程表？', answer: '绑定学员后，在家长端首页可以看到今日课程。点击「课程表」可查看完整排课信息。', expanded: false },
      { id: 3, question: '如何约课/取消约课？', answer: '在家长端点击「约课」功能，选择可用时段进行预约。已预约的课程可在「约课记录」中取消。', expanded: false },
      { id: 4, question: '如何修改个人信息？', answer: '进入「我的」页面，点击「编辑资料」即可修改昵称等个人信息。', expanded: false }
    ]
  },

  toggleFaq: function (e) {
    var id = e.currentTarget.dataset.id;
    var faqList = this.data.faqList.map(function (item) {
      if (item.id === id) {
        item.expanded = !item.expanded;
      }
      return item;
    });
    this.setData({ faqList: faqList });
  }
});