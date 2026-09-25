"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

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

function date(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function money(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export default function AdminReports() {
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
      if (!token) throw new Error("Please log in with an admin account first.");
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
        if (!refreshed.ok || !payload?.accessToken) throw new Error("Session expired. Please log in again.");
        token = payload.accessToken as string;
        window.sessionStorage.setItem("routepilot.accessToken", token);
        if (payload.refreshToken) window.sessionStorage.setItem("routepilot.refreshToken", payload.refreshToken);
        responses = await load(token);
      }
      const bodies = await Promise.all(responses.map(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.message ?? "Unable to load admin reports.");
        return body;
      }));
      setOverview(bodies[0] as Overview); setUsers(bodies[1] as UserRow[]); setPayments(bodies[2] as PaymentRow[]); setAudit(bodies[3] as AuditRow[]); setCommissions(bodies[4] as CommissionRow[]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load admin reports."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function adminRequest(path: string, options: RequestInit = {}) {
    const token = window.sessionStorage.getItem("routepilot.accessToken");
    if (!token) throw new Error("Admin session expired.");
    const response = await fetch(`${API}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers ?? {}) } });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message ?? "Admin action failed.");
    return payload;
  }

  async function createCoupon(event: FormEvent) {
    event.preventDefault(); setToolMessage("");
    try { await adminRequest("/admin/coupons", { method: "POST", body: JSON.stringify({ code: coupon.code, percentOff: coupon.percentOff ? Number(coupon.percentOff) : undefined, amountOffCents: coupon.amountOffCents ? Number(coupon.amountOffCents) : undefined, expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString() : undefined }) }); setCoupon({ code: "", percentOff: "", amountOffCents: "", expiresAt: "" }); setToolMessage("Coupon created and ready for validation."); } catch (caught) { setToolMessage(caught instanceof Error ? caught.message : "Unable to create coupon."); }
  }

  async function refund(payment: PaymentRow) {
    if (!window.confirm(`Refund ${money(payment.amountCents, payment.currency)} for ${payment.email}?`)) return;
    setToolMessage("");
    try { await adminRequest(`/admin/payments/${payment.id}/refund`, { method: "POST" }); setToolMessage("Refund requested successfully."); await refresh(); } catch (caught) { setToolMessage(caught instanceof Error ? caught.message : "Unable to refund payment."); }
  }

  async function updateRole(user: UserRow, role: string) {
    setToolMessage("");
    try { await adminRequest(`/admin/users/${user.id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }); setToolMessage(`Role updated for ${user.email}.`); await refresh(); } catch (caught) { setToolMessage(caught instanceof Error ? caught.message : "Unable to update user role."); }
  }

  if (loading && !overview) return <section className="admin-reports"><div className="admin-reports-heading"><div><span className="small-label">OPERATIONS</span><h2>Platform overview</h2></div></div><div className="admin-state">Loading platform reports…</div></section>;
  if (error && !overview) return <section className="admin-reports"><div className="admin-reports-heading"><div><span className="small-label">OPERATIONS</span><h2>Platform overview</h2></div></div><div className="admin-report-error"><strong>Reports unavailable</strong><span>{error}</span><button className="button button-small" onClick={() => void refresh()}>Try again</button></div></section>;
  if (!overview) return null;

  return <section className="admin-reports">
    <div className="admin-reports-heading"><div><span className="small-label">OPERATIONS</span><h2>Platform overview</h2><p>Keep an eye on preparation activity, access and content quality.</p></div><button className="admin-refresh admin-report-refresh" onClick={() => void refresh()} aria-label="Refresh platform reports">↻ {loading ? "Refreshing" : "Refresh"}</button></div>
    <div className="admin-metric-grid"><Metric label="Registered users" value={overview.users} /><Metric label="Published centres" value={overview.publishedCentres} /><Metric label="Published routes" value={`${overview.publishedRoutes}/${overview.routes}`} /><Metric label="Practice sessions" value={overview.practice.sessions} /><Metric label="Avg. completion" value={`${overview.practice.averageCompletion}%`} /><Metric label="Reflections" value={overview.practice.reflections} /><Metric label="Page views" value={overview.analytics.pageViews} /><Metric label="Centre views" value={overview.analytics.centreViews} /><Metric label="Route views" value={overview.analytics.routeViews} /><Metric label="Failed payments" value={overview.analytics.failedPayments} /></div>
    <form className="admin-billing-tools" onSubmit={createCoupon}><div><span className="small-label">BILLING TOOLS</span><strong>Create coupon</strong></div><input required placeholder="CODE" value={coupon.code} onChange={(event) => setCoupon({ ...coupon, code: event.target.value })} /><input type="number" min="1" max="100" placeholder="% off" value={coupon.percentOff} onChange={(event) => setCoupon({ ...coupon, percentOff: event.target.value })} /><input type="number" min="1" placeholder="Cents off" value={coupon.amountOffCents} onChange={(event) => setCoupon({ ...coupon, amountOffCents: event.target.value })} /><input type="date" value={coupon.expiresAt} onChange={(event) => setCoupon({ ...coupon, expiresAt: event.target.value })} /><button className="button button-small" type="submit">Create coupon</button>{toolMessage && <span className="admin-tool-message">{toolMessage}</span>}</form>
    <div className="admin-report-grid">
      <ReportCard title="Users" caption={`${users.length} latest accounts`}><div className="admin-report-table">{users.length ? users.slice(0, 8).map((user) => <div className="admin-report-row" key={user.id}><div><strong>{user.displayName || user.email}</strong><small>{user.displayName ? user.email : "No display name"} · joined {date(user.createdAt)}</small></div><div className="admin-user-actions"><select className="admin-role-select" aria-label={`Role for ${user.email}`} value={user.role} onChange={(event) => void updateRole(user, event.target.value)}><option value="LEARNER">Learner</option><option value="CONTENT_MANAGER">Content manager</option><option value="ADMIN">Admin</option><option value="SUPER_ADMIN">Super admin</option></select><span className="admin-row-meta">{user.practiceSessionCount} sessions</span></div></div>) : <Empty text="No users yet." />}</div></ReportCard>
      <ReportCard title="Payments" caption={`${payments.length} latest transactions`}><div className="admin-report-table">{payments.length ? payments.slice(0, 8).map((payment) => <div className="admin-report-row" key={payment.id}><div><strong>{payment.planName} · {money(payment.amountCents, payment.currency)}</strong><small>{payment.email} · {date(payment.createdAt)}</small></div><span className={`report-status status-${payment.status.toLowerCase()}`}>{payment.status}</span>{payment.status === "SUCCEEDED" && payment.providerPaymentId && <button className="report-action" onClick={() => void refund(payment)}>Refund</button>}</div>) : <Empty text="No payment records yet. Stripe can be connected when credentials are ready." />}</div></ReportCard>
      <ReportCard title="Referral commissions" caption={`${commissions.length} latest records`}><div className="admin-report-table">{commissions.length ? commissions.slice(0, 8).map((commission) => <div className="admin-report-row" key={commission.id}><div><strong>{commission.code} · {money(commission.commissionCents)}</strong><small>{commission.ownerEmail} → {commission.referredEmail}</small></div><span className="report-status">{commission.status}</span></div>) : <Empty text="No commission records yet." />}</div></ReportCard>
      <ReportCard title="Audit activity" caption={`${audit.length} latest events`}><div className="admin-report-table">{audit.length ? audit.slice(0, 8).map((entry) => <div className="admin-report-row" key={entry.id}><div><strong>{entry.action} · {entry.entity}</strong><small>{entry.email || "System"} · {date(entry.createdAt)}</small></div><span className="admin-row-meta">{entry.entityId ? entry.entityId.slice(0, 8) : "—"}</span></div>) : <Empty text="No audit events yet." />}</div></ReportCard>
      <ReportCard title="Popular content" caption="Views from public centre and route pages"><div className="admin-popular-grid"><div><strong>Centres</strong>{overview.analytics.popularCentres.length ? overview.analytics.popularCentres.map((item) => <div className="admin-popular-row" key={item.slug}><span>{item.slug}</span><b>{item.views}</b></div>) : <Empty text="No centre views yet." />}</div><div><strong>Routes</strong>{overview.analytics.popularRoutes.length ? overview.analytics.popularRoutes.map((item) => <div className="admin-popular-row" key={item.slug}><span>{item.slug}</span><b>{item.views}</b></div>) : <Empty text="No route views yet." />}</div></div></ReportCard>
      <ReportCard title="Revenue" caption="Successful payment totals"><div className="admin-report-table">{overview.analytics.revenue.length ? overview.analytics.revenue.map((item) => <div className="admin-report-row" key={item.currency}><strong>{money(item.totalCents, item.currency)}</strong><span className="admin-row-meta">{item.currency}</span></div>) : <Empty text="No successful payments yet." />}</div></ReportCard>
    </div>
  </section>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="admin-metric"><span>{label}</span><strong>{value}</strong></div>; }
function ReportCard({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) { return <section className="admin-report-card"><div className="admin-report-card-heading"><div><h3>{title}</h3><span>{caption}</span></div></div>{children}</section>; }
function Empty({ text }: { text: string }) { return <p className="admin-report-empty">{text}</p>; }
