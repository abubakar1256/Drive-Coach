import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { CreatePracticeSessionDto, CreateReflectionDto, UpdatePracticeSessionDto } from "./dto/learning.dto";
import { CreateTrackPointDto } from "./dto/track.dto";

type Row = Record<string, any>;

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  private query<T extends Row = Row>(sql: string, ...values: unknown[]) {
    return this.prisma.$queryRawUnsafe<T[]>(sql, ...values);
  }

  async dashboard(userId: string) {
    const [userRows, favoriteRows, sessionRows, subscriptionRows] = await Promise.all([
      this.query('SELECT "id", "email", "displayName", "role", "createdAt" FROM "User" WHERE "id" = $1', userId),
      this.query('SELECT f."id", f."createdAt", r."id" AS "routeId", r."slug", r."name", r."durationMin", c."slug" AS "centreSlug", c."name" AS "centreName", c."city", COUNT(rp."id")::int AS "pointCount" FROM "Favorite" f JOIN "Route" r ON r."id" = f."routeId" JOIN "ExamCentre" c ON c."id" = r."centreId" LEFT JOIN "RoutePoint" rp ON rp."routeId" = r."id" WHERE f."userId" = $1 GROUP BY f."id", r."id", c."id" ORDER BY f."createdAt" DESC LIMIT 6', userId),
      this.query('SELECT ps."id", ps."routeId", ps."startedAt", ps."completedAt", ps."durationSec", ps."completionPct", ps."notes", r."slug", r."name", c."name" AS "centreName", sr."speedCompliance", sr."rightOfWayConfidence", sr."roundaboutConfidence", sr."laneChangeConfidence", sr."observedSpeedKph", sr."speedLimitKph", sr."flaggedSpeeding", sr."missedRightOfWay", sr."overallFeeling", sr."difficultyCategories", sr."difficultyDetails", sr."instructorFeedback", sr."instructorCategories", sr."instructorNotes" FROM "PracticeSession" ps JOIN "Route" r ON r."id" = ps."routeId" JOIN "ExamCentre" c ON c."id" = r."centreId" LEFT JOIN "SelfReflection" sr ON sr."sessionId" = ps."id" WHERE ps."userId" = $1 ORDER BY ps."createdAt" DESC LIMIT 8', userId),
      this.query('SELECT s."status", s."expiresAt", p."name" AS "planName" FROM "Subscription" s JOIN "Plan" p ON p."id" = s."planId" WHERE s."userId" = $1 AND s."status" = \'ACTIVE\' AND (s."expiresAt" IS NULL OR s."expiresAt" > NOW()) ORDER BY s."createdAt" DESC LIMIT 1', userId),
    ]);
    if (!userRows[0]) throw new NotFoundException("User not found");
    const sessions = sessionRows.map((row) => this.sessionShape(row));
    const completed = sessions.filter((session) => session.completedAt).length;
    const averageProgress = sessions.length ? Math.round(sessions.reduce((sum, session) => sum + session.completionPct, 0) / sessions.length) : 0;
    const reflection = sessionRows.find((row) => row.speedCompliance !== null || row.rightOfWayConfidence !== null || row.roundaboutConfidence !== null || row.laneChangeConfidence !== null || row.observedSpeedKph !== null || row.speedLimitKph !== null || row.flaggedSpeeding || row.missedRightOfWay);
    const adminHasDiamond = userRows[0].role === "ADMIN" || userRows[0].role === "SUPER_ADMIN";
    return { user: userRows[0], subscription: adminHasDiamond ? { status: "ACTIVE", plan: "Diamond", expiresAt: null } : subscriptionRows[0] ? { status: subscriptionRows[0].status, plan: subscriptionRows[0].planName, expiresAt: subscriptionRows[0].expiresAt } : { status: "FREE", plan: "Free", expiresAt: null }, stats: { favoriteCount: favoriteRows.length, sessionCount: sessions.length, completedSessions: completed, averageProgress }, favorites: favoriteRows, sessions, recommendations: this.recommendations(reflection) };
  }

  async listFavorites(userId: string) {
    return this.query('SELECT f."id", f."createdAt", r."id" AS "routeId", r."slug", r."name", r."durationMin", c."slug" AS "centreSlug", c."name" AS "centreName", c."city", COUNT(rp."id")::int AS "pointCount" FROM "Favorite" f JOIN "Route" r ON r."id" = f."routeId" JOIN "ExamCentre" c ON c."id" = r."centreId" LEFT JOIN "RoutePoint" rp ON rp."routeId" = r."id" WHERE f."userId" = $1 GROUP BY f."id", r."id", c."id" ORDER BY f."createdAt" DESC', userId);
  }

  async addFavorite(userId: string, routeId: string) {
    const route = await this.query('SELECT r."id" FROM "Route" r JOIN "ExamCentre" c ON c."id" = r."centreId" WHERE r."id" = $1 AND r."status" = \'PUBLISHED\' AND c."isPublished" = true', routeId);
    if (!route[0]) throw new NotFoundException("Published route not found");
    await this.prisma.$executeRawUnsafe('INSERT INTO "Favorite" ("id", "userId", "routeId") VALUES ($1, $2, $3) ON CONFLICT ("userId", "routeId") DO NOTHING', randomUUID(), userId, routeId);
    await this.audit(userId, "FAVORITE_ADDED", "Route", routeId);
    return { success: true, routeId };
  }

  async removeFavorite(userId: string, routeId: string) {
    await this.prisma.$executeRawUnsafe('DELETE FROM "Favorite" WHERE "userId" = $1 AND "routeId" = $2', userId, routeId);
    await this.audit(userId, "FAVORITE_REMOVED", "Route", routeId);
    return { success: true };
  }

  async listSessions(userId: string) {
    const rows = await this.query('SELECT ps."id", ps."routeId", ps."startedAt", ps."completedAt", ps."durationSec", ps."completionPct", ps."notes", r."slug", r."name", c."name" AS "centreName", sr."speedCompliance", sr."rightOfWayConfidence", sr."roundaboutConfidence", sr."laneChangeConfidence", sr."observedSpeedKph", sr."speedLimitKph", sr."flaggedSpeeding", sr."missedRightOfWay" FROM "PracticeSession" ps JOIN "Route" r ON r."id" = ps."routeId" JOIN "ExamCentre" c ON c."id" = r."centreId" LEFT JOIN "SelfReflection" sr ON sr."sessionId" = ps."id" WHERE ps."userId" = $1 ORDER BY ps."createdAt" DESC', userId);
    return rows.map((row) => this.sessionShape(row));
  }

  async routeAssistant(userId: string, routeId: string) {
    const route = await this.query('SELECT r."id", r."slug", r."name", c."name" AS "centreName", rp."sequence", rp."title", rp."description", rp."warning", rp."category" FROM "Route" r JOIN "ExamCentre" c ON c."id" = r."centreId" JOIN "RoutePoint" rp ON rp."routeId" = r."id" WHERE r."id" = $1 AND r."status" = \'PUBLISHED\' AND c."isPublished" = true ORDER BY rp."sequence"', routeId);
    if (!route[0]) throw new NotFoundException("Published route not found");
    const reflections = await this.query('SELECT sr."speedCompliance", sr."rightOfWayConfidence", sr."roundaboutConfidence", sr."laneChangeConfidence", sr."observedSpeedKph", sr."speedLimitKph", sr."flaggedSpeeding", sr."missedRightOfWay", sr."difficultyCategories", sr."difficultyDetails", sr."instructorCategories" FROM "SelfReflection" sr JOIN "PracticeSession" ps ON ps."id" = sr."sessionId" WHERE sr."userId" = $1 ORDER BY sr."createdAt" DESC LIMIT 1', userId);
    const reflection = reflections[0];
    const focus = this.focus(reflection);
    return { mode: "grounded-route-coach", route: { id: route[0].id, slug: route[0].slug, name: route[0].name, centreName: route[0].centreName }, focus, checklist: route.map((point) => ({ sequence: point.sequence, title: point.title, instruction: point.warning || point.description || `Prepare for ${point.category}.` })), safety: "This coach only summarizes published RoutePilot points and your reflection. It does not alter the official route or replace an instructor." };
  }

  async driveCoach(userId: string, routeId?: string, mode = "COACH") {
    const coachingMode = this.coachingMode(mode);
    const weaknessRows = await this.query('SELECT uwh."occurrenceCount", uwh."lastSeenAt", w."code", w."label", ds."code" AS "skillCode", ds."name" AS "skillName" FROM "UserWeaknessHistory" uwh JOIN "Weakness" w ON w."id" = uwh."weaknessId" JOIN "DrivingSkill" ds ON ds."id" = w."skillId" WHERE uwh."userId" = $1 AND w."active" = true ORDER BY uwh."occurrenceCount" DESC, uwh."lastSeenAt" DESC LIMIT 8', userId);
    const focus = weaknessRows[0] ? { skill: weaknessRows[0].skillName, skillCode: weaknessRows[0].skillCode, message: `Based on your recent practice, focus on ${weaknessRows[0].label.toLowerCase()} before your next drive.` } : { skill: "Start with a reflection", skillCode: null, message: "Complete a practice reflection to build your personal Drive Coach plan." };
    const recommendationRows = await this.query('SELECT r."id", r."slug", r."name", r."durationMin", c."name" AS "centreName", COALESCE(SUM(CASE WHEN uwh."id" IS NOT NULL THEN rsc."coverageWeight" * (1 + LEAST(uwh."occurrenceCount", 5)) ELSE 0 END), 0)::int AS "score", COALESCE(ARRAY_AGG(DISTINCT ds."code") FILTER (WHERE uwh."id" IS NOT NULL), ARRAY[]::text[]) AS "matchedSkills" FROM "Route" r JOIN "ExamCentre" c ON c."id" = r."centreId" LEFT JOIN "RouteSkillCoverage" rsc ON rsc."routeId" = r."id" AND rsc."verified" = true LEFT JOIN "DrivingSkill" ds ON ds."id" = rsc."skillId" LEFT JOIN "UserWeaknessHistory" uwh ON uwh."userId" = $1 AND uwh."weaknessId" IN (SELECT w2."id" FROM "Weakness" w2 WHERE w2."skillId" = ds."id") WHERE r."status" = \'PUBLISHED\' AND c."isPublished" = true AND ($2::text IS NULL OR r."id" <> $2) GROUP BY r."id", c."id" ORDER BY "score" DESC, r."name" ASC LIMIT 3', userId, routeId ?? null);
    const recommendations = recommendationRows.map((row) => ({ id: row.id, slug: row.slug, name: row.name, durationMin: row.durationMin, centreName: row.centreName, score: row.score, matchedSkills: row.matchedSkills ?? [], reason: row.score > 0 ? `${row.name} covers your recent focus: ${(row.matchedSkills ?? []).join(", ")}.` : `${row.name} is an approved route available for continued practice.` }));
    const tipLimit = coachingMode === "LIGHT" ? 3 : coachingMode === "INTENSIVE" ? 8 : 5;
    const tips = await this.query(`SELECT DISTINCT ON (vt."id") vt."code", vt."voiceTextEn", vt."voiceTextNl", vt."skillId", ds."code" AS "skillCode", ds."name" AS "skillName", COALESCE(uwh."occurrenceCount", 0)::int AS "occurrenceCount" FROM "VerifiedTip" vt JOIN "DrivingSkill" ds ON ds."id" = vt."skillId" LEFT JOIN "WeaknessTip" wt ON wt."tipId" = vt."id" LEFT JOIN "Weakness" w ON w."id" = wt."weaknessId" LEFT JOIN "UserWeaknessHistory" uwh ON uwh."weaknessId" = w."id" AND uwh."userId" = $1 WHERE vt."verified" = true AND vt."adminApproved" = true ORDER BY vt."id", "occurrenceCount" DESC, vt."priority" DESC LIMIT ${tipLimit}`, userId);
    let route: Row | null = null;
    if (routeId) {
      const routeRows = await this.query('SELECT r."id", r."slug", r."name", c."name" AS "centreName" FROM "Route" r JOIN "ExamCentre" c ON c."id" = r."centreId" WHERE r."id" = $1 AND r."status" = \'PUBLISHED\' AND c."isPublished" = true', routeId);
      route = routeRows[0] ?? null;
    }
    const rideRows = await this.query<{ completedRides: number }>('SELECT COUNT(*)::int AS "completedRides" FROM "PracticeSession" WHERE "userId" = $1 AND "completedAt" IS NOT NULL', userId);
    const completedRides = rideRows[0]?.completedRides ?? 0;
    const practicePlan = { completedRides, ready: completedRides >= 5, message: completedRides >= 5 ? "Your recent rides are enough to keep a focused practice plan." : `${5 - completedRides} more completed ride${5 - completedRides === 1 ? "" : "s"} will make the plan more reliable.`, priorities: weaknessRows.slice(0, 3).map((weakness) => ({ code: weakness.code, label: weakness.label, occurrences: weakness.occurrenceCount, skill: weakness.skillName })) };
    for (const recommendation of recommendations) {
      await this.prisma.$executeRawUnsafe('INSERT INTO "RouteRecommendation" ("id", "userId", "routeId", "score", "reason", "focusSkillCode") VALUES ($1,$2,$3,$4,$5,$6)', randomUUID(), userId, recommendation.id, recommendation.score, recommendation.reason, focus.skillCode);
    }
    return { mode: coachingMode, focus, route, weaknesses: weaknessRows, tips, recommendations, practicePlan, safety: "Drive Coach only uses user reflections plus verified route and tip data. It does not change official routes, invent traffic rules or make pass/fail decisions." };
  }

  async triggerVoiceTip(userId: string, routePointId: string, distanceM: number, sessionId?: string, mode = "COACH") {
    const coachingMode = this.coachingMode(mode);
    if (!Number.isFinite(distanceM) || distanceM < 0 || distanceM > 1000) return { speak: false, reason: "Distance is outside the safe trigger range." };
    const rows = await this.query('SELECT vt."id", vt."code", vt."voiceTextEn", vt."voiceTextNl", vt."voiceTextFr", vt."priority", vt."cooldownSeconds", ds."code" AS "skillCode", ds."name" AS "skillName", COALESCE(MAX(uwh."occurrenceCount"), 0)::int AS "occurrenceCount" FROM "RoutePoint" rp JOIN "Route" r ON r."id" = rp."routeId" AND r."status" = \'PUBLISHED\' JOIN "ExamCentre" c ON c."id" = r."centreId" AND c."isPublished" = true JOIN "DrivingSkill" ds ON ds."code" = CASE LOWER(rp."category") WHEN \'roundabout\' THEN \'ROUNDABOUT\' WHEN \'lane-change\' THEN \'LANE_CHANGE\' WHEN \'speed-zone\' THEN \'SPEED\' WHEN \'traffic-light\' THEN \'SIGNS\' ELSE \'OBSERVATION\' END JOIN "VerifiedTip" vt ON vt."skillId" = ds."id" LEFT JOIN "WeaknessTip" wt ON wt."tipId" = vt."id" LEFT JOIN "UserWeaknessHistory" uwh ON uwh."weaknessId" = wt."weaknessId" AND uwh."userId" = $1 WHERE rp."id" = $2 AND vt."verified" = true AND vt."adminApproved" = true AND $3 <= COALESCE(vt."maxTriggerDistanceM", 180) AND $3 >= COALESCE(vt."minTriggerDistanceM", 0) AND NOT EXISTS (SELECT 1 FROM "TipDeliveryHistory" td WHERE td."userId" = $1 AND td."tipId" = vt."id" AND td."deliveredAt" > NOW() - make_interval(secs => vt."cooldownSeconds")) GROUP BY vt."id", vt."code", vt."voiceTextEn", vt."voiceTextNl", vt."voiceTextFr", vt."priority", vt."cooldownSeconds", ds."code", ds."name" ORDER BY "occurrenceCount" DESC, vt."priority" DESC LIMIT 1', userId, routePointId, distanceM);
    const tip = rows[0];
    if (!tip) return { speak: false, reason: coachingMode === "LIGHT" ? "No high-priority verified reminder is due." : "No verified reminder is due at this point." };
    await this.prisma.$executeRawUnsafe('INSERT INTO "TipDeliveryHistory" ("id", "userId", "tipId", "sessionId", "routePointId") VALUES ($1,$2,$3,$4,$5)', randomUUID(), userId, tip.id, sessionId ?? null, routePointId);
    return { speak: true, mode: coachingMode, tip: { code: tip.code, skillCode: tip.skillCode, skillName: tip.skillName, voiceTextEn: tip.voiceTextEn, voiceTextNl: tip.voiceTextNl, voiceTextFr: tip.voiceTextFr }, safety: "This is an admin-approved verified reminder tied to a published route point." };
  }

  async routeRecommendation(userId: string, routeId: string) {
    const selected = await this.query('SELECT r."id", r."centreId", r."name", c."name" AS "centreName" FROM "Route" r JOIN "ExamCentre" c ON c."id" = r."centreId" WHERE r."id" = $1 AND r."status" = \'PUBLISHED\' AND c."isPublished" = true', routeId);
    if (!selected[0]) throw new NotFoundException("Published route not found");
    const reflections = await this.query('SELECT sr."speedCompliance", sr."rightOfWayConfidence", sr."roundaboutConfidence", sr."laneChangeConfidence", sr."observedSpeedKph", sr."speedLimitKph", sr."flaggedSpeeding", sr."missedRightOfWay", sr."difficultyCategories", sr."difficultyDetails", sr."instructorCategories" FROM "SelfReflection" sr JOIN "PracticeSession" ps ON ps."id" = sr."sessionId" WHERE sr."userId" = $1 ORDER BY sr."createdAt" DESC LIMIT 1', userId);
    const reflection = reflections[0];
    const focus = this.focus(reflection);
    const candidates = await this.query('SELECT r."id", r."slug", r."name", r."durationMin", c."name" AS "centreName", rp."category", rp."warning", rp."description" FROM "Route" r JOIN "ExamCentre" c ON c."id" = r."centreId" LEFT JOIN "RoutePoint" rp ON rp."routeId" = r."id" WHERE r."centreId" = $1 AND r."id" <> $2 AND r."status" = \'PUBLISHED\' AND c."isPublished" = true ORDER BY r."name", rp."sequence"', selected[0].centreId, routeId);
    const grouped = new Map<string, any>();
    for (const row of candidates) { const entry = grouped.get(row.id) ?? { id: row.id, slug: row.slug, name: row.name, durationMin: row.durationMin, centreName: row.centreName, points: [] as any[] }; entry.points.push(row); grouped.set(row.id, entry); }
    const ranked = [...grouped.values()].map((candidate) => { const text = candidate.points.map((point: Row) => `${point.category} ${point.warning ?? ""} ${point.description ?? ""}`.toLowerCase()).join(" "); const score = focus.keywords.reduce((total, keyword) => total + (text.includes(keyword) ? 1 : 0), 0); return { candidate, score }; }).sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name));
    const recommendation = ranked[0]?.candidate;
    return { mode: "safe-adaptive-route-recommendation", focus: { skill: focus.skill, message: focus.message }, route: recommendation ? { id: recommendation.id, slug: recommendation.slug, name: recommendation.name, centreName: recommendation.centreName, durationMin: recommendation.durationMin, pointCount: recommendation.points.length } : null, reason: recommendation ? `Based on your latest reflection, ${recommendation.name} is the next approved route to practise ${focus.skill.toLowerCase()}.` : `No alternative approved route is published for ${selected[0].centreName} yet. Ask an admin to publish another official route.`, safety: "Recommendations only select from published official routes. The system never invents or changes an official driving-test route." };
  }

  async startSession(userId: string, dto: CreatePracticeSessionDto) {
    const route = await this.query('SELECT r."id", r."slug", r."name", c."name" AS "centreName" FROM "Route" r JOIN "ExamCentre" c ON c."id" = r."centreId" WHERE r."id" = $1 AND r."status" = \'PUBLISHED\' AND c."isPublished" = true', dto.routeId);
    if (!route[0]) throw new NotFoundException("Published route not found");
    const id = randomUUID();
    const rows = await this.query('INSERT INTO "PracticeSession" ("id", "userId", "routeId", "updatedAt") VALUES ($1, $2, $3, NOW()) RETURNING "id", "routeId", "startedAt", "completionPct"', id, userId, dto.routeId);
    await this.audit(userId, "PRACTICE_STARTED", "PracticeSession", id);
    return { ...rows[0], route: route[0] };
  }

  async updateSession(userId: string, id: string, dto: UpdatePracticeSessionDto) {
    const existing = await this.query('SELECT "id" FROM "PracticeSession" WHERE "id" = $1 AND "userId" = $2', id, userId);
    if (!existing[0]) throw new NotFoundException("Practice session not found");
    await this.prisma.$executeRawUnsafe('UPDATE "PracticeSession" SET "completionPct" = COALESCE($1, "completionPct"), "durationSec" = COALESCE($2, "durationSec"), "notes" = COALESCE($3, "notes"), "completedAt" = CASE WHEN $4 = true THEN NOW() ELSE "completedAt" END, "updatedAt" = NOW() WHERE "id" = $5 AND "userId" = $6', dto.completionPct ?? null, dto.durationSec ?? null, dto.notes ?? null, dto.complete ?? false, id, userId);
    await this.audit(userId, dto.complete ? "PRACTICE_COMPLETED" : "PRACTICE_UPDATED", "PracticeSession", id);
    return { success: true, id };
  }

  async saveReflection(userId: string, sessionId: string, dto: CreateReflectionDto) {
    const session = await this.query('SELECT "id" FROM "PracticeSession" WHERE "id" = $1 AND "userId" = $2', sessionId, userId);
    if (!session[0]) throw new NotFoundException("Practice session not found");
    const speedingObserved = dto.observedSpeedKph !== undefined && dto.speedLimitKph !== undefined && dto.observedSpeedKph > dto.speedLimitKph;
    await this.prisma.$executeRawUnsafe('INSERT INTO "SelfReflection" ("id", "sessionId", "userId", "speedCompliance", "rightOfWayConfidence", "roundaboutConfidence", "laneChangeConfidence", "observedSpeedKph", "speedLimitKph", "flaggedSpeeding", "missedRightOfWay", "overallFeeling", "difficultyCategories", "difficultyDetails", "instructorFeedback", "instructorCategories", "instructorNotes", "notes", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,NOW()) ON CONFLICT ("sessionId") DO UPDATE SET "speedCompliance"=$4,"rightOfWayConfidence"=$5,"roundaboutConfidence"=$6,"laneChangeConfidence"=$7,"observedSpeedKph"=$8,"speedLimitKph"=$9,"flaggedSpeeding"=$10,"missedRightOfWay"=$11,"overallFeeling"=$12,"difficultyCategories"=$13,"difficultyDetails"=$14::jsonb,"instructorFeedback"=$15,"instructorCategories"=$16,"instructorNotes"=$17,"notes"=$18,"updatedAt"=NOW()', randomUUID(), sessionId, userId, dto.speedCompliance ?? null, dto.rightOfWayConfidence ?? null, dto.roundaboutConfidence ?? null, dto.laneChangeConfidence ?? null, dto.observedSpeedKph ?? null, dto.speedLimitKph ?? null, dto.flaggedSpeeding || speedingObserved, dto.missedRightOfWay ?? false, dto.overallFeeling ?? null, dto.difficultyCategories ?? [], JSON.stringify(dto.difficultyDetails ?? {}), dto.instructorFeedback ?? null, dto.instructorCategories ?? [], dto.instructorNotes ?? null, dto.notes ?? null);
    await this.recordWeaknesses(userId, sessionId, dto, speedingObserved);
    await this.audit(userId, "REFLECTION_SAVED", "PracticeSession", sessionId);
    return { success: true, sessionId, recommendations: this.recommendations(dto), coach: await this.driveCoach(userId) };
  }

  async recordTrackPoint(userId: string, sessionId: string, dto: CreateTrackPointDto) {
    const session = await this.query('SELECT "id" FROM "PracticeSession" WHERE "id" = $1 AND "userId" = $2', sessionId, userId);
    if (!session[0]) throw new NotFoundException("Practice session not found");
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe('INSERT INTO "PracticeTrackPoint" ("id", "sessionId", "latitude", "longitude", "speedKph", "accuracyM", "recordedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)', id, sessionId, dto.latitude, dto.longitude, dto.speedKph ?? null, dto.accuracyM ?? null, dto.recordedAt ? new Date(dto.recordedAt) : new Date());
    return { success: true, id, sessionId };
  }

  private async recordWeaknesses(userId: string, sessionId: string, dto: CreateReflectionDto, speedingObserved: boolean) {
    const codes = new Set<string>();
    const categories = new Set([...(dto.difficultyCategories ?? []), ...(dto.instructorCategories ?? [])]);
    if (speedingObserved || dto.flaggedSpeeding || (dto.speedCompliance ?? 5) <= 2) codes.add("SPEED_TOO_FAST_ZONE");
    if (categories.has("speed")) codes.add("SPEED_TOO_FAST_ZONE");
    if (dto.missedRightOfWay || (dto.rightOfWayConfidence ?? 5) <= 2) codes.add("PRIORITY_RIGHT_UNCERTAIN");
    if (categories.has("priority")) codes.add("PRIORITY_RIGHT_UNCERTAIN");
    if ((dto.roundaboutConfidence ?? 5) <= 2) codes.add("ROUNDABOUT_WRONG_LANE");
    if (categories.has("roundabouts")) codes.add("ROUNDABOUT_WRONG_LANE");
    if ((dto.laneChangeConfidence ?? 5) <= 2) codes.add("LANE_CHANGE_MIRROR");
    if (categories.has("lanes")) codes.add("LANE_CHANGE_MIRROR");
    if (categories.has("junctions")) codes.add("JUNCTION_OBSERVATION");
    if (categories.has("observation")) codes.add("OBS_MIRRORS");
    if (categories.has("vulnerable")) codes.add("VULNERABLE_CYCLIST");
    if (categories.has("merging")) codes.add("MERGING_SAFE_GAP");
    if (categories.has("distance")) codes.add("SPACE_FOLLOWING_DISTANCE");
    if (categories.has("control")) codes.add("CONTROL_SMOOTH_BRAKING");
    if (categories.has("manoeuvres")) codes.add("MANOEUVRE_PARKING");
    if (categories.has("signs")) codes.add("SIGNS_MISSED");
    const notes = (dto.notes ?? "").toLowerCase();
    if (notes.includes("cyclist") || notes.includes("fiets") || notes.includes("bike")) codes.add("OBS_CYCLIST");
    if (notes.includes("mirror") || notes.includes("spiegel")) codes.add("OBS_MIRRORS");
    if (notes.includes("blind")) codes.add("OBS_BLIND_SPOT");
    if (notes.includes("junction") || notes.includes("kruispunt")) codes.add("JUNCTION_OBSERVATION");
    const weaknesses = await this.query('SELECT w."id", w."code", w."skillId" FROM "Weakness" w WHERE w."code" = ANY($1::text[]) AND w."active" = true', [...codes]);
    const skillIds = new Set<string>();
    for (const weakness of weaknesses) {
      skillIds.add(weakness.skillId);
      await this.prisma.$executeRawUnsafe('INSERT INTO "UserWeaknessHistory" ("id", "userId", "weaknessId", "occurrenceCount", "lastSeenAt", "lastSessionId") VALUES ($1,$2,$3,1,NOW(),$4) ON CONFLICT ("userId", "weaknessId") DO UPDATE SET "occurrenceCount" = "UserWeaknessHistory"."occurrenceCount" + 1, "lastSeenAt" = NOW(), "lastSessionId" = $4', randomUUID(), userId, weakness.id, sessionId);
    }
    for (const skillId of skillIds) await this.prisma.$executeRawUnsafe('INSERT INTO "UserSkillProgress" ("id", "userId", "skillId", "practiceCount", "weaknessCount", "lastPractisedAt") VALUES ($1,$2,$3,1,$4,NOW()) ON CONFLICT ("userId", "skillId") DO UPDATE SET "practiceCount" = "UserSkillProgress"."practiceCount" + 1, "weaknessCount" = "UserSkillProgress"."weaknessCount" + $4, "lastPractisedAt" = NOW()', randomUUID(), userId, skillId, 1);
  }

  private sessionShape(row: Row) {
    return { id: row.id, routeId: row.routeId, startedAt: row.startedAt, completedAt: row.completedAt, durationSec: row.durationSec, completionPct: row.completionPct, notes: row.notes, route: { slug: row.slug, name: row.name, centreName: row.centreName }, reflection: { overallFeeling: row.overallFeeling, difficultyCategories: row.difficultyCategories ?? [], difficultyDetails: row.difficultyDetails ?? {}, instructorFeedback: row.instructorFeedback, instructorCategories: row.instructorCategories ?? [], instructorNotes: row.instructorNotes, speedCompliance: row.speedCompliance, rightOfWayConfidence: row.rightOfWayConfidence, roundaboutConfidence: row.roundaboutConfidence, laneChangeConfidence: row.laneChangeConfidence, observedSpeedKph: row.observedSpeedKph, speedLimitKph: row.speedLimitKph, flaggedSpeeding: row.flaggedSpeeding, missedRightOfWay: row.missedRightOfWay } };
  }

  private recommendations(reflection?: Row | null) {
    if (!reflection) return [{ skill: "Start with a reflection", message: "Complete your first practice session reflection to receive a personalized plan." }];
    const result: Array<{ skill: string; message: string }> = [];
    const categories = new Set<string>(reflection.difficultyCategories ?? []);
    const measuredSpeeding = reflection.observedSpeedKph !== null && reflection.speedLimitKph !== null && reflection.observedSpeedKph > reflection.speedLimitKph;
    if (reflection.flaggedSpeeding || measuredSpeeding || (reflection.speedCompliance ?? 5) <= 2) result.push({ skill: "Speed awareness", message: measuredSpeeding ? `You recorded ${reflection.observedSpeedKph} km/h in a ${reflection.speedLimitKph} km/h zone. Repeat an approved route and settle at the posted limit early.` : "Repeat an approved route with speed zones and focus on reading signs early and holding the posted limit." });
    if (reflection.missedRightOfWay || (reflection.rightOfWayConfidence ?? 5) <= 2) result.push({ skill: "Priority and right of way", message: "Review priority signs and practise slowing before junctions until the order of traffic is clear." });
    if ((reflection.roundaboutConfidence ?? 5) <= 2) result.push({ skill: "Roundabouts", message: "Choose an approved route with roundabouts and review the lane and exit warnings before driving." });
    if ((reflection.laneChangeConfidence ?? 5) <= 2) result.push({ skill: "Lane changes", message: "Practise mirror, signal and blind-spot checks before changing position." });
    if (categories.has("junctions")) result.push({ skill: "Junctions", message: "Repeat a route with junctions and practise scanning, positioning and approach speed early." });
    if (categories.has("observation")) result.push({ skill: "Observation", message: "Build a consistent mirror, blind-spot and forward-scan routine before each decision." });
    if (categories.has("vulnerable")) result.push({ skill: "Vulnerable road users", message: "Practise spotting cyclists and pedestrians early and leave them safe space." });
    if (categories.has("merging")) result.push({ skill: "Merging and overtaking", message: "Choose a safe gap, check mirrors and blind spots, then merge smoothly." });
    if (categories.has("distance")) result.push({ skill: "Distance and anticipation", message: "Look further ahead and create more time and space around changing traffic." });
    if (categories.has("control")) result.push({ skill: "Vehicle control", message: "Repeat calm starts, braking and steering so each action stays smooth and deliberate." });
    if (categories.has("manoeuvres")) result.push({ skill: "Manoeuvres", message: "Practise slow, controlled manoeuvres with all-round observation." });
    return result.length ? result : [{ skill: "Keep building consistency", message: "Your reflection looks positive. Try another approved route and aim for a complete, calm drive." }];
  }

  private focus(reflection?: Row | null) {
    const categories = new Set<string>(reflection?.difficultyCategories ?? []);
    const measuredSpeeding = reflection?.observedSpeedKph !== null && reflection?.observedSpeedKph !== undefined && reflection?.speedLimitKph !== null && reflection?.speedLimitKph !== undefined && reflection.observedSpeedKph > reflection.speedLimitKph;
    if (reflection?.flaggedSpeeding || measuredSpeeding || (reflection?.speedCompliance ?? 5) <= 2) return { skill: "Speed awareness", message: measuredSpeeding ? `You recorded ${reflection.observedSpeedKph} km/h in a ${reflection.speedLimitKph} km/h zone. Read the next limit early and settle before the sign.` : "Read the posted limit before each new section and settle at the limit early.", keywords: ["speed", "zone", "limit"] };
    if (reflection?.missedRightOfWay || (reflection?.rightOfWayConfidence ?? 5) <= 2) return { skill: "Priority and right of way", message: "Approach junctions ready to yield; identify the priority sign before committing.", keywords: ["priority", "yield", "right", "junction"] };
    if ((reflection?.roundaboutConfidence ?? 5) <= 2) return { skill: "Roundabouts", message: "Choose your lane before entry, check mirrors and signal the exit early.", keywords: ["roundabout", "lane", "exit"] };
    if ((reflection?.laneChangeConfidence ?? 5) <= 2) return { skill: "Lane changes", message: "Practise mirror, signal and blind-spot checks before changing position.", keywords: ["lane", "change", "mirror"] };
    if (categories.has("junctions")) return { skill: "Junctions", message: "Scan early, choose your position and settle your speed before each junction.", keywords: ["junction", "intersection", "priority"] };
    if (categories.has("observation")) return { skill: "Observation", message: "Use a consistent mirror, blind-spot and forward-scanning routine.", keywords: ["mirror", "observation", "blind"] };
    if (categories.has("vulnerable")) return { skill: "Vulnerable road users", message: "Scan early for cyclists and pedestrians and leave them safe space.", keywords: ["cyclist", "pedestrian", "vulnerable"] };
    if (categories.has("merging")) return { skill: "Merging and overtaking", message: "Check mirrors, find a safe gap and merge smoothly.", keywords: ["merge", "merging", "gap"] };
    if (categories.has("distance")) return { skill: "Distance and anticipation", message: "Look further ahead and create time and space around changing traffic.", keywords: ["distance", "space", "ahead"] };
    return { skill: "Calm consistency", message: "Keep the approved route, scan ahead and make each decision early and smoothly.", keywords: ["start", "junction", "lane"] };
  }

  private coachingMode(mode?: string) {
    const normalized = (mode ?? "COACH").toUpperCase();
    return normalized === "LIGHT" || normalized === "INTENSIVE" ? normalized : "COACH";
  }

  private audit(userId: string, action: string, entity: string, entityId: string) {
    return this.prisma.$executeRawUnsafe('INSERT INTO "AuditLog" ("id", "userId", "action", "entity", "entityId") VALUES ($1,$2,$3,$4,$5)', randomUUID(), userId, action, entity, entityId);
  }
}
