"use client";

import { useEffect, useState } from "react";
import { useCurrentLocale, useSiteCopy } from "../../lib/useLocale";
import { authFetch } from "../../lib/clientSession";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type Plan = { id: string; name: string; durationHours: number; priceCents: number; currency: string };
type Payment = { id: string; amountCents: number; currency: string; status: string; provider: string; createdAt: string; planName: string };
type Invoice = { id: string; number: string | null; amountCents: number; currency: string; status: string; invoiceUrl: string | null; issuedAt: string; paidAt: string | null };

function money(cents: number, currency: string) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100); }

export default function BillingPanel() {
  const locale = useCurrentLocale();
  const copy = useSiteCopy().account;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currentPlan, setCurrentPlan] = useState("Free");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = window.sessionStorage.getItem("routepilot.accessToken");
    if (!token) return;
    Promise.all([fetch(`${API}/plans`), authFetch(`${API}/me/subscription`), authFetch(`${API}/me/payments`), authFetch(`${API}/me/invoices`)]).then(async ([planResponse, subscriptionResponse, paymentResponse, invoiceResponse]) => {
      const [planData, subscriptionData, paymentData, invoiceData] = await Promise.all([planResponse.json(), subscriptionResponse.json(), paymentResponse.json(), invoiceResponse.json()]);
      setPlans((planData as Plan[]).filter((plan) => plan.name === "Premium" || plan.name === "Diamond"));
      setCurrentPlan((subscriptionData as { plan?: string }).plan ?? "Free");
      if (paymentResponse.ok) setPayments(paymentData as Payment[]);
      if (invoiceResponse.ok) setInvoices(invoiceData as Invoice[]);
    }).catch(() => setMessage(locale === "nl" ? "Facturatiegegevens zijn tijdelijk niet beschikbaar." : "Billing information is temporarily unavailable."));
  }, []);

  async function checkout(planId: string) {
    const token = window.sessionStorage.getItem("routepilot.accessToken");
    if (!token) return;
    const plan = plans.find((item) => item.id === planId);
    if (plan?.name === currentPlan && currentPlan !== "Free") { setMessage(locale === "nl" ? "Dit pakket is al actief op je account." : "This plan is already active on your account."); return; }
    setBusy(planId); setMessage("");
    const response = await fetch(`${API}/checkout`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ planId }) });
    const payload = await response.json().catch(() => null);
    setBusy("");
    if (response.ok && payload?.checkoutUrl) { window.location.assign(payload.checkoutUrl as string); return; }
    setMessage(response.ok ? (locale === "nl" ? "Checkout gestart. Volg de instructies van de betalingsprovider." : "Checkout started. Follow the payment provider instructions.") : payload?.message ?? (locale === "nl" ? "Checkout is nog niet beschikbaar." : "Checkout is not available yet."));
  }

  return <section className="account-card billing-panel" id="billing"><div className="account-card-heading"><div><span className="small-label">{copy.billing}</span><h2>{copy.billingTitle}</h2></div><span className="subscription-status free">{copy.secureCheckout}</span></div><p className="billing-intro">{copy.billingIntro}</p>{plans.length ? <div className="billing-plan-list">{plans.map((plan) => { const active = plan.name === currentPlan && currentPlan !== "Free"; return <article className="billing-plan" key={plan.id}><div><strong>{plan.name}</strong><small>{Math.round(plan.durationHours / 24)} {locale === "nl" ? "dagen toegang" : "days access"}</small></div><strong>{money(plan.priceCents, plan.currency)}</strong><button className="button button-small" disabled={busy === plan.id || active} onClick={() => void checkout(plan.id)}>{active ? (locale === "nl" ? "Actief" : "Active") : busy === plan.id ? copy.opening : copy.choosePlan}</button></article>; })}</div> : <p className="billing-empty">{copy.noPlans}</p>}{message && <p className="account-message account-success-text">{message}</p>}{(payments.length || invoices.length) ? <div className="billing-history"><div><span className="small-label">{copy.paymentHistory}</span>{payments.slice(0, 4).map((payment) => <p key={payment.id}><strong>{payment.planName}</strong> · {money(payment.amountCents, payment.currency)} · {payment.status}</p>)}</div><div><span className="small-label">{copy.invoices}</span>{invoices.slice(0, 4).map((invoice) => <p key={invoice.id}>{invoice.number || (locale === "nl" ? "Factuur" : "Invoice")} · {money(invoice.amountCents, invoice.currency)} · {invoice.status}</p>)}</div></div> : null}</section>;
}
