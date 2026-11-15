const { expect } = require('chai');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { createUser, bearer } = require('./helpers/factories');

describe('TEST 1: user login and JWT', () => {
  it('logs in with valid credentials and returns a signed JWT', async () => {
    const { user, password } = await createUser('admin');
    const res = await request(app).post('/api/users/login').send({ email: user.email, password });
    expect(res.status).to.equal(200);
    expect(res.body.success).to.be.true;
    expect(res.body.data.user.email).to.equal(user.email);
    expect(res.body.data.user).to.not.have.property('password');
    const decoded = jwt.verify(res.body.data.token, process.env.JWT_SECRET);
    expect(decoded.id).to.equal(String(user._id));
    expect(decoded).to.have.property('exp');
  });

  it('rejects a wrong password with 401', async () => {
    const { user } = await createUser();
    const res = await request(app).post('/api/users/login').send({ email: user.email, password: 'nope-nope' });
    expect(res.status).to.equal(401);
    expect(res.body.success).to.be.false;
  });

  it('rejects an unknown email with 401 and missing fields with 400', async () => {
    expect((await request(app).post('/api/users/login').send({ email: 'x@y.z', password: 'abcdef' })).status).to.equal(401);
    expect((await request(app).post('/api/users/login').send({})).status).to.equal(400);
  });

  it('accepts a valid token on a protected route', async () => {
    const { user, token } = await createUser('viewer');
    const res = await request(app).get('/api/users/me').set(bearer(token));
    expect(res.status).to.equal(200);
    expect(res.body.data.email).to.equal(user.email);
  });

  it('rejects missing, malformed, wrongly-signed and expired tokens with 401', async () => {
    const { user } = await createUser();
    const wrongSig = jwt.sign({ id: user._id }, 'another-secret');
    const expired = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: -10 });
    for (const header of [undefined, 'Bearer not.a.jwt', `Bearer ${wrongSig}`, `Bearer ${expired}`]) {
      const req = request(app).get('/api/users/me');
      if (header) req.set('Authorization', header);
      expect((await req).status, String(header)).to.equal(401);
    }
  });
});
