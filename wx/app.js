App({
  globalData: {
    currentUser: null,
    users: [],
    selectedUserId: '1',
  },

  onLaunch() {
    // 初始化云开发环境（用于 wx.cloud.callContainer 调用云托管，无需配置 request 合法域名）
    // 注意：测试号（touristappid）不支持云开发，wx.cloud 不存在时自动走公网直连兜底
    if (wx.cloud) {
      wx.cloud.init({
        env: 't1-d4gojoquv03943719',
        traceUser: true,
      });
    }

    try {
      const saved = wx.getStorageSync('currentUser');
      if (saved) {
        this.globalData.currentUser = saved;
        this.globalData.selectedUserId = String(saved.id);
      }
    } catch (e) {
      wx.removeStorageSync('currentUser');
    }
  },

  setCurrentUser(user) {
    this.globalData.currentUser = user;
    this.globalData.selectedUserId = String(user.id);
    wx.setStorageSync('currentUser', user);
  },

  setSelectedUserId(id) {
    this.globalData.selectedUserId = String(id);
  },

  setUsers(users) {
    this.globalData.users = users || [];
  },

  logout() {
    this.globalData.currentUser = null;
    this.globalData.selectedUserId = '1';
    wx.removeStorageSync('currentUser');
  },
});
