# Screenshots – Assignment 2 deliverable 5

All images are **real captures** of the running application (Brave browser driven over the DevTools protocol), taken
on 15 Nov 2026 against the local stack. Nothing is mocked up. The stack was started with a throwaway demo API key
(`demo-api-key-123`), so no real secret appears in any image or file here.

| Required demonstration | Folder | Files |
|---|---|---|
| **Vehicle geolocation and nearby vehicle retrieval** | `1-geolocation-and-nearby-vehicles/` | `04-map-markers-popup.png` – OSM map, colour-coded markers, popup with registration/status/GPS · `05-nearby-vehicles-search.png` – 50 km search around Raipur: 0.00 / 26.44 / 36.37 km (backend Haversine) with radius circle · `03-vehicle-detail-geocoded.png` – address obtained from Nominatim and saved with GPS coordinates · `01-dashboard.png`, `02-vehicles-list.png` |
| **SMS notification for a vehicle event / status change** | `2-sms-notifications/` | `06-sms-notifications-sent-failed.png` – engine fault / low battery / emergency stop alerts and a status-change message, with both **Sent** and **Failed** states · `mocksms-console-log.txt` – the `[MockSMS]` lines from the backend console · `notifications-stored-in-mongodb.json` – the stored records (`provider`, `status`, `failureReason`) |
| **API Gateway routing and API-key verification** | `3-api-gateway/` | `07-gateway-health.png` – gateway + five services · `08-gateway-missing-api-key-401.png` · `12-swagger-execute-invalid-key-401.png` – wrong key → 401 `INVALID_API_KEY` · `11-swagger-execute-vehicles-200.png` – valid key + JWT routed to the Vehicle service → 200 · `09-gateway-rate-limit-429.png` – rate limit → 429 · `curl-output.txt` – the same checks as terminal output (401, 200, `401 401 401 401 429 429 429 429`) |
| **Swagger UI documentation** | `4-swagger-ui/` | `10-swagger-ui-overview.png` – all documented endpoints by service, the two security layers · `11-…-200.png` / `12-…-401.png` – requests executed from Swagger UI after Authorize |
| Extra | `extra/` | `00-login.png` · `npm-test-output.txt` – full run: **43 passing** |

Notes
- The rate-limit images/output come from a second gateway instance started with `RATE_LIMIT_MAX=4` (default is 200 per 15 min) so the limit can be reached quickly.
- The JWT visible in the Swagger `curl` display belongs to the seeded demo admin and expires after 24 h.
- To retake any screenshot yourself, follow `documentation/DEMO_GUIDE.md`.
