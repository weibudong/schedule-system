App({
  globalData: {
    currentUser: null,
    users: [],
    selectedUserId: '1',
  },

  onLaunch() {
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
