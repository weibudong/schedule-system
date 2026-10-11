Component({
  properties: {
    visible: { type: Boolean, value: false },
  },

  data: {
    name: '',
    phone: '',
    password: '',
    errors: { name: '', phone: '', password: '' },
  },

  observers: {
    visible(v) {
      if (v) {
        this.setData({ name: '', phone: '', password: '', errors: { name: '', phone: '', password: '' } });
      }
    },
  },

  methods: {
    onNameInput(e) {
      this.setData({ name: e.detail.value, 'errors.name': '' });
    },
    onPhoneInput(e) {
      this.setData({ phone: e.detail.value, 'errors.phone': '' });
    },
    onPasswordInput(e) {
      this.setData({ password: e.detail.value, 'errors.password': '' });
    },

    submit() {
      const { name, phone, password } = this.data;
      const errors = { name: '', phone: '', password: '' };
      let ok = true;
      if (!name.trim()) {
        errors.name = '姓名为必填项';
        ok = false;
      }
      if (!phone.trim()) {
        errors.phone = '手机号为必填项';
        ok = false;
      }
      if (!password.trim()) {
        errors.password = '密码为必填项';
        ok = false;
      } else if (password.length < 3) {
        errors.password = '密码长度不能少于3位';
        ok = false;
      }
      this.setData({ errors });
      if (!ok) return;
      this.triggerEvent('submit', { name: name.trim(), phone: phone.trim(), password });
    },

    close() {
      this.triggerEvent('close');
    },
    noop() {},
  },
});
