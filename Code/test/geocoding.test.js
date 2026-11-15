const { expect } = require('chai');
const sinon = require('sinon');
const axios = require('axios');
const request = require('supertest');
const app = require('../src/app');
const GeocodeCache = require('../src/models/GeocodeCache');
const { createUser, createVehicle, bearer } = require('./helpers/factories');

// Fresh geocoding modules per test: resets the in-memory cache, queue and 429 back-off.
const fresh = () => {
  Object.keys(require.cache).filter((k) => /src\/services\/geocoding\//.test(k)).forEach((k) => delete require.cache[k]);
  return require('../src/services/geocoding');
};
const hit = (lat = '21.2577979', lon = '81.6302867', name = 'Raipur Junction, Raipur, India') =>
  ({ status: 200, headers: {}, data: [{ lat, lon, display_name: name }] });

describe('TEST 8: Nominatim geocoding (HTTP mocked)', () => {
  let get;
  beforeEach(() => { get = sinon.stub(axios, 'get'); });
  afterEach(() => sinon.restore());

  it('converts an address to coordinates using the Nominatim search API', async () => {
    get.resolves(hit());
    const { geocodeAddress } = fresh();
    const r = await geocodeAddress('Raipur Railway Station, Chhattisgarh, India');

    expect(r).to.include({ latitude: 21.2577979, longitude: 81.6302867, provider: 'nominatim', cached: false });
    expect(r.formattedAddress).to.include('Raipur');
    expect(r.attribution).to.match(/OpenStreetMap/);

    const [url, opts] = get.firstCall.args;
    expect(url).to.equal('https://nominatim.openstreetmap.org/search');
    expect(opts.params).to.deep.equal({ q: 'Raipur Railway Station, Chhattisgarh, India', format: 'jsonv2', limit: 1 });
    expect(opts.headers['User-Agent']).to.be.a('string').and.not.empty;
  });

  it('reports an unknown address as 404 ADDRESS_NOT_FOUND', async () => {
    get.resolves({ status: 200, headers: {}, data: [] });
    const err = await fresh().geocodeAddress('zzzz qqqq nowhere').catch((e) => e);
    expect(err.statusCode).to.equal(404);
    expect(err.code).to.equal('ADDRESS_NOT_FOUND');
  });

  it('rejects blank / non-string / oversized addresses before any HTTP call', async () => {
    const { geocodeAddress } = fresh();
    for (const bad of [undefined, '', '   ', 42, 'x'.repeat(301)]) {
      const err = await geocodeAddress(bad).catch((e) => e);
      expect(err.statusCode, String(bad).slice(0, 10)).to.equal(400);
    }
    expect(get.called).to.be.false;
  });

  it('maps a timeout to 504 GEOCODER_TIMEOUT and a network failure to 502', async () => {
    get.rejects(Object.assign(new Error('timeout of 500ms exceeded'), { code: 'ECONNABORTED' }));
    let err = await fresh().geocodeAddress('somewhere slow').catch((e) => e);
    expect([err.statusCode, err.code]).to.deep.equal([504, 'GEOCODER_TIMEOUT']);

    get.rejects(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }));
    err = await fresh().geocodeAddress('somewhere offline').catch((e) => e);
    expect([err.statusCode, err.code]).to.deep.equal([502, 'GEOCODER_UNAVAILABLE']);
  });

  it('rejects invalid coordinates returned by the provider', async () => {
    const { geocodeAddress } = fresh();
    for (const [lat, lon] of [['123', '10'], ['10', '500'], ['abc', '10'], ['10', '']]) {
      get.resolves(hit(lat, lon));
      const err = await geocodeAddress(`bad coords ${lat}/${lon}`).catch((e) => e);
      expect([err.statusCode, err.code], `${lat},${lon}`).to.deep.equal([502, 'GEOCODER_INVALID_COORDINATES']);
    }
  });

  it('handles HTTP 429: surfaces Retry-After and backs off without hitting the provider again', async () => {
    get.resolves({ status: 429, headers: { 'retry-after': '30' }, data: '' });
    const { geocodeAddress } = fresh();
    const first = await geocodeAddress('rate limited one').catch((e) => e);
    expect([first.statusCode, first.code, first.retryAfter]).to.deep.equal([429, 'GEOCODER_RATE_LIMITED', 30]);
    expect(get.callCount).to.equal(1);

    get.resolves(hit()); // provider recovers, but we must still be backing off
    const second = await geocodeAddress('a different address').catch((e) => e);
    expect(second.statusCode).to.equal(429);
    expect(second.retryAfter).to.be.within(1, 30);
    expect(get.callCount).to.equal(1);
  });

  it('serves repeated and equivalent addresses from cache with a single provider call', async () => {
    get.resolves(hit());
    const { geocodeAddress } = fresh();
    const a = await geocodeAddress('Raipur Railway Station');
    const b = await geocodeAddress('  raipur   RAILWAY station ');
    expect(a.cached).to.be.false;
    expect(b.cached).to.be.true;
    expect(b.latitude).to.equal(a.latitude);
    expect(get.callCount).to.equal(1);
  });

  it('persists to the database cache so a restart does not trigger a new request', async () => {
    get.resolves(hit());
    await fresh().geocodeAddress('Durg Railway Station');
    expect(await GeocodeCache.countDocuments()).to.equal(1);

    const restarted = fresh(); // empty memory cache
    const r = await restarted.geocodeAddress('Durg Railway Station');
    expect(r.cached).to.be.true;
    expect(get.callCount).to.equal(1);
  });

  it('shares one upstream request between concurrent identical lookups and serialises different ones', async () => {
    const starts = [];
    get.callsFake(async () => { starts.push(Date.now()); await new Promise((r) => setTimeout(r, 30)); return hit(); });
    const { geocodeAddress } = fresh();
    await Promise.all([geocodeAddress('same address'), geocodeAddress('same address'), geocodeAddress('Same Address')]);
    expect(get.callCount).to.equal(1);

    await Promise.all([geocodeAddress('addr one'), geocodeAddress('addr two')]);
    expect(get.callCount).to.equal(3);
    // the two distinct lookups never overlapped (second started after the first finished ≥30ms)
    expect(starts[2] - starts[1]).to.be.at.least(30);
  });

  it('POST /api/maps/geocode/:vehicleId saves coordinates to the vehicle (no real network)', async () => {
    get.resolves(hit('21.1', '81.2', 'Test Place, India'));
    const { token } = await createUser('fleet_manager');
    const v = await createVehicle();
    const res = await request(app).post(`/api/maps/geocode/${v.vehicleId}`).set(bearer(token))
      .send({ address: `Route test place ${v.vehicleId}` });
    expect(res.status).to.equal(200);
    expect(res.body.data.vehicle.location).to.include({ latitude: 21.1, longitude: 81.2 });
    expect(res.body.data.vehicle.address).to.equal('Test Place, India');
    expect(res.body.data.coordinates.provider).to.equal('nominatim');
  });

  it('route: unknown vehicle → 404 without calling Nominatim; viewer → 403; missing address → 400', async () => {
    const mgr = await createUser('fleet_manager');
    const viewer = await createUser('viewer');
    expect((await request(app).post('/api/maps/geocode/NOPE').set(bearer(mgr.token)).send({ address: 'x place' })).status).to.equal(404);
    expect(get.called).to.be.false;
    expect((await request(app).post('/api/maps/geocode').set(bearer(viewer.token)).send({ address: 'x' })).status).to.equal(403);
    expect((await request(app).post('/api/maps/geocode').set(bearer(mgr.token))).status).to.equal(400);
  });
});
