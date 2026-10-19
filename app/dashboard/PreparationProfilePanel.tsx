"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch, SessionExpiredError } from "../../lib/clientSession";
import "./preparation-profile.css";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type Level = "BEGINNER" | "INTERMEDIATE" | "DIFFICULT";
type Profile = { ownerId: string; version: number; revision: string | null; saved: boolean; preferredName: string; age: number | null; homeTown: string; centreId: string | null; centre: { name: string } | null; preferredLevel: Level; focus: { pacing: string; needsReflection: boolean; items: Array<{ code: string; label: string; prompt: string; basis: string[] }> } };
type Form = { preferredName: string; age: string; homeTown: string; centreId: string; preferredLevel: Level };
const levels = [
  { id: "BEGINNER" as const, title: "Beginner", description: "One clear preparation focus at a time.", number: "01" },
  { id: "INTERMEDIATE" as const, title: "Intermediate", description: "Build consistency across familiar situations.", number: "02" },
  { id: "DIFFICULT" as const, title: "Difficult", description: "Discuss demanding practice with your instructor.", number: "03" },
];

export default function PreparationProfilePanel() {
  const [profile, setProfile] = useState<Profile | null>(null), [form, setForm] = useState<Form | null>(null);
  const [centres, setCentres] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [confirmClear, setConfirmClear] = useState(false);
  const generation = useRef(0), controller = useRef<AbortController | null>(null);
  const clearTrigger = useRef<HTMLButtonElement | null>(null), keepPreferences = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (confirmClear) keepPreferences.current?.focus(); }, [confirmClear]);
  const show = (p: Profile) => { setProfile(p); setForm({ preferredName: p.preferredName, age: p.age === null ? "" : String(p.age), homeTown: p.homeTown, centreId: p.centreId ?? "", preferredLevel: p.preferredLevel }); };
  const load = useCallback(async () => {
    const request = ++generation.current; controller.current?.abort(); const next = new AbortController(); controller.current = next;
    setProfile(null); setForm(null); setLoading(true); setError(""); setNotice(""); setConfirmClear(false);
    try {
      const [r, c] = await Promise.all([authFetch(`${API}/me/preparation-profile`, { cache: "no-store", signal: next.signal }), fetch(`${API}/exam-centres`, { signal: next.signal })]);
      if (!r.ok) throw Error("Private preparation settings are temporarily unavailable. Your existing route access is unchanged.");
      if (!c.ok) throw Error("The centre list is unavailable. Please retry.");
      const [p, list] = await Promise.all([r.json(), c.json()]);
      if (request !== generation.current || next.signal.aborted) return;
      if (!p || typeof p.ownerId !== "string" || !Number.isInteger(p.version) || !p.focus || !Array.isArray(p.focus.items) || !levels.some(l => l.id === p.preferredLevel) || !Array.isArray(list)) throw Error("Preparation settings are temporarily unavailable. Please retry.");
      show(p); setCentres(list);
    } catch (e) {
      if (request === generation.current && !next.signal.aborted) setError(e instanceof SessionExpiredError ? "Sign in again to view your private preparation profile." : e instanceof Error ? e.message : "Could not load preparation settings.");
    } finally { if (request === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void load(); const changed = () => { void load(); }; window.addEventListener("routepilot-auth-change", changed);
    return () => { generation.current++; controller.current?.abort(); window.removeEventListener("routepilot-auth-change", changed); };
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!profile || !form || busy) return;
    const owner = profile.ownerId, request = generation.current; setBusy(true); setError(""); setNotice("");
    try {
      const response = await authFetch(`${API}/me/preparation-profile`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerId: owner, version: profile.version, revision: profile.revision, preferredName: form.preferredName.trim() || null, age: form.age === "" ? null : Number(form.age), centreId: form.centreId || null, homeTown: form.homeTown.trim() || null, preferredLevel: form.preferredLevel }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw Error(response.status === 409 ? "Your account or profile changed. Reload settings before saving again." : "Check the fields and try again. Use only a town/area name for hometown.");
      if (request !== generation.current) { void load(); return; }
      if (result.ownerId !== owner) throw Error("Account changed. Reload your settings.");
      show(result); setNotice("Private preferences saved. Your plan, trial and purchased centre are unchanged."); window.dispatchEvent(new Event("routepilot-preparation-change"));
    } catch (e) { if (request === generation.current) setError(e instanceof SessionExpiredError ? "Sign in again before saving." : e instanceof Error ? e.message : "Could not save preferences."); }
    finally { setBusy(false); }
  }
  async function clear() {
    if (!profile || busy) return; const request = generation.current; setBusy(true); setError("");
    try {
      const r = await authFetch(`${API}/me/preparation-profile`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerId: profile.ownerId, version: profile.version, revision: profile.revision }) });
      if (!r.ok) throw Error(r.status === 409 ? "Your profile changed. Reload before clearing." : "Could not clear your preferences.");
      if (request === generation.current) { await load(); setNotice("Optional preparation preferences cleared. Your account and access are unchanged."); window.dispatchEvent(new Event("routepilot-preparation-change")); }
    } catch (e) { if (request === generation.current) setError(e instanceof Error ? e.message : "Could not clear preferences."); }
    finally { setBusy(false); }
  }

  return <section className="dashboard-card preparation-profile" aria-labelledby="preparation-profile-heading">
    <header className="preparation-profile-heading"><div><span className="small-label">YOUR PREPARATION, YOUR PACE</span><h2 id="preparation-profile-heading">Build your practice profile.</h2><p>Choose how you want to prepare. Your level is a preference—not an exam score or a driving-ability assessment.</p></div><span className="preparation-private">Private · Optional</span></header>
    {loading ? <p role="status">Loading your private preferences…</p> : form && profile ? <form onSubmit={save}>
      <div className="preparation-fields">
        <label>Preferred name<input autoComplete="given-name" maxLength={80} value={form.preferredName} onChange={e => setForm({ ...form, preferredName: e.target.value })} /></label>
        <label><span className="preparation-field-label">Age <small>(optional)</small></span><input type="number" inputMode="numeric" min={1} max={120} step={1} value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} /><small>Not used to infer ability or decide route access.</small></label>
        <label>Preferred exam centre<select value={form.centreId} onChange={e => setForm({ ...form, centreId: e.target.value })}><option value="">Choose later</option>{profile.centreId && !centres.some(c => c.id === profile.centreId) && <option disabled value={profile.centreId}>{profile.centre?.name ?? "Previous centre"} · unavailable</option>}{centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><small>This does not move a Basic purchase to another centre.</small></label>
        <label><span className="preparation-field-label">Hometown / area <small>(optional)</small></span><input maxLength={80} autoComplete="off" placeholder="e.g. Leuven — no home address" value={form.homeTown} onChange={e => setForm({ ...form, homeTown: e.target.value })} /><small>Town name only. Select the matching place below before generating a private route.</small></label>
      </div>
      <fieldset className="preparation-levels"><legend>Your preparation level</legend><div>{levels.map(level => <label className={form.preferredLevel === level.id ? "is-selected" : ""} key={level.id}><span className="preparation-level-number">{level.number}</span><input type="radio" name="preparation-level" value={level.id} checked={form.preferredLevel === level.id} onChange={() => setForm({ ...form, preferredLevel: level.id })} /><strong>{level.title}</strong><small>{level.description}</small></label>)}</div></fieldset>
      <div className="preparation-focus"><span className="small-label">FROM YOUR SAVED REFLECTION</span><h3>A focus you can explain.</h3><p>{profile.focus.pacing}</p>{profile.focus.items.length ? <ul>{profile.focus.items.map(item => <li key={item.code}><strong>{item.label}</strong><span>{item.basis.map(b => b === "INSTRUCTOR_REPORTED" ? "Instructor-reported" : "Self-reported").join(" + ")}</span><p>{item.prompt}</p></li>)}</ul> : <p>No supported focus recorded yet. Complete a reflection after a drive to build your preparation plan.</p>}<small>These are reported preparation needs, not GPS-confirmed mistakes. Route geometry, duration checks and plan access stay unchanged.</small></div>
      <div className="preparation-actions"><button className="button button-small" type="submit" disabled={busy}>{busy ? "Saving…" : "Save private preferences"} <span>↗</span></button><button type="button" onClick={() => void load()} disabled={busy}>Reload settings</button>{profile.saved && <button ref={clearTrigger} type="button" onClick={() => setConfirmClear(true)} disabled={busy}>Clear optional profile</button>}</div>
    </form> : <button className="button button-small" onClick={() => void load()}>Retry settings</button>}
    {confirmClear && <div className="preparation-clear" role="alertdialog" aria-modal="false" aria-labelledby="preparation-clear-heading" onKeyDown={event => { if (event.key === "Escape") { setConfirmClear(false); clearTrigger.current?.focus(); } }}><h3 id="preparation-clear-heading">Clear these optional preferences?</h3><p>This removes your preparation name, age, hometown, level and centre preference. Your account, purchases and practice history stay intact.</p><button type="button" onClick={() => void clear()} disabled={busy}>Yes, clear preferences</button><button ref={keepPreferences} type="button" onClick={() => { setConfirmClear(false); clearTrigger.current?.focus(); }} disabled={busy}>Keep preferences</button></div>}
    {error && <p className="preparation-error" role="alert">{error}</p>}{notice && <p className="preparation-notice" role="status">{notice}</p>}
  </section>;
}
