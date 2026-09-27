# VayuNetra

**Evidence-backed citizen intelligence for community environmental and infrastructure priorities.**

VayuNetra turns fragmented citizen observations into structured evidence, geospatial demand clusters, environmental corroboration and transparent development-priority signals.

## Why this project

The Code for Communities challenge asks for AI systems that can turn citizen voice/text/messaging feedback into actionable infrastructure priorities using geographic, demographic, infrastructure and public-investment context.

VayuNetra focuses that problem on a high-value civic use case: **environmental and public-service infrastructure demand**.

A citizen report is not treated as a policy decision. Gemini structures the report; evidence is fused; a transparent scoring layer exposes why a location deserves further attention; a human authority remains responsible for verification and action.

## End-to-end flow

```text
Citizen text / voice / location
        ↓
Google Gemini
        ↓
Structured demand signal
        ↓
Geospatial clustering
        ↓
Google Earth Engine / Sentinel-5P
        ↓
Public-data / planning context
        ↓
Transparent priority engine
        ↓
Development recommendation + evidence trail
```

## Google technology

- **Gemini API / Google GenAI SDK** — multilingual report understanding and structured extraction.
- **Google Earth Engine / Sentinel-5P** — satellite-derived environmental supporting evidence.
- **Google Cloud Run** — intended production deployment target for the Next.js service.
- **Government Open Data / Census / UDISE+ / MoSPI / PM GatiShakti** — planned/adapter sources for demographic, infrastructure and planning context.

Google documents structured output for Gemini as a way to obtain predictable JSON for extraction, classification and agentic workflows. The application validates model output before using it.

## Current prototype pages

- `/` — command center and evidence map
- `/report` — citizen report intake with location and browser voice support
- `/map` — geospatial evidence inspection
- `/insights` — evidence analytics
- `/priorities` — development-priority engine
- `/sources` — methodology, limitations and data provenance

## Priority engine

The priority engine intentionally does **not** let an LLM silently decide public priorities.

It combines:

- citizen demand intensity
- evidence strength
- infrastructure-gap signal
- population-exposure signal
- investment/planning alignment
- inclusion-need signal

The score is deterministic and explainable. Gemini is responsible for understanding unstructured citizen input; the application logic makes the priority calculation explicit.

### Data coverage and demo-data policy

The original development-context fixtures remain **illustrative** and are excluded from authoritative scoring. In addition, VayuNetra now ships a provenance-tracked **Maharashtra state snapshot** built from official sources:

- Census 2011 population baseline.
- UDISE+ 2024-25 school-infrastructure indicators.
- MoSPI PAIMANA March 2026 project-monitoring data.

These snapshots are cached and marked stale because they are not real-time local feeds. The priority engine applies a 70% contextual freshness discount and labels the resulting context as mixed. It does not claim ward-level accuracy from state-level data.

Useful official source families include:

- Census India / Open Government Data for population and socioeconomic context.
- UDISE+ for education infrastructure.
- MoSPI Infrastructure Statistics for infrastructure indicators.
- PM GatiShakti for integrated infrastructure-project and GIS planning context.
- CPCB/public monitoring feeds for environmental ground evidence.
- Census India / UDISE+ / MoSPI snapshots for verified state-level demographic, infrastructure and planning context.


## BRICS expansion

VayuNetra is **India-implemented today** and keeps country-specific concerns behind adapter contracts rather than hard-coding them into the AI and prioritization pipeline.

| Country | Current state |
| --- | --- |
| India (IN) | **Implemented** — geography validation and the current public-data workflow are active. |
| Brazil (BR) | **Adapter-ready** — country adapter slot is defined; no live Brazil dataset adapter is claimed. |
| Russia (RU) | **Adapter-ready** — country adapter slot is defined; no live Russia dataset adapter is claimed. |
| China (CN) | **Adapter-ready** — country adapter slot is defined; no live China dataset adapter is claimed. |
| South Africa (ZA) | **Adapter-ready** — country adapter slot is defined; no live South Africa dataset adapter is claimed. |

The reusable contract is the same across countries: citizen intake → Gemini structuring → evidence provenance → geospatial clustering → transparent priority scoring → human review. Each country can supply its own authorized administrative geography, demographic/infrastructure sources and public-investment datasets without changing that core pipeline.

## Safety and governance

VayuNetra is a decision-support prototype, not an automated regulatory authority.

It should:

1. preserve source provenance;
2. distinguish citizen reports from measured observations;
3. distinguish satellite indicators from official AQI;
4. surface uncertainty and missing evidence;
5. require human verification before enforcement or public-resource decisions;
6. avoid exposing private citizen location data beyond the intended civic workflow.

## Local development

```bash
npm install
npm run dev
```

The app runs with no configuration at all. Gemini, Supabase and Earth Engine are each
optional in development: without Gemini, reports are classified by the deterministic
fallback; without Supabase, reports are stored in `data/reports.json`.

Report integrity signing also has a development-only fallback. Outside production, when
neither `VAYUNETRA_INTEGRITY_SECRET` nor `GEMINI_API_KEY` is set, the server signs reports
with a fixed placeholder. This matters more than it looks: reports that are not signed are
excluded from hotspots and priority scoring by design, so without a fallback a fresh local
setup appears to accept reports that then never appear on `/map`, `/insights` or
`/priorities`. The placeholder exists only so local development exercises the real
pipeline. `/api/health` reports this as `checks.integrity = "development-placeholder"`.
Production never uses it — production requires a real `VAYUNETRA_INTEGRITY_SECRET` of at
least 32 bytes and returns HTTP 503 without one.

To enable the live providers, copy `.env.example` to `.env.local` and fill in what you need:

```bash
cp .env.example .env.local
openssl rand -hex 32   # a good VAYUNETRA_INTEGRITY_SECRET value
```

Never commit secrets.

## Production direction

A deployment readiness endpoint is available at `/api/health`. It reports only coarse configuration state and returns HTTP 503 in production when required persistence/integrity configuration is missing. It never returns secret values.

The intended cloud architecture is:

```text
Browser
  ↓
Next.js service on Cloud Run
  ├── Gemini
  ├── Supabase / managed persistence
  ├── Earth Engine adapter
  └── public-data adapters
```

Cloud Run supports deploying existing Next.js applications from source. Use a production-compatible Linux/Python execution path for Earth Engine integrations; do not rely on the Windows `py` launcher used by local development.

## Persistence and database security

Report records are stored in `public.vayunetra_reports`. The versioned schema and RLS migration is
[`supabase/migrations/20260927000100_reports_data_governance.sql`](supabase/migrations/20260927000100_reports_data_governance.sql).
Apply it to each Supabase project before deploying the application.

The browser does not read or write the reports table. Public pages call the Next.js API, which
returns a restricted projection. Supabase grants no report-table access to the `anon` role;
authenticated direct reads are limited by RLS to users whose trusted `app_metadata.role` is
`operator`. Citizen submissions go through server validation and use `SUPABASE_SERVICE_ROLE_KEY`,
which must remain server-only. There is no direct public aggregate view because current public
consumers use the API projection.

The migration adopts the existing UUID primary key and adds only missing columns. It preserves
existing rows, evidence JSON, source/status definitions, indexes, and the live category constraint;
the civic category set is not broadened in this phase. Existing table policies are replaced with the
explicit operator-read policy and no anonymous table access.

Production requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. A missing configuration or a
Supabase read/write failure is an error in production and never falls back to `data/reports.json`.
Without Supabase configuration, non-production environments use the local JSON file for development
and tests. A configured Supabase service-role connection can also be used outside production.

Production report signatures require the dedicated `VAYUNETRA_INTEGRITY_SECRET`. It signs the
priority-relevant report fields so direct database edits and unsigned historical rows cannot enter
authoritative scoring. It is independent of `GEMINI_API_KEY`; production priority and submission
operations fail with a configuration error when the dedicated secret is absent. Generate a private
value (for example with `openssl rand -hex 32`) and supply it through the deployment secret manager.
Do not commit it or expose it to browser code. See [`.env.example`](.env.example) for variable names.

Pre-integrity and unsigned records remain available to the history projection but are excluded from
hotspot and priority calculations. This migration does not mark or backfill legacy rows as
validated. They require a future trusted revalidation or explicit reviewed migration before they
can influence scoring.

## Public-data provenance and current availability

The provider-neutral public-data catalog is available at `/api/public-data`. Each dataset reports publisher, URL, retrieval/measurement date, geography, freshness, verification, and delivery mode. The catalog now exposes verified cached Maharashtra snapshots for Census 2011 population, UDISE+ 2024-25 school infrastructure, and MoSPI March 2026 project monitoring. CPCB ground monitoring and PM GatiShakti operational layers remain unavailable as live machine-ingested feeds.

The implemented environmental adapter is Google Earth Engine over ESA Copernicus Sentinel-5P TROPOMI NO₂. The result is a satellite column estimate, not AQI or a ground measurement. The API records retrieval time, measurement window, geographic level, source URL, freshness, and live/cache delivery. No live feed is implied where a source is only a cached snapshot.

See [API documentation](docs/API.md) for request/authorization boundaries, [data provenance policy](docs/DATA_PROVENANCE.md) for dataset status and priority-input rules, and [deployment guidance](docs/DEPLOYMENT.md) for the zero-cost-first Cloud Run path.

## Human review and geographic portability

Citizen reports begin as `reported`. The operator API supports the workflow `reported → under_review → verified/action_needed/rejected → resolved`, controlled transitions, authority assignment text, private notes, escalation, timestamps, and an append-only signed review-event table. Operators authenticate through Supabase Auth and need trusted `app_metadata.role=operator`; the browser has no direct table access. A report marked verified is a human finding; AI recommendations do not authorize government action. The operator API and `/operator` reviewer console provide the workflow. The browser uses only Supabase publishable auth credentials; report data remains server-side behind the operator API.

The local migration filename matches the applied production migration version `20260927100622_human_review_workflow.sql`.

Migration `20260927100622_human_review_workflow.sql` adds the schema and is applied to the linked Supabase project. The `/operator` reviewer console uses the protected operator API; the browser never receives the service-role key. Review history is restricted to server-side service-role access and should be verified after deployment. Existing legacy reports default to unverified.

Geography is represented through country and administrative levels (country, state/province, district, city/municipality, ward/local area) with optional identifiers and names. India (`IN`) is the only implemented adapter. Other BRICS country adapters and boundary/geocoding datasets are future work; no live BRICS coverage is claimed. Priority and hotspot clustering use coordinates when available and validated administrative geography otherwise. Public maps omit precise coordinates and overly detailed geography.

## Runtime, deployment, and security operations

Use a supported Node.js LTS runtime (Node 24 in the Docker and CI configuration) and `npm ci` for deterministic installation. Production requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a dedicated 32-byte-or-longer `VAYUNETRA_INTEGRITY_SECRET`. `GEMINI_API_KEY` enables Gemini; absence is reported as deterministic fallback analysis. Earth Engine requires server runtime credentials and Python dependencies. Never put secrets in `NEXT_PUBLIC_*` variables or source control.

Report/Gemini bodies have explicit byte limits, and provider calls have bounded timeouts. The built-in rate limiter is bounded but process-local: it does not coordinate limits across multiple instances. Use a shared limiter before exposing a horizontally scaled public service to abuse. Local JSON persistence is development-only; production reads/writes require Supabase.

## Implemented, illustrative, and unavailable

- **Implemented:** privacy-safe server projections, server-side Gemini/fallback classification, integrity signatures, Supabase persistence/RLS, Earth Engine Sentinel-5P adapter, explainable priority calculation, human-review API/schema, and India geography validation.
- **Illustrative:** the existing `data/development-context.json` prototype location/context fixture. It is labelled illustrative and excluded from authoritative priority scores.
- **Implemented:** verified cached Maharashtra Census/UDISE+/MoSPI context is provenance-tracked and contributes to scoring with a freshness discount; the original illustrative fixture remains excluded.
- **Unavailable:** live CPCB station data, live Census/UDISE+ APIs, PM GatiShakti operational layers, WhatsApp/SMS provider transport, and live BRICS country adapters.
- **Future integration:** connect licensed/live feeds and approved messaging providers through provider-specific adapters; verified fresh data can then replace the cached state snapshots without changing the scoring contract.

## Competition positioning

**Problem:** citizen demand is fragmented and difficult to prioritize with evidence.

**Solution:** VayuNetra converts unstructured community observations into evidence-backed, explainable development priorities.

**Differentiator:** unlike a feedback chatbot, VayuNetra emphasizes corroboration, provenance, uncertainty and an explicit human-verification step before action.



## Zero-cost deployment path

The repository is designed to stay within free/always-free usage where possible. For the Python-backed Earth Engine process, Cloud Run is the most compatible single-service target because the Docker image contains both Node.js and Python. Google documents an always-free Cloud Run request/compute tier, including 2 million requests/month and free CPU/RAM quotas, but usage above the free tier or unrelated services can incur charges; keep minimum instances at zero and monitor usage.

Before deployment, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAYUNETRA_INTEGRITY_SECRET`, `GEMINI_API_KEY`, and the Earth Engine server credentials in the platform secret manager. Never place service-role or Earth Engine credentials in `NEXT_PUBLIC_*` variables.
