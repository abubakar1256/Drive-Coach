require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { RouteAccessService } = require("../dist/src/routes/route-access.service");
const { trackProgress, snapshotDistance } = require("../dist/src/learning/practice-progress");
const { PracticeLoopService, loopCandidates } = require("../dist/src/routes/practice-loop.service");
const { BillingService } = require("../dist/src/billing/billing.service");
const { LearningService } = require("../dist/src/learning/learning.service");
const { ReferralsService } = require("../dist/src/referrals/referrals.service");
const { B2bService } = require("../dist/src/b2b/b2b.service");
const { NotificationsService } = require("../dist/src/notifications/notifications.service");
const { FinanceGuard } = require("../dist/src/admin/finance.guard");
const { validMediaSignature } = require("../dist/src/media/media-signature");
const { centreRouteCatalog, ExamCentresService } = require("../dist/src/exam-centres/exam-centres.service");
const { RoutesService } = require("../dist/src/routes/routes.service");
const geometry = [[5, 50], [5.01, 50], [5.01, 50.01], [5, 50.01], [5, 50]];
test("billing selects strongest valid plan and filters expired/future access", async () => {
  const service = new BillingService({ user: { findUnique: async () => ({ role: "LEARNER" }) }, subscription: { findFirst: async args => {
    assert.equal(args.where.status, "ACTIVE");
    assert.equal(args.where.AND.length, 2);
    assert.deepEqual(args.orderBy, [{ plan: { name: "asc" } }, { createdAt: "desc" }]);
    return { status: "ACTIVE", plan: { name: "Diamond" }, centreId: null, expiresAt: null };
  } } });
  assert.equal((await service.subscription("u")).plan, "Diamond");
});
test("Diamond cannot checkout Premium or Diamond again", async () => {
  const previous = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "test-only";
  try {
    for (const requested of ["Premium", "Diamond"]) {
      const service = new BillingService({ plan: { findUnique: async () => ({ name: requested, isActive: true }) } });
      service.subscription = async () => ({ status: "ACTIVE", plan: "Diamond" });
      await assert.rejects(service.checkout("u", { planId: "p" }), /already active/);
    }
  } finally { if (previous === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previous; }
});
test("Premium cannot checkout its active plan again", async () => {
  const previous = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "test-only";
  try {
    const service = new BillingService({ plan: { findUnique: async () => ({ name: "Premium", isActive: true }) } });
    service.subscription = async () => ({ status: "ACTIVE", plan: "Premium" });
    await assert.rejects(service.checkout("u", { planId: "p" }), /already active/);
  } finally { if (previous === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previous; }
});
const snapshot = { geometry, points: geometry, distanceM: snapshotDistance(geometry) };
function accessFixture(plan, centreId, role = "LEARNER", routeId = "paid-route") {
  let calls = 0;
  const prisma = { route: { findFirst: async args => { calls++; return args.where.id ? { id: routeId, centreId: "centre-a" } : { id: "free-route" }; } }, user: { findUnique: async () => ({ role }) }, subscription: { findMany: async args => { assert.equal(args.where.status, "ACTIVE"); assert.ok(args.where.AND.length === 2); return plan ? [{ plan: { name: plan }, centreId }] : []; } } };
  return new RouteAccessService(prisma);
}
test("Premium is scoped to purchased centre", async () => { assert.equal((await accessFixture("Premium", "centre-a").requireAccess("u", "paid-route")).premium, true); await assert.rejects(accessFixture("Premium", "centre-b").requireAccess("u", "paid-route"), /Choose Premium/); });
test("unbound legacy Premium cannot unlock another centre", async () => assert.rejects(accessFixture("Premium", null).requireAccess("u", "paid-route"), /Choose Premium/));
test("Diamond and admins can access multiple centres", async () => { assert.equal((await accessFixture("Diamond", null).requireAccess("u", "paid-route")).premium, true); assert.equal((await accessFixture(null, null, "ADMIN").requireAccess("u", "paid-route")).premium, true); });
test("free first route is allowed but other routes are denied", async () => { assert.equal((await accessFixture(null, null, "LEARNER", "free-route").requireAccess("u", "free-route")).premium, false); await assert.rejects(accessFixture(null, null).requireAccess("u", "paid-route")); });

const centreCatalogFixture = { id: "centre-a", name: "Alken", city: "Alken", region: "Limburg", routes: Array.from({ length: 7 }, (_, i) => ({ id: `route-${i}`, name: `Route ${i}`, durationMin: 24 + i, points: [{ latitude: 50, longitude: 5, title: `PRIVATE-${i}`, imageUrl: "private-image", videoUrl: "private-video" }], _count: { points: 25 } })) };
test("seven-route catalogue exposes one free route and no paid point previews", () => {
  const result = centreRouteCatalog(centreCatalogFixture);
  assert.equal(result.routes.filter(r => r.isFree).length, 1);
  assert.equal(result.routes.filter(r => r.canAccess).length, 1);
  assert.equal(result.routes[0].label, "Route A"); assert.equal(result.routes[6].label, "Route G");
  assert.ok(result.routes.slice(1).every(r => r.points.length === 0));
  assert.equal(result.routes[1].pointCount, 25);
  assert.equal(result.premiumInfo, null);
  assert.equal(result.routes[0].points[0].imageUrl, null);
});
test("paid centre catalogue unlocks all seven routes and bilingual preparation information", () => {
  const result = centreRouteCatalog(centreCatalogFixture, { premium: true, plan: "Premium" }, true);
  assert.equal(result.routes.filter(r => r.canAccess).length, 7);
  assert.equal(result.routes.filter(r => r.isFree).length, 1);
  assert.equal(result.premiumInfo.sections.length, 4);
  assert.ok(result.premiumInfo.sections.every(s => s.text.en && s.text.nl));
  assert.match(result.premiumInfo.disclaimer.en, /not official examiner criteria/);
});
test("centre info and paid routes use purchased-centre entitlements, not a generic paid flag", async () => {
  const correct = await accessFixture("Premium", "centre-a").centreAccess("u", "centre-a");
  const wrong = await accessFixture("Premium", "centre-b").centreAccess("u", "centre-a");
  assert.equal(correct.premium, true); assert.equal(wrong.premium, false);
  assert.equal(centreRouteCatalog(centreCatalogFixture, wrong, true).premiumInfo, null);
  assert.equal((await accessFixture("Diamond", null).centreAccess("u", "centre-a")).premium, true);
});
test("public centre route query enforces 24-minute reviewed publication and stable free ordering", async () => {
  const service = new ExamCentresService({ examCentre: { findFirst: async args => {
    assert.equal(args.include.routes.where.durationMin.gte, 24);
    assert.equal(args.include.routes.where.status, "PUBLISHED");
    assert.deepEqual(args.include.routes.orderBy, [{ createdAt: "asc" }, { id: "asc" }]);
    return centreCatalogFixture;
  } } }, {});
  const result = await service.getBySlug("alken");
  assert.equal(result.routes[1].points.length, 0);
});
test("expired or revoked subscriptions cannot unlock centre information", async () => {
  const service = new RouteAccessService({ user: { findUnique: async () => ({ role: "LEARNER" }) }, subscription: { findMany: async args => {
    assert.equal(args.where.status, "ACTIVE");
    assert.ok(args.where.AND[0].OR.some(condition => condition.startsAt?.lte instanceof Date));
    assert.ok(args.where.AND[1].OR.some(condition => condition.expiresAt?.gt instanceof Date));
    return [];
  } } });
  assert.equal((await service.centreAccess("u", "centre-a")).premium, false);
});

test("paid route public URLs and point endpoints do not expose a waypoint preview", async () => {
  const privateRoute = { id: "paid", centreId: "centre-a", points: [{ title: "private", latitude: 50, longitude: 5 }] };
  const prisma = { route: { findFirst: async args => args.where.slug ? privateRoute : { id: "free" } } };
  const driving = { evaluate: async () => ({ valid: true, durationSec: 1500, distanceM: 12000, coordinates: geometry, issues: [] }) };
  const service = new RoutesService(prisma, driving, {});
  const result = await service.getBySlug("paid");
  assert.deepEqual(result.points, []); assert.deepEqual(result.driving.coordinates, []);
  assert.equal(result.access.requiresPaid, true);
  assert.deepEqual(await service.points("paid"), []);
});

test("extra road catalogue contains distinct checked 24–60 minute routes, never cloned placeholders", () => {
  const bundle = require("../prisma/data/road-practice-catalog.json");
  const keys = new Set(), fingerprints = new Set();
  for (const route of bundle.routes) {
    const key = `${route.centreSlug}:${route.slot}`;
    assert.ok(!keys.has(key)); keys.add(key);
    assert.ok(route.slot >= 2 && route.slot <= 7);
    assert.ok(route.durationSec >= 1440 && route.durationSec <= 3600);
    assert.ok(route.points.length >= 2 && route.points.length <= 25);
    assert.ok(route.points.every(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)));
    const fingerprint = JSON.stringify(route.points.map(p => [p.latitude, p.longitude]));
    assert.ok(!fingerprints.has(fingerprint)); fingerprints.add(fingerprint);
  }
  assert.ok(bundle.routes.length > 0);
  assert.equal(bundle.generation.requests <= bundle.generation.maxRequests, true);
});
test("road-catalogue duplicate guard detects reverse and resampled copies", () => {
  const { similarRoads } = require("../scripts/build-road-catalog.cjs");
  assert.equal(similarRoads(geometry, [...geometry].reverse()), true);
  assert.equal(similarRoads(geometry, geometry.map(([lng, lat]) => [lng + 1, lat])), false);
});
test("unreviewed unpublished route cannot bypass access checks", async () => { const service = new RouteAccessService({ route: { findFirst: async args => { assert.equal(args.where.status, "PUBLISHED"); assert.deepEqual(args.where.verificationStatus.in, ["VERIFIED", "ROAD_VALIDATED"]); return null; } } }); await assert.rejects(service.requireAccess("u", "r"), /Reviewed/); });
test("poor GPS and out-of-route points cannot create progress", () => { assert.equal(trackProgress(snapshot, 0, 0, [5, 50], 200, 1).accepted, false); assert.equal(trackProgress(snapshot, 0, 0, [9, 54], 5, 1).accepted, false); });
test("initial position must be near route start, not a later waypoint", () => { assert.equal(trackProgress(snapshot, 0, 0, geometry[2], 5, 500).accepted, false); const start = trackProgress(snapshot, 0, 0, geometry[0], 5, 1); assert.equal(start.visited, 1); assert.equal(start.progressM, 0); });
test("progress is monotonic and advances through ordered route points", () => { const first = trackProgress(snapshot, 0, 1, geometry[1], 5, 30); assert.equal(first.accepted, true); assert.equal(first.visited, 2); const backwards = trackProgress(snapshot, first.progressM, 2, [5.0095, 50], 5, 3); assert.ok(backwards.progressM >= first.progressM); });
test("ending early computes elapsed time and ignores forged 100%/duration", async () => {
  let stored;
  const session = { id: "s", userId: "u", routeId: "r", startedAt: new Date(Date.now() - 120000), completedAt: null, completionPct: 10, progressM: snapshot.distanceM * 0.1, visitedPoints: 1, routeSnapshot: snapshot, notes: null };
  const tx = { $queryRawUnsafe: async () => [], practiceSession: { findFirst: async () => session, update: async args => { stored = args.data; return { ...session, ...args.data }; } }, auditLog: { create: async () => ({}) }, notification: { createMany: async () => ({ count: 1 }) }, routeAssignment: { updateMany: async () => ({ count: 0 }) } };
  const service = new LearningService({ $transaction: async fn => fn(tx) });
  const result = await service.updateSession("u", "s", { complete: true, durationSec: 99999, completionPct: 100 }); assert.equal(result.completionPct, 10); assert.equal(stored.completionKind, "ENDED"); assert.ok(stored.durationSec >= 120 && stored.durationSec < 130);
});
test("only ordered full-route coverage can finish at 100%", async () => {
  const session = { id: "s", startedAt: new Date(), completedAt: null, completionPct: 99, progressM: snapshot.distanceM, visitedPoints: snapshot.points.length, routeSnapshot: snapshot };
  let assignmentCompleted = false;
  const tx = { $queryRawUnsafe: async () => [], practiceSession: { findFirst: async () => session, update: async args => ({ ...session, ...args.data }) }, auditLog: { create: async () => ({}) }, notification: { createMany: async () => ({}) }, routeAssignment: { updateMany: async () => { assignmentCompleted = true; return { count: 1 }; } } };
  const result = await new LearningService({ $transaction: fn => fn(tx) }).updateSession("u", "s", { complete: true }); assert.equal(result.completionPct, 100); assert.equal(result.completionKind, "COMPLETED"); assert.equal(assignmentCompleted, true);
});
test("road-loop generator never persists search anchors as road coordinates", async () => { const saved = geometry.map(([longitude, latitude]) => ({ longitude, latitude, name: "Road" })); let count = 0; const service = new PracticeLoopService({ evaluate: async () => { count++; return { valid: true, durationSec: 1800, distanceM: 14000, coordinates: geometry, snappedPoints: saved, issues: [] }; } }); const result = await service.generate(50, 5); assert.equal(count, 2); assert.deepEqual(result.snappedPoints, saved); assert.equal(loopCandidates(50, 5)[0].length, 5); });
test("routing outages stop bounded generation without fake routes", async () => { let calls = 0; await assert.rejects(new PracticeLoopService({ evaluate: async () => { calls++; return { valid: false, issues: ["ROUTING_UNAVAILABLE"] }; } }).generate(50, 5)); assert.equal(calls, 1); });
test("school history and feedback reject unrelated instructors", async () => { const service = new B2bService({ studentEnrollment: { findFirst: async args => { assert.equal(args.where.instructor.userId, "outsider"); return null; } } }); await assert.rejects(service.studentHistory("outsider", "enrollment"), /enrollment/); await assert.rejects(service.feedback("outsider", "enrollment", { sessionId: "s", body: "x" }), /enrollment/); });
test("school invoice history is owner-only", async () => { const service = new B2bService({ drivingSchool: { findFirst: async () => null } }); await assert.rejects(service.schoolBilling("outsider", "school"), /owner/); });
test("content managers cannot record payouts or refund payments", () => { const guard = new FinanceGuard(); const context = role => ({ switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }) }); assert.throws(() => guard.canActivate(context("CONTENT_MANAGER"))); assert.equal(guard.canActivate(context("ADMIN")), true); });
test("payout cannot be recorded twice or before payment succeeds", async () => { const tx = { $queryRawUnsafe: async () => [], commission: { findUnique: async () => ({ status: "PAID", payment: { status: "SUCCEEDED" } }) } }; await assert.rejects(new ReferralsService({ $transaction: fn => fn(tx) }).recordPayout("admin", "c", "bank-123"), /pending/); });
test("HTML disguised as media is rejected by file signature", () => { assert.equal(validMediaSignature(Buffer.from("<script>alert(1)</script>"), "image/png"), false); assert.equal(validMediaSignature(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]), "image/png"), true); });
test("unpaid signed checkout must not activate subscriptions", async () => { let updated = false; const tx = { payment: { update: async () => { updated = true; } } }; await new BillingService({}).completeCheckout(tx, { payment_status: "unpaid" }); assert.equal(updated, false); });
test("paid amount/currency mismatch is rejected", async () => { const tx = { $queryRawUnsafe: async () => [{ id: "p" }], payment: { findUnique: async () => ({ id: "p", amountCents: 1499, currency: "EUR", status: "PENDING", plan: { name: "Premium" } }) } }; await assert.rejects(new BillingService({}).completeCheckout(tx, { id: "cs", payment_status: "paid", amount_total: 1, currency: "eur" }), /mismatch/); });
test("already fulfilled checkout cannot create another subscription/commission", async () => { const tx = { $queryRawUnsafe: async () => [{ id: "p" }], payment: { findUnique: async () => ({ status: "SUCCEEDED" }) } }; await new BillingService({}).completeCheckout(tx, { id: "cs", payment_status: "paid" }); });
test("one-time Premium centre selection cannot switch an existing centre", async () => { const service = new BillingService({ examCentre: { findFirst: async () => ({ id: "b" }) }, subscription: { findFirst: async () => ({ id: "s", centreId: "a" }) } }); await assert.rejects(service.selectCentre("u", "b"), /cannot be changed/); });
test("successful payment creates scoped access, commission and notification", async () => {
  const created = {};
  const tx = { $queryRawUnsafe: async () => [{ id: "p" }], payment: { findUnique: async () => ({ id: "p", userId: "u", planId: "plan", amountCents: 1499, currency: "EUR", status: "PENDING", metadata: { centreId: "a" }, plan: { name: "Premium", durationHours: 2160 } }), update: async args => { created.payment = args.data; } }, subscription: { create: async args => { created.subscription = args.data; return { ...args.data, id: "sub" }; } }, referralAttribution: { findUnique: async () => ({ codeId: "code", code: { ownerUserId: "owner", commissionBps: 1000 } }) }, commission: { upsert: async args => { created.commission = args.create; } }, notification: { createMany: async args => { created.notification = args.data[0]; } } };
  await new BillingService({}).completeCheckout(tx, { id: "cs", payment_intent: "pi", payment_status: "paid", amount_total: 1499, currency: "eur" }); assert.equal(created.subscription.centreId, "a"); assert.equal(created.commission.commissionCents, 149); assert.equal(created.commission.paymentId, "p"); assert.equal(created.notification.type, "PAYMENT_SUCCEEDED");
});
test("reminder runner sends due notices with idempotency keys", async () => {
  const notices = [];
  const now = new Date("2026-10-14T12:00:00Z");
  const prisma = { subscription: { findMany: async () => [] }, user: { findMany: async () => [{ id: "u", examDate: new Date("2026-10-15T12:00:00Z"), practiceReminderAt: now }] }, routeAssignment: { findMany: async () => [] }, notification: { createMany: async args => { assert.equal(args.skipDuplicates, true); notices.push(...args.data); } } };
  await new NotificationsService(prisma).runDue(now); assert.equal(notices.length, 2); assert.ok(notices.every(n => n.dedupeKey));
});
test("repeated student invites preserve active enrollment", async () => {
  let calls = 0;
  const tx = { studentEnrollment: { upsert: async args => { assert.deepEqual(args.update, {}); return { id: "e", status: "ACTIVE" }; } }, notification: { create: async () => { throw Error("No new invitation needed"); } } };
  const service = new B2bService({ $queryRawUnsafe: async () => (++calls === 1 ? [{ id: "teacher" }] : [{ id: "student" }]), $transaction: fn => fn(tx) });
  const result = await service.invite("owner", { studentEmail: "student@example.test" });
  assert.equal(result.enrollment.status, "ACTIVE");
});
test("student acceptance requires a current invite and active instructor", async () => {
  const service = new B2bService({ studentEnrollment: { updateMany: async args => { assert.equal(args.where.status, "INVITED"); assert.equal(args.where.instructor.status, "ACTIVE"); assert.equal(args.where.studentId, "student"); return { count: 0 }; } } });
  await assert.rejects(service.accept("student", "revoked"), /invitation/);
});
test("real-road bundle covers every official centre without fake coordinates", () => {
  const bundle = require("../prisma/data/road-practice-loops.json");
  const { officialCentres } = require("../dist/src/exam-centres/official-centres");
  assert.equal(bundle.routes.length, officialCentres.length);
  assert.equal(new Set(bundle.routes.map(r => r.centreSlug)).size, officialCentres.length);
  for (const centre of officialCentres) {
    const route = bundle.routes.find(r => r.centreSlug === centre.slug); assert.ok(route);
    assert.ok(route.durationSec >= 1440 && route.durationSec <= 3600);
    assert.ok(route.points.length >= 2 && route.points.length <= 25);
    assert.deepEqual(route.points[0], route.points.at(-1));
    assert.ok(route.points.every(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)));
  }
});
test("corner-preserving loop sampler retains bends and closes the loop", () => {
  const { cycleWaypoints } = require("../dist/src/routes/practice-loop.service");
  const points = cycleWaypoints(geometry, geometry[0]);
  assert.equal(points.length, 5); assert.deepEqual(points[0], points.at(-1));
  for (const [longitude, latitude] of geometry) assert.ok(points.some(p => p.latitude === latitude && p.longitude === longitude));
});
test("database media upload stores bytes and audit atomically without local files", async () => {
  const { MediaService } = require("../dist/src/media/media.service");
  const previous = process.env.MEDIA_PROVIDER; process.env.MEDIA_PROVIDER = "database";
  try {
    let asset, audited = false;
    const prisma = { routePoint: { findUnique: async () => ({ id: "point" }) }, $transaction: async fn => fn({ mediaAsset: { create: async args => { asset = args.data; return asset; } }, auditLog: { create: async () => { audited = true; } } }) };
    const bytes = Buffer.from([137,80,78,71,13,10,26,10,0]);
    const result = await new MediaService(prisma).uploadFile("u", "point", { buffer: bytes, originalname: "test.png", mimetype: "image/png", size: bytes.length });
    assert.equal(result.provider, "database"); assert.deepEqual(asset.dataBytes, bytes); assert.equal(audited, true);
    const reader = new MediaService({ $queryRawUnsafe: async () => [{ storageKey: asset.storageKey, publicUrl: asset.publicUrl, mimeType: asset.mimeType }], mediaAsset: { findUnique: async () => ({ dataBytes: bytes }) } });
    assert.deepEqual((await reader.file(asset.id)).buffer, bytes);
  } finally { if (previous === undefined) delete process.env.MEDIA_PROVIDER; else process.env.MEDIA_PROVIDER = previous; }
});
test("starter import preserves existing routes without routing or overwriting", async () => {
  const { AdminService } = require("../dist/src/admin/admin.service");
  const service = new AdminService({ examCentre: { findUnique: async () => ({ slug: "alken", isPublished: true }) }, route: { findUnique: async () => ({ id: "existing", status: "DRAFT" }) } }, { requireValid: async () => { throw Error("Must not re-route an existing edit"); } });
  const result = await service.importStarterRoute("admin", "centre"); assert.equal(result.preserved, true); assert.equal(result.status, "DRAFT");
});
test("starter import fails closed before any writes when roads are invalid", async () => {
  const { AdminService } = require("../dist/src/admin/admin.service");
  const service = new AdminService({ examCentre: { findUnique: async () => ({ slug: "alken", isPublished: true }) }, route: { findUnique: async () => null }, $transaction: async () => { throw Error("Unexpected write"); } }, { requireValid: async () => { throw Error("Road check failed"); } });
  await assert.rejects(service.importStarterRoute("admin", "centre"), /Road check failed/);
});
test("starter import publishes checked content once and sends route notice", async () => {
  const { AdminService } = require("../dist/src/admin/admin.service");
  let saved, notified = false;
  const tx = { $queryRawUnsafe: async sql => { assert.match(sql, /SELECT 1 AS locked FROM pg_advisory_xact_lock/); return [{ locked: 1 }]; }, route: { findUnique: async () => null, create: async args => { saved = args.data; return { id: "new", version: 1, ...args.data }; } }, auditLog: { create: async () => ({}) } };
  const service = new AdminService({ examCentre: { findUnique: async () => ({ slug: "ghent-east", isPublished: true }) }, route: { findUnique: async () => null }, $transaction: fn => fn(tx) }, { requireValid: async () => ({ valid: true, durationSec: 1800 }) }, { routePublished: async () => { notified = true; } });
  await service.importStarterRoute("admin", "centre"); assert.equal(saved.status, "PUBLISHED"); assert.equal(saved.verificationStatus, "ROAD_VALIDATED"); assert.match(saved.sourceLabel, /Shared Ghent/); assert.equal(notified, true);
});

test("prepared extra route import uses its stable slot and fresh road validation", async () => {
  const { AdminService } = require("../dist/src/admin/admin.service");
  let saved, checked = false;
  const tx = { $queryRawUnsafe: async () => [{ locked: 1 }], route: { findUnique: async () => null, create: async args => { saved = args.data; return { id: "extra", version: 1, ...args.data }; } }, auditLog: { create: async args => { assert.equal(args.data.action, "ROAD_CATALOG_IMPORTED"); } } };
  const service = new AdminService({ examCentre: { findUnique: async () => ({ slug: "alken", isPublished: true }) }, route: { findUnique: async () => null }, $transaction: fn => fn(tx) }, { requireValid: async points => { checked = true; assert.ok(points.length >= 2); return { valid: true, durationSec: 1500 }; } }, { routePublished: async () => {} });
  await service.importStarterRoute("admin", "centre", 2);
  assert.equal(checked, true); assert.equal(saved.slug, "alken-road-practice-loop-02"); assert.equal(saved.durationMin, 25);
  await assert.rejects(service.importStarterRoute("admin", "centre", 8), /1–7/);
});


