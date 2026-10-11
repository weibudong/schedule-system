// 后端服务（腾讯云托管默认域名）
const BASE_URL = 'https://t1-297542-11-1462456996.sh.run.tcloudbase.com/api';

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: { 'Content-Type': 'application/json' },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error('请求失败（' + res.statusCode + '）'));
        }
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || '网络请求失败'));
      },
    });
  });
}

module.exports = { request, BASE_URL };
