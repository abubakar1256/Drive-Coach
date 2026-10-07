"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useSiteCopy } from "../../lib/useLocale";
import SiteFooter from "../SiteFooter";

type Mode = "login" | "register";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const isRegister = mode === "register";
  const copy = useSiteCopy();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess(""); setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
      const response = await fetch(`${apiUrl}/auth/${isRegister ? "register" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, ...(isRegister ? { displayName } : {}) }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(payload.message) ? payload.message[0] : payload.message ?? copy.auth.genericError);
      if (isRegister) { setSuccess(copy.auth.accountCreated); setTimeout(() => router.push("/auth/login"), 700); } else { sessionStorage.setItem("routepilot.accessToken", payload.accessToken); sessionStorage.setItem("routepilot.refreshToken", payload.refreshToken); sessionStorage.setItem("routepilot.user", JSON.stringify(payload.user)); router.push("/dashboard"); }
    } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : copy.auth.apiError); } finally { setLoading(false); }
  }

  return <main className="auth-page"><div className="auth-orb auth-orb-one" /><div className="auth-orb auth-orb-two" /><nav className="nav shell auth-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link><Link className="back-link auth-back" href="/">← {copy.auth.backHome}</Link></nav><section className="auth-shell"><div className="auth-story"><p className="eyebrow"><span className="eyebrow-dot" /> {copy.auth.prepareClarity}</p><h1>{copy.auth.storyTitle}<br /><em>{copy.auth.storyAccent}</em></h1><p>{copy.auth.storyDescription}</p><div className="auth-story-stat"><strong>180+</strong><span>{copy.auth.routeCount.split(" ").slice(0, -2).join(" ")}<br />{copy.auth.routeCount.split(" ").slice(-2).join(" ")}</span></div></div><div className="auth-card"><div className="auth-card-head"><span className="auth-kicker">{copy.auth.accountKicker}</span><h2>{isRegister ? copy.auth.createTitle : copy.auth.welcomeTitle}</h2><p>{isRegister ? copy.auth.createDescription : copy.auth.loginDescription}</p></div><form onSubmit={submit} className="auth-form">{isRegister && <label>{copy.auth.fullName}<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={copy.auth.yourName} autoComplete="name" /></label>}<label>{copy.auth.email}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={copy.auth.emailPlaceholder} autoComplete="email" required /></label><label>{copy.auth.password}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={copy.auth.passwordPlaceholder} autoComplete={isRegister ? "new-password" : "current-password"} minLength={8} required /></label>{!isRegister && <div className="auth-form-options"><label className="remember-option"><input type="checkbox" /> <span>{copy.auth.remember}</span></label><Link href="/auth/forgot-password">{copy.auth.forgot}</Link></div>}{error && <p className="auth-message auth-error">{error}</p>}{success && <p className="auth-message auth-success">{success}</p>}<button className="button button-full auth-submit" disabled={loading}>{loading ? copy.auth.wait : isRegister ? `${copy.auth.createAccount} ↗` : `${copy.auth.login} ↗`}</button></form><p className="auth-switch">{isRegister ? copy.auth.alreadyAccount : copy.auth.newToDriveCoach} <Link href={isRegister ? "/auth/login" : "/auth/register"}>{isRegister ? copy.auth.login : copy.auth.createAccount}</Link></p><small className="auth-note">{copy.auth.termsNote}</small></div></section><SiteFooter compact /></main>;
}
