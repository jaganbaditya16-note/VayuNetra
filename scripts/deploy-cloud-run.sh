#!/usr/bin/env bash
#
# Deploy VayuNetra to Google Cloud Run.
#
#   Project : vayunetra-509715
#   Region  : asia-south1 (Mumbai)
#   Service : vayunetra
#   Scaling : min 0 / max 2 instances (Cloud Run free tier)
#   Access  : unauthenticated
#
# Secrets are never baked into the image. They are read from your shell
# environment and stored in Secret Manager, then mounted onto the service.
#
# Usage:
#   export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
#          VAYUNETRA_INTEGRITY_SECRET=... GEMINI_API_KEY=...
#   ./scripts/deploy-cloud-run.sh
#
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-vayunetra-509715}"
REGION="${REGION:-asia-south1}"
SERVICE="${SERVICE:-vayunetra}"
REPOSITORY="${REPOSITORY:-vayunetra}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE}"

# ---------------------------------------------------------------------------
# 0. Prerequisites
# ---------------------------------------------------------------------------
if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI not found. Install it from https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found. Cloud Run deploys from a local container build." >&2
  exit 1
fi

echo "==> Authenticating with ${PROJECT_ID}"
gcloud auth configure-docker "${REGION}.docker.pkg.dev" --quiet
gcloud config set project "${PROJECT_ID}"

# ---------------------------------------------------------------------------
# 1. API enablement (idempotent)
# ---------------------------------------------------------------------------
echo "==> Enabling required APIs"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  --quiet

# ---------------------------------------------------------------------------
# 2. Artifact Registry
# ---------------------------------------------------------------------------
echo "==> Ensuring Artifact Registry repository ${REPOSITORY}"
gcloud artifacts repositories describe "${REPOSITORY}" \
  --location="${REGION}" >/dev/null 2>&1 ||
  gcloud artifacts repositories create "${REPOSITORY}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="VayuNetra images" \
    --quiet

# ---------------------------------------------------------------------------
# 3. Secrets
# ---------------------------------------------------------------------------
# Map of env var -> Secret Manager secret id.
SECRET_MAP=(
  "SUPABASE_URL:vayunetra-supabase-url"
  "SUPABASE_SERVICE_ROLE_KEY:vayunetra-supabase-service-role-key"
  "VAYUNETRA_INTEGRITY_SECRET:vayunetra-integrity-secret"
  "GEMINI_API_KEY:vayunetra-gemini-api-key"
  "EARTH_ENGINE_PROJECT_ID:vayunetra-earth-engine-project"
)

put_secret() {
  local env_name="$1" secret_id="$2" value="${!1:-}"
  if [[ -z "${value}" ]]; then
    echo "    - ${env_name} not set; skipping (service will report degraded)"
    return 0
  fi
  printf '%s' "${value}" |
    gcloud secrets create "${secret_id}" \
      --replication-policy=automatic \
      --data-file=- \
      --quiet 2>/dev/null ||
    printf '%s' "${value}" |
      gcloud secrets versions add "${secret_id}" --data-file=- --quiet
  echo "    - ${env_name} -> ${secret_id}"
}

echo "==> Storing secrets in Secret Manager"
for entry in "${SECRET_MAP[@]}"; do
  put_secret "${entry%%:*}" "${entry##*:}"
done

SECRET_ARGS=()
for entry in "${SECRET_MAP[@]}"; do
  env_name="${entry%%:*}"
  secret_id="${entry##*:}"
  if [[ -n "${!env_name:-}" ]]; then
    SECRET_ARGS+=(--set-secrets="${env_name}=projects/${PROJECT_ID}/secrets/${secret_id}:latest")
  fi
done

# ---------------------------------------------------------------------------
# 4. Build
# ---------------------------------------------------------------------------
# The build needs network access for `next/font/google` (Geist) and npm.
echo "==> Building container image"
docker build -t "${IMAGE}:latest" \
  --build-arg NEXT_TELEMETRY_DISABLED=1 \
  -t "${IMAGE}:$(git rev-parse --short HEAD 2>/dev/null || echo latest)" \
  .

echo "==> Pushing image"
docker push "${IMAGE}:latest"
if git rev-parse --short HEAD >/dev/null 2>&1; then
  docker push "${IMAGE}:$(git rev-parse --short HEAD)"
fi

# ---------------------------------------------------------------------------
# 5. Deploy
# ---------------------------------------------------------------------------
echo "==> Deploying ${SERVICE} to ${REGION}"
gcloud run deploy "${SERVICE}" \
  --image="${IMAGE}:latest" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=2 \
  --cpu=1 \
  --memory=2Gi \
  --port=8080 \
  --timeout=60s \
  "${SECRET_ARGS[@]}" \
  --quiet

# ---------------------------------------------------------------------------
# 6. Verify
# ---------------------------------------------------------------------------
URL="$(gcloud run services describe "${SERVICE}" \
  --region="${REGION}" --format='value(status.url)')"

echo
echo "==> Deployed: ${URL}"
echo "==> Readiness:"
curl -sS "${URL}/api/health" || echo "(readiness check not reachable yet)"
echo
