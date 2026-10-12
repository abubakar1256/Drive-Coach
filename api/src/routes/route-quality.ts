export type Coordinate = [number, number];
export const MIN_DRIVING_SECONDS = 24 * 60;

const key = (p: Coordinate) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
const cross = (a: Coordinate, b: Coordinate, c: Coordinate) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

// Conservative 2D screening, not proof of an unsafe junction: a bridge or tunnel
// can cross geometrically too. Such routes require a revised/reviewed sequence.
export function geometryIssues(input: Coordinate[]): string[] {
  const points = input.filter((p, i) => !i || key(p) !== key(input[i - 1]));
  const nodes = new Map<string, number>();
  const edges = new Set<string>();
  const segments: Array<{ a: Coordinate; b: Coordinate; index: number; minX: number; maxX: number; minY: number; maxY: number }> = [];
  for (let i = 0; i < points.length; i++) {
    const node = key(points[i]);
    const earlier = nodes.get(node);
    if (earlier !== undefined && !(earlier === 0 && i === points.length - 1)) return ["REVISITED_ROAD"];
    nodes.set(node, i);
    if (!i) continue;
    const a = points[i - 1], b = points[i];
    const edge = [key(a), key(b)].sort().join("|");
    if (edges.has(edge)) return ["BACKTRACKING"];
    edges.add(edge);
    segments.push({ a, b, index: i, minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minY: Math.min(a[1], b[1]), maxY: Math.max(a[1], b[1]) });
  }
  segments.sort((a, b) => a.minX - b.minX);
  for (let i = 0; i < segments.length; i++) {
    const a = segments[i];
    for (let j = i + 1; j < segments.length && segments[j].minX <= a.maxX; j++) {
      const b = segments[j];
      if (Math.abs(a.index - b.index) <= 1 || a.maxY < b.minY || b.maxY < a.minY) continue;
      if (Math.abs(cross(a.a, a.b, b.a)) < 1e-14 && Math.abs(cross(a.a, a.b, b.b)) < 1e-14) {
        const axis = Math.abs(a.b[0] - a.a[0]) >= Math.abs(a.b[1] - a.a[1]) ? 0 : 1;
        const overlap = Math.min(Math.max(a.a[axis], a.b[axis]), Math.max(b.a[axis], b.b[axis])) - Math.max(Math.min(a.a[axis], a.b[axis]), Math.min(b.a[axis], b.b[axis]));
        if (overlap > 1e-7) return ["BACKTRACKING"];
      }
      if (cross(a.a, a.b, b.a) * cross(a.a, a.b, b.b) < 0 && cross(b.a, b.b, a.a) * cross(b.a, b.b, a.b) < 0) return ["SELF_CROSSING"];
    }
  }
  return [];
}
