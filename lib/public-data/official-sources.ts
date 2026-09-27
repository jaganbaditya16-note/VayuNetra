export type OfficialSourceReference = {
  id: string;
  title: string;
  publisher: string;
  sourceUrl: string;
  scope: string;
  status: "source_verified_not_ingested";
  notes: string;
};

export const OFFICIAL_SOURCE_REGISTRY: readonly OfficialSourceReference[] = [
  {
    id: "census-india",
    title: "Census Data & Population Finder",
    publisher: "Office of the Registrar General & Census Commissioner, India",
    sourceUrl: "https://censusindia.gov.in/census.website/en/data",
    scope: "Population, households and socioeconomic indicators at administrative levels.",
    status: "source_verified_not_ingested",
    notes: "Official Census data are available through tables, a data API and Population Finder. Values are not pulled into priority scoring until a validated adapter is configured.",
  },
  {
    id: "udise-plus",
    title: "UDISE+",
    publisher: "Department of School Education & Literacy, Ministry of Education",
    sourceUrl: "https://udiseplus.gov.in/",
    scope: "School profile, infrastructure/facilities, student and teacher information.",
    status: "source_verified_not_ingested",
    notes: "Official UDISE+ is a nationwide education management information system with infrastructure/facilities data. No authenticated extraction is required in this prototype; values remain unavailable until a licensed/public adapter is configured.",
  },
  {
    id: "mospi-paimana",
    title: "PAIMANA — Infrastructure & Project Monitoring",
    publisher: "Ministry of Statistics and Programme Implementation",
    sourceUrl: "https://ipm.mospi.gov.in/Home/PublicDashboard",
    scope: "Central-sector infrastructure and project monitoring, including state-wise project counts, costs and expenditure.",
    status: "source_verified_not_ingested",
    notes: "The public dashboard publishes state/project monitoring information. VayuNetra keeps source snapshots separate from live scoring and marks age explicitly.",
  },
  {
    id: "pm-gatishakti",
    title: "PM GatiShakti National Master Plan",
    publisher: "Government of India",
    sourceUrl: "https://gatishakti.mnre.gov.in/home",
    scope: "Integrated multimodal infrastructure planning and cross-sector project context.",
    status: "source_verified_not_ingested",
    notes: "The planning framework provides infrastructure planning context; restricted operational layers should not be treated as public machine-readable data without an authorized access path.",
  },
] as const;

export const VERIFIED_PLANNING_SNAPSHOTS = [
  {
    id: "mospi-maharashtra-march-2026",
    geography: { countryCode: "IN", state: "Maharashtra" },
    value: {
      projectCount: 212,
      originalCostCr: 542172.58,
      cumulativeExpenditureCr: 428925.08,
      referencePeriod: "March 2026",
    },
    provenance: {
      publisher: "Ministry of Statistics and Programme Implementation — Infrastructure and Project Monitoring Division",
      sourceUrl: "https://ipm.mospi.gov.in/Content/PDF/FlashReport_March_2026.pdf",
      retrievedAt: "2026-09-27",
      measuredAt: "2026-03",
      geographicLevel: "state",
      geographyId: "IN-MH",
      geographyName: "Maharashtra",
      freshness: "stale" as const,
      verification: "verified" as const,
      delivery: "cached" as const,
    },
    useInPriorityScoring: false,
    reason: "Official source, but older than the current freshness window; shown for provenance and planning context only until refreshed.",
  },
] as const;
