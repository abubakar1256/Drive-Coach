import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class RouteAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireAccess(userId: string, routeId: string) {
    const route = await this.prisma.route.findFirst({ where: { id: routeId, status: "PUBLISHED", verificationStatus: { in: ["VERIFIED", "ROAD_VALIDATED"] }, reviewedBy: { not: null }, centre: { isPublished: true } } });
    if (!route) throw new NotFoundException("Reviewed published route not found");
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) throw new ForbiddenException("Account required");
    if (["ADMIN", "SUPER_ADMIN"].includes(user.role)) return { route, premium: true };
    const now = new Date();
    const subscriptions = await this.prisma.subscription.findMany({ where: { userId, status: "ACTIVE", AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] }, include: { plan: true } });
    if (subscriptions.some(s => s.plan.name === "Diamond" || (s.plan.name === "Premium" && s.centreId === route.centreId))) return { route, premium: true };
    const free = await this.prisma.route.findFirst({ where: { centreId: route.centreId, status: "PUBLISHED", verificationStatus: { in: ["VERIFIED", "ROAD_VALIDATED"] }, reviewedBy: { not: null } }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true } });
    if (free?.id === route.id) return { route, premium: false };
    throw new ForbiddenException("Choose Premium for this centre or Diamond for all centres");
  }
}
