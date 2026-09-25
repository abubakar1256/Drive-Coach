"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocaleMessages } from "../../lib/useLocale";

type Account = { email: string; displayName: string | null; role: string; createdAt: string; emailVerified?: boolean; subscription: { status: string; planName: string; expiresAt: string | null } };
const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export default function AccountPanel() {
  const router = useRouter();
  const copy = useLocaleMessages();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  async function loadAccount() {
    const token = window.sessionStorage.getItem("routepilot.accessToken");
    if (!token) { router.replace("/auth/login"); return; }
    try {
      const response = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error("Your session has expired. Please log in again.");
      setAccount(payload as Account);
      window.sessionStorage.setItem("routepilot.user", JSON.stringify(payload));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load your account"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadAccount(); }, []);

  async function changePassword(event: FormEvent) {
    event.preventDefault(); setError(""); setSuccess("");
    if (passwords.newPassword !== passwords.confirmPassword) { setError("New password and confirmation do not match."); return; }
    try {
      const token = window.sessionStorage.getItem("routepilot.accessToken");
      const response = await fetch(`${API}/auth/change-password`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(Array.isArray(payload?.message) ? payload.message[0] : payload?.message ?? "Unable to change password");
      setSuccess(payload.message); setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      window.sessionStorage.removeItem("routepilot.accessToken"); window.sessionStorage.removeItem("routepilot.refreshToken");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to change password"); }
  }

  async function logout() {
    const refreshToken = window.sessionStorage.getItem("routepilot.refreshToken");
    if (refreshToken) await fetch(`${API}/auth/logout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken }) }).catch(() => undefined);
    window.sessionStorage.clear(); router.replace("/");
  }

  if (loading) return <div className="account-state">Loading your account…</div>;
  if (!account) return <div className="account-state account-error"><strong>{error || "Account unavailable"}</strong><Link className="button button-small" href="/auth/login">Log in again <span>↗</span></Link></div>;
  const created = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(account.createdAt));
  const isPremium = account.subscription.status === "ACTIVE" && account.subscription.planName.toLowerCase() !== "free";
  return <div className="account-grid"><section className="account-card account-details-card"><div className="account-card-heading"><div><span className="small-label">{copy.accountDetails.toUpperCase()}</span><h2>{account.displayName || copy.accountDetails}</h2></div><span className="account-avatar">{(account.displayName || account.email).slice(0, 1).toUpperCase()}</span></div><dl className="account-details"><div><dt>{copy.emailAddress}</dt><dd>{account.email}<span className="verified-label">✓ Verified</span></dd></div><div><dt>Account created</dt><dd>{created}</dd></div></dl></section><section className="account-card subscription-card"><div className="account-card-heading"><div><span className="small-label">{copy.subscription.toUpperCase()}</span><h2>{isPremium ? account.subscription.planName : "Free"}</h2></div><span className={`subscription-status ${isPremium ? "premium" : "free"}`}>{isPremium ? "Premium" : "Free"}</span></div><p>{isPremium ? "Your premium preparation access is active." : "Browse centres and preview routes for free. Upgrade when you are ready for full route access."}</p>{isPremium ? <p className="subscription-expiry">Valid until {account.subscription.expiresAt ? new Date(account.subscription.expiresAt).toLocaleDateString("en-GB") : "—"}</p> : <Link className="button button-small" href="/#pricing">{copy.premiumAccess} <span>↗</span></Link>}</section><section className="account-card password-card"><div className="account-card-heading"><div><span className="small-label">{copy.security.toUpperCase()}</span><h2>{copy.changePassword}</h2></div></div><form className="account-form" onSubmit={changePassword}><label>{copy.currentPassword}<input type="password" required minLength={8} value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} /></label><label>{copy.newPassword}<input type="password" required minLength={8} value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} /></label><label>{copy.confirmPassword}<input type="password" required minLength={8} value={passwords.confirmPassword} onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })} /></label>{error && <p className="account-message account-error-text">{error}</p>}{success && <p className="account-message account-success-text">{success}</p>}<button className="button button-small" type="submit">{copy.changePassword} <span>↗</span></button></form></section><section className="account-card actions-card"><span className="small-label">ACTIONS</span><button className="account-logout" onClick={() => void logout()}>{copy.logOut} <span>→</span></button></section></div>;
}
