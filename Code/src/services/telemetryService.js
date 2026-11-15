const Telemetry = require('../models/Telemetry');
const Vehicle = require('../models/Vehicle');
const { notifyCriticalEvent } = require('./notificationService');

const CRITICAL_EVENTS = ['ENGINE_FAULT', 'LOW_BATTERY', 'EMERGENCY_STOP'];
const LOW_BATTERY_THRESHOLD = 20;
const HIGH_TEMP_THRESHOLD = 110;

const submitTelemetry = async (data) => {
  const { vehicleId, latitude, longitude, speed, engineTemperature, batteryLevel } = data;
  let eventType = data.eventType || 'NORMAL';

  // Auto-detect critical events if not explicitly provided
  if (eventType === 'NORMAL') {
    if (typeof engineTemperature === 'number' && engineTemperature > HIGH_TEMP_THRESHOLD) {
      eventType = 'ENGINE_FAULT';
    } else if (typeof batteryLevel === 'number' && batteryLevel < LOW_BATTERY_THRESHOLD) {
      eventType = 'LOW_BATTERY';
    }
  }

  const telemetry = await Telemetry.create({
    vehicleId,
    latitude,
    longitude,
    speed,
    engineTemperature,
    batteryLevel,
    eventType,
  });

  // Update vehicle's last known location and battery
  const vehicleUpdate = {
    'location.latitude': latitude,
    'location.longitude': longitude,
  };
  if (typeof batteryLevel === 'number') vehicleUpdate.batteryLevel = batteryLevel;
  if (speed > 0) vehicleUpdate.operationalStatus = 'active';

  await Vehicle.findOneAndUpdate({ vehicleId }, vehicleUpdate);

  // Fire notification for critical events (non-blocking)
  if (CRITICAL_EVENTS.includes(eventType)) {
    const val = (v, unit) => (v === undefined || v === null ? 'n/a' : `${v}${unit}`);
    const extra = `Speed: ${val(speed, ' km/h')}, Temp: ${val(engineTemperature, 'C')}, Battery: ${val(batteryLevel, '%')}`;
    notifyCriticalEvent(vehicleId, eventType, extra).catch((e) =>
      console.error('Notification error:', e.message)
    );
  }

  return telemetry;
};

const getTelemetryByVehicle = async (vehicleId, limit) => {
  const lim = parseInt(limit) || 50;
  return Telemetry.find({ vehicleId }).sort({ timestamp: -1 }).limit(lim);
};

const getLatestTelemetry = async (vehicleId) => {
  const record = await Telemetry.findOne({ vehicleId }).sort({ timestamp: -1 });
  if (!record) {
    const err = new Error(`No telemetry found for vehicle ${vehicleId}`);
    err.statusCode = 404;
    throw err;
  }
  return record;
};

// Fleet-wide recent events (dashboard). critical=true restricts to critical event types.
const getRecentEvents = async ({ limit, hours, critical } = {}) => {
  const lim = Math.min(parseInt(limit) || 20, 500);
  const filter = {};
  if (String(critical) === 'true') filter.eventType = { $in: CRITICAL_EVENTS };
  const h = parseFloat(hours);
  if (h > 0) filter.timestamp = { $gte: new Date(Date.now() - h * 3600 * 1000) };
  return Telemetry.find(filter).sort({ timestamp: -1 }).limit(lim);
};

module.exports = { submitTelemetry, getTelemetryByVehicle, getLatestTelemetry, getRecentEvents };
