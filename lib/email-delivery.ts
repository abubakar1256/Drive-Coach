export function emailDeliveryFailed(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Record<string, unknown>;
  return value.deliveryConfigured === false || value.deliveryStatus === "failed";
}
