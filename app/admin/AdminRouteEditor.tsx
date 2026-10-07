"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AdminRouteMap from "./AdminRouteMap";
import { belgianProvinces, capitalRegion } from "../../lib/belgianRegions";
import { useCurrentLocale } from "../../lib/useLocale";

type Point = { id: string; sequence: number; category: string; title: string; description: string | null; warning: string | null; imageUrl: string | null; videoUrl: string | null; latitude: number; longitude: number };
type Centre = { id: string; slug: string; name: string; city: string; area: string | null; region: string; latitude: number | null; longitude: number | null; description?: string | null; isPublished?: boolean; _count?: { routes: number } };
type Route = { id: string; slug: string; name: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; durationMin: number | null; centre: Centre; points: Point[] };
type OfficialPassagePoint = { id: string; sequence: number; municipality: string; junction: string; sourceLabel: string; sourceUrl: string; sourceRevision: string | null; latitude: number | null; longitude: number | null; verificationStatus: string; notes: string | null };

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
const blankPoint = (sequence: number, latitude = "50.8382", longitude = "4.3047") => ({ sequence, category: "warning", title: "", description: "", warning: "", imageUrl: "", videoUrl: "", latitude, longitude });

export default function AdminRouteEditor() {
  const locale = useCurrentLocale();
  const nl = locale === "nl";
  const tr = (english: string, dutch: string) => nl ? dutch : english;
  const [routes, setRoutes] = useState<Route[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [officialPassagePoints, setOfficialPassagePoints] = useState<OfficialPassagePoint[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Point>>({});
  const [newPoint, setNewPoint] = useState(blankPoint(1));
  const [newRoute, setNewRoute] = useState({ centreId: "", slug: "", name: "", durationMin: "24" });
  const [newCentre, setNewCentre] = useState({ slug: "alken", name: "Alken", city: "Alken", area: "", region: "Limburg", latitude: "50.875", longitude: "5.307" });
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [showCentreForm, setShowCentreForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedRoute = useMemo(() => routes.find((route) => route.id === selectedId) ?? routes[0], [routes, selectedId]);

  async function refreshAccessToken() {
    const refreshToken = window.sessionStorage.getItem("routepilot.refreshToken");
    if (!refreshToken) throw new Error(tr("Session expired. Please log in again.", "Sessie verlopen. Log opnieuw in."));
    const response = await fetch(`${API}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.accessToken) {
      window.sessionStorage.removeItem("routepilot.accessToken");
      window.sessionStorage.removeItem("routepilot.refreshToken");
      throw new Error(tr("Session expired. Please log in again.", "Sessie verlopen. Log opnieuw in."));
    }
    window.sessionStorage.setItem("routepilot.accessToken", payload.accessToken);
    if (payload.refreshToken) window.sessionStorage.setItem("routepilot.refreshToken", payload.refreshToken);
    return payload.accessToken as string;
  }

  async function request(path: string, options: RequestInit = {}) {
    let token = window.sessionStorage.getItem("routepilot.accessToken");
    if (!token) throw new Error(tr("Please log in with an admin account first.", "Log eerst in met een adminaccount."));
    const send = (accessToken: string) => fetch(`${API}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...(options.headers ?? {}) } });
    let response = await send(token);
    if (response.status === 401) {
      token = await refreshAccessToken();
      response = await send(token);
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message ?? tr("Admin request failed", "Adminverzoek mislukt"));
    return body;
  }

  async function loadWorkspace() {
    setLoading(true); setError("");
    try {
      const [routeData, centreData] = await Promise.all([request("/admin/routes"), request("/admin/centres")]) as [Route[], Centre[]];
      setRoutes(routeData); setCentres(centreData);
      setSelectedId((current) => current || routeData[0]?.id || "");
      setNewRoute((current) => ({ ...current, centreId: current.centreId || centreData[0]?.id || "" }));
      setNewPoint(blankPoint((routeData[0]?.points.length ?? 0) + 1));
      if (routeData[0]?.centre?.id) {
        const passagePoints = await request(`/admin/centres/${routeData[0].centre.id}/official-passage-points`) as OfficialPassagePoint[];
        setOfficialPassagePoints(passagePoints);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr("Unable to load admin workspace", "Adminwerkruimte kon niet worden geladen")); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadWorkspace(); }, []);

  function selectRoute(route: Route) {
    setSelectedId(route.id);
    setNewPoint(blankPoint(route.points.length + 1, String(route.centre.latitude ?? 50.8382), String(route.centre.longitude ?? 4.3047)));
    void request(`/admin/centres/${route.centre.id}/official-passage-points`).then((points) => setOfficialPassagePoints(points as OfficialPassagePoint[])).catch(() => setOfficialPassagePoints([]));
  }

  async function createCentre(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await request("/admin/centres", { method: "POST", body: JSON.stringify({ ...newCentre, latitude: Number(newCentre.latitude), longitude: Number(newCentre.longitude), isPublished: true }) }) as Centre;
      setCentres((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewRoute((current) => ({ ...current, centreId: created.id })); setShowCentreForm(false);
      setNotice(`${created.name} ${tr("centre created. You can now create its first route.", "examencentrum aangemaakt. Je kunt nu de eerste route maken.")}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr("Unable to create centre", "Examencentrum kon niet worden aangemaakt")); }
  }

  async function createRoute(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await request("/admin/routes", { method: "POST", body: JSON.stringify({ ...newRoute, durationMin: Number(newRoute.durationMin) }) }) as Route;
      const centre = centres.find((item) => item.id === newRoute.centreId);
      const complete = { ...created, centre: centre ?? created.centre, points: created.points ?? [] };
      setRoutes((current) => [complete, ...current]); setSelectedId(complete.id); setShowRouteForm(false);
      void request(`/admin/centres/${complete.centre.id}/official-passage-points`).then((points) => setOfficialPassagePoints(points as OfficialPassagePoint[])).catch(() => setOfficialPassagePoints([]));
      setNewPoint(blankPoint(1, String(centre?.latitude ?? 50.8382), String(centre?.longitude ?? 4.3047)));
      setNotice(`${complete.name} ${tr("created as a draft.", "als concept aangemaakt.")}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr("Unable to create route", "Route kon niet worden aangemaakt")); }
  }

  async function saveStatus(status: Route["status"]) {
    if (!selectedRoute) return;
    try {
      const updated = await request(`/admin/routes/${selectedRoute.id}`, { method: "PATCH", body: JSON.stringify({ status }) }) as Route;
      setRoutes((current) => current.map((route) => route.id === updated.id ? { ...route, ...updated, centre: route.centre, points: updated.points ?? route.points } : route));
      setNotice(status === "PUBLISHED" ? tr("Route published for users.", "Route gepubliceerd voor gebruikers.") : `${tr("Route marked", "Route gemarkeerd als")} ${status.toLowerCase()}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr("Unable to update route", "Route kon niet worden bijgewerkt")); }
  }

  async function savePoint(point: Point) {
    if (!selectedRoute) return;
    try {
      const updated = await request(`/admin/points/${point.id}`, { method: "PATCH", body: JSON.stringify(point) }) as Point;
      setRoutes((current) => current.map((route) => route.id === selectedRoute.id ? { ...route, points: route.points.map((item) => item.id === updated.id ? updated : item) } : route));
      setDrafts((current) => { const next = { ...current }; delete next[point.id]; return next; }); setNotice(tr("Point saved.", "Punt opgeslagen."));
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr("Unable to save point", "Punt kon niet worden opgeslagen")); }
  }

  async function saveOfficialPassagePoint(id: string, payload: { latitude?: number; longitude?: number; verificationStatus: string; notes?: string }) {
    try {
      const updated = await request(`/admin/official-passage-points/${id}`, { method: "PATCH", body: JSON.stringify(payload) }) as OfficialPassagePoint;
      setOfficialPassagePoints((current) => current.map((point) => point.id === updated.id ? updated : point));
      setNotice(payload.verificationStatus === "VERIFIED" ? tr("Official passage point verified.", "Officieel doorgangspunt geverifieerd.") : tr("Official passage point saved.", "Officieel doorgangspunt opgeslagen."));
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr("Unable to save official passage point", "Officieel doorgangspunt kon niet worden opgeslagen")); }
  }

  function movePoint(id: string, latitude: number, longitude: number) {
    if (!selectedRoute) return;
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? selectedRoute.points.find((point) => point.id === id)!), latitude, longitude } }));
    setNotice(tr("Point moved. Save the point to persist the new location.", "Punt verplaatst. Sla het punt op om de nieuwe locatie te bewaren."));
  }

  async function reorderPoints(pointId: string, direction: -1 | 1) {
    if (!selectedRoute) return;
    const ordered = [...selectedRoute.points].sort((a, b) => a.sequence - b.sequence); const index = ordered.findIndex((point) => point.id === pointId); const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
    try {
      const points = await request(`/admin/routes/${selectedRoute.id}/points/reorder`, { method: "PATCH", body: JSON.stringify({ pointIds: ordered.map((point) => point.id) }) }) as Point[];
      setRoutes((current) => current.map((route) => route.id === selectedRoute.id ? { ...route, points } : route)); setNotice(tr("Point order updated.", "Volgorde van punten bijgewerkt."));
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr("Unable to reorder points", "Punten konden niet opnieuw worden geordend")); }
  }

  async function addPoint(event: FormEvent) {
    event.preventDefault(); if (!selectedRoute) return;
    try {
      const created = await request(`/admin/routes/${selectedRoute.id}/points`, { method: "POST", body: JSON.stringify({ ...newPoint, sequence: Number(newPoint.sequence), latitude: Number(newPoint.latitude), longitude: Number(newPoint.longitude) }) }) as Point;
      setRoutes((current) => current.map((route) => route.id === selectedRoute.id ? { ...route, points: [...route.points, created].sort((a, b) => a.sequence - b.sequence) } : route));
      setNewPoint(blankPoint(selectedRoute.points.length + 2, newPoint.latitude, newPoint.longitude)); setNotice(tr("Point added to the route.", "Punt aan route toegevoegd."));
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr("Unable to add point", "Punt kon niet worden toegevoegd")); }
  }

  function addFromMap(latitude: number, longitude: number) {
    setNewPoint((current) => ({ ...current, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) }));
    setNotice(tr("Map location added to the new point form. Complete the title and save it.", "Kaartlocatie toegevoegd aan het nieuwe punt. Vul de titel in en sla op."));
  }

  if (loading) return <div className="admin-state">{tr("Loading route workspace…", "Routewerkruimte laden…")}</div>;
  if (error && !routes.length && !centres.length) return <div className="admin-state admin-error"><strong>{tr("Admin workspace unavailable", "Adminwerkruimte niet beschikbaar")}</strong><p>{error}</p><button className="button" onClick={() => void loadWorkspace()}>{tr("Try again", "Opnieuw proberen")}</button></div>;

  return <div className="admin-workspace">
    <aside className="admin-route-list"><div className="admin-list-header"><div><span className="small-label">{tr("ROUTES", "ROUTES")}</span><strong>{routes.length} {tr("total", "totaal")} · {centres.length} {tr("centres", "examencentra")}</strong></div><button className="admin-refresh" onClick={() => void loadWorkspace()} aria-label={tr("Refresh routes", "Routes vernieuwen")}>↻</button></div><button className="admin-create-link" onClick={() => setShowRouteForm((current) => !current)}>＋ {tr("Create route", "Route maken")}</button><button className="admin-create-link admin-create-secondary" onClick={() => setShowCentreForm((current) => !current)}>＋ {tr("Create centre", "Examencentrum maken")}</button>{routes.map((route) => <button key={route.id} className={`admin-route-item ${route.id === selectedRoute?.id ? "active" : ""}`} onClick={() => selectRoute(route)}><span className="admin-route-index">{String(route.points.length).padStart(2, "0")}</span><span><strong>{route.name}</strong><small>{route.centre.name}</small></span><em className={`status-dot status-${route.status.toLowerCase()}`} /></button>)}{!routes.length && <p className="admin-empty-list">{tr("Create a centre, then add its first route.", "Maak een examencentrum en voeg daarna de eerste route toe.")}</p>}</aside>
    <section className="admin-editor">
      {showCentreForm && <form className="admin-create-card" onSubmit={createCentre}><div className="new-point-heading"><div><span className="small-label">{tr("NEW TEST CENTRE", "NIEUW EXAMENCENTRUM")}</span><h3>{tr("Add centre", "Examencentrum toevoegen")}</h3></div><button type="button" className="admin-close" onClick={() => setShowCentreForm(false)}>×</button></div><div className="admin-form-grid"><label>{tr("Name", "Naam")}<input required value={newCentre.name} onChange={(event) => setNewCentre({ ...newCentre, name: event.target.value })} /></label><label>Slug<input required value={newCentre.slug} onChange={(event) => setNewCentre({ ...newCentre, slug: event.target.value })} /></label><label>{tr("City", "Stad")}<input required value={newCentre.city} onChange={(event) => setNewCentre({ ...newCentre, city: event.target.value })} /></label><label>{tr("Area", "Gebied")}<input value={newCentre.area} onChange={(event) => setNewCentre({ ...newCentre, area: event.target.value })} /></label><label>{tr("Province or region", "Provincie of regio")}<select required value={newCentre.region} onChange={(event) => setNewCentre({ ...newCentre, region: event.target.value })}><option value="">{tr("Choose province or region", "Kies provincie of regio")}</option><option value={capitalRegion.value}>{capitalRegion.labels[locale]}</option>{belgianProvinces.map((province) => <option key={province.value} value={province.value}>{province.labels[locale]}</option>)}</select></label><label>Latitude<input required type="number" step="any" value={newCentre.latitude} onChange={(event) => setNewCentre({ ...newCentre, latitude: event.target.value })} /></label><label>Longitude<input required type="number" step="any" value={newCentre.longitude} onChange={(event) => setNewCentre({ ...newCentre, longitude: event.target.value })} /></label></div><button className="button button-small" type="submit">{tr("Create centre", "Examencentrum maken")} <span>↗</span></button></form>}
      {showRouteForm && <form className="admin-create-card" onSubmit={createRoute}><div className="new-point-heading"><div><span className="small-label">{tr("NEW ROUTE", "NIEUWE ROUTE")}</span><h3>{tr("Create draft route", "Conceptroute maken")}</h3></div><button type="button" className="admin-close" onClick={() => setShowRouteForm(false)}>×</button></div><div className="admin-form-grid"><label>{tr("Test centre", "Examencentrum")}<select required value={newRoute.centreId} onChange={(event) => setNewRoute({ ...newRoute, centreId: event.target.value })}><option value="">{tr("Choose centre", "Kies examencentrum")}</option>{centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.name} · {centre.city}</option>)}</select></label><label>{tr("Route name", "Routenaam")}<input required value={newRoute.name} placeholder="Route 1" onChange={(event) => setNewRoute({ ...newRoute, name: event.target.value })} /></label><label>Slug<input required value={newRoute.slug} placeholder="alken-route-1" onChange={(event) => setNewRoute({ ...newRoute, slug: event.target.value })} /></label><label>{tr("Duration (min)", "Duur (min)")}<input type="number" min="1" value={newRoute.durationMin} onChange={(event) => setNewRoute({ ...newRoute, durationMin: event.target.value })} /></label></div><button className="button button-small" type="submit">{tr("Create draft", "Concept maken")} <span>↗</span></button></form>}
      {selectedRoute ? <><div className="admin-editor-head"><div><span className="small-label">{selectedRoute.centre.name}</span><h2>{selectedRoute.name}</h2><p>{selectedRoute.points.length} {tr("ordered route points", "gerangschikte routepunten")} · {selectedRoute.durationMin ?? "—"} {tr("minutes", "minuten")}</p></div><select value={selectedRoute.status} onChange={(event) => void saveStatus(event.target.value as Route["status"])} aria-label={tr("Route status", "Routestatus")}><option value="DRAFT">{tr("Draft", "Concept")}</option><option value="PUBLISHED">{tr("Publish route", "Route publiceren")}</option><option value="ARCHIVED">{tr("Archived", "Gearchiveerd")}</option></select></div>{notice && <p className="admin-notice">✓ {notice}</p>}{error && <p className="admin-inline-error">{error}</p>}<OfficialPassagePanel points={officialPassagePoints} onSave={saveOfficialPassagePoint} /> <AdminRouteMap route={selectedRoute} points={selectedRoute.points.map((point) => drafts[point.id] ?? point)} onMove={movePoint} onAdd={addFromMap} /><div className="point-editor-list">{selectedRoute.points.map((point, index) => <PointEditor key={point.id} point={point} draft={drafts[point.id] ?? point} isFirst={index === 0} isLast={index === selectedRoute.points.length - 1} onMoveUp={() => void reorderPoints(point.id, -1)} onMoveDown={() => void reorderPoints(point.id, 1)} onChange={(value) => setDrafts((current) => ({ ...current, [point.id]: value }))} onSave={() => void savePoint(drafts[point.id] ?? point)} />)}</div><form className="new-point-form" onSubmit={addPoint}><div className="new-point-heading"><div><span className="small-label">{tr("ADD TO MAP", "AAN KAART TOEVOEGEN")}</span><h3>{tr("New route point", "Nieuw routepunt")}</h3><p className="admin-form-hint">{tr("Click the map to fill coordinates, then add the official passage point.", "Klik op de kaart om coördinaten in te vullen en voeg daarna het officiële doorgangspunt toe.")}</p></div><span className="point-number">{String(newPoint.sequence).padStart(2, "0")}</span></div><div className="admin-form-grid"><label>{tr("Category", "Categorie")}<input value={newPoint.category} onChange={(event) => setNewPoint({ ...newPoint, category: event.target.value })} /></label><label>{tr("Title", "Titel")}<input required value={newPoint.title} onChange={(event) => setNewPoint({ ...newPoint, title: event.target.value })} /></label><label className="wide-field">{tr("Description", "Beschrijving")}<input value={newPoint.description} onChange={(event) => setNewPoint({ ...newPoint, description: event.target.value })} /></label><label className="wide-field">{tr("Warning", "Waarschuwing")}<input value={newPoint.warning} onChange={(event) => setNewPoint({ ...newPoint, warning: event.target.value })} /></label><label>Image URL<input type="url" value={newPoint.imageUrl} onChange={(event) => setNewPoint({ ...newPoint, imageUrl: event.target.value })} placeholder="https://…" /></label><label>Video URL<input type="url" value={newPoint.videoUrl} onChange={(event) => setNewPoint({ ...newPoint, videoUrl: event.target.value })} placeholder="https://…" /></label><label>Latitude<input type="number" step="any" value={newPoint.latitude} onChange={(event) => setNewPoint({ ...newPoint, latitude: event.target.value })} /></label><label>Longitude<input type="number" step="any" value={newPoint.longitude} onChange={(event) => setNewPoint({ ...newPoint, longitude: event.target.value })} /></label></div><button className="button" type="submit">{tr("Add point", "Punt toevoegen")} <span>↗</span></button></form></> : <div className="admin-state">{tr("Create a centre and route to begin.", "Maak een examencentrum en route om te beginnen.")}</div>}
    </section>
  </div>;
}

function OfficialPassagePanel({ points, onSave }: { points: OfficialPassagePoint[]; onSave: (id: string, payload: { latitude?: number; longitude?: number; verificationStatus: string; notes?: string }) => Promise<void> }) {
  const nl = useCurrentLocale() === "nl";
  if (!points.length) return null;
  const verified = points.filter((point) => point.verificationStatus === "VERIFIED" && point.latitude !== null && point.longitude !== null).length;
  return <section className="official-passage-panel"><div className="official-passage-heading"><div><span className="small-label">{nl ? "OFFICIËLE BRONREFERENTIE" : "OFFICIAL SOURCE REFERENCE"}</span><h3>{nl ? "Doorgangspunten Alken" : "Alken passage points"}</h3><p>{nl ? "Officiële kruispuntnamen zijn geïmporteerd uit Autoveiligheid. Coördinaten en de volgorde van Route 1 moeten nog door een admin worden gecontroleerd." : "Official junction names are imported from Autoveiligheid. Coordinates and Route 1 sequence still require admin verification."}</p></div><div className="official-passage-meta"><strong>{verified}/{points.length}</strong><span>{nl ? "coördinaten geverifieerd" : "coordinates verified"}</span><a href={points[0].sourceUrl} target="_blank" rel="noreferrer">{nl ? "Bron openen" : "Open source"} ↗</a></div></div><div className="official-passage-list">{points.map((point) => <OfficialPassageRow key={point.id} point={point} onSave={onSave} />)}</div></section>;
}

function OfficialPassageRow({ point, onSave }: { point: OfficialPassagePoint; onSave: (id: string, payload: { latitude?: number; longitude?: number; verificationStatus: string; notes?: string }) => Promise<void> }) {
  const nl = useCurrentLocale() === "nl";
  const [latitude, setLatitude] = useState(point.latitude === null ? "" : String(point.latitude));
  const [longitude, setLongitude] = useState(point.longitude === null ? "" : String(point.longitude));
  const [status, setStatus] = useState(point.verificationStatus);
  return <div className="official-passage-row"><span className="official-passage-number">{String(point.sequence).padStart(2, "0")}</span><div className="official-passage-copy"><strong>{point.junction}</strong><small>{point.municipality}</small></div><label className="passage-coordinate"><span>Lat</span><input type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label><label className="passage-coordinate"><span>Lng</span><input type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label><select className="passage-status-select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label={`${nl ? "Verificatiestatus voor" : "Verification status for"} ${point.junction}`}><option value="PENDING_REVIEW">{nl ? "In afwachting" : "Pending"}</option><option value="VERIFIED">{nl ? "Geverifieerd" : "Verified"}</option><option value="REJECTED">{nl ? "Afgewezen" : "Rejected"}</option></select><button type="button" className="button button-small passage-save" onClick={() => void onSave(point.id, { latitude: latitude ? Number(latitude) : undefined, longitude: longitude ? Number(longitude) : undefined, verificationStatus: status })}>{nl ? "Opslaan" : "Save"}</button></div>;
}

function PointEditor({ point, draft, isFirst, isLast, onMoveUp, onMoveDown, onChange, onSave }: { point: Point; draft: Point; isFirst: boolean; isLast: boolean; onMoveUp: () => void; onMoveDown: () => void; onChange: (point: Point) => void; onSave: () => void }) {
  const nl = useCurrentLocale() === "nl";
  return <article className="point-editor"><div className="point-editor-index">{String(point.sequence).padStart(2, "0")}</div><div className="point-editor-fields"><div className="admin-form-grid"><label>{nl ? "Categorie" : "Category"}<input value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })} /></label><label>{nl ? "Titel" : "Title"}<input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} /></label><label className="wide-field">{nl ? "Beschrijving" : "Description"}<input value={draft.description ?? ""} onChange={(event) => onChange({ ...draft, description: event.target.value })} /></label><label className="wide-field">{nl ? "Waarschuwing" : "Warning"}<input value={draft.warning ?? ""} onChange={(event) => onChange({ ...draft, warning: event.target.value })} /></label><label>Image URL<input type="url" value={draft.imageUrl ?? ""} onChange={(event) => onChange({ ...draft, imageUrl: event.target.value || null })} /></label><label>Video URL<input type="url" value={draft.videoUrl ?? ""} onChange={(event) => onChange({ ...draft, videoUrl: event.target.value || null })} /></label><label>Latitude<input type="number" step="any" value={draft.latitude} onChange={(event) => onChange({ ...draft, latitude: Number(event.target.value) })} /></label><label>Longitude<input type="number" step="any" value={draft.longitude} onChange={(event) => onChange({ ...draft, longitude: Number(event.target.value) })} /></label></div><div className="point-actions"><button type="button" className="button button-small button-muted" disabled={isFirst} onClick={onMoveUp}>↑ {nl ? "Omhoog" : "Move up"}</button><button type="button" className="button button-small button-muted" disabled={isLast} onClick={onMoveDown}>↓ {nl ? "Omlaag" : "Move down"}</button><button type="button" className="button button-small" onClick={onSave}>{nl ? "Punt opslaan" : "Save point"}</button></div></div><span className="point-map-pin">⌖</span></article>;
}
