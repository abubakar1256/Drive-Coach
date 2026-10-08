"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import SiteFooter from "../../SiteFooter";
import { useSiteCopy } from "../../../lib/useLocale";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export default function CheckEmailPage() {
  const copy = useSiteCopy();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") ?? "");
    setToken(params.get("token") ?? "");
  }, []);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${API}/auth/resend-verification`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(payload.message) ? payload.message[0] : payload.message ?? copy.auth.genericError);
      setMessage(payload.message ?? copy.auth.verificationSent);
      if (payload.developmentToken) setToken(payload.developmentToken);
    } catch (caught) { setError(caught instanceof Error ? caught.message : copy.auth.apiError); }
    finally { setLoading(false); }
  }

  return <main className="auth-page"><nav className="nav shell auth-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link><Link className="back-link auth-back" href="/auth/login">← {copy.auth.returnLogin}</Link></nav><section className="auth-shell"><div className="auth-story"><p className="eyebrow"><span className="eyebrow-dot" /> {copy.auth.accountSecurity}</p><h1>{copy.auth.verificationPendingTitle}<br /><em>{copy.auth.verificationPendingAccent}</em></h1><p>{copy.auth.verificationPendingDescription}</p></div><div className="auth-card"><div className="auth-card-head"><span className="auth-kicker">{copy.auth.accountKicker}</span><h2>{copy.auth.verificationPendingTitle} {copy.auth.verificationPendingAccent}</h2><p>{email || copy.auth.emailPlaceholder}</p></div><form onSubmit={resend} className="auth-form"><label>{copy.auth.email}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={copy.auth.emailPlaceholder} required /></label>{error && <p className="auth-message auth-error">{error}</p>}{message && <p className="auth-message auth-success">{message}</p>}{token && <div className="auth-dev-token"><strong>{copy.auth.localToken}</strong><code>{token}</code><Link href={`/auth/verify-email?token=${token}`}>{copy.auth.verificationContinue} ↗</Link></div>}<button className="button button-full auth-submit" disabled={loading}>{loading ? copy.auth.wait : `${copy.auth.resendVerification} ↗`}</button></form><p className="auth-switch"><Link href="/auth/login">{copy.auth.verificationContinue}</Link></p></div></section><SiteFooter compact /></main>;
}
