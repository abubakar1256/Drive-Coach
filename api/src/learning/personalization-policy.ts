import { createHash } from "node:crypto";
import { preparationFocus, type PreparationLevel } from "./preparation-policy";
import { geometryIssues, durationIssues, type Coordinate } from "../routes/route-quality";
import { metres, snapshotDistance } from "./practice-progress";
import { mappedCoverageDetails } from "./mapped-preparation-coverage";

export const focusCodes = ["speed", "priority", "roundabouts", "junctions", "lanes", "observation", "parking", "vulnerable", "merging", "control", "signs", "space"] as const;
export type FocusCode = typeof focusCodes[number];
export function coverageFingerprint(route: { id: string; version: number; points: unknown[] }) {
  const points = [...route.points as any[]].sort((a,b) => a.sequence-b.sequence).map(p => ({ id:p.id, sequence:p.sequence, title:p.title, category:p.category, latitude:p.latitude, longitude:p.longitude, bearing:p.bearing ?? null, description:p.description ?? null, warning:p.warning ?? null }));
  return createHash("sha256").update(JSON.stringify({ id: route.id, version: route.version, points })).digest("hex");
}
export function coverageCurrent(route: any) {
  const c = route.preparationCoverage;
  return Boolean(c && c.routeVersion === route.version && c.fingerprint === coverageFingerprint(route) && c.reviewedAt && c.reviewedBy && /^https:\/\//.test(c.sourceUrl));
}
export function rankPreparation(routes: any[], focus: ReturnType<typeof preparationFocus>, level: PreparationLevel) {
  const target = { BEGINNER: "LOW", INTERMEDIATE: "MEDIUM", DIFFICULT: "HIGH" }[level];
  return routes.map(route => {
    const known = coverageCurrent(route), coverage = known ? route.preparationCoverage : null;
    const matched = focus.items.filter(item => coverage?.skills.includes(item.code)).map(item => ({ code: item.code, label: item.label, basis: item.basis }));
    const levelMatched = coverage?.complexity === target;
    return { route, score: matched.length * 10 + (levelMatched ? 2 : 0), matched, levelMatched: Boolean(levelMatched), coverage: known ? { status: "REVIEWED", complexity: coverage.complexity, details: mappedCoverageDetails(coverage.notes ?? "", coverage.complexity), reviewedAt: coverage.reviewedAt, sourceUrl: coverage.sourceUrl } : { status: "UNKNOWN", complexity: null, details: null, reviewedAt: null, sourceUrl: null }, reason: matched.length ? `Reviewed coverage matches ${matched.map(i => i.label).join(", ")}.` : "No reviewed match is known for your reported focus. This is general practice, not a claimed skill match." };
  }).sort((a, b) => b.score - a.score || a.route.id.localeCompare(b.route.id));
}

export type PrivateSnapshot = { version: 1; geometry: Coordinate[]; points: Coordinate[]; distanceM: number; durationSec: number; provider: "MAPBOX_DRIVING"; measuredAt: string; observedFeatures: string[]; source: "PRIVATE_HOMETOWN_PRACTICE" };
export function checkedPrivateSnapshot(driving: any, points: Array<{ longitude: number; latitude: number }>, anchor: Coordinate): PrivateSnapshot | null {
  if (!driving?.valid || durationIssues(driving.durationSec).length || !Number.isFinite(driving.distanceM) || driving.distanceM <= 0 || !Array.isArray(driving.coordinates) || driving.coordinates.length < 4 || driving.coordinates.length > 12000 || points.length < 4 || points.length > 25) return null;
  const geometry = driving.coordinates as Coordinate[];
  if (geometry.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n)) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) || geometryIssues(geometry).length) return null;
  const coords: Coordinate[] = points.map(p => [p.longitude, p.latitude]);
  if (coords.some(p => p.some(n => !Number.isFinite(n))) || metres(coords[0], coords[coords.length - 1]) > 10 || metres(geometry[0], geometry[geometry.length - 1]) > 40 || metres(anchor, coords[0]) > 2500 || metres(coords[0], geometry[0]) > 70 || metres(coords[coords.length - 1], geometry[geometry.length - 1]) > 70) return null;
  // Ordered waypoint coverage: a valid-looking unrelated provider polyline is not enough.
  let cursor = 0;
  for (const point of coords) {
    let nearest = -1, distance = Infinity;
    for (let i = cursor; i < geometry.length; i++) { const d = metres(point, geometry[i]); if (d < distance) { distance = d; nearest = i; } }
    if (nearest < 0 || distance > 80) return null;
    cursor = nearest;
  }
  const measured = snapshotDistance(geometry);
  if (measured <= 0 || Math.abs(measured - driving.distanceM) > Math.max(200, driving.distanceM * 0.15)) return null;
  return { version: 1, geometry, points: coords, distanceM: measured, durationSec: driving.durationSec, provider: "MAPBOX_DRIVING", measuredAt: new Date().toISOString(), observedFeatures: (driving.observedFeatures ?? []).filter((c: unknown) => ["roundabouts", "junctions", "lanes"].includes(c as string)), source: "PRIVATE_HOMETOWN_PRACTICE" };
}
