// Explicit, bounded content preparation only. No database writes or auto-deploy jobs.
require("reflect-metadata");
const { DrivingRouteService } = require("../dist/src/routes/driving-route.service");
const { PracticeLoopService } = require("../dist/src/routes/practice-loop.service");
const { officialCentres } = require("../dist/src/exam-centres/official-centres");
const starter = require("../prisma/data/road-practice-loops.json");

function roadCells(coordinates) {
  const cells = new Set();
  // Interpolate every segment, so vertex density does not determine similarity.
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1], b = coordinates[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .00025));
    for (let j = 0; j <= steps; j++) cells.add(`${Math.round((a[0] + (b[0] - a[0]) * j / steps) * 2000)},${Math.round((a[1] + (b[1] - a[1]) * j / steps) * 2000)}`);
  }
  return cells;
}
function similarRoads(a, b) {
  const first = roadCells(a), second = roadCells(b);
  if (!first.size || !second.size) return false;
  let common = 0; for (const cell of first) if (second.has(cell)) common++;
  return common / Math.min(first.size, second.size) >= .85;
}

async function main() {
  const maxRequests = 512; // Hard per-run cap, never an unbounded search.
  let requests = 0, stopReason = null;
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith("https://api.mapbox.com/directions/")) {
      if (stopReason || requests >= maxRequests) { stopReason ??= "REQUEST_BUDGET_REACHED"; throw Error("Routing budget exhausted"); }
      requests++;
      const response = await originalFetch(url, options);
      if ([401, 402, 403, 429].includes(response.status)) stopReason = `PROVIDER_LIMIT_OR_ACCESS_${response.status}`;
      return response;
    }
    return originalFetch(url, options);
  };
  const driving = new DrivingRouteService(), loops = new PracticeLoopService(driving);
  const centres = [];
  const emit = data => console.log(JSON.stringify(data));
  try {
    for (const centre of officialCentres) {
      if (stopReason) break;
      const seed = starter.routes.find(r => r.centreSlug === centre.slug);
      const checked = seed && await driving.evaluate(seed.points);
      const state = { centre, routes: [], geometries: [], seedVariant: seed?.variant ?? 0 };
      if (checked?.valid && checked.durationSec <= 3600) {
        const route = { ...seed, slot: 1, checkedAt: new Date().toISOString(), durationSec: checked.durationSec, distanceM: checked.distanceM };
        state.routes.push(route); state.geometries.push(checked.coordinates); emit({ type: "route", route });
      }
      centres.push(state);
      emit({ type: "progress", centre: centre.name, routes: state.routes.length, requests });
    }
    // Fair round-robin search gives every centre a chance before the cap.
    for (let round = 1; round <= 6 && !stopReason; round++) {
      for (const state of centres) {
        if (stopReason) break;
        if (state.routes.length >= 7) continue;
        const variant = (state.seedVariant + round) % 7;
        try {
          const result = await loops.generate(state.centre.latitude, state.centre.longitude, variant);
          if (state.geometries.some(g => similarRoads(g, result.coordinates))) {
            emit({ type: "progress", centre: state.centre.name, routes: state.routes.length, result: "SIMILAR_ROUTE_REJECTED", requests }); continue;
          }
          const route = { centreSlug: state.centre.slug, slot: state.routes.length + 1, variant, checkedAt: new Date().toISOString(), durationSec: result.durationSec, distanceM: result.distanceM, points: result.snappedPoints };
          state.routes.push(route); state.geometries.push(result.coordinates); emit({ type: "route", route });
        } catch { /* No qualifying road loop: do not invent or publish one. */ }
        emit({ type: "progress", centre: state.centre.name, routes: state.routes.length, variant, requests });
      }
    }
    emit({ type: "summary", requests, maxRequests, stopReason, counts: centres.map(s => ({ slug: s.centre.slug, routes: s.routes.length })), totalRoutes: centres.reduce((n, s) => n + s.routes.length, 0) });
  } finally { global.fetch = originalFetch; }
}
module.exports = { similarRoads };
if (require.main === module) main().catch(() => { console.error("Road catalogue preparation stopped; no database writes were made."); process.exitCode = 1; });
