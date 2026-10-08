"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { homeCopy } from "../lib/homeCopy";
import { isLocale, type Locale } from "../lib/i18n";
import { accessTokenKey, clearClientSession, refreshTokenKey, validateClientSession } from "../lib/clientSession";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export default function AccountNavLink({ className = "login-link" }: { className?: string }) {
  const [signedIn, setSignedIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      const token = window.sessionStorage.getItem(accessTokenKey);
      setSignedIn(Boolean(token));
      const stored = window.localStorage.getItem("routepilot.locale");
      if (isLocale(stored)) setLocale(stored);
      if (token) void validateClientSession().then((valid) => {
        if (cancelled || valid === null) return;
        setSignedIn(valid);
        if (!valid) clearClientSession();
      });
    };
    sync();
    window.addEventListener("routepilot-locale-change", sync);
    window.addEventListener("routepilot-auth-change", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("routepilot-locale-change", sync);
      window.removeEventListener("routepilot-auth-change", sync);
    };
  }, []);

  async function logout() {
    setLoggingOut(true);
    const refreshToken = window.sessionStorage.getItem(refreshTokenKey);
    if (refreshToken) await fetch(`${API}/auth/logout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken }) }).catch(() => undefined);
    clearClientSession();
    window.location.assign("/");
  }

  if (!signedIn) return <Link className={className} href="/auth/login">{homeCopy[locale].nav.logIn}</Link>;
  return <><Link className={className} href="/account">{homeCopy[locale].nav.myAccount}</Link><button className="nav-logout" type="button" onClick={() => void logout()} disabled={loggingOut}>{loggingOut ? "..." : locale === "nl" ? "Uitloggen" : "Log out"}</button></>;
}
