"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import SiteFooter from "../../SiteFooter";
import { useSiteCopy } from "../../../lib/useLocale";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export default function ForgotPasswordPage() {
  const copy = useSiteCopy();
  const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const [developmentToken, setDevelopmentToken] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); setMessage(""); setDevelopmentToken(""); try { const response = await fetch(`${API}/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.message ?? copy.auth.invalidReset); setMessage(payload.message); if (payload.developmentToken) setDevelopmentToken(payload.developmentToken); } catch (caught) { setError(caught instanceof Error ? caught.message : copy.auth.invalidReset); } finally { setLoading(false); } }
  return <main className="auth-page"><nav className="nav shell auth-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link><Link className="back-link auth-back" href="/auth/login">← {copy.auth.returnLogin}</Link></nav><section className="auth-shell"><div className="auth-story"><p className="eyebrow"><span className="eyebrow-dot" /> {copy.auth.accountSecurity}</p><h1>{copy.auth.securityTitle}<br /><em>{copy.auth.securityAccent}</em></h1><p>{copy.auth.resetDescription}</p></div><div className="auth-card"><div className="auth-card-head"><span className="auth-kicker">{copy.auth.accountKicker}</span><h2>{copy.auth.resetTitle}</h2><p>{copy.auth.resetSubtitle}</p></div><form onSubmit={submit} className="auth-form"><label>{copy.auth.email}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={copy.auth.emailPlaceholder} required /></label>{error && <p className="auth-message auth-error">{error}</p>}{message && <p className="auth-message auth-success">{message}</p>}{developmentToken && <div className="auth-dev-token"><strong>{copy.auth.localToken}</strong><code>{developmentToken}</code><Link href={`/auth/reset-password?token=${developmentToken}`}>{copy.auth.continueReset} ↗</Link></div>}<button className="button button-full auth-submit" disabled={loading}>{loading ? copy.auth.wait : `${copy.auth.sendReset} ↗`}</button></form><p className="auth-switch"><Link href="/auth/login">{copy.auth.returnLogin}</Link></p></div></section><SiteFooter compact /></main>;
}
