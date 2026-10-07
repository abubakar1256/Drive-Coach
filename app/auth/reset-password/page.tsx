"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import SiteFooter from "../../SiteFooter";
import { useSiteCopy } from "../../../lib/useLocale";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export default function ResetPasswordPage() {
  const copy = useSiteCopy();
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); setMessage(""); if (password !== confirm) { setError(copy.auth.passwordMismatch); return; } const token = new URLSearchParams(window.location.search).get("token"); const response = await fetch(`${API}/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, newPassword: password }) }); const payload = await response.json().catch(() => ({})); if (!response.ok) setError(Array.isArray(payload.message) ? payload.message[0] : payload.message ?? copy.auth.invalidReset); else setMessage(payload.message); }
  return <main className="auth-page"><nav className="nav shell auth-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link><Link className="back-link auth-back" href="/auth/login">← {copy.auth.returnLogin}</Link></nav><section className="auth-shell"><div className="auth-story"><p className="eyebrow"><span className="eyebrow-dot" /> {copy.auth.accountSecurity}</p><h1>{copy.auth.securityTitle}<br /><em>{copy.auth.securityAccent}</em></h1><p>{copy.auth.resetDescription}</p></div><div className="auth-card"><div className="auth-card-head"><span className="auth-kicker">{copy.auth.accountKicker}</span><h2>{copy.auth.newPassword}</h2><p>{copy.auth.resetSubtitle}</p></div><form onSubmit={submit} className="auth-form"><label>{copy.auth.newPassword}<input type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>{copy.auth.confirmPassword}<input type="password" minLength={8} required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>{error && <p className="auth-message auth-error">{error}</p>}{message && <p className="auth-message auth-success">{message}</p>}<button className="button button-full auth-submit">{copy.auth.resetPassword} ↗</button></form><p className="auth-switch"><Link href="/auth/login">{copy.auth.returnLogin}</Link></p></div></section><SiteFooter compact /></main>;
}
