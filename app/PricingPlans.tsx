"use client";

import { useEffect, useState } from "react";
import { useCurrentLocale } from "../lib/useLocale";
import { usePlanAccess } from "./PlanAccess";
import { includesPlan } from "../lib/plan-access";
import { accessPeriods, offerPrice, type PlanOffer } from "../lib/plan-offers";

export default function PricingPlans() {
  const locale = useCurrentLocale();
  const nl = locale === "nl";
  const { state, plan: currentPlan } = usePlanAccess();
  const [hours, setHours] = useState(24);
  const [offers, setOffers] = useState<PlanOffer[]>([]);
  useEffect(() => {
    let disposed = false;
    void fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "/api/v1"}/plans`, { cache: "no-store" }).then(async r => {
      if (!r.ok) throw Error("Prices unavailable");
      const data = await r.json();
      if (!disposed && Array.isArray(data)) setOffers(data);
    }).catch(() => { if (!disposed) setOffers([]); });
    return () => { disposed = true; };
  }, []);
  const tiers = [
    { name: "Free", subtitle: nl ? "Ontdek één route, 24 uur lang" : "Discover one route for 24 hours", features: nl ? ["Alle centra en routeoverzichten bekijken", "Eén gekozen route: eenmalige proefperiode van 24 uur", "Kaart en basis-oefenregistratie tijdens je proefperiode", "Geen creditcard nodig"] : ["Browse all centres and route summaries", "One chosen route: a single 24-hour trial per account", "Map and basic practice tracking during your trial", "No credit card needed"] },
    { name: "Basic", subtitle: nl ? "Alle routes van één gekocht centrum" : "All routes at one purchased centre", features: nl ? ["Alle gepubliceerde routes van je gekozen centrum", "Informatie en aandachtspunten van dat centrum", "Interactieve routekaart en Google Maps-links", "Gesproken tips en Drive Coach AI", "Oefengeschiedenis en feedback"] : ["All published routes for your chosen centre", "Centre preparation information and attention points", "Interactive route map and Google Maps links", "Voice reminders and Drive Coach AI", "Practice history and feedback"] },
    { name: "Premium", subtitle: nl ? "Volledige toegang tot alle centra" : "Complete access across all centres", features: nl ? ["Alle Basic-functies voor alle examencentra", "Alle gepubliceerde routes en centruminformatie", "Uitgebreide oefenfeedback en ritrapporten", "Gesproken tips en Drive Coach AI", "Oefen bij meerdere centra zonder te wisselen"] : ["All Basic features across every exam centre", "All published routes and centre preparation information", "Advanced practice feedback and after-drive reports", "Voice reminders and Drive Coach AI", "Practise across centres without changing your purchase"] },
  ];
  return <section className="pricing-section" id="pricing"><div className="shell">
    <div className="pricing-heading"><div><p className="eyebrow">{nl ? "DUIDELIJKE TOEGANG" : "Simple access, no surprises"}</p><h2>{nl ? "Kies jouw" : "Choose your"}<br /><span>{nl ? "voorbereidingsplan." : "preparation plan."}</span></h2></div><p>{nl ? "Free, Basic of Premium. Eenmalige betaling, geen automatische verlenging. Je toegang eindigt na de gekozen periode." : "Free, Basic or Premium. One-time payment, no automatic renewal. Access ends after your selected period."}</p></div>
    <label className="plan-period-picker">{nl ? "Toegangsduur" : "Access period"}<select value={hours} onChange={e => setHours(Number(e.target.value))}>{accessPeriods.map(p => <option key={p.hours} value={p.hours}>{p[locale]}</option>)}</select></label>
    <div className="plans-grid">{tiers.map((tier, index) => {
      const offer = offers.find(p => p.name === tier.name && p.durationHours === hours);
      const price = index === 0 ? "€0" : offerPrice(offer, locale);
      const included = state === "ready" && includesPlan(currentPlan, tier.name);
      const uncertain = state === "loading" || state === "error";
      const unavailable = index > 0 && !price;
      const href = included || uncertain ? "/account" : state === "ready" ? (index ? `/account?period=${hours}#billing` : "/centres") : index ? `/auth/register?plan=${tier.name.toLowerCase()}&period=${hours}` : "/auth/register";
      const label = unavailable ? (nl ? "Tijdelijk niet beschikbaar" : "Temporarily unavailable") : uncertain ? (nl ? "Mijn toegang" : "My access") : included ? (tier.name === currentPlan ? (nl ? "Actief pakket · Beheren" : "Current plan · Manage") : (nl ? "Inbegrepen" : "Included in your plan")) : (nl ? `Kies ${tier.name}` : `Choose ${tier.name}`);
      return <article className={`plan-card ${index === 1 ? "plan-card-featured" : ""}`} key={tier.name}>
        {index === 1 && <span className="plan-tag">{nl ? "MEEST GEKOZEN" : "MOST POPULAR"}</span>}<h3>{tier.name}</h3><p className="plan-subtitle">{tier.subtitle}</p>
        <div className="plan-price"><strong>{price ?? "—"}</strong><small>{index ? accessPeriods.find(p => p.hours === hours)?.[locale] : (nl ? "Eén route · 24 uur" : "One route · 24 hours")}</small></div>
        <ul>{tier.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
        {unavailable ? <button className="button button-full button-outline" disabled>{label}</button> : <a className={`button button-full ${index === 1 ? "" : "button-outline"}`} href={href}>{label} ↗</a>}
      </article>;
    })}</div>
    <p className="route-list-note">{nl ? "De proefperiode start pas na je bevestiging op een route. Betaalde toegang start na bevestigde betaling. Geschatte rijtijden zijn geen garantie." : "Your trial starts only when you confirm on a route. Paid access starts after confirmed payment. Estimated driving times are not a guarantee."}</p>
  </div></section>;
}
