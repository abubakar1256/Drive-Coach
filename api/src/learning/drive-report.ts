import { metres, type PracticeSnapshot } from "./practice-progress";

export const reviewItems = ["mirrors", "blind_spots", "signals", "lane_position", "junctions", "roundabouts", "priority", "speed_choice", "following_distance", "vulnerable_users", "parking", "vehicle_control"] as const;
export type DriveReview = { source: "self" | "instructor_reported"; ratings: Record<string, "good" | "practice" | "not_assessed">; notes: string; savedAt?: string };
type Sample = { latitude: number; longitude: number; accuracyM: number | null; speedKph: number | null; recordedAt: Date | string };
export function routeDistanceM(geometry: number[][], point: [number, number]) {
  let best = Infinity;
  const scale = Math.cos(point[1] * Math.PI / 180);
  for (let i = 1; i < geometry.length; i++) {
    const a = geometry[i - 1], b = geometry[i], dx = (b[0] - a[0]) * scale, dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, (((point[0] - a[0]) * scale) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const x = (point[0] - a[0] - (b[0] - a[0]) * t) * scale, y = point[1] - a[1] - (b[1] - a[1]) * t;
    best = Math.min(best, x * x + y * y);
  }
  return Math.sqrt(best) * Math.PI / 180 * 6371000;
}
export function gpsObservation(snapshot: PracticeSnapshot, sample: Sample) {
  if (sample.accuracyM === null || !Number.isFinite(sample.accuracyM) || sample.accuracyM < 0 || sample.accuracyM > 35) return { status: "weak_signal", confidence: "low", distanceFromRouteM: null };
  if (snapshot.geometry.length < 2) return { status: "unavailable", confidence: "low", distanceFromRouteM: null };
  const distance = routeDistanceM(snapshot.geometry, [sample.longitude, sample.latitude]);
  return { status: distance > Math.max(50, sample.accuracyM * 2) ? "possible_deviation" : "near_route", confidence: "medium", distanceFromRouteM: Math.round(distance) };
}

// Observations, never traffic-law violations or an examiner's driving score.
export function buildDriveReport(session: { startedAt: Date | string; completedAt: Date | string | null; completionPct: number; visitedPoints: number; routeSnapshot: unknown }, samples: Sample[], now = Date.now()) {
  const snapshot = session.routeSnapshot as (PracticeSnapshot & { coachingReview?: DriveReview }) | null;
  const points = snapshot?.points ?? [], geometry = snapshot?.geometry ?? [];
  const events: Array<{ kind: string; at: string; latitude: number; longitude: number; confidence: string; detail: string; tip: string }> = [];
  let distanceM = 0, coveredSec = 0, gaps = 0, weakSamples = 0, usableSamples = 0, maxSpeedKph: number | null = null;
  let previous: Sample | null = null, offStart: Sample | null = null, offCount = 0, deviationOpen = false;
  let distanceAnchor: Sample | null = null;
  let segment = 0;
  const trace: Array<{ longitude: number; latitude: number; at: Date | string; segment: number }> = [];
  const start = new Date(session.startedAt).getTime(), end = session.completedAt ? new Date(session.completedAt).getTime() : now;
  for (const sample of samples) {
    const at = new Date(sample.recordedAt).getTime();
    const observation = snapshot ? gpsObservation(snapshot, sample) : { status: "unavailable" };
    const delta = previous ? (at - new Date(previous.recordedAt).getTime()) / 1000 : 0;
    const movement = previous ? metres([previous.longitude, previous.latitude], [sample.longitude, sample.latitude]) : 0;
    const jump = delta > 0 && movement / delta > 55;
    const continuous = previous && delta > 0 && delta <= 30 && !jump && previous.accuracyM !== null && previous.accuracyM >= 0 && previous.accuracyM <= 35;
    if (previous && (delta > 30 || jump)) gaps++;
    if (observation.status === "weak_signal" || observation.status === "unavailable" || jump) {
      weakSamples++; offStart = null; offCount = 0; deviationOpen = false; distanceAnchor = null;
    } else {
      usableSamples++;
      if (!continuous) segment++;
      trace.push({ longitude: sample.longitude, latitude: sample.latitude, at: sample.recordedAt, segment });
      if (!continuous) distanceAnchor = null;
      if (continuous) {
        coveredSec += delta;
        if (distanceAnchor) {
          const advance = metres([distanceAnchor.longitude, distanceAnchor.latitude], [sample.longitude, sample.latitude]);
          if (advance > Math.max(5, sample.accuracyM ?? 0, distanceAnchor.accuracyM ?? 0)) { distanceM += advance; distanceAnchor = sample; }
        }
      }
      distanceAnchor ??= sample;
      if (sample.speedKph !== null && Number.isFinite(sample.speedKph) && sample.speedKph >= 0 && sample.speedKph <= 200) maxSpeedKph = Math.max(maxSpeedKph ?? 0, sample.speedKph);
      if (observation.status === "possible_deviation") {
        if (!continuous) { offStart = null; offCount = 0; deviationOpen = false; }
        offStart ??= sample; offCount++;
        if (!deviationOpen && offCount >= 3 && at - new Date(offStart.recordedAt).getTime() >= 5000) {
          events.push({ kind: "possible_deviation", at: new Date(offStart.recordedAt).toISOString(), latitude: offStart.latitude, longitude: offStart.longitude, confidence: "medium", detail: "Several accurate GPS samples were away from the saved route. This is not proof of a driving mistake.", tip: "When safely parked, review the route with your instructor. Follow current signs, road closures and safe directions first." }); deviationOpen = true;
        }
      } else { offStart = null; offCount = 0; deviationOpen = false; }
    }
    previous = sample;
  }
  const durationSec = Math.max(0, Math.floor((end - start) / 1000));
  const coveragePct = durationSec ? Math.min(100, Math.round(coveredSec / durationSec * 100)) : 0;
  const visitedPoints = Math.min(points.length, Math.max(0, session.visitedPoints));
  return { version: 1, ended: Boolean(session.completedAt), startedAt: session.startedAt, completedAt: session.completedAt, durationSec, completionPct: session.completionPct,
    gps: { sampleCount: samples.length, usableSamples, weakSamples, gaps, coveragePct, distanceM: Math.round(distanceM), maxSpeedKph: maxSpeedKph === null ? null : Math.round(maxSpeedKph), confidence: usableSamples >= 10 && coveragePct >= 70 ? "medium" : "low" },
    points: { total: points.length, visited: visitedPoints, unconfirmed: points.length - visitedPoints },
    events, review: snapshot?.coachingReview ?? null,
    geometry: geometry.filter((_, i) => i % Math.max(1, Math.ceil(geometry.length / 800)) === 0 || i === geometry.length - 1),
    track: trace.filter((p, i) => i % Math.max(1, Math.ceil(trace.length / 800)) === 0 || i === trace.length - 1 || trace[i - 1]?.segment !== p.segment),
    limitations: ["GPS coverage can stop when Google Maps opens, the browser is backgrounded or the screen locks.", "Unconfirmed points are not necessarily missed: GPS gaps or stopping early can explain them.", "Recorded distance is approximate; weak samples, gaps and movement within GPS uncertainty are excluded, so distance may be understated.", "Speed is an estimate, not a verified speed-limit check. Overspeed, braking, acceleration, mirrors, signals and right-of-way are not automatically assessed.", "Instructor-reported feedback is entered by the account holder, not independently authenticated. No official pass/fail score."] };
}
