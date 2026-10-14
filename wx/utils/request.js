// ===== 网络请求封装 =====
// 正式环境通道：wx.cloud.callContainer 调用云托管（免域名、无频率限制、微信内网鉴权），
// 前提是小程序 AppID 与云开发环境已完成关联。
// 公网直连仅作为开发调试兜底：云托管默认域名仅限测试使用，不能作为正式环境的访问入口。

// 云托管环境与服务（与 cloudbaserc.json 保持一致）
const CLOUD_ENV = 't1-d4gojoquv03943719';
const CLOUD_SERVICE = 'schedule-system';

// ===== 正式环境公网域名（可选）=====
// 如果需要浏览器/第三方系统直连 API，请先在云托管控制台「HTTP 访问服务」绑定
// 已备案的自定义域名，然后填到这里，例如：https://api.example.com
const CUSTOM_API_HOST = '';

// 开发测试兜底地址（云托管默认域名，仅限开发测试使用，勿用于正式环境）
const FALLBACK_HOST = 'https://t1-297542-11-1462456996.sh.run.tcloudbase.com';

const BASE_URL = (CUSTOM_API_HOST || FALLBACK_HOST) + '/api';

// 是否发生过云调用失败（失败后本会话内直接走直连，避免每次请求都先超时）
let cloudBroken = false;

function cloudAvailable() {
  return !cloudBroken && !!wx.cloud && !!wx.cloud.callContainer;
}

// 通过云托管调用：path 不含 /api 前缀时由 callContainer 转发到容器内的完整路径
function requestViaCloud(options) {
  return new Promise((resolve, reject) => {
    wx.cloud.callContainer({
      config: { env: CLOUD_ENV },
      path: '/api' + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'X-WX-SERVICE': CLOUD_SERVICE,
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          // HTTP 层错误（业务报错），不再降级重试，避免写操作重复提交
          reject(new Error('请求失败（' + res.statusCode + '）'));
        }
      },
      fail(err) {
        // 云调用链路失败（环境未关联/网络问题等），交由上层降级为公网直连
        reject(new Error((err && err.errMsg) || '云托管调用失败'));
      },
    });
  });
}

// 公网直连
function requestViaHttp(options) {
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

// 诊断模式：双通道均失败时弹窗显示真实错误原因（排查真机网络问题用，定位后改回 false）
const DEBUG_NETWORK = true;

function showDebug(title, content) {
  if (!DEBUG_NETWORK) return;
  console.error('[网络诊断]', title, content);
  wx.showModal({
    title: title,
    content: content,
    showCancel: false,
    confirmText: '知道了',
  });
}

function request(options) {
  if (cloudAvailable()) {
    return requestViaCloud(options).catch((err) => {
      const msg = err && err.message ? err.message : String(err);
      // 仅当云调用链路本身失败时降级；HTTP 业务错误（"请求失败（xxx）"）不降级
      if (msg.indexOf('请求失败') !== 0) {
        cloudBroken = true;
        return requestViaHttp(options).catch((err2) => {
          showDebug(
            '云托管与公网直连均失败',
            '【云托管】' + msg + '\n【直连】' + ((err2 && err2.message) || String(err2))
          );
          throw err2;
        });
      }
      throw err;
    });
  }
  return requestViaHttp(options).catch((err) => {
    showDebug('公网直连失败', (err && err.message) || String(err));
    throw err;
  });
}

module.exports = { request, BASE_URL, CLOUD_ENV, CLOUD_SERVICE };
