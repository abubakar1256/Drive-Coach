import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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
