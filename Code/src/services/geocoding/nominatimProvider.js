const axios = require('axios');
const { geocodingError } = require('./errors');

const ATTRIBUTION = '© OpenStreetMap contributors (https://www.openstreetmap.org/copyright)';

const baseUrl = () =>
  process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org/search';
const userAgent = () =>
  process.env.NOMINATIM_USER_AGENT ||
  'FleetManagementSystem/1.0 (academic assignment; contact: set NOMINATIM_USER_AGENT)';
const timeoutMs = () => parseInt(process.env.NOMINATIM_TIMEOUT_MS, 10) || 8000;
// Public Nominatim: max 1 request/second. 1100ms gives a safety margin.
const minIntervalMs = () => parseInt(process.env.NOMINATIM_MIN_INTERVAL_MS, 10) || 1100;

// ── Serialised request queue: one request at a time, spaced >= minInterval ──
let queueTail = Promise.resolve();
let lastRequestAt = 0;
let blockedUntil = 0; // set after an HTTP 429

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const enqueue = (task) => {
  const run = queueTail.then(async () => {
    const wait = Math.max(lastRequestAt + minIntervalMs() - Date.now(), 0);
    if (wait) await sleep(wait);
    lastRequestAt = Date.now();
    return task();
  });
  queueTail = run.catch(() => {});
  return run;
};

const parseRetryAfter = (header) => {
  const secs = parseInt(header, 10);
  return Number.isFinite(secs) && secs > 0 ? secs : 60;
};

const validCoords = (lat, lon) =>
  Number.isFinite(lat) && Number.isFinite(lon) &&
  lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

const request = async (address) => {
  if (Date.now() < blockedUntil) {
    throw geocodingError(429, 'GEOCODER_RATE_LIMITED',
      'Geocoding provider is rate limiting us. Please retry later.',
      { retryAfter: Math.ceil((blockedUntil - Date.now()) / 1000) });
  }

  let response;
  try {
    response = await axios.get(baseUrl(), {
      params: { q: address, format: 'jsonv2', limit: 1 },
      headers: { 'User-Agent': userAgent(), Accept: 'application/json' },
      timeout: timeoutMs(),
      validateStatus: () => true,
    });
  } catch (e) {
    if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
      throw geocodingError(504, 'GEOCODER_TIMEOUT', 'Geocoding provider timed out.');
    }
    throw geocodingError(502, 'GEOCODER_UNAVAILABLE', 'Geocoding provider is unreachable.');
  }

  if (response.status === 429 || response.status === 403) {
    const retryAfter = parseRetryAfter(response.headers['retry-after']);
    blockedUntil = Date.now() + retryAfter * 1000;
    throw geocodingError(429, 'GEOCODER_RATE_LIMITED',
      'Geocoding provider rate limit hit. Please retry later.', { retryAfter });
  }
  if (response.status !== 200 || !Array.isArray(response.data)) {
    throw geocodingError(502, 'GEOCODER_ERROR',
      `Geocoding provider returned an unexpected response (HTTP ${response.status}).`);
  }
  if (response.data.length === 0) {
    throw geocodingError(404, 'ADDRESS_NOT_FOUND', `No results found for address: "${address}"`);
  }

  const hit = response.data[0];
  const latitude = parseFloat(hit.lat);
  const longitude = parseFloat(hit.lon);
  if (!validCoords(latitude, longitude)) {
    throw geocodingError(502, 'GEOCODER_INVALID_COORDINATES',
      'Geocoding provider returned invalid coordinates.');
  }
  return { latitude, longitude, formattedAddress: hit.display_name || address };
};

const geocode = (address) => enqueue(() => request(address));

module.exports = { name: 'nominatim', geocode, attribution: ATTRIBUTION };
