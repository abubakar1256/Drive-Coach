import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { CreateRouteDto, CreateRoutePointDto, ReorderPointsDto, UpdateOfficialPassagePointDto, UpdateRouteDto, UpdateRoutePointDto } from "./dto/admin-route.dto";
import { CreateCentreDto } from "./dto/admin-centre.dto";
import { UpdateUserRoleDto } from "./dto/admin-user.dto";
import { ReviewTipDto } from "./dto/admin-drive-coach.dto";
import { DrivingRouteService } from "../routes/driving-route.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PracticeLoopService } from "../routes/practice-loop.service";
import roadBundle from "../../prisma/data/road-practice-loops.json";
import catalogBundle from "../../prisma/data/road-practice-catalog.json";

type CatalogRoute = { centreSlug: string; slot: number; points: Array<{ latitude: number; longitude: number; bearing?: number | null }> };

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService, private readonly driving: DrivingRouteService, private readonly notifications: NotificationsService, private readonly loops: PracticeLoopService) {}

  listCentres() {
    return this.prisma.examCentre.findMany({
      include: { _count: { select: { routes: true } } },
      orderBy: { name: "asc" },
    });
  }

  async announce(actorId: string, role: UserRole, title: string, body: string) {
    if (!["ADMIN", "SUPER_ADMIN"].includes(role)) throw new ForbiddenException("Administrator permission required");
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (let i = 0; i < users.length; i += 500) await this.prisma.notification.createMany({ data: users.slice(i, i + 500).map(user => ({ userId: user.id, type: "ANNOUNCEMENT", title, body })) });
    await this.prisma.auditLog.create({ data: { userId: actorId, action: "ANNOUNCEMENT_SENT", entity: "Notification", metadata: { recipients: users.length, title } } });
    return { recipients: users.length };
  }

  createCentre(dto: CreateCentreDto) {
    return this.prisma.examCentre.create({ data: dto, include: { _count: { select: { routes: true } } } });
  }

  listOfficialPassagePoints(centreId: string) {
    return this.prisma.officialPassagePoint.findMany({
      where: { centreId },
      orderBy: { sequence: "asc" },
    });
  }

  async updateOfficialPassagePoint(id: string, dto: UpdateOfficialPassagePointDto) {
    const current = await this.prisma.officialPassagePoint.findUnique({ where: { id }, select: { id: true, latitude: true, longitude: true, verificationStatus: true, verifiedAt: true } });
    if (!current) throw new NotFoundException("Official passage point not found");
    const nextStatus = dto.verificationStatus ?? current.verificationStatus;
    const isVerified = nextStatus === "VERIFIED";
    if (isVerified && ((dto.latitude ?? current.latitude) === null || (dto.longitude ?? current.longitude) === null)) {
      throw new BadRequestException("Latitude and longitude are required before verification");
    }
    return this.prisma.officialPassagePoint.update({
      where: { id },
      data: { ...dto, verificationStatus: nextStatus, verifiedAt: isVerified ? (current.verifiedAt ?? new Date()) : null },
    });
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

  driveCoachTips() {
    return this.prisma.verifiedTip.findMany({ include: { skill: { select: { code: true, name: true } }, _count: { select: { weaknesses: true } } }, orderBy: [{ adminApproved: "asc" }, { priority: "desc" }, { code: "asc" }] });
  }

  async reviewDriveCoachTip(actorId: string, id: string, dto: ReviewTipDto) {
    const current = await this.prisma.verifiedTip.findUnique({ where: { id }, select: { id: true, code: true, verified: true, adminApproved: true } });
    if (!current) throw new NotFoundException("Drive Coach tip not found");
    const verified = dto.verified ?? current.verified;
    const adminApproved = dto.adminApproved ?? current.adminApproved;
    const updated = await this.prisma.verifiedTip.update({ where: { id }, data: { verified, adminApproved, sourceReference: dto.sourceReference ?? undefined, verifiedAt: verified && adminApproved ? new Date() : null, verifiedBy: verified && adminApproved ? actorId : null } });
    await this.prisma.$executeRawUnsafe('INSERT INTO "AuditLog" ("id", "userId", "action", "entity", "entityId", "metadata") VALUES ($1,$2,$3,$4,$5,$6::jsonb)', randomUUID(), actorId, "DRIVE_COACH_TIP_REVIEWED", "VerifiedTip", id, JSON.stringify({ code: current.code, verified, adminApproved }));
    return updated;
  }

  async createRoute(dto: CreateRouteDto) {
    if (dto.status === "PUBLISHED") throw new BadRequestException("Create a draft, add road waypoints, then publish after driving validation.");
    const centre = await this.prisma.examCentre.findUnique({ where: { id: dto.centreId }, select: { id: true } });
    if (!centre) throw new NotFoundException("Exam centre not found");
    return this.prisma.route.create({ data: dto, include: { points: true } });
  }

  preparedRoadCatalog() {
    const routes = catalogBundle.routes as CatalogRoute[];
    return Array.from(new Set(routes.map(r => r.centreSlug))).map(centreSlug => ({ centreSlug, slots: routes.filter(r => r.centreSlug === centreSlug).map(r => r.slot) }));
  }

  async importStarterRoute(actorId: string, centreId: string, slot = 1) {
    const centre = await this.prisma.examCentre.findUnique({ where: { id: centreId } });
    if (!centre || !centre.isPublished) throw new NotFoundException("Published centre not found");
    // Legacy Ghent East is a second directory entry for the nearby Ghent area.
    const sourceSlug = centre.slug === "ghent-east" ? "sint-denijs-westrem" : centre.slug;
    if (!Number.isInteger(slot) || slot < 1 || slot > 7) throw new BadRequestException("Route slot must be 1–7");
    const item = slot === 1 ? roadBundle.routes.find(r => r.centreSlug === sourceSlug) : (catalogBundle.routes as CatalogRoute[]).find(r => r.centreSlug === sourceSlug && r.slot === slot);
    if (!item) throw new NotFoundException("No checked starter route for this centre");
    const slug = `${centre.slug}-road-practice-loop-${String(slot).padStart(2, "0")}`;
    const existing = await this.prisma.route.findUnique({ where: { slug } });
    if (existing) return { ...existing, preserved: true };
    const checked = await this.driving.requireValid(item.points);
    if (checked.durationSec! > 3600) throw new BadRequestException("Starter loop exceeds 60 minutes");
    const route = await this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe("SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext($1))", slug);
      const found = await tx.route.findUnique({ where: { slug } });
      if (found) return found;
      const created = await tx.route.create({ data: {
        centreId, slug, name: `Road-network practice loop ${slot}`, status: "PUBLISHED",
        verificationStatus: "ROAD_VALIDATED", reviewedBy: "ROAD_ROUTING_ENGINE", verifiedAt: new Date(),
        durationMin: Math.ceil(checked.durationSec! / 60),
        sourceLabel: sourceSlug !== centre.slug ? "Shared Ghent-area road practice — not an official exam route or instructor approval" : "Road-network practice — not an official exam route or instructor approval",
        sourceUrl: "https://docs.mapbox.com/api/navigation/directions/",
        points: { create: item.points.map((p, i) => ({
          sequence: i + 1, latitude: p.latitude, longitude: p.longitude, bearing: "bearing" in p ? p.bearing : null,
          category: i === 0 ? "start" : i === item.points.length - 1 ? "finish" : "waypoint",
          title: i === 0 ? "Mapped practice meeting point" : i === item.points.length - 1 ? "Return to meeting point" : `Road waypoint ${i + 1}`,
          description: "Mapped road-network practice. Follow current signs and instructor guidance. Meeting point is not a confirmed exam-centre entrance.",
        })) },
      } });
      await tx.auditLog.create({ data: { userId: actorId, action: slot === 1 ? "STARTER_ROUTE_IMPORTED" : "ROAD_CATALOG_IMPORTED", entity: "Route", entityId: created.id, metadata: { sourceCentre: sourceSlug, slot, durationSec: checked.durationSec, instructorApproved: false } } });
      return created;
    });
    await this.notifications.routePublished(route.id, route.version);
    return route;
  }

  async generatePracticeLoop(actorId: string, centreId: string, variant = 0, publish = false) {
    const centre = await this.prisma.examCentre.findUnique({ where: { id: centreId } });
    if (!centre || centre.latitude === null || centre.longitude === null) throw new BadRequestException("Centre map anchor is unavailable");
    const generated = await this.loops.generate(centre.latitude, centre.longitude, variant);
    const created = await this.prisma.$transaction(async tx => {
      const route = await tx.route.create({ data: {
        centreId, slug: `${centre.slug}-practice-loop-${randomUUID().slice(0, 8)}`, name: `Road practice loop ${variant + 1}`,
        status: publish ? "PUBLISHED" : "DRAFT", durationMin: Math.ceil(generated.durationSec! / 60),
        verificationStatus: "ROAD_VALIDATED", reviewedBy: "ROAD_ROUTING_ENGINE", verifiedAt: new Date(),
        sourceLabel: "Drive Coach road-network practice loop — not an official examiner route",
        sourceUrl: "https://docs.mapbox.com/api/navigation/directions/",
        points: { create: generated.snappedPoints.map((point, index) => ({ sequence: index + 1, bearing: point.bearing, category: index === 0 ? "start" : index === generated.snappedPoints.length - 1 ? "finish" : "waypoint", title: index === 0 ? "Mapped practice meeting point" : index === generated.snappedPoints.length - 1 ? "Return to practice meeting point" : point.name || `Road waypoint ${index + 1}`, description: "Road-network practice point. Follow current signs and instructor guidance. The meeting point is not a confirmed exam-centre entrance.", latitude: point.latitude, longitude: point.longitude })) },
      }, include: { points: { orderBy: { sequence: "asc" } }, centre: true } });
      await tx.auditLog.create({ data: { userId: actorId, action: "PRACTICE_LOOP_GENERATED", entity: "Route", entityId: route.id, metadata: { variant, published: publish, durationSec: generated.durationSec, provider: "MAPBOX", instructorApproved: false } } });
      return route;
    });
    if (publish) await this.notifications.routePublished(created.id, created.version);
    return created;
  }

  async updateRoute(id: string, dto: UpdateRouteDto, actorId?: string) {
    const current = await this.prisma.route.findUnique({ where: { id }, include: { points: { orderBy: { sequence: "asc" } } } });
    if (!current) throw new NotFoundException("Route not found");
    const reviewed = dto.verificationStatus === "VERIFIED" || (dto.verificationStatus === undefined && ["VERIFIED", "ROAD_VALIDATED"].includes(current.verificationStatus));
    const sourceLabel = dto.sourceLabel ?? current.sourceLabel;
    if (reviewed && !sourceLabel?.trim()) throw new BadRequestException("Add the instructor/source reference before content review");
    if (dto.status === "PUBLISHED") {
      if (!reviewed || (!actorId && !current.reviewedBy)) throw new BadRequestException("Confirm instructor/content review before publishing");
      const points = await this.prisma.routePoint.findMany({ where: { routeId: id }, orderBy: { sequence: "asc" } });
      const result = await this.driving.requireValid(points);
      dto.durationMin = Math.ceil(result.durationSec! / 60);
    }
    const updated = await this.prisma.$transaction(async tx => {
      const changed = await tx.route.updateMany({ where: { id, version: current.version }, data: { ...dto, verifiedAt: reviewed ? new Date() : null, reviewedBy: reviewed ? actorId ?? current.reviewedBy : null, version: { increment: 1 } } });
      if (!changed.count) throw new BadRequestException("Route changed during review; refresh and validate again");
      return tx.route.findUniqueOrThrow({ where: { id }, include: { points: { orderBy: { sequence: "asc" } } } });
    });
    if (dto.status === "PUBLISHED") await this.notifications.routePublished(id, updated.version);
    return updated;
  }

  async archiveRoute(id: string) {
    await this.ensureRoute(id);
    return this.prisma.route.update({ where: { id }, data: { status: "ARCHIVED" } });
  }

  async checkDrivingRoute(id: string) {
    await this.ensureRoute(id);
    const points = await this.prisma.routePoint.findMany({ where: { routeId: id }, orderBy: { sequence: "asc" } });
    return this.driving.evaluate(points);
  }

  async importPoints(actorId: string, id: string, points: CreateRoutePointDto[]) {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT "id" FROM "Route" WHERE "id" = $1 FOR UPDATE', id);
      const route = await tx.route.findUnique({ where: { id }, include: { points: true } });
      if (!route) throw new NotFoundException("Route not found");
      await tx.auditLog.create({ data: { userId: actorId, action: "ROUTE_POINTS_IMPORTED", entity: "Route", entityId: id, metadata: { previousPoints: route.points, incomingPointCount: points.length } } });
      await tx.routePoint.deleteMany({ where: { routeId: id } });
      await tx.routePoint.createMany({ data: points.map((point, index) => ({ ...point, routeId: id, sequence: index + 1 })) });
      return tx.route.update({ where: { id }, data: { status: "DRAFT", verificationStatus: "PENDING_REVIEW", reviewedBy: null, verifiedAt: null, version: { increment: 1 } }, include: { points: { orderBy: { sequence: "asc" } } } });
    });
  }

  async createPoint(routeId: string, dto: CreateRoutePointDto) {
    await this.ensureRoute(routeId);
    return this.prisma.$transaction(async tx => {
      await tx.route.update({ where: { id: routeId }, data: { status: "DRAFT", verificationStatus: "PENDING_REVIEW", reviewedBy: null, verifiedAt: null, version: { increment: 1 } } });
      return tx.routePoint.create({ data: { ...dto, routeId } });
    });
  }

  async updatePoint(id: string, dto: UpdateRoutePointDto) {
    const point = await this.prisma.routePoint.findUnique({ where: { id }, select: { id: true, routeId: true } });
    if (!point) throw new NotFoundException("Route point not found");
    return this.prisma.$transaction(async tx => {
      await tx.route.update({ where: { id: point.routeId }, data: { status: "DRAFT", verificationStatus: "PENDING_REVIEW", reviewedBy: null, verifiedAt: null, version: { increment: 1 } } });
      return tx.routePoint.update({ where: { id }, data: { ...dto, ...((dto.latitude !== undefined || dto.longitude !== undefined) ? { bearing: null } : {}) } });
    });
  }

  async deletePoint(id: string) {
    const point = await this.prisma.routePoint.findUnique({ where: { id }, select: { id: true, routeId: true } });
    if (!point) throw new NotFoundException("Route point not found");
    await this.prisma.$transaction(async tx => {
      await tx.route.update({ where: { id: point.routeId }, data: { status: "DRAFT", verificationStatus: "PENDING_REVIEW", reviewedBy: null, verifiedAt: null, version: { increment: 1 } } });
      await tx.routePoint.delete({ where: { id } });
    });
    return { success: true };
  }

  async reorderPoints(routeId: string, dto: ReorderPointsDto) {
    await this.ensureRoute(routeId);
    const points = await this.prisma.routePoint.findMany({ where: { routeId }, select: { id: true } });
    const existingIds = new Set(points.map((point) => point.id));
    if (new Set(dto.pointIds).size !== points.length || dto.pointIds.length !== points.length || dto.pointIds.some((id) => !existingIds.has(id))) {
      throw new NotFoundException("Point list does not match this route");
    }

    return this.prisma.$transaction(async (transaction) => {
      await transaction.route.update({ where: { id: routeId }, data: { status: "DRAFT", verificationStatus: "PENDING_REVIEW", reviewedBy: null, verifiedAt: null, version: { increment: 1 } } });
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
