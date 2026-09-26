"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Crosshair,
  RefreshCw,
  Satellite,
  ShieldCheck,
  Users,
} from "lucide-react";
import VayuHeader from "@/components/VayuHeader";
import VayuMap from "@/components/VayuMapClient";

type SatelliteEvidence = {
  value?: number | null;
  unit?: string;
  source?: string;
  measuredAt?: string | null;
};

type RawHotspot = {
  id?: string | number;
  location?: { city?: string; area?: string; latitude?: number; longitude?: number };
  severity?: string;
  confidence?: number;
  reportCount?: number;
  possibleContributors?: string[];
  satelliteEvidence?: SatelliteEvidence;
  evidenceBasis?: string[];
};

type NormalizedHotspot = {
  id: string;
  city: string;
  area: string;
  latitude: number;
  longitude: number;
  severity: string;
  confidence: number;
  reports: number;
  source: string;
  satelliteEvidence?: SatelliteEvidence;
  evidenceBasis: string[];
};

function normalize(spot: RawHotspot, index: number): NormalizedHotspot {
  return {
    id: String(spot.id ?? `api-${index}`),
    city: String(spot.location?.city ?? "Reported area"),
    area: String(spot.location?.area ?? "Citizen hotspot"),
    latitude: Number(spot.location?.latitude ?? 20),
    longitude: Number(spot.location?.longitude ?? 78),
    severity: String(spot.severity ?? "moderate").replace(
      /^./,
      (value: string) => value.toUpperCase(),
    ),
    confidence: Math.round(Number(spot.confidence ?? 0) * 100),
    reports: Number(spot.reportCount ?? 0),
    source: String(
      spot.possibleContributors?.[0] ?? "Unspecified local source",
    ),
    satelliteEvidence: spot.satelliteEvidence,
    evidenceBasis: Array.isArray(spot.evidenceBasis)
      ? spot.evidenceBasis
      : [],
  };
}

export default function MapPage() {
  const [hotspots, setHotspots] = useState<NormalizedHotspot[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch("/api/hotspots")
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;

        const values = Array.isArray(data?.hotspots)
          ? data.hotspots.map((spot: RawHotspot, index: number) =>
              normalize(spot, index),
            )
          : [];

        setHotspots(values);

        const requestedId =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("hotspot")
            : null;

        setSelectedId(
          requestedId && values.some((item) => item.id === requestedId)
            ? requestedId
            : values[0]?.id,
        );
      })
      .catch(() => {
        if (!active) return;
        setHotspots([]);
        setSelectedId(undefined);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

    const visible = useMemo(
    () =>
      filter === "All"
        ? hotspots
        : hotspots.filter((item) => item.severity === filter),
    [filter, hotspots],
  );

  const selected =
    hotspots.find((item) => item.id === selectedId) ?? hotspots[0];

  return (
    <main className="min-h-screen bg-[#040711] text-slate-100">
      <VayuHeader />

      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-2 text-xs text-slate-500 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Command Center
            </Link>

            <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-400">
              GEOSPATIAL EVIDENCE LAYER
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              Evidence Map
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Explore hotspot coordinates returned by the fusion API. Select a
              marker to inspect the evidence chain instead of treating the map
              as an AQI display.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.07]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh evidence
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1.5">
          {["All", "Critical", "High", "Moderate"].map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                filter === item
                  ? "bg-cyan-300 text-slate-950"
                  : "text-slate-500 hover:text-white"
              }`}
            >
              {item}