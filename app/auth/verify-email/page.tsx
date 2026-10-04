"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState("Verifying your email…");
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setStatus("No verification token was provided."); return; }
    fetch(`${API}/auth/verify-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).then(async (response) => { const payload = await response.json().catch(() => ({})); setStatus(response.ok ? payload.message : payload.message ?? "This verification link is invalid or expired."); }).catch(() => setStatus("Unable to connect to the API."));
  }, []);
  return <main className="auth-page"><nav className="nav shell auth-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link></nav><section className="auth-shell"><div className="auth-story"><p className="eyebrow"><span className="eyebrow-dot" /> Account security</p><h1>One step<br /><em>closer.</em></h1><p>Verified accounts keep your preparation history and route access secure.</p></div><div className="auth-card"><div className="auth-card-head"><span className="auth-kicker">DRIVE COACH ACCOUNT</span><h2>{status}</h2><p>You can continue to your account when verification is complete.</p></div><Link className="button button-full" href="/auth/login">Continue to login ↗</Link></div></section></main>;
}
