const express = require('express');
const router = express.Router();
const { getAll, getByVehicleId, sendNotification } = require('../services/notificationService');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', authorize('admin', 'fleet_manager'), async (req, res, next) => {
  try {
    const notifications = await getAll();
    res.json({ success: true, count: notifications.length, data: notifications });
  } catch (err) {
    next(err);
  }
});

router.get('/vehicle/:vehicleId', async (req, res, next) => {
  try {
    const notifications = await getByVehicleId(req.params.vehicleId);
    res.json({ success: true, count: notifications.length, data: notifications });
  } catch (err) {
    next(err);
  }
});

// Manually trigger a test notification
router.post('/test', authorize('admin'), async (req, res, next) => {
  try {
    const { vehicleId, recipient, message, eventType } = req.body;
    if (!vehicleId || !recipient || !message || !eventType) {
      return res.status(400).json({ success: false, message: 'vehicleId, recipient, message and eventType are required' });
    }
    const notification = await sendNotification({ vehicleId, recipient, message, eventType });
    res.status(201).json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
