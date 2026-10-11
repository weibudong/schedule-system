const { calendarApi, userApi } = require('../../utils/api');
const { buildMonthDays, periodWeight, formatAmount, today } = require('../../utils/util');

const app = getApp();

Page({
  data: {
    weekDays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    year: 2026,
    month: 1, // 1-based
    days: [],
    appointments: [],
    summary: null,
    totalAmountText: '0',
    showMonthPicker: false,
    pickerYear: 2026,
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    users: [],
    userOptions: ['所有人'],
    userIndex: 0,
    selectedUserId: '1',
    currentUser: null,
    isAdmin: false,
    // 弹窗
    showModal: false,
    selectedAppointment: null,
    defaultDate: '',
    showAddUser: false,
    showLogoutConfirm: false,
  },

  onLoad() {
    const now = new Date();
    this.setData({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      pickerYear: now.getFullYear(),
    });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.showTab();
    const cu = app.globalData.currentUser;
    if (!cu) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.setData({
      currentUser: cu,
      isAdmin: cu.role === 'admin',
      selectedUserId: app.globalData.selectedUserId || String(cu.id),
    });
    this.fetchUsers();
    this.refreshData();
  },

  fetchUsers() {
    userApi
      .list()
      .then((res) => {
        if (res && res.success) {
          app.setUsers(res.users);
          const users = res.users || [];
          const options = ['所有人'].concat(users.map((u) => u.name));
          let idx = users.findIndex((u) => String(u.id) === String(this.data.selectedUserId));
          idx = this.data.selectedUserId === 'all' ? 0 : idx >= 0 ? idx + 1 : 0;
          this.setData({ users, userOptions: options, userIndex: idx });
        }
      })
      .catch(() => {});
  },

  monthStr() {
    return this.data.year + '-' + String(this.data.month).padStart(2, '0');
  },

  refreshData() {
    calendarApi
      .get(this.monthStr(), this.data.selectedUserId)
      .then((res) => {
        const appointments = (res && res.appointments) || [];
        const summary = (res && res.summary) || null;
        this.setData(
          {
            appointments,
            summary,
            totalAmountText: summary ? formatAmount(summary.totalAmount) : '0',
          },
          () => this.rebuildDays()
        );
      })
      .catch(() => {
        wx.showToast({ title: '数据加载失败', icon: 'none' });
      });
  },

  rebuildDays() {
    const { year, month, appointments } = this.data;
    const raw = buildMonthDays(year, month - 1);
    const todayStr = today();
    const days = raw.map((d, index) => {
      const list = appointments
        .filter((a) => a.date === d.fullDate)
        .sort((a, b) => periodWeight(a.timePeriod) - periodWeight(b.timePeriod))
        .map((a) => ({
          id: String(a.id),
          text: (a.city ? a.city : '') + (a.customerName || a.company || ''),
          isPaid: a.paymentStatus === '已回款',
          isAfternoon: a.timePeriod === '下午',
        }));
      return Object.assign({}, d, {
        appointments: list,
        isToday: d.fullDate === todayStr,
        isWeekend: index % 7 === 5 || index % 7 === 6,
      });
    });
    this.setData({ days });
  },

  prevMonth() {
    let { year, month } = this.data;
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    this.setData({ year, month }, () => this.refreshData());
  },

  nextMonth() {
    let { year, month } = this.data;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    this.setData({ year, month }, () => this.refreshData());
  },

  toggleMonthPicker() {
    this.setData({ showMonthPicker: !this.data.showMonthPicker, pickerYear: this.data.year });
  },

  closeMonthPicker() {
    this.setData({ showMonthPicker: false });
  },

  pickerPrevYear() {
    this.setData({ pickerYear: this.data.pickerYear - 1 });
  },

  pickerNextYear() {
    this.setData({ pickerYear: this.data.pickerYear + 1 });
  },

  pickMonth(e) {
    const m = Number(e.currentTarget.dataset.month);
    this.setData({ year: this.data.pickerYear, month: m, showMonthPicker: false }, () => this.refreshData());
  },

  noop() {},

  onUserChange(e) {
    const idx = Number(e.detail.value);
    const userId = idx === 0 ? 'all' : String(this.data.users[idx - 1].id);
    app.setSelectedUserId(userId);
    this.setData({ userIndex: idx, selectedUserId: userId }, () => this.refreshData());
  },

  // 自定义 tabBar 下 wx.hideTabBar 不可靠，双管齐下：
  // 1) 通过 getTabBar() 控制组件自身显隐；2) 同时调用 wx.hideTabBar 隐藏原生容器
  hideTab() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ visible: false });
    }
    wx.hideTabBar({ animation: false, fail: () => {} });
  },

  showTab() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ visible: true });
    }
    wx.showTabBar({ animation: false, fail: () => {} });
  },

  handleAdd() {
    this.hideTab();
    this.setData({ selectedAppointment: null, defaultDate: today(), showModal: true });
  },

  onCellTap(e) {
    const item = e.currentTarget.dataset.item;
    if (item.appointments && item.appointments.length > 0) return;
    this.hideTab();
    this.setData({ selectedAppointment: null, defaultDate: item.fullDate, showModal: true });
  },

  onChipTap(e) {
    const id = String(e.currentTarget.dataset.id);
    const appt = this.data.appointments.find((a) => String(a.id) === id);
    if (appt) {
      this.hideTab();
      this.setData({ selectedAppointment: appt, defaultDate: '', showModal: true });
    }
  },

  closeModal() {
    this.setData({ showModal: false });
    this.showTab();
  },

  async onModalSave(e) {
    const data = e.detail;
    try {
      let res;
      if (data.id) {
        res = await calendarApi.update(data.id, data);
      } else {
        res = await calendarApi.create(Object.assign({}, data, { userId: this.data.selectedUserId }));
      }
      if (res && res.success === false) {
        wx.showToast({ title: res.message || '该时间段已有行程，不能重复添加', icon: 'none', duration: 2500 });
        return;
      }
      this.setData({ showModal: false });
      this.showTab();
      this.refreshData();
    } catch (err) {
      wx.showToast({ title: '保存失败，请检查网络', icon: 'none' });
    }
  },

  onModalDelete(e) {
    const id = e.detail.id;
    calendarApi
      .remove(id)
      .then(() => {
        this.setData({ showModal: false });
        this.showTab();
        this.refreshData();
      })
      .catch(() => {
        wx.showToast({ title: '删除失败', icon: 'none' });
      });
  },

  openAddUser() {
    this.hideTab();
    this.setData({ showAddUser: true });
  },

  closeAddUser() {
    this.setData({ showAddUser: false });
    this.showTab();
  },

  async onAddUser(e) {
    try {
      const res = await userApi.create(e.detail);
      if (res && res.success) {
        this.setData({ showAddUser: false });
        this.showTab();
        wx.showToast({ title: '添加成功', icon: 'success' });
        this.fetchUsers();
      } else {
        wx.showToast({ title: (res && res.message) || '添加失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '添加失败，请检查网络', icon: 'none' });
    }
  },

  showLogout() {
    this.hideTab();
    this.setData({ showLogoutConfirm: true });
  },

  cancelLogout() {
    this.setData({ showLogoutConfirm: false });
    this.showTab();
  },

  confirmLogout() {
    app.logout();
    this.setData({ showLogoutConfirm: false });
    wx.redirectTo({ url: '/pages/login/login' });
  },
});
