"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  CircleUserRound,
  Cloud,
  Database,
  FileText,
  MapPin,
  Satellite,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import VayuHeader from "@/components/VayuHeader";
import VayuMap from "@/components/VayuMapClient";

type SatelliteEvidence = {
  value?: number | null;
  unit?: string;
  source?: string;
};

type Report = {
  id?: string;
  location?: string;
  summary?: string;
  text?: string;
  category?: string;
  type?: string;
  reportedAt?: string;
};

type RawHotspot = {
  id?: string | number;
  location?: { city?: string; area?: string; latitude?: number; longitude?: number };
  severity?: string;
  confidence?: number;
  reportCount?: number;
  possibleContributors?: string[];
  satelliteEvidence?: SatelliteEvidence;
  isSample?: boolean;
};

type Hotspot = {
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
  isSample?: boolean;
};

const demoHotspots: Hotspot[] = [
  {
    id: "demo-delhi",
    city: "Delhi NCR",
    area: "Anand Vihar",
    latitude: 28.646,
    longitude: 77.316,
    severity: "Critical",
    confidence: 94,
    reports: 38,
    source: "Traffic + construction dust",
    isSample: true,
  },
  {
    id: "demo-mumbai",
    city: "Mumbai",
    area: "Chembur",
    latitude: 19.052,
    longitude: 72.894,
    severity: "High",
    confidence: 89,
    reports: 24,
    source: "Industrial activity",
    isSample: true,
  },
  {
    id: "demo-pune",
    city: "Pune",
    area: "Hadapsar",
    latitude: 18.508,
    longitude: 73.926,
    severity: "Moderate",
    confidence: 81,
    reports: 13,
    source: "Traffic + dust",
    isSample: true,
  },
  {
    id: "demo-ahmedabad",
    city: "Ahmedabad",
    area: "Naroda",
    latitude: 23.052,
    longitude: 72.668,
    severity: "High",
    confidence: 86,
    reports: 19,
    source: "Industrial activity",
    isSample: true,
  },
  {
    id: "demo-kolkata",
    city: "Kolkata",
    area: "Ballygunge",
    latitude: 22.522,
    longitude: 88.365,
    severity: "Moderate",
    confidence: 78,
    reports: 11,
    source: "Traffic emissions",
    isSample: true,
  },
];

const demoReports = [
  {
    id: "demo-r1",
    location: "Chembur, Mumbai",
    text: "Heavy smoke observed near an industrial area.",
    category: "Smoke",
  },
  {
    id: "demo-r2",
    location: "Anand Vihar, Delhi",
    text: "Dust and poor visibility reported by residents.",
    category: "Dust",
  },
  {
    id: "demo-r3",
    location: "Hadapsar, Pune",
    text: "Strong burning smell reported near a road.",
    category: "Odour",
  },
];

function normalizeHotspot(spot: RawHotspot, index: number): Hotspot {
  const latitude = Number(spot?.location?.latitude);
  const longitude = Number(spot?.location?.longitude);

  return {
    id: String(spot?.id ?? `api-${index}`),
    city: String(spot?.location?.city ?? "Reported area"),
    area: String(spot?.location?.area ?? "Citizen hotspot"),
    latitude: Number.isFinite(latitude) ? latitude : 20,
    longitude: Number.isFinite(longitude) ? longitude : 78,
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
    isSample: Boolean(spot?.isSample),
  };
}

function severityTone(severity: string) {
  const value = severity.toLowerCase();
  if (value === "critical")
    return "border-red-400/20 bg-red-400/10 text-red-300";
  if (value === "high")
    return "border-orange-400/20 bg-orange-400/10 text-orange-300";
  return "border-yellow-400/20 bg-yellow-400/10 text-yellow-300";
}

export default function Home() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/hotspots").then((response) => response.json()),
      fetch("/api/report").then((response) => response.json()),
    ])
      .then(([hotspotData, reportData]) => {
        const liveHotspots = Array.isArray(hotspotData?.hotspots)
          ? hotspotData.hotspots.map(normalizeHotspot)
          : [];
        const liveReports = Array.isArray(reportData?.reports)
          ? reportData.reports
          : [];

        const nextHotspots = liveHotspots.length ? liveHotspots : demoHotspots;
        const nextReports = liveReports.length ? liveReports : demoReports;

        setHotspots(nextHotspots);
        setReports(nextReports);
        setSelectedId(nextHotspots[0]?.id);
      })
      .catch(() => {
        setHotspots(demoHotspots);
        setReports(demoReports);
        setSelectedId(demoHotspots[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const liveMode =
    hotspots.length > 0 && hotspots.some((item) => !item.isSample);

  const selected =
    hotspots.find((item) => item.id === selectedId) ?? hotspots[0];

  const visible = useMemo(
    () =>
      filter === "All"
        ? hotspots
        : hotspots.filter((item) => item.severity === filter),
    [filter, hotspots],
  );

  const averageConfidence = hotspots.length
    ? Math.round(
        hotspots.reduce((sum, item) => sum + item.confidence, 0) /
          hotspots.length,
      )
    : 0;

  const actions = selected
    ? [
        selected.confidence < 50
          ? "Collect additional nearby reports before escalating this signal."
          : "Prioritize field verification around this evidence cluster.",
        selected.reports > 1
          ? "Review repeated community observations for a persistent local pattern."
          : "Encourage additional nearby observations to strengthen the evidence.",
        selected.satelliteEvidence
          ? "Cross-check the satellite-derived signal with available ground monitoring."
          : "Connect an environmental monitoring source to strengthen the evidence chain.",
      ]
    : [];

  return (
    <main className="min-h-screen bg-[#040711] text-slate-100">
      <VayuHeader />

      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[radial-gradient(circle_at_80%_10%,rgba(34,211,238,0.12),transparent_28%),linear-gradient(135deg,#091321,#050914_60%,#07121d)] p-6 shadow-2xl sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative max-w-4xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-cyan-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
              COMMUNITY SIGNAL → AI → ENVIRONMENTAL EVIDENCE → ACTION
            </div>

            <h1 className="max-w-4xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Turn scattered environmental signals into{" "}
              <span className="text-cyan-300">evidence-backed hotspots.</span>
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">
              VayuNetra structures multilingual citizen observations with Gemini,
              combines them with satellite-derived indicators and available
              public monitoring data, then exposes the evidence, confidence and
              next action in one operational view.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/report"
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_8px_30px_rgba(34,211,238,0.16)] transition hover:bg-cyan-200"
              >
                <FileText className="h-4 w-4" />
                Report an issue
                <ArrowUpRight className="h-4 w-4" />
              </Link>

              <Link
                href="/map"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
              >
                <MapPin className="h-4 w-4 text-cyan-300" />
                Open evidence map
              </Link>
            </div>
          </div>
        </section>

        {!loading && (
          <div
            className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
              liveMode
                ? "border-emerald-400/15 bg-emerald-400/[0.04]"
                : "border-amber-400/15 bg-amber-400/[0.04]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  liveMode
                    ? "animate-pulse bg-emerald-400"
                    : "bg-amber-400"
                }`}
              />
              <span
                className={
                  liveMode ? "text-emerald-300" : "text-amber-300"
                }
              >
                {liveMode ? "LIVE EVIDENCE" : "DEMO DATA"}
              </span>
              <span className="text-slate-500">
                {liveMode
                  ? "Current API evidence is driving this view."
                  : "Fallback values are clearly separated from live measurements."}
              </span>
            </div>

            <Link
              href="/sources"
              className="font-semibold text-slate-400 hover:text-white"
            >
              View methodology →
            </Link>
          </div>
        )}

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Evidence hotspots", String(hotspots.length), "Current dataset", Target],
            [
              "Citizen reports",
              String(reports.length),
              liveMode ? "Stored observations" : "Demo observations",
              Users,
            ],
            ["Average confidence", `${averageConfidence}%`, "Evidence fusion", ShieldCheck],
            [
              "Satellite-supported",
              String(
                hotspots.filter((item) => Boolean(item.satelliteEvidence)).length,
              ),
              "Current hotspots",
              Satellite,
            ],
          ].map(([label, value, sub, Icon]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 transition hover:border-cyan-400/20 hover:bg-white/[0.04]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  {label as string}
                </span>
                <Icon className="h-4 w-4 text-cyan-400/70" />
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <span className="text-3xl font-bold tracking-tight">
                  {value as string}
                </span>
                <span className="text-[10px] text-slate-600">
                  {sub as string}
                </span>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_380px]">
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#07101d]">
            <div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-400">
                  LIVE EVIDENCE MAP
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  Where community signals are concentrating
                </h2>
              </div>

              <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
                {["All", "Critical", "High", "Moderate"].map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setFilter(item)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                      filter === item
                        ? "bg-cyan-300 text-slate-950"
                        : "text-slate-500 hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <VayuMap
              hotspots={visible}
              selectedId={selectedId}
              onSelect={(item) => setSelectedId(item.id)}
              className="h-[500px] sm:h-[560px]"
            />
          </div>

          {selected && (
            <aside className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-400">
                    SELECTED HOTSPOT
                  </p>
                  <h2 className="mt-1 text-xl font-bold">{selected.area}</h2>
                  <p className="text-sm text-slate-500">{selected.city}</p>
                </div>

                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${severityTone(
                    selected.severity,
                  )}`}
                >
                  {selected.severity}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                  <p className="text-[10px] text-slate-500">AI confidence</p>
                  <p className="mt-2 text-2xl font-bold text-cyan-300">
                    {selected.confidence}%
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                  <p className="text-[10px] text-slate-500">Citizen reports</p>
                  <p className="mt-2 text-2xl font-bold">
                    {selected.reports}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/20 p-4">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
                  <span className="text-slate-500">Evidence strength</span>
                  <span className="text-cyan-300">
                    {selected.confidence}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-300"
                    style={{
                      width: `${Math.min(selected.confidence, 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-3">
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    <CircleUserRound className="h-4 w-4 text-cyan-400" />
                    Citizen observations
                  </span>
                  <b className="text-xs">{selected.reports}</b>
                </div>

                <div className="rounded-xl bg-black/20 px-3 py-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs text-slate-400">
                      <Cloud className="h-4 w-4 text-cyan-400" />
                      Satellite indicator
                    </span>
                    <span className="text-[10px] text-slate-300">
                      {selected.satelliteEvidence ? "Available" : "Unavailable"}
                    </span>
                  </div>
                  {selected.satelliteEvidence && (
                    <p className="mt-2 text-[10px] leading-5 text-slate-500">
                      {Number(selected.satelliteEvidence.value).toExponential(3)}{" "}
                      {selected.satelliteEvidence.unit ?? ""} ·{" "}
                      {selected.satelliteEvidence.source ?? "Satellite source"}
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-black/20 px-3 py-3">
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    <Database className="h-4 w-4 text-cyan-400" />
                    Evidence source hint
                  </span>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {selected.source}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-cyan-400/10 bg-cyan-400/[0.04] p-4">
                <div className="flex gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <p className="text-xs leading-5 text-slate-400">
                    {selected.reports} citizen report
                    {selected.reports === 1 ? "" : "s"} currently support this
                    hotspot alongside{" "}
                    {selected.satelliteEvidence
                      ? "a satellite-derived environmental indicator"
                      : "the available evidence"}
                    . This is decision support, not an official pollution or
                    AQI verdict.
                  </p>
                </div>
              </div>

              <Link
                href={`/map?hotspot=${encodeURIComponent(selected.id)}`}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 py-3 text-xs font-bold text-slate-950 transition hover:bg-cyan-200"
              >
                Open full evidence view
                <ChevronRight className="h-4 w-4" />
              </Link>
            </aside>
          )}
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-400">
                  COMMUNITY SIGNALS
                </p>
                <h2 className="mt-1 font-semibold">
                  Recent reports entering the pipeline
                </h2>
              </div>
              <Link
                href="/report"
                className="text-[11px] font-semibold text-cyan-300 hover:text-cyan-200"
              >
                Submit report →
              </Link>
            </div>

            <div className="mt-4 space-y-2">
              {reports.slice(0, 5).map((report, index) => (
                <div
                  key={String(report.id ?? `${report.location}-${index}`)}
                  className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-black/15 p-3.5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10">
                    <FileText className="h-4 w-4 text-cyan-300" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-slate-200">
                        {report.location ?? "Reported area"}
                      </p>
                      <span className="text-[10px] text-slate-600">
                        {report.reportedAt
                          ? new Date(report.reportedAt).toLocaleString()
                          : "Recent"}
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">
                      {report.summary ??
                        report.text ??
                        "Environmental observation"}
                    </p>

                    <span className="mt-2 inline-flex rounded-full bg-white/5 px-2 py-1 text-[9px] text-slate-500">
                      {report.category ?? report.type ?? "Environmental"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-400">
                AI ACTION CENTER
              </p>
              <h2 className="mt-1 font-semibold">
                Evidence-aware next steps
              </h2>
            </div>

            <div className="mt-4 space-y-2">
              {actions.map((action, index) => (
                <div
                  key={action}
                  className="flex gap-3 rounded-xl border border-white/[0.06] bg-black/15 p-3.5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-[10px] font-bold text-cyan-300">
                    0{index + 1}
                  </span>
                  <p className="text-[11px] leading-5 text-slate-500">
                    {action}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-400">
                THE INTELLIGENCE LOOP
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                One evidence chain, from observation to action
              </h2>
            </div>
            <Link
              href="/sources"
              className="text-xs font-semibold text-slate-400 hover:text-white"
            >
              Read methodology →
            </Link>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {[
              ["01", "Report", "Citizen text, voice and location become structured observations."],
              ["02", "Understand", "Gemini extracts category, severity, summary and possible source hints."],
              ["03", "Fuse", "Citizen evidence is combined with satellite and public monitoring signals."],
              ["04", "Act", "The system exposes confidence and an evidence-aware follow-up action."],
            ].map(([number, title, description]) => (
              <div
                key={number}
                className="rounded-xl border border-white/[0.06] bg-black/15 p-4"
              >
                <span className="text-[10px] font-bold text-cyan-300">
                  {number}
                </span>
                <h3 className="mt-2 text-sm font-semibold">{title}</h3>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}