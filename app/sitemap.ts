import type { MetadataRoute } from "next";
import { centres } from "../lib/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const staticPages = ["", "/centres", "/about", "/contact", "/blog", "/legal/privacy", "/legal/terms"];
  const centrePages = [...centres.map((centre) => `/centres/${centre.slug}`), "/centres/alken"];
  const routePages = [...centres.map((centre) => `/routes/${centre.slug}-route-04`), "/routes/alken-route-1"];
  return [...staticPages, ...centrePages, ...routePages].map((path) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: path === "" ? 1 : path.startsWith("/centres/") || path.startsWith("/routes/") ? 0.8 : 0.6 }));
}
