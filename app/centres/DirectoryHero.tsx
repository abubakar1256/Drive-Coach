"use client";

import { useEffect, useState } from "react";
import { isLocale, type Locale } from "../../lib/i18n";

const copy: Record<Locale, { eyebrow: string; title: string; accent: string; description: string; centres: string; ready: string }> = {
  en: { eyebrow: "Browse practice routes", title: "Find your", accent: "test centre.", description: "Choose where you are taking your practical test and start exploring the roads that matter.", centres: "published centres", ready: "ready to explore" },
  nl: { eyebrow: "BEKIJK OEFENROUTES", title: "Vind je", accent: "examencentrum.", description: "Kies waar je praktijkexamen aflegt en ontdek de wegen die ertoe doen.", centres: "gepubliceerde centra", ready: "klaar om te bekijken" },
};

export default function DirectoryHero({ count }: { count: number }) {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => { const sync = () => { const stored = window.localStorage.getItem("routepilot.locale"); if (isLocale(stored)) setLocale(stored); }; sync(); window.addEventListener("routepilot-locale-change", sync); return () => window.removeEventListener("routepilot-locale-change", sync); }, []);
  const active = copy[locale];
  return <section className="directory-hero"><div className="shell directory-hero-inner"><div><p className="eyebrow"><span className="eyebrow-dot" /> {active.eyebrow}</p><h1>{active.title}<br /><em>{active.accent}</em></h1><p>{active.description}</p></div><div className="directory-stat"><strong>{count}</strong><span>{active.centres}<br />{active.ready}</span></div></div></section>;
}
