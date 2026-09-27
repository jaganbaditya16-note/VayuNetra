# Data provenance and scoring policy

## Provenance fields

Public datasets use a provider-neutral result envelope with publisher, HTTPS source URL, retrieval date, measurement date, geographic level and identifier/name, freshness, verification state, and delivery (`live`, `cached`, `illustrative`, or `unavailable`). The runtime validator rejects malformed provenance, insecure URLs, and verified claims missing publisher/source/measurement details.

## Available sources

- **Sentinel-5P TROPOMI NO₂ via Google Earth Engine:** live adapter in `/api/environmental` and the hotspot route when the Earth Engine runtime is configured. It is a satellite column estimate, not ground AQI. Results retain the measurement window and label cache delivery and freshness.
- **Citizen observations:** useful as reported claims; they are not measurements or authority findings.
- **Gemini interpretation:** server-side structured extraction, kept distinct from citizen claims and satellite measurements. Fallback classification is marked `local-fallback`.

## Unavailable sources

No fresh, machine-ingested adapter currently supplies CPCB station readings, Census/demographic values, UDISE+ infrastructure data, or PM GatiShakti operational layers. The public catalog exposes official source references and the current prototype keeps those values out of scoring until a validated adapter is configured. The numeric values in `data/development-context.json` are illustrative fixtures and the priority engine ignores them.

Priority scoring uses only verified fresh context with a publisher, HTTPS source, measurement date, and provenance. When that context is unavailable, public-context component weights are omitted and remaining demand/evidence weights are renormalized. Environmental satellite evidence remains a separate evidence class and is considered only when its signed server-generated measurement is from the expected source and is fresh.

## Geography and privacy

`GeographicHierarchy` is provider-neutral and carries country code plus optional identifiers/names at administrative levels. India is the only active adapter (`IN`). Unsupported countries remain unavailable until an adapter is implemented. Citizen-supplied names and identifiers are not authoritative boundaries and are not returned in public report projections. Public map coordinates are rounded; null coordinates remain null.


## Official source registry

The `/api/public-data` response includes official source references for Census India, UDISE+, MoSPI PAIMANA, and PM GatiShakti. These are source references, not a claim that protected or machine-readable operational data are currently ingested. A verified-but-stale Maharashtra planning snapshot from MoSPI March 2026 is retained as provenance evidence and is explicitly excluded from current priority scoring.
