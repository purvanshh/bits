const mongoose = require('mongoose');

// Root hooks: one connection to the isolated test DB; collections emptied
// before every test so tests are independent and repeatable.
exports.mochaHooks = {
  async beforeAll() {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
    if (!/test/i.test(mongoose.connection.name)) throw new Error('Not a test database');
    await mongoose.connection.dropDatabase();
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  },
  async beforeEach() {
    await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  },
  async afterAll() {
    if (/test/i.test(mongoose.connection.name)) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  },
};
