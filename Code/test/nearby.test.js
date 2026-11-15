const { expect } = require('chai');
const request = require('supertest');
const sinon = require('sinon');
const axios = require('axios');
const app = require('../src/app');
const haversine = require('../src/utils/haversine');
const { createUser, createVehicle, bearer } = require('./helpers/factories');

describe('TEST 6: nearby vehicle search (Haversine)', () => {
  // Geolocation dependencies are mocked: any outbound HTTP call (Nominatim) fails the test.
  let httpStub;
  beforeEach(() => { httpStub = sinon.stub(axios, 'get').rejects(new Error('network must not be used')); });
  afterEach(() => sinon.restore());

  const RAIPUR = { latitude: 21.2514, longitude: 81.6296 };

  it('returns vehicles inside the radius with correct distances, sorted, excluding others', async () => {
    const { token } = await createUser('viewer');
    const near = await createVehicle({ location: { latitude: 21.2514, longitude: 81.6296 } });   // 0 km
    const mid = await createVehicle({ location: { latitude: 21.2093, longitude: 81.3785 } });    // Bhilai ~26 km
    await createVehicle({ location: { latitude: 22.0797, longitude: 82.1409 } });                // Bilaspur ~110 km
    await createVehicle();                                                                       // no coordinates

    const res = await request(app).get('/api/maps/nearby')
      .query({ ...RAIPUR, radius: 50 }).set(bearer(token));
    expect(res.status).to.equal(200);
    expect(res.body.count).to.equal(2);
    const ids = res.body.data.map((d) => d.vehicle.vehicleId);
    expect(ids).to.deep.equal([near.vehicleId, mid.vehicleId]);

    expect(res.body.data[0].distance).to.equal(0);
    const expected = haversine(RAIPUR.latitude, RAIPUR.longitude, 21.2093, 81.3785);
    expect(res.body.data[1].distance).to.be.closeTo(expected, 0.001);
    expect(res.body.data[1].distance).to.be.within(24, 28);
    expect(res.body.data.every((d) => d.distance <= 50)).to.be.true;
    expect(httpStub.called).to.be.false; // independent of Nominatim
  });

  it('known reference distance: one degree of latitude ≈ 111.19 km', () => {
    expect(haversine(0, 0, 1, 0)).to.be.closeTo(111.19, 0.05);
  });

  it('returns an empty list when nothing is in range', async () => {
    const { token } = await createUser('viewer');
    await createVehicle({ location: { latitude: 22.0797, longitude: 82.1409 } });
    const res = await request(app).get('/api/maps/nearby').query({ ...RAIPUR, radius: 5 }).set(bearer(token));
    expect(res.body).to.include({ success: true, count: 0 });
  });

  it('validates parameters with 400', async () => {
    const { token } = await createUser('viewer');
    const get = (q) => request(app).get('/api/maps/nearby').query(q).set(bearer(token));
    expect((await get({ latitude: 21 })).status).to.equal(400);
    expect((await get({ latitude: 95, longitude: 0, radius: 5 })).status).to.equal(400);
    expect((await get({ latitude: 0, longitude: 200, radius: 5 })).status).to.equal(400);
    expect((await get({ latitude: 0, longitude: 0, radius: -1 })).status).to.equal(400);
    expect((await get({ latitude: 'abc', longitude: 0, radius: 5 })).status).to.equal(400);
  });
});
