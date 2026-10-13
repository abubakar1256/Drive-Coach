import { BadRequestException, Injectable } from "@nestjs/common";
import { DrivingRouteService } from "./driving-route.service";
import { metres } from "../learning/practice-progress";
import { geometryIssues } from "./route-quality";

export function simpleRoadCycles(geometry: [number, number][]) {
  const stack: [number, number][] = [], positions = new Map<string, number>(), cycles: [number, number][][] = [];
  const key = (p: [number, number]) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  for (const point of geometry) {
    const at = positions.get(key(point));
    if (at !== undefined) {
      const cycle = [...stack.slice(at), point];
      if (cycle.length > 3 && !geometryIssues(cycle).length) cycles.push(cycle);
      for (const removed of stack.splice(at + 1)) positions.delete(key(removed));
    } else { positions.set(key(point), stack.length); stack.push(point); }
  }
  const length = (c: [number, number][]) => c.slice(1).reduce((sum, p, i) => sum + metres(c[i], p), 0);
  return cycles.sort((a, b) => length(b) - length(a));
}

export function cycleWaypoints(cycle: [number, number][], origin: [number, number]) {
  // A legal road geometry supplies every anchor. Do not fabricate coordinates
  // or turn instructions. The provider must revalidate the resulting cycle.
  let start = 0;
  for (let i = 1; i < cycle.length - 1; i++) if (metres(origin, cycle[i]) < metres(origin, cycle[start])) start = i;
  const rotated = [...cycle.slice(start, -1), ...cycle.slice(0, start)];
  const closed = [...rotated, rotated[0]];
  // Preserve the bends that define the road loop. Equal-distance sampling can
  // omit a decisive corner and send fastest-path routing back across the loop.
  const indexes = [0, closed.length - 1];
  while (indexes.length < Math.min(25, closed.length)) {
    let best = -1, deviation = 0;
    for (let segment = 1; segment < indexes.length; segment++) {
      const from = indexes[segment - 1], to = indexes[segment];
      const a = closed[from], b = closed[to];
      const scale = Math.cos(a[1] * Math.PI / 180);
      const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1];
      for (let i = from + 1; i < to; i++) {
        const px = (closed[i][0] - a[0]) * scale, py = closed[i][1] - a[1];
        const t = dx * dx + dy * dy ? Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy))) : 0;
        const distance = Math.hypot(px - t * dx, py - t * dy);
        if (distance > deviation) { deviation = distance; best = i; }
      }
    }
    if (best < 0 || deviation < 0.00001) break;
    indexes.push(best); indexes.sort((a, b) => a - b);
  }
  return indexes.map(index => { const p = closed[index], next = closed[index + 1] ?? closed[1]; const bearing = (Math.atan2((next[0] - p[0]) * Math.cos(p[1] * Math.PI / 180), next[1] - p[1]) * 180 / Math.PI + 360) % 360; return { latitude: p[1], longitude: p[0], name: "Road-network waypoint", bearing }; });
}

export function removeSharedAccessStem(geometry: [number, number][], points: Array<{ latitude: number; longitude: number; name: string; bearing?: number | null }>) {
  let index = 0;
  while (index + 1 < geometry.length / 2 && metres(geometry[index], geometry[geometry.length - 1 - index]) < 2 && metres(geometry[0], geometry[index + 1]) <= 1000) index++;
  if (index <= 1) return points;
  const meeting = geometry[index - 1];
  return points.map((p, i) => i === 0 || i === points.length - 1 ? { latitude: meeting[1], longitude: meeting[0], name: "Practice meeting point at loop junction" } : p);
}

export function loopCandidates(latitude: number, longitude: number, variant = 0) {
  // These are search anchors only. Never save/display them as real road points.
  // Only a successful road-network response's snapped waypoints are persisted.
  return [3000, 4500, 6000, 7500, 9000, 10500].map((radius, index) => {
    const rotation = (variant * 51 + index * 17) * Math.PI / 180;
    const points = [{ latitude, longitude }];
    // Keep the meeting point on the perimeter, rather than forcing a trip from
    // the centre of a circle across the same radial roads twice.
    for (const [forward, lateral] of [[1, 1], [2, 0], [1, -1]]) {
      const north = (Math.sin(rotation) * forward + Math.cos(rotation) * lateral) * radius;
      const east = (Math.cos(rotation) * forward - Math.sin(rotation) * lateral) * radius;
      points.push({ latitude: latitude + north / 111320, longitude: longitude + east / (111320 * Math.cos(latitude * Math.PI / 180)) });
    }
    points.push({ latitude, longitude });
    return points;
  });
}
@Injectable()
export class PracticeLoopService {
  constructor(private readonly driving: DrivingRouteService) {}
  async generate(latitude: number, longitude: number, variant = 0) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new BadRequestException("Centre map anchor required");
    let issues: string[] = [];
    for (const candidate of loopCandidates(latitude, longitude, variant)) {
      const result = await this.driving.evaluate(candidate, 1000);
      issues = result.issues;
      if (issues.some(i => ["ROUTING_NOT_CONFIGURED", "ROUTING_UNAVAILABLE"].includes(i))) break;
      if (!result.snappedPoints || !result.coordinates.length || result.durationSec! < 1440) continue;
      // Recheck the exact saved snapped points with the ordinary route policy.
      const cycles = result.valid ? [] : simpleRoadCycles(result.coordinates);
      const snappedPoints = cycles.length ? cycleWaypoints(cycles[0], [longitude, latitude]) : removeSharedAccessStem(result.coordinates, result.snappedPoints);
      const checked = await this.driving.evaluate(snappedPoints);
      if (checked.valid && checked.durationSec! <= 3600) return { ...checked, snappedPoints };
      issues = checked.issues;
    }
    throw new BadRequestException({ message: `No compliant loop found within the bounded search: ${issues.join(", ")}. No route was fabricated or published. Try another starting point/variant.`, issues });
  }
}
