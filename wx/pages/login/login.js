const { userApi } = require('../../utils/api');

const app = getApp();

Page({
  data: {
    phone: '',
    password: '',
    error: '',
    loading: false,
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value, error: '' });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value, error: '' });
  },

  async handleLogin() {
    const { phone, password, loading } = this.data;
    if (loading) return;
    if (!phone || !password) {
      this.setData({ error: '请输入手机号和密码' });
      return;
    }
    this.setData({ loading: true, error: '' });
    try {
      const res = await userApi.login(phone, password);
      if (res && res.success) {
        app.setCurrentUser(res.user);
        wx.switchTab({ url: '/pages/calendar/calendar' });
      } else {
        this.setData({ error: (res && res.message) || '手机号或密码错误' });
      }
    } catch (e) {
      this.setData({ error: '登录失败，请检查网络连接' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
