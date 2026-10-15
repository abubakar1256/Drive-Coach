// Explicit bounded preparation only: no database writes, publication or deployment.
require('reflect-metadata');
const fs = require('node:fs');
const path = require('node:path');
const { DrivingRouteService } = require('../dist/src/routes/driving-route.service');
const { PracticeLoopService } = require('../dist/src/routes/practice-loop.service');
const { officialCentres } = require('../dist/src/exam-centres/official-centres');
const { similarRoads } = require('./build-road-catalog.cjs');
const starter = require('../prisma/data/road-practice-loops.json');
const extras = require('../prisma/data/road-practice-catalog.json');

const inWindow = result => result?.valid === true && Number.isFinite(result.durationSec) && result.durationSec >= 1440 && result.durationSec <= 1800;
const identity = item => `${item.centreSlug}:${item.slot ?? 1}`;
const closedAtMeetingPoint = points => Array.isArray(points) && points.length >= 2 && points[0].latitude === points.at(-1).latitude && points[0].longitude === points.at(-1).longitude;

function shorterCandidates(item) {
  if (!Number.isFinite(item.durationSec) || item.durationSec <= 1800 || item.points.length < 5) return [];
  const base = Math.round((item.points.length - 1) * 1620 / item.durationSec);
  const cuts = [...new Set([base, base + 2, base - 2].map(n => Math.max(2, Math.min(item.points.length - 2, n))))];
  // Reuse actual road anchors, not scaled coordinates. The closing road path is
  // unknown until Directions validates it; a shortcut can still fail the quality gates.
  return cuts.map(cut => [...item.points.slice(0, cut + 1), item.points[0]].map((point, index) => index === 0 || index === cut + 1 ? {...point, bearing: null} : point));
}

function validateCompleteBundle(bundle, expected) {
  const wanted = new Set(expected.map(identity));
  const seen = new Set();
  if (bundle.status !== 'PREPARED_REQUIRES_IMPORT_REVALIDATION' || bundle.pending?.length || bundle.routes?.length !== wanted.size) throw Error('Complete, fresh-checked catalogue required');
  for (const route of bundle.routes) {
    const id = identity(route);
    if (!wanted.has(id) || seen.has(id) || !inWindow({valid: true, durationSec: route.durationSec})) throw Error('Invalid route identity or duration');
    seen.add(id);
    if (!Array.isArray(route.points) || route.points.length < 2 || route.points.length > 25 || route.points.some(p => !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180)) throw Error('Invalid road anchors');
    if (!closedAtMeetingPoint(route.points)) throw Error('Route must close at its practice meeting point');
    const checked = Date.parse(route.checkedAt);
    if (!Number.isFinite(checked) || checked > Date.now() + 120000 || Date.now() - checked > 86400000) throw Error('Revalidate stale prepared route before export');
  }
  return true;
}

function exportPrepared() {
  const checkpoint = path.resolve(__dirname, '../../output/chatbot-audit/short-routes/prepared.json');
  const bundle = JSON.parse(fs.readFileSync(checkpoint, 'utf8'));
  const expected = [...starter.routes.map(item => ({...item, slot: 1})), ...extras.routes];
  validateCompleteBundle(bundle, expected);
  const target = path.resolve(__dirname, '../prisma/data/road-practice-short-prepared.json');
  // Generated data asset, not application seeding. Refuse to overwrite an
  // existing reviewed export; importing/replacing live rows is a separate step.
  fs.writeFileSync(target, JSON.stringify({...bundle, routes: [...bundle.routes].sort((a, b) => a.centreSlug.localeCompare(b.centreSlug) || a.slot - b.slot)}, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({exported: bundle.routes.length, target, published: false}));
}

async function main() {
  const maxRequests = Number(process.argv[2] ?? 256);
  const shortenOnly = process.argv[3] === 'shorten';
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 512) throw Error('Request budget must be 1–512');
  const output = path.resolve(__dirname, '../../output/chatbot-audit/short-routes');
  fs.mkdirSync(output, {recursive: true});
  const checkpoint = path.join(output, 'prepared.json');
  // Keep the last prepared data recoverable if the next provider check fails.
  if (fs.existsSync(checkpoint)) fs.copyFileSync(checkpoint, path.join(output, `prepared-before-${Date.now()}.json`));
  const expected = [...starter.routes.map(item => ({...item, slot: 1})), ...extras.routes];
  const prepared = [], geometries = new Map();
  const previous = fs.existsSync(checkpoint) ? JSON.parse(fs.readFileSync(checkpoint, 'utf8')) : {};
  const prior = previous.routes ?? [];
  const startRound = previous.nextSearchRound ?? 1;
  const startCentre = previous.nextCentreIndex ?? 0;
  let nextSearchRound = startRound;
  let nextCentreIndex = startCentre;
  const issueCounts = {};
  let requests = 0, stopReason = null;
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (!String(url).startsWith('https://api.mapbox.com/directions/')) throw Error('Unexpected provider');
    if (stopReason || requests >= maxRequests) {stopReason ??= 'REQUEST_BUDGET_REACHED'; throw Error('Budget exhausted');}
    requests++;
    const response = await originalFetch(url, options);
    if ([401, 402, 403, 429].includes(response.status)) stopReason = `PROVIDER_LIMIT_OR_ACCESS_${response.status}`;
    return response;
  };
  const driving = new DrivingRouteService(), loops = new PracticeLoopService(driving);
  const evaluate = driving.evaluate.bind(driving);
  driving.evaluate = async (...args) => {
    const result = await evaluate(...args);
    for (const issue of result.issues) issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
    return result;
  };
  const known = new Map(expected.map(item => [identity(item), item]));
  const save = () => {
    const missing = expected.filter(item => !prepared.some(route => identity(route) === identity(item))).map(item => ({centreSlug: item.centreSlug, slot: item.slot}));
    const report = {status: missing.length ? 'PARTIAL_NOT_FOR_PUBLICATION' : 'PREPARED_REQUIRES_IMPORT_REVALIDATION', instructorApproved: false, disclaimer: 'Road-network practice, not official examiner routes. Nothing has been published by this script.', minSeconds: 1440, maxSeconds: 1800, preparedAt: new Date().toISOString(), requests, maxRequests, stopReason, nextSearchRound, nextCentreIndex, issueCounts, routes: prepared, pending: missing};
    fs.writeFileSync(`${checkpoint}.tmp`, JSON.stringify(report, null, 2) + '\n');
    fs.renameSync(`${checkpoint}.tmp`, checkpoint);
    return report;
  };
  async function accept(item, result, mode) {
    if (!inWindow(result) || !result.coordinates.length) return false;
    const points = mode === 'generated' ? result.snappedPoints : item.points;
    if (!closedAtMeetingPoint(points)) {issueCounts.MEETING_POINT_MISMATCH = (issueCounts.MEETING_POINT_MISMATCH ?? 0) + 1; return false;}
    const existing = geometries.get(item.centreSlug) ?? [];
    if (existing.some(geometry => similarRoads(geometry, result.coordinates))) return false;
    prepared.push({...item, points, checkedAt: new Date().toISOString(), durationSec: result.durationSec, distanceM: result.distanceM});
    geometries.set(item.centreSlug, [...existing, result.coordinates]);
    save();
    console.log(JSON.stringify({type: 'ready', centreSlug: item.centreSlug, slot: item.slot, minutes: +(result.durationSec / 60).toFixed(2), mode, requests}));
    return true;
  }
  try {
    // Revalidate existing short routes and prior checkpoints; never trust rounded labels.
    const candidates = [...prior.filter(item => known.has(identity(item))), ...expected.filter(item => item.durationSec >= 1440 && item.durationSec <= 1800)];
    for (const item of candidates) {
      if (stopReason) break;
      if (prepared.some(route => identity(route) === identity(item))) continue;
      const result = await driving.evaluate(item.points);
      await accept({...known.get(identity(item)), ...item}, result, 'retained');
    }
    if (shortenOnly) {
      // One candidate per missing route before trying alternatives. All data is
      // fresh checked; no existing duration is relabelled or scaled.
      for (let round = 0; round < 3 && !stopReason; round++) {
        for (const item of expected) {
          if (stopReason) break;
          if (prepared.some(route => identity(route) === identity(item))) continue;
          const candidate = shorterCandidates(item)[round];
          if (!candidate) continue;
          const result = await driving.evaluate(candidate);
          await accept({...item, points: candidate}, result, 'shortened');
        }
      }
    }
    // One missing slot per centre per round; longer centres cannot consume the whole budget first.
    for (let round = startRound; !shortenOnly && round < startRound + 14 && !stopReason; round++) {
      for (let centreIndex = round === startRound ? startCentre : 0; centreIndex < officialCentres.length; centreIndex++) {
        if (stopReason) break;
        const centre = officialCentres[centreIndex];
        nextCentreIndex = (centreIndex + 1) % officialCentres.length;
        nextSearchRound = nextCentreIndex === 0 ? round + 1 : round;
        const item = expected.find(item => item.centreSlug === centre.slug && !prepared.some(route => identity(route) === identity(item)));
        if (!item) continue;
        const variant = (item.variant ?? 0) + round + 7;
        try {
          const result = await loops.generate(centre.latitude, centre.longitude, variant);
          await accept({...item, variant}, result, 'generated');
        } catch { /* Keep the pending identity; never replace it with invalid geometry. */ }
        console.log(JSON.stringify({type: 'progress', centreSlug: centre.slug, slot: item.slot, requests, ready: prepared.length}));
      }
    }
  } finally {
    global.fetch = originalFetch;
    const report = save();
    console.log(JSON.stringify({type: 'summary', ready: prepared.length, pending: report.pending.length, requests, maxRequests, stopReason, issueCounts, checkpoint}));
  }
}
module.exports = {inWindow, identity, shorterCandidates, validateCompleteBundle};
if (require.main === module) {
  if (process.argv[2] === '--export-prepared') {
    try { exportPrepared(); } catch (error) { console.error(`Export refused: ${error.message}`); process.exitCode = 1; }
  } else main().catch(() => { console.error('Preparation stopped; existing database routes were not changed.'); process.exitCode = 1; });
}
