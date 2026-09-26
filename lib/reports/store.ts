import fs from "fs";
import path from "path";
import type { CitizenReport } from "@/lib/environmental/types";

const reportsFile = path.join(process.cwd(), "data", "reports.json");

function readReports(): CitizenReport[] {
  try {
    if (!fs.existsSync(reportsFile)) {
      return [];
    }

    const content = fs.readFileSync(reportsFile, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(content) as CitizenReport[];
  } catch {
    return [];
  }
}

function writeReports(reports: CitizenReport[]) {
  fs.writeFileSync(
    reportsFile,
    JSON.stringify(reports, null, 2),
    "utf8"
  );
}

export function addReport(report: CitizenReport) {
  const reports = readReports();
  reports.push(report);
  writeReports(reports);
  return report;
}

export function getReports() {
  return readReports();
}