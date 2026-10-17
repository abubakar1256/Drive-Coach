"use client";

import Link from "next/link";
import { useState } from "react";
import { usePlanAccess } from "../PlanAccess";
import { authFetch } from "../../lib/clientSession";
import { useCurrentLocale } from "../../lib/useLocale";

export default function RouteTrialAccess({ routeId, routeSlug }: { routeId?: string; routeSlug: string }) {
  const { plan, state, subscription } = usePlanAccess();
  const nl = useCurrentLocale() === "nl";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (plan !== "Free") return null;
  const trial = subscription?.trial;
  async function start() {
    if (!routeId || state !== "ready" || !trial?.available || busy) return;
    setBusy(true); setMessage("");
    try {
      const r = await authFetch(`${process.env.NEXT_PUBLIC_API_URL ?? "/api/v1"}/me/trial`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ routeId }) });
      const data = await r.json();
      if (!r.ok) throw Error(data.message ?? "Could not start trial.");
      window.dispatchEvent(new Event("routepilot-auth-change"));
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not start trial."); }
    finally { setBusy(false); }
  }
  return <section className="route-trial-card" aria-labelledby="route-trial-title">
    <span className="small-label">Free · 24 hours</span>
    <h3 id="route-trial-title">{nl ? "Eén route. Jouw eerste oefenrit." : "One route. Your first practice drive."}</h3>
    {state === "signed-out" ? <><p>{nl ? "Log in om één gekozen route 24 uur te proberen." : "Sign in to try one chosen route for 24 hours."}</p><Link className="button button-full" href={`/auth/login?next=${encodeURIComponent(`/routes/${routeSlug}`)}`}>{nl ? "Inloggen" : "Sign in"} ↗</Link></> : state !== "ready" ? <p role="status">{nl ? "Je proefperiode controleren…" : "Checking your trial access…"}</p> : trial?.available ? <>
      <p>{nl ? "Na bevestiging start je eenmalige proefperiode van 24 uur voor deze route. Je kunt niet van route wisselen of een nieuwe proefperiode bij een ander centrum starten." : "Confirm to start your single 24-hour trial for this route. You cannot switch routes or start another trial at another centre."}</p>
      <button className="button button-full" disabled={busy || !routeId} onClick={() => void start()}>{busy ? "Starting…" : (nl ? "Start mijn proefperiode van 24 uur" : "Start my 24-hour route trial")}</button>
    </> : <>
      <p>{trial?.active ? (trial.routeId === routeId ? (nl ? "Je proefperiode voor deze route is actief." : "Your trial for this route is active.") : (nl ? "Je proefperiode geldt alleen voor je eerder gekozen route." : "Your trial applies only to your previously selected route.")) : (nl ? "Je eenmalige proefperiode is afgelopen. Kies Basic of Premium voor verdere routetoegang." : "Your one-time trial has ended. Choose Basic or Premium for further route access.")}</p>
      {trial?.expiresAt && <p className="trial-expiry">{nl ? "Eindtijd" : "Trial ends"}: <time dateTime={trial.expiresAt}>{new Date(trial.expiresAt).toLocaleString(nl ? "nl-BE" : "en-GB")}</time></p>}
      {trial?.active && trial.routeId !== routeId && trial.routeSlug && <Link href={`/routes/${trial.routeSlug}`}>{nl ? "Open je proefroute" : "Open your trial route"} →</Link>}
      {(!trial?.active || trial.routeId !== routeId) && <Link className="button button-full" href="/account#billing">{nl ? "Kies Basic of Premium" : "Choose Basic or Premium"} ↗</Link>}
    </>}
    {message && <p role="alert">{message}</p>}
  </section>;
}
