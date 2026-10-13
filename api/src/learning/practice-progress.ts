type Coordinate = [number, number];
export type PracticeSnapshot = { geometry: Coordinate[]; points: Coordinate[]; distanceM: number };
export function metres(a: Coordinate, b: Coordinate) {
  const r = Math.PI / 180, lat = (a[1] + b[1]) * r / 2;
  return Math.hypot((b[0] - a[0]) * Math.cos(lat), b[1] - a[1]) * r * 6371000;
}
export function snapshotDistance(geometry: Coordinate[]) {
  return geometry.slice(1).reduce((sum, point, i) => sum + metres(geometry[i], point), 0);
}
// Route-following only: this is not a score of driving skill or a pass/fail test.
export function trackProgress(snapshot: PracticeSnapshot, progressM: number, visited: number, current: Coordinate, accuracyM: number | undefined, elapsedSec: number) {
  if (!Number.isFinite(accuracyM) || accuracyM! > 60 || accuracyM! < 0) return { accepted: false, progressM, visited, reason: "GPS_ACCURACY" };
  let distance = 0, best = Infinity, projected = progressM;
  const maxAdvance = visited === 0 ? 150 : Math.min(2000, Math.max(100, elapsedSec * 45));
  for (let i = 1; i < snapshot.geometry.length; i++) {
    const a = snapshot.geometry[i - 1], b = snapshot.geometry[i];
    const length = metres(a, b);
    if (!length) continue;
    const scale = Math.cos(current[1] * Math.PI / 180);
    const dx = (b[0] - a[0]) * scale, dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, (((current[0] - a[0]) * scale) * dx + (current[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    const along = distance + length * t;
    const near = metres(current, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    if (along >= progressM - 80 && along <= progressM + maxAdvance && near < best) { best = near; projected = along; }
    distance += length;
  }
  if (best > Math.max(70, accuracyM! + 30)) return { accepted: false, progressM, visited, reason: "OFF_ROUTE_OR_JUMP" };
  if (visited < snapshot.points.length && metres(current, snapshot.points[visited]) <= 120) visited++;
  return { accepted: true, progressM: Math.max(progressM, projected), visited, reason: null };
}
