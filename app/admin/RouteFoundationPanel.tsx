"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authFetch } from "../../lib/clientSession";
import "./route-foundation.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type Passage = { id: string; sequence: number; municipality: string; junction: string; latitude: number | null; longitude: number | null; verificationStatus: string; notes: string | null; duplicateOfSequence: number | null; sourceFingerprint: string | null; verifiedBy: string | null; verifiedAt: string | null };
type Departure = { latitude: number; longitude: number; label: string; sourceUrl: string; notes: string; verificationStatus: string; version: number };
type Workspace = { centreName: string; source: { sourceUrl: string; centreSourceUrl: string; sourceRevision: string; address: string; points: unknown[] } | null; points: Passage[]; departure: Departure | null; readyPointCount: number };
async function request(path: string, method = "GET", data?: unknown) {
  const response = await authFetch(`${API}${path}`, { method, headers: { "Content-Type": "application/json" }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const body = await response.json();
  if (!response.ok) throw Error(Array.isArray(body.message) ? body.message.join(" · ") : body.message ?? "Request failed");
  return body;
}
const ready = (p: Passage) => p.verificationStatus === "VERIFIED" && p.duplicateOfSequence === null && p.latitude !== null && p.longitude !== null && Boolean(p.sourceFingerprint && p.verifiedAt && p.verifiedBy);

export default function RouteFoundationPanel({ centres, onCreated }: { centres: Array<{ id: string; name: string }>; onCreated: (id: string) => Promise<void> }) {
  const [centreId, setCentreId] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    let cancelled = false;
    setWorkspace(null); setOrder([]); setSearch(""); setError(""); setNotice("");
    setLoading(Boolean(centreId));
    if (!centreId) return;
    request(`/admin/centres/${centreId}/route-foundation`).then(data => { if (!cancelled) setWorkspace(data); }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [centreId]);
  async function action(run: () => Promise<unknown>, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { await run(); setWorkspace(await request(`/admin/centres/${centreId}/route-foundation`)); setOrder([]); setNotice(message); }
    catch (e) { setError(e instanceof Error ? e.message : "Review could not be saved"); }
    finally { setBusy(false); }
  }
  async function generate() {
    if (!window.confirm("Check this exact passage sequence with Mapbox? Up to one Directions request uses your existing account limits. A passing route is saved as a draft only; this is not an official exam itinerary.")) return;
    setBusy(true); setError(""); setNotice("");
    try { const result = await request(`/admin/centres/${centreId}/route-foundation/generate`, "POST", { passagePointIds: order }); await onCreated(result.id); }
    catch (e) { setError(e instanceof Error ? e.message : "Generation failed"); }
    finally { setBusy(false); }
  }
  const departureReady = workspace?.departure?.verificationStatus === "VERIFIED";
  return <section className="foundation-panel" aria-labelledby="foundation-heading">
    <header className="foundation-header"><div><span className="small-label">SOURCE → REVIEW → DRAFT</span><h3 id="foundation-heading">Route foundation</h3><p>Build a 25 ±2 minute practice loop from reviewed public passage points. Keep existing routes unchanged.</p></div><span className="foundation-target">23–27 min<small>exact driving-time gate</small></span></header>
    <label className="foundation-centre">Test centre<select value={centreId} onChange={e => setCentreId(e.target.value)} disabled={busy}><option value="">Choose any centre</option>{centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    {loading && <p role="status">Loading source workspace…</p>}
    {error && <p role="alert" className="admin-inline-error">{error}</p>}{notice && <p role="status" className="admin-notice">{notice}</p>}
    {workspace && <>
      <ol className="foundation-steps"><li><strong>01 · Operator source</strong><span>{workspace.source ? `${workspace.source.points.length} source entries` : "Source not verified yet"}</span></li><li><strong>02 · Location review</strong><span>{workspace.readyPointCount} reviewed junctions · {departureReady ? "departure reviewed" : "departure pending"}</span></li><li><strong>03 · Route validation</strong><span>Ordered loop · road check · content review</span></li></ol>
      {workspace.source ? <div className="foundation-source"><strong>{workspace.centreName} · Autoveiligheid</strong><p>{workspace.source.address}</p><p>Document revision: {workspace.source.sourceRevision}. Names only: coordinates and legal access need separate review. Repeated source rows are retained but cannot both be selected.</p><div className="point-actions"><a href={workspace.source.sourceUrl} target="_blank" rel="noreferrer">Read passage PDF ↗</a><a href={workspace.source.centreSourceUrl} target="_blank" rel="noreferrer">Verify centre address ↗</a><button className="button button-small" disabled={busy} onClick={() => void action(() => request(`/admin/centres/${centreId}/route-foundation/import`, "POST"), "Current source imported. Existing coordinates preserved; changed source entries require re-review.")}>Import / refresh source</button></div></div> : <p className="foundation-warning">No verified operator passage list is bundled for this centre. Do not invent official points. Existing road-network practice routes remain separate from this workflow.</p>}
      <DepartureReview key={`${centreId}-${workspace.departure?.version ?? 0}`} departure={workspace.departure} suggestedUrl={workspace.source?.centreSourceUrl ?? ""} busy={busy} save={data => action(() => request(`/admin/centres/${centreId}/route-foundation/departure`, "PATCH", data), "Departure review saved. Previous provenance snapshots will need rebuilding if changed.")} />
      <details className="foundation-review-list"><summary>Review passage coordinates · {workspace.points.length} source rows</summary><label>Filter junction or municipality<input value={search} onChange={e => setSearch(e.target.value)} /></label>{workspace.points.filter(p => `${p.junction} ${p.municipality}`.toLowerCase().includes(search.toLowerCase())).map(p => <PassageReview key={`${p.id}-${p.verifiedAt}-${p.verificationStatus}`} point={p} busy={busy} save={data => action(() => request(`/admin/official-passage-points/${p.id}`, "PATCH", data), "Passage review saved with your administrator identity.")} />)}</details>
      <div className="foundation-sequence"><h4>Compose a reviewed practice loop</h4><p>Select 2–6 distinct reviewed junctions in driving order. The reviewed departure is both the start and finish. One request checks the selected sequence; failed checks save nothing.</p><label>Add next passage<select value="" disabled={busy || order.length >= 6} onChange={e => setOrder(old => [...old, e.target.value])}><option value="">Choose a reviewed passage…</option>{workspace.points.filter(p => ready(p) && !order.includes(p.id)).map(p => <option key={p.id} value={p.id}>{p.sequence}. {p.junction} · {p.municipality}</option>)}</select></label><ol><li>{workspace.departure?.label ?? "Reviewed departure needed"} · start</li>{order.map((id, i) => <li key={id}><span>{workspace.points.find(p => p.id === id)?.junction}</span><div><button type="button" disabled={busy || i === 0} aria-label={`Move passage ${i + 1} earlier`} onClick={() => setOrder(old => { const next = [...old]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; return next; })}>↑</button><button type="button" disabled={busy || i === order.length - 1} aria-label={`Move passage ${i + 1} later`} onClick={() => setOrder(old => { const next = [...old]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; return next; })}>↓</button><button type="button" disabled={busy} aria-label={`Remove passage ${i + 1}`} onClick={() => setOrder(old => old.filter(p => p !== id))}>×</button></div></li>)}<li>Return to the same reviewed departure · finish</li></ol><button className="button button-small" disabled={busy || !departureReady || order.length < 2} onClick={() => void generate()}>{busy ? "Working…" : "Validate & save draft"} ↗</button><p className="foundation-footnote">Passing geometry is not instructor approval. Review the draft in the route editor before publishing. The list does not describe mandatory points on every exam.</p></div>
    </>}
  </section>;
}

function DepartureReview({ departure, suggestedUrl, busy, save }: { departure: Departure | null; suggestedUrl: string; busy: boolean; save: (data: unknown) => Promise<void> }) {
  const [form, setForm] = useState({ latitude: departure?.latitude.toString() ?? "", longitude: departure?.longitude.toString() ?? "", label: departure?.label ?? "", sourceUrl: departure?.sourceUrl ?? suggestedUrl, notes: departure?.notes ?? "", verificationStatus: departure?.verificationStatus ?? "PENDING_REVIEW" });
  function submit(e: FormEvent) { e.preventDefault(); void save({ ...form, latitude: Number(form.latitude), longitude: Number(form.longitude) }); }
  return <details className="foundation-departure"><summary>Review legal public-road start & finish · {departure?.verificationStatus ?? "NOT REVIEWED"}</summary><p>A directory map marker is not a confirmed entrance. Check the operator address, road access, signs and a safe meeting location; do not use private/restricted property.</p><form onSubmit={submit}><fieldset disabled={busy}><div className="admin-form-grid"><label>Meeting point label<input required minLength={3} maxLength={160} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></label><label>Source URL<input required type="url" value={form.sourceUrl} onChange={e => setForm({ ...form, sourceUrl: e.target.value })} /></label><label>Latitude<input required type="number" step="any" min="49.4" max="51.6" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} /></label><label>Longitude<input required type="number" step="any" min="2.4" max="6.5" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} /></label><label className="wide-field">Evidence / access review notes<textarea required minLength={8} maxLength={1000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label><label>Status<select value={form.verificationStatus} onChange={e => setForm({ ...form, verificationStatus: e.target.value })}><option value="PENDING_REVIEW">Pending review</option><option value="VERIFIED">Reviewed — legal public-road meeting point</option><option value="REJECTED">Rejected</option></select></label></div><button className="button button-small">Save departure review</button></fieldset></form></details>;
}
function PassageReview({ point, busy, save }: { point: Passage; busy: boolean; save: (data: unknown) => Promise<void> }) {
  const [latitude, setLatitude] = useState(point.latitude?.toString() ?? ""), [longitude, setLongitude] = useState(point.longitude?.toString() ?? ""), [notes, setNotes] = useState(point.notes ?? ""), [status, setStatus] = useState(point.verificationStatus);
  return <details className="foundation-passage"><summary><strong>{point.sequence}. {point.junction}</strong><span>{point.municipality} · {point.duplicateOfSequence ? `Repeats row ${point.duplicateOfSequence}` : point.verificationStatus}</span></summary><form onSubmit={e => { e.preventDefault(); void save({ ...(latitude ? { latitude: Number(latitude) } : {}), ...(longitude ? { longitude: Number(longitude) } : {}), notes, verificationStatus: status }); }}><fieldset disabled={busy}><div className="admin-form-grid"><label>Latitude<input type="number" step="any" min="49.4" max="51.6" value={latitude} onChange={e => { setLatitude(e.target.value); setStatus("PENDING_REVIEW"); }} /></label><label>Longitude<input type="number" step="any" min="2.4" max="6.5" value={longitude} onChange={e => { setLongitude(e.target.value); setStatus("PENDING_REVIEW"); }} /></label><label className="wide-field">Coordinate review evidence<textarea required minLength={8} maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} /></label><label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="PENDING_REVIEW">Pending review</option><option value="VERIFIED" disabled={Boolean(point.duplicateOfSequence) || !latitude || !longitude}>Reviewed coordinates</option><option value="REJECTED">Rejected</option></select></label></div><button className="button button-small">Save passage review</button></fieldset></form></details>;
}
