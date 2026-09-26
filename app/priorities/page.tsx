"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Database, MapPin, ShieldCheck, Sparkles, Target } from "lucide-react";
import VayuHeader from "@/components/VayuHeader";

type Priority = {
  id: string;
  location: { city: string; area: string; latitude: number; longitude: number };
  priorityBand: string;
  priorityScore: number;
  demandSignal: number;
  evidenceStrength: number;
  infrastructureGap: number;
  populationExposure: number;
  investmentAlignment: number;
  inclusionNeed: number;
  recommendedProject: string;
  rationale: string[];
  evidenceBasis: string[];
  dataQuality: string;
  contextSources: string[];
};

function bandClass(band: string) {
  if (band === "urgent") return "border-red-400/20 bg-red-400/10 text-red-300";
  if (band === "high") return "border-orange-400/20 bg-orange-400/10 text-orange-300";
  if (band === "emerging") return "border-yellow-400/20 bg-yellow-400/10 text-yellow-300";
  return "border-slate-400/20 bg-slate-400/10 text-slate-300";
}

export default function PrioritiesPage() {
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [loading, setLoading] = useState(true);
  const [disclosure, setDisclosure] = useState("");

  useEffect(() => {
    fetch("/api/priorities")
      .then((response) => response.json())
      .then((data) => {
        setPriorities(Array.isArray(data?.priorities) ? data.priorities : []);
        setDisclosure(String(data?.contextDisclosure ?? ""));
      })
      .catch(() => setPriorities([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#040711] text-slate-100">
      <VayuHeader />
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Command Center
        </Link>

        <header className="mt-8 max-w-4xl">
          <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-400">DEVELOPMENT PRIORITY ENGINE</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            From citizen demand to evidence-backed development priorities
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            VayuNetra combines structured citizen demand with evidence and planning context. The score is transparent and deterministic; Gemini structures the unstructured citizen signal rather than silently deciding public priorities.
          </p>
        </header>

        {disclosure && (
          <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-4 text-xs leading-5 text-amber-200/70">
            {disclosure}
          </div>
        )}

        {loading ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-10 text-center text-xs text-slate-500">Loading priorities…</div>
        ) : priorities.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-10 text-center">
            <Target className="mx-auto h-8 w-8 text-slate-700" />
            <p className="mt-4 text-sm font-semibold">No located demand clusters yet</p>
            <p className="mt-2 text-xs text-slate-600">Submit a citizen report with location to generate an evidence-backed development priority.</p>
            <Link href="/report" className="mt-5 inline-flex rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950">Report an issue</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {priorities.map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-400">PRIORITY PROJECT</p>
                    <h2 className="mt-1 text-xl font-bold">{item.location.area}</h2>
                    <p className="text-sm text-slate-500">{item.location.city}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${bandClass(item.priorityBand)}`}>
                    {item.priorityBand} · {item.priorityScore}/100
                  </span>
                </div>

                <div className="mt-5 rounded-xl border border-cyan-400/10 bg-cyan-400/[0.04] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Recommended intervention</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{item.recommendedProject}</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    ["Demand", item.demandSignal],
                    ["Evidence", item.evidenceStrength],
                    ["Infrastructure gap", item.infrastructureGap],
                    ["Population exposure", item.populationExposure],
                    ["Investment alignment", item.investmentAlignment],
                    ["Inclusion need", item.inclusionNeed],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl bg-black/20 p-3">
                      <p className="text-[10px] text-slate-500">{label as string}</p>
                      <p className="mt-2 text-lg font-bold text-slate-200">{Math.round(Number(value) * 100)}%</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2">
                  {item.rationale.map((line) => (
                    <div key={line} className="flex gap-2 rounded-lg bg-black/15 p-3">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
                      <p className="text-[11px] leading-5 text-slate-500">{line}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {item.evidenceBasis.map((basis) => (
                    <span key={basis} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[9px] text-slate-500">
                      <Database className="h-3 w-3" /> {basis}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4 text-[10px] text-slate-600">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}</span>
                  <span>{item.dataQuality} context</span>
                </div>
              </article>
            ))}
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-cyan-300" />
            <div>
              <h2 className="font-semibold">Why this is different</h2>
              <p className="text-xs text-slate-600">The system does not treat a citizen complaint as a final policy decision.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              ["1. Understand", "Gemini structures multilingual citizen demand."],
              ["2. Corroborate", "Geospatial and environmental evidence strengthen or weaken the signal."],
              ["3. Prioritize", "A transparent scoring layer combines demand, evidence and planning context."],
              ["4. Verify", "Human authorities can inspect the evidence chain before action."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-xl bg-black/20 p-4">
                <p className="text-xs font-semibold">{title}</p>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
