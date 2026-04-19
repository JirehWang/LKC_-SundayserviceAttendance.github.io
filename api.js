/**
 * api.js — GAS Web App 橋接層
 * 
 * 原本 GAS 使用 google.script.run.withSuccessHandler(cb).functionName(args)
 * 這裡把每個後端函式包裝成 async function，讓前端代碼改動最小化。
 * 
 * 使用前：在 config.js 設定正確的 GAS_API_URL
 */

const GAS_API_URL = window.GAS_CONFIG?.apiUrl || '';

/**
 * 核心 HTTP 呼叫函式
 * @param {string} action - 對應 GAS 後端的函式名稱
 * @param {any} payload - 傳入參數
 * @returns {Promise<any>} - 後端回傳的資料
 */
async function callGAS(action, payload = null) {
  if (!GAS_API_URL) {
    throw new Error('尚未設定 GAS API URL，請確認 config.js');
  }

  const body = { action };
  if (payload !== null) body.payload = payload;

  const response = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // GAS 需要 text/plain 才能讀到 postData
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error('HTTP 錯誤：' + response.status);

  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return result.data !== undefined ? result.data : result;
}

/**
 * google.script.run 模擬器
 * 
 * 用法與原本 GAS 前端完全相同：
 *   google.script.run
 *     .withSuccessHandler(cb)
 *     .withFailureHandler(errCb)
 *     .functionName(arg1, arg2)
 */
const google = {
  script: {
    run: new Proxy({}, {
      get(_, functionName) {
        // 回傳一個物件，支援鏈式呼叫 .withSuccessHandler().withFailureHandler()
        const runner = {
          _success: null,
          _failure: null,
          withSuccessHandler(cb) { this._success = cb; return this; },
          withFailureHandler(cb) { this._failure = cb; return this; },
        };

        // 再一層 Proxy，當真正呼叫函式名稱時執行 API
        return new Proxy(runner, {
          get(target, prop) {
            if (prop in target) return target[prop].bind(target);
            // 如果是函式名稱，回傳一個會發出請求的函式
            return (...args) => {
              const payload = args.length === 0 ? null : (args.length === 1 ? args[0] : args);
              callGAS(functionName, payload)
                .then(data => { if (target._success) target._success(data); })
                .catch(err => { if (target._failure) target._failure(err); else console.error('[GAS API Error]', functionName, err); });
            };
          }
        });
      }
    }),

    // google.script.url.getLocation 模擬：從瀏覽器 URL 參數讀取
    url: {
      getLocation(callback) {
        const params = {};
        new URLSearchParams(window.location.search).forEach((v, k) => { params[k] = v; });
        callback({ parameter: params });
      }
    }
  }
};
