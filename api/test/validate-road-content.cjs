require('reflect-metadata');
const { DrivingRouteService } = require('../dist/src/routes/driving-route.service');
const bundle = require('../prisma/data/road-practice-loops.json');
(async () => {
  const driving = new DrivingRouteService(); let passed = 0;
  for (const item of bundle.routes) {
    const checked = await driving.evaluate(item.points);
    const valid = checked.valid && checked.durationSec >= 1440 && checked.durationSec <= 3600;
    if (valid) passed++;
    process.stdout.write(JSON.stringify({ centre: item.centreSlug, valid, issues: checked.issues, minutes: checked.durationSec ? +(checked.durationSec / 60).toFixed(1) : null }) + '\n');
  }
  console.log(JSON.stringify({ summary: true, passed, total: bundle.routes.length }));
  if (passed !== bundle.routes.length) process.exitCode = 1;
})().catch(() => { console.error('Read-only validation failed'); process.exitCode = 1; });
