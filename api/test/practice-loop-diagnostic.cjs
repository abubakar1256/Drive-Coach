require("reflect-metadata");
const { DrivingRouteService } = require("../dist/src/routes/driving-route.service");
const { PracticeLoopService } = require("../dist/src/routes/practice-loop.service");
const { loopCandidates, simpleRoadCycles, cycleWaypoints } = require("../dist/src/routes/practice-loop.service");
const { snapshotDistance } = require("../dist/src/learning/practice-progress");
const { officialCentres } = require("../dist/src/exam-centres/official-centres");
// Read-only provider diagnostic. No DB writes, tokens or request URLs in output.
const centre = officialCentres.find(c => c.slug === process.argv[2]);
if (!centre) throw Error("Supply an existing centre slug");
if (process.argv.includes("--inspect")) {
  const driving = new DrivingRouteService(); driving.evaluate(loopCandidates(centre.latitude, centre.longitude, Number(process.argv[3] ?? 0))[0], 1000).then(async result => {
    const cycle = simpleRoadCycles(result.coordinates)[0];
    const shaped = cycle ? await driving.evaluate(cycleWaypoints(cycle, [centre.longitude, centre.latitude])) : null;
    process.stdout.write(JSON.stringify({ shaped: shaped ? { issues: shaped.issues, durationSec: shaped.durationSec, snapped: shaped.snappedPoints?.length } : null, issues: result.issues, durationSec: result.durationSec, geometryPoints: result.coordinates.length, waypointCount: result.snappedPoints?.length, cycleDistances: simpleRoadCycles(result.coordinates).slice(0, 6).map(snapshotDistance) }) + "\n");
  }).catch(() => { process.exitCode = 1; });
} else {
new PracticeLoopService(new DrivingRouteService()).generate(centre.latitude, centre.longitude, Number(process.argv[3] ?? 0)).then(result => {
  process.stdout.write(JSON.stringify({ centre: centre.slug, valid: result.valid, durationSec: result.durationSec, distanceM: result.distanceM, pointCount: result.snappedPoints.length, issueCount: result.issues.length }) + "\n");
}).catch(error => { process.stdout.write(JSON.stringify({ centre: centre.slug, success: false, message: error.getResponse?.().message ?? "Road provider diagnostic failed" }) + "\n"); process.exitCode = 1; });
}
