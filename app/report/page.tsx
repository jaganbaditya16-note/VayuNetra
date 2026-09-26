"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Camera, MapPin, Mic, Send, Sparkles, Upload } from "lucide-react";

type SpeechRecognitionResultLike = {
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  results: { 0: SpeechRecognitionResultLike };
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export default function ReportPage() {
  const [language, setLanguage] = useState("English");
  const [description, setDescription] = useState("");
  const [listening, setListening] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationStatus, setLocationStatus] = useState("");

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("Location is not supported by this browser.");
      return;
    }

    setLocationStatus("Requesting location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        setLocation({
          latitude,
          longitude,
        });

        setLocationStatus(
          `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        );
      },
      (error) => {
        console.error("VayuNetra geolocation error:", {
          code: error.code,
          message: error.message,
        });

        if (error.code === 1) {
          setLocationStatus("Location permission denied.");
        } else if (error.code === 2) {
          setLocationStatus("Location is currently unavailable.");
        } else if (error.code === 3) {
          setLocationStatus("Location request timed out.");
        } else {
          setLocationStatus("Unable to get your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };
  const handleVoiceReport = () => {
    const speechWindow = window as WindowWithSpeechRecognition;
    const SpeechRecognition =
      speechWindow.SpeechRecognition ||
      speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event.results[0][0].transcript;
      setDescription((current) =>
        current ? `${current} ${transcript}` : transcript
      );
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  };
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [analysis, setAnalysis] = useState<{
    category: string;
    severity: string;
    summary: string;
    possibleSources: string[];
    recommendedAction: string;
    confidence: number;
  provider?: "gemini" | "local-fallback";
  providerMessage?: string;
} | null>(null);

  const handleSubmit = async () => {
    if (!description.trim()) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      let environmentalEvidence = null;

      if (location) {
        const environmentalResponse = await fetch(
          `/api/environmental?latitude=${location.latitude}&longitude=${location.longitude}`
        );

        const environmentalData = await environmentalResponse.json();

        if (environmentalResponse.ok && environmentalData.success) {
          environmentalEvidence = environmentalData.satellite ?? null;
        }
      }

      const geminiResponse = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description,
          language,
          location,
          evidence: environmentalEvidence,
        }),
      });

      const geminiData = await geminiResponse.json();

      let reportAnalysis;

      if (!geminiResponse.ok) {
        if (geminiResponse.status !== 429) {
          throw new Error(
            geminiData.error || "Failed to analyze report with Gemini."
          );
        }

        const lowerDescription = description.toLowerCase();

        let category = "other";
        let severity = "moderate";
        let recommendedAction =
          "Review the reported location and consider a local environmental inspection.";

        if (
          lowerDescription.includes("smoke") ||
          lowerDescription.includes("burn") ||
          lowerDescription.includes("burning")
        ) {
          category = "burning";
          recommendedAction =
            "Verify the reported smoke source and, if open burning is confirmed, request local enforcement or mitigation.";
        } else if (
          lowerDescription.includes("dust") ||
          lowerDescription.includes("construction")
        ) {
          category = "dust";
          recommendedAction =
            "Inspect the reported area and consider dust-control measures such as water spraying and construction-site compliance.";
        } else if (
          lowerDescription.includes("traffic") ||
          lowerDescription.includes("vehicle") ||
          lowerDescription.includes("car")
        ) {
          category = "vehicular";
          recommendedAction =
            "Review traffic conditions and consider an inspection of congestion or vehicle-emission sources.";
        } else if (
          lowerDescription.includes("factory") ||
          lowerDescription.includes("industrial")
        ) {
          category = "industrial";
          recommendedAction =
            "Review the nearby industrial area and consider an environmental compliance inspection.";
        } else if (
          lowerDescription.includes("waste") ||
          lowerDescription.includes("garbage")
        ) {
          category = "waste";
          recommendedAction =
            "Inspect the reported waste location and arrange appropriate collection or cleanup.";
        }

        if (
          lowerDescription.includes("severe") ||
          lowerDescription.includes("dangerous") ||
          lowerDescription.includes("unbearable")
        ) {
          severity = "high";
        }

        reportAnalysis = {
          category,
          severity,
          summary: description.trim(),
          possibleSources: [
            "Citizen-reported source; requires verification",
          ],
          recommendedAction,
          confidence: 55,
          provider: "local-fallback",
          providerMessage:
            "Gemini quota is temporarily unavailable; this is a rule-based fallback analysis.",
        };
      } else {
        reportAnalysis = {
          ...geminiData.analysis,
          provider: "gemini",
        };
      }

      console.log("Environmental analysis:", reportAnalysis);
      setAnalysis(reportAnalysis);

      const reportResponse = await fetch("/api/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description,
          language,
          location,
          analysis: reportAnalysis,
        }),
      });

      const reportData = await reportResponse.json();

      if (!reportResponse.ok) {
        throw new Error(
          reportData.error || "Failed to submit report."
        );
      }

      console.log("Stored environmental report:", reportData.report);

      setSubmitted(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to process environmental report."
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="min-h-screen bg-[#07110f] text-white">
      <header className="border-b border-white/10 bg-[#091613]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold">VayuNetra</h1>
              <p className="text-xs text-white/45">Community Environmental Intelligence</p>
            </div>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5"
          >
            <ArrowLeft size={16} />
            Dashboard
          </Link>
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
              Gemini has analyzed your report and extracted environmental evidence.
            </p>

            {analysis && (
              <div className="mx-auto mt-7 max-w-2xl rounded-2xl border border-emerald-400/20 bg-black/20 p-6 text-left">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-emerald-300">
                      {analysis.provider === "local-fallback" ? "Local Fallback Analysis" : "Gemini AI Analysis"}
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      {analysis.provider === "local-fallback" ? analysis.providerMessage : "AI-generated interpretation of the citizen report"}
                    </p>
                  </div>

                  <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                    {analysis.confidence}% confidence
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs text-white/40">Category</p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {analysis.category.replace("_", " ")}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs text-white/40">Severity</p>
                    <p className="mt-1 text-sm font-medium capitalize text-white">
                      {analysis.severity}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs text-white/40">Evidence Summary</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    {analysis.summary}
                  </p>
                </div>

                <div className="mt-4">
                  <p className="text-xs text-white/40">Possible Sources</p>
                  <ul className="mt-2 space-y-2 text-sm text-white/70">
                    {analysis.possibleSources.map((source, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="text-emerald-300">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢</span>
                        <span>{source}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-4">
                  <p className="text-xs text-emerald-300">
                    Recommended Action
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    {analysis.recommendedAction}
                  </p>
                </div>
              </div>
            )}

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
                  onClick={handleVoiceReport}
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
                  <button
                    type="button"
                    onClick={handleUseLocation}
                    className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left text-sm text-white/60 transition hover:bg-white/5"
                  >
                    <MapPin size={17} />
                    {locationStatus || "Use my location"}
                  </button>
                </div>
              </div>
                {analysis && (
                  <div className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                          {analysis.provider === "local-fallback" ? "Local Fallback Analysis" : "Gemini AI Analysis"}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-white">
                          Environmental evidence summary
                        </h3>
                      </div>

                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                        {analysis.confidence}% confidence
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-black/20 p-3">
                        <p className="text-xs text-white/45">Category</p>
                        <p className="mt-1 font-semibold capitalize text-white">
                          {analysis.category.replaceAll("_", " ")}
                        </p>
                      </div>

                      <div className="rounded-xl bg-black/20 p-3">
                        <p className="text-xs text-white/45">Severity</p>
                        <p className="mt-1 font-semibold capitalize text-white">
                          {analysis.severity}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl bg-black/20 p-4">
                      <p className="text-xs text-white/45">AI Summary</p>
                      <p className="mt-1 text-sm leading-6 text-white/80">
                        {analysis.summary}
                      </p>
                    </div>

                    <div className="mt-3 rounded-xl bg-black/20 p-4">
                      <p className="text-xs text-white/45">Possible Sources</p>
                      <ul className="mt-2 space-y-1 text-sm text-white/75">
                        {analysis.possibleSources.map((source, index) => (
                          <li key={index}>ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ {source}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-3 rounded-xl bg-black/20 p-4">
                      <p className="text-xs text-white/45">Recommended Action</p>
                      <p className="mt-1 text-sm leading-6 text-white/80">
                        {analysis.recommendedAction}
                      </p>
                    </div>
                  </div>
                )}
                {submitError && (
                  <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-xs text-red-300">
                    {submitError}
                  </div>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!description.trim() || submitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-4 text-sm font-bold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Send size={17} />
                {submitting ? "Analyzing and submitting…" : "Submit environmental report"}
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
  <p><span className="text-white/35">01</span> Understand your report</p>
  <p><span className="text-white/35">02</span> Classify the environmental issue</p>
  <p><span className="text-white/35">03</span> Identify possible contributing sources</p>
  <p><span className="text-white/35">04</span> Help identify community hotspots</p>
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