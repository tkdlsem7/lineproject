// frontend/src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://backend:8000', // ← compose 서비스 이름
      changeOrigin: true,
      // 백엔드 라우트가 /api 없이 시작하면 아래 주석 해제
      // pathRewrite: { '^/api': '' },
      logLevel: 'debug',
    })
  );
};
