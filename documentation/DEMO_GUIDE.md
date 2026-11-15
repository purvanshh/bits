# Demonstration Guide

A scripted walkthrough of the six demonstrations. Everything runs locally; nothing is deployed, no real SMS is sent.
Allow ~20 minutes. Real screenshots from a previous run are in `../screenshots/` (see `../screenshots/README.md`); retake them with the steps at the end if you wish. The application is not deployed (no live link).

## 0. Preparation (once)

```bash
npm run install:all
cp .env.example .env      # fill MONGODB_URI, JWT_SECRET, GATEWAY_API_KEY, NOMINATIM_USER_AGENT
npm run seed              # ⚠ wipes the database named in MONGODB_URI, then loads demo data
```

Start three terminals (leave them visible – the backend terminal shows the `[MockSMS]` lines):

```bash
npm start            # Terminal 1 – Backend  :5001
npm run gateway      # Terminal 2 – Gateway  :4000
npm run frontend     # Terminal 3 – Frontend :5173
```

Open a fourth terminal for curl and set up variables:

```bash
export GW=http://localhost:4000
export KEY=<your GATEWAY_API_KEY>
export TOKEN=$(curl -s $GW/api/users/login -H "x-api-key: $KEY" -H 'Content-Type: application/json' \
  -d '{"email":"admin@fleet.com","password":"admin123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.token')
```

Sanity check: `curl -s $GW/health` should show `"status":"ok"` with five services.

---

## DEMO 1 – Vehicle geolocation

1. Browse to <http://localhost:5173> and sign in as **admin@fleet.com / admin123**.
2. Click **Vehicles** in the sidebar. Show the 12 seeded vehicles; type `CG04K` in the search box and use the status filter (e.g. *Active*).
3. Click a registration number to open the vehicle details: note the latitude/longitude, battery and latest telemetry.
4. *(Optional, uses Nominatim once)* In **Set location from address** enter `Bilaspur Junction Railway Station, Chhattisgarh, India` → **Geocode & save**. The message shows the saved coordinates and the OpenStreetMap attribution. Repeating the same address is served from cache (`cached`), so Nominatim is not called again.
5. Click **Live map**. Point out:
   - multiple markers with different colours (legend chips above the map: Active / Idle / Maintenance / Inactive; click a chip to filter);
   - OpenStreetMap tiles and the attribution at the bottom-right of the map;
   - click a marker → popup with registration number, status, type, GPS coordinates;
   - the **Vehicle information** panel and the vehicle list on the right (click an entry to fly to it);
   - zoom with the scroll wheel / +− buttons and pan by dragging.

## DEMO 2 – Nearby vehicles

1. On **Live map**, in **Nearby vehicle search** enter latitude `21.2514`, longitude `81.6296` (Raipur), radius `50` km → **Search**.
2. Expected with the seed data: **VH001 (0 km), VH002 (≈26.4 km), VH003 (≈36.4 km)**, each with registration, status badge, coordinates and distance. The map shows a circle for the radius and a red centre marker; click a result to fly to the vehicle.
3. Explain: the distance is computed by the backend Haversine implementation (`src/utils/haversine.js`); the UI only displays it.
4. Click **Pick**, then click anywhere on the map to set the centre, and search again.
5. Empty state: search latitude `0`, longitude `0`, radius `5` → "No vehicles in range".
6. Same result from the API:
   ```bash
   curl -s "$GW/api/maps/nearby?latitude=21.2514&longitude=81.6296&radius=50" -H "x-api-key: $KEY" -H "Authorization: Bearer $TOKEN"
   ```

## DEMO 3 – MockSMS

1. Open **Notifications**. Note the existing seeded entries.
2. In **Simulate a critical event** choose a vehicle and click **Engine fault**. (This submits real telemetry to `POST /api/telemetry` with an engine temperature of 125 °C.)
3. Within about a second a new row appears at the top: vehicle ID, recipient (`ADMIN_PHONE`), message, event type, timestamp, and **Sent** or **Failed**.
4. Look at **Terminal 1** – a line like
   `[MockSMS] TO: +919999999999 | MSG: ALERT: Engine fault on vehicle VH001. Speed: …` is the "SMS". (A failed attempt prints nothing there, because the mock provider threw before "sending".)
5. Click **Low battery** and **Emergency stop** a few times. The mock provider fails ~15% of the time by design, so after several clicks you will see at least one **Failed** row with its failure reason ("MockSMS: network timeout (simulated failure)"). Use the status filter to show *Sent* vs *Failed*, and the event-type filter.
6. Show it is stored in MongoDB: Atlas → *Browse Collections* → database `fleetdb` → `notifications`. Show a document with `provider: "MockSMS"`, `status`, `failureReason`.
7. Optional: **Telemetry** page → *Telemetry simulator* → set battery `10` with *Auto-detect* → a LOW_BATTERY notification is created automatically.

## DEMO 4 – API Gateway

Valid key:

```bash
curl -s -i $GW/api/vehicles -H "x-api-key: $KEY" -H "Authorization: Bearer $TOKEN" | head -20      # 200
```

Invalid / missing key:

```bash
curl -s -i $GW/api/vehicles -H "x-api-key: wrong"      # 401 INVALID_API_KEY
curl -s -i $GW/api/vehicles                            # 401 MISSING_API_KEY
```

Two layers: with a valid key but no JWT you get a *backend* 401 (`No token provided`); a viewer deleting a vehicle gets a *backend* 403.

Rate limiting – stop the gateway (Terminal 2) and restart it with a low limit:

```bash
RATE_LIMIT_MAX=5 npm run gateway
for i in $(seq 1 8); do curl -s -o /dev/null -w "%{http_code} " $GW/api/vehicles -H "x-api-key: wrong"; done; echo
curl -s -i $GW/api/vehicles -H "x-api-key: wrong" | head -12     # 429 + RateLimit-Limit / RateLimit-Remaining / Retry-After
curl -s -o /dev/null -w "health: %{http_code}\n" $GW/health        # still 200 – health checks are not limited
```

Expected: `401 401 401 401 401 429 429 429`. Restart the gateway normally (`npm run gateway`) afterwards.
Also show `curl -s $GW/health` (per-service status, no secrets).

## DEMO 5 – Swagger

1. Open <http://localhost:4000/api-docs>. Show the tags (Users, Vehicles, Telemetry, Geolocation, Notifications) and expand an endpoint to show parameters, request body, example responses, required roles and error responses; scroll to *Schemas*.
2. Click **Authorize**: enter the API key under `ApiKeyAuth` → *Authorize*.
3. Run **POST /api/users/login** → *Try it out* → body `{"email":"admin@fleet.com","password":"admin123"}` → *Execute*. Copy `data.token`.
4. **Authorize** again: paste the token under `BearerAuth`.
5. Run **GET /api/vehicles** → *Execute* → 200 with the vehicle list. Run **DELETE /api/vehicles/{vehicleId}** with a non-existent ID `NOPE` to show a 404; point out it requires the admin role.
6. Raw spec: <http://localhost:4000/api-docs.json>.

## DEMO 6 – Automated testing

```bash
npm test
```

Show the eight groups (TEST 1 … TEST 8) executing and the final `43 passing` summary. Mention that it uses an isolated database (`fleetdb_test`, dropped afterwards), mocks Nominatim and the SMS randomness, and never calls external services. `npm run test:watch` re-runs on file changes.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Login page says "Cannot reach the API gateway" | Start the gateway (`npm run gateway`) and backend (`npm start`) |
| `API key is required` / 401 from the dashboard | `GATEWAY_API_KEY` missing in `.env` – set it and **restart `npm run frontend`** |
| "Too many requests" in the UI | Gateway rate limit hit – wait for the window or raise `RATE_LIMIT_MAX` |
| Backend 403 with `Server: AirTunes` | Something else owns the port (macOS AirPlay uses 5000) – use `PORT=5001` |
| Geocoding says rate-limited | Nominatim is throttling you – wait for the `Retry-After` time |
| Empty dashboard | Run `npm run seed` |

## Capturing screenshots

Real screenshots only – take them from your own running instance and save them in `../screenshots/` using the names in
`../screenshots/README.md`.

- **macOS:** `Cmd+Shift+4` then `Space` (click a window), or `Cmd+Shift+5` for the toolbar. Files land on the Desktop – move/rename them.
- **Windows:** `Win+Shift+S`. **Linux:** `gnome-screenshot -a` or `flameshot gui`.
- Browser pages: use a ~1440×900 window; for full-page captures use DevTools → `Cmd/Ctrl+Shift+P` → "Capture full size screenshot".
- Terminal output (gateway 401/429, `npm test`): capture the terminal window after running the commands above.
- Before capturing anything that shows configuration, make sure **no secrets** (`JWT_SECRET`, `GATEWAY_API_KEY`, the Mongo password in a connection string) are visible.
