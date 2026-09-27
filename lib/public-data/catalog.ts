import { illustrativeDataset, type PublicDataset } from "./provenance.ts";

export type PublicContextCatalog = {
  demographics: PublicDataset;
  infrastructure: PublicDataset;
  environmentalGroundMonitoring: PublicDataset;
  publicInvestment: PublicDataset;
  illustrativeDevelopmentContext: PublicDataset;
};

const maharashtraDemographics: PublicDataset = {
  value: {
    population: 112374333,
    censusYear: 2011,
    geography: "Maharashtra",
  },
  provenance: {
    publisher: "Office of the Registrar General & Census Commissioner, India",
    sourceUrl: "https://censusindia.gov.in/nada/index.php/catalog/42559",
    retrievedAt: "2026-09-27",
    measuredAt: "2011",
    geographicLevel: "state",
    geographyId: "IN-MH",
    geographyName: "Maharashtra",
    freshness: "stale",
    verification: "verified",
    delivery: "cached",
  },
};

const maharashtraInfrastructure: PublicDataset = {
  value: {
    academicYear: "2024-25",
    totalSchools: 108250,
    schoolsWithLibraryOrReadingCorner: 106653,
    schoolsWithPlayground: 102432,
    schoolsWithDigitalLibrary: 12137,
    schoolsWithGirlsToilet: 104622,
    schoolsWithFunctionalGirlsToilet: 101286,
    schoolsWithBoysToilet: 102177,
    schoolsWithFunctionalBoysToilet: 98061,
    schoolsWithElectricity: 102683,
    schoolsWithFunctionalElectricity: 96200,
    schoolsWithSolarPanel: 21097,
    geography: "Maharashtra",
  },
  provenance: {
    publisher: "Department of School Education & Literacy, Ministry of Education — UDISE+",
    sourceUrl: "https://dashboard.udiseplus.gov.in/report2025/static/media/UDISE%2B2024_25_Booklet_existing.118ba29d4773e6372f72.pdf",
    retrievedAt: "2026-09-27",
    measuredAt: "2024-25",
    geographicLevel: "state",
    geographyId: "IN-MH",
    geographyName: "Maharashtra",
    freshness: "stale",
    verification: "verified",
    delivery: "cached",
  },
};

const maharashtraPublicInvestment: PublicDataset = {
  value: {
    referencePeriod: "March 2026",
    projectCount: 212,
    originalCostCr: 542172.58,
    cumulativeExpenditureCr: 428925.08,
    executionRatio: Number((428925.08 / 542172.58).toFixed(4)),
    geography: "Maharashtra",
  },
  provenance: {
    publisher: "Ministry of Statistics and Programme Implementation — Infrastructure and Project Monitoring Division",
    sourceUrl: "https://ipm.mospi.gov.in/Content/PDF/FlashReport_March_2026.pdf",
    retrievedAt: "2026-09-27",
    measuredAt: "2026-03",
    geographicLevel: "state",
    geographyId: "IN-MH",
    geographyName: "Maharashtra",
    freshness: "stale",
    verification: "verified",
    delivery: "cached",
  },
};

const unavailableGroundMonitoring: PublicDataset = {
  value: null,
  provenance: {
    publisher: null,
    sourceUrl: null,
    retrievedAt: null,
    measuredAt: null,
    geographicLevel: null,
    geographyId: null,
    geographyName: null,
    freshness: "unavailable",
    verification: "unavailable",
    delivery: "unavailable",
  },
};

/** Provider-neutral catalog with real, provenance-tracked Maharashtra snapshots. */
export function getPublicContextCatalog(): PublicContextCatalog {
  return {
    demographics: maharashtraDemographics,
    infrastructure: maharashtraInfrastructure,
    environmentalGroundMonitoring: unavailableGroundMonitoring,
    publicInvestment: maharashtraPublicInvestment,
    illustrativeDevelopmentContext: illustrativeDataset({ status: "Prototype fixture only" }, "Prototype locations"),
  };
}
