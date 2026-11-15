# Setup, Running and Testing

## Prerequisites
Node.js 18+ (developed on Node 26), npm, a MongoDB Atlas cluster, and internet access (map tiles and Nominatim).

## Install
```bash
npm run install:all           # root (backend, gateway, tests) + frontend dependencies
cp .env.example .env          # then fill in the values below
```
Required `.env` values: `MONGODB_URI` (include a database name such as `/fleetdb`), `JWT_SECRET`, `GATEWAY_API_KEY`, and `NOMINATIM_USER_AGENT` (identify your app with a contact email).
Every variable is documented in `.env.example` and the main `README.md`. `.env` is git-ignored – never commit it.

## Seed demo data (⚠ wipes the database named in `MONGODB_URI`)
```bash
npm run seed        # 3 users, 12 vehicles (Chhattisgarh), telemetry, sample notifications
```
Logins: `admin@fleet.com / admin123`, `manager@fleet.com / manager123`, `viewer@fleet.com / viewer123`.

## Run (three terminals)
```bash
npm start           # Backend  → http://localhost:5001
npm run gateway     # Gateway  → http://localhost:4000   Swagger UI: /api-docs
npm run frontend    # Frontend → http://localhost:5173
```
Restart `npm run frontend` after changing `GATEWAY_API_KEY`.

## Run the automated tests
```bash
npm test            # Mocha + Chai + Supertest + Sinon, 43 tests
npm run test:watch  # re-run on change
```
- **Database:** an isolated test database (`MONGODB_TEST_URI`, or the main URI with `_test` appended to the database name). The suite refuses to run unless the name contains "test" and differs from the main database; collections are emptied before each test and the database is dropped at the end.
- **No external calls:** Nominatim (axios) and the MockSMS randomness are stubbed with Sinon; no real SMS, no Google Maps.
- **Repeatable:** each test creates its own data; there is no ordering dependency.

| Spec flow | Test file |
|---|---|
| 1 Login + JWT verification | `test/auth.test.js` |
| 2 Vehicle registration + retrieval | `test/vehicle.test.js` |
| 3 Telemetry submission + storage | `test/telemetry.test.js` |
| 4 Status update + notification triggering | `test/notification.test.js` |
| 5 Role-based access control | `test/rbac.test.js` |
| 6 Nearby search with mocked geolocation | `test/nearby.test.js` |
| 7 Gateway API key + rate limiting | `test/gateway.test.js` |
| Extra – Nominatim geocoding | `test/geocoding.test.js` |

## Regenerate the API documentation
```bash
npm run docs:generate     # rewrites documentation/openapi.json and API_REFERENCE.md from the live spec
```

## Deployment
The application has **not** been deployed; there is no deployed link. It runs locally as described above.
