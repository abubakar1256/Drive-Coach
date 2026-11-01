"use client";
import { useEffect, useState } from "react";
import { authFetch } from "../../lib/clientSession";
import { useCurrentLocale } from "../../lib/useLocale";
import "./centre-foundation.css";

type Coverage = {
  sourceAvailable: boolean; distinctSourceEntryCount: number; reviewedPointCount: number; coveredPointCount: number;
  uncoveredReviewedPointCount: number; pendingPointCount: number; coveragePercent: number; sourceLinkedRouteCount: number;
  publishedRouteCount: number; staleSourceRouteCount: number; complete: boolean; limitation: string;
  generationConfigured: boolean; maxRequestsPerRun: number;
  points?: Array<{ id: string; sequence: number; junction: string; status: string; routes: string[] }>;
  selections?: Array<{ passagePointIds: string[]; sequences: number[]; newlyCovered: number; status: string }>;
};
const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
export default function PassageCoverage({ slug, centreId, onSelect, disabled = false }: { slug?: string; centreId?: string; onSelect?: (ids: string[]) => void; disabled?: boolean }) {
  const [data, setData] = useState<Coverage | null>(null), [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  const [generating, setGenerating] = useState(false), [message, setMessage] = useState("");
  const nl = useCurrentLocale() === "nl";
  useEffect(() => {
    const abort = new AbortController(); setData(null); setError(false);
    const path = centreId ? `/admin/centres/${encodeURIComponent(centreId)}/passage-coverage` : `/exam-centres/${encodeURIComponent(slug ?? "")}/passage-coverage`;
    const get = centreId ? authFetch : fetch;
    void get(API + path, { cache: "no-store", signal: abort.signal }).then(async response => {
      if (!response.ok) throw Error(); const result = await response.json();
      if (!abort.signal.aborted) setData(result);
    }).catch(() => { if (!abort.signal.aborted) setError(true); });
    const changed = () => { setData(null); setAttempt(n => n + 1); };
    if (centreId) window.addEventListener("routepilot-auth-change", changed);
    return () => { abort.abort(); window.removeEventListener("routepilot-auth-change", changed); };
  }, [slug, centreId, attempt]);
  async function prepareDrafts() {
    if (!centreId || !data?.generationConfigured || disabled || generating) return;
    if (!window.confirm(nl ? "Maximaal 8 Directions-controles uit het ingestelde budget? Alleen concepten opslaan; niet automatisch publiceren." : "Use at most 8 Directions checks from the configured allowance? Save drafts only, without automatic publication.")) return;
    setGenerating(true); setMessage("");
    try {
      const response = await authFetch(`${API}/admin/centres/${encodeURIComponent(centreId)}/passage-coverage/drafts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true, requestKey: crypto.randomUUID(), requestLimit: 8 }) });
      const result = await response.json();
      if (!response.ok) throw Error(typeof result.message === "string" ? result.message : "Draft preparation failed. Inspect existing drafts before retrying.");
      setMessage(`${result.drafts.length} ${nl ? "concepten opgeslagen" : "drafts saved"} · ${result.failures.length} ${nl ? "selecties moeten worden herzien" : "selections need revision"}. ${nl ? "Niets gepubliceerd." : "Nothing published."}`); setAttempt(n => n + 1);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Request interrupted. Inspect saved drafts before retrying."); }
    finally { setGenerating(false); }
  }
  return <div className="passage-coverage" aria-label={nl ? "Route-dekking van doorgangspunten" : "Passage-point route coverage"}>
    <h3>{nl ? "Van bronpunt naar oefenroute" : "From source points to practice routes"}</h3>
    {data && <button type="button" disabled={generating || disabled} onClick={() => setAttempt(n => n + 1)}>{nl ? "Dekking vernieuwen" : "Refresh coverage"} ↻</button>}
    {!data ? <p role="status">{error ? <>{nl ? "Route-dekking niet beschikbaar." : "Coverage is temporarily unavailable."} <button type="button" onClick={() => setAttempt(n => n + 1)}>{nl ? "Opnieuw" : "Retry"}</button></> : (nl ? "Route-dekking laden…" : "Loading route coverage…")}</p> : !data.sourceAvailable ? <p>{nl ? "Nog geen actuele operatorbron voor dit centrum. Wegennet-oefenroutes tellen niet als officiële brondekking." : "No current operator source for this centre. Road-network practice is not counted as official-source coverage."}</p> : <>
      <div className="passage-coverage-numbers"><strong>{data.coveredPointCount}/{data.distinctSourceEntryCount}</strong><span>{nl ? "bronvermeldingen gekoppeld aan gepubliceerde oefenroutes" : "source entries linked to published practice routes"}</span><b>{data.coveragePercent}%</b></div>
      <progress value={data.coveredPointCount} max={data.distinctSourceEntryCount || 1} aria-label={nl ? "Brondekking" : "Source-linked coverage"} />
      <p>{data.reviewedPointCount} {nl ? "locaties gecontroleerd" : "locations reviewed"} · {data.uncoveredReviewedPointCount} {nl ? "zonder gepubliceerde bronroute" : "without a published source-linked route"} · {data.pendingPointCount} {nl ? "nog te controleren" : "pending review"}</p>
      <p>{data.sourceLinkedRouteCount}/{data.publishedRouteCount} {nl ? "gepubliceerde routes met actuele bronkoppeling" : "published routes have current passage-point proofs"}{data.staleSourceRouteCount > 0 && ` · ${data.staleSourceRouteCount} ${nl ? "bronroutes opnieuw controleren" : "source routes need re-review"}`}</p>
      {data.points && <details><summary>{nl ? "Bekijk dekking per bronvermelding" : "Inspect coverage per source entry"}</summary><ol>{data.points.map(point => <li key={point.id}><strong>{point.sequence}. {point.junction}</strong><span>{point.status === "COVERED" ? (nl ? "Gekoppeld" : "Source-linked") : point.status === "NO_PUBLISHED_ROUTE" ? (nl ? "Route nodig" : "Route needed") : point.status === "DUPLICATE" ? (nl ? "Dubbele vermelding" : "Duplicate entry") : (nl ? "Review nodig" : "Review required")}</span>{point.routes.map(route => <small key={route}>{route}</small>)}</li>)}</ol></details>}
      {data.selections?.length && onSelect ? <div><h4>{nl ? "Voorstellen voor ontbrekende dekking" : "Selections for uncovered points"}</h4><p>{nl ? "Alleen puntselecties: nog geen berekende routes of gegarandeerde rijtijd. Gebruik de bestaande rijcontrole en inhoudsreview voor publicatie." : "Point selections only: no calculated roads or guaranteed duration. Use the existing driving check and content review before publishing."}</p>{data.selections.map((selection, index) => <button className="button button-small button-muted" key={selection.passagePointIds.join(":")} type="button" disabled={disabled} onClick={() => onSelect(selection.passagePointIds)}>{nl ? "Selectie" : "Selection"} {index + 1}: {selection.sequences.join(" → ")} · {selection.newlyCovered} {nl ? "ontbrekende vermeldingen" : "uncovered entries"}</button>)}</div> : null}
      {centreId && data.uncoveredReviewedPointCount > 0 && <div><button type="button" className="button button-small" disabled={disabled || generating || !data.generationConfigured || !data.selections?.length} onClick={() => void prepareDrafts()}>{generating ? (nl ? "Concepten controleren…" : "Checking draft routes…") : (nl ? "Ontbrekende dekking als concept voorbereiden" : "Prepare coverage drafts")}</button>{!data.generationConfigured && <p>{nl ? "Gepauzeerd tot een bestaand routeringsbudget is gecontroleerd en ingesteld. Selecties bekijken gebruikt geen providerverzoeken." : "Paused until an existing routing allowance is verified and configured. Viewing selections makes no provider requests."}</p>}<p role="status">{message}</p></div>}
      <small>{nl ? "Actuele bronkoppelingen, geen nieuwe rijtijdmeting of bewijs van verplichte examenpunten. Andere routes kunnen langs dezelfde locaties lopen zonder bronkoppeling." : data.limitation}</small>
    </>}
  </div>;
}
