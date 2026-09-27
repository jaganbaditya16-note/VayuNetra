# Data provenance and scoring policy

## Provenance fields

Public datasets use a provider-neutral result envelope with publisher, HTTPS source URL, retrieval date, measurement date, geographic level and identifier/name, freshness, verification state, and delivery (`live`, `cached`, `illustrative`, or `unavailable`). The runtime validator rejects malformed provenance, insecure URLs, and verified claims missing publisher/source/measurement details.

## Available sources

- **Sentinel-5P TROPOMI NO₂ via Google Earth Engine:** live adapter in `/api/environmental` and the hotspot route when the Earth Engine runtime is configured. It is a satellite column estimate, not ground AQI. Results retain the measurement window and label cache delivery and freshness.
- **Citizen observations:** useful as reported claims; they are not measurements or authority findings.
- **Gemini interpretation:** server-side structured extraction, kept distinct from citizen claims and satellite measurements. Fallback classification is marked `local-fallback`.

## Current public-data coverage

VayuNetra now includes a provenance-tracked **Maharashtra state snapshot** from three official source families:

- **Census India (2011):** population baseline for Maharashtra. This is historical and is not treated as a current population estimate.
- **UDISE+ 2024-25:** Maharashtra school-infrastructure indicators including electricity and functional toilet coverage.
- **MoSPI PAIMANA, March 2026:** Maharashtra project count, original cost and cumulative expenditure.

The snapshots are cached and explicitly marked stale in the provenance layer because they are not real-time feeds. They can still inform the priority engine through a **70% freshness discount**. The score never treats these state-level values as ward-level measurements.

CPCB ground monitoring, live Census extraction, live UDISE+ APIs, and PM GatiShakti operational layers are still unavailable as live adapters. The public catalog and source registry expose this distinction rather than presenting snapshots as live feeds.

Priority scoring requires verified provenance. Fresh live context receives full contextual weight; verified stale context receives a reduced contextual weight. Illustrative or unavailable context cannot influence the score.

## Geography and privacy

`GeographicHierarchy` is provider-neutral and carries country code plus optional identifiers/names at administrative levels. India is the only active adapter (`IN`). Unsupported countries remain unavailable until an adapter is implemented. Citizen-supplied names and identifiers are not authoritative boundaries and are not returned in public report projections. Public map coordinates are rounded; null coordinates remain null.


## Official source registry

The `/api/public-data` response includes official source references plus the cached Maharashtra Census/UDISE+/MoSPI snapshots. PM GatiShakti remains a source reference only because its restricted operational layers are not treated as public machine-readable data. The MoSPI March 2026 snapshot is used as a state-level planning/execution signal with the same freshness discount as the other cached context.
