"use client";
import { useCallback, useEffect, useState } from "react";
import { authFetch } from "./clientSession";

export type PracticeStatus = { routeId: string; slug: string; name: string; attempts: number; completedDrives: number; sessionId: string; activeSessionId: string | null; completionKind: string; completionPct: number; startedAt: string; completedAt: string | null; hasReflection: boolean; hasChecklist: boolean };
export function notifyPracticeChange() { window.dispatchEvent(new Event("routepilot-practice-change")); }
export function usePracticeStatus(centreSlug?: string, routeId?: string) {
  const [items, setItems] = useState<PracticeStatus[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(false), [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(r => r + 1), []);
  useEffect(() => {
    let disposed = false, generation = 0;
    async function load() {
      const current = ++generation; setItems([]); setError(false);
      if (!sessionStorage.getItem("routepilot.accessToken")) { setLoading(false); return; }
      setLoading(true); const params = new URLSearchParams(); if (centreSlug) params.set("centreSlug", centreSlug); if (routeId) params.set("routeId", routeId);
      try {
        const r = await authFetch(`${process.env.NEXT_PUBLIC_API_URL ?? "/api/v1"}/me/practice-status?${params}`, { cache: "no-store" });
        if (!r.ok) throw Error(); const data = await r.json();
        if (!disposed && generation === current) setItems(data.items ?? []);
      } catch { if (!disposed && generation === current) setError(true); }
      finally { if (!disposed && generation === current) setLoading(false); }
    }
    void load(); window.addEventListener("routepilot-auth-change", load); window.addEventListener("routepilot-practice-change", load);
    return () => { disposed = true; generation++; window.removeEventListener("routepilot-auth-change", load); window.removeEventListener("routepilot-practice-change", load); };
  }, [centreSlug, routeId, revision]);
  return { items, loading, error, refresh };
}
