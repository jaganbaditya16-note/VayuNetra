export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-cyan-400">
          Community Environmental Intelligence
        </p>

        <h1 className="text-5xl font-bold tracking-tight">
          VayuNetra
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          AI-powered environmental intelligence that combines citizen reports,
          public data, and satellite-derived signals to identify pollution
          hotspots and support community action.
        </p>

        <div className="mt-10 flex gap-4">
          <button className="rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-slate-950">
            Report an Issue
          </button>

          <button className="rounded-lg border border-slate-700 px-6 py-3 font-semibold">
            Explore Hotspots
          </button>
        </div>
      </div>
    </main>
  )
}
