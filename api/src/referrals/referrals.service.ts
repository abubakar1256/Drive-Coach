import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { ClaimReferralDto, CreateReferralCodeDto } from "./dto/referral.dto";

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  private periodKey() {
    const now = new Date();
    return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  async currentSchoolCode(userId: string, schoolId: string) {
    const school = await this.prisma.$queryRawUnsafe<Array<{ id: string; slug: string }>>('SELECT "id", "slug" FROM "DrivingSchool" WHERE "id" = $1 AND "createdByUserId" = $2', schoolId, userId);
    if (!school[0]) throw new NotFoundException("School not found");
    const existing = await this.prisma.$queryRawUnsafe<Array<{ id: string; code: string; commissionBps: number; active: boolean; createdAt: Date }>>('SELECT "id", "code", "commissionBps", "active", "createdAt" FROM "ReferralCode" WHERE "schoolId" = $1 AND "active" = true AND "createdAt" >= date_trunc(\'month\', NOW()) ORDER BY "createdAt" DESC LIMIT 1', schoolId);
    if (existing[0]) return { ...existing[0], period: this.periodKey(), rotated: false };
    const base = school[0].slug.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 16) || "SCHOOL";
    const code = `${base}-${this.periodKey()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; code: string; commissionBps: number; active: boolean; createdAt: Date }>>('INSERT INTO "ReferralCode" ("id", "code", "ownerUserId", "schoolId", "commissionBps") VALUES ($1,$2,$3,$4,$5) RETURNING "id", "code", "commissionBps", "active", "createdAt"', randomUUID(), code, userId, schoolId, 1000);
    return { ...rows[0], period: this.periodKey(), rotated: true };
  }

  async createCode(userId: string, dto: CreateReferralCodeDto) {
    if (dto.schoolId) {
      return this.currentSchoolCode(userId, dto.schoolId);
    }
    try { const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; code: string; commissionBps: number; active: boolean }>>('INSERT INTO "ReferralCode" ("id", "code", "ownerUserId", "schoolId", "commissionBps") VALUES ($1,$2,$3,$4,$5) RETURNING "id", "code", "commissionBps", "active"', randomUUID(), dto.code.trim().toUpperCase(), userId, dto.schoolId ?? null, dto.commissionBps ?? 1000); return rows[0]; } catch { throw new ConflictException("Referral code already exists"); }
  }

  async claim(userId: string, dto: ClaimReferralDto) {
    const codes = await this.prisma.$queryRawUnsafe<Array<{ id: string; ownerUserId: string }>>('SELECT "id", "ownerUserId" FROM "ReferralCode" WHERE UPPER("code") = UPPER($1) AND "active" = true', dto.code.trim());
    if (!codes[0]) throw new NotFoundException("Referral code not found");
    if (codes[0].ownerUserId === userId) throw new ConflictException("You cannot claim your own referral code");
    try { await this.prisma.$executeRawUnsafe('INSERT INTO "ReferralAttribution" ("id", "codeId", "referredUserId") VALUES ($1,$2,$3)', randomUUID(), codes[0].id, userId); } catch { throw new ConflictException("This account already has a referral attribution"); }
    return { success: true, codeId: codes[0].id };
  }

  me(userId: string) {
    return this.prisma.$queryRawUnsafe('SELECT c."id", c."code", c."schoolId", c."commissionBps", c."active", c."createdAt", COUNT(DISTINCT a."id")::int AS "referralCount", COALESCE(SUM(cm."commissionCents"),0)::int AS "commissionCents" FROM "ReferralCode" c LEFT JOIN "ReferralAttribution" a ON a."codeId" = c."id" LEFT JOIN "Commission" cm ON cm."referralCodeId" = c."id" WHERE c."ownerUserId" = $1 GROUP BY c."id" ORDER BY c."createdAt" DESC', userId);
  }
}
