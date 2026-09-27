export type OfficialSourceReference = {
  id: string;
  title: string;
  publisher: string;
  sourceUrl: string;
  scope: string;
  status: "source_verified_not_ingested" | "snapshot_ingested";
  notes: string;
};

export const OFFICIAL_SOURCE_REGISTRY: readonly OfficialSourceReference[] = [
  {
    id: "census-india",
    title: "Census Data & Population Finder",
    publisher: "Office of the Registrar General & Census Commissioner, India",
    sourceUrl: "https://censusindia.gov.in/census.website/en/data",
    scope: "Population, households and socioeconomic indicators at administrative levels.",
    status: "snapshot_ingested",
    notes: "VayuNetra ingests a provenance-tracked Maharashtra population baseline from Census 2011. It is explicitly historical and freshness-discounted rather than treated as a current estimate.",
  },
  {
    id: "udise-plus",
    title: "UDISE+",
    publisher: "Department of School Education & Literacy, Ministry of Education",
    sourceUrl: "https://udiseplus.gov.in/",
    scope: "School profile, infrastructure/facilities, student and teacher information.",
    status: "snapshot_ingested",
    notes: "VayuNetra ingests a cached Maharashtra state infrastructure snapshot from the official UDISE+ 2024-25 booklet, including electricity and functional toilet indicators.",
  },
  {
    id: "mospi-paimana",
    title: "PAIMANA — Infrastructure & Project Monitoring",
    publisher: "Ministry of Statistics and Programme Implementation",
    sourceUrl: "https://ipm.mospi.gov.in/Home/PublicDashboard",
    scope: "Central-sector infrastructure and project monitoring, including state-wise project counts, costs and expenditure.",
    status: "snapshot_ingested",
    notes: "VayuNetra ingests the verified Maharashtra March 2026 project-monitoring snapshot for provenance and context scoring. It is cached and freshness-discounted.",
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
    useInPriorityScoring: true,
    reason: "Official Maharashtra project-monitoring snapshot; used as a state-level planning/execution signal with a 70% freshness-weight discount.",
  },
] as const;
