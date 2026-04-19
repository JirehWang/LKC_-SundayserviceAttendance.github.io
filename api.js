/**
 * api.js - GAS API 橋接層
 * 模擬 google.script.run 語法，底層改用 fetch 呼叫 GAS Web App
 */

// 確保 config.js 已載入
if (typeof window.GAS_CONFIG === 'undefined') {
  console.error('❌ 找不到 config.js，請確認 config.js 已正確載入');
}

/**
 * 模擬 google.script.url.getLocation
 */
const google = {
  script: {
    url: {
      getLocation: function(callback) {
        const params = {};
        new URLSearchParams(window.location.search).forEach((v, k) => { params[k] = v; });
        callback({ parameter: params });
      }
    },
    run: new Proxy({}, {
      get(_, functionName) {
        let successHandler = null;
        let failureHandler = (err) => console.error('GAS Error:', err);

        const runner = {
          withSuccessHandler(fn) {
            successHandler = fn;
            return runner;
          },
          withFailureHandler(fn) {
            failureHandler = fn;
            return runner;
          }
        };

        // 動態產生每個函式名稱對應的呼叫
        runner[functionName] = function(...args) {
          const apiUrl = window.GAS_CONFIG && window.GAS_CONFIG.apiUrl;
          if (!apiUrl || apiUrl.includes('YOUR_SCRIPT_ID')) {
            const errMsg = '❌ 請先設定 config.js 中的 GAS Web App URL！';
            console.error(errMsg);
            if (failureHandler) failureHandler(new Error(errMsg));
            return;
          }

          fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: functionName, payload: args.length === 1 ? args[0] : args })
          })
          .then(res => res.json())
          .then(data => {
            if (data.error) {
              if (failureHandler) failureHandler(new Error(data.error));
            } else {
              if (successHandler) successHandler(data.data);
            }
          })
          .catch(err => {
            if (failureHandler) failureHandler(err);
          });
        };

        return runner;
      }
    })
  }
};
