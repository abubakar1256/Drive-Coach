import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { RecordAnalyticsEventDto } from "./dto/analytics.dto";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  record(dto: RecordAnalyticsEventDto) {
    return this.prisma.$executeRawUnsafe(
      'INSERT INTO "AnalyticsEvent" ("id", "eventType", "centreSlug", "routeSlug", "metadata") VALUES ($1,$2,$3,$4,$5::jsonb)',
      randomUUID(), dto.eventType, dto.centreSlug?.trim().toLowerCase() ?? null, dto.routeSlug?.trim().toLowerCase() ?? null, JSON.stringify(dto.metadata ?? {}),
    ).then(() => ({ success: true }));
  }
}
