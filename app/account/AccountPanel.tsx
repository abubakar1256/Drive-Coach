"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocaleMessages } from "../../lib/useLocale";
import { useCurrentLocale, useSiteCopy } from "../../lib/useLocale";
import { authFetch, loginRedirectPath, SessionExpiredError } from "../../lib/clientSession";

type Account = { email: string; displayName: string | null; role: string; createdAt: string; emailVerified?: boolean; subscription: { status: string; planName: string; expiresAt: string | null } };
const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export default function AccountPanel() {
  const router = useRouter();
  const copy = useLocaleMessages();
  const locale = useCurrentLocale();
  const accountCopy = useSiteCopy().account;
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  async function loadAccount() {
    const token = window.sessionStorage.getItem("routepilot.accessToken");
    if (!token) { router.replace("/auth/login"); return; }
    try {
      const response = await authFetch(`${API}/auth/me`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(locale === "nl" ? "Je sessie is verlopen. Log opnieuw in." : "Your session has expired. Please log in again.");
      setAccount(payload as Account);
      window.sessionStorage.setItem("routepilot.user", JSON.stringify(payload));
    } catch (caught) {
      if (caught instanceof SessionExpiredError) { router.replace(loginRedirectPath()); return; }
      setError(caught instanceof Error ? caught.message : locale === "nl" ? "Je account kon niet worden geladen." : "Unable to load your account");
    }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadAccount(); }, []);

  async function changePassword(event: FormEvent) {
    event.preventDefault(); setError(""); setSuccess("");
    if (passwords.newPassword !== passwords.confirmPassword) { setError(locale === "nl" ? "Nieuw wachtwoord en bevestiging komen niet overeen." : "New password and confirmation do not match."); return; }
    try {
      const response = await authFetch(`${API}/auth/change-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(Array.isArray(payload?.message) ? payload.message[0] : payload?.message ?? (locale === "nl" ? "Wachtwoord wijzigen lukt niet." : "Unable to change password"));
      setSuccess(payload.message); setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      window.sessionStorage.removeItem("routepilot.accessToken"); window.sessionStorage.removeItem("routepilot.refreshToken");
    } catch (caught) {
      if (caught instanceof SessionExpiredError) { router.replace(loginRedirectPath()); return; }
      setError(caught instanceof Error ? caught.message : locale === "nl" ? "Wachtwoord wijzigen lukt niet." : "Unable to change password");
    }
  }

  async function logout() {
    const refreshToken = window.sessionStorage.getItem("routepilot.refreshToken");
    if (refreshToken) await fetch(`${API}/auth/logout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken }) }).catch(() => undefined);
    window.sessionStorage.clear(); router.replace("/");
  }

  if (loading) return <div className="account-state">{locale === "nl" ? "Account wordt geladen…" : "Loading your account…"}</div>;
  if (!account) return <div className="account-state account-error"><strong>{error || (locale === "nl" ? "Account niet beschikbaar" : "Account unavailable")}</strong><Link className="button button-small" href="/auth/login">{locale === "nl" ? "Opnieuw inloggen" : "Log in again"} <span>↗</span></Link></div>;
  const created = new Intl.DateTimeFormat(locale === "nl" ? "nl-BE" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(account.createdAt));
  const isPremium = account.subscription.status === "ACTIVE" && account.subscription.planName.toLowerCase() !== "free";
  return <div className="account-grid"><section className="account-card account-details-card"><div className="account-card-heading"><div><span className="small-label">{copy.accountDetails.toUpperCase()}</span><h2>{account.displayName || copy.accountDetails}</h2></div><span className="account-avatar">{(account.displayName || account.email).slice(0, 1).toUpperCase()}</span></div><dl className="account-details"><div><dt>{copy.emailAddress}</dt><dd>{account.email}<span className="verified-label">✓ {accountCopy.verified}</span></dd></div><div><dt>{accountCopy.created}</dt><dd>{created}</dd></div></dl></section><section className="account-card subscription-card"><div className="account-card-heading"><div><span className="small-label">{copy.subscription.toUpperCase()}</span><h2>{isPremium ? account.subscription.planName : accountCopy.free}</h2></div><span className={`subscription-status ${isPremium ? "premium" : "free"}`}>{isPremium ? accountCopy.premium : accountCopy.free}</span></div><p>{isPremium ? accountCopy.premiumDescription : accountCopy.freeDescription}</p>{isPremium ? <p className="subscription-expiry">{accountCopy.validUntil} {account.subscription.expiresAt ? new Date(account.subscription.expiresAt).toLocaleDateString("en-GB") : "—"}</p> : <Link className="button button-small" href="/#pricing">{copy.premiumAccess} <span>↗</span></Link>}</section><section className="account-card password-card"><div className="account-card-heading"><div><span className="small-label">{copy.security.toUpperCase()}</span><h2>{copy.changePassword}</h2></div></div><form className="account-form" onSubmit={changePassword}><label>{copy.currentPassword}<input type="password" required minLength={8} value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} /></label><label>{copy.newPassword}<input type="password" required minLength={8} value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} /></label><label>{copy.confirmPassword}<input type="password" required minLength={8} value={passwords.confirmPassword} onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })} /></label>{error && <p className="account-message account-error-text">{error}</p>}{success && <p className="account-message account-success-text">{success}</p>}<button className="button button-small" type="submit">{copy.changePassword} <span>↗</span></button></form></section><section className="account-card actions-card"><span className="small-label">{accountCopy.actions}</span><button className="account-logout" onClick={() => void logout()}>{copy.logOut} <span>→</span></button></section></div>;
}
