"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type Plan = { id: string; name: string; durationHours: number; priceCents: number; currency: string };
type Payment = { id: string; amountCents: number; currency: string; status: string; provider: string; createdAt: string; planName: string };
type Invoice = { id: string; number: string | null; amountCents: number; currency: string; status: string; invoiceUrl: string | null; issuedAt: string; paidAt: string | null };

function money(cents: number, currency: string) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100); }

export default function BillingPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = window.sessionStorage.getItem("routepilot.accessToken");
    if (!token) return;
    Promise.all([fetch(`${API}/plans`), fetch(`${API}/me/payments`, { headers: { Authorization: `Bearer ${token}` } }), fetch(`${API}/me/invoices`, { headers: { Authorization: `Bearer ${token}` } })]).then(async ([planResponse, paymentResponse, invoiceResponse]) => {
      const [planData, paymentData, invoiceData] = await Promise.all([planResponse.json(), paymentResponse.json(), invoiceResponse.json()]);
      setPlans((planData as Plan[]).filter((plan) => plan.name === "Premium" || plan.name === "Diamond"));
      if (paymentResponse.ok) setPayments(paymentData as Payment[]);
      if (invoiceResponse.ok) setInvoices(invoiceData as Invoice[]);
    }).catch(() => setMessage("Billing information is temporarily unavailable."));
  }, []);

  async function checkout(planId: string) {
    const token = window.sessionStorage.getItem("routepilot.accessToken");
    if (!token) return;
    setBusy(planId); setMessage("");
    const response = await fetch(`${API}/checkout`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ planId }) });
    const payload = await response.json().catch(() => null);
    setBusy("");
    setMessage(response.ok ? "Checkout started. Follow the payment provider instructions." : payload?.message ?? "Checkout is not available yet.");
  }

  return <section className="account-card billing-panel"><div className="account-card-heading"><div><span className="small-label">BILLING</span><h2>Premium access</h2></div><span className="subscription-status free">Secure checkout</span></div><p className="billing-intro">Unlock full route media and priority preparation features when live billing is connected.</p>{plans.length ? <div className="billing-plan-list">{plans.map((plan) => <article className="billing-plan" key={plan.id}><div><strong>{plan.name}</strong><small>{Math.round(plan.durationHours / 24)} days access</small></div><strong>{money(plan.priceCents, plan.currency)}</strong><button className="button button-small" disabled={busy === plan.id} onClick={() => void checkout(plan.id)}>{busy === plan.id ? "Opening…" : "Choose plan"}</button></article>)}</div> : <p className="billing-empty">No paid plans are configured yet.</p>}{message && <p className="account-message account-success-text">{message}</p>}{(payments.length || invoices.length) ? <div className="billing-history"><div><span className="small-label">PAYMENT HISTORY</span>{payments.slice(0, 4).map((payment) => <p key={payment.id}><strong>{payment.planName}</strong> · {money(payment.amountCents, payment.currency)} · {payment.status}</p>)}</div><div><span className="small-label">INVOICES</span>{invoices.slice(0, 4).map((invoice) => <p key={invoice.id}>{invoice.number || "Invoice"} · {money(invoice.amountCents, invoice.currency)} · {invoice.status}</p>)}</div></div> : null}</section>;
}
