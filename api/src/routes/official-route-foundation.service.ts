import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Prisma, Route } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { DrivingRouteService } from "./driving-route.service";
import { officialPassageCatalog, passageFingerprint } from "../exam-centres/official-passage-catalog";
import { belgianCoordinate, coordinate, orderedCoverageIssues, passageShapeIssues, type GeoPoint, type RouteAnchor } from "./foundation-quality";
import { metres } from "../learning/practice-progress";
import { durationIssues } from "./route-quality";

type ReviewedPoint = GeoPoint & { id: string; centreId: string; sourceFingerprint: string | null; verificationStatus: string; verifiedAt: Date | null; verifiedBy: string | null; duplicateOfSequence: number | null; municipality: string; junction: string; sourceUrl: string; sourceRevision: string | null };
type ProofPoint = GeoPoint & { id: string; sourceFingerprint: string; verifiedAt: string };
type Proof = { kind: "PUBLISHED_PASSAGE_PRACTICE"; departure: GeoPoint & { version: number; reviewedAt: string }; points: ProofPoint[]; shape?: RouteAnchor[] };
export function reviewedPassage(point: ReviewedPoint) {
  return point.verificationStatus === "VERIFIED" && point.duplicateOfSequence === null && Boolean(point.verifiedBy && point.verifiedAt && point.sourceFingerprint === passageFingerprint(point)) && belgianCoordinate(point);
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
    const source = officialPassageCatalog.find(s => s.slug === centre.slug) ?? null;
    const points = centre.officialPassagePoints;
    return { centreId, centreName: centre.name, source, departure: centre.departure, points, readyPointCount: points.filter(p => reviewedPassage(p as ReviewedPoint)).length, supportedSource: Boolean(source) };
  }

  async summary(slug: string) {
    const centre = await this.prisma.examCentre.findFirst({ where: { slug, isPublished: true }, select: { id: true } });
    if (!centre) throw new NotFoundException("Centre not found");
    const w = await this.workspace(centre.id);
    return { source: w.source ? { name: "Autoveiligheid", url: w.source.sourceUrl, centreUrl: w.source.centreSourceUrl, address: w.source.address, revision: w.source.sourceRevision, checkedAt: w.source.sourceCheckedAt, publishedEntries: w.source.points.length } : null, reviewedPointCount: w.readyPointCount, departureReviewed: w.departure?.verificationStatus === "VERIFIED", officialExamItinerary: false, targetMinutes: 25, toleranceMinutes: 2 };
  }

  async importSource(actorId: string, centreId: string) {
    const centre = await this.prisma.examCentre.findUnique({ where: { id: centreId } });
    const source = officialPassageCatalog.find(s => s.slug === centre?.slug);
    if (!source) throw new BadRequestException("No operator source bundle is verified for this centre; do not invent passage points");
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext($1))', `official-source:${centreId}`);
      for (const point of source.points) {
        const data = { ...point, sourceUrl: source.sourceUrl, sourceRevision: source.sourceRevision, sourceLabel: "Autoveiligheid published passage point — not mandatory on every exam", sourceCheckedAt: new Date(source.sourceCheckedAt) };
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
      if (!source || !reviewedPassage(source as ReviewedPoint) || source.sourceFingerprint !== point.sourceFingerprint || source.latitude !== point.latitude || source.longitude !== point.longitude || source.verifiedAt?.toISOString() !== point.verifiedAt) throw new BadRequestException("Passage-point review changed; rebuild and review this route");
    }
  }

  async generateDraft(actorId: string, centreId: string, ids: string[], waypoints?: RouteAnchor[]) {
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
