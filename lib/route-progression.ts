export type RouteStep = { slug: string; label: string; isFree: boolean };

// Catalogue order is the server's published order, not slug/name sorting.
export function routeProgression(routes: RouteStep[], slug: string) {
  const index = routes.findIndex(route => route.slug === slug);
  return { current: index < 0 ? null : routes[index], next: index < 0 ? null : routes[index + 1] ?? null };
}

export function confirmedRouteCompletion(result: { completionKind?: string } | null | undefined) {
  return result?.completionKind === "COMPLETED";
}

export function nextRouteAction(next: RouteStep, centreSlug: string, paidCentreAccess: boolean) {
  const unlocked = paidCentreAccess;
  return { unlocked, href: unlocked ? `/routes/${encodeURIComponent(next.slug)}` : `/#pricing` };
}
