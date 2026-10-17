import { Injectable, NotFoundException, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { ReminderPreferencesDto } from "./notification.dto";

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  onModuleInit() {
    if (process.env.NOTIFICATION_SCHEDULER_ENABLED === "false" || process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => { void this.runDue().catch(() => Logger.warn("Notification scheduler unavailable; will retry", "Notifications")); }, 60000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  constructor(private readonly prisma: PrismaService) {}

  preferences(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, select: { examDate: true, practiceReminderAt: true, remindersEnabled: true } });
  }
  savePreferences(userId: string, dto: ReminderPreferencesDto) {
    return this.prisma.user.update({ where: { id: userId }, data: { remindersEnabled: dto.remindersEnabled, ...(dto.examDate !== undefined ? { examDate: dto.examDate ? new Date(dto.examDate) : null } : {}), ...(dto.practiceReminderAt !== undefined ? { practiceReminderAt: dto.practiceReminderAt ? new Date(dto.practiceReminderAt) : null } : {}) }, select: { examDate: true, practiceReminderAt: true, remindersEnabled: true } });
  }
  async runDue(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const expired = await this.prisma.subscription.findMany({ where: { status: "ACTIVE", expiresAt: { lte: now } } });
      for (const subscription of expired) await this.prisma.$transaction(async tx => {
        const changed = await tx.subscription.updateMany({ where: { id: subscription.id, status: "ACTIVE", expiresAt: { lte: now } }, data: { status: "EXPIRED" } });
        if (changed.count) await tx.notification.createMany({ data: [{ userId: subscription.userId, type: "SUBSCRIPTION_EXPIRED", title: "Preparation access expired", body: "Your paid access period has ended. You can renew from your account.", dedupeKey: `expired:${subscription.id}` }], skipDuplicates: true });
      });
      const users = await this.prisma.user.findMany({ where: { remindersEnabled: true, OR: [{ examDate: { gte: now, lte: new Date(now.getTime() + 8 * 86400000) } }, { practiceReminderAt: { lte: now } }] }, select: { id: true, examDate: true, practiceReminderAt: true } });
      for (const user of users) {
        const data: Array<{ userId: string; type: string; title: string; body: string; dedupeKey: string }> = [];
        if (user.examDate) {
          const days = Math.ceil((user.examDate.getTime() - now.getTime()) / 86400000);
          if ([1, 7].includes(days)) data.push({ userId: user.id, type: "EXAM_REMINDER", title: "Your driving exam is approaching", body: `Your exam is in ${days} day${days === 1 ? "" : "s"}. Review your route and prepare with your instructor.`, dedupeKey: `exam:${user.id}:${user.examDate.toISOString()}:${days}` });
        }
        if (user.practiceReminderAt && user.practiceReminderAt <= now) data.push({ userId: user.id, type: "PRACTICE_REMINDER", title: "Practice reminder", body: "Your planned practice time has arrived. Choose a reviewed route when you are ready.", dedupeKey: `practice:${user.id}:${user.practiceReminderAt.toISOString()}` });
        if (data.length) await this.prisma.notification.createMany({ data, skipDuplicates: true });
      }
      const assignments = await this.prisma.routeAssignment.findMany({ where: { completedAt: null, dueAt: { lte: new Date(now.getTime() + 86400000) }, enrollment: { status: "ACTIVE", student: { remindersEnabled: true } } }, include: { route: { select: { name: true } }, enrollment: { select: { studentId: true } } } });
      for (const assignment of assignments) await this.prisma.notification.createMany({ data: [{ userId: assignment.enrollment.studentId, type: "ASSIGNMENT_REMINDER", title: "Assigned practice route is due", body: `${assignment.route.name} is due ${assignment.dueAt!.toISOString().slice(0, 10)}. Open your school workspace.`, dedupeKey: `assignment:${assignment.id}:${assignment.dueAt!.toISOString()}` }], skipDuplicates: true });
    } finally { this.running = false; }
  }
  async routePublished(routeId: string, version: number) {
    const route = await this.prisma.route.findUnique({ where: { id: routeId }, include: { favorites: { select: { userId: true } } } });
    if (!route) return;
    const now = new Date();
    const subscribers = await this.prisma.subscription.findMany({ where: { status: "ACTIVE", OR: [{ plan: { tier: "Premium" } }, { plan: { tier: "Basic" }, centreId: route.centreId }, { plan: { tier: null, name: "Diamond" } }, { plan: { tier: null, name: { in: ["Premium", "Basic"] } }, centreId: route.centreId }], AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] }, select: { userId: true } });
    const ids = [...new Set([...route.favorites, ...subscribers].map(u => u.userId))];
    for (let i = 0; i < ids.length; i += 500) await this.prisma.notification.createMany({ data: ids.slice(i, i + 500).map(userId => ({ userId, type: "ROUTE_UPDATE", title: "Route content updated", body: `${route.name} has a newly reviewed version. Check the route before your next practice.`, metadata: { routeSlug: route.slug }, dedupeKey: `route:${routeId}:${version}:${userId}` })), skipDuplicates: true });
  }

  list(userId: string) {
    return this.prisma.$queryRawUnsafe('SELECT "id", "type", "title", "body", "metadata", "readAt", "createdAt" FROM "Notification" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 50', userId);
  }

  async unreadCount(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ count: number }>>('SELECT COUNT(*)::int AS "count" FROM "Notification" WHERE "userId" = $1 AND "readAt" IS NULL', userId);
    return { count: rows[0]?.count ?? 0 };
  }

  async markRead(userId: string, id: string) {
    const result = await this.prisma.$executeRawUnsafe('UPDATE "Notification" SET "readAt" = COALESCE("readAt", NOW()) WHERE "id" = $1 AND "userId" = $2', id, userId);
    if (!result) throw new NotFoundException("Notification not found");
    return { success: true, id };
  }

  createWelcome(userId: string) {
    return this.prisma.$executeRawUnsafe('INSERT INTO "Notification" ("id", "userId", "type", "title", "body") VALUES ($1,$2,$3,$4,$5)', randomUUID(), userId, "WELCOME", "Welcome to RoutePilot", "Save your first approved route and start a calm practice session when you are ready.");
  }
}
