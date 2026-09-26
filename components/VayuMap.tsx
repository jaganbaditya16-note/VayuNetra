"use client";

import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

export type VayuMapHotspot = {
  id: string;
  city: string;
  area: string;
  latitude: number;
  longitude: number;
  severity: string;
  confidence: number;
  reports: number;
};

function MapCamera({
  selected,
  focusSelected,
}: {
  selected?: VayuMapHotspot | null;
  focusSelected: boolean;
}) {
  const map = useMap();
  const firstSelection = useRef(true);

  useEffect(() => {
    if (!selected || !focusSelected) return;

    if (firstSelection.current) {
      firstSelection.current = false;
      map.setView([selected.latitude, selected.longitude], Math.max(map.getZoom(), 8));
      return;
    }

    map.flyTo(
      [selected.latitude, selected.longitude],
      Math.max(map.getZoom(), 8),
      { duration: 0.65 },
    );
  }, [map, selected, focusSelected]);

  return null;
}

function severityColor(severity: string) {
  const value = severity.toLowerCase();
  if (value === "critical") return "#ef4444";
  if (value === "high") return "#f97316";
  if (value === "moderate") return "#eab308";
  return "#22d3ee";
}

export default function VayuMap({
  hotspots,
  selectedId,
  onSelect,
  className = "h-[620px]",
  focusSelected = false,
}: {
  hotspots: VayuMapHotspot[];
  selectedId?: string;
  onSelect?: (hotspot: VayuMapHotspot) => void;
  className?: string;
  focusSelected?: boolean;
}) {
  const selected = hotspots.find((item) => item.id === selectedId) ?? null;
  const center: LatLngExpression = [22.5, 79];

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      <MapContainer
        center={center}
        zoom={5}
        minZoom={4}
        maxZoom={14}
        scrollWheelZoom
        className="h-full w-full bg-[#07111f]"
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapCamera selected={selected} focusSelected={focusSelected} />

        {hotspots.map((spot) => {
          const active = spot.id === selectedId;

          return (
            <CircleMarker
              key={spot.id}
              center={[spot.latitude, spot.longitude]}
              radius={active ? 12 : 8}
              pathOptions={{
                color: "#ffffff",
                weight: active ? 3 : 2,
                fillColor: severityColor(spot.severity),
                fillOpacity: active ? 0.95 : 0.78,
              }}
              eventHandlers={{
                click: () => onSelect?.(spot),
              }}
            />
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-xl border border-white/10 bg-[#07101f]/90 px-3 py-2 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
          VAYUNETRA EVIDENCE MAP
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          {hotspots.length} hotspot{hotspots.length === 1 ? "" : "s"} in current evidence
        </p>
      </div>

      <div className="absolute bottom-4 left-4 z-[500] rounded-xl border border-white/10 bg-[#07101f]/90 p-3 text-[10px] shadow-xl backdrop-blur-xl">
        <p className="mb-2 font-semibold uppercase tracking-wider text-slate-400">
          Severity
        </p>
        <div className="grid grid-cols-3 gap-3 text-slate-500">
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-red-500" /> Critical
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-orange-500" /> High
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-yellow-400" /> Moderate
          </span>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-[500] rounded-lg border border-white/10 bg-[#07101f]/90 px-2.5 py-1.5 text-[10px] text-slate-400 shadow-xl backdrop-blur-xl">
        © OpenStreetMap contributors
      </div>
    </div>
  );
}