"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AdminRouteMap from "./AdminRouteMap";

type Point = { id: string; sequence: number; category: string; title: string; description: string | null; warning: string | null; imageUrl: string | null; videoUrl: string | null; latitude: number; longitude: number };
type Centre = { id: string; slug: string; name: string; city: string; area: string | null; region: string; latitude: number | null; longitude: number | null; description?: string | null; isPublished?: boolean; _count?: { routes: number } };
type Route = { id: string; slug: string; name: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; durationMin: number | null; centre: Centre; points: Point[] };

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
const blankPoint = (sequence: number, latitude = "50.8382", longitude = "4.3047") => ({ sequence, category: "warning", title: "", description: "", warning: "", imageUrl: "", videoUrl: "", latitude, longitude });

export default function AdminRouteEditor() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
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
    if (!refreshToken) throw new Error("Session expired. Please log in again.");
    const response = await fetch(`${API}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.accessToken) {
      window.sessionStorage.removeItem("routepilot.accessToken");
      window.sessionStorage.removeItem("routepilot.refreshToken");
      throw new Error("Session expired. Please log in again.");
    }
    window.sessionStorage.setItem("routepilot.accessToken", payload.accessToken);
    if (payload.refreshToken) window.sessionStorage.setItem("routepilot.refreshToken", payload.refreshToken);
    return payload.accessToken as string;
  }

  async function request(path: string, options: RequestInit = {}) {
    let token = window.sessionStorage.getItem("routepilot.accessToken");
    if (!token) throw new Error("Please log in with an admin account first.");
    const send = (accessToken: string) => fetch(`${API}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...(options.headers ?? {}) } });
    let response = await send(token);
    if (response.status === 401) {
      token = await refreshAccessToken();
      response = await send(token);
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message ?? "Admin request failed");
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
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load admin workspace"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadWorkspace(); }, []);

  function selectRoute(route: Route) {
    setSelectedId(route.id);
    setNewPoint(blankPoint(route.points.length + 1, String(route.centre.latitude ?? 50.8382), String(route.centre.longitude ?? 4.3047)));
  }

  async function createCentre(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await request("/admin/centres", { method: "POST", body: JSON.stringify({ ...newCentre, latitude: Number(newCentre.latitude), longitude: Number(newCentre.longitude), isPublished: true }) }) as Centre;
      setCentres((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewRoute((current) => ({ ...current, centreId: created.id })); setShowCentreForm(false);
      setNotice(`${created.name} centre created. You can now create its first route.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create centre"); }
  }

  async function createRoute(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await request("/admin/routes", { method: "POST", body: JSON.stringify({ ...newRoute, durationMin: Number(newRoute.durationMin) }) }) as Route;
      const centre = centres.find((item) => item.id === newRoute.centreId);
      const complete = { ...created, centre: centre ?? created.centre, points: created.points ?? [] };
      setRoutes((current) => [complete, ...current]); setSelectedId(complete.id); setShowRouteForm(false);
      setNewPoint(blankPoint(1, String(centre?.latitude ?? 50.8382), String(centre?.longitude ?? 4.3047)));
      setNotice(`${complete.name} created as a draft.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create route"); }
  }

  async function saveStatus(status: Route["status"]) {
    if (!selectedRoute) return;
    try {
      const updated = await request(`/admin/routes/${selectedRoute.id}`, { method: "PATCH", body: JSON.stringify({ status }) }) as Route;
      setRoutes((current) => current.map((route) => route.id === updated.id ? { ...route, ...updated, centre: route.centre, points: updated.points ?? route.points } : route));
      setNotice(status === "PUBLISHED" ? "Route published for users." : `Route marked ${status.toLowerCase()}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update route"); }
  }

  async function savePoint(point: Point) {
    if (!selectedRoute) return;
    try {
      const updated = await request(`/admin/points/${point.id}`, { method: "PATCH", body: JSON.stringify(point) }) as Point;
      setRoutes((current) => current.map((route) => route.id === selectedRoute.id ? { ...route, points: route.points.map((item) => item.id === updated.id ? updated : item) } : route));
      setDrafts((current) => { const next = { ...current }; delete next[point.id]; return next; }); setNotice("Point saved.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save point"); }
  }

  function movePoint(id: string, latitude: number, longitude: number) {
    if (!selectedRoute) return;
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? selectedRoute.points.find((point) => point.id === id)!), latitude, longitude } }));
    setNotice("Point moved. Save the point to persist the new location.");
  }

  async function reorderPoints(pointId: string, direction: -1 | 1) {
    if (!selectedRoute) return;
    const ordered = [...selectedRoute.points].sort((a, b) => a.sequence - b.sequence); const index = ordered.findIndex((point) => point.id === pointId); const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
    try {
      const points = await request(`/admin/routes/${selectedRoute.id}/points/reorder`, { method: "PATCH", body: JSON.stringify({ pointIds: ordered.map((point) => point.id) }) }) as Point[];
      setRoutes((current) => current.map((route) => route.id === selectedRoute.id ? { ...route, points } : route)); setNotice("Point order updated.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to reorder points"); }
  }

  async function addPoint(event: FormEvent) {
    event.preventDefault(); if (!selectedRoute) return;
    try {
      const created = await request(`/admin/routes/${selectedRoute.id}/points`, { method: "POST", body: JSON.stringify({ ...newPoint, sequence: Number(newPoint.sequence), latitude: Number(newPoint.latitude), longitude: Number(newPoint.longitude) }) }) as Point;
      setRoutes((current) => current.map((route) => route.id === selectedRoute.id ? { ...route, points: [...route.points, created].sort((a, b) => a.sequence - b.sequence) } : route));
      setNewPoint(blankPoint(selectedRoute.points.length + 2, newPoint.latitude, newPoint.longitude)); setNotice("Point added to the route.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to add point"); }
  }

  function addFromMap(latitude: number, longitude: number) {
    setNewPoint((current) => ({ ...current, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) }));
    setNotice("Map location added to the new point form. Complete the title and save it.");
  }

  if (loading) return <div className="admin-state">Loading route workspace…</div>;
  if (error && !routes.length && !centres.length) return <div className="admin-state admin-error"><strong>Admin workspace unavailable</strong><p>{error}</p><button className="button" onClick={() => void loadWorkspace()}>Try again</button></div>;

  return <div className="admin-workspace">
    <aside className="admin-route-list"><div className="admin-list-header"><div><span className="small-label">ROUTES</span><strong>{routes.length} total · {centres.length} centres</strong></div><button className="admin-refresh" onClick={() => void loadWorkspace()} aria-label="Refresh routes">↻</button></div><button className="admin-create-link" onClick={() => setShowRouteForm((current) => !current)}>＋ Create route</button><button className="admin-create-link admin-create-secondary" onClick={() => setShowCentreForm((current) => !current)}>＋ Create centre</button>{routes.map((route) => <button key={route.id} className={`admin-route-item ${route.id === selectedRoute?.id ? "active" : ""}`} onClick={() => selectRoute(route)}><span className="admin-route-index">{String(route.points.length).padStart(2, "0")}</span><span><strong>{route.name}</strong><small>{route.centre.name}</small></span><em className={`status-dot status-${route.status.toLowerCase()}`} /></button>)}{!routes.length && <p className="admin-empty-list">Create a centre, then add its first route.</p>}</aside>
    <section className="admin-editor">
      {showCentreForm && <form className="admin-create-card" onSubmit={createCentre}><div className="new-point-heading"><div><span className="small-label">NEW TEST CENTRE</span><h3>Add centre</h3></div><button type="button" className="admin-close" onClick={() => setShowCentreForm(false)}>×</button></div><div className="admin-form-grid"><label>Name<input required value={newCentre.name} onChange={(event) => setNewCentre({ ...newCentre, name: event.target.value })} /></label><label>Slug<input required value={newCentre.slug} onChange={(event) => setNewCentre({ ...newCentre, slug: event.target.value })} /></label><label>City<input required value={newCentre.city} onChange={(event) => setNewCentre({ ...newCentre, city: event.target.value })} /></label><label>Area<input value={newCentre.area} onChange={(event) => setNewCentre({ ...newCentre, area: event.target.value })} /></label><label>Region<input required value={newCentre.region} onChange={(event) => setNewCentre({ ...newCentre, region: event.target.value })} /></label><label>Latitude<input required type="number" step="any" value={newCentre.latitude} onChange={(event) => setNewCentre({ ...newCentre, latitude: event.target.value })} /></label><label>Longitude<input required type="number" step="any" value={newCentre.longitude} onChange={(event) => setNewCentre({ ...newCentre, longitude: event.target.value })} /></label></div><button className="button button-small" type="submit">Create centre <span>↗</span></button></form>}
      {showRouteForm && <form className="admin-create-card" onSubmit={createRoute}><div className="new-point-heading"><div><span className="small-label">NEW ROUTE</span><h3>Create draft route</h3></div><button type="button" className="admin-close" onClick={() => setShowRouteForm(false)}>×</button></div><div className="admin-form-grid"><label>Test centre<select required value={newRoute.centreId} onChange={(event) => setNewRoute({ ...newRoute, centreId: event.target.value })}><option value="">Choose centre</option>{centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.name} · {centre.city}</option>)}</select></label><label>Route name<input required value={newRoute.name} placeholder="Route 1" onChange={(event) => setNewRoute({ ...newRoute, name: event.target.value })} /></label><label>Slug<input required value={newRoute.slug} placeholder="alken-route-1" onChange={(event) => setNewRoute({ ...newRoute, slug: event.target.value })} /></label><label>Duration (min)<input type="number" min="1" value={newRoute.durationMin} onChange={(event) => setNewRoute({ ...newRoute, durationMin: event.target.value })} /></label></div><button className="button button-small" type="submit">Create draft <span>↗</span></button></form>}
      {selectedRoute ? <><div className="admin-editor-head"><div><span className="small-label">{selectedRoute.centre.name}</span><h2>{selectedRoute.name}</h2><p>{selectedRoute.points.length} ordered route points · {selectedRoute.durationMin ?? "—"} minutes</p></div><select value={selectedRoute.status} onChange={(event) => void saveStatus(event.target.value as Route["status"])} aria-label="Route status"><option value="DRAFT">Draft</option><option value="PUBLISHED">Publish route</option><option value="ARCHIVED">Archived</option></select></div>{notice && <p className="admin-notice">✓ {notice}</p>}{error && <p className="admin-inline-error">{error}</p>}<AdminRouteMap route={selectedRoute} points={selectedRoute.points.map((point) => drafts[point.id] ?? point)} onMove={movePoint} onAdd={addFromMap} /><div className="point-editor-list">{selectedRoute.points.map((point, index) => <PointEditor key={point.id} point={point} draft={drafts[point.id] ?? point} isFirst={index === 0} isLast={index === selectedRoute.points.length - 1} onMoveUp={() => void reorderPoints(point.id, -1)} onMoveDown={() => void reorderPoints(point.id, 1)} onChange={(value) => setDrafts((current) => ({ ...current, [point.id]: value }))} onSave={() => void savePoint(drafts[point.id] ?? point)} />)}</div><form className="new-point-form" onSubmit={addPoint}><div className="new-point-heading"><div><span className="small-label">ADD TO MAP</span><h3>New route point</h3><p className="admin-form-hint">Click the map to fill coordinates, then add the official passage point.</p></div><span className="point-number">{String(newPoint.sequence).padStart(2, "0")}</span></div><div className="admin-form-grid"><label>Category<input value={newPoint.category} onChange={(event) => setNewPoint({ ...newPoint, category: event.target.value })} /></label><label>Title<input required value={newPoint.title} onChange={(event) => setNewPoint({ ...newPoint, title: event.target.value })} /></label><label className="wide-field">Description<input value={newPoint.description} onChange={(event) => setNewPoint({ ...newPoint, description: event.target.value })} /></label><label className="wide-field">Warning<input value={newPoint.warning} onChange={(event) => setNewPoint({ ...newPoint, warning: event.target.value })} /></label><label>Image URL<input type="url" value={newPoint.imageUrl} onChange={(event) => setNewPoint({ ...newPoint, imageUrl: event.target.value })} placeholder="https://…" /></label><label>Video URL<input type="url" value={newPoint.videoUrl} onChange={(event) => setNewPoint({ ...newPoint, videoUrl: event.target.value })} placeholder="https://…" /></label><label>Latitude<input type="number" step="any" value={newPoint.latitude} onChange={(event) => setNewPoint({ ...newPoint, latitude: event.target.value })} /></label><label>Longitude<input type="number" step="any" value={newPoint.longitude} onChange={(event) => setNewPoint({ ...newPoint, longitude: event.target.value })} /></label></div><button className="button" type="submit">Add point <span>↗</span></button></form></> : <div className="admin-state">Create a centre and route to begin.</div>}
    </section>
  </div>;
}

function PointEditor({ point, draft, isFirst, isLast, onMoveUp, onMoveDown, onChange, onSave }: { point: Point; draft: Point; isFirst: boolean; isLast: boolean; onMoveUp: () => void; onMoveDown: () => void; onChange: (point: Point) => void; onSave: () => void }) {
  return <article className="point-editor"><div className="point-editor-index">{String(point.sequence).padStart(2, "0")}</div><div className="point-editor-fields"><div className="admin-form-grid"><label>Category<input value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })} /></label><label>Title<input value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} /></label><label className="wide-field">Description<input value={draft.description ?? ""} onChange={(event) => onChange({ ...draft, description: event.target.value })} /></label><label className="wide-field">Warning<input value={draft.warning ?? ""} onChange={(event) => onChange({ ...draft, warning: event.target.value })} /></label><label>Image URL<input type="url" value={draft.imageUrl ?? ""} onChange={(event) => onChange({ ...draft, imageUrl: event.target.value || null })} /></label><label>Video URL<input type="url" value={draft.videoUrl ?? ""} onChange={(event) => onChange({ ...draft, videoUrl: event.target.value || null })} /></label><label>Latitude<input type="number" step="any" value={draft.latitude} onChange={(event) => onChange({ ...draft, latitude: Number(event.target.value) })} /></label><label>Longitude<input type="number" step="any" value={draft.longitude} onChange={(event) => onChange({ ...draft, longitude: Number(event.target.value) })} /></label></div><div className="point-actions"><button type="button" className="button button-small button-muted" disabled={isFirst} onClick={onMoveUp}>↑ Move up</button><button type="button" className="button button-small button-muted" disabled={isLast} onClick={onMoveDown}>↓ Move down</button><button type="button" className="button button-small" onClick={onSave}>Save point</button></div></div><span className="point-map-pin">⌖</span></article>;
}
