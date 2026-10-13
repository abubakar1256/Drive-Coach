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
    const school = await this.prisma.drivingSchool.findFirst({ where: { id: schoolId, createdByUserId: userId } });
    if (!school) throw new NotFoundException("School not found");
    const now = new Date(), start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return this.prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `school-referral:${schoolId}`);
      await tx.referralCode.updateMany({ where: { schoolId, createdAt: { lt: start }, active: true }, data: { active: false } });
      const existing = await tx.referralCode.findFirst({ where: { schoolId, createdAt: { gte: start } }, orderBy: { createdAt: "desc" } });
      if (existing) return { ...existing, period: this.periodKey(), rotated: false };
      const base = school.slug.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 16) || "SCHOOL";
      const code = await tx.referralCode.create({ data: { code: `${base}-${this.periodKey()}-${randomBytes(3).toString("hex").toUpperCase()}`, ownerUserId: userId, schoolId, commissionBps: 1000 } });
      return { ...code, period: this.periodKey(), rotated: true };
    });
  }

  async recordPayout(actorId: string, commissionId: string, reference: string) {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT "id" FROM "Commission" WHERE "id" = $1 FOR UPDATE', commissionId);
      const commission = await tx.commission.findUnique({ where: { id: commissionId }, include: { payment: true } });
      if (!commission || commission.status !== "PENDING" || commission.payment?.status !== "SUCCEEDED") throw new ConflictException("Only pending commissions on successful payments may be paid");
      const updated = await tx.commission.update({ where: { id: commissionId }, data: { status: "PAID", paidAt: new Date(), payoutReference: reference.trim() } });
      await tx.auditLog.create({ data: { userId: actorId, action: "COMMISSION_PAYOUT_RECORDED", entity: "Commission", entityId: commissionId, metadata: { reference, amountCents: commission.commissionCents, actualTransferIsExternal: true } } });
      const code = await tx.referralCode.findUnique({ where: { id: commission.referralCodeId } });
      if (code) await tx.notification.createMany({ data: [{ userId: code.ownerUserId, type: "COMMISSION_PAID", title: "School commission payout recorded", body: `A payout of ${(commission.commissionCents / 100).toFixed(2)} EUR was recorded. Reference: ${reference}`, dedupeKey: `commission-paid:${commissionId}` }], skipDuplicates: true });
      return updated;
    });
  }

  async createCode(userId: string, dto: CreateReferralCodeDto) {
    if (dto.schoolId) {
      return this.currentSchoolCode(userId, dto.schoolId);
    }
    try { const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; code: string; commissionBps: number; active: boolean }>>('INSERT INTO "ReferralCode" ("id", "code", "ownerUserId", "schoolId", "commissionBps") VALUES ($1,$2,$3,$4,$5) RETURNING "id", "code", "commissionBps", "active"', randomUUID(), dto.code.trim().toUpperCase(), userId, dto.schoolId ?? null, 1000); return rows[0]; } catch { throw new ConflictException("Referral code already exists"); }
  }

  async claim(userId: string, dto: ClaimReferralDto) {
    const codes = await this.prisma.$queryRawUnsafe<Array<{ id: string; ownerUserId: string; schoolId: string | null; createdAt: Date }>>('SELECT "id", "ownerUserId", "schoolId", "createdAt" FROM "ReferralCode" WHERE UPPER("code") = UPPER($1) AND "active" = true', dto.code.trim());
    if (!codes[0]) throw new NotFoundException("Referral code not found");
    const now = new Date();
    if (codes[0].schoolId && (codes[0].createdAt.getUTCFullYear() !== now.getUTCFullYear() || codes[0].createdAt.getUTCMonth() !== now.getUTCMonth())) throw new ConflictException("This school code has expired; request the current month code");
    if (codes[0].ownerUserId === userId) throw new ConflictException("You cannot claim your own referral code");
    try { await this.prisma.$executeRawUnsafe('INSERT INTO "ReferralAttribution" ("id", "codeId", "referredUserId") VALUES ($1,$2,$3)', randomUUID(), codes[0].id, userId); } catch { throw new ConflictException("This account already has a referral attribution"); }
    return { success: true, codeId: codes[0].id };
  }

  async me(userId: string) {
    const codes = await this.prisma.referralCode.findMany({ where: { ownerUserId: userId }, include: { _count: { select: { attributions: true } }, commissions: { where: { status: { in: ["PENDING", "PAID"] } }, select: { commissionCents: true, status: true } } }, orderBy: { createdAt: "desc" } });
    return codes.map(code => ({ id: code.id, code: code.code, schoolId: code.schoolId, commissionBps: code.commissionBps, active: code.active, createdAt: code.createdAt, referralCount: code._count.attributions, commissionCents: code.commissions.reduce((sum, c) => sum + c.commissionCents, 0), paidCents: code.commissions.filter(c => c.status === "PAID").reduce((sum, c) => sum + c.commissionCents, 0) }));
  }

}
