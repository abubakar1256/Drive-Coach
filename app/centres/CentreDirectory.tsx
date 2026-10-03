"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Centre } from "../../lib/data";
import { useLocaleMessages } from "../../lib/useLocale";

const ALL_REGION = "__all__";
const BELGIAN_PROVINCES = ["Antwerp", "Brussels", "East Flanders", "Flemish Brabant", "Hainaut", "Limburg", "Liège", "Luxembourg", "Namur", "Walloon Brabant", "West Flanders"];

export default function CentreDirectory({ centres }: { centres: Centre[] }) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState(ALL_REGION);
  const copy = useLocaleMessages();
  const regions = [ALL_REGION, ...BELGIAN_PROVINCES];
  const visibleCentres = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...centres].filter((centre) => {
      const matchesRegion = region === ALL_REGION || centre.region === region;
      const matchesQuery = !normalizedQuery || `${centre.name} ${centre.city} ${centre.area}`.toLowerCase().includes(normalizedQuery);
      return matchesRegion && matchesQuery;
    }).sort((first, second) => first.name.localeCompare(second.name, "en", { sensitivity: "base" }));
  }, [centres, query, region]);
  const clearFilters = () => { setQuery(""); setRegion(ALL_REGION); };

  return (
    <>
      <div className="directory-toolbar"><div><p className="eyebrow">{copy.allCentres}</p><h2>{copy.whereTesting}</h2></div><div className="directory-controls"><label className="directory-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchCityCentre} aria-label={copy.searchCityCentre} /></label><label className="province-filter"><span>{copy.provinceLabel}</span><select className="filter-button filter-select" value={region} onChange={(event) => setRegion(event.target.value)} aria-label={copy.allRegions}>{regions.map((item) => <option key={item} value={item}>{item === ALL_REGION ? copy.allRegions : item}</option>)}</select></label></div></div>
      <div className="directory-result-line"><span>{visibleCentres.length} {copy.centresFound}</span>{(query || region !== ALL_REGION) && <button onClick={clearFilters}>{copy.clearFilters} ×</button>}</div>
      {visibleCentres.length > 0 ? <div className="directory-grid">{visibleCentres.map((centre) => <Link className="directory-card" href={`/centres/${centre.slug}`} key={centre.slug}><div className="directory-art"><span className="art-road" /><span className="art-circle" /><span className="art-dot" /></div><div className="directory-card-body"><div><span className="small-label">{centre.region.toUpperCase()}</span><h3>{centre.name}</h3><p>{centre.area} · {centre.routes} {copy.practiceRoutes}</p></div><span className="card-arrow">↗</span></div><div className="directory-card-footer"><span>{copy.exploreCentre}</span><span>→</span></div></Link>)}</div> : <div className="directory-empty"><strong>{copy.noCentresFound}</strong><span>{copy.tryDifferent}</span><button onClick={clearFilters}>{copy.showAllCentres}</button></div>}
    </>
  );
}
