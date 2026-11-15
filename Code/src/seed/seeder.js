require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Telemetry = require('../models/Telemetry');
const Notification = require('../models/Notification');

// Raipur, Chhattisgarh area coordinates (21.25°N, 81.63°E)
const vehicles = [
  { vehicleId: 'VH001', registrationNumber: 'CG04KA1001', vehicleType: 'truck',   model: 'Actros',    manufacturer: 'Mercedes', assignedDriver: 'Ramesh Kumar',   operationalStatus: 'active',      address: 'Raipur, Chhattisgarh',         location: { latitude: 21.2514, longitude: 81.6296 }, batteryLevel: 85 },
  { vehicleId: 'VH002', registrationNumber: 'CG04KB2002', vehicleType: 'van',     model: 'Transit',   manufacturer: 'Ford',     assignedDriver: 'Suresh Patel',   operationalStatus: 'idle',        address: 'Bhilai, Chhattisgarh',         location: { latitude: 21.2093, longitude: 81.3785 }, batteryLevel: 72 },
  { vehicleId: 'VH003', registrationNumber: 'CG04KC3003', vehicleType: 'car',     model: 'Innova',    manufacturer: 'Toyota',   assignedDriver: 'Priya Singh',    operationalStatus: 'active',      address: 'Durg, Chhattisgarh',           location: { latitude: 21.1902, longitude: 81.2849 }, batteryLevel: 60 },
  { vehicleId: 'VH004', registrationNumber: 'CG04KD4004', vehicleType: 'bus',     model: 'Traveller', manufacturer: 'Force',    assignedDriver: 'Amit Sharma',    operationalStatus: 'maintenance', address: 'Bilaspur, Chhattisgarh',       location: { latitude: 22.0797, longitude: 82.1409 }, batteryLevel: 45 },
  { vehicleId: 'VH005', registrationNumber: 'CG04KE5005', vehicleType: 'truck',   model: 'FMX',       manufacturer: 'Volvo',    assignedDriver: 'Deepak Verma',   operationalStatus: 'active',      address: 'Korba, Chhattisgarh',          location: { latitude: 22.3595, longitude: 82.7501 }, batteryLevel: 90 },
  { vehicleId: 'VH006', registrationNumber: 'CG04KF6006', vehicleType: 'van',     model: 'Hiace',     manufacturer: 'Toyota',   assignedDriver: 'Kavita Rao',     operationalStatus: 'idle',        address: 'Jagdalpur, Chhattisgarh',      location: { latitude: 19.0748, longitude: 82.0188 }, batteryLevel: 30 },
  { vehicleId: 'VH007', registrationNumber: 'CG04KG7007', vehicleType: 'car',     model: 'Swift',     manufacturer: 'Suzuki',   assignedDriver: 'Mohan Das',      operationalStatus: 'inactive',    address: 'Ambikapur, Chhattisgarh',      location: { latitude: 23.1189, longitude: 83.1963 }, batteryLevel: 15 },
  { vehicleId: 'VH008', registrationNumber: 'CG04KH8008', vehicleType: 'truck',   model: 'T-Series',  manufacturer: 'Tata',     assignedDriver: 'Geeta Nair',     operationalStatus: 'active',      address: 'Rajnandgaon, Chhattisgarh',    location: { latitude: 21.0970, longitude: 81.0298 }, batteryLevel: 78 },
  { vehicleId: 'VH009', registrationNumber: 'CG04KI9009', vehicleType: 'motorcycle', model: 'Splendor', manufacturer: 'Hero',  assignedDriver: 'Vikas Gupta',    operationalStatus: 'active',      address: 'Raigarh, Chhattisgarh',        location: { latitude: 21.8974, longitude: 83.3950 }, batteryLevel: 95 },
  { vehicleId: 'VH010', registrationNumber: 'CG04KJ0010', vehicleType: 'van',     model: 'Eco',       manufacturer: 'Maruti',   assignedDriver: 'Nisha Tiwari',   operationalStatus: 'idle',        address: 'Dhamtari, Chhattisgarh',       location: { latitude: 20.7085, longitude: 81.5490 }, batteryLevel: 55 },
  { vehicleId: 'VH011', registrationNumber: 'CG04KK1011', vehicleType: 'car',     model: 'Creta',     manufacturer: 'Hyundai',  assignedDriver: 'Rohit Mishra',   operationalStatus: 'maintenance', address: 'Kawardha, Chhattisgarh',       location: { latitude: 22.0098, longitude: 81.2290 }, batteryLevel: 40 },
  { vehicleId: 'VH012', registrationNumber: 'CG04KL2012', vehicleType: 'bus',     model: 'Starbus',   manufacturer: 'Tata',     assignedDriver: 'Anjali Dubey',   operationalStatus: 'active',      address: 'Mahasamund, Chhattisgarh',     location: { latitude: 21.1083, longitude: 82.0960 }, batteryLevel: 68 },
];

const telemetrySeed = [
  { vehicleId: 'VH001', latitude: 21.2514, longitude: 81.6296, speed: 65,  engineTemperature: 85,  batteryLevel: 85, eventType: 'NORMAL' },
  { vehicleId: 'VH002', latitude: 21.2093, longitude: 81.3785, speed: 0,   engineTemperature: 70,  batteryLevel: 72, eventType: 'NORMAL' },
  { vehicleId: 'VH003', latitude: 21.1902, longitude: 81.2849, speed: 45,  engineTemperature: 90,  batteryLevel: 60, eventType: 'NORMAL' },
  { vehicleId: 'VH004', latitude: 22.0797, longitude: 82.1409, speed: 0,   engineTemperature: 115, batteryLevel: 45, eventType: 'ENGINE_FAULT' },
  { vehicleId: 'VH005', latitude: 22.3595, longitude: 82.7501, speed: 80,  engineTemperature: 88,  batteryLevel: 90, eventType: 'NORMAL' },
  { vehicleId: 'VH006', latitude: 19.0748, longitude: 82.0188, speed: 0,   engineTemperature: 65,  batteryLevel: 18, eventType: 'LOW_BATTERY' },
  { vehicleId: 'VH007', latitude: 23.1189, longitude: 83.1963, speed: 0,   engineTemperature: 60,  batteryLevel: 15, eventType: 'LOW_BATTERY' },
  { vehicleId: 'VH008', latitude: 21.0970, longitude: 81.0298, speed: 55,  engineTemperature: 82,  batteryLevel: 78, eventType: 'NORMAL' },
  { vehicleId: 'VH009', latitude: 21.8974, longitude: 83.3950, speed: 40,  engineTemperature: 70,  batteryLevel: 95, eventType: 'NORMAL' },
  { vehicleId: 'VH010', latitude: 20.7085, longitude: 81.5490, speed: 0,   engineTemperature: 68,  batteryLevel: 55, eventType: 'NORMAL' },
  { vehicleId: 'VH001', latitude: 21.2550, longitude: 81.6350, speed: 70,  engineTemperature: 120, batteryLevel: 83, eventType: 'ENGINE_FAULT' },
  { vehicleId: 'VH003', latitude: 21.1850, longitude: 81.2900, speed: 0,   engineTemperature: 72,  batteryLevel: 12, eventType: 'EMERGENCY_STOP' },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Vehicle.deleteMany({}),
      Telemetry.deleteMany({}),
      Notification.deleteMany({}),
    ]);
    console.log('Cleared existing data');

    // Create users (passwords hashed via pre-save hook)
    const users = await User.create([
      { name: 'Admin User',        email: 'admin@fleet.com',   password: 'admin123',   phone: '+919999999999', role: 'admin' },
      { name: 'Fleet Manager',     email: 'manager@fleet.com', password: 'manager123', phone: '+919988776655', role: 'fleet_manager' },
      { name: 'Viewer User',       email: 'viewer@fleet.com',  password: 'viewer123',  phone: '+919876543210', role: 'viewer' },
    ]);
    console.log(`Created ${users.length} users`);

    // Create vehicles
    const createdVehicles = await Vehicle.create(vehicles);
    console.log(`Created ${createdVehicles.length} vehicles`);

    // Create telemetry records
    const telemetryRecords = await Telemetry.insertMany(
      telemetrySeed.map((t) => ({ ...t, timestamp: new Date() }))
    );
    console.log(`Created ${telemetryRecords.length} telemetry records`);

    // Seed a few sample notifications
    const adminPhone = process.env.ADMIN_PHONE || '+919999999999';
    await Notification.insertMany([
      { vehicleId: 'VH004', recipient: adminPhone, message: 'ALERT: Engine fault on vehicle VH004.', eventType: 'ENGINE_FAULT', provider: 'MockSMS', status: 'sent' },
      { vehicleId: 'VH006', recipient: adminPhone, message: 'ALERT: Low battery on vehicle VH006. Battery: 18%', eventType: 'LOW_BATTERY', provider: 'MockSMS', status: 'sent' },
      { vehicleId: 'VH003', recipient: adminPhone, message: 'ALERT: Emergency stop on vehicle VH003.', eventType: 'EMERGENCY_STOP', provider: 'MockSMS', status: 'failed', failureReason: 'MockSMS: network timeout (simulated failure)' },
    ]);
    console.log('Created sample notifications');

    console.log('\n=== Seed complete ===');
    console.log('Login credentials:');
    console.log('  Admin:         admin@fleet.com   / admin123');
    console.log('  Fleet Manager: manager@fleet.com / manager123');
    console.log('  Viewer:        viewer@fleet.com  / viewer123');

    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  }
};

seed();
