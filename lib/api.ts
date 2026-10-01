import { centres, type Centre } from "./data";

export type ApiRoute = {
  id: string;
  slug: string;
  name: string;
  durationMin: number | null;
  centre: {
    slug: string;
    name: string;
    city: string;
    area: string | null;
    region: string;
    description: string | null;
    latitude: number | null;
    longitude: number | null;
    _count: { routes: number };
  };
  points: Array<{
    id: string;
    sequence: number;
    category: string;
    title: string;
    description: string | null;
    warning: string | null;
    latitude: number;
    longitude: number;
    imageUrl?: string | null;
    videoUrl?: string | null;
  }>;
  access?: { premium: boolean; preview: boolean };
};

export type ApiCentre = {
  slug: string;
  name: string;
  city: string;
  area: string | null;
  region: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  isPublished: boolean;
  routes: Array<{
    slug: string;
    name: string;
    durationMin: number | null;
    status: string;
    points: ApiRoute["points"];
  }>;
};

export type ApiCentreSummary = {
  slug: string;
  name: string;
  city: string;
  area: string | null;
  region: string;
  description: string | null;
  isPublished: boolean;
  _count: { routes: number };
};

// Server Components must call the deployed API directly. In production on Railway,
// API_SERVER_URL points to the API service; in the browser, client components use
// the same-origin /api/v1 rewrite configured in next.config.mjs.
const apiBaseUrl = process.env.API_SERVER_URL ?? process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export async function getRouteBySlug(slug: string): Promise<ApiRoute | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/routes/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as ApiRoute;
  } catch {
    return null;
  }
}

export async function getFullRouteBySlug(slug: string, accessToken: string): Promise<ApiRoute | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "/api/v1"}/routes/${encodeURIComponent(slug)}/access`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as ApiRoute;
  } catch {
    return null;
  }
}

export async function getCentreBySlug(slug: string): Promise<ApiCentre | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/exam-centres/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as ApiCentre;
  } catch {
    return null;
  }
}

export async function getCentres(): Promise<Centre[]> {
  try {
    const response = await fetch(`${apiBaseUrl}/exam-centres`, { cache: "no-store" });
    if (!response.ok) return centres;
    const data = (await response.json()) as ApiCentreSummary[];
    return data.map((item) => {
      const fallback = centres.find((centre) => centre.slug === item.slug);
      return {
        ...(fallback ?? centres[0]),
        slug: item.slug,
        name: item.name,
        city: item.city,
        area: item.area ?? fallback?.area ?? item.city,
        region: item.region,
        routes: item._count?.routes ?? 0,
        description: item.description ?? fallback?.description ?? `${item.name} practice routes and attention points.`,
        highlights: fallback?.highlights ?? ["Official test-centre area", "Route attention points", "Practical driving guidance"],
        routePoints: fallback?.routePoints ?? [],
        routeCoordinates: fallback?.routeCoordinates ?? [],
      };
    });
  } catch {
    return centres;
  }
}

function pointTone(category: string): "mint" | "coral" | "blue" {
  if (["roundabout", "warning", "speed-zone"].includes(category)) return "coral";
  if (["lane-change", "traffic-light", "difficult-turn"].includes(category)) return "blue";
  return "mint";
}

export function routeToCentre(route: ApiRoute, fallback: Centre): Centre {
  return {
    ...fallback,
    slug: route.centre.slug,
    name: route.centre.name,
    city: route.centre.city,
    area: route.centre.area ?? fallback.area,
    region: route.centre.region,
    routes: route.centre._count.routes,
    description: route.centre.description ?? fallback.description,
    routeCoordinates: route.points.map((point) => [point.longitude, point.latitude]),
    routePoints: route.points.map((point) => ({
      id: point.id,
      number: String(point.sequence).padStart(2, "0"),
      title: point.title,
      detail: point.warning ? `${point.description ?? ""} ${point.warning}`.trim() : point.description ?? "",
      tone: pointTone(point.category),
      latitude: point.latitude,
      longitude: point.longitude,
      category: point.category,
    })),
  };
}

export function apiCentreToCentre(centre: ApiCentre, fallback: Centre = centres[0]): Centre {
  const firstRoute = centre.routes[0];
  return {
    ...fallback,
    slug: centre.slug,
    name: centre.name,
    city: centre.city,
    area: centre.area ?? fallback.area,
    region: centre.region,
    routes: centre.routes.length,
    description: centre.description ?? `${centre.name} practice routes and attention points.`,
    routeCoordinates: firstRoute?.points.map((point) => [point.longitude, point.latitude]) ?? (centre.longitude && centre.latitude ? [[centre.longitude, centre.latitude]] : fallback.routeCoordinates),
    routePoints: firstRoute?.points.map((point) => ({ id: undefined, number: String(point.sequence).padStart(2, "0"), title: point.title, detail: point.warning ? `${point.description ?? ""} ${point.warning}`.trim() : point.description ?? "", tone: pointTone(point.category), latitude: point.latitude, longitude: point.longitude, category: point.category })) ?? fallback.routePoints,
  };
}
