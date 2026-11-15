const express = require('express');
const router = express.Router();
const {
  geocodeAddress,
  geocodeAndSaveVehicle,
  getAllLocations,
  getNearbyVehicles,
} = require('../services/geolocationService');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// GET /api/maps/nearby?latitude=21.19&longitude=81.28&radius=10
router.get('/nearby', async (req, res, next) => {
  try {
    const { latitude, longitude, radius } = req.query;
    const nearby = await getNearbyVehicles(latitude, longitude, radius);
    res.json({ success: true, count: nearby.length, data: nearby });
  } catch (err) {
    next(err);
  }
});

// GET /api/maps/locations
router.get('/locations', async (req, res, next) => {
  try {
    const locations = await getAllLocations();
    res.json({ success: true, count: locations.length, data: locations });
  } catch (err) {
    next(err);
  }
});

// POST /api/maps/geocode  { "address": "Raipur, Chhattisgarh" }
router.post('/geocode', authorize('admin', 'fleet_manager'), async (req, res, next) => {
  try {
    const { address } = req.body || {};
    const coords = await geocodeAddress(address);
    res.json({ success: true, data: coords });
  } catch (err) {
    next(err);
  }
});

// POST /api/maps/geocode/:vehicleId  { "address": "..." }
router.post('/geocode/:vehicleId', authorize('admin', 'fleet_manager'), async (req, res, next) => {
  try {
    const { address } = req.body || {};
    const result = await geocodeAndSaveVehicle(req.params.vehicleId, address);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
