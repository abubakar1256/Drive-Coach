// Storage names remain unchanged for historical payments and pending webhooks.
// Explicit tiers remove the ambiguous legacy "Premium" = single-centre name.
export type PaidTier = "Basic" | "Premium";
export const ACCESS_PERIODS = [24, 168, 720, 2160] as const;
export function planTier(plan: { name: string; tier?: string | null }): PaidTier | null {
  if (plan.tier === "Basic" || plan.tier === "Premium") return plan.tier;
  if (plan.tier) return null;
  if (plan.name === "Diamond") return "Premium";
  if (plan.name === "Premium" || plan.name === "Basic") return "Basic";
  return null;
}
export function validSubscription(s: { status: string; startsAt: Date | null; expiresAt: Date | null }, now: Date) {
  return s.status === "ACTIVE" && (!s.startsAt || s.startsAt <= now) && (!s.expiresAt || s.expiresAt > now);
}
