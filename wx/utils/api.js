const { request } = require('./request');

const calendarApi = {
  get(month, userId = '1') {
    let url = '/calendar?userId=' + encodeURIComponent(userId);
    if (month) url += '&month=' + encodeURIComponent(month);
    return request({ url });
  },
  create(data) {
    return request({
      url: '/calendar',
      method: 'POST',
      data: Object.assign({}, data, { userId: data.userId || '1' }),
    });
  },
  update(id, data) {
    return request({ url: '/calendar/' + id, method: 'PUT', data });
  },
  remove(id) {
    return request({ url: '/calendar/' + id, method: 'DELETE' });
  },
};

const performanceApi = {
  get(params) {
    const userId = params.userId || '1';
    const filterType = params.filterType || 'orderDate';
    let url = '/performance?userId=' + encodeURIComponent(userId) + '&filterType=' + encodeURIComponent(filterType);
    if (params.startDate) url += '&startDate=' + encodeURIComponent(params.startDate);
    if (params.endDate) url += '&endDate=' + encodeURIComponent(params.endDate);
    if (params.type) url += '&type=' + encodeURIComponent(params.type);
    return request({ url });
  },
};

const userApi = {
  login(phone, password) {
    return request({ url: '/users/login', method: 'POST', data: { phone, password } });
  },
  list() {
    return request({ url: '/users/list' });
  },
  create(data) {
    return request({ url: '/users', method: 'POST', data });
  },
};

module.exports = { calendarApi, performanceApi, userApi };
