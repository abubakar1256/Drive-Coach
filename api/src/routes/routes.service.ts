import { ForbiddenException, Injectable } from "@nestjs/common";
import { RouteStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { DrivingRouteService } from "./driving-route.service";
import { RouteAccessService } from "./route-access.service";
import { publishedRoutePolicy } from "./published-route-policy";

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService, private readonly driving: DrivingRouteService, private readonly routeAccess: RouteAccessService) {}

  async list(centreSlug?: string) {
    return this.prisma.route.findMany({
      where: {
        ...publishedRoutePolicy,
        centre: {
          isPublished: true,
          ...(centreSlug ? { slug: centreSlug } : {}),
        },
      },
      include: {
        centre: { select: { slug: true, name: true, city: true, area: true } },
        _count: { select: { points: true } },
      },
      orderBy: [{ centre: { name: "asc" } }, { name: "asc" }],
    });
  }

  async getBySlug(slug: string) {
    const route = await this.prisma.route.findFirst({
      where: { slug, ...publishedRoutePolicy, centre: { isPublished: true } },
      include: {
        centre: {
          include: { _count: { select: { routes: { where: { status: "PUBLISHED", verificationStatus: { in: ["VERIFIED", "ROAD_VALIDATED"] }, reviewedBy: { not: null } } } } } },
        },
        points: { orderBy: { sequence: "asc" } },
      },
    });
    if (!route) return null;
    // Check the entire route, but do not leak paid waypoints/geometry through
    // the public preview. Free practice still gets the same quality gate.
    const driving = await this.driving.evaluate(route.points);
    return { ...route, durationMin: driving.durationSec === null ? null : Math.ceil(driving.durationSec / 60), driving: { valid: driving.valid, issues: driving.issues, durationSec: driving.durationSec, distanceM: driving.distanceM, coordinates: [] }, points: [], access: { premium: false, preview: true, isFree: false, requiresAccess: true } };
  }

  async points(slug: string) {
    const route = await this.prisma.route.findFirst({
      where: { slug, ...publishedRoutePolicy, centre: { isPublished: true } },
      select: { id: true, centreId: true },
    });
    if (!route) return null;
    return [];
  }

  async getAccessibleBySlug(userId: string, slug: string) {
    const route = await this.prisma.route.findFirst({
      where: { slug, ...publishedRoutePolicy, centre: { isPublished: true } },
      include: {
        centre: { include: { _count: { select: { routes: { where: { status: "PUBLISHED", verificationStatus: { in: ["VERIFIED", "ROAD_VALIDATED"] }, reviewedBy: { not: null } } } } } } },
        points: { orderBy: { sequence: "asc" } },
      },
    });
    if (!route) return null;
    const access = await this.routeAccess.requireAccess(userId, route.id);
    const driving = await this.driving.evaluate(route.points);
    if (access.expiresAt && access.expiresAt <= new Date()) throw new ForbiddenException("Route access has expired");
    return { ...route, points: access.premium ? route.points : route.points.map(p => ({ ...p, imageUrl: null, videoUrl: null })), durationMin: driving.durationSec === null ? null : Math.ceil(driving.durationSec / 60), driving, access: { premium: access.premium, preview: false, expiresAt: access.expiresAt } };
  }

  async accessiblePoints(userId: string, slug: string) {
    const route = await this.prisma.route.findFirst({
      where: { slug, ...publishedRoutePolicy, centre: { isPublished: true } },
      select: { id: true },
    });
    if (!route) return null;
    const access = await this.routeAccess.requireAccess(userId, route.id);
    const points = await this.prisma.routePoint.findMany({ where: { routeId: route.id }, orderBy: { sequence: "asc" } });
    return access.premium ? points : points.map(p => ({ ...p, imageUrl: null, videoUrl: null }));
  }
}
