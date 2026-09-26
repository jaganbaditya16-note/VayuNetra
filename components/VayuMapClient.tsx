"use client";

import dynamic from "next/dynamic";
import type { VayuMapHotspot } from "./VayuMap";

const VayuMap = dynamic(() => import("./VayuMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-white/10 bg-[#07111f] text-xs text-slate-500">
      Loading evidence map…
    </div>
  ),
});

export type { VayuMapHotspot };

export default VayuMap;
