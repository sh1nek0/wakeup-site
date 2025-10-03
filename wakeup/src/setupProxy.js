// site_stable/wakeup-site/wakeup/src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
      pathRewrite: {
        '^/api': '',
      },
      logLevel: 'debug' // <--- ДОБАВЬТЕ ЭТУ СТРОКУ
    })
  );
};