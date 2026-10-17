import { Injectable } from "@nestjs/common";
import type { ExamCentre, Route, RoutePoint } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { officialCentres } from "./official-centres";
import { RouteAccessService } from "../routes/route-access.service";
import { publishedRoutePolicy, publishedRouteOrder } from "../routes/published-route-policy";
import { premiumCentreInfo } from "./premium-centre-info";

const fallbackCentres = officialCentres.map((centre) => ({ ...centre, routes: 0 }));

type CatalogCentre = Pick<ExamCentre, "name" | "city" | "region"> & { routes: Array<Route & { points: RoutePoint[]; _count?: { points: number } }> };

export function centreRouteCatalog<T extends CatalogCentre>(centre: T, entitlement: { premium: boolean; plan: string; expiresAt?: Date | null; trial?: { available: boolean; active: boolean; routeId: string | null; expiresAt: Date | null } } = { premium: false, plan: "Free" }, signedIn = false) {
  return { ...centre,
    access: { ...entitlement, signedIn },
    premiumInfo: entitlement.premium ? premiumCentreInfo(centre) : null,
    routes: centre.routes.map((route, index) => ({
      ...route, label: `Route ${String.fromCharCode(65 + index)}`,
      isFree: Boolean(entitlement.trial?.active && entitlement.trial.routeId === route.id), canAccess: entitlement.premium || Boolean(entitlement.trial?.active && entitlement.trial.routeId === route.id),
      canStartTrial: signedIn && Boolean(entitlement.trial?.available),
      pointCount: route._count?.points ?? route.points.length,
      points: entitlement.premium || (entitlement.trial?.active && entitlement.trial.routeId === route.id) ? route.points.map((point) => ({ ...point, imageUrl: null, videoUrl: null })) : [],
    })),
  };
}

@Injectable()
export class ExamCentresService {
  constructor(private readonly prisma: PrismaService, private readonly routeAccess: RouteAccessService) {}

  async onModuleInit() {
    try {
      await Promise.all(officialCentres.map((centre) => this.prisma.examCentre.upsert({
        where: { slug: centre.slug }, update: { ...centre, isPublished: true }, create: { ...centre, isPublished: true },
      })));
    } catch {
      // A static directory remains available during a database outage.
    }
  }

  async list() {
    try {
      return await this.prisma.examCentre.findMany({ where: { isPublished: true }, include: { _count: { select: { routes: { where: publishedRoutePolicy } } } }, orderBy: { name: "asc" } });
    } catch { return fallbackCentres; }
  }

  async getBySlug(slug: string, userId?: string) {
    // Do not disguise authentication/access failures as free access.
    let centre;
    try {
      centre = await this.prisma.examCentre.findFirst({
        where: { slug, isPublished: true },
        include: { routes: { orderBy: publishedRouteOrder, where: publishedRoutePolicy, include: { _count: { select: { points: true } }, points: { orderBy: { sequence: "asc" }, take: 3 } } } },
      });
    } catch {
      if (userId) throw new Error("Centre access is temporarily unavailable");
      const fallback = fallbackCentres.find(c => c.slug === slug);
      return fallback ? { ...fallback, routes: [], access: { premium: false, plan: "Free", signedIn: false }, premiumInfo: null } : null;
    }
    if (!centre) return null;
    const entitlement = userId ? await this.routeAccess.centreAccess(userId, centre.id) : { premium: false, plan: "Free" };
    return centreRouteCatalog(centre, entitlement, Boolean(userId));
  }
}
