"use client";
import { useState } from "react";
import { authFetch } from "../../lib/clientSession";
const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
export default function PracticeLoopGenerator({ centres, refresh }: { centres: Array<{ id: string; name: string; slug?: string }>; refresh: () => Promise<void> }) {
  const [centre, setCentre] = useState(""), [variant, setVariant] = useState(0), [publish, setPublish] = useState(false), [busy, setBusy] = useState(false), [results, setResults] = useState<string[]>([]);
  async function generate(all: boolean) {
    const selected = all ? centres : centres.filter(c => c.id === centre);
    if (!selected.length || !window.confirm(`Generate ${selected.length} real road-network practice loop(s)? Each centre may use up to 12 Mapbox Directions requests under your account limits. Existing routes are not overwritten. ${publish ? "Passing routes will be published as road-validated practice loops, NOT official/instructor-approved routes." : "Results remain drafts."}`)) return;
    setBusy(true); setResults([]);
    for (const c of selected) {
      try { const r = await authFetch(`${API}/admin/centres/${c.id}/generate-practice-loop`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variant, publish }) }); const p = await r.json(); if (!r.ok) throw Error(p.message ?? "Generation failed"); setResults(old => [...old, `${c.name}: ${p.name}, ${p.durationMin} min, ${p.status}`]); } catch (e) { setResults(old => [...old, `${c.name}: ${e instanceof Error ? e.message : "Unable to generate"}`]); }
    }
    setBusy(false); await refresh();
  }
  async function importStarterRoutes() {
    if (!window.confirm(`Publish checked starter routes for ${centres.length} centres? Each missing route is freshly road-validated. Existing routes are preserved. These are practice loops, not official examiner routes or instructor approval. No recurring deployment job is created.`)) return;
    setBusy(true); setResults([]);
    for (const c of centres) {
      try {
        const response = await authFetch(`${API}/admin/centres/${c.id}/import-starter-route`, { method: "POST" });
        const p = await response.json();
        if (!response.ok) throw Error(p.message ?? "Import failed");
        setResults(old => [...old, `${c.name}: ${p.preserved ? "existing route preserved" : "published"} · ${p.durationMin} min`]);
      } catch (e) { setResults(old => [...old, `${c.name}: ${e instanceof Error ? e.message : "Import failed"}`]); }
    }
    setBusy(false); await refresh();
  }
  async function importPreparedCatalog() {
    if (!window.confirm("Publish prepared extra practice routes for all centres? Each route is freshly checked for at least 24 minutes driving time and logical road geometry. Existing records are preserved. Up to six additional routing checks per centre use your existing Mapbox limits. No recurring import is created.")) return;
    setBusy(true); setResults([]);
    try {
      const response = await authFetch(`${API}/admin/road-catalog`);
      if (!response.ok) throw Error("Prepared catalogue is unavailable");
      const catalog = await response.json() as Array<{ centreSlug: string; slots: number[] }>;
      for (const c of centres) {
        const source = c.slug === "ghent-east" ? "sint-denijs-westrem" : c.slug;
        const slots = catalog.find(item => item.centreSlug === source)?.slots ?? [];
        if (!slots.length) { setResults(old => [...old, `${c.name}: no extra qualifying routes prepared`]); continue; }
        for (const slot of slots) {
          try {
            const result = await authFetch(`${API}/admin/centres/${c.id}/import-road-catalog-route`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot }) });
            const payload = await result.json();
            if (!result.ok) throw Error(payload.message ?? "Import failed");
            setResults(old => [...old, `${c.name} · Route ${String.fromCharCode(64 + slot)}: ${payload.preserved ? "existing route preserved" : "published"} · ${payload.durationMin} min`]);
          } catch (e) { setResults(old => [...old, `${c.name} · ${slot}: ${e instanceof Error ? e.message : "Import failed"}`]); }
        }
      }
    } catch (e) { setResults(old => [...old, e instanceof Error ? e.message : "Import failed"]); }
    finally { setBusy(false); await refresh(); }
  }
  return <section className="admin-create-card"><h3>Checked starter routes</h3><p>One-time import of the checked road-network bundle. Existing routes are never overwritten. Ghent East uses a labelled shared Ghent-area loop.</p><button className="button button-small" disabled={busy || !centres.length} onClick={() => void importStarterRoutes()}>Publish checked starter routes</button><h3>Prepared additional routes · B–G</h3><p>Only unique, passing real-road loops are included. Some centres may have fewer than seven routes. Free is a single chosen-route 24-hour trial. Basic unlocks its purchased centre and Premium unlocks all centres.</p><button className="button button-small" disabled={busy || !centres.length} onClick={() => void importPreparedCatalog()}>Publish prepared centre catalogue</button><h3>Generate road-network practice loops (experimental)</h3><p>Not guaranteed to find a qualifying route. Searches real drivable roads for a 24–60 minute loop without self-crossings, repeated roads or U-turns. Only snapped road waypoints are saved. The meeting point is near the centre map anchor, not a confirmed exam-centre entrance. No street rules or instructor approval are invented.</p><div className="admin-form-grid"><label>Centre<select value={centre} onChange={e => setCentre(e.target.value)} disabled={busy}><option value="">Choose centre</option>{centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Search variant<input type="number" min={0} max={6} value={variant} onChange={e => setVariant(Number(e.target.value))} disabled={busy} /></label></div><label><input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)} disabled={busy} /> Publish passing loops with the road-network practice disclaimer</label><div className="point-actions"><button className="button button-small" disabled={busy || !centre} onClick={() => void generate(false)}>Generate for selected centre</button><button className="button button-small button-muted" disabled={busy || !centres.length} onClick={() => void generate(true)}>Generate for all centres</button></div><div role="status">{busy && <p>Generating sequentially. Keep this page open.</p>}{results.map((r, i) => <p key={i}>{r}</p>)}</div></section>;
}
