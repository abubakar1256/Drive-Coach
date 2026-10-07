"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useCurrentLocale } from "../../lib/useLocale";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

type Overview = {
  users: number;
  publishedCentres: number;
  routes: number;
  publishedRoutes: number;
  subscriptions: Array<{ status: string; count: number }>;
  practice: { sessions: number; averageCompletion: number; reflections: number };
  analytics: {
    pageViews: number;
    centreViews: number;
    routeViews: number;
    revenue: Array<{ currency: string; totalCents: number }>;
    failedPayments: number;
    popularCentres: Array<{ slug: string; views: number }>;
    popularRoutes: Array<{ slug: string; views: number }>;
  };
};
type UserRow = { id: string; email: string; displayName: string | null; role: string; emailVerifiedAt: string | null; createdAt: string; favoriteCount: number; practiceSessionCount: number };
type PaymentRow = { id: string; amountCents: number; currency: string; status: string; provider: string; providerPaymentId?: string | null; createdAt: string; email: string; planName: string };
type AuditRow = { id: string; action: string; entity: string; entityId: string | null; metadata: unknown; createdAt: string; email: string | null };
type CommissionRow = { id: string; amountCents: number; commissionCents: number; status: string; createdAt: string; code: string; ownerEmail: string; referredEmail: string };

function date(value: string, locale: "en" | "nl" = "en") {
  return new Date(value).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function money(cents: number, currency = "EUR", locale: "en" | "nl" = "en") {
  return new Intl.NumberFormat(locale === "nl" ? "nl-BE" : "en-GB", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export default function AdminReports() {
  const nl = useCurrentLocale() === "nl";
  const tr = (english: string, dutch: string) => nl ? dutch : english;
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [coupon, setCoupon] = useState({ code: "", percentOff: "", amountOffCents: "", expiresAt: "" });
  const [toolMessage, setToolMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      let token = window.sessionStorage.getItem("routepilot.accessToken");
      if (!token) throw new Error(tr("Please log in with an admin account first.", "Log eerst in met een adminaccount."));
      const refreshToken = window.sessionStorage.getItem("routepilot.refreshToken");
      const call = (accessToken: string, path: string) => fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const load = async (accessToken: string) => Promise.all([
        call(accessToken, "/admin/reports/overview"),
        call(accessToken, "/admin/users"),
        call(accessToken, "/admin/payments"),
        call(accessToken, "/admin/audit-logs"),
        call(accessToken, "/admin/commissions"),
      ]);
      let responses = await load(token);
      if (responses.some((response) => response.status === 401) && refreshToken) {
        const refreshed = await fetch(`${API}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken }) });
        const payload = await refreshed.json().catch(() => null);
        if (!refreshed.ok || !payload?.accessToken) throw new Error(tr("Session expired. Please log in again.", "Sessie verlopen. Log opnieuw in."));
        token = payload.accessToken as string;
        window.sessionStorage.setItem("routepilot.accessToken", token);
        if (payload.refreshToken) window.sessionStorage.setItem("routepilot.refreshToken", payload.refreshToken);
        responses = await load(token);
      }
      const bodies = await Promise.all(responses.map(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.message ?? tr("Unable to load admin reports.", "Adminrapporten konden niet worden geladen."));
        return body;
      }));
      setOverview(bodies[0] as Overview); setUsers(bodies[1] as UserRow[]); setPayments(bodies[2] as PaymentRow[]); setAudit(bodies[3] as AuditRow[]); setCommissions(bodies[4] as CommissionRow[]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr("Unable to load admin reports.", "Adminrapporten konden niet worden geladen.")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function adminRequest(path: string, options: RequestInit = {}) {
    const token = window.sessionStorage.getItem("routepilot.accessToken");
    if (!token) throw new Error(tr("Admin session expired.", "Adminsessie verlopen."));
    const response = await fetch(`${API}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers ?? {}) } });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message ?? tr("Admin action failed.", "Adminactie mislukt."));
    return payload;
  }

  async function createCoupon(event: FormEvent) {
    event.preventDefault(); setToolMessage("");
    try { await adminRequest("/admin/coupons", { method: "POST", body: JSON.stringify({ code: coupon.code, percentOff: coupon.percentOff ? Number(coupon.percentOff) : undefined, amountOffCents: coupon.amountOffCents ? Number(coupon.amountOffCents) : undefined, expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString() : undefined }) }); setCoupon({ code: "", percentOff: "", amountOffCents: "", expiresAt: "" }); setToolMessage(tr("Coupon created and ready for validation.", "Coupon aangemaakt en klaar voor controle.")); } catch (caught) { setToolMessage(caught instanceof Error ? caught.message : tr("Unable to create coupon.", "Coupon kon niet worden aangemaakt.")); }
  }

  async function refund(payment: PaymentRow) {
    if (!window.confirm(`${tr("Refund", "Terugbetaling")} ${money(payment.amountCents, payment.currency, nl ? "nl" : "en")} ${tr("for", "voor")} ${payment.email}?`)) return;
    setToolMessage("");
    try { await adminRequest(`/admin/payments/${payment.id}/refund`, { method: "POST" }); setToolMessage(tr("Refund requested successfully.", "Terugbetaling aangevraagd.")); await refresh(); } catch (caught) { setToolMessage(caught instanceof Error ? caught.message : tr("Unable to refund payment.", "Terugbetaling kon niet worden aangevraagd.")); }
  }

  async function updateRole(user: UserRow, role: string) {
    setToolMessage("");
    try { await adminRequest(`/admin/users/${user.id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }); setToolMessage(`${tr("Role updated for", "Rol bijgewerkt voor")} ${user.email}.`); await refresh(); } catch (caught) { setToolMessage(caught instanceof Error ? caught.message : tr("Unable to update user role.", "Gebruikersrol kon niet worden bijgewerkt.")); }
  }

  if (loading && !overview) return <section className="admin-reports"><div className="admin-reports-heading"><div><span className="small-label">{tr("OPERATIONS", "BEHEER")}</span><h2>{tr("Platform overview", "Platformoverzicht")}</h2></div></div><div className="admin-state">{tr("Loading platform reports…", "Platformrapporten laden…")}</div></section>;
  if (error && !overview) return <section className="admin-reports"><div className="admin-reports-heading"><div><span className="small-label">{tr("OPERATIONS", "BEHEER")}</span><h2>{tr("Platform overview", "Platformoverzicht")}</h2></div></div><div className="admin-report-error"><strong>{tr("Reports unavailable", "Rapporten niet beschikbaar")}</strong><span>{error}</span><button className="button button-small" onClick={() => void refresh()}>{tr("Try again", "Opnieuw proberen")}</button></div></section>;
  if (!overview) return null;

  return <section className="admin-reports">
    <div className="admin-reports-heading"><div><span className="small-label">{tr("OPERATIONS", "BEHEER")}</span><h2>{tr("Platform overview", "Platformoverzicht")}</h2><p>{tr("Keep an eye on preparation activity, access and content quality.", "Volg de voorbereidingsactiviteit, toegang en kwaliteit van de inhoud.")}</p></div><button className="admin-refresh admin-report-refresh" onClick={() => void refresh()} aria-label={tr("Refresh platform reports", "Platformrapporten vernieuwen")}>↻ {loading ? tr("Refreshing", "Vernieuwen…") : tr("Refresh", "Vernieuwen")}</button></div>
    <div className="admin-metric-grid"><Metric label={tr("Registered users", "Geregistreerde gebruikers")} value={overview.users} /><Metric label={tr("Published centres", "Gepubliceerde centra")} value={overview.publishedCentres} /><Metric label={tr("Published routes", "Gepubliceerde routes")} value={`${overview.publishedRoutes}/${overview.routes}`} /><Metric label={tr("Practice sessions", "Oefensessies")} value={overview.practice.sessions} /><Metric label={tr("Avg. completion", "Gemiddeld voltooid")} value={`${overview.practice.averageCompletion}%`} /><Metric label={tr("Reflections", "Reflecties")} value={overview.practice.reflections} /><Metric label={tr("Page views", "Paginaweergaven")} value={overview.analytics.pageViews} /><Metric label={tr("Centre views", "Centrumweergaven")} value={overview.analytics.centreViews} /><Metric label={tr("Route views", "Routeweergaven")} value={overview.analytics.routeViews} /><Metric label={tr("Failed payments", "Mislukte betalingen")} value={overview.analytics.failedPayments} /></div>
    <form className="admin-billing-tools" onSubmit={createCoupon}><div><span className="small-label">{tr("BILLING TOOLS", "FACTURATIETOOLS")}</span><strong>{tr("Create coupon", "Coupon maken")}</strong></div><input required placeholder="CODE" value={coupon.code} onChange={(event) => setCoupon({ ...coupon, code: event.target.value })} /><input type="number" min="1" max="100" placeholder="% off" value={coupon.percentOff} onChange={(event) => setCoupon({ ...coupon, percentOff: event.target.value })} /><input type="number" min="1" placeholder={nl ? "Korting in centen" : "Cents off"} value={coupon.amountOffCents} onChange={(event) => setCoupon({ ...coupon, amountOffCents: event.target.value })} /><input type="date" value={coupon.expiresAt} onChange={(event) => setCoupon({ ...coupon, expiresAt: event.target.value })} /><button className="button button-small" type="submit">{tr("Create coupon", "Coupon maken")}</button>{toolMessage && <span className="admin-tool-message">{toolMessage}</span>}</form>
    <div className="admin-report-grid">
      <ReportCard title={tr("Users", "Gebruikers")} caption={`${users.length} ${tr("latest accounts", "recente accounts")}`}><div className="admin-report-table">{users.length ? users.slice(0, 8).map((user) => <div className="admin-report-row" key={user.id}><div><strong>{user.displayName || user.email}</strong><small>{user.displayName ? user.email : tr("No display name", "Geen weergavenaam")} · {tr("joined", "aangemaakt")} {date(user.createdAt, nl ? "nl" : "en")}</small></div><div className="admin-user-actions"><select className="admin-role-select" aria-label={`${tr("Role for", "Rol voor")} ${user.email}`} value={user.role} onChange={(event) => void updateRole(user, event.target.value)}><option value="LEARNER">{tr("Learner", "Leerling")}</option><option value="CONTENT_MANAGER">{tr("Content manager", "Contentbeheerder")}</option><option value="ADMIN">Admin</option><option value="SUPER_ADMIN">Super admin</option></select><span className="admin-row-meta">{user.practiceSessionCount} {tr("sessions", "sessies")}</span></div></div>) : <Empty text={tr("No users yet.", "Nog geen gebruikers.")} />}</div></ReportCard>
      <ReportCard title={tr("Payments", "Betalingen")} caption={`${payments.length} ${tr("latest transactions", "recente transacties")}`}><div className="admin-report-table">{payments.length ? payments.slice(0, 8).map((payment) => <div className="admin-report-row" key={payment.id}><div><strong>{payment.planName} · {money(payment.amountCents, payment.currency, nl ? "nl" : "en")}</strong><small>{payment.email} · {date(payment.createdAt, nl ? "nl" : "en")}</small></div><span className={`report-status status-${payment.status.toLowerCase()}`}>{payment.status}</span>{payment.status === "SUCCEEDED" && payment.providerPaymentId && <button className="report-action" onClick={() => void refund(payment)}>{tr("Refund", "Terugbetalen")}</button>}</div>) : <Empty text={tr("No payment records yet. Stripe can be connected when credentials are ready.", "Nog geen betaalgegevens. Stripe kan worden verbonden zodra de gegevens klaar zijn.")} />}</div></ReportCard>
      <ReportCard title={tr("Referral commissions", "Doorverwijzingscommissies")} caption={`${commissions.length} ${tr("latest records", "recente records")}`}><div className="admin-report-table">{commissions.length ? commissions.slice(0, 8).map((commission) => <div className="admin-report-row" key={commission.id}><div><strong>{commission.code} · {money(commission.commissionCents, "EUR", nl ? "nl" : "en")}</strong><small>{commission.ownerEmail} → {commission.referredEmail}</small></div><span className="report-status">{commission.status}</span></div>) : <Empty text={tr("No commission records yet.", "Nog geen commissierecords.")} />}</div></ReportCard>
      <ReportCard title={tr("Audit activity", "Auditactiviteit")} caption={`${audit.length} ${tr("latest events", "recente gebeurtenissen")}`}><div className="admin-report-table">{audit.length ? audit.slice(0, 8).map((entry) => <div className="admin-report-row" key={entry.id}><div><strong>{entry.action} · {entry.entity}</strong><small>{entry.email || tr("System", "Systeem")} · {date(entry.createdAt, nl ? "nl" : "en")}</small></div><span className="admin-row-meta">{entry.entityId ? entry.entityId.slice(0, 8) : "—"}</span></div>) : <Empty text={tr("No audit events yet.", "Nog geen auditgebeurtenissen.")} />}</div></ReportCard>
      <ReportCard title={tr("Popular content", "Populaire inhoud")} caption={tr("Views from public centre and route pages", "Weergaven van openbare centrum- en routepagina's")}><div className="admin-popular-grid"><div><strong>{tr("Centres", "Centra")}</strong>{overview.analytics.popularCentres.length ? overview.analytics.popularCentres.map((item) => <div className="admin-popular-row" key={item.slug}><span>{item.slug}</span><b>{item.views}</b></div>) : <Empty text={tr("No centre views yet.", "Nog geen centrumweergaven.")} />}</div><div><strong>{tr("Routes", "Routes")}</strong>{overview.analytics.popularRoutes.length ? overview.analytics.popularRoutes.map((item) => <div className="admin-popular-row" key={item.slug}><span>{item.slug}</span><b>{item.views}</b></div>) : <Empty text={tr("No route views yet.", "Nog geen routeweergaven.")} />}</div></div></ReportCard>
      <ReportCard title={tr("Revenue", "Omzet")} caption={tr("Successful payment totals", "Totalen van geslaagde betalingen")}><div className="admin-report-table">{overview.analytics.revenue.length ? overview.analytics.revenue.map((item) => <div className="admin-report-row" key={item.currency}><strong>{money(item.totalCents, item.currency, nl ? "nl" : "en")}</strong><span className="admin-row-meta">{item.currency}</span></div>) : <Empty text={tr("No successful payments yet.", "Nog geen geslaagde betalingen.")} />}</div></ReportCard>
    </div>
  </section>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="admin-metric"><span>{label}</span><strong>{value}</strong></div>; }
function ReportCard({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) { return <section className="admin-report-card"><div className="admin-report-card-heading"><div><h3>{title}</h3><span>{caption}</span></div></div>{children}</section>; }
function Empty({ text }: { text: string }) { return <p className="admin-report-empty">{text}</p>; }
