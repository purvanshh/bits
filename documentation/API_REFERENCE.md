# Fleet Management System API – API Reference (v1.0.0)

> Generated from the OpenAPI document served at `http://localhost:4000/api-docs.json` (Swagger UI: `http://localhost:4000/api-docs`). Do not edit by hand – run `npm run docs:generate`.

Vehicle tracking, telemetry, geolocation and notification APIs behind a single API Gateway.

### Two layers of security
| Layer | Where | Mechanism | Answers |
|---|---|---|---|
| **Gateway authentication** | API Gateway | `x-api-key` header (`ApiKeyAuth`) | "Is this client allowed to call the platform?" → 401 |
| **Backend authorization** | Backend services | `Authorization: Bearer <JWT>` (`BearerAuth`) + role (RBAC) | "Who is the user and what may they do?" → 401 / 403 |

- **Login/register:** API key only. **Vehicle read:** API key + JWT. **Vehicle delete:** API key + JWT + `admin` role. **/health, /api-docs:** public.
- Roles: `admin` (everything), `fleet_manager` (create/update vehicles, telemetry, geocoding, notification history), `viewer` (read-only).
- Rate limiting: per IP, configurable; 429 with `RateLimit-*` headers.
- Geocoding uses OpenStreetMap Nominatim — data © OpenStreetMap contributors (ODbL).

Click **Authorize** to enter the API key and (after calling login) the JWT.

## Authentication

| Scheme | Type | Where | Used for |
|---|---|---|---|
| `ApiKeyAuth` | apiKey | header `x-api-key` | **Gateway authentication** – required on every `/api/*` request |
| `BearerAuth` | HTTP bearer (JWT) | header `Authorization: Bearer <token>` | **Backend authorization** – token from `POST /api/users/login`, role checked by the service |

Base URL (gateway): `http://localhost:4000`

## Endpoint summary

| Method | Path | Summary | Auth | Roles |
|---|---|---|---|---|
| GET | `/health` | Gateway and backend service health | Public | – |
| POST | `/api/users/register` | Register a user | API key | – |
| POST | `/api/users/login` | Log in and obtain a JWT | API key | – |
| GET | `/api/users/me` | Current user profile | API key + JWT | any authenticated role |
| GET | `/api/users` | List all users | API key + JWT | admin |
| GET | `/api/users/{id}` | Get user by ID | API key + JWT | admin |
| PUT | `/api/users/{id}` | Update a user | API key + JWT | admin |
| DELETE | `/api/users/{id}` | Delete a user | API key + JWT | admin |
| POST | `/api/vehicles` | Register a vehicle | API key + JWT | admin, fleet_manager |
| GET | `/api/vehicles` | List vehicles | API key + JWT | any authenticated role |
| GET | `/api/vehicles/search` | Search by registration number | API key + JWT | any authenticated role |
| GET | `/api/vehicles/{vehicleId}` | Get vehicle by ID | API key + JWT | any authenticated role |
| PUT | `/api/vehicles/{vehicleId}` | Update a vehicle | API key + JWT | admin, fleet_manager |
| DELETE | `/api/vehicles/{vehicleId}` | Delete a vehicle | API key + JWT | admin only |
| PATCH | `/api/vehicles/{vehicleId}/status` | Update operational status | API key + JWT | admin, fleet_manager |
| POST | `/api/telemetry` | Submit a telemetry record | API key + JWT | admin, fleet_manager |
| GET | `/api/telemetry/recent` | Recent telemetry events across the fleet | API key + JWT | any authenticated role |
| GET | `/api/telemetry/{vehicleId}` | Telemetry history | API key + JWT | any authenticated role |
| GET | `/api/telemetry/{vehicleId}/latest` | Latest telemetry record | API key + JWT | any authenticated role |
| POST | `/api/maps/geocode` | Geocode an address (OpenStreetMap Nominatim) | API key + JWT | admin, fleet_manager |
| POST | `/api/maps/geocode/{vehicleId}` | Geocode an address and save it to a vehicle | API key + JWT | admin, fleet_manager |
| GET | `/api/maps/nearby` | Find vehicles within a radius (Haversine) | API key + JWT | any authenticated role |
| GET | `/api/maps/locations` | All vehicles that have coordinates | API key + JWT | any authenticated role |
| GET | `/api/notifications` | All notification history | API key + JWT | admin, fleet_manager |
| GET | `/api/notifications/vehicle/{vehicleId}` | Notification history for a vehicle | API key + JWT | any authenticated role |
| POST | `/api/notifications/test` | Send a test MockSMS notification | API key + JWT | admin |

26 operations across 5 services.

## Health

### GET `/health`

**Gateway and backend service health.** Public. Not rate limited and requires no API key or JWT. Returns status only — never URLs, keys or secrets. 503 when any backend is unreachable.

- **Authentication:** Public
- **Required role:** –

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | All services healthy | HealthResponse |
| 503 | One or more services degraded or unavailable | HealthResponse |

Example `200` response:

```json
{
  "status": "ok",
  "gateway": "online",
  "timestamp": "2026-11-10T09:00:00.000Z",
  "services": {
    "user": {
      "route": "/api/users",
      "status": "ok",
      "latencyMs": 12
    }
  }
}
```

## Users – User Service

### POST `/api/users/register`

**Register a user.** Creates a user and returns a JWT. Needs the API key only (no JWT). Gateway authentication: `x-api-key`. Backend authorization: `Authorization: Bearer <JWT>` + role check.

- **Authentication:** API key (`x-api-key`)
- **Required role:** –

**Request body** (`application/json`, schema `UserRegistration`):

```json
{
  "name": "New Viewer",
  "email": "viewer2@fleet.com",
  "password": "secret123",
  "phone": "+919811111111",
  "role": "viewer"
}
```

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 201 | User created | AuthenticationResponse |
| 400 | Missing/invalid parameters, validation failure or malformed JSON (gateway: `MALFORMED_JSON`) | ErrorResponse |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 409 | Duplicate unique field (e.g. email, vehicleId) | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |
| 504 | Backend or geocoder timed out (`GATEWAY_TIMEOUT`, `GEOCODER_TIMEOUT`) | ErrorResponse |

Example `201` response:

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "66f1a2b3c4d5e6f708192a01",
      "name": "Admin User",
      "email": "admin@fleet.com",
      "phone": "+919999999999",
      "role": "admin",
      "createdAt": "2026-11-01T10:00:00.000Z",
      "updatedAt": "2026-11-01T10:00:00.000Z"
    },
    "token": "<JWT>"
  }
}
```

### POST `/api/users/login`

**Log in and obtain a JWT.** Requires the API key but **not** a JWT. Stricter rate limit applies (brute-force protection). Gateway authentication: `x-api-key`. Backend authorization: `Authorization: Bearer <JWT>` + role check.

- **Authentication:** API key (`x-api-key`)
- **Required role:** –

**Request body** (`application/json`, schema `UserLogin`):

```json
{
  "email": "admin@fleet.com",
  "password": "admin123"
}
```

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Login successful | AuthenticationResponse |
| 400 | Missing/invalid parameters, validation failure or malformed JSON (gateway: `MALFORMED_JSON`) | ErrorResponse |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |
| 504 | Backend or geocoder timed out (`GATEWAY_TIMEOUT`, `GEOCODER_TIMEOUT`) | ErrorResponse |

Example `200` response:

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "66f1a2b3c4d5e6f708192a01",
      "name": "Admin User",
      "email": "admin@fleet.com",
      "phone": "+919999999999",
      "role": "admin",
      "createdAt": "2026-11-01T10:00:00.000Z",
      "updatedAt": "2026-11-01T10:00:00.000Z"
    },
    "token": "<JWT>"
  }
}
```

### GET `/api/users/me`

**Current user profile.** Any authenticated role.

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** any authenticated role

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Profile | object |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

Example `200` response:

```json
{
  "success": true,
  "data": {
    "_id": "66f1a2b3c4d5e6f708192a01",
    "name": "Admin User",
    "email": "admin@fleet.com",
    "phone": "+919999999999",
    "role": "admin",
    "createdAt": "2026-11-01T10:00:00.000Z",
    "updatedAt": "2026-11-01T10:00:00.000Z"
  }
}
```

### GET `/api/users`

**List all users.** 

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** admin

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Users | object |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 403 | Authenticated, but the JWT role is not allowed for this route | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

### GET `/api/users/{id}`

**Get user by ID.** 

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** admin

| Parameter | In | Type | Required | Description |
|---|---|---|:-:|---|
| `id` | path | string | yes | MongoDB user `_id` |

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | User | object |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 403 | Authenticated, but the JWT role is not allowed for this route | ErrorResponse |
| 404 | Resource not found | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

### PUT `/api/users/{id}`

**Update a user.** 

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** admin

| Parameter | In | Type | Required | Description |
|---|---|---|:-:|---|
| `id` | path | string | yes | MongoDB user `_id` |

**Request body** (`application/json`, schema `object`):

```json
{
  "role": "fleet_manager"
}
```

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Updated user | object |
| 400 | Missing/invalid parameters, validation failure or malformed JSON (gateway: `MALFORMED_JSON`) | ErrorResponse |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 403 | Authenticated, but the JWT role is not allowed for this route | ErrorResponse |
| 404 | Resource not found | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

### DELETE `/api/users/{id}`

**Delete a user.** 

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** admin

| Parameter | In | Type | Required | Description |
|---|---|---|:-:|---|
| `id` | path | string | yes | MongoDB user `_id` |

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Deleted | MessageResponse |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 403 | Authenticated, but the JWT role is not allowed for this route | ErrorResponse |
| 404 | Resource not found | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

Example `200` response:

```json
{
  "success": true,
  "message": "User deleted"
}
```

## Vehicles – Vehicle/Fleet Service

### POST `/api/vehicles`

**Register a vehicle.** 

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** admin, fleet_manager

**Request body** (`application/json`, schema `VehicleRegistration`):

```json
{
  "vehicleId": "VH100",
  "registrationNumber": "CG04ZZ1234",
  "vehicleType": "van",
  "model": "Transit",
  "manufacturer": "Ford",
  "assignedDriver": "Test Driver"
}
```

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 201 | Vehicle created | object |
| 400 | Missing/invalid parameters, validation failure or malformed JSON (gateway: `MALFORMED_JSON`) | ErrorResponse |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 403 | Authenticated, but the JWT role is not allowed for this route | ErrorResponse |
| 409 | Duplicate unique field (e.g. email, vehicleId) | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

Example `201` response:

```json
{
  "success": true,
  "data": {
    "_id": "66f1a2b3c4d5e6f708192a3b",
    "vehicleId": "VH001",
    "registrationNumber": "CG04KA1001",
    "vehicleType": "truck",
    "model": "Actros",
    "manufacturer": "Mercedes",
    "assignedDriver": "Ramesh Kumar",
    "operationalStatus": "active",
    "address": "Raipur, Chhattisgarh",
    "location": {
      "latitude": 21.2514,
      "longitude": 81.6296
    },
    "batteryLevel": 85,
    "createdAt": "2026-11-01T10:00:00.000Z",
    "updatedAt": "2026-11-10T08:30:00.000Z"
  }
}
```

### GET `/api/vehicles`

**List vehicles.** Any authenticated role. Newest first.

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** any authenticated role

| Parameter | In | Type | Required | Description |
|---|---|---|:-:|---|
| `status` | query | string (active \| idle \| maintenance \| inactive) |  | Filter by operational status |
| `type` | query | string (truck \| van \| car \| motorcycle \| bus \| other) |  | Filter by vehicle type |

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Vehicles | object |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |
| 504 | Backend or geocoder timed out (`GATEWAY_TIMEOUT`, `GEOCODER_TIMEOUT`) | ErrorResponse |

Example `200` response:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "66f1a2b3c4d5e6f708192a3b",
      "vehicleId": "VH001",
      "registrationNumber": "CG04KA1001",
      "vehicleType": "truck",
      "model": "Actros",
      "manufacturer": "Mercedes",
      "assignedDriver": "Ramesh Kumar",
      "operationalStatus": "active",
      "address": "Raipur, Chhattisgarh",
      "location": {
        "latitude": 21.2514,
        "longitude": 81.6296
      },
      "batteryLevel": 85,
      "createdAt": "2026-11-01T10:00:00.000Z",
      "updatedAt": "2026-11-10T08:30:00.000Z"
    }
  ]
}
```

### GET `/api/vehicles/search`

**Search by registration number.** Case-insensitive partial match. Any authenticated role.

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** any authenticated role

| Parameter | In | Type | Required | Description |
|---|---|---|:-:|---|
| `q` | query | string | yes | Registration number fragment |

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Matches | object |
| 400 | Missing/invalid parameters, validation failure or malformed JSON (gateway: `MALFORMED_JSON`) | ErrorResponse |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

### GET `/api/vehicles/{vehicleId}`

**Get vehicle by ID.** Any authenticated role.

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** any authenticated role

| Parameter | In | Type | Required | Description |
|---|---|---|:-:|---|
| `vehicleId` | path | string | yes | Business vehicle ID (not the Mongo `_id`) |

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Vehicle | object |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 404 | Resource not found | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

Example `200` response:

```json
{
  "success": true,
  "data": {
    "_id": "66f1a2b3c4d5e6f708192a3b",
    "vehicleId": "VH001",
    "registrationNumber": "CG04KA1001",
    "vehicleType": "truck",
    "model": "Actros",
    "manufacturer": "Mercedes",
    "assignedDriver": "Ramesh Kumar",
    "operationalStatus": "active",
    "address": "Raipur, Chhattisgarh",
    "location": {
      "latitude": 21.2514,
      "longitude": 81.6296
    },
    "batteryLevel": 85,
    "createdAt": "2026-11-01T10:00:00.000Z",
    "updatedAt": "2026-11-10T08:30:00.000Z"
  }
}
```

### PUT `/api/vehicles/{vehicleId}`

**Update a vehicle.** 

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** admin, fleet_manager

| Parameter | In | Type | Required | Description |
|---|---|---|:-:|---|
| `vehicleId` | path | string | yes | Business vehicle ID (not the Mongo `_id`) |

**Request body** (`application/json`, schema `object`):

```json
{
  "assignedDriver": "New Driver"
}
```

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Updated vehicle | object |
| 400 | Missing/invalid parameters, validation failure or malformed JSON (gateway: `MALFORMED_JSON`) | ErrorResponse |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 403 | Authenticated, but the JWT role is not allowed for this route | ErrorResponse |
| 404 | Resource not found | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

### DELETE `/api/vehicles/{vehicleId}`

**Delete a vehicle.** A fleet_manager or viewer JWT yields 403.

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** admin only

| Parameter | In | Type | Required | Description |
|---|---|---|:-:|---|
| `vehicleId` | path | string | yes | Business vehicle ID (not the Mongo `_id`) |

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Deleted | MessageResponse |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 403 | Authenticated, but the JWT role is not allowed for this route | ErrorResponse |
| 404 | Resource not found | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

Example `200` response:

```json
{
  "success": true,
  "message": "Vehicle deleted"
}
```

### PATCH `/api/vehicles/{vehicleId}/status`

**Update operational status.** Also triggers a STATUS_CHANGE MockSMS notification.

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** admin, fleet_manager

| Parameter | In | Type | Required | Description |
|---|---|---|:-:|---|
| `vehicleId` | path | string | yes | Business vehicle ID |

**Request body** (`application/json`, schema `VehicleStatusUpdate`):

```json
{
  "operationalStatus": "maintenance"
}
```

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Updated vehicle | object |
| 400 | Missing/invalid parameters, validation failure or malformed JSON (gateway: `MALFORMED_JSON`) | ErrorResponse |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 403 | Authenticated, but the JWT role is not allowed for this route | ErrorResponse |
| 404 | Resource not found | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

## Telemetry – Telemetry Service

### POST `/api/telemetry`

**Submit a telemetry record.** Updates the vehicle's last known GPS location and battery. engineTemperature > 110 auto-flags ENGINE_FAULT; batteryLevel < 20 auto-flags LOW_BATTERY. Critical events send a MockSMS notification (the mock fails ~15% of the time by design; failures are recorded with status "failed").

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** admin, fleet_manager

**Request body** (`application/json`, schema `Telemetry`):

```json
{
  "vehicleId": "VH001",
  "latitude": 21.2514,
  "longitude": 81.6296,
  "speed": 65,
  "engineTemperature": 85,
  "batteryLevel": 80
}
```

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 201 | Telemetry stored | object |
| 400 | Missing/invalid parameters, validation failure or malformed JSON (gateway: `MALFORMED_JSON`) | ErrorResponse |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 403 | Authenticated, but the JWT role is not allowed for this route | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

Example `201` response:

```json
{
  "success": true,
  "data": {
    "_id": "66f1a2b3c4d5e6f708192a50",
    "vehicleId": "VH001",
    "latitude": 21.2514,
    "longitude": 81.6296,
    "speed": 65,
    "engineTemperature": 85,
    "batteryLevel": 80,
    "eventType": "NORMAL",
    "timestamp": "2026-11-10T09:00:00.000Z"
  }
}
```

### GET `/api/telemetry/recent`

**Recent telemetry events across the fleet.** Any authenticated role. Newest first. Used by the dashboard.

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** any authenticated role

| Parameter | In | Type | Required | Description |
|---|---|---|:-:|---|
| `limit` | query | integer |  | Max records (default 20, max 500) |
| `hours` | query | number |  | Only events from the last N hours |
| `critical` | query | boolean |  | true = only ENGINE_FAULT / LOW_BATTERY / EMERGENCY_STOP |

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Records | object |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

### GET `/api/telemetry/{vehicleId}`

**Telemetry history.** Any authenticated role. Newest first.

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** any authenticated role

| Parameter | In | Type | Required | Description |
|---|---|---|:-:|---|
| `vehicleId` | path | string | yes | Business vehicle ID |
| `limit` | query | integer |  | Max records (default 50) |

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Records | object |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

### GET `/api/telemetry/{vehicleId}/latest`

**Latest telemetry record.** Any authenticated role.

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** any authenticated role

| Parameter | In | Type | Required | Description |
|---|---|---|:-:|---|
| `vehicleId` | path | string | yes | Business vehicle ID |

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Latest record | object |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 404 | Resource not found | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

Example `200` response:

```json
{
  "success": true,
  "data": {
    "_id": "66f1a2b3c4d5e6f708192a50",
    "vehicleId": "VH001",
    "latitude": 21.2514,
    "longitude": 81.6296,
    "speed": 65,
    "engineTemperature": 85,
    "batteryLevel": 80,
    "eventType": "NORMAL",
    "timestamp": "2026-11-10T09:00:00.000Z"
  }
}
```

## Geolocation – Geolocation Service (Nominatim + Haversine)

### POST `/api/maps/geocode`

**Geocode an address (OpenStreetMap Nominatim).** Converts an address to coordinates using Nominatim. Results are cached (memory + MongoDB) and requests are serialised to ≤1/second per the Nominatim usage policy, so uncached calls may take 1–2 s. Data © OpenStreetMap contributors (ODbL).

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** admin, fleet_manager

**Request body** (`application/json`, schema `GeocodingRequest`):

```json
{
  "address": "Raipur Railway Station, Chhattisgarh, India"
}
```

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Coordinates | object |
| 400 | Missing/invalid parameters, validation failure or malformed JSON (gateway: `MALFORMED_JSON`) | ErrorResponse |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 403 | Authenticated, but the JWT role is not allowed for this route | ErrorResponse |
| 404 | Nominatim found no match for the address | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 502 | Geocoding provider returned an error or invalid coordinates (`GEOCODER_ERROR`, `GEOCODER_UNAVAILABLE`, `GEOCODER_INVALID_COORDINATES`) | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |
| 504 | Backend or geocoder timed out (`GATEWAY_TIMEOUT`, `GEOCODER_TIMEOUT`) | ErrorResponse |

Example `200` response:

```json
{
  "success": true,
  "data": {
    "latitude": 21.2403,
    "longitude": 81.6378,
    "formattedAddress": "Raipur Junction, Raipur, Chhattisgarh, India",
    "provider": "nominatim",
    "cached": false,
    "attribution": "© OpenStreetMap contributors (https://www.openstreetmap.org/copyright)"
  }
}
```

### POST `/api/maps/geocode/{vehicleId}`

**Geocode an address and save it to a vehicle.** Verifies the vehicle exists first (an unknown ID never costs a Nominatim request), then stores address + coordinates on it.

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** admin, fleet_manager

| Parameter | In | Type | Required | Description |
|---|---|---|:-:|---|
| `vehicleId` | path | string | yes | Business vehicle ID |

**Request body** (`application/json`, schema `GeocodingRequest`):

```json
{
  "address": "Raipur Railway Station, Chhattisgarh, India"
}
```

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Vehicle updated | object |
| 400 | Missing/invalid parameters, validation failure or malformed JSON (gateway: `MALFORMED_JSON`) | ErrorResponse |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 403 | Authenticated, but the JWT role is not allowed for this route | ErrorResponse |
| 404 | Resource not found | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 502 | Geocoding provider returned an error or invalid coordinates (`GEOCODER_ERROR`, `GEOCODER_UNAVAILABLE`, `GEOCODER_INVALID_COORDINATES`) | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |
| 504 | Backend or geocoder timed out (`GATEWAY_TIMEOUT`, `GEOCODER_TIMEOUT`) | ErrorResponse |

### GET `/api/maps/nearby`

**Find vehicles within a radius (Haversine).** Any authenticated role. Computed locally with the Haversine formula over stored coordinates — never calls Nominatim.

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** any authenticated role

| Parameter | In | Type | Required | Description |
|---|---|---|:-:|---|
| `latitude` | query | number | yes | Centre latitude (-90..90) |
| `longitude` | query | number | yes | Centre longitude (-180..180) |
| `radius` | query | number | yes | Radius in kilometres (> 0) |

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Vehicles sorted by distance | object |
| 400 | Missing/invalid parameters, validation failure or malformed JSON (gateway: `MALFORMED_JSON`) | ErrorResponse |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

Example `200` response:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "vehicle": {
        "_id": "66f1a2b3c4d5e6f708192a3b",
        "vehicleId": "VH001",
        "registrationNumber": "CG04KA1001",
        "vehicleType": "truck",
        "model": "Actros",
        "manufacturer": "Mercedes",
        "assignedDriver": "Ramesh Kumar",
        "operationalStatus": "active",
        "address": "Raipur, Chhattisgarh",
        "location": {
          "latitude": 21.2514,
          "longitude": 81.6296
        },
        "batteryLevel": 85,
        "createdAt": "2026-11-01T10:00:00.000Z",
        "updatedAt": "2026-11-10T08:30:00.000Z"
      },
      "distance": 0
    }
  ]
}
```

### GET `/api/maps/locations`

**All vehicles that have coordinates.** Any authenticated role.

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** any authenticated role

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Located vehicles | object |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

## Notifications – Notification Service (MockSMS)

### GET `/api/notifications`

**All notification history.** 

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** admin, fleet_manager

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Notifications, newest first | object |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 403 | Authenticated, but the JWT role is not allowed for this route | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

### GET `/api/notifications/vehicle/{vehicleId}`

**Notification history for a vehicle.** Any authenticated role.

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** any authenticated role

| Parameter | In | Type | Required | Description |
|---|---|---|:-:|---|
| `vehicleId` | path | string | yes | Business vehicle ID |

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 200 | Notifications | object |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

Example `200` response:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "66f1a2b3c4d5e6f708192a60",
      "vehicleId": "VH004",
      "recipient": "+919999999999",
      "message": "ALERT: Engine fault on vehicle VH004.",
      "eventType": "ENGINE_FAULT",
      "provider": "MockSMS",
      "status": "sent",
      "failureReason": null,
      "timestamp": "2026-11-10T09:05:00.000Z"
    }
  ]
}
```

### POST `/api/notifications/test`

**Send a test MockSMS notification.** The mock provider fails randomly (~15%); the stored notification then has status "failed".

- **Authentication:** API key + JWT (`x-api-key` + `Authorization: Bearer <JWT>`)
- **Required role:** admin

**Request body** (`application/json`, schema `object`):

```json
{
  "vehicleId": "VH001",
  "recipient": "+919999999999",
  "message": "Test alert",
  "eventType": "STATUS_CHANGE"
}
```

**Responses**

| Status | Meaning | Model |
|---|---|---|
| 201 | Notification recorded | object |
| 400 | Missing/invalid parameters, validation failure or malformed JSON (gateway: `MALFORMED_JSON`) | ErrorResponse |
| 401 | Gateway: missing/invalid `x-api-key` (`MISSING_API_KEY` / `INVALID_API_KEY`). Backend: missing/invalid/expired JWT or bad credentials. | ErrorResponse |
| 403 | Authenticated, but the JWT role is not allowed for this route | ErrorResponse |
| 429 | Gateway rate limit exceeded (`RATE_LIMIT_EXCEEDED`, `AUTH_RATE_LIMIT_EXCEEDED`) or geocoder upstream limit (`GEOCODER_RATE_LIMITED`). Standard `RateLimit-*` and `Retry-After` headers are returned. | ErrorResponse |
| 503 | Backend service unreachable (`SERVICE_UNAVAILABLE`) | ErrorResponse |

Example `201` response:

```json
{
  "success": true,
  "data": {
    "_id": "66f1a2b3c4d5e6f708192a60",
    "vehicleId": "VH004",
    "recipient": "+919999999999",
    "message": "ALERT: Engine fault on vehicle VH004.",
    "eventType": "ENGINE_FAULT",
    "provider": "MockSMS",
    "status": "sent",
    "failureReason": null,
    "timestamp": "2026-11-10T09:05:00.000Z"
  }
}
```

## Error model

All errors use `{ "success": false, "message": "…" }`; gateway and geocoder errors add a machine-readable `error` code.

| Status | `error` code | Raised by | Cause |
|---|---|---|---|
| 400 | MALFORMED_JSON | Gateway | Request body is not valid JSON |
| 400 | – | Backend | Missing/invalid parameters or validation failure |
| 401 | MISSING_API_KEY / INVALID_API_KEY | Gateway | No / wrong `x-api-key` |
| 401 | – | Backend | Missing, invalid or expired JWT; bad credentials |
| 403 | – | Backend | JWT valid but role not permitted |
| 404 | ADDRESS_NOT_FOUND / – | Backend | Resource or geocoded address not found |
| 409 | – | Backend | Duplicate unique field |
| 429 | RATE_LIMIT_EXCEEDED / AUTH_RATE_LIMIT_EXCEEDED | Gateway | Per-IP rate limit (headers `RateLimit-*`, `Retry-After`) |
| 429 | GEOCODER_RATE_LIMITED | Backend | Nominatim is throttling – retry after `retryAfter` seconds |
| 502 | GEOCODER_ERROR / GEOCODER_UNAVAILABLE / GEOCODER_INVALID_COORDINATES | Backend | Geocoding provider failure |
| 503 | SERVICE_UNAVAILABLE | Gateway | Target service unreachable |
| 504 | GATEWAY_TIMEOUT / GEOCODER_TIMEOUT | Gateway / Backend | Upstream timed out |

## Schemas

### ErrorResponse

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `success` | boolean |  |  |
| `error` | string |  | Machine-readable code (gateway and geocoder errors) |
| `message` | string |  |  |
| `retryAfterSeconds` | integer |  | Present on gateway 429s |
| `retryAfter` | integer |  | Present on geocoder 429s |

### MessageResponse

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `success` | boolean |  |  |
| `message` | string |  |  |

### HealthResponse

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `status` | string (ok \| degraded) |  |  |
| `gateway` | string |  |  |
| `timestamp` | string |  |  |
| `services` | object |  |  |

### User

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `_id` | string |  |  |
| `name` | string |  |  |
| `email` | string |  |  |
| `phone` | string |  |  |
| `role` | string (admin \| fleet_manager \| viewer) |  |  |
| `createdAt` | string |  |  |
| `updatedAt` | string |  |  |

### UserRegistration

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `name` | string | yes |  |
| `email` | string | yes |  |
| `password` | string | yes |  |
| `phone` | string |  |  |
| `role` | string (admin \| fleet_manager \| viewer) |  |  |

### UserLogin

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `email` | string | yes |  |
| `password` | string | yes |  |

### AuthenticationResponse

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `success` | boolean |  |  |
| `data` | object |  |  |

### GPSCoordinates

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `latitude` | number | yes |  |
| `longitude` | number | yes |  |

### Vehicle

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `_id` | string |  |  |
| `vehicleId` | string |  |  |
| `registrationNumber` | string |  |  |
| `vehicleType` | string (truck \| van \| car \| motorcycle \| bus \| other) |  |  |
| `model` | string |  |  |
| `manufacturer` | string |  |  |
| `assignedDriver` | string |  |  |
| `operationalStatus` | string (active \| idle \| maintenance \| inactive) |  |  |
| `address` | string |  |  |
| `location` | GPSCoordinates |  |  |
| `batteryLevel` | number |  |  |
| `createdAt` | string |  |  |
| `updatedAt` | string |  |  |

### VehicleRegistration

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `vehicleId` | string | yes |  |
| `registrationNumber` | string | yes |  |
| `vehicleType` | string (truck \| van \| car \| motorcycle \| bus \| other) | yes |  |
| `model` | string | yes |  |
| `manufacturer` | string | yes |  |
| `assignedDriver` | string |  |  |
| `operationalStatus` | string (active \| idle \| maintenance \| inactive) |  |  |
| `address` | string |  |  |
| `location` | GPSCoordinates |  |  |
| `batteryLevel` | number |  |  |

### VehicleStatusUpdate

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `operationalStatus` | string (active \| idle \| maintenance \| inactive) | yes |  |

### Telemetry

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `_id` | string |  |  |
| `vehicleId` | string | yes |  |
| `latitude` | number | yes |  |
| `longitude` | number | yes |  |
| `speed` | number |  | km/h |
| `engineTemperature` | number |  | °C; > 110 auto-flags ENGINE_FAULT |
| `batteryLevel` | number |  | < 20 auto-flags LOW_BATTERY |
| `eventType` | string (NORMAL \| ENGINE_FAULT \| LOW_BATTERY \| EMERGENCY_STOP) |  |  |
| `timestamp` | string |  |  |

### GeocodingRequest

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `address` | string | yes |  |

### GeocodingResponse

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `latitude` | number |  |  |
| `longitude` | number |  |  |
| `formattedAddress` | string |  |  |
| `provider` | string |  |  |
| `cached` | boolean |  | true when served from cache (no Nominatim request made) |
| `attribution` | string |  |  |

### NearbyVehicleSearch
Query parameters of GET /api/maps/nearby

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `latitude` | number | yes |  |
| `longitude` | number | yes |  |
| `radius` | number | yes | km |

### NearbyVehicle

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `vehicle` | Vehicle |  |  |
| `distance` | number |  | Haversine distance in km |

### Notification

| Field | Type | Required | Notes |
|---|---|:-:|---|
| `_id` | string |  |  |
| `vehicleId` | string |  |  |
| `recipient` | string |  |  |
| `message` | string |  |  |
| `eventType` | string (ENGINE_FAULT \| LOW_BATTERY \| EMERGENCY_STOP \| STATUS_CHANGE) |  |  |
| `provider` | string |  |  |
| `status` | string (sent \| failed) |  |  |
| `failureReason` | string |  |  |
| `timestamp` | string |  |  |

