import type { EnvironmentalReading } from "./types";

export function normalizeCpcbReading(input: {
  id?: string;
  city?: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  aqi?: number | null;
  category?: string | null;
  pm25?: number | null;
  pm10?: number | null;
  measuredAt?: string | null;
}): EnvironmentalReading {
  return {
    id: input.id ?? "cpcb-unknown",
    city: input.city ?? "Unknown",
    area: input.area ?? "Unknown",
    latitude: input.latitude ?? 0,
    longitude: input.longitude ?? 0,
    aqi: input.aqi ?? null,
    category: input.category ?? null,
    pm25: input.pm25 ?? null,
    pm10: input.pm10 ?? null,
    source: "CPCB / Government Open Data",
    sourceType: "government",
    measuredAt: input.measuredAt ?? null,
  };
}
