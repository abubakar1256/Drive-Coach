import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { CreateRouteDto, CreateRoutePointDto, ReorderPointsDto, UpdateRouteDto, UpdateRoutePointDto } from "./dto/admin-route.dto";
import { CreateCentreDto } from "./dto/admin-centre.dto";
import { UpdateUserRoleDto } from "./dto/admin-user.dto";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  listCentres() {
    return this.prisma.examCentre.findMany({
      include: { _count: { select: { routes: true } } },
      orderBy: { name: "asc" },
    });
  }

  createCentre(dto: CreateCentreDto) {
    return this.prisma.examCentre.create({ data: dto, include: { _count: { select: { routes: true } } } });
  }

  listRoutes() {
    return this.prisma.route.findMany({
      include: {
        centre: { select: { id: true, slug: true, name: true, latitude: true, longitude: true } },
        points: { orderBy: { sequence: "asc" } },
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    });
  }

  async overview() {
    const [users, centres, routes, publishedRoutes, subscriptions, sessions, reflections, eventTotals, revenue, failedPayments, popularCentres, popularRoutes] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ count: number }>>('SELECT COUNT(*)::int AS "count" FROM "User"'),
      this.prisma.$queryRawUnsafe<Array<{ count: number }>>('SELECT COUNT(*)::int AS "count" FROM "ExamCentre" WHERE "isPublished" = true'),
      this.prisma.$queryRawUnsafe<Array<{ count: number }>>('SELECT COUNT(*)::int AS "count" FROM "Route"'),
      this.prisma.$queryRawUnsafe<Array<{ count: number }>>('SELECT COUNT(*)::int AS "count" FROM "Route" WHERE "status" = \'PUBLISHED\''),
      this.prisma.$queryRawUnsafe<Array<{ status: string; count: number }>>('SELECT "status", COUNT(*)::int AS "count" FROM "Subscription" GROUP BY "status" ORDER BY "status"'),
      this.prisma.$queryRawUnsafe<Array<{ count: number; average: number | null }>>('SELECT COUNT(*)::int AS "count", ROUND(AVG("completionPct"))::int AS "average" FROM "PracticeSession"'),
      this.prisma.$queryRawUnsafe<Array<{ count: number }>>('SELECT COUNT(*)::int AS "count" FROM "SelfReflection"'),
      this.prisma.$queryRawUnsafe<Array<{ pageViews: number; centreViews: number; routeViews: number }>>('SELECT COUNT(*) FILTER (WHERE "eventType" = \'PAGE_VIEW\')::int AS "pageViews", COUNT(*) FILTER (WHERE "eventType" = \'CENTRE_VIEW\')::int AS "centreViews", COUNT(*) FILTER (WHERE "eventType" = \'ROUTE_VIEW\')::int AS "routeViews" FROM "AnalyticsEvent"'),
      this.prisma.$queryRawUnsafe<Array<{ currency: string; totalCents: number }>>('SELECT "currency", COALESCE(SUM("amountCents"),0)::int AS "totalCents" FROM "Payment" WHERE "status" = \'SUCCEEDED\' GROUP BY "currency" ORDER BY "currency"'),
      this.prisma.$queryRawUnsafe<Array<{ count: number }>>('SELECT COUNT(*)::int AS "count" FROM "Payment" WHERE "status" = \'FAILED\''),
      this.prisma.$queryRawUnsafe<Array<{ slug: string; views: number }>>('SELECT "centreSlug" AS "slug", COUNT(*)::int AS "views" FROM "AnalyticsEvent" WHERE "eventType" = \'CENTRE_VIEW\' AND "centreSlug" IS NOT NULL GROUP BY "centreSlug" ORDER BY "views" DESC LIMIT 5'),
      this.prisma.$queryRawUnsafe<Array<{ slug: string; views: number }>>('SELECT "routeSlug" AS "slug", COUNT(*)::int AS "views" FROM "AnalyticsEvent" WHERE "eventType" = \'ROUTE_VIEW\' AND "routeSlug" IS NOT NULL GROUP BY "routeSlug" ORDER BY "views" DESC LIMIT 5'),
    ]);
    return { users: users[0]?.count ?? 0, publishedCentres: centres[0]?.count ?? 0, routes: routes[0]?.count ?? 0, publishedRoutes: publishedRoutes[0]?.count ?? 0, subscriptions, practice: { sessions: sessions[0]?.count ?? 0, averageCompletion: sessions[0]?.average ?? 0, reflections: reflections[0]?.count ?? 0 }, analytics: { pageViews: eventTotals[0]?.pageViews ?? 0, centreViews: eventTotals[0]?.centreViews ?? 0, routeViews: eventTotals[0]?.routeViews ?? 0, revenue, failedPayments: failedPayments[0]?.count ?? 0, popularCentres, popularRoutes } };
  }

  auditLogs() {
    return this.prisma.$queryRawUnsafe('SELECT a."id", a."action", a."entity", a."entityId", a."metadata", a."createdAt", u."email" FROM "AuditLog" a LEFT JOIN "User" u ON u."id" = a."userId" ORDER BY a."createdAt" DESC LIMIT 100');
  }

  payments() {
    return this.prisma.$queryRawUnsafe('SELECT p."id", p."amountCents", p."currency", p."status", p."provider", p."providerPaymentId", p."createdAt", u."email", pl."name" AS "planName" FROM "Payment" p JOIN "User" u ON u."id" = p."userId" JOIN "Plan" pl ON pl."id" = p."planId" ORDER BY p."createdAt" DESC LIMIT 200');
  }

  users() {
    return this.prisma.$queryRawUnsafe('SELECT u."id", u."email", u."displayName", u."role", u."emailVerifiedAt", u."createdAt", COUNT(DISTINCT f."id")::int AS "favoriteCount", COUNT(DISTINCT ps."id")::int AS "practiceSessionCount" FROM "User" u LEFT JOIN "Favorite" f ON f."userId" = u."id" LEFT JOIN "PracticeSession" ps ON ps."userId" = u."id" GROUP BY u."id" ORDER BY u."createdAt" DESC LIMIT 500');
  }

  async updateUserRole(actorId: string, actorRole: UserRole, userId: string, dto: UpdateUserRoleDto) {
    if (actorRole === UserRole.CONTENT_MANAGER) throw new ForbiddenException("Only administrators can change user roles");
    if (actorRole !== UserRole.SUPER_ADMIN && dto.role === UserRole.SUPER_ADMIN) throw new ForbiddenException("Only a super administrator can grant super administrator access");
    if (actorId === userId) throw new ForbiddenException("You cannot change your own role");
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
    if (!user) throw new NotFoundException("User not found");
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { role: dto.role }, select: { id: true, email: true, displayName: true, role: true } });
    await this.prisma.$executeRawUnsafe('INSERT INTO "AuditLog" ("id", "userId", "action", "entity", "entityId", "metadata") VALUES ($1,$2,$3,$4,$5,$6::jsonb)', randomUUID(), actorId, "USER_ROLE_UPDATED", "User", userId, JSON.stringify({ from: user.role, to: dto.role, email: user.email }));
    return updated;
  }

  commissions() {
    return this.prisma.$queryRawUnsafe('SELECT cm."id", cm."amountCents", cm."commissionCents", cm."status", cm."createdAt", rc."code", owner."email" AS "ownerEmail", referred."email" AS "referredEmail" FROM "Commission" cm JOIN "ReferralCode" rc ON rc."id" = cm."referralCodeId" JOIN "User" owner ON owner."id" = rc."ownerUserId" JOIN "User" referred ON referred."id" = cm."referredUserId" ORDER BY cm."createdAt" DESC LIMIT 500');
  }

  async createRoute(dto: CreateRouteDto) {
    const centre = await this.prisma.examCentre.findUnique({ where: { id: dto.centreId }, select: { id: true } });
    if (!centre) throw new NotFoundException("Exam centre not found");
    return this.prisma.route.create({ data: dto, include: { points: true } });
  }

  async updateRoute(id: string, dto: UpdateRouteDto) {
    await this.ensureRoute(id);
    return this.prisma.route.update({ where: { id }, data: dto, include: { points: { orderBy: { sequence: "asc" } } } });
  }

  async archiveRoute(id: string) {
    await this.ensureRoute(id);
    return this.prisma.route.update({ where: { id }, data: { status: "ARCHIVED" } });
  }

  async createPoint(routeId: string, dto: CreateRoutePointDto) {
    await this.ensureRoute(routeId);
    return this.prisma.routePoint.create({ data: { ...dto, routeId } });
  }

  async updatePoint(id: string, dto: UpdateRoutePointDto) {
    const point = await this.prisma.routePoint.findUnique({ where: { id }, select: { id: true } });
    if (!point) throw new NotFoundException("Route point not found");
    return this.prisma.routePoint.update({ where: { id }, data: dto });
  }

  async deletePoint(id: string) {
    const point = await this.prisma.routePoint.findUnique({ where: { id }, select: { id: true } });
    if (!point) throw new NotFoundException("Route point not found");
    await this.prisma.routePoint.delete({ where: { id } });
    return { success: true };
  }

  async reorderPoints(routeId: string, dto: ReorderPointsDto) {
    await this.ensureRoute(routeId);
    const points = await this.prisma.routePoint.findMany({ where: { routeId }, select: { id: true } });
    const existingIds = new Set(points.map((point) => point.id));
    if (dto.pointIds.length !== points.length || dto.pointIds.some((id) => !existingIds.has(id))) {
      throw new NotFoundException("Point list does not match this route");
    }

    return this.prisma.$transaction(async (transaction) => {
      for (const [index, id] of dto.pointIds.entries()) {
        await transaction.routePoint.update({ where: { id }, data: { sequence: 100000 + index } });
      }
      for (const [index, id] of dto.pointIds.entries()) {
        await transaction.routePoint.update({ where: { id }, data: { sequence: index + 1 } });
      }
      return transaction.routePoint.findMany({ where: { routeId }, orderBy: { sequence: "asc" } });
    });
  }

  private async ensureRoute(id: string) {
    const route = await this.prisma.route.findUnique({ where: { id }, select: { id: true } });
    if (!route) throw new NotFoundException("Route not found");
    return route;
  }
}
