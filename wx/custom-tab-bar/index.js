Component({
  data: {
    selected: 0,
    visible: true, // 页面通过 getTabBar().setData({visible}) 控制；勿调 wx.showTabBar（安卓会叠加出双 tabBar）
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
