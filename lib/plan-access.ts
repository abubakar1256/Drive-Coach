export type RouteTrial = { available: boolean; active: boolean; routeId: string | null; routeSlug?: string | null; startedAt?: string | null; expiresAt: string | null };
export type AccessPlan = { status: string; plan: string; expiresAt: string | null; startsAt?: string | null; centreId?: string | null; trial?: RouteTrial };

export function activePlan(value: AccessPlan | null, now = Date.now()) {
  if (!value || value.status !== "ACTIVE" || !["Basic", "Premium"].includes(value.plan)) return "Free";
  if (value.startsAt && !(Date.parse(value.startsAt) <= now)) return "Free";
  if (value.expiresAt && !(Date.parse(value.expiresAt) > now)) return "Free";
  return value.plan;
}

export function includesPlan(current: string, requested: string) {
  const tiers: Record<string, number> = { Free: 0, Basic: 1, Premium: 2 };
  return current in tiers && requested in tiers && tiers[current] >= tiers[requested];
}
