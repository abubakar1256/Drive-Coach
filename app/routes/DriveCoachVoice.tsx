"use client";

import { useEffect, useMemo, useState } from "react";
import type { RoutePoint } from "../../lib/data";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type Mode = "LIGHT" | "COACH" | "INTENSIVE";

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radius = 6371000;
  const latDelta = (bLat - aLat) * Math.PI / 180;
  const lngDelta = (bLng - aLng) * Math.PI / 180;
  const value = Math.sin(latDelta / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(lngDelta / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export default function DriveCoachVoice({ routePoints, sessionId }: { routePoints: RoutePoint[]; sessionId?: string | null }) {
  const [mode, setMode] = useState<Mode>("COACH");
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("Voice guidance is off");
  const usablePoints = useMemo(() => routePoints.filter((point) => point.id && point.latitude !== undefined && point.longitude !== undefined), [routePoints]);

  useEffect(() => {
    if (!enabled) return;
    const token = window.sessionStorage.getItem("routepilot.accessToken");
    if (!token || !navigator.geolocation || usablePoints.length === 0) {
      setStatus("Start a saved route with location permission to use voice guidance.");
      setEnabled(false);
      return;
    }
    const delivered = new Set<string>();
    const watchId = navigator.geolocation.watchPosition((position) => {
      const nearest = usablePoints.map((point) => ({ point, distance: distanceM(position.coords.latitude, position.coords.longitude, point.latitude!, point.longitude!) })).sort((a, b) => a.distance - b.distance)[0];
      if (!nearest || nearest.distance > 180 || delivered.has(nearest.point.id!)) return;
      const params = new URLSearchParams({ routePointId: nearest.point.id!, distanceM: String(Math.round(nearest.distance)), mode });
      if (sessionId) params.set("sessionId", sessionId);
      void fetch(`${API}/me/drive-coach/trigger?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()).then((payload) => {
        delivered.add(nearest.point.id!);
        if (!payload.speak || !payload.tip?.voiceTextEn) return;
        const locale = window.localStorage.getItem("routepilot.locale");
        const message = locale === "fr" && payload.tip.voiceTextFr ? payload.tip.voiceTextFr : locale === "nl" && payload.tip.voiceTextNl ? payload.tip.voiceTextNl : payload.tip.voiceTextEn;
        setStatus(`${payload.tip.skillName}: ${message}`);
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(message);
          utterance.lang = locale === "fr" ? "fr-BE" : locale === "nl" ? "nl-BE" : "en-GB";
          utterance.rate = 0.88;
          window.speechSynthesis.speak(utterance);
        }
      }).catch(() => setStatus("Voice reminder unavailable; continue with the route checklist."));
    }, () => setStatus("Location permission was not granted."), { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    setStatus(`Hands-free ${mode.toLowerCase()} mode ready for ${usablePoints.length} verified points.`);
    return () => { navigator.geolocation.clearWatch(watchId); if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, [enabled, mode, sessionId, usablePoints]);

  return <div className="voice-guidance-card"><div><span className="small-label">DRIVE COACH VOICE</span><strong>Hands-free reminders</strong></div><label>Mode<select value={mode} onChange={(event) => setMode(event.target.value as Mode)} disabled={enabled}><option value="LIGHT">Light</option><option value="COACH">Coach</option><option value="INTENSIVE">Intensive</option></select></label><button className={enabled ? "is-active" : ""} onClick={() => setEnabled((value) => !value)}>{enabled ? "Stop voice guidance" : "Enable voice guidance"}</button><small>{status}</small></div>;
}
