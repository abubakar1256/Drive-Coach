"use client";

import { useEffect, useMemo, useState } from "react";
import { isLocale, type Locale } from "../lib/i18n";
import { belgianProvinces, canonicalBelgianRegion } from "../lib/belgianRegions";
import { centres as directoryCentres } from "../lib/data";

type HomeCentre = { slug: string; name: string; city: string; area: string; region: string; routes: number; tone: string };

const fallbackCentres: HomeCentre[] = directoryCentres.map((centre, index) => ({ slug: centre.slug, name: centre.name, city: centre.city, area: centre.area, region: centre.region, routes: centre.routes, tone: ["mint", "blue", "sand"][index % 3] }));

const text: Record<Locale, { eyebrow: string; title: string; view: string; search: string; routes: string; regions: string; allRegions: string; noResults: string; previous: string; next: string; slide: string }> = {
  en: { eyebrow: "Start where your test starts", title: "Find your test centre", view: "View all centres", search: "Search by city or test centre...", routes: "practice routes", regions: "Provinces", allRegions: "All provinces", noResults: "No test centres found", previous: "Previous centres", next: "Next centres", slide: "Centre page" },
  nl: { eyebrow: "START WAAR JE EXAMEN BEGINT", title: "Vind je examencentrum", view: "Bekijk alle examencentra", search: "Zoek op stad of examencentrum...", routes: "oefenroutes", regions: "Provincies", allRegions: "Alle provincies", noResults: "Geen examencentra gevonden", previous: "Vorige centra", next: "Volgende centra", slide: "Centrumpagina" },
};

export default function HomeCentreSection() {
  const [locale, setLocale] = useState<Locale>("en");
  const [centres, setCentres] = useState<HomeCentre[]>(fallbackCentres);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("__all__");
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => { const sync = () => { const stored = window.localStorage.getItem("routepilot.locale"); if (isLocale(stored)) setLocale(stored); }; sync(); window.addEventListener("routepilot-locale-change", sync); return () => window.removeEventListener("routepilot-locale-change", sync); }, []);
  useEffect(() => { let cancelled = false; fetch("/api/v1/exam-centres", { cache: "no-store" }).then(async (response) => { if (!response.ok) return null; return await response.json() as Array<{ slug: string; name: string; city: string; area: string | null; region: string; _count?: { routes: number } }>; }).then((items) => { if (cancelled || !items?.length) return; setCentres(items.map((item, index) => ({ slug: item.slug, name: item.name, city: item.city, area: item.area ?? item.city, region: item.region, routes: item._count?.routes || 7, tone: ["mint", "blue", "sand"][index % 3] }))); }).catch(() => undefined); return () => { cancelled = true; }; }, []);
  useEffect(() => { setSlideIndex(0); }, [query, region]);

  const active = text[locale];
  const visibleCentres = useMemo(() => { const normalized = query.trim().toLowerCase(); return centres.filter((centre) => (region === "__all__" || canonicalBelgianRegion(centre.region) === region) && (!normalized || `${centre.name} ${centre.city} ${centre.area}`.toLowerCase().includes(normalized))).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" })); }, [centres, query, region]);
  const pageSize = 4;
  const pageCount = Math.max(1, Math.ceil(visibleCentres.length / pageSize));
  const safeSlideIndex = Math.min(slideIndex, pageCount - 1);
  const displayedCentres = visibleCentres.slice(safeSlideIndex * pageSize, safeSlideIndex * pageSize + pageSize);
  const language = locale === "nl" ? "nl" : "en";

  return <section className="centre-section" id="centres"><div className="shell"><div className="section-heading-row"><div><p className="eyebrow">{active.eyebrow}</p><h2>{active.title}</h2></div><a className="text-link" href="/centres">{active.view} <span>↗</span></a></div><label className="search-bar home-centre-search"><span className="search-icon">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={active.search} aria-label={active.search} /><kbd>⌘ K</kbd></label><div className="home-province-filter"><span>{active.regions}</span><div className="province-chip-list"><button type="button" className={`province-chip ${region === "__all__" ? "active" : ""}`} onClick={() => setRegion("__all__")}>{active.allRegions}</button>{belgianProvinces.map((item) => <button type="button" className={`province-chip ${region === item.value ? "active" : ""}`} onClick={() => setRegion(item.value)} key={item.value}>{item.labels[language]}</button>)}</div></div><div className="centre-carousel-toolbar"><span>{active.slide} {pageCount > 1 ? `${safeSlideIndex + 1} / ${pageCount}` : ""}</span><div><button type="button" className="centre-carousel-button" onClick={() => setSlideIndex((value) => Math.max(0, value - 1))} disabled={safeSlideIndex === 0} aria-label={active.previous}>←</button><button type="button" className="centre-carousel-button" onClick={() => setSlideIndex((value) => Math.min(pageCount - 1, value + 1))} disabled={safeSlideIndex === pageCount - 1} aria-label={active.next}>→</button></div></div><div className="centre-grid">{visibleCentres.length ? displayedCentres.map((centre) => <a className="centre-card" href={`/centres/${centre.slug}`} key={centre.name}><div className={`centre-art ${centre.tone}`}><span className="art-road" /><span className="art-circle" /><span className="art-dot" /></div><div className="centre-card-copy"><div><h3>{centre.name}</h3><p>{centre.area}</p></div><span className="card-arrow">↗</span></div><div className="centre-card-meta"><span>{centre.routes} {active.routes}</span><span>→</span></div></a>) : <p className="centre-empty-message">{active.noResults}</p>}</div></div></section>;
}
