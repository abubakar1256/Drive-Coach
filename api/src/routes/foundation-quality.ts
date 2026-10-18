import { metres } from "../learning/practice-progress";
import type { Coordinate } from "./route-quality";

export type GeoPoint = { latitude: number; longitude: number };
export function coordinate(point: GeoPoint): Coordinate { return [point.longitude, point.latitude]; }
export function belgianCoordinate(point: GeoPoint) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && point.latitude >= 49.4 && point.latitude <= 51.6 && point.longitude >= 2.4 && point.longitude <= 6.5;
}
export function orderedCoverageIssues(geometry: Coordinate[], points: GeoPoint[]) {
  if (geometry.length < 2 || points.length < 3) return ["FOUNDATION_GEOMETRY_MISSING"];
  if (metres(geometry[0], coordinate(points[0])) > 75 || metres(geometry[geometry.length - 1], coordinate(points[points.length - 1])) > 75) return ["START_FINISH_MISMATCH"];
  let after = 0;
  for (const point of points.slice(1, -1)) {
    const p = coordinate(point), scale = Math.cos(p[1] * Math.PI / 180);
    let along = 0, closest = Infinity, chosen = -1;
    for (let i = 1; i < geometry.length; i++) {
      const a = geometry[i - 1], b = geometry[i], length = metres(a, b);
      const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1];
      const t = dx * dx + dy * dy ? Math.max(0, Math.min(1, (((p[0] - a[0]) * scale) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
      const distance = metres(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      const position = along + t * length;
      if (position > after + 20 && distance < closest) { closest = distance; chosen = position; }
      along += length;
    }
    if (closest > 60 || chosen < 0) return ["PASSAGE_POINT_NOT_VISITED_IN_ORDER"];
    after = chosen;
  }
  return [];
}
