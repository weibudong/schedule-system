const { performanceApi, calendarApi, userApi } = require('../../utils/api');
const { formatAmount, pad2 } = require('../../utils/util');

const app = getApp();

const FILTER_OPTIONS = [
  { value: 'orderDate', label: '按订单日期' },
  { value: 'invoiceDate', label: '按开票日期' },
  { value: 'paymentDate', label: '按回款日期' },
];

const TYPE_OPTIONS = ['全部', '面谈', '培训', '会议', '网络'];

Page({
  data: {
    currentUser: null,
    users: [],
    userOptions: ['全部人员'],
    userIndex: 0,
    selectedUserId: '1',
    filterOptions: FILTER_OPTIONS.map((o) => o.label),
    filterIndex: 0,
    typeOptions: TYPE_OPTIONS,
    typeIndex: 0,
    years: [],
    months: [],
    startYearIndex: 0,
    startMonthIndex: 0,
    endYearIndex: 0,
    endMonthIndex: 0,
    totalBonusText: '0',
    stats: { paidCount: 0, unpaidCount: 0, invoicedCount: 0, uninvoicedCount: 0 },
    statusFilter: 'all', // all | paid | unpaid | invoiced | uninvoiced
    rawList: [],
    filteredList: [],
    showModal: false,
    selectedAppointment: null,
    showLogoutConfirm: false,
  },

  onLoad() {
    const now = new Date();
    const years = [];
    for (let y = 2020; y <= 2050; y++) years.push(y + '年');
    const months = [];
    for (let m = 1; m <= 12; m++) months.push(m + '月');
    const yIdx = now.getFullYear() - 2020;
    const mIdx = now.getMonth();
    this.setData({
      years,
      months,
      startYearIndex: yIdx,
      startMonthIndex: mIdx,
      endYearIndex: yIdx,
      endMonthIndex: mIdx,
    });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.showTab();
    const cu = app.globalData.currentUser;
    if (!cu) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.setData({
      currentUser: cu,
      selectedUserId: app.globalData.selectedUserId || String(cu.id),
    });
    this.fetchUsers();
    this.search();
  },

  fetchUsers() {
    userApi
      .list()
      .then((res) => {
        if (res && res.success) {
          app.setUsers(res.users);
          const users = res.users || [];
          const options = ['全部人员'].concat(users.map((u) => u.name));
          let idx = users.findIndex((u) => String(u.id) === String(this.data.selectedUserId));
          idx = this.data.selectedUserId === 'all' ? 0 : idx >= 0 ? idx + 1 : 0;
          this.setData({ users, userOptions: options, userIndex: idx });
        }
      })
      .catch(() => {});
  },

  buildDates() {
    const startYear = 2020 + this.data.startYearIndex;
    const startMonth = pad2(this.data.startMonthIndex + 1);
    const endYear = 2020 + this.data.endYearIndex;
    const endMonth = pad2(this.data.endMonthIndex + 1);
    return {
      startDate: startYear + '-' + startMonth + '-01',
      endDate: endYear + '-' + endMonth + '-30',
    };
  },

  search() {
    const { startDate, endDate } = this.buildDates();
    const filterType = FILTER_OPTIONS[this.data.filterIndex].value;
    const type = TYPE_OPTIONS[this.data.typeIndex];
    performanceApi
      .get({ startDate, endDate, filterType, userId: this.data.selectedUserId, type })
      .then((res) => {
        const rawList = (res && res.performanceList) || [];
        const stats = (res && res.stats) || { paidCount: 0, unpaidCount: 0, invoicedCount: 0, uninvoicedCount: 0 };
        this.setData(
          {
            rawList,
            stats,
            totalBonusText: formatAmount((res && res.totalBonus) || 0),
          },
          () => this.applyStatusFilter()
        );
      })
      .catch(() => {
        wx.showToast({ title: '数据加载失败', icon: 'none' });
      });
  },

  applyStatusFilter() {
    const { rawList, statusFilter, currentUser } = this.data;
    const cu = currentUser || {};
    const list = rawList
      .filter((item) => {
        if (statusFilter === 'paid') return item.paymentStatus === '已回款';
        if (statusFilter === 'unpaid') return item.paymentStatus !== '已回款';
        if (statusFilter === 'invoiced') return item.invoiceStatus === '已开票';
        if (statusFilter === 'uninvoiced') return item.invoiceStatus !== '已开票';
        return true;
      })
      .map((item) => {
        const canViewAmount = cu.role === 'admin' || String(item.userId) === String(cu.id);
        let title = (item.province || item.city ? (item.province || '') + (item.city || '') + ' ' : '') + (item.customerName || item.company || '');
        title += ' / ' + (item.date || '') + ' ' + (item.timePeriod || '');
        title += ' / ' + (item.type || '') + ' / ' + (item.teacher || '-');
        if (canViewAmount) title += ' / ' + formatAmount(item.amount);
        return {
          id: String(item.id),
          title,
          invoiceDate: item.invoiceDate || '-',
          paymentDate: item.paymentDate || '-',
          isInvoiced: item.invoiceStatus === '已开票',
          isPaid: item.paymentStatus === '已回款',
        };
      });
    this.setData({ filteredList: list });
  },

  onFilterTypeChange(e) {
    this.setData({ filterIndex: Number(e.detail.value) }, () => this.search());
  },
  onStartYearChange(e) {
    this.setData({ startYearIndex: Number(e.detail.value) }, () => this.search());
  },
  onStartMonthChange(e) {
    this.setData({ startMonthIndex: Number(e.detail.value) }, () => this.search());
  },
  onEndYearChange(e) {
    this.setData({ endYearIndex: Number(e.detail.value) }, () => this.search());
  },
  onEndMonthChange(e) {
    this.setData({ endMonthIndex: Number(e.detail.value) }, () => this.search());
  },
  onTypeChange(e) {
    this.setData({ typeIndex: Number(e.detail.value) }, () => this.search());
  },
  onUserChange(e) {
    const idx = Number(e.detail.value);
    const userId = idx === 0 ? 'all' : String(this.data.users[idx - 1].id);
    app.setSelectedUserId(userId);
    this.setData({ userIndex: idx, selectedUserId: userId }, () => this.search());
  },

  onSearchTap() {
    this.search();
  },

  onStatusCardTap(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ statusFilter: this.data.statusFilter === key ? 'all' : key }, () => this.applyStatusFilter());
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

  openItem(e) {
    const id = String(e.currentTarget.dataset.id);
    const item = this.data.rawList.find((it) => String(it.id) === id);
    if (!item) return;
    this.hideTab();
    this.setData({
      selectedAppointment: {
        id: String(item.id),
        userId: String(item.userId || ''),
        date: item.date || '',
        timePeriod: item.timePeriod || '上午',
        company: item.company || '',
        type: item.type || '面谈',
        teacherId: item.teacherId ? String(item.teacherId) : String(item.userId || ''),
        amount: item.amount,
        remark: item.remark || '',
        status: item.status || '待审核',
        customerName: item.customerName || item.company || '',
        paymentStatus: item.paymentStatus || '未回款',
        invoiceStatus: item.invoiceStatus || '未开票',
        invoiceNo: item.invoiceNo || '',
        invoiceDate: item.invoiceDate || '',
        paymentDate: item.paymentDate || '',
        province: item.province || '',
        city: item.city || '',
      },
      showModal: true,
    });
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
      this.search();
    } catch (err) {
      wx.showToast({ title: '保存失败，请检查网络', icon: 'none' });
    }
  },

  onModalDelete(e) {
    calendarApi
      .remove(e.detail.id)
      .then(() => {
        this.setData({ showModal: false });
        this.showTab();
        this.search();
      })
      .catch(() => {
        wx.showToast({ title: '删除失败', icon: 'none' });
      });
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
