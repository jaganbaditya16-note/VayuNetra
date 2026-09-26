"use client";

import Link from "next/link";
import { ComponentType, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CircleAlert,
  Database,
  FileText,
  Layers3,
  Satellite,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import VayuHeader from "@/components/VayuHeader";

export default function InsightsPage() {
  const [hotspots, setHotspots] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/hotspots").then((response) => response.json()),
      fetch("/api/report").then((response) => response.json()),
    ])
      .then(([hotspotData, reportData]) => {
        setHotspots(
          Array.isArray(hotspotData?.hotspots)
            ? hotspotData.hotspots
            : [],
        );
        setReports(
          Array.isArray(reportData?.reports) ? reportData.reports : [],
        );
      })
      .catch(() => {
        setHotspots([]);
        setReports([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => {
    const confidence = hotspots.length
      ? Math.round(
          (hotspots.reduce(
            (sum, item) => sum + Number(item.confidence ?? 0),
            0,
          ) /
            hotspots.length) *
            100,
        )
      : 0;

    const satellite = hotspots.filter(
      (item) => item.satelliteEvidence,
    ).length;

    const government = hotspots.filter(
      (item) =>
        Array.isArray(item.evidenceBasis) &&
        item.evidenceBasis.some((value: string) =>
          value.toLowerCase().includes("government"),
        ),
    ).length;

    const severity = { critical: 0, high: 0, moderate: 0 };

    hotspots.forEach((item) => {
      const key = String(item.severity ?? "moderate").toLowerCase() as
        | "critical"
        | "high"
        | "moderate";

      if (key in severity) severity[key] += 1;
    });

    const categories = new Map<string, number>();

    reports.forEach((item) => {
      const key = String(
        item.category ?? item.type ?? "Environmental",
      );
      categories.set(key, (categories.get(key) ?? 0) + 1);
    });

    return { confidence, satellite, government, severity, categories };
  }, [hotspots, reports]);

  const categoryList = [...metrics.categories.entries()].sort(
    (a, b) => b[1] - a[1],
  );
  const maxCategory = Math.max(
    1,
    ...categoryList.map(([, value]) => value),
  );

  return (
    <main className="min-h-screen bg-[#040711] text-slate-100">
      <VayuHeader />

      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-2 text-xs text-slate-500 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Command Center
          </Link>

          <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-400">
            EVIDENCE ANALYTICS
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            Insights
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            A transparent view of what the current evidence says, where it is
            concentrated, and where the evidence is still too thin for strong
            conclusions.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([
            ["Hotspots", hotspots.length, "Current fusion output", Target],
            ["Reports", reports.length, "Community observations", Users],
            ["Avg confidence", `${metrics.confidence}%`, "Evidence fusion", ShieldCheck],
            [
              "Satellite coverage",
              `${metrics.satellite}/${hotspots.length || 0}`,
              "Hotspots with satellite evidence",
              Satellite,
            ],
          ] as [
            string,
            string | number,
            string,
            ComponentType<{ className?: string }>
          ][]).map(([label, value, sub, Icon]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"
            >
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">
                  {label as string}
                </span>
                <Icon className="h-4 w-4 text-cyan-400/70" />
              </div>
              <p className="mt-4 text-3xl font-bold">{value as string}</p>
              <p className="mt-1 text-[10px] text-slate-600">
                {sub as string}
              </p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-10 text-center text-xs text-slate-600">
            Loading evidence analytics…
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-cyan-400/10 p-2.5">
                    <BarChart3 className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <h2 className="font-semibold">Severity distribution</h2>
                    <p className="text-[10px] text-slate-600">
                      Current hotspot classification
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    ["Critical", metrics.severity.critical, "bg-red-400"],
                    ["High", metrics.severity.high, "bg-orange-400"],
                    ["Moderate", metrics.severity.moderate, "bg-yellow-400"],
                  ].map(([label, value, color]) => (
                    <div key={String(label)}>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">
                          {label as string}
                        </span>
                        <span className="text-slate-500">
                          {value as number}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full ${color}`}
                          style={{
                            width: `${
                              hotspots.length
                                ? ((value as number) / hotspots.length) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-cyan-400/10 p-2.5">
                    <Layers3 className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <h2 className="font-semibold">Evidence coverage</h2>
                    <p className="text-[10px] text-slate-600">
                      How much evidence supports the current map
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-black/20 p-4">
                    <Satellite className="h-4 w-4 text-cyan-400" />
                    <p className="mt-3 text-xl font-bold">
                      {metrics.satellite}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      Satellite-supported
                    </p>
                  </div>

                  <div className="rounded-xl bg-black/20 p-4">
                    <Database className="h-4 w-4 text-cyan-400" />
                    <p className="mt-3 text-xl font-bold">
                      {metrics.government}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      Government evidence
                    </p>
                  </div>

                  <div className="rounded-xl bg-black/20 p-4">
                    <Users className="h-4 w-4 text-cyan-400" />
                    <p className="mt-3 text-xl font-bold">{reports.length}</p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      Citizen reports
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-cyan-400/10 p-2.5">
                    <FileText className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <h2 className="font-semibold">Report categories</h2>
                    <p className="text-[10px] text-slate-600">
                      Categories in stored community reports
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {categoryList.length ? (
                    categoryList.map(([label, value]) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">{label}</span>
                          <span className="text-slate-500">{value}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-cyan-300"
                            style={{
                              width: `${(value / maxCategory) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-8 text-center text-xs text-slate-600">
                      No report categories available yet.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-cyan-400/10 p-2.5">
                    <Activity className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <h2 className="font-semibold">
                      What the system knows — and does not
                    </h2>
                    <p className="text-[10px] text-slate-600">
                      Evidence-aware interpretation
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.03] p-4">
                    <p className="text-xs font-semibold text-emerald-300">
                      Known from current data
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">
                      Where reports were submitted, how many reports support a
                      cluster, and whether a satellite-derived indicator is
                      available.
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.03] p-4">
                    <p className="text-xs font-semibold text-amber-300">
                      Needs verification
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">
                      Exact pollution source, official AQI status, health impact
                      and regulatory cause should not be inferred from a single
                      citizen report or satellite indicator.
                    </p>
                  </div>

                  <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/[0.03] p-4">
                    <p className="text-xs font-semibold text-cyan-300">
                      Next evidence to add