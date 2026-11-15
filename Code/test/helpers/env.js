// Loaded before anything else. Configures an isolated test environment.
require('dotenv').config({ quiet: true });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.GATEWAY_API_KEY = 'test-gateway-key'; // never the real key
process.env.GEOCODING_PROVIDER = 'nominatim';
process.env.NOMINATIM_MIN_INTERVAL_MS = '1';      // keep tests fast; no real calls are made
process.env.NOMINATIM_TIMEOUT_MS = '500';
process.env.ADMIN_PHONE = '+910000000000';

// Separate database: MONGODB_TEST_URI, else the main URI with the db name replaced.
const deriveTestUri = (uri) => {
  const m = uri && uri.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)\/([^?]*)(\?.*)?$/);
  if (!m) return null;
  return `${m[1]}/${m[2] || 'fleetdb'}_test${m[3] || ''}`;
};
const testUri = process.env.MONGODB_TEST_URI || deriveTestUri(process.env.MONGODB_URI);
if (!testUri) throw new Error('Set MONGODB_TEST_URI (or MONGODB_URI) to run the tests');

const dbName = (u) => (u.match(/\.[a-z]+(?::\d+)?\/([^?]*)/i) || u.match(/:\d+\/([^?]*)/) || [])[1];
const mainName = process.env.MONGODB_URI && dbName(process.env.MONGODB_URI);
if (!/_test$|test/i.test(dbName(testUri) || '') || dbName(testUri) === mainName) {
  throw new Error('Refusing to run tests: test database name must contain "test" and differ from the main database');
}
process.env.TEST_MONGODB_URI = testUri;
