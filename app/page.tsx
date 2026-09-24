"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Cloud,
  FileText,
  Globe2,
  LocateFixed,
  MapPin,
  Menu,
  Mic,
  Navigation,
  Radio,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Wind,
  X,
} from "lucide-react";

const hotspots = [
  {
    id: 1,
    city: "Delhi NCR",
    area: "Anand Vihar",
    severity: "Critical",
    value: 91,
    reports: 38,
    confidence: 94,
    source: "Traffic + construction dust",
    x: "72%",
    y: "29%",
  },
  {
    id: 2,
    city: "Mumbai",
    area: "Chembur",
    severity: "High",
    value: 76,
    reports: 24,
    confidence: 89,
    source: "Industrial emissions",
    x: "54%",
    y: "57%",
  },
  {
    id: 3,
    city: "Ahmedabad",
    area: "Naroda",
    severity: "High",
    value: 71,
    reports: 19,
    confidence: 86,
    source: "Industrial activity",
    x: "43%",
    y: "48%",
  },
  {
    id: 4,
    city: "Pune",
    area: "Hadapsar",
    severity: "Moderate",
    value: 54,
    reports: 13,
    confidence: 81,
    source: "Traffic + dust",
    x: "51%",
    y: "63%",
  },
  {
    id: 5,
    city: "Kolkata",
    area: "Ballygunge",
    severity: "Moderate",
    value: 49,
    reports: 11,
    confidence: 78,
    source: "Traffic emissions",
    x: "78%",
    y: "49%",
  },
];

const reports = [
  {
    location: "Chembur, Mumbai",
    text: "Heavy smoke observed near industrial area.",
    time: "8 min ago",
    type: "Smoke",
  },
  {
    location: "Anand Vihar, Delhi",
    text: "Dust and poor visibility reported by residents.",
    time: "14 min ago",
    type: "Dust",
  },
  {
    location: "Hadapsar, Pune",
    text: "Strong burning smell reported near road.",
    time: "27 min ago",
    type: "Odour",
  },
];

export default function Home() {
  const [selected, setSelected] = useState(hotspots[1]);
  const [filter, setFilter] = useState("All");
  const [activeNav, setActiveNav] = useState("Overview");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [voiceActive, setVoiceActive] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const visibleHotspots =
    filter === "All"
      ? hotspots
      : hotspots.filter((item) => item.severity === filter);

  function submitReport() {
    if (!reportText.trim()) return;
    setSubmitted(true);
    setReportText("");
  }

  return (
    <main className="min-h-screen bg-[#050914] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050914]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1700px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
              <Globe2 className="h-6 w-6 text-cyan-400" />
            </div>

            <div>
              <h1 className="text-lg font-bold tracking-tight">VayuNetra</h1>
              <p className="text-[11px] text-slate-500">
                Environmental Intelligence
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {["Overview", "Report", "Map", "Insights"].map((item) => (
              <button
                key={item}
                onClick={() => {
                  setActiveNav(item);
                  if (item === "Report") setReportOpen(true);
                }}
                className={`rounded-lg px-4 py-2 text-sm transition ${
                  activeNav === item
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button className="rounded-xl border border-white/10 p-2.5 text-slate-400 transition hover:border-cyan-400/30 hover:text-white">
              <Bell className="h-5 w-5" />
            </button>

            <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-cyan-400 font-bold text-slate-950 sm:flex">
              V
            </div>

            <button className="rounded-xl border border-white/10 p-2.5 text-slate-400 md:hidden">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1700px] px-5 py-6 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-400">
              <Radio className="h-4 w-4" />
              Community Environmental Intelligence
            </div>

            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              India Pollution Intelligence
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Understand community pollution signals by combining citizen
              reports, public environmental data, and satellite-derived
              indicators.
            </p>
          </div>

          <button
            onClick={() => setReportOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            <FileText className="h-4 w-4" />
            Report an Issue
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Active Hotspots", "24", "+8 today", AlertTriangle],
            ["Citizen Reports", "1,284", "+16.4%", FileText],
            ["Areas Monitored", "186", "Across India", Navigation],
            ["AI Confidence", "91%", "Evidence fusion", Sparkles],
          ].map(([label, value, sub, Icon]) => (
            <div
              key={label as string}
              className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:-translate-y-0.5 hover:border-cyan-400/20"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">{label as string}</p>
                <Icon className="h-5 w-5 text-cyan-400/70" />
              </div>

              <div className="mt-4 flex items-end justify-between">
                <p className="text-3xl font-bold">{value as string}</p>
                <span className="text-xs text-emerald-400">{sub as string}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.65fr_0.95fr]">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#080f20]">
            <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-semibold">Community Pollution Map</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Select a hotspot to inspect its evidence
                </p>
              </div>

              <div className="flex gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
                {["All", "Critical", "High", "Moderate"].map((item) => (
                  <button
                    key={item}
                    onClick={() => setFilter(item)}
                    className={`rounded-md px-3 py-1.5 text-xs transition ${
                      filter === item
                        ? "bg-cyan-400 text-slate-950"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative h-[510px] overflow-hidden bg-[#071225]">
              <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.08)_1px,transparent_1px)] [background-size:42px_42px]" />

              <div className="absolute left-[15%] top-[12%] h-[72%] w-[70%] rotate-[-5deg] rounded-[48%] border border-cyan-400/10 bg-cyan-400/[0.025]" />

              <div className="absolute left-6 top-6 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-400 backdrop-blur">
                <div className="flex items-center gap-2">
                  <LocateFixed className="h-3.5 w-3.5 text-cyan-400" />
                  India • Live intelligence view
                </div>
              </div>

              {visibleHotspots.map((spot) => {
                const active = selected.id === spot.id;

                return (
                  <button
                    key={spot.id}
                    onClick={() => setSelected(spot)}
                    style={{ left: spot.x, top: spot.y }}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                  >
                    <span
                      className={`absolute -inset-3 animate-ping rounded-full ${
                        spot.severity === "Critical"
                          ? "bg-red-400/20"
                          : spot.severity === "High"
                            ? "bg-orange-400/20"
                            : "bg-yellow-400/20"
                      }`}
                    />

                    <span
                      className={`relative flex h-5 w-5 items-center justify-center rounded-full border-2 border-white/80 shadow-lg ${
                        spot.severity === "Critical"
                          ? "bg-red-500"
                          : spot.severity === "High"
                            ? "bg-orange-400"
                            : "bg-yellow-400"
                      } ${active ? "scale-150" : ""} transition`}
                    />

                    {active && (
                      <span className="absolute left-1/2 top-7 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-slate-950/95 px-2 py-1 text-[10px] text-white shadow-xl">
                        {spot.area}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="absolute bottom-5 left-5 rounded-xl border border-white/10 bg-slate-950/90 p-3 text-xs backdrop-blur">
                <p className="mb-2 font-medium text-slate-300">Severity</p>
                <div className="space-y-1.5 text-slate-500">
                  <p>?? Critical</p>
                  <p>?? High</p>
                  <p>?? Moderate</p>
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.035]">
            <div className="border-b border-white/10 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-cyan-400">
                    Selected hotspot
                  </p>
                  <h3 className="mt-1 text-xl font-bold">{selected.area}</h3>
                  <p className="text-sm text-slate-500">{selected.city}</p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    selected.severity === "Critical"
                      ? "bg-red-400/10 text-red-400"
                      : selected.severity === "High"
                        ? "bg-orange-400/10 text-orange-400"
                        : "bg-yellow-400/10 text-yellow-400"
                  }`}
                >
                  {selected.severity}
                </span>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-slate-500">Severity index</p>
                  <p className="mt-2 text-2xl font-bold">{selected.value}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-slate-500">Confidence</p>
                  <p className="mt-2 text-2xl font-bold text-cyan-400">
                    {selected.confidence}%
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex justify-between text-xs">
                  <span className="text-slate-500">AI evidence confidence</span>
                  <span className="text-cyan-400">{selected.confidence}%</span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: `${selected.confidence}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/[0.04] p-4">
                <div className="flex gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
                  <div>
                    <p className="text-sm font-semibold">AI evidence summary</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Multiple community signals align with environmental
                      indicators in this area. The current source hint is{" "}
                      <span className="text-slate-200">{selected.source}</span>.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                  Evidence
                </p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2.5">
                    <span className="flex items-center gap-2 text-sm text-slate-300">
                      <CircleUserRound className="h-4 w-4 text-cyan-400" />
                      Citizen reports
                    </span>
                    <span className="text-sm font-semibold">{selected.reports}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2.5">
                    <span className="flex items-center gap-2 text-sm text-slate-300">
                      <Cloud className="h-4 w-4 text-cyan-400" />
                      Environmental signal
                    </span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2.5">
                    <span className="flex items-center gap-2 text-sm text-slate-300">
                      <ShieldCheck className="h-4 w-4 text-cyan-400" />
                      Data confidence
                    </span>
                    <span className="text-xs text-emerald-400">Verified</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setReportOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Investigate this hotspot
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </aside>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Recent Citizen Reports</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Community signals entering the intelligence pipeline
                </p>
              </div>

              <button className="text-xs text-cyan-400 hover:text-cyan-300">
                View all
              </button>
            </div>

            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.location}
                  className="flex gap-4 rounded-xl border border-white/5 bg-black/15 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10">
                    <MessageIcon />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="text-sm font-medium">{report.location}</p>
                      <span className="text-xs text-slate-600">{report.time}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{report.text}</p>
                    <span className="mt-2 inline-block rounded-full bg-white/5 px-2 py-1 text-[10px] text-slate-400">
                      {report.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="mb-5">
              <h3 className="font-semibold">AI Action Center</h3>
              <p className="mt-1 text-xs text-slate-500">
                Recommended next steps from current evidence
              </p>
            </div>

            <div className="space-y-3">
              {[
                "Prioritize inspection around high-confidence hotspots.",
                "Review repeated citizen reports for emerging patterns.",
                "Compare satellite-derived signals with public monitoring data.",
              ].map((item, index) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-xl border border-white/5 bg-black/15 p-4"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-xs font-bold text-cyan-400">
                    {index + 1}
                  </span>
                  <p className="text-xs leading-5 text-slate-400">{item}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#091121] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div>
                <h3 className="text-lg font-semibold">Report a Pollution Issue</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Your report will be prepared for AI analysis.
                </p>
              </div>

              <button
                onClick={() => setReportOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Describe what you are seeing, smelling, or experiencing..."
                className="min-h-36 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setVoiceActive(!voiceActive)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm ${
                    voiceActive
                      ? "border-cyan-400 bg-cyan-400/10 text-cyan-400"
                      : "border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  <Mic className="h-4 w-4" />
                  {voiceActive ? "Listening..." : "Voice Report"}
                </button>

                <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm text-slate-400 hover:text-white">
                  <MapPin className="h-4 w-4" />
                  Add Location
                </button>
              </div>

              {submitted && (
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-400">
                  Report captured. AI processing will be connected next.
                </div>
              )}

              <button
                onClick={submitReport}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
              >
                <Send className="h-4 w-4" />
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function MessageIcon() {
  return (
    <div className="relative">
      <FileText className="h-5 w-5 text-cyan-400" />
      <Wind className="absolute -right-2 -top-2 h-3 w-3 text-cyan-300" />
    </div>
  );
}
