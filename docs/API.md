# VayuNetra API

All API routes are served by the Next.js application. Public routes do not expose database rows. Public report and map coordinates are rounded to a 0.1-degree grid and report text/provider/evidence payloads are omitted.

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/report` | `GET` | Privacy-safe public report projection. Short shared cache. |
| `/api/report` | `POST` | Citizen submission. Accepts JSON up to 64 KiB or multipart up to 9 MiB (photo max 8 MiB). Server analysis and integrity signature are authoritative. |
| `/api/intake/message` | `POST` | Text intake adapter for `webchat`, `messaging`, `whatsapp`, or `sms` labels. It is not connected to WhatsApp/SMS providers. |
| `/api/gemini` | `POST` | Validated AI classification. JSON up to 64 KiB or multipart up to 9 MiB; rate limited. |
| `/api/priorities` | `GET` | Active, signed demand priorities. Unavailable public datasets do not affect the score. Locations are coarse or administrative labels. |
| `/api/hotspots` | `GET` | Active signed hotspots, using coordinates or supported administrative geography. Satellite output includes provenance and never claims AQI. |
| `/api/environmental` | `GET` | Sentinel-5P point-buffer estimate; requires valid `latitude`, `longitude`, optional ISO `startDate`/`endDate` within ten days. Returns source/freshness/delivery metadata. |
| `/api/public-data` | `GET` | Provider-neutral dataset catalog. Unavailable datasets have null values and explicit unavailable status. |
| `/api/health` | `GET` | Deployment/readiness check. Does not reveal secrets; production returns 503 when required persistence/integrity configuration is missing. |
| `/api/operator/reports` | `GET` | Private operator report queue. Supports `limit` up to 100 and an optional workflow `status` filter. Requires trusted `app_metadata.role=operator`. |
| `/api/operator/reports/{uuid}` | `GET` | Private report and signed review history. Requires a valid Supabase bearer token with trusted `app_metadata.role=operator`. |
| `/api/operator/reports/{uuid}` | `PATCH` | Operator-only status/review update. Body fields: `status`, optional `reviewNotes`, `resolutionNotes`, `assignedAuthority`, `escalated`. Requires migration `20260927100622`. |

The `/operator` reviewer console signs in through Supabase Auth using only the public publishable key; it never receives the service-role key.

The workflow permits `reported → under_review/rejected`, `under_review → verified/action_needed/rejected`, `verified → under_review/action_needed/resolved/rejected`, `action_needed → under_review/resolved/rejected`, and reopening terminal reports to `under_review`. SQL performs a row lock, expected-status check, transition validation, report update, and audit insertion in one transaction.

## Rate limiting

Submission and analysis routes are rate limited per client address: `/api/report` (12/min), `/api/gemini` (30/min), `/api/intake/message` (30/min), `/api/environmental` (30/min), and `/api/hotspots` (20/min). `/api/environmental` and `/api/hotspots` are limited because both can fan out to Earth Engine child processes; `/api/environmental` additionally caps concurrent child processes and queue depth so a caller rotating coordinates to defeat the per-coordinate cache cannot exhaust instance CPU or memory.

The client address is taken from the **right-most** `X-Forwarded-For` hop, because platform proxies such as Google Cloud Run append the real client address as the final entry. Earlier hops are caller-supplied and are ignored, so a client cannot obtain a fresh allowance by sending its own `X-Forwarded-For` value. Callers whose address cannot be identified share a single bucket rather than each receiving an unlimited one. The limiter is process-local and does not coordinate across instances; use a shared limiter before horizontally scaling a public deployment.

## Local development without a dedicated integrity secret

Outside production, when neither `VAYUNETRA_INTEGRITY_SECRET` nor `GEMINI_API_KEY` is set, the server signs reports with a fixed non-production placeholder. This keeps a fresh `npm run dev` fully functional: reports reach hotspots and priorities instead of being silently excluded as unsigned. `/api/health` reports `checks.integrity = "development-placeholder"` and returns a `notice` in that state. These local signatures carry no security weight. Production never uses the placeholder — it fails with HTTP 503 when `VAYUNETRA_INTEGRITY_SECRET` is missing or shorter than 32 bytes.

Submission/channel names do not imply delivery through external messaging providers. AI recommendations are decision support only; authority verification and action remain human responsibilities.
