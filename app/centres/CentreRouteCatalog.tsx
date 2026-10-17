"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ApiCentre } from "../../lib/api";
import { authFetch } from "../../lib/clientSession";
import { routeSequence } from "../../lib/route-utils";
import { useCurrentLocale, useSiteCopy } from "../../lib/useLocale";
import { localizeText } from "../../lib/localizeContent";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export default function CentreRouteCatalog({ initialCentre }: { initialCentre: ApiCentre }) {
  const [accessible, setAccessible] = useState<ApiCentre | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const locale = useCurrentLocale();
  const nl = locale === "nl";
  const copy = useSiteCopy().route;

  useEffect(() => {
    let cancelled = false;
    let generation = 0;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    async function sync() {
      const current = ++generation;
      clearTimeout(expiryTimer);
      setAccessible(null); setError(false);
      if (!sessionStorage.getItem("routepilot.accessToken")) { setChecking(false); return; }
      setChecking(true);
      try {
        const response = await authFetch(`${API}/exam-centres/${encodeURIComponent(initialCentre.slug)}/access`);
        if (!response.ok) throw new Error("Access check failed");
        const data = await response.json() as ApiCentre;
        if (!cancelled && generation === current) {
          const expiresAt = data.access?.premium ? data.access.expiresAt : data.access?.trial?.expiresAt;
          if (expiresAt && Date.parse(expiresAt) <= Date.now() && (data.access?.premium || data.access?.trial?.active)) return;
          setAccessible(data);
          if (expiresAt && Date.parse(expiresAt) > Date.now()) expiryTimer = setTimeout(sync, Math.min(2147483647, Date.parse(expiresAt) - Date.now() + 20));
        }
      } catch { if (!cancelled && generation === current) setError(true); }
      finally { if (!cancelled && generation === current) setChecking(false); }
    }
    void sync();
    window.addEventListener("routepilot-auth-change", sync);
    window.addEventListener("focus", sync);
    return () => { cancelled = true; generation++; clearTimeout(expiryTimer); window.removeEventListener("routepilot-auth-change", sync); window.removeEventListener("focus", sync); };
  }, [initialCentre.slug, retry]);

  const centre = accessible ?? initialCentre;
  const paid = Boolean(accessible?.access?.premium);
  const routes = centre.routes;
  const freeCount = routes.filter(route => route.canAccess).length;
  const info = paid ? accessible?.premiumInfo : null;
  const topics = nl ? ["Wat te verwachten", "Focus voor examenvoorbereiding", "Veelgemaakte fouten", "Voorbereidingstips"] : ["What to expect", "Exam preparation focus", "Common mistakes", "Preparation tips"];

  return <>
    <section className="shell premium-centre-section" aria-labelledby="premium-centre-heading">
      <div className={`premium-centre-panel ${paid ? "is-unlocked" : ""}`}>
        <div className="premium-centre-title"><span aria-hidden="true">{paid ? "✓" : "🔒"}</span><div><p className="eyebrow">{centre.name}</p><h2 id="premium-centre-heading">{nl ? "Premium informatie over het examencentrum" : "Premium Exam Center Information"}</h2></div></div>
        <p>{nl ? `Bereid je voor op ${centre.name} met routecontext, aandachtspunten, reflectievragen en voorbereidingstips.` : `Prepare around ${centre.name} with route context, preparation focus, reflection prompts and practical preparation tips.`}</p>
        {info ? <><div className="premium-centre-topics">{info.sections.map(section => <article key={section.key}><h3>{section.title[locale]}</h3><p>{section.text[locale]}</p></article>)}</div><p className="route-list-note">{info.disclaimer[locale]}</p><div className="centre-access-badge">✓ {accessible?.access?.plan} · {nl ? "Toegang tot dit centrum actief" : "Access to this centre is active"}</div></> : <>
          <div className="premium-centre-topics is-preview">{topics.map((topic, i) => <div key={topic}><span aria-hidden="true">{["◎", "⌖", "△", "✓"][i]}</span><strong>{topic}</strong></div>)}</div>
          <p className="route-list-note">{nl ? "Algemene voorbereiding, geen officiële lokale beoordelingscriteria of garantie dat je slaagt." : "General preparation guidance, not official local examiner criteria or a guarantee of passing."}</p>
          {checking || error ? <button className="button" disabled>{nl ? "Toegang controleren" : "Check access"}</button> : <Link className="button" href="/#pricing">{nl ? "Kies Basic of Premium" : "Choose Basic or Premium"} ↗</Link>}
        </>}
        {checking && <p role="status">{nl ? "Je centrumtoegang controleren…" : "Checking your centre access…"}</p>}
        {error && <p role="status">{nl ? "Toegang kon niet worden gecontroleerd." : "Could not check access."} <button type="button" onClick={() => setRetry(n => n + 1)}>{nl ? "Opnieuw controleren" : "Check again"}</button></p>}
      </div>
      <div className="centre-plan-summary" aria-label={nl ? "Toegang per abonnement" : "Plan access comparison"}>
        <article><strong>Free</strong><p>{nl ? "Eén gekozen route, één proefperiode van 24 uur per account." : "One chosen route, one 24-hour trial per account."}</p></article>
        <article><strong>Basic</strong><p>{nl ? "Alle gepubliceerde routes en premiuminformatie van één gekocht centrum; AI en gesproken begeleiding." : "All published routes and premium information for one purchased centre; AI and voice guidance."}</p></article>
        <article><strong>Premium</strong><p>{nl ? "Alle gepubliceerde routes en premiuminformatie van alle centra; AI en gesproken begeleiding." : "All published routes and premium information for all centres; AI and voice guidance."}</p></article>
      </div>
    </section>
    <section className="route-list-section"><div className="shell">
      <div className="section-heading-row"><div><p className="eyebrow">{copy.chooseRun}</p><h2>{copy.around} {centre.name}</h2></div><span className="route-count">{freeCount} {nl ? "toegankelijk" : "accessible"} · {routes.length} {nl ? "routes" : "routes"}</span></div>
      <div className="reference-route-list">
        {!routes.length && <p role="status">{copy.routePreparing}</p>}
        {routes.map((route, index) => {
          const free = Boolean(route.isFree);
          const unlocked = Boolean(accessible && route.canAccess);
          const label = route.label ?? `Route ${String.fromCharCode(65 + index)}`;
          return <article className={`reference-route-card ${unlocked ? "is-free" : "is-locked"}`} key={route.slug}>
            <div className="reference-route-icon" aria-hidden="true"><span /><span /></div>
            <div className="reference-route-main"><div className="reference-route-title"><h3>{label}</h3><span className={`reference-route-badge ${unlocked ? "badge-free" : "badge-locked"}`}>{free ? (nl ? "Proefperiode" : "Trial") : unlocked ? (nl ? "Ontgrendeld" : "Unlocked") : (nl ? "Vergrendeld" : "Locked")}</span></div>
              <p className="reference-route-sequence">{unlocked ? localizeText(routeSequence(route.points) || route.name, locale) : checking || error ? (nl ? "Je centrumtoegang moet nog worden gecontroleerd." : "Your centre access still needs to be checked.") : (nl ? "Start je eenmalige proefperiode op deze route, of kies Basic voor dit centrum / Premium voor alle centra." : "Start your one-time trial on this route, or choose Basic for this centre / Premium for all centres.")}</p>
              <div className="reference-route-meta"><span>⌁ {route.pointCount ?? route.points.length} {nl ? "punten" : "points"}</span><span>◷ {route.durationMin ? `${route.durationMin} min` : (nl ? "Rijduur te controleren" : "Driving time to be checked")}</span></div>
            </div>
            <div className="reference-route-actions">{unlocked ? <><Link className="route-action route-action-maps" href={`/routes/${route.slug}#google-maps`}>{copy.openGoogle} ↗</Link><Link className="route-action route-action-primary" href={`/routes/${route.slug}`}>{copy.viewRoute} →</Link></> : checking || error ? <button className="route-action route-action-upgrade" disabled>{nl ? "Toegang controleren" : "Check access"}</button> : <Link className="route-action route-action-upgrade" href={`/routes/${route.slug}`}>{route.canStartTrial ? (nl ? "Probeer 24 uur" : "Try for 24 hours") : (nl ? "Bekijk toegang" : "View access")} →</Link>}</div>
          </article>;
        })}
      </div><p className="route-list-note">{copy.disclaimer}</p>
      {routes.length < 7 && <p className="route-list-note">{nl ? "Meer routes verschijnen na controle van de echte wegen en minimaal 24 minuten rijtijd. Alleen bestaande gepubliceerde routes worden getoond." : "More routes appear after real-road checks and at least 24 minutes driving time. Only existing published routes are shown."}</p>}
    </div></section>
  </>;
}
