require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
const swaggerUi = require('swagger-ui-express');

const services = require('./config/services');
const verifyApiKey = require('./middleware/apiKey');
const { makeApiLimiter, makeAuthLimiter } = require('./middleware/rateLimiter');
const buildProxies = require('./middleware/proxy');
const gatewayErrorHandler = require('./middleware/gatewayErrorHandler');
const swaggerSpec = require('./docs/swagger');

const app = express();
const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT, 10) || 4000;

if (process.env.NODE_ENV !== 'test') app.use(morgan('dev')); // logs method/url/status only — headers (x-api-key) are never logged
app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        upgradeInsecureRequests: null, // allow Swagger UI over plain http on localhost
      },
    },
  })
);

// ── Public endpoints: not API-key protected and not rate limited ─────────────
app.get('/health', async (req, res) => {
  // Probe each distinct service URL once
  const targets = [...new Set(services.map((s) => s.target))];
  const probes = {};
  await Promise.all(
    targets.map(async (target) => {
      const start = Date.now();
      try {
        const r = await axios.get(`${target}/health`, { timeout: 3000 });
        probes[target] = { status: r.data?.status || 'ok', latencyMs: Date.now() - start, database: r.data?.database };
      } catch {
        probes[target] = { status: 'unavailable', latencyMs: null };
      }
    })
  );

  // Expose service names only — never URLs, keys or env values
  const report = {};
  services.forEach((s) => {
    const p = probes[s.target];
    report[s.name] = { route: s.prefix, status: p.status, latencyMs: p.latencyMs };
  });
  const allOk = Object.values(report).every((s) => s.status === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    gateway: 'online',
    timestamp: new Date().toISOString(),
    services: report,
  });
});

app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Fleet Management API',
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, docExpansion: 'list', filter: true },
  })
);

// ── Protected API surface ────────────────────────────────────────────────────
// Order: rate limit (also throttles key guessing) → API key → body parse → proxy
const authLimiter = makeAuthLimiter();
app.use('/api', makeApiLimiter());
app.use(['/api/users/login', '/api/users/register'], authLimiter);
app.use('/api', verifyApiKey);
app.use('/api', express.json({ limit: '1mb' }));

buildProxies().forEach((proxy) => app.use(proxy));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found on this gateway.`,
  });
});
app.use(gatewayErrorHandler);

if (require.main === module) {
  app.listen(GATEWAY_PORT, () => {
    console.log(`API Gateway running on port ${GATEWAY_PORT}`);
    services.forEach((s) => console.log(`  ${s.prefix.padEnd(20)} → ${s.target}`));
    console.log(`  Swagger UI: http://localhost:${GATEWAY_PORT}/api-docs`);
  });
}

module.exports = app;
