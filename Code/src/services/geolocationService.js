const Vehicle = require('../models/Vehicle');
const haversineDistance = require('../utils/haversine');
const { geocodeAddress } = require('./geocoding');

const geocodeAndSaveVehicle = async (vehicleId, address) => {
  // Check the vehicle first so an unknown ID never costs a Nominatim request
  if (!(await Vehicle.exists({ vehicleId }))) {
    const err = new Error(`Vehicle '${vehicleId}' not found`);
    err.statusCode = 404;
    throw err;
  }
  const coords = await geocodeAddress(address);
  const vehicle = await Vehicle.findOneAndUpdate(
    { vehicleId },
    {
      address: coords.formattedAddress,
      'location.latitude': coords.latitude,
      'location.longitude': coords.longitude,
    },
    { new: true }
  );
  if (!vehicle) {
    const err = new Error(`Vehicle '${vehicleId}' not found`);
    err.statusCode = 404;
    throw err;
  }
  return { vehicle, coordinates: coords };
};

const getAllLocations = async () => {
  const vehicles = await Vehicle.find({
    'location.latitude': { $ne: null },
    'location.longitude': { $ne: null },
  }).select('vehicleId registrationNumber vehicleType operationalStatus location address');
  return vehicles;
};

const getNearbyVehicles = async (latitude, longitude, radiusKm) => {
  if (latitude === undefined || longitude === undefined || radiusKm === undefined) {
    const err = new Error('latitude, longitude and radius are required');
    err.statusCode = 400;
    throw err;
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const radius = parseFloat(radiusKm);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    const err = new Error('latitude must be a number between -90 and 90');
    err.statusCode = 400;
    throw err;
  }
  if (isNaN(lon) || lon < -180 || lon > 180) {
    const err = new Error('longitude must be a number between -180 and 180');
    err.statusCode = 400;
    throw err;
  }
  if (isNaN(radius) || radius <= 0) {
    const err = new Error('radius must be a positive number');
    err.statusCode = 400;
    throw err;
  }

  const vehicles = await Vehicle.find({
    'location.latitude': { $ne: null },
    'location.longitude': { $ne: null },
  });

  const nearby = vehicles
    .map((v) => {
      const dist = haversineDistance(lat, lon, v.location.latitude, v.location.longitude);
      return { vehicle: v, distance: parseFloat(dist.toFixed(3)) };
    })
    .filter((item) => item.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  return nearby;
};

module.exports = { geocodeAddress, geocodeAndSaveVehicle, getAllLocations, getNearbyVehicles };
