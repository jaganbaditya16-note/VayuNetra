# VayuNetra deployment

## Local validation

Use a current supported Node.js LTS runtime and run:

```bash
npm ci
npm run lint
npm run typecheck
npm test
node tests/api-smoke.mjs
npm run build
```

Then verify `GET /api/health` returns `ready: true` when production environment variables are present.

## Zero-cost-first Cloud Run path

The repository is containerized with Node.js 24 and Python 3. Earth Engine runs as a Python subprocess, so a container runtime is the simplest single-service deployment shape.

Recommended settings for a cost-conscious prototype:
- region: `asia-south1` (Mumbai)
- minimum instances: `0`
- keep concurrency conservative while the prototype is under test
- configure secrets through the runtime secret mechanism; do not add them to the image or repository

Google Cloud documents an always-free Cloud Run tier, but usage beyond the free tier and unrelated Google Cloud resources can incur charges. Monitor usage before a public launch.

## Required server configuration

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
VAYUNETRA_INTEGRITY_SECRET
GEMINI_API_KEY
EARTH_ENGINE_PROJECT_ID
```

Earth Engine authentication is expected through Google Application Default Credentials / a runtime service identity with the necessary Earth Engine access. The service identity must never be exposed to browser code.

## Operator setup

Create an operator user in Supabase Auth, then grant its trusted `app_metadata.role` value as `operator`. The `/operator` page uses only the publishable key in the browser and calls the protected server-side operator API.

## Health check

`GET /api/health` never returns credentials. In production it returns HTTP 503 when required Supabase persistence or integrity configuration is missing.
