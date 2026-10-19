import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { PreparationVersionDto, UpdatePreparationDto } from "./dto/preparation.dto";
import { preparationFocus, type PreparationLevel } from "./preparation-policy";
import { Prisma } from "@prisma/client";

@Injectable()
export class PreparationService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const [user, profile, reflection, hometown, checklistSession] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, displayName: true } }),
      this.prisma.preparationProfile.findUnique({ where: { userId }, include: { centre: { select: { id: true, slug: true, name: true } } } }),
      this.prisma.selfReflection.findFirst({ where: { userId }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: { updatedAt: true, difficultyCategories: true, instructorCategories: true, instructorFeedback: true, flaggedSpeeding: true, missedRightOfWay: true, speedCompliance: true, rightOfWayConfidence: true, roundaboutConfidence: true, laneChangeConfidence: true } }),
      this.prisma.hometownSession?.findFirst({ where: { userId, reflection: { not: Prisma.DbNull } }, orderBy: [{ reflectedAt: "desc" }, { id: "desc" }], select: { reflection: true } }),
      this.prisma.practiceSession?.findFirst?.({ where: { userId, completedAt: { not:null }, routeSnapshot: { path:["coachingReview"], not:Prisma.DbNull } }, orderBy:[{updatedAt:"desc"},{id:"desc"}], select:{routeSnapshot:true} }),
    ]);
    if (!user) throw new NotFoundException("Account not found");
    const level = (profile?.preferredLevel ?? "BEGINNER") as PreparationLevel;
    const privateReflection = hometown?.reflection as Record<string,any> | null;
    let latest = privateReflection?.savedAt && (!reflection?.updatedAt || Date.parse(privateReflection.savedAt)>reflection.updatedAt.getTime()) ? privateReflection : reflection;
    const checklist=(checklistSession?.routeSnapshot as any)?.coachingReview;
    const latestAt=latest===privateReflection?Date.parse(privateReflection?.savedAt??""):reflection?.updatedAt?.getTime()??0;
    if(checklist&&["self","instructor_reported"].includes(checklist.source)&&Date.parse(checklist.savedAt)>latestAt){
      const map:Record<string,string>={mirrors:"observation",blind_spots:"observation",signals:"signs",lane_position:"lanes",junctions:"junctions",roundabouts:"roundabouts",priority:"priority",speed_choice:"speed",following_distance:"space",vulnerable_users:"vulnerable",parking:"parking",vehicle_control:"control"};
      const needs=[...new Set(Object.entries(checklist.ratings??{}).filter(([key,value])=>map[key]&&value==="practice").map(([key])=>map[key]))];
      latest={difficultyCategories:checklist.source==="self"?needs:[],instructorFeedback:checklist.source==="instructor_reported",instructorCategories:checklist.source==="instructor_reported"?needs:[]};
    }
    return { ownerId: userId, version: profile?.version ?? 0, revision: profile?.revision ?? null, saved: Boolean(profile), preferredName: profile?.preferredName ?? user.displayName ?? "", age: profile?.age ?? null, centreId: profile?.centreId ?? null, centre: profile?.centre ?? null, homeTown: profile?.homeTown ?? "", preferredLevel: level, focus: preparationFocus(level, latest, Boolean(profile)), privacy: "Private optional preparation preferences. Town/area only; no home address, GPS lookup or age-based ability inference. Saving does not change your plan, trial or purchased centre." };
  }

  async save(userId: string, dto: UpdatePreparationDto) {
    const input = plainToInstance(UpdatePreparationDto, dto);
    if (validateSync(input, { whitelist: true, forbidNonWhitelisted: true }).length) throw new BadRequestException("Check your preparation profile fields");
    if (input.ownerId !== userId) throw new ConflictException("Your account changed. Reload before saving.");
    await this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id"=$1 FOR UPDATE', userId);
      if (!await tx.user.findUnique({ where: { id: userId }, select: { id: true } })) throw new NotFoundException("Account not found");
      const current = await tx.preparationProfile.findUnique({ where: { userId } });
      if ((current?.version ?? 0) !== input.version || (current?.revision ?? null) !== (input.revision ?? null)) throw new ConflictException("Your profile changed. Reload before saving.");
      if (input.centreId && !await tx.examCentre.findFirst({ where: { id: input.centreId, isPublished: true }, select: { id: true } })) throw new BadRequestException("Choose a published exam centre");
      const data = { ...(input.preferredName !== undefined ? { preferredName: input.preferredName } : {}), ...(input.age !== undefined ? { age: input.age } : {}), ...(input.centreId !== undefined ? { centreId: input.centreId } : {}), ...(input.homeTown !== undefined ? { homeTown: input.homeTown } : {}), ...(input.preferredLevel !== undefined ? { preferredLevel: input.preferredLevel } : {}) };
      const revision = randomUUID();
      await tx.preparationProfile.upsert({ where: { userId }, create: { userId, ...data, revision }, update: { ...data, revision, version: { increment: 1 } } });
      await tx.auditLog.create({ data: { userId, action: "PRIVATE_PREPARATION_PROFILE_SAVED", entity: "PreparationProfile", entityId: userId, metadata: { fields: Object.keys(data) } } });
    });
    return this.get(userId);
  }

  async clear(userId: string, dto: PreparationVersionDto) {
    const input = plainToInstance(PreparationVersionDto, dto);
    if (validateSync(input, { whitelist: true, forbidNonWhitelisted: true }).length || input.ownerId !== userId) throw new ConflictException("Reload your current account before clearing preferences.");
    await this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id"=$1 FOR UPDATE', userId);
      const profile = await tx.preparationProfile.findUnique({ where: { userId } });
      if ((profile?.version ?? 0) !== input.version || (profile?.revision ?? null) !== (input.revision ?? null)) throw new ConflictException("Your profile changed. Reload before clearing.");
      if (!profile) return;
      await tx.preparationProfile.deleteMany({ where: { userId } });
      await tx.auditLog.create({ data: { userId, action: "PRIVATE_PREPARATION_PROFILE_CLEARED", entity: "PreparationProfile", entityId: userId } });
    });
    return { cleared: true, accessUnchanged: true };
  }
}
