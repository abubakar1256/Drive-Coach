"use client";
import { useEffect, useRef, useState } from "react";
import type { RoutePoint } from "../../lib/data";
import { authFetch } from "../../lib/clientSession";
import { useCurrentLocale } from "../../lib/useLocale";
export type CoachPosition = { latitude: number; longitude: number; accuracyM: number; timestamp: number };
type Mode = "LIGHT" | "COACH" | "INTENSIVE";
function distance(a: CoachPosition, b: RoutePoint) { const lat = (a.latitude + b.latitude!) * Math.PI / 360; return Math.hypot((a.longitude - b.longitude!) * Math.cos(lat), a.latitude - b.latitude!) * Math.PI / 180 * 6371000; }

// Reuses the explicitly consented practice GPS stream; no independent watcher.
export default function DriveCoachVoice({ routePoints, sessionId, position, active }: { routePoints: RoutePoint[]; sessionId: string | null; position: CoachPosition | null; active: boolean }) {
  const nl = useCurrentLocale() === "nl", [enabled, setEnabled] = useState(false), [mode, setMode] = useState<Mode>("COACH"), [status, setStatus] = useState("");
  const delivered = useRef(new Set<string>()), pending = useRef(false), epoch = useRef(0), lastSpoken = useRef(0);
  useEffect(() => {
    delivered.current.clear(); lastSpoken.current = 0; pending.current = false; epoch.current++; setEnabled(false);
    const stop = () => { epoch.current++; setEnabled(false); if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
    const hidden = () => { if (document.hidden) stop(); };
    window.addEventListener("routepilot-auth-change", stop); document.addEventListener("visibilitychange", hidden);
    return () => { stop(); window.removeEventListener("routepilot-auth-change", stop); document.removeEventListener("visibilitychange", hidden); };
  }, [sessionId]);
  useEffect(() => { if (!active || !enabled) { epoch.current++; if ("speechSynthesis" in window) window.speechSynthesis.cancel(); if (!active) setEnabled(false); } }, [active, enabled]);
  useEffect(() => {
    if (!enabled || !active || !sessionId || !position || pending.current || document.hidden || position.accuracyM > 35 || position.accuracyM < 0 || !Number.isFinite(position.timestamp) || Math.abs(Date.now() - position.timestamp) > 10000 || Date.now() - lastSpoken.current < 30000) return;
    const nearest = routePoints.filter(p => p.id && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)).map(p => ({ p, distance: distance(position, p) })).sort((a,b) => a.distance-b.distance)[0];
    if (!nearest || nearest.distance > 180 || delivered.current.has(nearest.p.id!)) return;
    const generation = epoch.current; pending.current = true;
    const params = new URLSearchParams({ routePointId: nearest.p.id!, distanceM: String(Math.round(nearest.distance)), mode, sessionId });
    void authFetch(`${process.env.NEXT_PUBLIC_API_URL ?? "/api/v1"}/me/drive-coach/trigger?${params}`, { cache:"no-store" }).then(async r => {
      if (!r.ok) throw Error(); const data = await r.json(); if (generation !== epoch.current || document.hidden) return;
      delivered.current.add(nearest.p.id!);
      if (!data.speak || !data.tip?.voiceTextEn) return;
      const text = nl && data.tip.voiceTextNl ? data.tip.voiceTextNl : data.tip.voiceTextEn;
      if ("speechSynthesis" in window) { const utterance = new SpeechSynthesisUtterance(text); utterance.lang = nl ? "nl-BE" : "en-GB"; utterance.rate = .9; window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance); lastSpoken.current = Date.now(); setStatus(text); }
    }).catch(() => { if (generation === epoch.current) { lastSpoken.current = Date.now(); setStatus(nl ? "Herinnering niet beschikbaar." : "Reminder unavailable. No automatic replay."); } }).finally(() => { pending.current = false; });
  }, [position, active, enabled, mode, sessionId, routePoints, nl]);
  function toggle() {
    if (enabled) { epoch.current++; setEnabled(false); setStatus(nl ? "Stem uit." : "Voice off."); return; }
    if (!("speechSynthesis" in window)) { setStatus(nl ? "Deze browser ondersteunt geen stem." : "Speech is unavailable in this browser."); return; }
    setEnabled(true); setStatus(nl ? "Wachten op een betrouwbare GPS-positie." : "Listening for a reliable practice GPS position.");
  }
  return <section className="voice-guidance-card"><div><span className="small-label">DRIVE COACH VOICE</span><strong>{nl ? "Korte, optionele herinneringen" : "Short, optional reminders"}</strong></div><p>{nl ? "Gebruikt de GPS van je oefensessie. Voor vertrek instellen. Geen afslag-voor-afslag navigatie." : "Uses your practice session’s GPS. Set up before moving. These reminders are separate from turn-by-turn navigation."}</p><label>{nl ? "Modus" : "Mode"}<select value={mode} disabled={enabled} onChange={e => setMode(e.target.value as Mode)}><option value="LIGHT">Light</option><option value="COACH">Coach</option><option value="INTENSIVE">Intensive</option></select></label><button type="button" onClick={toggle} disabled={!active || !sessionId}>{enabled ? (nl ? "Stem stoppen" : "Stop voice reminders") : (nl ? "Stem inschakelen" : "Enable voice reminders")}</button><small role="status">{status || (nl ? "Uit · start eerst je oefensessie met GPS." : "Off · start or resume practice with GPS first.")}</small></section>;
}
