"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  FilePlus2,
  Globe2,
  Map,
  Menu,
  Radio,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

const items = [
  { href: "/", label: "Command Center", icon: Radio },
  { href: "/report", label: "Report Issue", icon: FilePlus2 },
  { href: "/map", label: "Evidence Map", icon: Map },
  { href: "/insights", label: "Insights", icon: Sparkles },
];

export default function VayuHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [live, setLive] = useState(false);

  useEffect(() => {
    fetch("/api/hotspots")
      .then((response) => response.json())
      .then((data) =>
        setLive(Array.isArray(data?.hotspots) && data.hotspots.length > 0),
      )
      .catch(() => setLive(false));
  }, []);

  return (
    <header className="sticky top-0 z-[1000] border-b border-white/[0.07] bg-[#050914]/90 backdrop-blur-2xl">
      <div className="mx-auto flex h-[74px] max-w-[1800px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-3"
          onClick={() => setMobileOpen(false)}
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
            <Globe2 className="h-5 w-5 text-cyan-300" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-[0.18em] text-white">
              VAYUNETRA
            </p>
            <p className="text-[10px] font-medium tracking-wider text-slate-500">
              COMMUNITY ENVIRONMENTAL INTELLIGENCE
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {items.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                  active
                    ? "bg-white/[0.09] text-white shadow-inner"
                    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}

          <Link
            href="/sources"
            className="ml-1 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-200"
          >
            Sources
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <div
            className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-wider sm:flex ${
              live
                ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300"
                : "border-amber-400/20 bg-amber-400/5 text-amber-300"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                live ? "animate-pulse bg-emerald-400" : "bg-amber-400"
              }`}
            />
            {live ? "LIVE EVIDENCE" : "DEMO MODE"}
          </div>

          <button
            type="button"
            aria-label="Notifications"
            className="rounded-xl border border-white/10 p-2.5 text-slate-500 transition hover:border-cyan-400/20 hover:text-white"
          >
            <Bell className="h-4 w-4" />
          </button>

          <button
            type="button"
            aria-label="Open navigation"
            className="rounded-xl border border-white/10 p-2.5 text-slate-400 lg:hidden"
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.07] bg-[#050914] px-4 py-3 lg:hidden">
          <div className="grid gap-1 sm:grid-cols-2">
            {items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-300 hover:bg-white/5"
              >
                <Icon className="h-4 w-4 text-cyan-400" />
                {label}
              </Link>
            ))}
            <Link
              href="/sources"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-300 hover:bg-white/5"
            >
              Sources & methodology
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
