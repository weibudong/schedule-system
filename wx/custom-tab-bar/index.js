Component({
  data: {
    selected: 0,
    visible: true, // 自定义 tabBar 时 wx.hideTabBar 无效，需自行控制显隐
    list: [
      {
        pagePath: 'pages/calendar/calendar',
        text: '当期工作',
        icon: '📅',
      },
      {
        pagePath: 'pages/performance/performance',
        text: '业绩详情',
        icon: '📊',
      },
    ],
  },

  methods: {
    switchTab(e) {
      const path = e.currentTarget.dataset.path;
      wx.switchTab({ url: '/' + path });
    },
  },
});
