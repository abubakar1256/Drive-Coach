import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { publishedRoutePolicy } from "./published-route-policy";
import { planTier, validSubscription } from "../billing/access-policy";
import { OfficialRouteFoundationService } from "./official-route-foundation.service";

@Injectable()
export class RouteAccessService {
  constructor(private readonly prisma: PrismaService, private readonly foundation: OfficialRouteFoundationService) {}

  async centreAccess(userId: string, centreId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) throw new ForbiddenException("Account required");
    if (["ADMIN", "SUPER_ADMIN"].includes(user.role)) return { premium: true, plan: "Premium", expiresAt: null };
    const now = new Date();
    const subscriptions = await this.prisma.subscription.findMany({ where: { userId, status: "ACTIVE", AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] }, include: { plan: true } });
    const active = subscriptions.filter(s => validSubscription(s, now));
    const eligible = active.filter(s => planTier(s.plan) === "Premium" || (planTier(s.plan) === "Basic" && s.centreId === centreId));
    // Use the longest applicable grant. Expiring one purchase must not revoke another.
    const grant = eligible.find(s => !s.expiresAt) ?? eligible.sort((a, b) => b.expiresAt!.getTime() - a.expiresAt!.getTime())[0];
    if (grant) return { premium: true, plan: eligible.some(s => planTier(s.plan) === "Premium") ? "Premium" : "Basic", expiresAt: grant.expiresAt };
    const trial = await this.prisma.routeTrial.findUnique({ where: { userId } });
    return { premium: false, plan: "Free", trial: { available: !trial, active: Boolean(trial && trial.startedAt <= now && trial.expiresAt > now), routeId: trial?.routeId ?? null, expiresAt: trial?.expiresAt ?? null } };
  }

  async requireAccess(userId: string, routeId: string) {
    const route = await this.prisma.route.findFirst({ where: { id: routeId, ...publishedRoutePolicy, centre: { isPublished: true } } });
    if (!route) throw new NotFoundException("Reviewed published route not found");
    if (route.foundation) {
      const points = await this.prisma.routePoint.findMany({ where: { routeId }, orderBy: { sequence: "asc" } });
      try { await this.foundation.validateSnapshot(route, points); }
      catch { throw new ForbiddenException("Route foundation needs a fresh source/start review"); }
    }
    const entitlement = await this.centreAccess(userId, route.centreId);
    if (entitlement.premium) return { route, premium: true, expiresAt: entitlement.expiresAt };
    if (entitlement.trial?.active && entitlement.trial.routeId === route.id) return { route, premium: false, expiresAt: entitlement.trial.expiresAt };
    throw new ForbiddenException("Start your one-route 24-hour trial, or choose Basic for this centre / Premium for all centres");
  }
}
