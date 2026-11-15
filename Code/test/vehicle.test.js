const { expect } = require('chai');
const request = require('supertest');
const app = require('../src/app');
const Vehicle = require('../src/models/Vehicle');
const { createUser, createVehicle, vehicleData, bearer } = require('./helpers/factories');

describe('TEST 2: vehicle registration and retrieval', () => {
  it('registers a vehicle, stores it in the database and retrieves it', async () => {
    const { token } = await createUser('fleet_manager');
    const data = vehicleData({ registrationNumber: 'cg04ab1234', assignedDriver: 'Asha' });

    const created = await request(app).post('/api/vehicles').set(bearer(token)).send(data);
    expect(created.status).to.equal(201);
    expect(created.body.data.vehicleId).to.equal(data.vehicleId);

    const stored = await Vehicle.findOne({ vehicleId: data.vehicleId });
    expect(stored).to.exist;
    expect(stored.registrationNumber).to.equal('CG04AB1234'); // uppercased by the schema
    expect(stored.operationalStatus).to.equal('idle');         // default

    const res = await request(app).get(`/api/vehicles/${data.vehicleId}`).set(bearer(token));
    expect(res.status).to.equal(200);
    expect(res.body.data).to.include({
      vehicleId: data.vehicleId, vehicleType: 'van', model: 'Transit', manufacturer: 'Ford', assignedDriver: 'Asha',
    });
  });

  it('lists vehicles with status filter and registration search', async () => {
    const { token } = await createUser('viewer');
    await createVehicle({ registrationNumber: 'AAA111', operationalStatus: 'active' });
    await createVehicle({ registrationNumber: 'BBB222', operationalStatus: 'idle' });

    const all = await request(app).get('/api/vehicles').set(bearer(token));
    expect(all.body.count).to.equal(2);
    const active = await request(app).get('/api/vehicles?status=active').set(bearer(token));
    expect(active.body.data.map((v) => v.registrationNumber)).to.deep.equal(['AAA111']);
    const search = await request(app).get('/api/vehicles/search?q=bbb').set(bearer(token));
    expect(search.body.data.map((v) => v.registrationNumber)).to.deep.equal(['BBB222']);
  });

  it('returns 404 for an unknown vehicle, 409 for a duplicate and 400 for invalid data', async () => {
    const { token } = await createUser('admin');
    expect((await request(app).get('/api/vehicles/NOPE').set(bearer(token))).status).to.equal(404);
    const data = vehicleData();
    await request(app).post('/api/vehicles').set(bearer(token)).send(data);
    expect((await request(app).post('/api/vehicles').set(bearer(token)).send(data)).status).to.equal(409);
    expect((await request(app).post('/api/vehicles').set(bearer(token)).send({ vehicleId: 'X' })).status).to.equal(400);
  });

  it('forbids viewers from registering vehicles and requires authentication', async () => {
    const { token } = await createUser('viewer');
    expect((await request(app).post('/api/vehicles').set(bearer(token)).send(vehicleData())).status).to.equal(403);
    expect((await request(app).get('/api/vehicles')).status).to.equal(401);
  });
});
