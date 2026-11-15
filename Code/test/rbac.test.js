const { expect } = require('chai');
const request = require('supertest');
const app = require('../src/app');
const Vehicle = require('../src/models/Vehicle');
const { createUser, createVehicle, bearer } = require('./helpers/factories');

describe('TEST 5: role-based access control', () => {
  it('viewer cannot delete a vehicle (403); admin can', async () => {
    const viewer = await createUser('viewer');
    const admin = await createUser('admin');
    const v = await createVehicle();

    const denied = await request(app).delete(`/api/vehicles/${v.vehicleId}`).set(bearer(viewer.token));
    expect(denied.status).to.equal(403);
    expect(denied.body.message).to.match(/viewer/);
    expect(await Vehicle.exists({ vehicleId: v.vehicleId })).to.not.be.null;

    const ok = await request(app).delete(`/api/vehicles/${v.vehicleId}`).set(bearer(admin.token));
    expect(ok.status).to.equal(200);
    expect(await Vehicle.exists({ vehicleId: v.vehicleId })).to.be.null;
  });

  it('fleet_manager cannot delete vehicles either', async () => {
    const mgr = await createUser('fleet_manager');
    const v = await createVehicle();
    expect((await request(app).delete(`/api/vehicles/${v.vehicleId}`).set(bearer(mgr.token))).status).to.equal(403);
  });

  it('only admins can list users', async () => {
    const mgr = await createUser('fleet_manager');
    const admin = await createUser('admin');
    expect((await request(app).get('/api/users').set(bearer(mgr.token))).status).to.equal(403);
    const res = await request(app).get('/api/users').set(bearer(admin.token));
    expect(res.status).to.equal(200);
    expect(res.body.data.every((u) => !('password' in u))).to.be.true;
  });
});
