import type { Locale } from "./i18n";

export type BelgianRegion = { value: string; labels: Record<Locale, string> };

// Belgium has ten provinces. Brussels is listed separately because it is a
// capital region, not a province, but it still needs to be filterable.
export const belgianProvinces: BelgianRegion[] = [
  { value: "Antwerp", labels: { en: "Antwerp", nl: "Antwerpen" } },
  { value: "East Flanders", labels: { en: "East Flanders", nl: "Oost-Vlaanderen" } },
  { value: "Flemish Brabant", labels: { en: "Flemish Brabant", nl: "Vlaams-Brabant" } },
  { value: "Hainaut", labels: { en: "Hainaut", nl: "Henegouwen" } },
  { value: "Limburg", labels: { en: "Limburg", nl: "Limburg" } },
  { value: "Liège", labels: { en: "Liège", nl: "Luik" } },
  { value: "Luxembourg", labels: { en: "Luxembourg", nl: "Luxemburg" } },
  { value: "Namur", labels: { en: "Namur", nl: "Namen" } },
  { value: "Walloon Brabant", labels: { en: "Walloon Brabant", nl: "Waals-Brabant" } },
  { value: "West Flanders", labels: { en: "West Flanders", nl: "West-Vlaanderen" } },
];

export const capitalRegion: BelgianRegion = { value: "Brussels", labels: { en: "Brussels-Capital Region", nl: "Brussels Hoofdstedelijk Gewest" } };

export const belgianRegions: BelgianRegion[] = [capitalRegion, ...belgianProvinces];

function regionKey(value: string) {
  return value.trim().toLocaleLowerCase("en").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

const regionAliases = new Map<string, string>();
for (const region of belgianRegions) {
  regionAliases.set(regionKey(region.value), region.value);
  Object.values(region.labels).forEach((label) => regionAliases.set(regionKey(label), region.value));
}

export function canonicalBelgianRegion(value: string) {
  return regionAliases.get(regionKey(value)) ?? value.trim();
}

export function belgianRegionLabel(value: string, locale: Locale) {
  const canonical = canonicalBelgianRegion(value);
  return belgianRegions.find((region) => region.value === canonical)?.labels[locale] ?? value;
}
