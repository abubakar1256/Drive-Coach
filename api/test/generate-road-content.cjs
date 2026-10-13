// Bounded, read-only generation. Writes nothing to the database or filesystem.
require('reflect-metadata');
const { DrivingRouteService } = require('../dist/src/routes/driving-route.service');
const { PracticeLoopService } = require('../dist/src/routes/practice-loop.service');
const { officialCentres } = require('../dist/src/exam-centres/official-centres');
const driving = new DrivingRouteService();
const evaluate = driving.evaluate.bind(driving);
let requests = 0;
driving.evaluate = (...args) => {
  if (++requests > Number(process.argv[5] ?? 396)) return Promise.resolve({ valid: false, issues: ['ROUTING_UNAVAILABLE'], coordinates: [] });
  return evaluate(...args);
};
(async () => {
  const loops = new PracticeLoopService(driving);
  const selected = process.argv[2] ? officialCentres.filter(c => process.argv[2].split(",").includes(c.slug)) : officialCentres;
  const variant = Number(process.argv[3] ?? 0);
  for (const centre of selected) {
    try {
      let route, selectedVariant = variant;
      for (; selectedVariant <= (process.argv[4] === "range" ? 6 : variant); selectedVariant++) {
        try { route = await loops.generate(centre.latitude, centre.longitude, selectedVariant); break; } catch { if (requests >= Number(process.argv[5] ?? 396)) break; }
      }
      if (!route) throw Error("No qualifying route");
      process.stdout.write(JSON.stringify({ centreSlug: centre.slug, variant: selectedVariant, checkedAt: new Date().toISOString(), durationSec: route.durationSec, distanceM: route.distanceM, points: route.snappedPoints }) + '\n');
    } catch { process.stdout.write(JSON.stringify({ centreSlug: centre.slug, failed: true }) + '\n'); }
  }
  process.stdout.write(JSON.stringify({ summary: true, requests }) + '\n');
})().catch(() => { process.stderr.write('Road-content diagnostic failed\n'); process.exitCode = 1; });
