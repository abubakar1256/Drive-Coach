export const accessPeriods = [
  { hours: 24, en: "1 day", nl: "1 dag" },
  { hours: 168, en: "1 week", nl: "1 week" },
  { hours: 720, en: "1 month (30 days)", nl: "1 maand (30 dagen)" },
  { hours: 2160, en: "3 months (90 days)", nl: "3 maanden (90 dagen)" },
] as const;
export type PlanOffer = { id: string; name: "Basic" | "Premium"; durationHours: number; priceCents: number | null; currency: string; purchasable: boolean };
export function offerPrice(offer: PlanOffer | undefined, locale = "en") {
  return offer?.purchasable && typeof offer.priceCents === "number" && offer.priceCents > 0
    ? new Intl.NumberFormat(locale === "nl" ? "nl-BE" : "en-IE", { style: "currency", currency: offer.currency }).format(offer.priceCents / 100) : null;
}
