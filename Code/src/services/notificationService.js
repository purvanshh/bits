const Notification = require('../models/Notification');

// MockSMS provider — simulates ~15% failure rate for realism
const mockSMSSend = async ({ to, message }) => {
  const shouldFail = Math.random() < 0.15;
  if (shouldFail) {
    throw new Error('MockSMS: network timeout (simulated failure)');
  }
  console.log(`[MockSMS] TO: ${to} | MSG: ${message}`);
  return { sid: `MOCK_${Date.now()}`, status: 'sent' };
};

const sendNotification = async ({ vehicleId, recipient, message, eventType }) => {
  let status = 'sent';
  let failureReason = null;

  try {
    await mockSMSSend({ to: recipient, message });
  } catch (err) {
    status = 'failed';
    failureReason = err.message;
  }

  const notification = await Notification.create({
    vehicleId,
    recipient,
    message,
    eventType,
    provider: 'MockSMS',
    status,
    failureReason,
  });

  return notification;
};

const notifyCriticalEvent = async (vehicleId, eventType, extraInfo) => {
  const info = extraInfo || '';
  const recipient = process.env.ADMIN_PHONE || '+919999999999';
  const messages = {
    ENGINE_FAULT: `ALERT: Engine fault on vehicle ${vehicleId}. ${info}`,
    LOW_BATTERY: `ALERT: Low battery on vehicle ${vehicleId}. ${info}`,
    EMERGENCY_STOP: `ALERT: Emergency stop on vehicle ${vehicleId}. ${info}`,
    STATUS_CHANGE: `INFO: Vehicle ${vehicleId} status changed. ${info}`,
  };

  const message = messages[eventType] || `Event ${eventType} on vehicle ${vehicleId}. ${info}`;
  return sendNotification({ vehicleId, recipient, message, eventType });
};

const getAll = async () => {
  return Notification.find().sort({ timestamp: -1 });
};

const getByVehicleId = async (vehicleId) => {
  return Notification.find({ vehicleId }).sort({ timestamp: -1 });
};

module.exports = { sendNotification, notifyCriticalEvent, getAll, getByVehicleId };
