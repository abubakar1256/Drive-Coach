"use client";

import { useEffect, useState } from "react";
import { useCurrentLocale } from "../../lib/useLocale";
import "./centre-foundation.css";
type Summary = { source: { name: string; url: string; centreUrl: string; address: string; revision: string; checkedAt: string; publishedEntries: number } | null; reviewedPointCount: number; departureReviewed: boolean; targetMinutes: number; toleranceMinutes: number };
const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
export default function CentreFoundationInfo({ slug }: { slug: string }) {
  const [data, setData] = useState<Summary | null>(null), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const nl = useCurrentLocale() === "nl";
  useEffect(() => {
    const controller = new AbortController(); setError(false); setData(null);
    fetch(`${API}/exam-centres/${encodeURIComponent(slug)}/route-foundation`, { cache: "no-store", signal: controller.signal }).then(async r => { if (!r.ok) throw Error(); const result = await r.json(); if (!controller.signal.aborted) setData(result); }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [slug, retry]);
  return <section className="shell centre-foundation-wrap" aria-labelledby="centre-foundation-heading"><div className="centre-foundation-card">
    <div><p className="eyebrow">{nl ? "BRONTRANSPARANTIE" : "SOURCE TRANSPARENCY"}</p><h2 id="centre-foundation-heading">{nl ? "Weten wat je oefent." : "Know what you’re practising."}</h2><p>{nl ? "Oefenroutes zijn geen vaste officiële examenroutes. Gepubliceerde doorgangspunten zijn niet verplicht in elk examen." : "Practice loops are not fixed official exam itineraries. Published passage points are not mandatory on every exam."}</p></div>
    {data ? <div className="centre-foundation-status"><div className="centre-foundation-metrics"><div><strong>25 ±2</strong><span>{nl ? "min · doel voor nieuwe routes" : "min · new route validation target"}</span></div><div><strong>{data.reviewedPointCount}</strong><span>{nl ? "broncoördinaten gecontroleerd" : "source coordinates reviewed"}</span></div><div><strong>{data.departureReviewed ? (nl ? "Gecontroleerd" : "Reviewed") : (nl ? "In controle" : "Pending review")}</strong><span>{nl ? "vertrek- en eindpunt" : "departure & return location"}</span></div></div>{data.source ? <div className="centre-foundation-source"><strong>{data.source.name} · {data.source.publishedEntries} {nl ? "bronvermeldingen" : "source entries"}</strong><p>{data.source.address}<br />{nl ? "Documentversie" : "Document revision"}: {data.source.revision}</p><div><a href={data.source.url} target="_blank" rel="noreferrer">{nl ? "Doorgangspunten PDF" : "Passage-point PDF"} ↗</a><a href={data.source.centreUrl} target="_blank" rel="noreferrer">{nl ? "Centrumbron" : "Centre source"} ↗</a></div></div> : <p className="centre-foundation-note">{nl ? "Voor dit centrum is nog geen operatorlijst geverifieerd. Bestaande routes zijn apart aangeduide wegennet-oefenroutes, geen officiële doorgangspuntenroutes." : "No operator passage list has been verified for this centre yet. Existing routes are separately labelled road-network practice, not official passage-point itineraries."}</p>}</div> : <p role="status">{error ? <>{nl ? "Bronstatus tijdelijk niet beschikbaar." : "Source review status is temporarily unavailable."} <button onClick={() => setRetry(n => n + 1)}>{nl ? "Opnieuw proberen" : "Retry"}</button></> : (nl ? "Bronstatus laden…" : "Loading source review status…")}</p>}
  </div></section>;
}
