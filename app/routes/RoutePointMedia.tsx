"use client";
import type { RoutePoint } from "../../lib/data";
import DrivingIllustration from "./DrivingIllustration";

export function safeMediaUrl(value?: string | null) {
  if (!value) return null;
  if (/^\/api\/v1\/media\/[a-zA-Z0-9-]+$/.test(value)) return value;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export default function RoutePointMedia({ point }: { point: RoutePoint }) {
  const image = safeMediaUrl(point.imageUrl), video = safeMediaUrl(point.videoUrl);
  if (!image && !video) return <DrivingIllustration />;
  return <section className="route-point-media" aria-label={point.title}>{image && <img src={image} alt={point.title} loading="lazy" style={{ width: "100%", borderRadius: 16 }} />}{video && <video src={video} controls preload="metadata" playsInline style={{ width: "100%", borderRadius: 16 }} />}</section>;
}
