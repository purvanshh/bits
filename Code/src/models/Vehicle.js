const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: String,
      required: [true, 'Vehicle ID is required'],
      unique: true,
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    vehicleType: {
      type: String,
      required: [true, 'Vehicle type is required'],
      enum: ['truck', 'van', 'car', 'motorcycle', 'bus', 'other'],
    },
    model: {
      type: String,
      required: [true, 'Model is required'],
      trim: true,
    },
    manufacturer: {
      type: String,
      required: [true, 'Manufacturer is required'],
      trim: true,
    },
    assignedDriver: {
      type: String,
      trim: true,
      default: null,
    },
    operationalStatus: {
      type: String,
      enum: ['active', 'idle', 'maintenance', 'inactive'],
      default: 'idle',
    },
    address: {
      type: String,
      trim: true,
    },
    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
  },
  { timestamps: true }
);

vehicleSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
vehicleSchema.index({ operationalStatus: 1 });

module.exports = mongoose.model('Vehicle', vehicleSchema);
