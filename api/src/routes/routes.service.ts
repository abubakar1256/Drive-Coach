import { ForbiddenException, Injectable } from "@nestjs/common";
import { RouteStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { DrivingRouteService } from "./driving-route.service";

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService, private readonly driving: DrivingRouteService) {}

  private async hasPremiumAccess(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT u."id"
       FROM "User" u
       LEFT JOIN "Subscription" s ON s."userId" = u."id"
       LEFT JOIN "Plan" p ON p."id" = s."planId"
       WHERE u."id" = $1
         AND (
           u."role" IN ('ADMIN', 'SUPER_ADMIN')
           OR (s."status" = 'ACTIVE' AND p."name" <> 'Free' AND (s."expiresAt" IS NULL OR s."expiresAt" > NOW()))
         )
       ORDER BY s."createdAt" DESC
       LIMIT 1`,
      userId,
    );
    return Boolean(rows[0]);
  }

  async list(centreSlug?: string) {
    return this.prisma.route.findMany({
      where: {
        status: RouteStatus.PUBLISHED,
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
      where: { slug, status: RouteStatus.PUBLISHED, centre: { isPublished: true } },
      include: {
        centre: {
          include: { _count: { select: { routes: true } } },
        },
        points: { orderBy: { sequence: "asc" } },
      },
    });
    if (!route) return null;
    // Check the entire route, but do not leak paid waypoints/geometry through
    // the public preview. Free practice still gets the same quality gate.
    const driving = await this.driving.evaluate(route.points);
    return { ...route, durationMin: driving.durationSec === null ? null : Math.ceil(driving.durationSec / 60), driving: { ...driving, coordinates: [] }, points: route.points.slice(0, 3).map((point) => ({ ...point, imageUrl: null, videoUrl: null })), access: { premium: false, preview: true } };
  }

  async points(slug: string) {
    const route = await this.prisma.route.findFirst({
      where: { slug, status: RouteStatus.PUBLISHED, centre: { isPublished: true } },
      select: { id: true },
    });
    if (!route) return null;
    return this.prisma.routePoint.findMany({ where: { routeId: route.id }, orderBy: { sequence: "asc" }, take: 3 }).then((points) => points.map((point) => ({ ...point, imageUrl: null, videoUrl: null })));
  }

  async getAccessibleBySlug(userId: string, slug: string) {
    if (!(await this.hasPremiumAccess(userId))) throw new ForbiddenException("Premium access is required for the full route");
    const route = await this.prisma.route.findFirst({
      where: { slug, status: RouteStatus.PUBLISHED, centre: { isPublished: true } },
      include: {
        centre: { include: { _count: { select: { routes: true } } } },
        points: { orderBy: { sequence: "asc" } },
      },
    });
    if (!route) return null;
    const driving = await this.driving.evaluate(route.points);
    return { ...route, durationMin: driving.durationSec === null ? null : Math.ceil(driving.durationSec / 60), driving, access: { premium: true, preview: false } };
  }

  async accessiblePoints(userId: string, slug: string) {
    if (!(await this.hasPremiumAccess(userId))) throw new ForbiddenException("Premium access is required for the full route");
    const route = await this.prisma.route.findFirst({
      where: { slug, status: RouteStatus.PUBLISHED, centre: { isPublished: true } },
      select: { id: true },
    });
    if (!route) return null;
    return this.prisma.routePoint.findMany({ where: { routeId: route.id }, orderBy: { sequence: "asc" } });
  }
}
