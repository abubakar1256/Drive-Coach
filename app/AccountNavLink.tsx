"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { homeCopy } from "../lib/homeCopy";
import { isLocale, type Locale } from "../lib/i18n";

export default function AccountNavLink({ className = "login-link" }: { className?: string }) {
  const [signedIn, setSignedIn] = useState(false);
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const sync = () => {
      setSignedIn(Boolean(window.sessionStorage.getItem("routepilot.accessToken")));
      const stored = window.localStorage.getItem("routepilot.locale");
      if (isLocale(stored)) setLocale(stored);
    };
    sync();
    window.addEventListener("routepilot-locale-change", sync);
    return () => window.removeEventListener("routepilot-locale-change", sync);
  }, []);
  return <Link className={className} href={signedIn ? "/account" : "/auth/login"}>{signedIn ? homeCopy[locale].nav.myAccount : homeCopy[locale].nav.logIn}</Link>;
}
