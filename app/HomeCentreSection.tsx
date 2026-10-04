"use client";

import { useEffect, useState } from "react";
import { isLocale, type Locale } from "../lib/i18n";

const centres = [
  { slug: "brussels-south", name: "Brussels South", area: "Anderlecht", routes: 12, tone: "mint" },
  { slug: "antwerp-north", name: "Antwerp North", area: "Deurne", routes: 9, tone: "blue" },
  { slug: "ghent-east", name: "Ghent East", area: "Sint-Denijs-Westrem", routes: 8, tone: "sand" },
];

const text: Record<Locale, { eyebrow: string; title: string; view: string; search: string; routes: string }> = {
  en: { eyebrow: "Start where your test starts", title: "Find your test centre", view: "View all centres", search: "Search by city or test centre...", routes: "practice routes" },
  nl: { eyebrow: "START WAAR JE EXAMEN BEGINT", title: "Vind je examencentrum", view: "Bekijk alle examencentra", search: "Zoek op stad of examencentrum...", routes: "oefenroutes" },
};

export default function HomeCentreSection() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => { const sync = () => { const stored = window.localStorage.getItem("routepilot.locale"); if (isLocale(stored)) setLocale(stored); }; sync(); window.addEventListener("routepilot-locale-change", sync); return () => window.removeEventListener("routepilot-locale-change", sync); }, []);
  const active = text[locale];
  return <section className="centre-section" id="centres"><div className="shell"><div className="section-heading-row"><div><p className="eyebrow">{active.eyebrow}</p><h2>{active.title}</h2></div><a className="text-link" href="/centres">{active.view} <span>↗</span></a></div><div className="search-bar"><span className="search-icon">⌕</span><span>{active.search}</span><kbd>⌘ K</kbd></div><div className="centre-grid">{centres.map((centre) => <a className="centre-card" href={`/centres/${centre.slug}`} key={centre.name}><div className={`centre-art ${centre.tone}`}><span className="art-road" /><span className="art-circle" /><span className="art-dot" /></div><div className="centre-card-copy"><div><h3>{centre.name}</h3><p>{centre.area}</p></div><span className="card-arrow">↗</span></div><div className="centre-card-meta"><span>{centre.routes} {active.routes}</span><span>→</span></div></a>)}</div></div></section>;
}
