const User = require('../../src/models/User');
const Vehicle = require('../../src/models/Vehicle');
const generateToken = require('../../src/utils/generateToken');

let n = 0;
const uid = () => `${Date.now().toString(36)}${(n++).toString(36)}`;

const createUser = async (role = 'viewer', overrides = {}) => {
  const password = 'Passw0rd!';
  const user = await User.create({
    name: `${role} user`, email: `${role}-${uid()}@test.local`, password, role, ...overrides,
  });
  return { user, password, token: generateToken(user._id) };
};

const vehicleData = (overrides = {}) => {
  const id = uid().toUpperCase();
  return {
    vehicleId: `T${id}`, registrationNumber: `TS${id}`, vehicleType: 'van',
    model: 'Transit', manufacturer: 'Ford', ...overrides,
  };
};
const createVehicle = (overrides) => Vehicle.create(vehicleData(overrides));

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

// Poll until fn() returns a truthy value (for fire-and-forget notifications)
const waitFor = async (fn, ms = 3000) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 25));
  }
};

module.exports = { createUser, createVehicle, vehicleData, bearer, waitFor, uid };
