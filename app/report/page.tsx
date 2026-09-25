"use client";

import { useState } from "react";
import { ArrowLeft, Camera, MapPin, Mic, Send, Sparkles, Upload } from "lucide-react";

export default function ReportPage() {
  const [language, setLanguage] = useState("English");
  const [description, setDescription] = useState("");
  const [listening, setListening] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!description.trim()) return;
    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-[#07110f] text-white">
      <header className="border-b border-white/10 bg-[#091613]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold">VayuNetra</h1>
              <p className="text-xs text-white/45">Community Environmental Intelligence</p>
            </div>
          </a>

          <a
            href="/"
            className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5"
          >
            <ArrowLeft size={16} />
            Dashboard
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300">
            <Sparkles size={14} />
            AI-powered citizen reporting
          </div>

          <h2 className="text-4xl font-bold tracking-tight">
            Report an environmental issue
          </h2>

          <p className="mt-4 text-base leading-7 text-white/55">
            Tell VayuNetra what you are experiencing. Your report can help
            identify environmental hotspots and support evidence-based action.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
              <Sparkles size={28} />
            </div>

            <h3 className="mt-6 text-2xl font-semibold">
              Report received
            </h3>

            <p className="mx-auto mt-3 max-w-lg text-white/55">
              Your report is ready for AI analysis. In the next stage,
              Gemini will structure the report, identify the environmental
              issue and extract useful evidence.
            </p>

            <button
              onClick={() => setSubmitted(false)}
              className="mt-7 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300"
            >
              Submit another report
            </button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
              <div className="mb-7">
                <label className="mb-3 block text-sm font-medium text-white/80">
                  What are you experiencing?
                </label>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Example: There is heavy smoke and a strong burning smell near the road. Visibility is getting worse."
                  className="min-h-44 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-emerald-400/40"
                />
              </div>

              <div className="mb-7 grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setListening(!listening)}
                  className={`flex items-center justify-center gap-3 rounded-2xl border p-4 text-sm transition ${
                    listening
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                      : "border-white/10 bg-white/[0.02] text-white/70 hover:bg-white/5"
                  }`}
                >
                  <Mic size={19} />
                  {listening ? "Listening..." : "Report by voice"}
                </button>

                <button className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/70 transition hover:bg-white/5">
                  <Camera size={19} />
                  Add photo
                </button>
              </div>

              <div className="mb-7 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs text-white/45">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                  >
                    <option>English</option>
                    <option>Hindi</option>
                    <option>Marathi</option>
                    <option>Bengali</option>
                    <option>Tamil</option>
                    <option>Telugu</option>
                    <option>Kannada</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs text-white/45">
                    Location
                  </label>
                  <button className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left text-sm text-white/60">
                    <MapPin size={17} />
                    Use my location
                  </button>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!description.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-4 text-sm font-bold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Send size={17} />
                Submit environmental report
              </button>
            </div>

            <aside className="space-y-5">
              <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.04] p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                    <Sparkles size={19} />
                  </div>
                  <div>
                    <h3 className="font-semibold">What AI will do</h3>
                    <p className="text-xs text-white/40">Powered by Gemini</p>
                  </div>
                </div>

                <div className="mt-6 space-y-4 text-sm text-white/60">
                  <p>01 — Understand your report</p>
                  <p>02 — Detect environmental issue</p>
                  <p>03 — Extract severity and evidence</p>
                  <p>04 — Combine with environmental data</p>
                  <p>05 — Help identify community hotspots</p>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
                <div className="flex items-center gap-3 text-white/70">
                  <Upload size={18} />
                  <span className="text-sm font-medium">Privacy note</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-white/40">
                  Only share information relevant to the environmental issue.
                  Personal or sensitive information should not be included.
                </p>
              </div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
