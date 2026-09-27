"use client";

import { FormEvent, useEffect, useState } from "react";

const WORKFLOW = {
  reported: ["under_review", "rejected"],
  under_review: ["verified", "action_needed", "rejected"],
  verified: ["under_review", "action_needed", "resolved", "rejected"],
  action_needed: ["under_review", "resolved", "rejected"],
  resolved: ["under_review"],
  rejected: ["under_review"],
} as const;

type Status = keyof typeof WORKFLOW;

type Report = {
  id: string;
  created_at: string;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category: string;
  severity: string;
  summary?: string | null;
  status: Status;
  verification_status?: string | null;
  assigned_authority?: string | null;
  review_notes?: string | null;
  resolution_notes?: string | null;
  escalated?: boolean;
  reviewed_at?: string | null;
  resolved_at?: string | null;
  geography?: unknown;
};

type Event = {
  id: string;
  previous_status: string;
  next_status: string;
  event_at: string;
  review_notes?: string | null;
  resolution_notes?: string | null;
  assigned_authority?: string | null;
  escalated: boolean;
  signatureValid: boolean;
};

function supabaseConfig() {
  return {
    url: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, ""),
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  };
}

export default function OperatorPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : sessionStorage.getItem("vayunetra.operator.access_token"),
  );
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState<Status>("reported");
  const [reviewNotes, setReviewNotes] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [assignedAuthority, setAssignedAuthority] = useState("");
  const [escalated, setEscalated] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const config = supabaseConfig();
  const nextStatuses: readonly string[] = selected ? WORKFLOW[selected.status] : [];


  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (!config.url || !config.key) throw new Error("Supabase public configuration is missing.");
      const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: config.key, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok || !body.access_token) throw new Error(body?.msg || body?.error_description || "Sign-in failed.");
      sessionStorage.setItem("vayunetra.operator.access_token", body.access_token);
      setToken(body.access_token);
      setPassword("");
      setMessage("Signed in. Verifying operator role…");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function loadReports(accessToken = token) {
    if (!accessToken) return;
    setBusy(true);
    try {
      const response = await fetch("/api/operator/reports?limit=100", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Could not load reports.");
      const nextReports = Array.isArray(body.reports) ? body.reports : [];
      setReports(nextReports);
      if (selected) {
        const refreshed = nextReports.find((item: Report) => item.id === selected.id);
        if (refreshed) setSelected(refreshed);
      }
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load reports.");
    } finally {
      setBusy(false);
    }
  }

  async function openReport(report: Report) {
    if (!token) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/operator/reports/${report.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Could not load report.");
      setSelected(body.report);
      setEvents(Array.isArray(body.events) ? body.events : []);
      setStatus(body.report.status);
      setReviewNotes(body.report.review_notes ?? "");
      setResolutionNotes(body.report.resolution_notes ?? "");
      setAssignedAuthority(body.report.assigned_authority ?? "");
      setEscalated(body.report.escalated === true);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load report.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    // This effect synchronizes the authenticated session with the remote operator queue.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReports(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function applyReview(event: FormEvent) {
    event.preventDefault();
    if (!token || !selected) return;
    if (!nextStatuses.includes(status)) {
      setMessage("Choose a permitted next status.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/operator/reports/${selected.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNotes: reviewNotes || null, resolutionNotes: resolutionNotes || null, assignedAuthority: assignedAuthority || null, escalated }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Review update failed.");
      setMessage(`Report moved to ${status.replaceAll("_", " ")}.`);
      await openReport({ ...selected, status });
      await loadReports(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review update failed.");
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    sessionStorage.removeItem("vayunetra.operator.access_token");
    setToken(null);
    setReports([]);
    setSelected(null);
    setEvents([]);
    setMessage("Signed out.");
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-[#050914] px-4 py-14 text-white">
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">VayuNetra</p>
          <h1 className="mt-3 text-2xl font-semibold">Authority review console</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Sign in with a Supabase Auth account whose trusted app metadata role is <code className="text-cyan-200">operator</code>.
            Citizen accounts cannot access this console.
          </p>
          <form onSubmit={signIn} className="mt-7 space-y-4">
            <label className="block text-sm">
              <span className="text-slate-400">Email</span>
              <input className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 outline-none focus:border-cyan-400/50" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" required />
            </label>
            <label className="block text-sm">
              <span className="text-slate-400">Password</span>
              <input className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 outline-none focus:border-cyan-400/50" value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required />
            </label>
            <button disabled={busy} className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          {message && <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">{message}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050914] px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Human authority workflow</p>
            <h1 className="mt-2 text-3xl font-semibold">Reviewer console</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">AI structures and prioritizes citizen evidence; authorized humans verify, assign and resolve cases.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => loadReports()} disabled={busy} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">Refresh</button>
            <button onClick={signOut} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">Sign out</button>
          </div>
        </div>

        {message && <div className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-sm text-cyan-100">{message}</div>}

        <div className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Reports</h2>
              <span className="rounded-full bg-white/5 px-2 py-1 text-xs text-slate-400">{reports.length}</span>
            </div>
            <div className="mt-4 space-y-2">
              {reports.map((report) => (
                <button key={report.id} type="button" onClick={() => openReport(report)} className={`w-full rounded-xl border p-3 text-left transition ${selected?.id === report.id ? "border-cyan-400/30 bg-cyan-400/5" : "border-white/5 bg-black/20 hover:bg-white/5"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold capitalize">{report.category.replaceAll("_", " ")}</span>
                    <span className="text-[11px] text-slate-500">{report.status.replaceAll("_", " ")}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{report.summary || report.description || "No summary"}</p>
                  <p className="mt-2 text-[10px] text-slate-600">{new Date(report.created_at).toLocaleString()}</p>
                </button>
              ))}
              {!reports.length && <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">No reports available.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            {!selected ? (
              <div className="flex min-h-[420px] items-center justify-center text-center">
                <div><h2 className="text-lg font-semibold">Select a report</h2><p className="mt-2 text-sm text-slate-500">Review citizen evidence, then use a permitted workflow transition.</p></div>
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><p className="text-xs uppercase tracking-wider text-slate-500">Report</p><h2 className="mt-1 text-xl font-semibold capitalize">{selected.category.replaceAll("_", " ")}</h2><p className="mt-1 text-sm text-slate-500">{selected.id}</p></div>
                  <div className="flex gap-2"><span className="rounded-full border border-white/10 px-3 py-1 text-xs capitalize text-slate-300">{selected.status.replaceAll("_", " ")}</span><span className="rounded-full border border-white/10 px-3 py-1 text-xs capitalize text-slate-300">{selected.verification_status?.replaceAll("_", " ")}</span></div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-white/5 bg-black/20 p-4"><p className="text-xs uppercase tracking-wider text-slate-600">Citizen description</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{selected.description || selected.summary || "No description"}</p></div>
                  <div className="rounded-xl border border-white/5 bg-black/20 p-4"><p className="text-xs uppercase tracking-wider text-slate-600">Location</p><p className="mt-2 text-sm text-slate-300">{selected.latitude ?? "—"}, {selected.longitude ?? "—"}</p><p className="mt-2 text-xs text-slate-500">Exact location is visible only inside the operator boundary.</p></div>
                </div>

                <form onSubmit={applyReview} className="mt-6 space-y-4 rounded-xl border border-cyan-400/10 bg-cyan-400/[0.03] p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm"><span className="text-slate-400">Next status</span><select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#08101f] px-3 py-3"><option value={selected.status}>Keep current status</option>{nextStatuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
                    <label className="text-sm"><span className="text-slate-400">Assigned authority</span><input value={assignedAuthority} onChange={(e) => setAssignedAuthority(e.target.value)} maxLength={2000} className="mt-2 w-full rounded-xl border border-white/10 bg-[#08101f] px-3 py-3" placeholder="Municipal / district / department" /></label>
                  </div>
                  <label className="block text-sm"><span className="text-slate-400">Review notes</span><textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} maxLength={2000} rows={4} className="mt-2 w-full rounded-xl border border-white/10 bg-[#08101f] px-3 py-3" /></label>
                  <label className="block text-sm"><span className="text-slate-400">Resolution notes</span><textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} maxLength={2000} rows={3} className="mt-2 w-full rounded-xl border border-white/10 bg-[#08101f] px-3 py-3" /></label>
                  <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={escalated} onChange={(e) => setEscalated(e.target.checked)} /> Escalate for additional authority attention</label>
                  <button disabled={busy || status === selected.status} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">{busy ? "Applying…" : "Apply review transition"}</button>
                </form>

                <div className="mt-6">
                  <h3 className="font-semibold">Signed review history</h3>
                  <div className="mt-3 space-y-2">
                    {events.map((event) => <div key={event.id} className="rounded-xl border border-white/5 bg-black/20 p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="text-slate-300">{event.previous_status} → {event.next_status}</span><span className={event.signatureValid ? "text-emerald-300" : "text-rose-300"}>{event.signatureValid ? "signature valid" : "signature invalid"}</span></div><p className="mt-1 text-slate-600">{new Date(event.event_at).toLocaleString()}</p>{event.review_notes && <p className="mt-2 text-slate-400">{event.review_notes}</p>}</div>)}
                    {!events.length && <p className="text-sm text-slate-500">No review events yet.</p>}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
