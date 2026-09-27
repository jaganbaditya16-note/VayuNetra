import { illustrativeDataset, unavailableDataset, type PublicDataset } from "./provenance.ts";

export type PublicContextCatalog = {
  demographics: PublicDataset;
  infrastructure: PublicDataset;
  environmentalGroundMonitoring: PublicDataset;
  publicInvestment: PublicDataset;
  illustrativeDevelopmentContext: PublicDataset;
};

/** Provider-neutral catalog: only configured adapters may replace unavailable datasets. */
export function getPublicContextCatalog(): PublicContextCatalog {
  return {
    demographics: unavailableDataset(),
    infrastructure: unavailableDataset(),
    environmentalGroundMonitoring: unavailableDataset(),
    publicInvestment: unavailableDataset(),
    illustrativeDevelopmentContext: illustrativeDataset({ status: "Prototype fixture only" }, "Prototype locations"),
  };
}
