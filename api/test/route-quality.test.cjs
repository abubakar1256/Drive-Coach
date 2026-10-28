require("reflect-metadata");
const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { geometryIssues } = require("../dist/src/routes/route-quality");
const { DrivingRouteService } = require("../dist/src/routes/driving-route.service");
const { AdminService } = require("../dist/src/admin/admin.service");
const { LearningService } = require("../dist/src/learning/learning.service");
const { RoutesService } = require("../dist/src/routes/routes.service");
const originalFetch = global.fetch;
const originalToken = process.env.MAPBOX_DIRECTIONS_TOKEN;
const originalPublic = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
afterEach(() => { global.fetch = originalFetch; for (const [name, value] of [["MAPBOX_DIRECTIONS_TOKEN", originalToken], ["NEXT_PUBLIC_MAPBOX_TOKEN", originalPublic]]) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
const square = [[5, 50], [5.01, 50], [5.01, 50.01], [5, 50.01], [5, 50]];
const points = square.map(([longitude, latitude]) => ({ longitude, latitude }));
test('an open saved route is rejected before any provider request',async()=>{
  process.env.MAPBOX_DIRECTIONS_TOKEN='test-only';
  global.fetch=()=>{throw Error('No routing spend for an open route');};
  assert.deepEqual((await new DrivingRouteService().evaluate(points.slice(0,-1))).issues,['OPEN_ROUTE']);
});
test('a provider response ending elsewhere cannot qualify as a closed practice loop',async()=>{
  provider(1500,[[5,50],[5.01,50],[5.01,50.01],[5,50.01]]);
  const result=await new DrivingRouteService().evaluate(points);
  assert.equal(result.valid,false);assert.ok(result.issues.includes('OPEN_ROUTE'));
});
function provider(duration = 1440, geometry = square, modifier) {
  process.env.MAPBOX_DIRECTIONS_TOKEN = "test-only";
  global.fetch = async (url) => {
    assert.match(url, /mapbox\/driving\//);
    assert.match(url, /continue_straight=true/);
    assert.match(url, /overview=full/);
    return { ok: true, json: async () => ({ code: "Ok", routes: [{ duration, distance: 14000, geometry: { coordinates: geometry }, legs: [{ steps: [{ maneuver: { modifier } }] }] }] }) };
  };
}
test("simple closed loop is allowed", () => assert.deepEqual(geometryIssues(square), []));
test("figure-eight crossing is rejected", () => assert.deepEqual(geometryIssues([[0, 0], [2, 2], [0, 2], [2, 0]]), ["SELF_CROSSING"]));
test("revisited junction/road is rejected", () => assert.deepEqual(geometryIssues([[0, 0], [1, 0], [1, 1], [1, 0], [2, 0]]), ["REVISITED_ROAD"]));
test("overlapping road with different geometry vertices is rejected", () => assert.deepEqual(geometryIssues([[0, 0], [4, 0], [4, 1], [3, 1], [3, 0], [1, 0]]), ["BACKTRACKING"]));
test("ten-minute route cannot pass a 24-minute label", async () => { provider(600); const result = await new DrivingRouteService().evaluate(points); assert.equal(result.valid, false); assert.equal(result.durationSec, 600); assert.ok(result.issues.includes("UNDER_23_MINUTES")); });
test("exactly 24 driving minutes passes, cached by full point order", async () => { provider(); const service = new DrivingRouteService(); const result = await service.evaluate(points); assert.equal(result.valid, true); assert.deepEqual(result.coordinates, square); global.fetch = () => { throw Error("must use cache"); }; assert.deepEqual(await service.evaluate(points), result); });
test("22 minutes 59 seconds fails rather than rounding to 23", async () => { provider(1379); assert.equal((await new DrivingRouteService().evaluate(points)).valid, false); });
test("changing waypoint order cannot reuse an earlier valid result", async () => { provider(); const service = new DrivingRouteService(); assert.equal((await service.evaluate(points)).valid, true); provider(600); assert.equal((await service.evaluate([...points].reverse())).valid, false); });
test("malformed provider geometry fails closed", async () => { provider(1800, [[5, 50], [NaN, 51]]); assert.deepEqual((await new DrivingRouteService().evaluate(points)).issues, ["INVALID_ROUTING_RESPONSE"]); });
test("U-turn is rejected even on a long route", async () => { provider(1800, square, "uturn"); assert.ok((await new DrivingRouteService().evaluate(points)).issues.includes("U_TURN")); });
test("provider error fails closed and is not cached", async () => { provider(); const service = new DrivingRouteService(); global.fetch = async () => ({ ok: false }); assert.equal((await service.evaluate(points)).valid, false); provider(); assert.equal((await service.evaluate(points)).valid, true); });
test("no key does not fabricate a route", async () => { delete process.env.MAPBOX_DIRECTIONS_TOKEN; delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN; assert.deepEqual((await new DrivingRouteService().evaluate(points)).issues, ["ROUTING_NOT_CONFIGURED"]); });
test("invalid waypoint counts and coordinates are rejected", async () => { const service = new DrivingRouteService(); assert.equal((await service.evaluate([])).valid, false); assert.equal((await service.evaluate(Array(26).fill(points[0]))).valid, false); assert.equal((await service.evaluate([{ latitude: 91, longitude: 5 }, points[1]])).valid, false); });
test("publication cannot bypass road validation", async () => {
  let saved = false;
  const prisma = { route: { findUnique: async () => ({ id: "r", verificationStatus: "VERIFIED", reviewedBy: "admin", sourceLabel: "Reviewed", version: 1 }), update: async () => { saved = true; } }, routePoint: { findMany: async () => points } };
  const service = new AdminService(prisma, { requireValid: async () => { throw Error("UNDER_23_MINUTES"); } });
  await assert.rejects(service.updateRoute("r", { status: "PUBLISHED", durationMin: 24 }), /UNDER_23/); assert.equal(saved, false);
  await assert.rejects(service.createRoute({ status: "PUBLISHED" }), /draft/);
});
test("practice cannot start through direct API with an invalid route", async () => {
  let inserts = 0;
  const prisma = { $queryRawUnsafe: async sql => { if (sql.startsWith("INSERT")) inserts++; return [{ id: "r" }]; }, routePoint: { findMany: async () => points } };
  const service = new LearningService(prisma, { requireValid: async () => { throw Error("SELF_CROSSING"); } }, { requireAccess: async () => ({ route: { id: "r" }, premium: true }) });
  await assert.rejects(service.startSession("u", { routeId: "r" }), /SELF_CROSSING/); assert.equal(inserts, 0);
});
test("public preview checks all points but never exposes full geometry or paid media", async () => {
  let checked;
  const all = points.map((p, i) => ({ ...p, id: `p${i}`, imageUrl: "private", videoUrl: "private" }));
  const service = new RoutesService({ route: { findFirst: async () => ({ id: "r", points: all }) } }, { evaluate: async p => { checked = p; return { valid: true, coordinates: square, durationSec: 1800, distanceM: 14000, issues: [] }; } });
  const result = await service.getBySlug("r");
  assert.equal(checked.length, 5); assert.equal(result.points.length, 0); assert.deepEqual(result.driving.coordinates, []); assert.equal(result.durationMin, 30);
  assert.ok(result.points.every(p => p.imageUrl === null && p.videoUrl === null));
});
