const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const services = require('../config/services');

const timeout = () => parseInt(process.env.GATEWAY_PROXY_TIMEOUT_MS, 10) || 10000;

// One proxy per service. pathFilter keeps the full original path (/api/users/...)
// so the backend routes need no changes.
const buildProxies = () =>
  services.map((svc) =>
    createProxyMiddleware({
      target: svc.target,
      changeOrigin: true,
      pathFilter: (pathname) => pathname === svc.prefix || pathname.startsWith(`${svc.prefix}/`),
      proxyTimeout: timeout(),
      timeout: timeout(),
      logger: undefined,
      on: {
        // Never forward the gateway key to backend services
        proxyReq: (proxyReq, req) => {
          proxyReq.removeHeader('x-api-key');
          fixRequestBody(proxyReq, req); // re-send body consumed by express.json()
        },
        error: (err, req, res) => {
          if (!res || res.headersSent || typeof res.writeHead !== 'function') return;
          const timedOut = ['ETIMEDOUT', 'ECONNRESET', 'ESOCKETTIMEDOUT'].includes(err.code) ||
            /timeout/i.test(err.message || '');
          const status = timedOut ? 504 : 503;
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: timedOut ? 'GATEWAY_TIMEOUT' : 'SERVICE_UNAVAILABLE',
            message: timedOut
              ? `The ${svc.name} service did not respond in time.`
              : `The ${svc.name} service is currently unavailable.`,
          }));
        },
      },
    })
  );

module.exports = buildProxies;
