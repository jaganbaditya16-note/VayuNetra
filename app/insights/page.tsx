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

type Hotspot = {
  confidence?: number;
  satelliteEvidence?: unknown;
  evidenceBasis?: string[];
  severity?: string;
};
type Report = {
  category?: string;
  type?: string;
};

export default function InsightsPage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
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