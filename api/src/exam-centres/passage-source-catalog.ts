import { officialPassageCatalog } from "./official-passage-catalog";
import supplemental from "../../prisma/data/supplemental-passage-sources.json";
import walloon from "../../prisma/data/walloon-passage-sources-2026.json";

export type PassageSource = typeof officialPassageCatalog[number] & {
  operatorName?: string; validUntil?: string | null; sourceSha256?: string;
  pointGroups?: number[][]; qualification?: string;
};

// The historical six-centre export remains unchanged for reproducible old
// review receipts. Runtime source discovery additionally includes these PDFs.
export const passageSourceCatalog: PassageSource[] = [...officialPassageCatalog, ...supplemental.sources, ...walloon.sources];
export function sourceCurrent(source: PassageSource, now = new Date()) {
  if (!source.validUntil) return true;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}` <= source.validUntil;
}
export function currentPassageSource(slug: string, now = new Date()) {
  return passageSourceCatalog.find(s => s.slug === slug && sourceCurrent(s, now)) ?? null;
}
