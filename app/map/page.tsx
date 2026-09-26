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

function normalize(spot: any, index: number) {
  return {
    id: String(spot?.id ?? `api-${index}`),
    city: String(spot?.location?.city ?? "Reported area"),
    area: String(spot?.location?.area ?? "Citizen hotspot"),
    latitude: Number(spot?.location?.latitude ?? 20),
    longitude: Number(spot?.location?.longitude ?? 78),
    severity: String(spot?.severity ?? "moderate").replace(
      /^./,
      (value: string) => value.toUpperCase(),
    ),
    confidence: Math.round(Number(spot?.confidence ?? 0) * 100),
    reports: Number(spot?.reportCount ?? 0),
    source: String(
      spot?.possibleContributors?.[0] ?? "Unspecified local source",
    ),
    satelliteEvidence: spot?.satelliteEvidence,
    evidenceBasis: Array.isArray(spot?.evidenceBasis)
      ? spot.evidenceBasis
      : [],
  };
}

export default function MapPage() {
  const [hotspots, setHotspots] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);

    fetch("/api/hotspots")
      .then((response) => response.json())
      .then((data) => {
        const values = Array.isArray(data?.hotspots)
          ? data.hotspots.map(normalize)
          : [];

        setHotspots(values);

        const requestedId =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("hotspot")
            : null;

        setSelectedId(
          requestedId && values.some((item: any) => item.id === requestedId)
            ? requestedId
            : values[0]?.id,
        );
      })
      .catch(() => {
        setHotspots([]);
        setSelectedId(undefined);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
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
            </button>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_390px]">
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#07101d] p-1">
            <VayuMap
              hotspots={visible}
              selectedId={selected?.id}
              onSelect={(item) => setSelectedId(item.id)}
              className="h-[620px] lg:h-[720px]"
              focusSelected
            />
          </div>

          <aside className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
            {!selected ? (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
                <Crosshair className="h-8 w-8 text-slate-700" />
                <p className="mt-4 text-sm font-semibold">
                  No hotspot evidence available
                </p>
                <p className="mt-2 max-w-xs text-xs leading-5 text-slate-600">
                  Submit a report with a permitted location or connect another
                  evidence source to populate the map.
                </p>
                <Link
                  href="/report"
                  className="mt-5 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950"
                >
                  Report an issue
                </Link>
              </div>
            ) : (
              <>
                <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-400">
                  HOTSPOT EVIDENCE
                </p>

                <div className="mt-2 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">{selected.area}</h2>
                    <p className="text-sm text-slate-500">{selected.city}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold">
                    {selected.severity}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-black/20 p-4">
                    <p className="text-[10px] text-slate-500">Confidence</p>
                    <p className="mt-2 text-2xl font-bold text-cyan-300">
                      {selected.confidence}%
                    </p>
                  </div>
                  <div className="rounded-xl bg-black/20 p-4">
                    <p className="text-[10px] text-slate-500">Reports</p>
                    <p className="mt-2 text-2xl font-bold">
                      {selected.reports}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="rounded-xl bg-black/20 p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs text-slate-400">
                        <Users className="h-4 w-4 text-cyan-400" />
                        Citizen evidence
                      </span>
                      <span className="text-xs font-semibold">
                        {selected.reports}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-black/20 p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs text-slate-400">
                        <Satellite className="h-4 w-4 text-cyan-400" />
                        Satellite evidence
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {selected.satelliteEvidence
                          ? "Available"
                          : "Unavailable"}
                      </span>
                    </div>

                    {selected.satelliteEvidence && (
                      <>
                        <p className="mt-2 text-xs font-semibold text-slate-200">
                          {Number(
                            selected.satelliteEvidence.value,
                          ).toExponential(4)}{" "}
                          {selected.satelliteEvidence.unit ?? ""}
                        </p>
                        <p className="mt-1 text-[10px] leading-5 text-slate-600">
                          {selected.satelliteEvidence.source ??
                            "Satellite source"}{" "}
                          ·{" "}
                          {selected.satelliteEvidence.measuredAt ??
                            "Measurement period unavailable"}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="rounded-xl bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <ShieldCheck className="h-4 w-4 text-cyan-400" />
                      Evidence basis
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selected.evidenceBasis.length ? (
                        selected.evidenceBasis.map((item: string) => (
                          <span
                            key={item}
                            className="rounded-full bg-white/5 px-2 py-1 text-[9px] text-slate-500"
                          >
                            {item}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-600">
                          No basis metadata returned.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-cyan-400/10 bg-cyan-400/[0.04] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                    Decision support
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Confidence is derived from available evidence. A satellite
                    indicator is not equivalent to CPCB AQI and possible source
                    hints require verification.
                  </p>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
