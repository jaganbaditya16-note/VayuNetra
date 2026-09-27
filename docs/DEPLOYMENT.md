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

Target settings:
- project: `vayunetra-509715`
- region: `asia-south1` (Mumbai)
- service: `vayunetra`
- minimum instances: `0`
- authentication: allow unauthenticated
- concurrency conservative while the prototype is under test
- secrets supplied through the runtime secret mechanism; never added to the image or repository

Google Cloud documents an always-free Cloud Run tier, but usage beyond the free tier and unrelated Google Cloud resources can incur charges. Monitor usage before a public launch.

## Deploying

### Container build from your machine

Requires the gcloud CLI and Docker locally, plus a Google account with access to the project.

```bash
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<server-only-key>"
export VAYUNETRA_INTEGRITY_SECRET="$(openssl rand -hex 32)"
export GEMINI_API_KEY="<gemini-key>"
export EARTH_ENGINE_PROJECT_ID="<earth-engine-project>"

./scripts/deploy-cloud-run.sh
```

The script enables the required APIs, creates the Artifact Registry repository, writes each secret to Secret Manager, builds and pushes the image, deploys with `--allow-unauthenticated --min-instances=0`, and finally prints the service URL and the result of `GET /api/health`.

Secrets you leave unset are simply not mounted, and `/api/health` reports the service as degraded rather than failing the deployment.

### Cloud Build from the repository

`cloudbuild.yaml` builds the same image and deploys it without a local Docker install:

```bash
gcloud builds submit --config cloudbuild.yaml \
  --project vayunetra-509715
```

Note that Cloud Build does not inherit your shell environment. Attach the secrets to the service once, or use Cloud Build's own Secret Manager integration, before relying on this path:

```bash
gcloud run services update vayunetra --region asia-south1 \
  --update-secrets=SUPABASE_URL=vayunetra-supabase-url:latest \
  --project vayunetra-509715
```

### Build-time network requirement

The container build fetches npm packages and the Geist webfont through `next/font/google`. A build environment without outbound access to `fonts.googleapis.com` will fail at the font step; the runtime does not need it. The development server degrades to a fallback font instead of failing.

## Required server configuration

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
VAYUNETRA_INTEGRITY_SECRET
GEMINI_API_KEY
EARTH_ENGINE_PROJECT_ID
```

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `VAYUNETRA_INTEGRITY_SECRET` are required in production; without them the service reports itself not ready and returns HTTP 503 on report, hotspot and priority routes. `GEMINI_API_KEY` and the Earth Engine credentials enable the optional providers and degrade gracefully when absent.

Earth Engine authentication is expected through Google Application Default Credentials / a runtime service identity with the necessary Earth Engine access. The service identity must never be exposed to browser code.

## Operator setup

Create an operator user in Supabase Auth, then grant its trusted `app_metadata.role` value as `operator`. The `/operator` page uses only the publishable key in the browser and calls the protected server-side operator API.

## Health check

`GET /api/health` never returns credentials. In production it returns HTTP 503 when required Supabase persistence or integrity configuration is missing.
