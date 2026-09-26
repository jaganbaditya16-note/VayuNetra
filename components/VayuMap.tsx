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