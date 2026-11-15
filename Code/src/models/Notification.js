const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: String,
      required: [true, 'Vehicle ID is required'],
      index: true,
    },
    recipient: {
      type: String,
      required: [true, 'Recipient is required'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
    },
    eventType: {
      type: String,
      enum: ['ENGINE_FAULT', 'LOW_BATTERY', 'EMERGENCY_STOP', 'STATUS_CHANGE'],
      required: true,
    },
    provider: {
      type: String,
      default: 'MockSMS',
    },
    status: {
      type: String,
      enum: ['sent', 'failed'],
      default: 'sent',
    },
    failureReason: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

notificationSchema.index({ vehicleId: 1, timestamp: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
