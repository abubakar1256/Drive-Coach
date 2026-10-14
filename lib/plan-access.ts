export type AccessPlan = { status: string; plan: string; expiresAt: string | null; startsAt?: string | null; centreId?: string | null };

export function activePlan(value: AccessPlan | null, now = Date.now()) {
  if (!value || value.status !== "ACTIVE" || !["Premium", "Diamond"].includes(value.plan)) return "Free";
  if (value.startsAt && !(Date.parse(value.startsAt) <= now)) return "Free";
  if (value.expiresAt && !(Date.parse(value.expiresAt) > now)) return "Free";
  return value.plan;
}

export function includesPlan(current: string, requested: string) {
  return current === "Diamond" || (current === "Premium" && requested !== "Diamond");
}
