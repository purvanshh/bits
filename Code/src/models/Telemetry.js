const mongoose = require('mongoose');

const telemetrySchema = new mongoose.Schema(
  {
    vehicleId: {
      type: String,
      required: [true, 'Vehicle ID is required'],
      index: true,
    },
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
    },
    speed: {
      type: Number,
      min: 0,
      default: 0,
    },
    engineTemperature: {
      type: Number,
      default: null,
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    eventType: {
      type: String,
      enum: ['NORMAL', 'ENGINE_FAULT', 'LOW_BATTERY', 'EMERGENCY_STOP'],
      default: 'NORMAL',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

telemetrySchema.index({ vehicleId: 1, timestamp: -1 });

module.exports = mongoose.model('Telemetry', telemetrySchema);
