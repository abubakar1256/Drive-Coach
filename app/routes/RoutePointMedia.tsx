"use client";
import { useEffect, useState } from "react";
import type { RoutePoint } from "../../lib/data";
import DrivingIllustration from "./DrivingIllustration";
import { authFetch } from "../../lib/clientSession";

export function safeMediaUrl(value?: string | null) {
  if (!value) return null;
  if (/^\/api\/v1\/media\/[a-zA-Z0-9-]+$/.test(value)) return value;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function useProtectedMedia(value?: string | null) {
  const url = safeMediaUrl(value);
  const local = Boolean(url?.startsWith("/api/v1/media/"));
  const [loaded, setLoaded] = useState<{ source: string; blob: string } | null>(null);
  useEffect(() => {
    setLoaded(null);
    if (!url || !local) return;
    let disposed = false;
    let blob: string | undefined;
    const controller = new AbortController();
    void authFetch(url, { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error("Media access unavailable");
      const bytes = await response.blob();
      if (disposed) return;
      blob = URL.createObjectURL(bytes);
      setLoaded({ source: url, blob });
    }).catch(() => undefined);
    return () => { disposed = true; controller.abort(); if (blob) URL.revokeObjectURL(blob); };
  }, [url, local]);
  return local ? (loaded?.source === url ? loaded.blob : null) : url;
}
export default function RoutePointMedia({ point }: { point: RoutePoint }) {
  const image = useProtectedMedia(point.imageUrl), video = useProtectedMedia(point.videoUrl);
  if (!image && !video) return <DrivingIllustration />;
  return <section className="route-point-media" aria-label={point.title}>{image && <img src={image} alt={point.title} loading="lazy" style={{ width: "100%", borderRadius: 16 }} />}{video && <video src={video} controls preload="metadata" playsInline style={{ width: "100%", borderRadius: 16 }} />}</section>;
}
