const Vehicle = require('../models/Vehicle');

const createVehicle = async (data) => {
  const vehicle = await Vehicle.create(data);
  return vehicle;
};

const getAllVehicles = async (query = {}) => {
  const filter = {};
  if (query.status) filter.operationalStatus = query.status;
  if (query.type) filter.vehicleType = query.type;
  return Vehicle.find(filter).sort({ createdAt: -1 });
};

const getVehicleById = async (vehicleId) => {
  const vehicle = await Vehicle.findOne({ vehicleId });
  if (!vehicle) {
    const err = new Error(`Vehicle with ID '${vehicleId}' not found`);
    err.statusCode = 404;
    throw err;
  }
  return vehicle;
};

const updateVehicle = async (vehicleId, updates) => {
  const vehicle = await Vehicle.findOneAndUpdate(
    { vehicleId },
    { ...updates },
    { new: true, runValidators: true }
  );
  if (!vehicle) {
    const err = new Error(`Vehicle with ID '${vehicleId}' not found`);
    err.statusCode = 404;
    throw err;
  }
  return vehicle;
};

const updateVehicleStatus = async (vehicleId, operationalStatus) => {
  const allowed = ['active', 'idle', 'maintenance', 'inactive'];
  if (!allowed.includes(operationalStatus)) {
    const err = new Error(`Invalid status. Must be one of: ${allowed.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
  return updateVehicle(vehicleId, { operationalStatus });
};

const deleteVehicle = async (vehicleId) => {
  const vehicle = await Vehicle.findOneAndDelete({ vehicleId });
  if (!vehicle) {
    const err = new Error(`Vehicle with ID '${vehicleId}' not found`);
    err.statusCode = 404;
    throw err;
  }
  return vehicle;
};

const searchByRegistration = async (query) => {
  if (!query) {
    const err = new Error('Search query is required');
    err.statusCode = 400;
    throw err;
  }
  return Vehicle.find({
    registrationNumber: { $regex: query.toUpperCase(), $options: 'i' },
  });
};

module.exports = {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  updateVehicle,
  updateVehicleStatus,
  deleteVehicle,
  searchByRegistration,
};
