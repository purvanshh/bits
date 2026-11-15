const GeocodeCache = require('../../models/GeocodeCache');
const { geocodingError } = require('./errors');

const providers = {
  nominatim: () => require('./nominatimProvider'),
};

const getProvider = () => {
  const name = (process.env.GEOCODING_PROVIDER || 'nominatim').toLowerCase();
  if (!providers[name]) {
    throw geocodingError(500, 'GEOCODER_NOT_CONFIGURED',
      `Unknown GEOCODING_PROVIDER '${name}'. Supported: ${Object.keys(providers).join(', ')}`);
  }
  return providers[name]();
};

const normalise = (address) => address.trim().toLowerCase().replace(/\s+/g, ' ');

const memoryCache = new Map(); // key -> result
const inFlight = new Map();    // key -> Promise (dedupe concurrent identical lookups)

const shape = (provider, r, cached) => ({
  latitude: r.latitude,
  longitude: r.longitude,
  formattedAddress: r.formattedAddress,
  provider: provider.name,
  cached,
  attribution: provider.attribution,
});

const geocodeAddress = async (address) => {
  if (typeof address !== 'string' || !address.trim()) {
    throw geocodingError(400, 'ADDRESS_REQUIRED', 'Address is required for geocoding');
  }
  if (address.length > 300) {
    throw geocodingError(400, 'ADDRESS_TOO_LONG', 'Address must be 300 characters or fewer');
  }

  const provider = getProvider();
  const key = `${provider.name}:${normalise(address)}`;

  if (memoryCache.has(key)) return shape(provider, memoryCache.get(key), true);

  const stored = await GeocodeCache.findOne({ key }).lean().catch(() => null);
  if (stored) {
    memoryCache.set(key, stored);
    return shape(provider, stored, true);
  }

  if (!inFlight.has(key)) {
    const p = provider.geocode(address.trim())
      .then(async (result) => {
        memoryCache.set(key, result);
        await GeocodeCache.updateOne(
          { key },
          { $set: { key, provider: provider.name, ...result, createdAt: new Date() } },
          { upsert: true }
        ).catch((e) => console.error('Geocode cache write failed:', e.message));
        return result;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, p);
  }
  return shape(provider, await inFlight.get(key), false);
};

module.exports = { geocodeAddress };
