import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { publishedRoutePolicy, publishedRouteOrder } from "./published-route-policy";

@Injectable()
export class RouteAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async centreAccess(userId: string, centreId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) throw new ForbiddenException("Account required");
    if (["ADMIN", "SUPER_ADMIN"].includes(user.role)) return { premium: true, plan: "Admin" };
    const now = new Date();
    const subscriptions = await this.prisma.subscription.findMany({ where: { userId, status: "ACTIVE", AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] }, include: { plan: true } });
    if (subscriptions.some(s => s.plan.name === "Diamond")) return { premium: true, plan: "Diamond" };
    if (subscriptions.some(s => s.plan.name === "Premium" && s.centreId === centreId)) return { premium: true, plan: "Premium" };
    return { premium: false, plan: "Free" };
  }

  async requireAccess(userId: string, routeId: string) {
    const route = await this.prisma.route.findFirst({ where: { id: routeId, ...publishedRoutePolicy, centre: { isPublished: true } } });
    if (!route) throw new NotFoundException("Reviewed published route not found");
    const entitlement = await this.centreAccess(userId, route.centreId);
    if (entitlement.premium) return { route, premium: true };
    const free = await this.prisma.route.findFirst({ where: { centreId: route.centreId, ...publishedRoutePolicy }, orderBy: publishedRouteOrder, select: { id: true } });
    if (free?.id === route.id) return { route, premium: false };
    throw new ForbiddenException("Choose Premium for this centre or Diamond for all centres");
  }
}
