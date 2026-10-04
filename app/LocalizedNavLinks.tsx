"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isLocale, type Locale } from "../lib/i18n";
import { navLabel, type NavKey } from "../lib/navCopy";

type NavItem = { href: string; label: NavKey };

function useNavLocale() {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    const sync = () => {
      const stored = window.localStorage.getItem("routepilot.locale");
      if (isLocale(stored)) setLocale(stored);
    };
    sync();
    window.addEventListener("routepilot-locale-change", sync);
    return () => window.removeEventListener("routepilot-locale-change", sync);
  }, []);

  return locale;
}

export default function LocalizedNavLinks({ items, className = "nav-links" }: { items: NavItem[]; className?: string }) {
  const locale = useNavLocale();
  return <div className={className}>{items.map((item) => <Link href={item.href} key={item.href}>{navLabel(locale, item.label)}</Link>)}</div>;
}

export function LocalizedNavText({ item }: { item: NavKey }) {
  const locale = useNavLocale();
  return navLabel(locale, item);
}
