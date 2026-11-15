const express = require('express');
const router = express.Router();
const { submitTelemetry, getTelemetryByVehicle, getLatestTelemetry, getRecentEvents } = require('../services/telemetryService');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.post('/', authorize('admin', 'fleet_manager'), async (req, res, next) => {
  try {
    const { vehicleId, latitude, longitude } = req.body;
    if (!vehicleId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'vehicleId, latitude and longitude are required',
      });
    }
    const telemetry = await submitTelemetry(req.body);
    res.status(201).json({ success: true, data: telemetry });
  } catch (err) {
    next(err);
  }
});

// GET /api/telemetry/recent?limit=20&hours=24&critical=true  (must precede /:vehicleId)
router.get('/recent', async (req, res, next) => {
  try {
    const records = await getRecentEvents(req.query);
    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    next(err);
  }
});

router.get('/:vehicleId', async (req, res, next) => {
  try {
    const records = await getTelemetryByVehicle(req.params.vehicleId, req.query.limit);
    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    next(err);
  }
});

router.get('/:vehicleId/latest', async (req, res, next) => {
  try {
    const record = await getLatestTelemetry(req.params.vehicleId);
    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
