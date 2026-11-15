const swaggerJsdoc = require('swagger-jsdoc');

const GATEWAY_PORT = process.env.GATEWAY_PORT || 4000;

// ── Reusable building blocks ─────────────────────────────────────────────────
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const resp = (name) => ({ $ref: `#/components/responses/${name}` });
const json = (schema, example) => ({ content: { 'application/json': { schema, ...(example && { example }) } } });
const ok = (description, schema, example) => ({ description, ...json(schema, example) });
const envelope = (data, extra = {}) => ({
  type: 'object',
  properties: { success: { type: 'boolean', example: true }, ...extra, data },
});
const pathParam = (name, description, example) => ({
  name, in: 'path', required: true, description, schema: { type: 'string', example },
});
const query = (name, description, schema, required = false) => ({ name, in: 'query', required, description, schema });
const body = (schema, example) => ({ required: true, ...json(schema, example) });

const SEC = {
  apiKey: [{ ApiKeyAuth: [] }],
  apiKeyJwt: [{ ApiKeyAuth: [], BearerAuth: [] }],
};
const roles = (text) => `**Required role:** ${text}.`;
const AUTH_NOTE =
  'Gateway authentication: `x-api-key`. Backend authorization: `Authorization: Bearer <JWT>` + role check.';

const vehicleExample = {
  _id: '66f1a2b3c4d5e6f708192a3b', vehicleId: 'VH001', registrationNumber: 'CG04KA1001', vehicleType: 'truck',
  model: 'Actros', manufacturer: 'Mercedes', assignedDriver: 'Ramesh Kumar', operationalStatus: 'active',
  address: 'Raipur, Chhattisgarh', location: { latitude: 21.2514, longitude: 81.6296 }, batteryLevel: 85,
  createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-10T08:30:00.000Z',
};
const userExample = {
  _id: '66f1a2b3c4d5e6f708192a01', name: 'Admin User', email: 'admin@fleet.com', phone: '+919999999999',
  role: 'admin', createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z',
};
const telemetryExample = {
  _id: '66f1a2b3c4d5e6f708192a50', vehicleId: 'VH001', latitude: 21.2514, longitude: 81.6296, speed: 65,
  engineTemperature: 85, batteryLevel: 80, eventType: 'NORMAL', timestamp: '2026-11-10T09:00:00.000Z',
};
const notificationExample = {
  _id: '66f1a2b3c4d5e6f708192a60', vehicleId: 'VH004', recipient: '+919999999999',
  message: 'ALERT: Engine fault on vehicle VH004.', eventType: 'ENGINE_FAULT', provider: 'MockSMS',
  status: 'sent', failureReason: null, timestamp: '2026-11-10T09:05:00.000Z',
};

const std = (...names) => Object.fromEntries(names.map(([code, name]) => [code, resp(name)]));
const E_KEY = ['401', 'Unauthorized'];
const E_FORBIDDEN = ['403', 'Forbidden'];
const E_RATE = ['429', 'RateLimited'];
const E_BAD = ['400', 'BadRequest'];
const E_404 = ['404', 'NotFound'];
const E_DOWN = ['503', 'ServiceUnavailable'];
const E_TIMEOUT = ['504', 'GatewayTimeout'];

// ── Paths ────────────────────────────────────────────────────────────────────
const paths = {
  '/health': {
    get: {
      tags: ['Health'], summary: 'Gateway and backend service health',
      description: 'Public. Not rate limited and requires no API key or JWT. Returns status only — never URLs, keys or secrets. 503 when any backend is unreachable.',
      security: [],
      responses: {
        200: ok('All services healthy', ref('HealthResponse'), {
          status: 'ok', gateway: 'online', timestamp: '2026-11-10T09:00:00.000Z',
          services: { user: { route: '/api/users', status: 'ok', latencyMs: 12 } },
        }),
        503: ok('One or more services degraded or unavailable', ref('HealthResponse')),
      },
    },
  },

  // ── User service ───────────────────────────────────────────────────────────
  '/api/users/register': {
    post: {
      tags: ['Users'], summary: 'Register a user',
      description: `Creates a user and returns a JWT. Needs the API key only (no JWT). ${AUTH_NOTE}`,
      security: SEC.apiKey,
      requestBody: body(ref('UserRegistration'), { name: 'New Viewer', email: 'viewer2@fleet.com', password: 'secret123', phone: '+919811111111', role: 'viewer' }),
      responses: {
        201: ok('User created', ref('AuthenticationResponse'), { success: true, data: { user: userExample, token: '<JWT>' } }),
        ...std(E_BAD, E_KEY, ['409', 'Conflict'], E_RATE, E_DOWN, E_TIMEOUT),
      },
    },
  },
  '/api/users/login': {
    post: {
      tags: ['Users'], summary: 'Log in and obtain a JWT',
      description: `Requires the API key but **not** a JWT. Stricter rate limit applies (brute-force protection). ${AUTH_NOTE}`,
      security: SEC.apiKey,
      requestBody: body(ref('UserLogin'), { email: 'admin@fleet.com', password: 'admin123' }),
      responses: {
        200: ok('Login successful', ref('AuthenticationResponse'), { success: true, data: { user: userExample, token: '<JWT>' } }),
        ...std(E_BAD, E_KEY, E_RATE, E_DOWN, E_TIMEOUT),
      },
    },
  },
  '/api/users/me': {
    get: {
      tags: ['Users'], summary: 'Current user profile', description: 'Any authenticated role.',
      security: SEC.apiKeyJwt,
      responses: { 200: ok('Profile', envelope(ref('User')), { success: true, data: userExample }), ...std(E_KEY, E_RATE, E_DOWN) },
    },
  },
  '/api/users': {
    get: {
      tags: ['Users'], summary: 'List all users', description: roles('admin'),
      security: SEC.apiKeyJwt,
      responses: { 200: ok('Users', envelope({ type: 'array', items: ref('User') }, { count: { type: 'integer' } })), ...std(E_KEY, E_FORBIDDEN, E_RATE, E_DOWN) },
    },
  },
  '/api/users/{id}': {
    parameters: [pathParam('id', 'MongoDB user `_id`', '66f1a2b3c4d5e6f708192a01')],
    get: {
      tags: ['Users'], summary: 'Get user by ID', description: roles('admin'), security: SEC.apiKeyJwt,
      responses: { 200: ok('User', envelope(ref('User'))), ...std(E_KEY, E_FORBIDDEN, E_404, E_RATE, E_DOWN) },
    },
    put: {
      tags: ['Users'], summary: 'Update a user', description: roles('admin'), security: SEC.apiKeyJwt,
      requestBody: body({ type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, role: { type: 'string', enum: ['admin', 'fleet_manager', 'viewer'] } } }, { role: 'fleet_manager' }),
      responses: { 200: ok('Updated user', envelope(ref('User'))), ...std(E_BAD, E_KEY, E_FORBIDDEN, E_404, E_RATE, E_DOWN) },
    },
    delete: {
      tags: ['Users'], summary: 'Delete a user', description: roles('admin'), security: SEC.apiKeyJwt,
      responses: { 200: ok('Deleted', ref('MessageResponse'), { success: true, message: 'User deleted' }), ...std(E_KEY, E_FORBIDDEN, E_404, E_RATE, E_DOWN) },
    },
  },

  // ── Vehicle service ────────────────────────────────────────────────────────
  '/api/vehicles': {
    post: {
      tags: ['Vehicles'], summary: 'Register a vehicle', description: roles('admin, fleet_manager'), security: SEC.apiKeyJwt,
      requestBody: body(ref('VehicleRegistration'), { vehicleId: 'VH100', registrationNumber: 'CG04ZZ1234', vehicleType: 'van', model: 'Transit', manufacturer: 'Ford', assignedDriver: 'Test Driver' }),
      responses: {
        201: ok('Vehicle created', envelope(ref('Vehicle')), { success: true, data: vehicleExample }),
        ...std(E_BAD, E_KEY, E_FORBIDDEN, ['409', 'Conflict'], E_RATE, E_DOWN),
      },
    },
    get: {
      tags: ['Vehicles'], summary: 'List vehicles', description: 'Any authenticated role. Newest first.', security: SEC.apiKeyJwt,
      parameters: [
        query('status', 'Filter by operational status', { type: 'string', enum: ['active', 'idle', 'maintenance', 'inactive'] }),
        query('type', 'Filter by vehicle type', { type: 'string', enum: ['truck', 'van', 'car', 'motorcycle', 'bus', 'other'] }),
      ],
      responses: {
        200: ok('Vehicles', envelope({ type: 'array', items: ref('Vehicle') }, { count: { type: 'integer', example: 1 } }), { success: true, count: 1, data: [vehicleExample] }),
        ...std(E_KEY, E_RATE, E_DOWN, E_TIMEOUT),
      },
    },
  },
  '/api/vehicles/search': {
    get: {
      tags: ['Vehicles'], summary: 'Search by registration number', description: 'Case-insensitive partial match. Any authenticated role.', security: SEC.apiKeyJwt,
      parameters: [query('q', 'Registration number fragment', { type: 'string', example: 'CG04KA' }, true)],
      responses: { 200: ok('Matches', envelope({ type: 'array', items: ref('Vehicle') }, { count: { type: 'integer' } })), ...std(E_BAD, E_KEY, E_RATE, E_DOWN) },
    },
  },
  '/api/vehicles/{vehicleId}': {
    parameters: [pathParam('vehicleId', 'Business vehicle ID (not the Mongo `_id`)', 'VH001')],
    get: {
      tags: ['Vehicles'], summary: 'Get vehicle by ID', description: 'Any authenticated role.', security: SEC.apiKeyJwt,
      responses: { 200: ok('Vehicle', envelope(ref('Vehicle')), { success: true, data: vehicleExample }), ...std(E_KEY, E_404, E_RATE, E_DOWN) },
    },
    put: {
      tags: ['Vehicles'], summary: 'Update a vehicle', description: roles('admin, fleet_manager'), security: SEC.apiKeyJwt,
      requestBody: body({ type: 'object', description: 'Any subset of vehicle fields', properties: { assignedDriver: { type: 'string' }, model: { type: 'string' }, manufacturer: { type: 'string' }, vehicleType: { type: 'string' } } }, { assignedDriver: 'New Driver' }),
      responses: { 200: ok('Updated vehicle', envelope(ref('Vehicle'))), ...std(E_BAD, E_KEY, E_FORBIDDEN, E_404, E_RATE, E_DOWN) },
    },
    delete: {
      tags: ['Vehicles'], summary: 'Delete a vehicle',
      description: `${roles('admin only')} A fleet_manager or viewer JWT yields 403.`, security: SEC.apiKeyJwt,
      responses: { 200: ok('Deleted', ref('MessageResponse'), { success: true, message: 'Vehicle deleted' }), ...std(E_KEY, E_FORBIDDEN, E_404, E_RATE, E_DOWN) },
    },
  },
  '/api/vehicles/{vehicleId}/status': {
    patch: {
      tags: ['Vehicles'], summary: 'Update operational status',
      description: `${roles('admin, fleet_manager')} Also triggers a STATUS_CHANGE MockSMS notification.`, security: SEC.apiKeyJwt,
      parameters: [pathParam('vehicleId', 'Business vehicle ID', 'VH001')],
      requestBody: body(ref('VehicleStatusUpdate'), { operationalStatus: 'maintenance' }),
      responses: { 200: ok('Updated vehicle', envelope(ref('Vehicle'))), ...std(E_BAD, E_KEY, E_FORBIDDEN, E_404, E_RATE, E_DOWN) },
    },
  },

  // ── Telemetry service ──────────────────────────────────────────────────────
  '/api/telemetry': {
    post: {
      tags: ['Telemetry'], summary: 'Submit a telemetry record',
      description: `${roles('admin, fleet_manager')} Updates the vehicle's last known GPS location and battery. engineTemperature > 110 auto-flags ENGINE_FAULT; batteryLevel < 20 auto-flags LOW_BATTERY. Critical events send a MockSMS notification (the mock fails ~15% of the time by design; failures are recorded with status "failed").`,
      security: SEC.apiKeyJwt,
      requestBody: body(ref('Telemetry'), { vehicleId: 'VH001', latitude: 21.2514, longitude: 81.6296, speed: 65, engineTemperature: 85, batteryLevel: 80 }),
      responses: { 201: ok('Telemetry stored', envelope(ref('Telemetry')), { success: true, data: telemetryExample }), ...std(E_BAD, E_KEY, E_FORBIDDEN, E_RATE, E_DOWN) },
    },
  },
  '/api/telemetry/recent': {
    get: {
      tags: ['Telemetry'], summary: 'Recent telemetry events across the fleet', description: 'Any authenticated role. Newest first. Used by the dashboard.', security: SEC.apiKeyJwt,
      parameters: [
        query('limit', 'Max records (default 20, max 500)', { type: 'integer', default: 20 }),
        query('hours', 'Only events from the last N hours', { type: 'number', example: 24 }),
        query('critical', 'true = only ENGINE_FAULT / LOW_BATTERY / EMERGENCY_STOP', { type: 'boolean' }),
      ],
      responses: { 200: ok('Records', envelope({ type: 'array', items: ref('Telemetry') }, { count: { type: 'integer' } })), ...std(E_KEY, E_RATE, E_DOWN) },
    },
  },
  '/api/telemetry/{vehicleId}': {
    get: {
      tags: ['Telemetry'], summary: 'Telemetry history', description: 'Any authenticated role. Newest first.', security: SEC.apiKeyJwt,
      parameters: [pathParam('vehicleId', 'Business vehicle ID', 'VH001'), query('limit', 'Max records (default 50)', { type: 'integer', default: 50, minimum: 1 })],
      responses: { 200: ok('Records', envelope({ type: 'array', items: ref('Telemetry') }, { count: { type: 'integer' } })), ...std(E_KEY, E_RATE, E_DOWN) },
    },
  },
  '/api/telemetry/{vehicleId}/latest': {
    get: {
      tags: ['Telemetry'], summary: 'Latest telemetry record', description: 'Any authenticated role.', security: SEC.apiKeyJwt,
      parameters: [pathParam('vehicleId', 'Business vehicle ID', 'VH001')],
      responses: { 200: ok('Latest record', envelope(ref('Telemetry')), { success: true, data: telemetryExample }), ...std(E_KEY, E_404, E_RATE, E_DOWN) },
    },
  },

  // ── Geolocation service ────────────────────────────────────────────────────
  '/api/maps/geocode': {
    post: {
      tags: ['Geolocation'], summary: 'Geocode an address (OpenStreetMap Nominatim)',
      description: `${roles('admin, fleet_manager')} Converts an address to coordinates using Nominatim. Results are cached (memory + MongoDB) and requests are serialised to ≤1/second per the Nominatim usage policy, so uncached calls may take 1–2 s. Data © OpenStreetMap contributors (ODbL).`,
      security: SEC.apiKeyJwt,
      requestBody: body(ref('GeocodingRequest'), { address: 'Raipur Railway Station, Chhattisgarh, India' }),
      responses: {
        200: ok('Coordinates', envelope(ref('GeocodingResponse')), { success: true, data: { latitude: 21.2403, longitude: 81.6378, formattedAddress: 'Raipur Junction, Raipur, Chhattisgarh, India', provider: 'nominatim', cached: false, attribution: '© OpenStreetMap contributors (https://www.openstreetmap.org/copyright)' } }),
        ...std(E_BAD, E_KEY, E_FORBIDDEN, ['404', 'AddressNotFound'], E_RATE, ['502', 'GeocoderError'], E_DOWN, E_TIMEOUT),
      },
    },
  },
  '/api/maps/geocode/{vehicleId}': {
    post: {
      tags: ['Geolocation'], summary: 'Geocode an address and save it to a vehicle',
      description: `${roles('admin, fleet_manager')} Verifies the vehicle exists first (an unknown ID never costs a Nominatim request), then stores address + coordinates on it.`,
      security: SEC.apiKeyJwt,
      parameters: [pathParam('vehicleId', 'Business vehicle ID', 'VH001')],
      requestBody: body(ref('GeocodingRequest'), { address: 'Raipur Railway Station, Chhattisgarh, India' }),
      responses: {
        200: ok('Vehicle updated', envelope({ type: 'object', properties: { vehicle: ref('Vehicle'), coordinates: ref('GeocodingResponse') } })),
        ...std(E_BAD, E_KEY, E_FORBIDDEN, E_404, E_RATE, ['502', 'GeocoderError'], E_DOWN, E_TIMEOUT),
      },
    },
  },
  '/api/maps/nearby': {
    get: {
      tags: ['Geolocation'], summary: 'Find vehicles within a radius (Haversine)',
      description: 'Any authenticated role. Computed locally with the Haversine formula over stored coordinates — never calls Nominatim.',
      security: SEC.apiKeyJwt,
      parameters: [
        query('latitude', 'Centre latitude (-90..90)', { type: 'number', example: 21.2514 }, true),
        query('longitude', 'Centre longitude (-180..180)', { type: 'number', example: 81.6296 }, true),
        query('radius', 'Radius in kilometres (> 0)', { type: 'number', example: 50 }, true),
      ],
      responses: {
        200: ok('Vehicles sorted by distance', envelope({ type: 'array', items: ref('NearbyVehicle') }, { count: { type: 'integer' } }), { success: true, count: 1, data: [{ vehicle: vehicleExample, distance: 0 }] }),
        ...std(E_BAD, E_KEY, E_RATE, E_DOWN),
      },
    },
  },
  '/api/maps/locations': {
    get: {
      tags: ['Geolocation'], summary: 'All vehicles that have coordinates', description: 'Any authenticated role.', security: SEC.apiKeyJwt,
      responses: { 200: ok('Located vehicles', envelope({ type: 'array', items: ref('Vehicle') }, { count: { type: 'integer' } })), ...std(E_KEY, E_RATE, E_DOWN) },
    },
  },

  // ── Notification service ───────────────────────────────────────────────────
  '/api/notifications': {
    get: {
      tags: ['Notifications'], summary: 'All notification history', description: roles('admin, fleet_manager'), security: SEC.apiKeyJwt,
      responses: { 200: ok('Notifications, newest first', envelope({ type: 'array', items: ref('Notification') }, { count: { type: 'integer' } })), ...std(E_KEY, E_FORBIDDEN, E_RATE, E_DOWN) },
    },
  },
  '/api/notifications/vehicle/{vehicleId}': {
    get: {
      tags: ['Notifications'], summary: 'Notification history for a vehicle', description: 'Any authenticated role.', security: SEC.apiKeyJwt,
      parameters: [pathParam('vehicleId', 'Business vehicle ID', 'VH004')],
      responses: { 200: ok('Notifications', envelope({ type: 'array', items: ref('Notification') }, { count: { type: 'integer' } }), { success: true, count: 1, data: [notificationExample] }), ...std(E_KEY, E_RATE, E_DOWN) },
    },
  },
  '/api/notifications/test': {
    post: {
      tags: ['Notifications'], summary: 'Send a test MockSMS notification', description: `${roles('admin')} The mock provider fails randomly (~15%); the stored notification then has status "failed".`, security: SEC.apiKeyJwt,
      requestBody: body({ type: 'object', required: ['vehicleId', 'recipient', 'message', 'eventType'], properties: { vehicleId: { type: 'string' }, recipient: { type: 'string' }, message: { type: 'string' }, eventType: { type: 'string', enum: ['ENGINE_FAULT', 'LOW_BATTERY', 'EMERGENCY_STOP', 'STATUS_CHANGE'] } } }, { vehicleId: 'VH001', recipient: '+919999999999', message: 'Test alert', eventType: 'STATUS_CHANGE' }),
      responses: { 201: ok('Notification recorded', envelope(ref('Notification')), { success: true, data: notificationExample }), ...std(E_BAD, E_KEY, E_FORBIDDEN, E_RATE, E_DOWN) },
    },
  },
};

// ── Components ───────────────────────────────────────────────────────────────
const errorBody = (error, message) => ({ success: false, ...(error && { error }), message });
const errResp = (description, example, schema = ref('ErrorResponse')) => ({ description, ...json(schema, example) });

const schemas = {
  ErrorResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      error: { type: 'string', description: 'Machine-readable code (gateway and geocoder errors)', example: 'INVALID_API_KEY' },
      message: { type: 'string' },
      retryAfterSeconds: { type: 'integer', description: 'Present on gateway 429s' },
      retryAfter: { type: 'integer', description: 'Present on geocoder 429s' },
    },
  },
  MessageResponse: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' } } },
  HealthResponse: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ok', 'degraded'] }, gateway: { type: 'string', example: 'online' }, timestamp: { type: 'string', format: 'date-time' },
      services: { type: 'object', additionalProperties: { type: 'object', properties: { route: { type: 'string' }, status: { type: 'string' }, latencyMs: { type: 'integer', nullable: true } } } },
    },
  },
  User: {
    type: 'object',
    properties: {
      _id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string', format: 'email' }, phone: { type: 'string' },
      role: { type: 'string', enum: ['admin', 'fleet_manager', 'viewer'] },
      createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  UserRegistration: {
    type: 'object', required: ['name', 'email', 'password'],
    properties: {
      name: { type: 'string', maxLength: 100 }, email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 6 }, phone: { type: 'string' },
      role: { type: 'string', enum: ['admin', 'fleet_manager', 'viewer'], default: 'viewer' },
    },
  },
  UserLogin: {
    type: 'object', required: ['email', 'password'],
    properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
  },
  AuthenticationResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: { type: 'object', properties: { user: ref('User'), token: { type: 'string', description: 'JWT for `Authorization: Bearer`' } } },
    },
  },
  GPSCoordinates: {
    type: 'object', required: ['latitude', 'longitude'],
    properties: { latitude: { type: 'number', minimum: -90, maximum: 90, nullable: true }, longitude: { type: 'number', minimum: -180, maximum: 180, nullable: true } },
  },
  Vehicle: {
    type: 'object',
    properties: {
      _id: { type: 'string' }, vehicleId: { type: 'string', example: 'VH001' }, registrationNumber: { type: 'string', example: 'CG04KA1001' },
      vehicleType: { type: 'string', enum: ['truck', 'van', 'car', 'motorcycle', 'bus', 'other'] },
      model: { type: 'string' }, manufacturer: { type: 'string' }, assignedDriver: { type: 'string', nullable: true },
      operationalStatus: { type: 'string', enum: ['active', 'idle', 'maintenance', 'inactive'] },
      address: { type: 'string' }, location: ref('GPSCoordinates'), batteryLevel: { type: 'number', minimum: 0, maximum: 100 },
      createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  VehicleRegistration: {
    type: 'object', required: ['vehicleId', 'registrationNumber', 'vehicleType', 'model', 'manufacturer'],
    properties: {
      vehicleId: { type: 'string' }, registrationNumber: { type: 'string' },
      vehicleType: { type: 'string', enum: ['truck', 'van', 'car', 'motorcycle', 'bus', 'other'] },
      model: { type: 'string' }, manufacturer: { type: 'string' }, assignedDriver: { type: 'string' },
      operationalStatus: { type: 'string', enum: ['active', 'idle', 'maintenance', 'inactive'], default: 'idle' },
      address: { type: 'string' }, location: ref('GPSCoordinates'), batteryLevel: { type: 'number', default: 100 },
    },
  },
  VehicleStatusUpdate: {
    type: 'object', required: ['operationalStatus'],
    properties: { operationalStatus: { type: 'string', enum: ['active', 'idle', 'maintenance', 'inactive'] } },
  },
  Telemetry: {
    type: 'object', required: ['vehicleId', 'latitude', 'longitude'],
    properties: {
      _id: { type: 'string', readOnly: true }, vehicleId: { type: 'string' },
      latitude: { type: 'number', minimum: -90, maximum: 90 }, longitude: { type: 'number', minimum: -180, maximum: 180 },
      speed: { type: 'number', minimum: 0, default: 0, description: 'km/h' },
      engineTemperature: { type: 'number', nullable: true, description: '°C; > 110 auto-flags ENGINE_FAULT' },
      batteryLevel: { type: 'number', minimum: 0, maximum: 100, nullable: true, description: '< 20 auto-flags LOW_BATTERY' },
      eventType: { type: 'string', enum: ['NORMAL', 'ENGINE_FAULT', 'LOW_BATTERY', 'EMERGENCY_STOP'], default: 'NORMAL' },
      timestamp: { type: 'string', format: 'date-time', readOnly: true },
    },
  },
  GeocodingRequest: {
    type: 'object', required: ['address'],
    properties: { address: { type: 'string', maxLength: 300, example: 'Raipur Railway Station, Chhattisgarh, India' } },
  },
  GeocodingResponse: {
    type: 'object',
    properties: {
      latitude: { type: 'number' }, longitude: { type: 'number' }, formattedAddress: { type: 'string' },
      provider: { type: 'string', example: 'nominatim' }, cached: { type: 'boolean', description: 'true when served from cache (no Nominatim request made)' },
      attribution: { type: 'string', example: '© OpenStreetMap contributors (https://www.openstreetmap.org/copyright)' },
    },
  },
  NearbyVehicleSearch: {
    type: 'object', required: ['latitude', 'longitude', 'radius'],
    description: 'Query parameters of GET /api/maps/nearby',
    properties: { latitude: { type: 'number' }, longitude: { type: 'number' }, radius: { type: 'number', description: 'km' } },
  },
  NearbyVehicle: {
    type: 'object',
    properties: { vehicle: ref('Vehicle'), distance: { type: 'number', description: 'Haversine distance in km' } },
  },
  Notification: {
    type: 'object',
    properties: {
      _id: { type: 'string' }, vehicleId: { type: 'string' }, recipient: { type: 'string' }, message: { type: 'string' },
      eventType: { type: 'string', enum: ['ENGINE_FAULT', 'LOW_BATTERY', 'EMERGENCY_STOP', 'STATUS_CHANGE'] },
      provider: { type: 'string', example: 'MockSMS' }, status: { type: 'string', enum: ['sent', 'failed'] },
      failureReason: { type: 'string', nullable: true }, timestamp: { type: 'string', format: 'date-time' },
    },
  },
};

const responses = {
  BadRequest: errResp('Missing/invalid parameters, validation failure or malformed JSON (gateway: `MALFORMED_JSON`)', errorBody(null, 'name, email and password are required')),
  Unauthorized: errResp('Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials.', errorBody('INVALID_API_KEY', 'The provided API key is invalid.')),
  Forbidden: errResp('Authenticated, but the JWT role is not allowed for this route', errorBody(null, "Role 'viewer' is not authorized to access this route")),
  NotFound: errResp('Resource not found', errorBody(null, "Vehicle 'VH999' not found")),
  AddressNotFound: errResp('Nominatim found no match for the address', errorBody('ADDRESS_NOT_FOUND', 'No results found for address: "zzzz"')),
  Conflict: errResp('Duplicate unique field (e.g. email, vehicleId)', errorBody(null, 'A record with that vehicleId already exists')),
  RateLimited: {
    description: 'Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned.',
    headers: { 'Retry-After': { schema: { type: 'integer' }, description: 'Seconds until retry' }, 'RateLimit-Limit': { schema: { type: 'integer' } }, 'RateLimit-Remaining': { schema: { type: 'integer' } }, 'RateLimit-Reset': { schema: { type: 'integer' } } },
    ...json(ref('ErrorResponse'), { ...errorBody('RATE_LIMIT_EXCEEDED', 'Too many requests from this IP. Please try again later.'), retryAfterSeconds: 540 }),
  },
  GeocoderError: errResp('Geocoding provider returned an error or invalid coordinates (`GEOCODER_ERROR`, `GEOCODER_UNAVAILABLE`, `GEOCODER_INVALID_COORDINATES`)', errorBody('GEOCODER_UNAVAILABLE', 'Geocoding provider is unreachable.')),
  ServiceUnavailable: errResp('Backend service unreachable (`SERVICE_UNAVAILABLE`)', errorBody('SERVICE_UNAVAILABLE', 'The vehicle service is currently unavailable.')),
  GatewayTimeout: errResp('Backend or geocoder timed out (`GATEWAY_TIMEOUT`, `GEOCODER_TIMEOUT`)', errorBody('GATEWAY_TIMEOUT', 'The vehicle service did not respond in time.')),
};

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Fleet Management System API',
      version: '1.0.0',
      description: [
        'Vehicle tracking, telemetry, geolocation and notification APIs behind a single API Gateway.',
        '',
        '### Two layers of security',
        '| Layer | Where | Mechanism | Answers |',
        '|---|---|---|---|',
        '| **Gateway authentication** | API Gateway | `x-api-key` header (`ApiKeyAuth`) | "Is this client allowed to call the platform?" → 401 |',
        '| **Backend authorization** | Backend services | `Authorization: Bearer <JWT>` (`BearerAuth`) + role (RBAC) | "Who is the user and what may they do?" → 401 / 403 |',
        '',
        '- **Login/register:** API key only. **Vehicle read:** API key + JWT. **Vehicle delete:** API key + JWT + `admin` role. **/health, /api-docs:** public.',
        '- Roles: `admin` (everything), `fleet_manager` (create/update vehicles, telemetry, geocoding, notification history), `viewer` (read-only).',
        '- Rate limiting: per IP, configurable; 429 with `RateLimit-*` headers.',
        '- Geocoding uses OpenStreetMap Nominatim — data © OpenStreetMap contributors (ODbL).',
        '',
        'Click **Authorize** to enter the API key and (after calling login) the JWT.',
      ].join('\n'),
    },
    servers: [{ url: `http://localhost:${GATEWAY_PORT}`, description: 'API Gateway (single entry point)' }],
    tags: [
      { name: 'Health' }, { name: 'Users', description: 'User Service' }, { name: 'Vehicles', description: 'Vehicle/Fleet Service' },
      { name: 'Telemetry', description: 'Telemetry Service' }, { name: 'Geolocation', description: 'Geolocation Service (Nominatim + Haversine)' },
      { name: 'Notifications', description: 'Notification Service (MockSMS)' },
    ],
    security: SEC.apiKeyJwt,
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key', description: 'Gateway API key (GATEWAY_API_KEY).' },
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT returned by POST /api/users/login.' },
      },
      schemas,
      responses,
    },
    paths,
  },
  apis: [], // all paths are declared above; swagger-jsdoc also validates/assembles the spec
};

module.exports = swaggerJsdoc(options);
