"use client";

import { useEffect, useState } from "react";
import { useCurrentLocale, useSiteCopy } from "../../lib/useLocale";
import { authFetch } from "../../lib/clientSession";

import { usePlanAccess } from "../PlanAccess";
import { includesPlan } from "../../lib/plan-access";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type Plan = { id: string; name: string; durationHours: number; priceCents: number; currency: string };
type Payment = { id: string; amountCents: number; currency: string; status: string; provider: string; createdAt: string; planName: string };
type Invoice = { id: string; number: string | null; amountCents: number; currency: string; status: string; invoiceUrl: string | null; issuedAt: string; paidAt: string | null };

function money(cents: number, currency: string) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100); }

export default function BillingPanel() {
  const locale = useCurrentLocale();
  const copy = useSiteCopy().account;
  const [centres, setCentres] = useState<Array<{ id: string; name: string }>>([]);
  const [centreId, setCentreId] = useState("");
  const [boundCentre, setBoundCentre] = useState<string | null>(null);
  const [school, setSchool] = useState<{ id: string; name: string } | null>(null);
  const [schoolBilling, setSchoolBilling] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const { plan: currentPlan, state: planState } = usePlanAccess();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = window.sessionStorage.getItem("routepilot.accessToken");
    if (!token) return;
    void fetch(`${API}/exam-centres`).then(r => r.json()).then(data => setCentres(data.filter((c: { id?: string }) => c.id))).catch(() => undefined);
    void authFetch(`${API}/b2b/me`).then(r => r.json()).then(p => setSchool(p.ownedSchool)).catch(() => undefined);
    Promise.all([fetch(`${API}/plans`), authFetch(`${API}/me/subscription`), authFetch(`${API}/me/payments`), authFetch(`${API}/me/invoices`)]).then(async ([planResponse, subscriptionResponse, paymentResponse, invoiceResponse]) => {
      const [planData, subscriptionData, paymentData, invoiceData] = await Promise.all([planResponse.json(), subscriptionResponse.json(), paymentResponse.json(), invoiceResponse.json()]);
      setPlans((planData as Plan[]).filter((plan) => plan.name === "Premium" || plan.name === "Diamond"));
      setBoundCentre(subscriptionData.centreId ?? null); setCentreId(subscriptionData.centreId ?? "");
      if (paymentResponse.ok) setPayments(paymentData as Payment[]);
      if (invoiceResponse.ok) setInvoices(invoiceData as Invoice[]);
    }).catch(() => setMessage(locale === "nl" ? "Facturatiegegevens zijn tijdelijk niet beschikbaar." : "Billing information is temporarily unavailable."));
  }, []);

  async function checkout(planId: string) {
    const token = window.sessionStorage.getItem("routepilot.accessToken");
    if (!token) return;
    if (planState !== "ready") return;
    const plan = plans.find((item) => item.id === planId);
    if (plan && includesPlan(currentPlan, plan.name)) { setMessage(locale === "nl" ? "Dit pakket is al actief op je account." : "This plan is already active on your account."); return; }
    if (plan?.name === "Premium" && !centreId) { setMessage("Choose your centre before buying Premium."); return; }
    setBusy(planId); setMessage("");
    const response = await authFetch(`${API}/checkout`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ planId, centreId: plan?.name === "Premium" ? centreId : undefined, schoolId: schoolBilling ? school?.id : undefined }) });
    const payload = await response.json().catch(() => null);
    setBusy("");
    if (response.ok && payload?.checkoutUrl) { window.location.assign(payload.checkoutUrl as string); return; }
    setMessage(response.ok ? (locale === "nl" ? "Checkout gestart. Volg de instructies van de betalingsprovider." : "Checkout started. Follow the payment provider instructions.") : payload?.message ?? (locale === "nl" ? "Checkout is nog niet beschikbaar." : "Checkout is not available yet."));
  }

  return <section className="account-card billing-panel" id="billing"><div className="account-card-heading"><div><span className="small-label">{copy.billing}</span><h2>{currentPlan !== "Free" ? `${currentPlan} · ${locale === "nl" ? "Toegang beheren" : "Manage access"}` : copy.billingTitle}</h2></div><span className="subscription-status free">{copy.secureCheckout}</span></div><p className="billing-intro">{planState !== "ready" ? (locale === "nl" ? "Je toegang controleren…" : "Checking your access…") : currentPlan === "Diamond" ? (locale === "nl" ? "Je toegang tot alle centra is actief. Premium is inbegrepen; je hoeft niet opnieuw te kopen." : "Your all-centre access is active. Premium is included; you do not need to buy again.") : currentPlan === "Premium" ? (locale === "nl" ? "Je toegang tot je geselecteerde centrum is actief. Diamond is een optionele upgrade naar alle centra." : "Your selected-centre access is active. Diamond is an optional upgrade to all centres.") : copy.billingIntro}</p><label>Premium exam centre<select value={centreId} disabled={currentPlan === "Diamond" || (currentPlan === "Premium" && Boolean(boundCentre))} onChange={e => setCentreId(e.target.value)}><option value="">Choose centre</option>{centres.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><p>Premium is tied to this centre for the access period. Diamond covers all centres.</p>{currentPlan === "Premium" && !boundCentre && <button className="button button-small" disabled={!centreId} onClick={() => void authFetch(`${API}/me/subscription/centre`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ centreId }) }).then(async r => { const p = await r.json(); if (!r.ok) throw Error(p.message); setBoundCentre(p.centreId); setMessage("Your Premium centre is selected."); }).catch(e => setMessage(e.message))}>Confirm Premium centre</button>}{school && <label><input type="checkbox" checked={schoolBilling} onChange={e => setSchoolBilling(e.target.checked)} /> Record this account purchase under {school.name}</label>}{plans.length ? <div className="billing-plan-list">{plans.map((plan) => { const active = includesPlan(currentPlan, plan.name); return <article className="billing-plan" key={plan.id}><div><strong>{plan.name}</strong><small>{Math.round(plan.durationHours / 24)} {locale === "nl" ? "dagen toegang" : "days access"}</small></div><strong>{money(plan.priceCents, plan.currency)}</strong><button className="button button-small" disabled={planState !== "ready" || busy === plan.id || active} onClick={() => void checkout(plan.id)}>{active ? (plan.name === currentPlan ? (locale === "nl" ? "Actief" : "Active") : (locale === "nl" ? "Inbegrepen" : "Included")) : busy === plan.id ? copy.opening : copy.choosePlan}</button></article>; })}</div> : <p className="billing-empty">{copy.noPlans}</p>}{message && <p className="account-message account-success-text">{message}</p>}{(payments.length || invoices.length) ? <div className="billing-history"><div><span className="small-label">{copy.paymentHistory}</span>{payments.slice(0, 4).map((payment) => <p key={payment.id}><strong>{payment.planName}</strong> · {money(payment.amountCents, payment.currency)} · {payment.status}</p>)}</div><div><span className="small-label">{copy.invoices}</span>{invoices.slice(0, 4).map((invoice) => <p key={invoice.id}>{invoice.number || (locale === "nl" ? "Factuur" : "Invoice")} · {money(invoice.amountCents, invoice.currency)} · {invoice.status}</p>)}</div></div> : null}</section>;
}
