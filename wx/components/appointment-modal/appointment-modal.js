const { provinces, cities } = require('../../data/locationData');
const { companies } = require('../../data/companies');
const { today } = require('../../utils/util');

const provinceLabels = provinces.map((p) => p.label);

Component({
  properties: {
    visible: { type: Boolean, value: false },
    appointment: { type: Object, value: null },
    defaultDate: { type: String, value: '' },
    users: { type: Array, value: [] },
    currentUser: { type: Object, value: null },
  },

  data: {
    form: {
      date: '',
      timePeriod: '上午',
      company: '',
      type: '面谈',
      teacherId: '',
      amount: '',
      remark: '',
      status: '待审核',
      customerName: '',
      paymentStatus: '未回款',
      invoiceStatus: '未开票',
      invoiceNo: '',
      invoiceDate: '',
      paymentDate: '',
      province: '',
      city: '',
    },
    isEditing: false,
    pendingAction: '', // '' | 'invoice' | 'payment' | 'invoiceNo'
    actionDate: '',
    actionInvoiceNo: '',
    companyOpen: false,
    companySearch: '',
    filteredCompanies: companies,
    errors: { customerName: '', amount: '' },
    timePeriods: ['上午', '下午'],
    types: ['面谈', '培训', '会议', '网络'],
    provinceLabels,
    cityList: [],
    timePeriodIndex: 0,
    typeIndex: 0,
    teacherIndex: 0,
    provinceIndex: -1,
    cityIndex: -1,
    teacherNames: [],
    isLocked: false,
    canEdit: false,
    isFieldDisabled: false,
    showAmount: true,
    isAdmin: false,
  },

  observers: {
    visible(v) {
      if (v) this.initForm();
    },
    users(list) {
      this.setData({ teacherNames: (list || []).map((u) => u.name) });
    },
  },

  methods: {
    emptyForm(date) {
      const cu = this.data.currentUser;
      return {
        date: date || today(),
        timePeriod: '上午',
        company: '',
        type: '面谈',
        teacherId: cu ? String(cu.id) : '',
        amount: '',
        remark: '',
        status: '待审核',
        customerName: '',
        paymentStatus: '未回款',
        invoiceStatus: '未开票',
        invoiceNo: '',
        invoiceDate: '',
        paymentDate: '',
        province: '',
        city: '',
      };
    },

    initForm() {
      const appt = this.data.appointment;
      const cu = this.data.currentUser;
      let form;
      if (appt) {
        form = {
          date: appt.date || '',
          timePeriod: appt.timePeriod || '上午',
          company: appt.company || '',
          type: appt.type || '面谈',
          teacherId: appt.teacherId ? String(appt.teacherId) : cu ? String(cu.id) : '',
          amount: appt.amount !== undefined && appt.amount !== null ? String(appt.amount) : '',
          remark: appt.remark || '',
          status: appt.status || '待审核',
          customerName: appt.customerName || appt.company || '',
          paymentStatus: appt.paymentStatus || '未回款',
          invoiceStatus: appt.invoiceStatus || '未开票',
          invoiceNo: appt.invoiceNo || '',
          invoiceDate: appt.invoiceDate || '',
          paymentDate: appt.paymentDate || '',
          province: appt.province || '',
          city: appt.city || '',
        };
      } else {
        form = this.emptyForm(this.data.defaultDate);
      }

      const users = this.data.users || [];
      const teacherNames = users.map((u) => u.name);
      let teacherIndex = users.findIndex((u) => String(u.id) === String(form.teacherId));
      if (teacherIndex < 0) teacherIndex = 0;
      if (users.length && !form.teacherId) form.teacherId = String(users[0].id);

      const provinceIndex = provinceLabels.indexOf(form.province);
      const cityList = form.province ? (cities[form.province] || []).map((c) => c.label) : [];
      const cityIndex = cityList.indexOf(form.city);

      this.setData(
        {
          form,
          isEditing: false,
          pendingAction: '',
          companyOpen: false,
          companySearch: '',
          filteredCompanies: companies,
          errors: { customerName: '', amount: '' },
          teacherNames,
          teacherIndex,
          timePeriodIndex: Math.max(0, this.data.timePeriods.indexOf(form.timePeriod)),
          typeIndex: Math.max(0, this.data.types.indexOf(form.type)),
          provinceIndex,
          cityList,
          cityIndex,
        },
        () => this.refreshFlags()
      );
    },

    refreshFlags() {
      const { form, appointment, currentUser, isEditing } = this.data;
      const isLocked = form.invoiceStatus === '已开票' || form.paymentStatus === '已回款';
      const isAdmin = !!currentUser && currentUser.role === 'admin';
      const canEdit = isAdmin || String(form.teacherId) === String(currentUser && currentUser.id);
      const isFieldDisabled = isLocked || (!!appointment && (!isEditing || !canEdit));
      const showAmount = !appointment || canEdit;
      this.setData({ isLocked, canEdit, isFieldDisabled, showAmount, isAdmin });
    },

    // ---------- 表单变更 ----------
    onDateChange(e) {
      this.setData({ 'form.date': e.detail.value });
    },
    onTimePeriodChange(e) {
      const i = Number(e.detail.value);
      this.setData({ timePeriodIndex: i, 'form.timePeriod': this.data.timePeriods[i] });
    },
    onTypeChange(e) {
      const i = Number(e.detail.value);
      this.setData({ typeIndex: i, 'form.type': this.data.types[i] });
    },
    onTeacherChange(e) {
      const i = Number(e.detail.value);
      const u = this.data.users[i];
      this.setData({ teacherIndex: i, 'form.teacherId': u ? String(u.id) : '' }, () => this.refreshFlags());
    },
    onProvinceChange(e) {
      const i = Number(e.detail.value);
      const p = this.data.provinceLabels[i];
      const cityList = (cities[p] || []).map((c) => c.label);
      this.setData({ provinceIndex: i, 'form.province': p, 'form.city': '', cityList, cityIndex: -1 });
    },
    onCityChange(e) {
      const i = Number(e.detail.value);
      this.setData({ cityIndex: i, 'form.city': this.data.cityList[i] });
    },
    onCustomerNameInput(e) {
      this.setData({ 'form.customerName': e.detail.value, 'errors.customerName': '' });
    },
    onAmountInput(e) {
      this.setData({ 'form.amount': e.detail.value, 'errors.amount': '' });
    },
    onRemarkInput(e) {
      this.setData({ 'form.remark': e.detail.value });
    },

    // ---------- 公司搜索下拉 ----------
    toggleCompany() {
      if (this.data.isFieldDisabled) return;
      this.setData({ companyOpen: !this.data.companyOpen, companySearch: '', filteredCompanies: companies });
    },
    onCompanySearch(e) {
      const kw = (e.detail.value || '').toLowerCase();
      this.setData({
        companySearch: e.detail.value,
        filteredCompanies: companies.filter((c) => c.toLowerCase().indexOf(kw) >= 0),
      });
    },
    selectCompany(e) {
      const c = e.currentTarget.dataset.value;
      this.setData({ 'form.company': c, companyOpen: false, companySearch: '' });
    },

    // ---------- 校验与保存 ----------
    validate() {
      const errors = { customerName: '', amount: '' };
      let ok = true;
      if (!String(this.data.form.customerName).trim()) {
        errors.customerName = '客户名称为必填项';
        ok = false;
      }
      const amount = Number(this.data.form.amount);
      if (this.data.form.amount === '' || isNaN(amount) || amount < 0) {
        errors.amount = '课程价格不能为负数';
        ok = false;
      }
      this.setData({ errors });
      return ok;
    },

    buildPayload(overrides) {
      const f = this.data.form;
      const appt = this.data.appointment;
      return Object.assign(
        {
          id: appt ? String(appt.id) : '',
          date: f.date,
          timePeriod: f.timePeriod,
          company: f.company,
          type: f.type,
          teacherId: f.teacherId,
          amount: Number(f.amount) || 0,
          remark: f.remark,
          status: f.status,
          customerName: f.customerName,
          paymentStatus: f.paymentStatus,
          invoiceStatus: f.invoiceStatus,
          invoiceNo: f.invoiceNo,
          invoiceDate: f.invoiceDate,
          paymentDate: f.paymentDate,
          province: f.province,
          city: f.city,
        },
        overrides || {}
      );
    },

    startEdit() {
      this.setData({ isEditing: true }, () => this.refreshFlags());
    },

    submitForm() {
      if (!this.validate()) return;
      this.triggerEvent('save', this.buildPayload());
    },

    onDeleteTap() {
      const appt = this.data.appointment;
      if (appt && appt.id) {
        this.triggerEvent('delete', { id: String(appt.id) });
      }
    },

    // ---------- 开票 / 回款操作 ----------
    openAction(e) {
      const action = e.currentTarget.dataset.action;
      this.setData({
        pendingAction: action,
        actionDate: today(),
        actionInvoiceNo: this.data.form.invoiceNo || '',
      });
    },
    cancelAction() {
      this.setData({ pendingAction: '' });
    },
    onActionDateChange(e) {
      this.setData({ actionDate: e.detail.value });
    },
    onActionInvoiceNoInput(e) {
      this.setData({ actionInvoiceNo: e.detail.value });
    },
    confirmAction() {
      const { pendingAction, actionDate, actionInvoiceNo } = this.data;
      if (!pendingAction) return;
      let overrides = {};
      if (pendingAction === 'invoice') {
        overrides = { invoiceStatus: '已开票', invoiceDate: actionDate, invoiceNo: actionInvoiceNo.trim() };
      } else if (pendingAction === 'payment') {
        overrides = { paymentStatus: '已回款', paymentDate: actionDate };
      } else {
        overrides = { invoiceNo: actionInvoiceNo.trim() };
      }
      this.triggerEvent('save', this.buildPayload(overrides));
    },

    markUnpaid() {
      this.triggerEvent('save', this.buildPayload({ paymentStatus: '未回款', paymentDate: '' }));
    },

    close() {
      this.triggerEvent('close');
    },
    noop() {},
  },
});
