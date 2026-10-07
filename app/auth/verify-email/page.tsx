"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SiteFooter from "../../SiteFooter";
import { useSiteCopy } from "../../../lib/useLocale";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export default function VerifyEmailPage() {
  const copy = useSiteCopy();
  const [status, setStatus] = useState(copy.auth.verifying);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setStatus(copy.auth.noVerificationToken); return; }
    fetch(`${API}/auth/verify-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).then(async (response) => { const payload = await response.json().catch(() => ({})); setStatus(response.ok ? payload.message : payload.message ?? copy.auth.invalidVerification); }).catch(() => setStatus(copy.auth.unableConnect));
  }, [copy.auth.invalidVerification, copy.auth.noVerificationToken, copy.auth.unableConnect]);
  return <main className="auth-page"><nav className="nav shell auth-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link></nav><section className="auth-shell"><div className="auth-story"><p className="eyebrow"><span className="eyebrow-dot" /> {copy.auth.accountSecurity}</p><h1>{copy.auth.verificationTitle}<br /><em>{copy.auth.verificationAccent}</em></h1><p>{copy.auth.verificationDescription}</p></div><div className="auth-card"><div className="auth-card-head"><span className="auth-kicker">{copy.auth.accountKicker}</span><h2>{status}</h2><p>{copy.auth.verificationDescription}</p></div><Link className="button button-full" href="/auth/login">{copy.auth.verificationContinue} ↗</Link></div></section><SiteFooter compact /></main>;
}
