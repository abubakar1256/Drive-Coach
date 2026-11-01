import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { GenerateCoverageDraftsDto } from "../admin/dto/admin-route.dto";
import { createHash } from "node:crypto";
import type { Prisma, Route } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { DrivingRouteService } from "./driving-route.service";
import { passageFingerprint } from "../exam-centres/official-passage-catalog";
import { currentPassageSource, passageSourceCatalog, sourceCurrent, type PassageSource } from "../exam-centres/passage-source-catalog";
import { belgianCoordinate, coordinate, orderedCoverageIssues, passageShapeIssues, type GeoPoint, type RouteAnchor } from "./foundation-quality";
import { metres } from "../learning/practice-progress";
import { durationIssues } from "./route-quality";
import { publishedRoutePolicy } from "./published-route-policy";
import { uncoveredSelections } from "./passage-coverage";

type ReviewedPoint = GeoPoint & { id: string; centreId: string; sourceFingerprint: string | null; verificationStatus: string; verifiedAt: Date | null; verifiedBy: string | null; duplicateOfSequence: number | null; municipality: string; junction: string; sourceUrl: string; sourceRevision: string | null };
type ProofPoint = GeoPoint & { id: string; sourceFingerprint: string; verifiedAt: string };
type Proof = { kind: "PUBLISHED_PASSAGE_PRACTICE"; departure: GeoPoint & { version: number; reviewedAt: string }; points: ProofPoint[]; shape?: RouteAnchor[] };
export function reviewedPassage(point: ReviewedPoint) {
  return point.verificationStatus === "VERIFIED" && point.duplicateOfSequence === null && Boolean(point.verifiedBy && point.verifiedAt && point.sourceFingerprint === passageFingerprint(point)) && belgianCoordinate(point);
}
export function sourceReviewCounts(source: PassageSource | null, points: Array<ReviewedPoint & { sequence: number }>) {
  if (!source) return { eligibleEntryCount: 0, duplicateEntryCount: 0, pendingPointCount: 0, reviewComplete: false };
  const expected = source.points.map(original => ({ original, current: points.find(p => p.sequence === original.sequence && p.duplicateOfSequence === original.duplicateOfSequence && p.sourceFingerprint === passageFingerprint({ ...original, sourceUrl: source.sourceUrl, sourceRevision: source.sourceRevision }) && p.sourceFingerprint === passageFingerprint(p)) }));
  const eligible = expected.filter(p => p.original.duplicateOfSequence === null);
  const reviewed = eligible.filter(p => p.current && reviewedPassage(p.current)).length;
  const duplicates = expected.filter(p => p.original.duplicateOfSequence !== null);
  return { eligibleEntryCount: eligible.length, duplicateEntryCount: duplicates.length, pendingPointCount: eligible.length - reviewed, reviewComplete: reviewed === eligible.length && duplicates.every(p => p.current && p.current.verificationStatus !== "VERIFIED") };
}
export function publicFoundation(value: unknown) {
  const proof = value as Proof | null;
  return proof?.kind === "PUBLISHED_PASSAGE_PRACTICE" ? { kind: proof.kind, passagePointCount: proof.points?.length ?? 0, officialExamItinerary: false } : null;
}

@Injectable()
export class OfficialRouteFoundationService {
  constructor(private readonly prisma: PrismaService, private readonly driving: DrivingRouteService) {}

  async workspace(centreId: string) {
    const centre = await this.prisma.examCentre.findUnique({ where: { id: centreId }, include: { departure: true, officialPassagePoints: { orderBy: { sequence: "asc" } } } });
    if (!centre) throw new NotFoundException("Centre not found");
    const source = currentPassageSource(centre.slug);
    const points = centre.officialPassagePoints;
    return { centreId, centreName: centre.name, source, departure: centre.departure, points, readyPointCount: points.filter(p => reviewedPassage(p as ReviewedPoint)).length, supportedSource: Boolean(source) };
  }

  async summary(slug: string) {
    const centre = await this.prisma.examCentre.findFirst({ where: { slug, isPublished: true }, select: { id: true } });
    if (!centre) throw new NotFoundException("Centre not found");
    const w = await this.workspace(centre.id);
    return { source: w.source ? { name: w.source.operatorName ?? "Autoveiligheid", url: w.source.sourceUrl, centreUrl: w.source.centreSourceUrl, address: w.source.address, revision: w.source.sourceRevision, checkedAt: w.source.sourceCheckedAt, validUntil: w.source.validUntil ?? null, publishedEntries: w.source.points.length, pointGroupCount: w.source.pointGroups?.length ?? 0, qualification: w.source.qualification ?? null } : null, ...sourceReviewCounts(w.source, w.points as Array<ReviewedPoint & { sequence: number }>), reviewedPointCount: w.readyPointCount, departureReviewed: w.departure?.verificationStatus === "VERIFIED", officialExamItinerary: false, targetMinutes: 25, toleranceMinutes: 2 };
  }

  async coverageForSlug(slug: string) {
    const centre = await this.prisma.examCentre.findFirst({ where: { slug, isPublished: true }, select: { id: true } });
    if (!centre) throw new NotFoundException("Centre not found");
    return this.coverage(centre.id);
  }

  async coverage(centreId: string, details = false) {
    const w = await this.workspace(centreId);
    const source = w.source;
    const eligible = source?.points.filter(p => p.duplicateOfSequence === null) ?? [];
    const current = w.points.filter(p => reviewedPassage(p as ReviewedPoint) && eligible.some(s => s.sequence === p.sequence && p.sourceFingerprint === passageFingerprint({ ...s, sourceUrl: source!.sourceUrl, sourceRevision: source!.sourceRevision })));
    const routes = await this.prisma.route.findMany({ where: { centreId, ...publishedRoutePolicy, centre: { isPublished: true } }, include: { points: { orderBy: { sequence: "asc" } } } });
    const covered = new Map<string, string[]>();
    let sourceLinkedRouteCount = 0, staleSourceRouteCount = 0;
    for (const route of routes) {
      if (!route.foundation) continue;
      try { await this.validateSnapshot(route, route.points); }
      catch (e) { if (!(e instanceof BadRequestException)) throw e; staleSourceRouteCount++; continue; }
      const proof = route.foundation as unknown as Proof;
      if (!proof.points.every(p => current.some(c => c.id === p.id))) { staleSourceRouteCount++; continue; }
      sourceLinkedRouteCount++;
      for (const p of proof.points) covered.set(p.id, [...(covered.get(p.id) ?? []), route.slug]);
    }
    const uncovered = current.filter(p => !covered.has(p.id));
    const departureReady = Boolean(w.departure?.verificationStatus === "VERIFIED" && w.departure.reviewedBy && w.departure.reviewedAt);
    const result = {
      sourceAvailable: Boolean(source), sourceEntryCount: source?.points.length ?? 0, distinctSourceEntryCount: eligible.length,
      reviewedPointCount: current.length, pendingPointCount: eligible.length - current.length,
      coveredPointCount: covered.size, uncoveredReviewedPointCount: uncovered.length,
      coveragePercent: eligible.length ? Math.floor(covered.size * 100 / eligible.length) : 0,
      publishedRouteCount: routes.length, sourceLinkedRouteCount, staleSourceRouteCount, departureReviewed: departureReady,
      complete: Boolean(source && eligible.length && current.length === eligible.length && covered.size === eligible.length && departureReady),
      measuredNow: false, basis: "CURRENT_PUBLISHED_SOURCE_PROOFS",
      generationConfigured: ["PASSAGE_DAILY_REQUEST_BUDGET", "PASSAGE_MONTHLY_REQUEST_BUDGET"].every(key => Number.isSafeInteger(Number(process.env[key])) && Number(process.env[key]) > 0) && Boolean(process.env.MAPBOX_DIRECTIONS_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN), maxRequestsPerRun: 8,
      limitation: "Source-linked reviewed route records, not a fresh driving-time check, mandatory exam points or proof that other routes never pass nearby.",
    };
    return details ? { ...result, points: w.points.map(p => ({ id: p.id, sequence: p.sequence, municipality: p.municipality, junction: p.junction, status: p.duplicateOfSequence !== null ? "DUPLICATE" : !current.some(c => c.id === p.id) ? "REVIEW_REQUIRED" : covered.has(p.id) ? "COVERED" : "NO_PUBLISHED_ROUTE", routes: covered.get(p.id) ?? [] })), selections: uncoveredSelections(departureReady ? w.departure : null, current as any, new Set(covered.keys())), providerRequests: 0 } : result;
  }

  async generateCoverageDrafts(actorId: string, centreId: string, input: GenerateCoverageDraftsDto) {
    const dto = plainToInstance(GenerateCoverageDraftsDto, input);
    if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length) throw new BadRequestException("Confirm a bounded coverage request with a new UUID and limit 1–8");
    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true } });
    if (!actor || !["CONTENT_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(actor.role)) throw new ForbiddenException("Current content-management permission required");
    const cap = (name: string, max: number) => { const value = Number(process.env[name]); return Number.isSafeInteger(value) && value >= 1 && value <= max ? value : 0; };
    const daily = cap("PASSAGE_DAILY_REQUEST_BUDGET", 1000), monthly = cap("PASSAGE_MONTHLY_REQUEST_BUDGET", 10000);
    if (!daily || !monthly) throw new ServiceUnavailableException("Passage generation is paused until an existing provider allowance is verified and configured");
    const report = await this.coverage(centreId, true);
    if (!("selections" in report) || !report.departureReviewed || !report.selections.length) throw new BadRequestException("No usable uncovered-point selection; finish source/departure reviews first");
    const selections = report.selections.slice(0, dto.requestLimit), reserve = selections.length, date = new Date().toISOString();
    const requestKey = `passage:${centreId}:${dto.requestKey}`;
    const job = await this.prisma.$transaction(async tx => {
      // The actor and both buckets are locked before reserving provider spend.
      await tx.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id"=$1 FOR UPDATE', actorId);
      const current = await tx.user.findUnique({ where: { id: actorId }, select: { role: true } });
      if (!current || !["CONTENT_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(current.role)) throw new ForbiddenException("Content permission changed");
      if (await tx.preparationGeneration.findUnique({ where: { userId_requestKey: { userId: actorId, requestKey } } })) throw new ConflictException("This coverage request was already reserved; inspect drafts before starting another request");
      for (const [bucket, maximum] of [[`PASSAGE:DAY:${date.slice(0, 10)}`, daily], [`PASSAGE:MONTH:${date.slice(0, 7)}`, monthly]] as const) {
        await tx.preparationRoutingBudget.upsert({ where: { bucket }, create: { bucket }, update: {} });
        await tx.$queryRawUnsafe('SELECT "bucket" FROM "PreparationRoutingBudget" WHERE "bucket"=$1 FOR UPDATE', bucket);
        const budget = await tx.preparationRoutingBudget.findUniqueOrThrow({ where: { bucket } });
        if (budget.reserved + reserve > maximum) throw new ServiceUnavailableException("Approved passage-routing allowance is exhausted; no provider requests were made");
        await tx.preparationRoutingBudget.update({ where: { bucket }, data: { reserved: { increment: reserve } } });
      }
      return tx.preparationGeneration.create({ data: { userId: actorId, requestKey } });
    });
    const drafts: Array<{ id: string; slug: string }> = [], failures: Array<{ sequences: number[]; issues: string[] }> = [];
    let attempted = 0;
    try {
      for (const selection of selections) {
        const current = await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true } });
        if (!current || !["CONTENT_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(current.role)) throw new ForbiddenException("Content permission changed; generation stopped");
        attempted++;
        try {
          const draft = await this.generateDraft(actorId, centreId, selection.passagePointIds, undefined, true);
          if (draft.status === "DRAFT") drafts.push({ id: draft.id, slug: draft.slug });
          else failures.push({ sequences: selection.sequences, issues: ["EXISTING_ROUTE_REQUIRES_REVIEW"] });
        } catch (e) {
          if (!(e instanceof BadRequestException)) throw e;
          const response = e.getResponse() as { issues?: unknown };
          const issues = Array.isArray(response.issues) ? response.issues.filter((i): i is string => typeof i === "string" && /^[A-Z0-9_]+$/.test(i)).slice(0, 12) : ["SELECTION_NEEDS_REVIEW"];
          failures.push({ sequences: selection.sequences, issues });
          if (issues.some(i => ["ROUTING_UNAVAILABLE", "ROUTING_NOT_CONFIGURED"].includes(i))) break;
        }
      }
      const outcome = { jobId: job.id, reservedRequests: reserve, attemptedSelections: attempted, drafts, failures, published: false, complete: false, message: "Drafts only. Review actual roads, content and remaining coverage before publishing. Failed selections are not fabricated or automatically retried." };
      await this.prisma.$transaction(async tx => {
        await tx.preparationGeneration.update({ where: { id: job.id }, data: { state: "SUCCEEDED" } });
        await tx.auditLog.create({ data: { userId: actorId, action: "PASSAGE_COVERAGE_DRAFTS_PREPARED", entity: "ExamCentre", entityId: centreId, metadata: outcome } });
      });
      return outcome;
    } catch (e) {
      await this.prisma.preparationGeneration.update({ where: { id: job.id }, data: { state: "FAILED" } });
      throw e;
    }
  }

  async importSource(actorId: string, centreId: string) {
    const centre = await this.prisma.examCentre.findUnique({ where: { id: centreId } });
    const source = centre ? currentPassageSource(centre.slug) : null;
    if (!source) throw new BadRequestException("No operator source bundle is verified for this centre; do not invent passage points");
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext($1))', `official-source:${centreId}`);
      for (const point of source.points) {
        const data = { ...point, sourceUrl: source.sourceUrl, sourceRevision: source.sourceRevision, sourceLabel: `${source.operatorName ?? "Autoveiligheid"} published passage point — not mandatory on every exam`, sourceCheckedAt: new Date(source.sourceCheckedAt) };
        const fingerprint = passageFingerprint(data);
        const current = await tx.officialPassagePoint.findUnique({ where: { centreId_sequence: { centreId, sequence: point.sequence } } });
        const sameSource = current?.sourceFingerprint === fingerprint && current.duplicateOfSequence === data.duplicateOfSequence && passageFingerprint(current) === fingerprint;
        if (sameSource && current.sourceLabel === data.sourceLabel && current.sourceCheckedAt?.getTime() === data.sourceCheckedAt.getTime()) continue;
        await tx.officialPassagePoint.upsert({ where: { centreId_sequence: { centreId, sequence: point.sequence } }, create: { ...data, centreId, sourceFingerprint: fingerprint }, update: { ...data, sourceFingerprint: fingerprint, ...(sameSource ? {} : { verificationStatus: "PENDING_REVIEW", verifiedAt: null, verifiedBy: null }) } });
      }
      await tx.officialPassagePoint.updateMany({ where: { centreId, sequence: { gt: source.points.length } }, data: { verificationStatus: "REJECTED", verifiedAt: null, verifiedBy: null } });
      await tx.auditLog.create({ data: { userId: actorId, action: "OFFICIAL_SOURCE_IMPORTED", entity: "ExamCentre", entityId: centreId, metadata: { sourceUrl: source.sourceUrl, entries: source.points.length } } });
      return { imported: source.points.length, coordinatesPreserved: true, automaticallyVerified: false };
    }, { isolationLevel: "Serializable", timeout: 120_000, maxWait: 10_000 });
  }

  async reviewPassage(actorId: string, id: string, dto: { latitude?: number; longitude?: number; verificationStatus?: string; notes?: string }) {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT "id" FROM "OfficialPassagePoint" WHERE "id"=$1 FOR UPDATE', id);
      const current = await tx.officialPassagePoint.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("Passage point not found");
      const location = { latitude: dto.latitude ?? current.latitude, longitude: dto.longitude ?? current.longitude };
      const moved = location.latitude !== current.latitude || location.longitude !== current.longitude;
      const status = dto.verificationStatus ?? (moved ? "PENDING_REVIEW" : current.verificationStatus);
      if (status === "VERIFIED" && !passageSourceCatalog.some(s => s.sourceUrl === current.sourceUrl && sourceCurrent(s))) throw new BadRequestException("Current operator source required before location review");
      if (status === "VERIFIED" && (current.duplicateOfSequence !== null || !belgianCoordinate(location as GeoPoint) || (dto.notes?.trim().length ?? 0) < 8 || !current.sourceFingerprint || current.sourceFingerprint !== passageFingerprint(current))) throw new BadRequestException("Import the current source, review distinct Belgian coordinates and add review evidence (8+ characters) before verification");
      const updated = await tx.officialPassagePoint.update({ where: { id }, data: { ...dto, verificationStatus: status, verifiedAt: status === "VERIFIED" ? new Date() : null, verifiedBy: status === "VERIFIED" ? actorId : null } });
      await tx.auditLog.create({ data: { userId: actorId, action: "PASSAGE_COORDINATES_REVIEWED", entity: "OfficialPassagePoint", entityId: id, metadata: { before: { latitude: current.latitude, longitude: current.longitude, status: current.verificationStatus }, after: { ...location, status } } } });
      return updated;
    });
  }

  async reviewDeparture(actorId: string, centreId: string, dto: GeoPoint & { label: string; sourceUrl: string; notes: string; verificationStatus: string }) {
    const centre = await this.prisma.examCentre.findUnique({ where: { id: centreId } });
    if (!centre || !belgianCoordinate(dto) || !dto.notes?.trim() || !dto.label?.trim() || !/^https:\/\//.test(dto.sourceUrl)) throw new BadRequestException("Centre, source, review notes and reviewed Belgian coordinates are required");
    if (centre.latitude !== null && centre.longitude !== null && metres(coordinate(centre as GeoPoint), coordinate(dto)) > 30000) throw new BadRequestException("Departure is not near this centre's area; check the centre/source before review");
    return this.prisma.$transaction(async tx => {
      const departure = await tx.centreDeparture.upsert({ where: { centreId }, create: { ...dto, centreId, reviewedBy: dto.verificationStatus === "VERIFIED" ? actorId : null, reviewedAt: dto.verificationStatus === "VERIFIED" ? new Date() : null }, update: { ...dto, version: { increment: 1 }, reviewedBy: dto.verificationStatus === "VERIFIED" ? actorId : null, reviewedAt: dto.verificationStatus === "VERIFIED" ? new Date() : null } });
      await tx.auditLog.create({ data: { userId: actorId, action: "CENTRE_DEPARTURE_REVIEWED", entity: "ExamCentre", entityId: centreId, metadata: { departure } } });
      return departure;
    });
  }

  async validateSnapshot(route: Pick<Route, "centreId" | "foundation">, points: RouteAnchor[], db: Prisma.TransactionClient = this.prisma, lock = false) {
    if (!route.foundation) return;
    const proof = route.foundation as unknown as Proof;
    if (proof.kind !== "PUBLISHED_PASSAGE_PRACTICE" || !proof.departure || !belgianCoordinate(proof.departure) || !Array.isArray(proof.points) || proof.points.length < 2 || proof.points.length > 6 || new Set(proof.points.map(p => p?.id)).size !== proof.points.length || proof.points.some(p => !p?.id || !belgianCoordinate(p))) throw new BadRequestException("Invalid passage-point route provenance");
    if (lock) {
      await db.$queryRawUnsafe('SELECT "centreId" FROM "CentreDeparture" WHERE "centreId"=$1 FOR SHARE', route.centreId);
      for (const p of proof.points) await db.$queryRawUnsafe('SELECT "id" FROM "OfficialPassagePoint" WHERE "id"=$1 FOR SHARE', p.id);
    }
    const departure = await db.centreDeparture.findUnique({ where: { centreId: route.centreId } });
    if (!departure || departure.verificationStatus !== "VERIFIED" || !departure.reviewedBy || departure.version !== proof.departure.version || departure.reviewedAt?.toISOString() !== proof.departure.reviewedAt || departure.latitude !== proof.departure.latitude || departure.longitude !== proof.departure.longitude) throw new BadRequestException("Departure review changed; rebuild and review this route");
    const sources = await db.officialPassagePoint.findMany({ where: { id: { in: proof.points.map(p => p.id) }, centreId: route.centreId } });
    const expected: RouteAnchor[] = proof.shape ?? [proof.departure, ...proof.points, proof.departure];
    if (passageShapeIssues(expected, proof.departure, proof.points).length || points.length !== expected.length || points.some((p, i) => !belgianCoordinate(p) || metres(coordinate(p), coordinate(expected[i])) > 1 || (proof.shape && (p.bearing ?? null) !== (expected[i].bearing ?? null)))) throw new BadRequestException("Route waypoints no longer match the reviewed passage sequence");
    for (const point of proof.points) {
      const source = sources.find(s => s.id === point.id);
      if (source && !passageSourceCatalog.some(s => s.sourceUrl === source.sourceUrl && sourceCurrent(s))) throw new BadRequestException("Operator source has expired or changed; rebuild after source review");
      if (!source || !reviewedPassage(source as ReviewedPoint) || source.sourceFingerprint !== point.sourceFingerprint || source.latitude !== point.latitude || source.longitude !== point.longitude || source.verifiedAt?.toISOString() !== point.verifiedAt) throw new BadRequestException("Passage-point review changed; rebuild and review this route");
    }
  }

  async generateDraft(actorId: string, centreId: string, ids: string[], waypoints?: RouteAnchor[], recheckPermission = false) {
    const w = await this.workspace(centreId);
    const departure = w.departure;
    if (!departure || departure.verificationStatus !== "VERIFIED" || !departure.reviewedBy || !departure.reviewedAt) throw new BadRequestException("Review the legal public-road start/finish first; directory map anchors are not exam entrances");
    if (ids.length < 2 || ids.length > 6 || new Set(ids).size !== ids.length) throw new BadRequestException("Choose 2–6 distinct reviewed passage points in driving order");
    const selected = ids.map(id => w.points.find(p => p.id === id));
    if (selected.some(p => !p || !reviewedPassage(p as ReviewedPoint))) throw new BadRequestException("Only reviewed coordinates from this centre and current source may be used");
    const points = selected as Array<ReviewedPoint>;
    const all = [departure, ...points];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (metres(coordinate(all[i]), coordinate(all[j])) < 80) throw new BadRequestException("Selected points describe the same nearby junction; choose distinct passage locations");
    const ordered: RouteAnchor[] = waypoints ?? [departure, ...points, departure];
    if (passageShapeIssues(ordered, departure, points).length) throw new BadRequestException("Use 4–25 valid road anchors containing the exact reviewed departure and each selected passage once in driving order");
    const result = await this.driving.requireValid(ordered);
    const issues = [...durationIssues(result.durationSec), ...orderedCoverageIssues(result.coordinates, ordered)];
    if (issues.length) throw new BadRequestException({ message: `No compliant 25 ±2 minute loop for this selection: ${issues.join(", ")}. Change the passage sequence; no route was fabricated.`, issues });
    const proof: Proof = { kind: "PUBLISHED_PASSAGE_PRACTICE", departure: { latitude: departure.latitude, longitude: departure.longitude, version: departure.version, reviewedAt: departure.reviewedAt.toISOString() }, points: points.map(p => ({ id: p.id, latitude: p.latitude, longitude: p.longitude, sourceFingerprint: p.sourceFingerprint!, verifiedAt: p.verifiedAt!.toISOString() })), ...(waypoints ? { shape: ordered.map(p => ({ latitude: p.latitude, longitude: p.longitude, ...(p.bearing != null ? { bearing: p.bearing } : {}) })) } : {}) };
    const slug = `${w.source?.slug ?? "centre"}-passage-practice-${createHash("sha256").update(JSON.stringify(proof)).digest("hex").slice(0, 12)}`;
    return this.prisma.$transaction(async tx => {
      if (recheckPermission) {
        await tx.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id"=$1 FOR SHARE', actorId);
        const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true } });
        if (!actor || !["CONTENT_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(actor.role)) throw new ForbiddenException("Content permission changed; no draft was saved");
      }
      await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext($1))', slug);
      // Re-read source records in the same transaction as persistence. A concurrent
      // review invalidation must not be silently ignored after a slow API call.
      await tx.$queryRawUnsafe('SELECT "centreId" FROM "CentreDeparture" WHERE "centreId"=$1 FOR SHARE', centreId);
      for (const id of ids) await tx.$queryRawUnsafe('SELECT "id" FROM "OfficialPassagePoint" WHERE "id"=$1 FOR SHARE', id);
      await this.validateSnapshot({ centreId, foundation: proof as unknown as Prisma.JsonValue }, ordered, tx);
      const existing = await tx.route.findUnique({ where: { slug } });
      if (existing) return { ...existing, preserved: true };
      const route = await tx.route.create({ data: { centreId, slug, name: "Published passage-point practice", status: "DRAFT", verificationStatus: "PENDING_REVIEW", durationMin: Math.ceil(result.durationSec! / 60), foundation: proof as unknown as Prisma.InputJsonValue, sourceLabel: "Practice via published passage points — not an official exam itinerary", sourceUrl: w.source?.sourceUrl ?? points[0].sourceUrl, points: { create: ordered.map((p, i) => {
        const passage = i > 0 && i < ordered.length - 1 ? points.find(source => metres(coordinate(p), coordinate(source)) <= 1) : null;
        return { sequence: i + 1, category: i === 0 ? "start" : i === ordered.length - 1 ? "finish" : passage ? "passage" : "waypoint", title: i === 0 ? departure.label : i === ordered.length - 1 ? "Return to reviewed road reference" : passage?.junction ?? `Connecting road anchor ${i + 1}`, latitude: p.latitude, longitude: p.longitude, bearing: p.bearing ?? null, description: "Practice route. Published passage points are not mandatory on every exam. Follow current signs and instructor guidance. Road reference is not permission to stop or park." };
      }) } }, include: { points: true } });
      await tx.auditLog.create({ data: { userId: actorId, action: "PASSAGE_PRACTICE_DRAFT_CREATED", entity: "Route", entityId: route.id, metadata: { durationSec: result.durationSec, pointIds: ids, officialExamItinerary: false } } });
      return route;
    });
  }
}
