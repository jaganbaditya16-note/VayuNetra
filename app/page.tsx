"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  CircleUserRound,
  Cloud,
  Database,
  FileText,
  MapPin,
  Satellite,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import VayuHeader from "@/components/VayuHeader";
import VayuMap from "@/components/VayuMapClient";

type Report = {
  id?: string;
  location?: string;
  summary?: string;
  text?: string;
  category?: string;
  type?: string;
  reportedAt?: string;
};

type RawHotspot = {
  id?: string | number;
  location?: { city?: string; area?: string; latitude?: number; longitude?: number };
  severity?: string;
  confidence?: number;
  reportCount?: number;
  possibleContributors?: string[];
  satelliteEvidence?: {
    value?: number | null;
    unit?: string;
    source?: string;
  };
  isSample?: boolean;
};

type SatelliteEvidence = {
  value?: number | null;
  unit?: string;
  source?: string;
};

type Hotspot = {
  id: string;
  city: string;
  area: string;
  latitude: number;
  longitude: number;
  severity: string;
  confidence: number;
  reports: number;
  source: string;
  satelliteEvidence?: SatelliteEvidence;
  isSample?: boolean;
};

const demoHotspots: Hotspot[] = [
  {
    id: "demo-delhi",
    city: "Delhi NCR",
    area: "Anand Vihar",
    latitude: 28.646,
    longitude: 77.316,
    severity: "Critical",
    confidence: 94,
    reports: 38,
    source: "Traffic + construction dust",
    isSample: true,
  },
  {
    id: "demo-mumbai",
    city: "Mumbai",
    area: "Chembur",
    latitude: 19.052,
    longitude: 72.894,
    severity: "High",
    confidence: 89,
    reports: 24,
    source: "Industrial activity",
    isSample: true,
  },
  {
    id: "demo-pune",
    city: "Pune",
    area: "Hadapsar",
    latitude: 18.508,
    longitude: 73.926,
    severity: "Moderate",
    confidence: 81,
    reports: 13,
    source: "Traffic + dust",
    isSample: true,
  },
  {
    id: "demo-ahmedabad",
    city: "Ahmedabad",