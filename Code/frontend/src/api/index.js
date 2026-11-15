import client from './client';

const data = (p) => p.then((r) => r.data);

export const authApi = {
  login: (email, password) => data(client.post('/api/users/login', { email, password })),
  me: () => data(client.get('/api/users/me')),
};
export const usersApi = {
  list: () => data(client.get('/api/users')),
  create: (u) => data(client.post('/api/users/register', u)),
};
export const vehiclesApi = {
  list: (params) => data(client.get('/api/vehicles', { params })),
  get: (id) => data(client.get(`/api/vehicles/${encodeURIComponent(id)}`)),
  search: (q) => data(client.get('/api/vehicles/search', { params: { q } })),
  create: (v) => data(client.post('/api/vehicles', v)),
  update: (id, v) => data(client.put(`/api/vehicles/${encodeURIComponent(id)}`, v)),
  setStatus: (id, operationalStatus) => data(client.patch(`/api/vehicles/${encodeURIComponent(id)}/status`, { operationalStatus })),
  remove: (id) => data(client.delete(`/api/vehicles/${encodeURIComponent(id)}`)),
};
export const telemetryApi = {
  submit: (t) => data(client.post('/api/telemetry', t)),
  history: (id, limit = 50) => data(client.get(`/api/telemetry/${encodeURIComponent(id)}`, { params: { limit } })),
  latest: (id) => data(client.get(`/api/telemetry/${encodeURIComponent(id)}/latest`)),
  recent: (params) => data(client.get('/api/telemetry/recent', { params })),
};
export const mapsApi = {
  locations: () => data(client.get('/api/maps/locations')),
  nearby: (latitude, longitude, radius) => data(client.get('/api/maps/nearby', { params: { latitude, longitude, radius } })),
  geocode: (address) => data(client.post('/api/maps/geocode', { address })),
  geocodeVehicle: (id, address) => data(client.post(`/api/maps/geocode/${encodeURIComponent(id)}`, { address })),
};
export const notificationsApi = {
  list: () => data(client.get('/api/notifications')),
  forVehicle: (id) => data(client.get(`/api/notifications/vehicle/${encodeURIComponent(id)}`)),
};
