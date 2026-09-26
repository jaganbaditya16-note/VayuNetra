"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Database,
  Globe2,
  BrainCircuit,
  Satellite,
  ShieldCheck,
  Code2,
  AlertTriangle,
} from "lucide-react";

const sources = [
  {
    title: "Google Earth Engine / Sentinel-5P TROPOMI",
    icon: Satellite,
    description:
      "Used to derive a satellite-based environmental indicator from Sentinel-5P observations. This signal is treated as supporting evidence and is not presented as CPCB AQI.",
  },
  {
    title: "CPCB / Government Open Data",
    icon: Database,
    description:
      "Public air-quality monitoring data can provide ground-based evidence where an official monitoring station is available. CPCB integration is designed as a separate data adapter.",
  },
  {
    title: "Citizen Reports",
    icon: Globe2,
    description:
      "Community-submitted observations provide local context such as smoke, dust, burning smells and other environmental concerns. Reports are treated as evidence rather than definitive measurements.",
  },
  {
    title: "Google Gemini",
    icon: BrainCircuit,
    description:
      "Gemini is used to structure multilingual citizen reports, summarize evidence, identify categories and suggest possible follow-up actions.",
  },
];

export default function SourcesPage() {
  return (
    <main className="min-h-screen bg-[#050914] text-slate-100">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <header className="mt-10 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-xs text-cyan-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Transparency & methodology
          </div>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Data Sources & Methodology
          </h1>

          <p className="mt-4 text-sm leading-6 text-slate-400 sm:text-base">
            VayuNetra combines community observations, public environmental
            information and satellite-derived indicators to identify areas
            that may need further environmental attention.
          </p>
        </header>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          {sources.map((source) => {
            const Icon = source.icon;

            return (
              <article
                key={source.title}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10">
                    <Icon className="h-5 w-5 text-cyan-400" />
                  </div>

                  <div>
                    <h2 className="font-semibold">{source.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {source.description}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <div className="flex items-center gap-3">
            <Code2 className="h-5 w-5 text-cyan-400" />
            <h2 className="font-semibold">How evidence is combined</h2>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              ["01", "Collect", "Citizen reports and available environmental observations."],
              ["02", "Understand", "AI structures multilingual reports into usable evidence."],
              ["03", "Fuse", "Location, citizen evidence and satellite indicators are combined."],
              ["04", "Prioritize", "A confidence-aware hotspot and follow-up action are generated."],
            ].map(([number, title, description]) => (
              <div
                key={number}
                className="rounded-xl border border-white/5 bg-black/20 p-4"
              >
                <span className="text-xs font-semibold text-cyan-400">
                  {number}
                </span>
                <h3 className="mt-2 text-sm font-semibold">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <h2 className="font-semibold">Important limitations</h2>

            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
              <li>
                • Satellite-derived indicators are supporting environmental
                evidence, not direct CPCB AQI measurements.
              </li>
              <li>
                • A citizen report represents a local observation and does not
                independently establish a pollution source.
              </li>
              <li>
                • Possible source labels are hints generated from available
                evidence and should be verified before intervention.
              </li>
              <li>
                • Confidence reflects the available evidence and can change as
                additional reports or monitoring observations arrive.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
              <h2 className="font-semibold">Demo data disclosure</h2>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-400">
              Any fallback hotspot or report shown when live evidence is
              unavailable is demonstration data. It is not presented as a
              real-time environmental measurement.
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Production deployments should connect verified public monitoring
              feeds and comply with the terms, attribution requirements and
              licenses of every external dataset and service used.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <h2 className="font-semibold">Attribution & licensing</h2>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            VayuNetra uses third-party services and datasets whose terms may
            differ by provider and dataset. Dataset-specific attribution and
            license requirements must be retained when data is used or
            redistributed. Open-source dependencies remain subject to their
            respective licenses.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-black/20 p-4 text-sm">
              <span className="text-slate-500">Application code</span>
              <p className="mt-1 font-medium">MIT License</p>
            </div>

            <div className="rounded-xl border border-white/5 bg-black/20 p-4 text-sm">
              <span className="text-slate-500">API credentials</span>
              <p className="mt-1 font-medium">Stored outside source control</p>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-t border-white/10 pt-5 text-xs leading-5 text-slate-500">
          VayuNetra is an environmental decision-support prototype. It does
          not replace official environmental monitoring, regulatory assessment
          or emergency services.
        </footer>
      </div>
    </main>
  );
}
