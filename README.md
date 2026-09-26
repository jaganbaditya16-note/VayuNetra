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

### Demo-data policy

The current development-context file contains **illustrative prototype values** so the end-to-end experience can be demonstrated. They are not presented as official statistics.

For operational deployment, these values should be replaced with verified public datasets and live planning feeds. The UI and API expose this distinction instead of disguising sample data as real measurements.

Useful official source families include:

- Census India / Open Government Data for population and socioeconomic context.
- UDISE+ for education infrastructure.
- MoSPI Infrastructure Statistics for infrastructure indicators.
- PM GatiShakti for integrated infrastructure-project and GIS planning context.
- CPCB/public monitoring feeds for environmental ground evidence.

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

Required environment variables include the Gemini API key and any credentials needed by enabled environmental data integrations. Never commit secrets.

## Production direction

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

## Competition positioning

**Problem:** citizen demand is fragmented and difficult to prioritize with evidence.

**Solution:** VayuNetra converts unstructured community observations into evidence-backed, explainable development priorities.

**Differentiator:** unlike a feedback chatbot, VayuNetra emphasizes corroboration, provenance, uncertainty and an explicit human-verification step before action.

