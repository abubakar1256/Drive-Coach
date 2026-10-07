"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLocale, locales, messages, type Locale } from "../lib/i18n";

export default function LanguageSwitcher() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const stored = window.localStorage.getItem("routepilot.locale");
    if (isLocale(stored)) {
      setLocale(stored);
      document.documentElement.lang = stored;
    } else if (stored) {
      window.localStorage.removeItem("routepilot.locale");
      document.cookie = "routepilot.locale=en; path=/; max-age=31536000; SameSite=Lax";
      document.documentElement.lang = "en";
    }
  }, []);
  function change(value: Locale) { setLocale(value); window.localStorage.setItem("routepilot.locale", value); document.cookie = `routepilot.locale=${value}; path=/; max-age=31536000; SameSite=Lax`; document.documentElement.lang = value; window.dispatchEvent(new Event("routepilot-locale-change")); router.refresh(); }
  const label = locale === "nl" ? "Taal" : "Language";
  return <label className="language-switcher"><span>{label}</span><select aria-label={label} value={locale} onChange={(event) => change(event.target.value as Locale)}>{locales.map((item) => <option key={item} value={item}>{messages[item].language}</option>)}</select></label>;
}
