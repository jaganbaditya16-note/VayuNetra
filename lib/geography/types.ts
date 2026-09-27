export type AdministrativeLevel = "country" | "state_province" | "district" | "city_municipality" | "ward_local_area";
export type GeographicUnit = { level: AdministrativeLevel; identifier: string | null; name: string | null };
export type GeographicHierarchy = { countryCode: string; levels: GeographicUnit[] };
export interface CountryGeographyAdapter {
  countryCode: string;
  normalizeIdentifier(level: AdministrativeLevel, identifier: string): string | null;
  supportedLevels: readonly AdministrativeLevel[];
}

const india: CountryGeographyAdapter = {
  countryCode: "IN",
  supportedLevels: ["country", "state_province", "district", "city_municipality", "ward_local_area"],
  normalizeIdentifier(_level, identifier) {
    const normalized = identifier.trim().toUpperCase();
    return /^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(normalized) ? normalized : null;
  },
};

export const countryGeographyAdapters: Readonly<Record<string, CountryGeographyAdapter>> = { IN: india };

export function validateGeographicHierarchy(value: unknown): GeographicHierarchy | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.countryCode !== "string") return null;
  const countryCode = candidate.countryCode.trim().toUpperCase();
  const adapter = countryGeographyAdapters[countryCode];
  if (!adapter || !Array.isArray(candidate.levels) || candidate.levels.length > 5) return null;
  const levels: GeographicUnit[] = [];
  const seen = new Set<string>();
  for (const item of candidate.levels) {
    if (!item || typeof item !== "object") return null;
    const unit = item as Record<string, unknown>;
    if (typeof unit.level !== "string" || !adapter.supportedLevels.includes(unit.level as AdministrativeLevel) || seen.has(unit.level)) return null;
    seen.add(unit.level);
    if (unit.identifier !== null && typeof unit.identifier !== "string") return null;
    if (unit.name !== null && (typeof unit.name !== "string" || unit.name.length > 120)) return null;
    const identifier = typeof unit.identifier === "string" ? adapter.normalizeIdentifier(unit.level as AdministrativeLevel, unit.identifier) : null;
    if (unit.identifier !== null && identifier === null) return null;
    levels.push({ level: unit.level as AdministrativeLevel, identifier, name: typeof unit.name === "string" ? unit.name.trim() : null });
  }
  return { countryCode, levels };
}
