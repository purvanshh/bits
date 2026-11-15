// Single source of truth for service routing. Each service URL is configurable;
// by default all five point at the one backend process (modular monolith).
const DEFAULT = 'http://localhost:5001';
const url = (name) => (process.env[name] || DEFAULT).replace(/\/+$/, '');

const services = [
  { name: 'user',         prefix: '/api/users',         target: url('USER_SERVICE_URL') },
  { name: 'vehicle',      prefix: '/api/vehicles',      target: url('VEHICLE_SERVICE_URL') },
  { name: 'telemetry',    prefix: '/api/telemetry',     target: url('TELEMETRY_SERVICE_URL') },
  { name: 'geolocation',  prefix: '/api/maps',          target: url('GEOLOCATION_SERVICE_URL') },
  { name: 'notification', prefix: '/api/notifications', target: url('NOTIFICATION_SERVICE_URL') },
];

module.exports = services;
