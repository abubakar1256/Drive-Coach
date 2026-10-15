require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { PracticeLoopService, loopCandidates, cycleWaypoints } = require('../dist/src/routes/practice-loop.service');
const { inWindow, identity, shorterCandidates, validateCompleteBundle } = require('../scripts/prepare-short-road-catalog.cjs');
const square = [[5, 50], [5.01, 50], [5.01, 50.01], [5, 50.01], [5, 50]];
const points = square.map(([longitude, latitude]) => ({longitude, latitude, name: 'Checked road'}));

test('24–30 minute preparation checks exact seconds and provider validity', () => {
  for (const durationSec of [1440, 1550.1, 1800]) assert.equal(inWindow({valid: true, durationSec}), true);
  for (const durationSec of [1439.999, 1800.001, 3600, null, NaN, Infinity]) assert.equal(inWindow({valid: true, durationSec}), false);
  assert.equal(inWindow({valid: false, durationSec: 1500}), false);
});
test('replacement identities preserve centre and route slot, not duration-based ordering', () => {
  assert.equal(identity({centreSlug: 'alken'}), 'alken:1');
  assert.equal(identity({centreSlug: 'alken', slot: 2}), 'alken:2');
});
test('search radius can be smaller without changing centre origin or closure', () => {
  const candidates = loopCandidates(50, 5, 0, [1800, 2400]);
  assert.equal(candidates.length, 2);
  for (const candidate of candidates) {assert.deepEqual(candidate[0], {latitude: 50, longitude: 5}); assert.deepEqual(candidate.at(-1), candidate[0]);}
});
test('generator accepts the exact 24 and 30 minute boundaries after saved-anchor recheck', async () => {
  for (const durationSec of [1440, 1800]) {
    let calls = 0;
    const service = new PracticeLoopService({evaluate: async () => {calls++; return {valid: true, issues: [], durationSec, distanceM: 14000, coordinates: square, snappedPoints: points};}});
    const result = await service.generate(50, 5);
    assert.equal(result.durationSec, durationSec); assert.equal(calls, 2);
  }
});
test('generator never returns a 30m01s loop or rounds a short route up to 24', async () => {
  for (const durationSec of [1439.9, 1800.01, 3600]) {
    const service = new PracticeLoopService({evaluate: async () => ({valid: true, issues: [], durationSec, distanceM: 14000, coordinates: square, snappedPoints: points})});
    await assert.rejects(service.generate(50, 5), /No compliant loop/);
  }
});
test('provider unavailable stops search rather than fabricating a short route', async () => {
  let calls = 0;
  const service = new PracticeLoopService({evaluate: async () => {calls++; return {valid: false, issues: ['ROUTING_UNAVAILABLE'], coordinates: []};}});
  await assert.rejects(service.generate(50, 5)); assert.equal(calls, 1);
});
test('shortening candidates reuse original road anchors and require independent validation', () => {
  const source = Array.from({length: 25}, (_, i) => ({latitude: 50 + i / 1000, longitude: 5 + i / 1000, bearing: 80, name: 'Original road'}));
  const candidates = shorterCandidates({points: source, durationSec: 3000});
  assert.equal(candidates.length, 3);
  for (const candidate of candidates) {
    assert.deepEqual(candidate[0], candidate.at(-1));
    assert.equal(candidate[0].bearing, null);
    assert.ok(candidate.length < source.length);
    for (const point of candidate) assert.ok(source.some(p => p.latitude === point.latitude && p.longitude === point.longitude));
  }
  assert.deepEqual(shorterCandidates({points: source, durationSec: 1800}), []);
});
test('adaptive search adjusts only search anchors, then saves independently checked road points', async () => {
  const calls = [];
  const service = new PracticeLoopService({evaluate: async (candidate, snapRadius) => {
    calls.push({candidate, snapRadius});
    return {valid: true, issues: [], durationSec: calls.length <= 2 ? 3000 : 1600, distanceM: 14000, coordinates: square, snappedPoints: points};
  }});
  const result = await service.generate(50, 5);
  assert.equal(calls.length, 4);
  assert.notDeepEqual(calls[2].candidate, calls[0].candidate);
  assert.equal(calls[2].snapRadius, 1000);
  assert.deepEqual(calls[3].candidate, points);
  assert.deepEqual(result.snappedPoints, points);
  assert.equal(result.durationSec, 1600);
});
test('adaptive search remains bounded when no route fits the window', async () => {
  let calls = 0;
  const service = new PracticeLoopService({evaluate: async () => {calls++; return {valid: true, issues: [], durationSec: 3000, distanceM: 20000, coordinates: square, snappedPoints: points};}});
  await assert.rejects(service.generate(50, 5));
  assert.ok(calls <= 28);
});
test('closed loop finish follows incoming road heading, not outgoing first-leg heading', () => {
  const points = cycleWaypoints(square, square[0]);
  assert.equal(points[0].bearing, 90);
  assert.equal(points.at(-1).bearing, 180);
  assert.equal(points.at(-1).latitude, points[0].latitude);
  assert.equal(points.at(-1).longitude, points[0].longitude);
});
test('export gate rejects partial, duplicated, stale or out-of-window bundles', () => {
  const route = {centreSlug: 'alken', slot: 1, durationSec: 1500, checkedAt: new Date().toISOString(), points};
  const bundle = {status: 'PREPARED_REQUIRES_IMPORT_REVALIDATION', pending: [], routes: [route]};
  assert.equal(validateCompleteBundle(bundle, [route]), true);
  assert.throws(() => validateCompleteBundle({...bundle, pending: [{centreSlug: 'other', slot: 1}]}, [route]));
  for (const changed of [{durationSec: 1800.1}, {checkedAt: '2020-01-01'}, {points: points.slice(0, -1)}, {slot: 2}]) assert.throws(() => validateCompleteBundle({...bundle, routes: [{...route, ...changed}]}, [route]));
  assert.throws(() => validateCompleteBundle({...bundle, routes: [route, route]}, [route]));
});
test('prepared asset covers every existing source slot with closed 24–30 minute road routes', () => {
  const bundle = require('../prisma/data/road-practice-short-prepared.json');
  const starters = require('../prisma/data/road-practice-loops.json').routes.map(route => ({...route, slot: 1}));
  const expected = [...starters, ...require('../prisma/data/road-practice-catalog.json').routes];
  assert.deepEqual([...bundle.routes.map(identity)].sort(), [...expected.map(identity)].sort());
  assert.equal(new Set(bundle.routes.map(identity)).size, bundle.routes.length);
  assert.deepEqual(bundle.pending, []);
  assert.equal(bundle.instructorApproved, false);
  assert.equal(bundle.status, 'PREPARED_REQUIRES_IMPORT_REVALIDATION');
  const seen = new Set();
  for (const route of bundle.routes) {
    assert.equal(inWindow({valid: true, durationSec: route.durationSec}), true);
    assert.equal(route.points[0].latitude, route.points.at(-1).latitude);
    assert.equal(route.points[0].longitude, route.points.at(-1).longitude);
    const coordinates = route.points.map(point => [point.longitude, point.latitude]);
    const fingerprint = route.centreSlug + ':' + [JSON.stringify(coordinates), JSON.stringify([...coordinates].reverse())].sort()[0];
    assert.equal(seen.has(fingerprint), false); seen.add(fingerprint);
  }
});
