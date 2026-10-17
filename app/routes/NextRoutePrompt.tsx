"use client";

import Link from "next/link";
import { useCurrentLocale } from "../../lib/useLocale";
import { nextRouteAction, type RouteStep } from "../../lib/route-progression";

export default function NextRoutePrompt({ routeLabel, nextRoute, centreSlug, paidCentreAccess, completed = false }: {
  routeLabel: string; nextRoute: RouteStep | null; centreSlug: string; paidCentreAccess: boolean; completed?: boolean;
}) {
  const nl = useCurrentLocale() === "nl";
  if (!nextRoute) return <div className="unlock-card"><strong>{completed ? `${routeLabel} · ${nl ? "Voltooid" : "Completed"}` : routeLabel}</strong><p>{nl ? "Dit is de laatste gepubliceerde route van dit centrum." : "This is the last published route at this centre."}</p><Link className="google-maps-button" href={`/centres/${centreSlug}`}>{nl ? "Terug naar centrum" : "Back to centre"} →</Link></div>;
  const action = nextRouteAction(nextRoute, centreSlug, paidCentreAccess);
  return <div className="unlock-card" role={completed ? "status" : undefined}>
    <strong>{completed ? `${routeLabel} · ${nl ? "Voltooid" : "Completed"}. ` : ""}{nl ? "Volgende route" : "Next route"}: {nextRoute.label}</strong>
    <p>{action.unlocked
      ? (nl ? "Je hebt toegang tot deze route. Open de volgende route alleen wanneer je veilig geparkeerd staat." : "Your access includes this route. Open the next route only while safely parked.")
      : (nl ? `${nextRoute.label} is vergrendeld. Koop Basic voor dit centrum of Premium om deze route te openen. Delen van ${routeLabel} geven geen toegang tot ${nextRoute.label}.` : `${nextRoute.label} is locked. Buy Basic for this centre or Premium to access this route. Parts of ${routeLabel} do not unlock ${nextRoute.label}.`)}</p>
    <Link className="button button-full" href={action.href}>{action.unlocked ? `Open ${nextRoute.label}` : (nl ? `Kies een plan voor ${nextRoute.label}` : `Buy a plan to unlock ${nextRoute.label}`)} →</Link>
  </div>;
}
