"use client";

import { useEffect, useState } from "react";
import { useCurrentLocale, useSiteCopy } from "../../lib/useLocale";
import { authFetch, accessTokenKey } from "../../lib/clientSession";
import { usePlanAccess } from "../PlanAccess";
import { includesPlan } from "../../lib/plan-access";
import { accessPeriods, offerPrice, type PlanOffer } from "../../lib/plan-offers";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type Payment = { id: string; amountCents: number; currency: string; status: string; planName: string };
type Invoice = { id: string; number: string | null; amountCents: number; currency: string; status: string };
function money(cents: number, currency: string) { return new Intl.NumberFormat("en-IE", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100); }

export default function BillingPanel() {
  const locale = useCurrentLocale();
  const nl = locale === "nl";
  const copy = useSiteCopy().account;
  const { plan: currentPlan, state: planState, subscription } = usePlanAccess();
  const [centres, setCentres] = useState<Array<{ id: string; name: string }>>([]);
  const [centreId, setCentreId] = useState("");
  const [boundCentre, setBoundCentre] = useState<string | null>(null);
  const [school, setSchool] = useState<{ id: string; name: string } | null>(null);
  const [schoolBilling, setSchoolBilling] = useState(false);
  const [plans, setPlans] = useState<PlanOffer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [hours, setHours] = useState(24);

  useEffect(() => {
    const requested = Number(new URLSearchParams(window.location.search).get("period"));
    if (accessPeriods.some(p => p.hours === requested)) setHours(requested);
    let disposed = false;
    let generation = 0;
    async function load() {
      const request = ++generation;
      setPayments([]); setInvoices([]); setSchool(null); setSchoolBilling(false); setBoundCentre(null); setCentreId(""); setPlans([]);
      if (!sessionStorage.getItem(accessTokenKey)) return;
      try {
        const [centresR, plansR, subR, paymentsR, invoicesR, schoolR] = await Promise.all([fetch(`${API}/exam-centres`), fetch(`${API}/plans`, { cache: "no-store" }), authFetch(`${API}/me/subscription`), authFetch(`${API}/me/payments`), authFetch(`${API}/me/invoices`), authFetch(`${API}/b2b/me`)]);
        if (![centresR, plansR, subR, paymentsR, invoicesR].every(r => r.ok)) throw Error("Billing information is temporarily unavailable.");
        const [c, p, sub, pay, inv, schoolData] = await Promise.all([centresR.json(), plansR.json(), subR.json(), paymentsR.json(), invoicesR.json(), schoolR.ok ? schoolR.json() : null]);
        if (disposed || request !== generation) return;
        setCentres(c.filter((item: { id?: string }) => item.id)); setPlans(p); setPayments(pay); setInvoices(inv);
        setBoundCentre(sub.centreId ?? null); setCentreId(sub.centreId ?? ""); setSchool(schoolData?.ownedSchool ?? null);
      } catch { if (!disposed && request === generation) setMessage("Billing information is temporarily unavailable. Please retry."); }
    }
    void load(); window.addEventListener("routepilot-auth-change", load); window.addEventListener("focus", load);
    return () => { disposed = true; generation++; window.removeEventListener("routepilot-auth-change", load); window.removeEventListener("focus", load); };
  }, []);

  async function checkout(plan: PlanOffer) {
    if (planState !== "ready" || !offerPrice(plan) || includesPlan(currentPlan, plan.name)) return;
    if (plan.name === "Basic" && !centreId) { setMessage(nl ? "Kies je centrum voor Basic." : "Choose your centre before buying Basic."); return; }
    setBusy(plan.id); setMessage("");
    try {
      const response = await authFetch(`${API}/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: plan.id, centreId: plan.name === "Basic" ? centreId : undefined, schoolId: schoolBilling ? school?.id : undefined }) });
      const payload = await response.json();
      if (!response.ok || !payload.checkoutUrl) throw Error(payload.message ?? "Checkout is unavailable.");
      window.location.assign(payload.checkoutUrl);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Checkout is unavailable."); }
    finally { setBusy(""); }
  }
  async function selectCentre() {
    setBusy("centre");
    try {
      const r = await authFetch(`${API}/me/subscription/centre`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ centreId }) });
      const data = await r.json(); if (!r.ok) throw Error(data.message);
      setBoundCentre(data.centreId); setMessage("Your Basic centre is selected."); window.dispatchEvent(new Event("routepilot-auth-change"));
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not select centre."); }
    finally { setBusy(""); }
  }
  const trial = subscription?.trial;
  return <section className="account-card billing-panel" id="billing">
    <div className="account-card-heading"><div><span className="small-label">{copy.billing}</span><h2>{currentPlan !== "Free" ? `${currentPlan} · ${nl ? "Toegang beheren" : "Manage access"}` : copy.billingTitle}</h2></div><span className="subscription-status free">{copy.secureCheckout}</span></div>
    <p className="billing-intro">{planState !== "ready" ? (nl ? "Je toegang controleren…" : "Checking your access…") : currentPlan === "Premium" ? (nl ? "Premium voor alle centra is actief. Basic is inbegrepen; koop niet opnieuw." : "Premium access for all centres is active. Basic is included; no repeat purchase needed.") : currentPlan === "Basic" ? (nl ? "Basic voor je gekozen centrum is actief. Premium is een optionele upgrade naar alle centra." : "Basic access for your chosen centre is active. Premium is an optional upgrade to all centres.") : (nl ? "Free: één gekozen route, één proefperiode van 24 uur per account." : "Free: one chosen route, one 24-hour trial per account.")}</p>
    {trial && currentPlan === "Free" && <p>{trial.available ? (nl ? "Je proefperiode is nog beschikbaar." : "Your trial has not started yet.") : <>
      {trial.active ? "Trial active" : "Trial ended"}{trial.expiresAt && ` · ${new Date(trial.expiresAt).toLocaleString(locale)}`}
      {trial.routeSlug && <a href={`/routes/${trial.routeSlug}`}> · {nl ? "Je gekozen route" : "Your selected route"}</a>}
    </>}</p>}
    <label>{nl ? "Toegangsduur" : "Access period"}<select value={hours} onChange={e => setHours(Number(e.target.value))}>{accessPeriods.map(p => <option key={p.hours} value={p.hours}>{p[locale]}</option>)}</select></label>
    <label>Basic exam centre<select value={centreId} disabled={currentPlan === "Premium" || (currentPlan === "Basic" && Boolean(boundCentre))} onChange={e => setCentreId(e.target.value)}><option value="">{nl ? "Kies centrum" : "Choose centre"}</option>{centres.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
    <p>{nl ? "Basic is gebonden aan dit centrum. Premium geldt voor alle centra. Eenmalige betaling; geen automatische verlenging." : "Basic is tied to this centre. Premium covers all centres. One-time payment; no automatic renewal."}</p>
    {currentPlan === "Basic" && !boundCentre && <button className="button button-small" disabled={!centreId || Boolean(busy)} onClick={() => void selectCentre()}>Confirm Basic centre</button>}
    {school && <label><input type="checkbox" checked={schoolBilling} onChange={e => setSchoolBilling(e.target.checked)} /> Record this purchase under {school.name}</label>}
    <div className="billing-plan-list">{(["Basic", "Premium"] as const).map(name => {
      const plan = plans.find(p => p.name === name && p.durationHours === hours);
      const price = offerPrice(plan, locale); const active = includesPlan(currentPlan, name);
      return <article className="billing-plan" key={name}><div><strong>{name}</strong><small>{accessPeriods.find(p => p.hours === hours)?.[locale]}</small></div><strong>{price ?? "—"}</strong><button className="button button-small" disabled={planState !== "ready" || Boolean(busy) || active || !price} onClick={() => plan && void checkout(plan)}>{active ? (name === currentPlan ? "Active" : "Included") : !price ? "Unavailable" : busy === plan?.id ? copy.opening : copy.choosePlan}</button></article>;
    })}</div>
    {message && <p className="account-message" role="status">{message}</p>}
    {(payments.length || invoices.length) ? <div className="billing-history"><div><span className="small-label">{copy.paymentHistory}</span>{payments.slice(0, 4).map(p => <p key={p.id}><strong>{p.planName}</strong> · {money(p.amountCents, p.currency)} · {p.status}</p>)}</div><div><span className="small-label">{copy.invoices}</span>{invoices.slice(0, 4).map(i => <p key={i.id}>{i.number || "Invoice"} · {money(i.amountCents, i.currency)} · {i.status}</p>)}</div></div> : null}
  </section>;
}
