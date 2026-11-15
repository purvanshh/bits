const { expect } = require('chai');
const request = require('supertest');
const sinon = require('sinon');
const app = require('../src/app');
const Telemetry = require('../src/models/Telemetry');
const Vehicle = require('../src/models/Vehicle');
const Notification = require('../src/models/Notification');
const { createUser, createVehicle, bearer, waitFor } = require('./helpers/factories');

describe('TEST 3: telemetry submission and storage', () => {
  afterEach(() => sinon.restore());

  it('stores telemetry with GPS coordinates and updates the vehicle location', async () => {
    const { token } = await createUser('fleet_manager');
    const v = await createVehicle();
    const body = { vehicleId: v.vehicleId, latitude: 21.2514, longitude: 81.6296, speed: 42, engineTemperature: 85, batteryLevel: 77 };

    const res = await request(app).post('/api/telemetry').set(bearer(token)).send(body);
    expect(res.status).to.equal(201);
    expect(res.body.data).to.include({ latitude: 21.2514, longitude: 81.6296, eventType: 'NORMAL' });

    const rec = await Telemetry.findOne({ vehicleId: v.vehicleId });
    expect(rec).to.exist;
    expect(rec.latitude).to.equal(21.2514);
    expect(rec.longitude).to.equal(81.6296);
    expect(rec.speed).to.equal(42);

    const updated = await Vehicle.findOne({ vehicleId: v.vehicleId });
    expect(updated.location.latitude).to.equal(21.2514);
    expect(updated.location.longitude).to.equal(81.6296);
    expect(updated.batteryLevel).to.equal(77);
    expect(updated.operationalStatus).to.equal('active'); // speed > 0
    expect(await Notification.countDocuments()).to.equal(0); // normal event: no SMS
  });

  it('returns latest, history and fleet-wide recent events', async () => {
    const { token } = await createUser('admin');
    const v = await createVehicle();
    sinon.stub(Math, 'random').returns(0.99); // MockSMS succeeds
    for (const lat of [10, 11, 12]) {
      await request(app).post('/api/telemetry').set(bearer(token))
        .send({ vehicleId: v.vehicleId, latitude: lat, longitude: 70, speed: 0 });
    }
    await request(app).post('/api/telemetry').set(bearer(token))
      .send({ vehicleId: v.vehicleId, latitude: 13, longitude: 70, eventType: 'EMERGENCY_STOP' });

    const latest = await request(app).get(`/api/telemetry/${v.vehicleId}/latest`).set(bearer(token));
    expect(latest.body.data.latitude).to.equal(13);
    const hist = await request(app).get(`/api/telemetry/${v.vehicleId}?limit=2`).set(bearer(token));
    expect(hist.body.count).to.equal(2);
    const crit = await request(app).get('/api/telemetry/recent?critical=true').set(bearer(token));
    expect(crit.body.data.map((r) => r.eventType)).to.deep.equal(['EMERGENCY_STOP']);
    await waitFor(() => Notification.countDocuments());
  });

  it('validates required fields and permissions', async () => {
    const mgr = await createUser('fleet_manager');
    const viewer = await createUser('viewer');
    expect((await request(app).post('/api/telemetry').set(bearer(mgr.token)).send({ vehicleId: 'X' })).status).to.equal(400);
    const res = await request(app).post('/api/telemetry').set(bearer(viewer.token))
      .send({ vehicleId: 'X', latitude: 1, longitude: 1 });
    expect(res.status).to.equal(403);
    expect((await request(app).get('/api/telemetry/NONE/latest').set(bearer(viewer.token))).status).to.equal(404);
  });
});
