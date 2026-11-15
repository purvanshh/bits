const express = require('express');
const router = express.Router();
const {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  updateVehicle,
  updateVehicleStatus,
  deleteVehicle,
  searchByRegistration,
} = require('../services/vehicleService');
const { notifyCriticalEvent } = require('../services/notificationService');
const { authenticate, authorize } = require('../middleware/auth');

// All vehicle routes require authentication
router.use(authenticate);

router.post('/', authorize('admin', 'fleet_manager'), async (req, res, next) => {
  try {
    const vehicle = await createVehicle(req.body);
    res.status(201).json({ success: true, data: vehicle });
  } catch (err) {
    next(err);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const vehicles = await searchByRegistration(req.query.q);
    res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const vehicles = await getAllVehicles(req.query);
    res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (err) {
    next(err);
  }
});

router.get('/:vehicleId', async (req, res, next) => {
  try {
    const vehicle = await getVehicleById(req.params.vehicleId);
    res.json({ success: true, data: vehicle });
  } catch (err) {
    next(err);
  }
});

router.put('/:vehicleId', authorize('admin', 'fleet_manager'), async (req, res, next) => {
  try {
    const vehicle = await updateVehicle(req.params.vehicleId, req.body);
    res.json({ success: true, data: vehicle });
  } catch (err) {
    next(err);
  }
});

router.patch('/:vehicleId/status', authorize('admin', 'fleet_manager'), async (req, res, next) => {
  try {
    const { operationalStatus } = req.body;
    if (!operationalStatus) {
      return res.status(400).json({ success: false, message: 'operationalStatus is required' });
    }
    const vehicle = await updateVehicleStatus(req.params.vehicleId, operationalStatus);
    // Notify on status change
    notifyCriticalEvent(
      req.params.vehicleId,
      'STATUS_CHANGE',
      `New status: ${operationalStatus}`
    ).catch(() => {});
    res.json({ success: true, data: vehicle });
  } catch (err) {
    next(err);
  }
});

router.delete('/:vehicleId', authorize('admin'), async (req, res, next) => {
  try {
    await deleteVehicle(req.params.vehicleId);
    res.json({ success: true, message: 'Vehicle deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
