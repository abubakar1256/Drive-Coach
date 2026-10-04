"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocaleMessages } from "../../lib/useLocale";

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
  const copy = useLocaleMessages();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess(""); setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
      const response = await fetch(`${apiUrl}/auth/${isRegister ? "register" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, ...(isRegister ? { displayName } : {}) }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(payload.message) ? payload.message[0] : payload.message ?? "Something went wrong. Please try again.");
      if (isRegister) { setSuccess("Account created. You can now log in."); setTimeout(() => router.push("/auth/login"), 700); } else { sessionStorage.setItem("routepilot.accessToken", payload.accessToken); sessionStorage.setItem("routepilot.refreshToken", payload.refreshToken); sessionStorage.setItem("routepilot.user", JSON.stringify(payload.user)); router.push("/dashboard"); }
    } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : "Unable to connect to the API."); } finally { setLoading(false); }
  }

  return <main className="auth-page"><div className="auth-orb auth-orb-one" /><div className="auth-orb auth-orb-two" /><nav className="nav shell auth-nav"><Link className="brand" href="/"><span className="brand-mark"><span /></span><span>Drive <span className="brand-accent">Coach</span></span></Link><Link className="back-link auth-back" href="/">← Back to home</Link></nav><section className="auth-shell"><div className="auth-story"><p className="eyebrow"><span className="eyebrow-dot" /> Prepare with clarity</p><h1>Feel ready<br /><em>before you start.</em></h1><p>Save your centres, keep your routes close and build confidence one practice drive at a time.</p><div className="auth-story-stat"><strong>180+</strong><span>practice routes<br />to explore</span></div></div><div className="auth-card"><div className="auth-card-head"><span className="auth-kicker">DRIVE COACH ACCOUNT</span><h2>{isRegister ? "Create your account" : "Welcome back"}</h2><p>{isRegister ? "Start preparing for your test with a free account." : "Log in to continue your preparation."}</p></div><form onSubmit={submit} className="auth-form">{isRegister && <label>Full name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" autoComplete="name" /></label>}<label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={isRegister ? "new-password" : "current-password"} minLength={8} required /></label>{!isRegister && <div className="auth-form-options"><label className="remember-option"><input type="checkbox" /> <span>Remember me</span></label><Link href="/auth/forgot-password">Forgot password?</Link></div>}{error && <p className="auth-message auth-error">{error}</p>}{success && <p className="auth-message auth-success">{success}</p>}<button className="button button-full auth-submit" disabled={loading}>{loading ? "Please wait..." : isRegister ? "Create account ↗" : "Log in ↗"}</button></form><p className="auth-switch">{isRegister ? "Already have an account?" : "New to Drive Coach?"} <Link href={isRegister ? "/auth/login" : "/auth/register"}>{isRegister ? "Log in" : "Create an account"}</Link></p><small className="auth-note">By continuing, you agree to our terms and privacy policy.</small></div></section></main>;
}
