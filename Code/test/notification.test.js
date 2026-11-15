const { expect } = require('chai');
const request = require('supertest');
const sinon = require('sinon');
const app = require('../src/app');
const Notification = require('../src/models/Notification');
const { createUser, createVehicle, bearer, waitFor } = require('./helpers/factories');

describe('TEST 4: operational status and notifications', () => {
  afterEach(() => sinon.restore());

  it('status change generates and saves a "sent" MockSMS notification', async () => {
    sinon.stub(Math, 'random').returns(0.99); // > 0.15 → MockSMS succeeds
    const logSpy = sinon.stub(console, 'log');
    const { token } = await createUser('fleet_manager');
    const v = await createVehicle();

    const res = await request(app).patch(`/api/vehicles/${v.vehicleId}/status`).set(bearer(token))
      .send({ operationalStatus: 'maintenance' });
    expect(res.status).to.equal(200);
    expect(res.body.data.operationalStatus).to.equal('maintenance');

    const n = await waitFor(() => Notification.findOne({ vehicleId: v.vehicleId }));
    logSpy.restore();
    expect(n.eventType).to.equal('STATUS_CHANGE');
    expect(n.status).to.equal('sent');
    expect(n.provider).to.equal('MockSMS');
    expect(n.recipient).to.equal(process.env.ADMIN_PHONE);
    expect(n.message).to.include(v.vehicleId).and.include('maintenance');
    expect(n.failureReason).to.be.null;
  });

  it('records a "failed" notification with a reason when MockSMS fails', async () => {
    sinon.stub(Math, 'random').returns(0.01); // < 0.15 → simulated failure
    const { token } = await createUser('admin');
    const v = await createVehicle();

    await request(app).post('/api/telemetry').set(bearer(token))
      .send({ vehicleId: v.vehicleId, latitude: 1, longitude: 1, eventType: 'ENGINE_FAULT' });

    const n = await waitFor(() => Notification.findOne({ vehicleId: v.vehicleId }));
    expect(n.eventType).to.equal('ENGINE_FAULT');
    expect(n.status).to.equal('failed');
    expect(n.failureReason).to.match(/MockSMS/);
  });

  it('auto-detects low battery and high engine temperature from telemetry', async () => {
    sinon.stub(Math, 'random').returns(0.99);
    sinon.stub(console, 'log');
    const { token } = await createUser('fleet_manager');
    const a = await createVehicle();
    const b = await createVehicle();
    await request(app).post('/api/telemetry').set(bearer(token)).send({ vehicleId: a.vehicleId, latitude: 1, longitude: 1, batteryLevel: 10 });
    await request(app).post('/api/telemetry').set(bearer(token)).send({ vehicleId: b.vehicleId, latitude: 1, longitude: 1, engineTemperature: 130 });
    expect((await waitFor(() => Notification.findOne({ vehicleId: a.vehicleId }))).eventType).to.equal('LOW_BATTERY');
    expect((await waitFor(() => Notification.findOne({ vehicleId: b.vehicleId }))).eventType).to.equal('ENGINE_FAULT');
  });

  it('rejects an invalid status and serves notification history by role', async () => {
    const mgr = await createUser('fleet_manager');
    const viewer = await createUser('viewer');
    const v = await createVehicle();
    expect((await request(app).patch(`/api/vehicles/${v.vehicleId}/status`).set(bearer(mgr.token)).send({ operationalStatus: 'flying' })).status).to.equal(400);
    expect((await request(app).patch(`/api/vehicles/${v.vehicleId}/status`).set(bearer(viewer.token)).send({ operationalStatus: 'idle' })).status).to.equal(403);

    await Notification.create({ vehicleId: v.vehicleId, recipient: '+91', message: 'm', eventType: 'LOW_BATTERY' });
    expect((await request(app).get('/api/notifications').set(bearer(mgr.token))).body.count).to.equal(1);
    expect((await request(app).get('/api/notifications').set(bearer(viewer.token))).status).to.equal(403);
    expect((await request(app).get(`/api/notifications/vehicle/${v.vehicleId}`).set(bearer(viewer.token))).body.count).to.equal(1);
  });
});
