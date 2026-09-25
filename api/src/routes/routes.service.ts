import { ForbiddenException, Injectable } from "@nestjs/common";
import { RouteStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  private async hasPremiumAccess(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT s."id"
       FROM "Subscription" s
       JOIN "Plan" p ON p."id" = s."planId"
       WHERE s."userId" = $1
         AND s."status" = 'ACTIVE'
         AND p."name" <> 'Free'
         AND (s."expiresAt" IS NULL OR s."expiresAt" > NOW())
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
    return this.prisma.route.findFirst({
      where: { slug, status: RouteStatus.PUBLISHED, centre: { isPublished: true } },
      include: {
        centre: {
          include: { _count: { select: { routes: true } } },
        },
        points: { orderBy: { sequence: "asc" }, take: 3 },
      },
    }).then((route) => route ? { ...route, points: route.points.map((point) => ({ ...point, imageUrl: null, videoUrl: null })), access: { premium: false, preview: true } } : null);
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
    return route ? { ...route, access: { premium: true, preview: false } } : null;
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
