const mongoose = require('mongoose');

// Persistent cache of successful geocoding lookups (Nominatim usage policy:
// cache results and never repeat a request for the same address).
const geocodeCacheSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    provider: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    formattedAddress: { type: String },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }, // 30 days
  },
  { timestamps: false }
);

module.exports = mongoose.model('GeocodeCache', geocodeCacheSchema);
