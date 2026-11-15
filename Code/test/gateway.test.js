const { expect } = require('chai');
const request = require('supertest');
const http = require('http');
const backend = require('../src/app');
const { createUser, createVehicle, bearer } = require('./helpers/factories');

const KEY = 'test-gateway-key';
const purge = () => Object.keys(require.cache)
  .filter((k) => /\/gateway\/(gateway|config|middleware)/.test(k))
  .forEach((k) => delete require.cache[k]);

describe('TEST 7: API gateway', () => {
  let server;
  const env = {};
  const setEnv = (vars) => Object.entries(vars).forEach(([k, v]) => {
    if (!(k in env)) env[k] = process.env[k];
    process.env[k] = v;
  });
  const loadGateway = (vars = {}) => {
    setEnv(vars);
    purge();
    return require('../gateway/gateway');
  };

  before((done) => {
    server = http.createServer(backend).listen(0, () => {
      const url = `http://127.0.0.1:${server.address().port}`;
      setEnv({
        USER_SERVICE_URL: url, VEHICLE_SERVICE_URL: url, TELEMETRY_SERVICE_URL: url,
        GEOLOCATION_SERVICE_URL: url, NOTIFICATION_SERVICE_URL: url,
      });
      done();
    });
  });
  after((done) => {
    Object.entries(env).forEach(([k, v]) => (v === undefined ? delete process.env[k] : (process.env[k] = v)));
    purge();
    server.close(done);
  });

  describe('API key verification and forwarding', () => {
    let gw;
    before(() => { gw = loadGateway({ RATE_LIMIT_MAX: '1000' }); });

    it('rejects a missing API key with 401', async () => {
      const res = await request(gw).get('/api/vehicles');
      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal('MISSING_API_KEY');
    });

    it('rejects an invalid API key with 401 and never echoes either key', async () => {
      const res = await request(gw).get('/api/vehicles').set('x-api-key', 'wrong-key');
      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal('INVALID_API_KEY');
      expect(JSON.stringify(res.body)).to.not.include(KEY).and.not.include('wrong-key');
    });

    it('forwards valid requests: login, then JWT-protected vehicle retrieval', async () => {
      const { user, password } = await createUser('admin');
      const v = await createVehicle();
      const login = await request(gw).post('/api/users/login').set('x-api-key', KEY).send({ email: user.email, password });
      expect(login.status).to.equal(200);
      const { token } = login.body.data;

      const list = await request(gw).get('/api/vehicles').set('x-api-key', KEY).set(bearer(token));
      expect(list.status).to.equal(200);
      expect(list.body.data.map((x) => x.vehicleId)).to.include(v.vehicleId);

      const one = await request(gw).get(`/api/vehicles/${v.vehicleId}`).set('x-api-key', KEY).set(bearer(token));
      expect(one.body.data.vehicleId).to.equal(v.vehicleId);
    });

    it('passes backend authorization errors through (401 JWT, 403 role)', async () => {
      const { token } = await createUser('viewer');
      const v = await createVehicle();
      expect((await request(gw).get('/api/vehicles').set('x-api-key', KEY)).status).to.equal(401);
      expect((await request(gw).delete(`/api/vehicles/${v.vehicleId}`).set('x-api-key', KEY).set(bearer(token))).status).to.equal(403);
    });

    it('returns 400 for malformed JSON and 404 for unknown routes', async () => {
      const bad = await request(gw).post('/api/users/login').set('x-api-key', KEY)
        .set('Content-Type', 'application/json').send('{broken');
      expect(bad.status).to.equal(400);
      expect(bad.body.error).to.equal('MALFORMED_JSON');
      expect((await request(gw).get('/api/unknown').set('x-api-key', KEY)).status).to.equal(404);
    });

    it('/health is public, lists services and exposes no secrets', async () => {
      const res = await request(gw).get('/health');
      expect(res.status).to.equal(200);
      expect(res.body.services).to.have.all.keys('user', 'vehicle', 'telemetry', 'geolocation', 'notification');
      expect(JSON.stringify(res.body)).to.not.include(KEY).and.not.include('127.0.0.1');
    });

    it('serves the OpenAPI JSON and Swagger UI without an API key', async () => {
      const spec = await request(gw).get('/api-docs.json');
      expect(spec.status).to.equal(200);
      expect(spec.body.openapi).to.match(/^3\./);
      expect(spec.body.components.securitySchemes).to.have.all.keys('ApiKeyAuth', 'BearerAuth');
      expect((await request(gw).get('/api-docs/')).status).to.equal(200);
    });
  });

  describe('rate limiting', () => {
    it('returns 429 with standard headers after the limit is exceeded, but not on /health', async () => {
      const gw = loadGateway({ RATE_LIMIT_MAX: '3', RATE_LIMIT_WINDOW_MS: '60000' });
      const codes = [];
      for (let i = 0; i < 5; i++) codes.push((await request(gw).get('/api/vehicles').set('x-api-key', 'bad')).status);
      expect(codes).to.deep.equal([401, 401, 401, 429, 429]);

      const limited = await request(gw).get('/api/vehicles').set('x-api-key', KEY);
      expect(limited.status).to.equal(429);
      expect(limited.body.error).to.equal('RATE_LIMIT_EXCEEDED');
      expect(limited.body.retryAfterSeconds).to.be.above(0);
      expect(limited.headers).to.include.keys('ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset', 'retry-after');
      expect(limited.headers['ratelimit-limit']).to.equal('3');

      expect((await request(gw).get('/health')).status).to.equal(200);
    });
  });

  describe('service outage', () => {
    it('returns 503 when the target service is unreachable', async () => {
      const gw = loadGateway({ RATE_LIMIT_MAX: '1000', VEHICLE_SERVICE_URL: 'http://127.0.0.1:1' });
      const res = await request(gw).get('/api/vehicles').set('x-api-key', KEY);
      expect(res.status).to.equal(503);
      expect(res.body.error).to.equal('SERVICE_UNAVAILABLE');
      const health = await request(gw).get('/health');
      expect(health.status).to.equal(503);
      expect(health.body.services.vehicle.status).to.equal('unavailable');
    });
  });
});
