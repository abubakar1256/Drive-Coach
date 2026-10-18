// Destructive only to a NEW EMPTY, explicitly named loopback test database.
// No .env loading, geocoding, external Directions, email, Stripe or live writes.
require('reflect-metadata');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const {OfficialRouteFoundationService}=require('../dist/src/routes/official-route-foundation.service');
const {officialPassageCatalog}=require('../dist/src/exam-centres/official-passage-catalog');
const {AdminService}=require('../dist/src/admin/admin.service');
const {RouteAccessService}=require('../dist/src/routes/route-access.service');
const {BillingService}=require('../dist/src/billing/billing.service');
const {ExamCentresService}=require('../dist/src/exam-centres/exam-centres.service');
const connection=process.env.PHASE_TWO_TEST_DATABASE_URL;
if(!connection)throw Error('Set PHASE_TWO_TEST_DATABASE_URL to a NEW empty local test database.');
const url=new URL(connection);
if(!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='55443'||!/^\/drivecoach_phase2_test\w*$/.test(url.pathname))throw Error('Only an explicitly named phase-two database on loopback port 55443 is permitted.');
const db=new PrismaClient({datasourceUrl:connection});
const psql=process.env.PHASE_TWO_PSQL_PATH||'psql';
const migrations=path.resolve(__dirname,'../prisma/migrations');
const sqlFile=file=>execFileSync(psql,[connection,'-X','-v','ON_ERROR_STOP=1','-q','-f',file],{stdio:'pipe'});
async function preservedSnapshot(){return {
  subscriptions:await db.$queryRawUnsafe('SELECT * FROM "Subscription" ORDER BY "id"'),
  payments:await db.$queryRawUnsafe('SELECT * FROM "Payment" ORDER BY "id"'),
  prices:await db.$queryRawUnsafe('SELECT * FROM "Plan" ORDER BY "id"'),
  trials:await db.$queryRawUnsafe('SELECT * FROM "RouteTrial" ORDER BY "id"'),
  legacyRoute:await db.$queryRawUnsafe('SELECT "id","status","durationMin","version","reviewedBy","updatedAt" FROM "Route" WHERE "id"=\'legacy-route\''),
  legacyPoints:await db.$queryRawUnsafe('SELECT * FROM "RoutePoint" WHERE "routeId"=\'legacy-route\' ORDER BY "sequence"'),
};}
async function main(){
  assert.equal((await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public'")).length,0,'Refusing a non-empty database');
  for(const dir of fs.readdirSync(migrations).sort().filter(d=>/^\d/.test(d)&&d<'0018'))sqlFile(path.join(migrations,dir,'migration.sql'));
  await db.$executeRawUnsafe(`INSERT INTO "User" ("id","email","passwordHash","role","updatedAt") VALUES ('reviewer','phase2-reviewer@example.invalid','NOT A LOGIN','ADMIN',NOW()),('paid','phase2-paid@example.invalid','NOT A LOGIN','LEARNER',NOW()),('free','phase2-free@example.invalid','NOT A LOGIN','LEARNER',NOW()),('free-new','phase2-free-new@example.invalid','NOT A LOGIN','LEARNER',NOW())`);
  await db.$executeRawUnsafe(`INSERT INTO "ExamCentre" ("id","slug","name","city","region","latitude","longitude","isPublished","updatedAt") VALUES ('c','alken','TEST ONLY Alken','TEST','TEST',50,5,true,NOW())`);
  await db.$executeRawUnsafe(`INSERT INTO "Route" ("id","centreId","slug","name","status","verificationStatus","reviewedBy","durationMin","updatedAt") VALUES ('legacy-route','c','legacy-test-only','Legacy test route','PUBLISHED','ROAD_VALIDATED','ROAD_ROUTING_ENGINE',30,NOW())`);
  await db.$executeRawUnsafe(`INSERT INTO "RoutePoint" ("id","routeId","sequence","category","title","latitude","longitude","updatedAt") VALUES ('legacy-point','legacy-route',1,'start','TEST',50,5,NOW())`);
  await db.$executeRawUnsafe(`INSERT INTO "Subscription" ("id","userId","planId","centreId","status","startsAt","expiresAt","updatedAt") VALUES ('paid-sub','paid','plan_premium','c','ACTIVE',NOW()-INTERVAL '1 day',NOW()+INTERVAL '20 days',NOW())`);
  await db.$executeRawUnsafe(`INSERT INTO "Payment" ("id","userId","planId","subscriptionId","provider","amountCents","currency","status") VALUES ('paid-payment','paid','plan_premium','paid-sub','STRIPE',1499,'EUR','SUCCEEDED')`);
  const before=await preservedSnapshot();
  sqlFile(path.join(migrations,'0018_official_route_foundation/migration.sql'));
  assert.deepEqual(await preservedSnapshot(),before,'Migration must preserve financial history, trial state and existing routes');

  let routingCalls=0;
  const driving={requireValid:async points=>{routingCalls++;return {valid:true,issues:[],durationSec:1500,distanceM:12000,coordinates:points.map(p=>[p.longitude,p.latitude])};}};
  const foundation=new OfficialRouteFoundationService(db,driving);
  for(const source of officialPassageCatalog){
    const centre=await db.examCentre.upsert({where:{slug:source.slug},update:{},create:{slug:source.slug,name:`TEST ONLY ${source.name}`,city:'TEST',region:'TEST',latitude:50,longitude:5,isPublished:true}});
    await foundation.importSource('reviewer',centre.id);
  }
  assert.equal(await db.officialPassagePoint.count(),156);
  assert.equal(await db.officialPassagePoint.count({where:{verificationStatus:'VERIFIED'}}),0);
  assert.equal(await db.officialPassagePoint.count({where:{latitude:{not:null}}}),0,'No coordinates may be invented by import');
  const points=await db.officialPassagePoint.findMany({where:{centreId:'c'},orderBy:{sequence:'asc'},take:2});
  await assert.rejects(foundation.generateDraft('reviewer','c',points.map(p=>p.id)),/start\/finish/);
  assert.equal(routingCalls,0);
  const departure={latitude:50,longitude:5,label:'Synthetic TEST meeting point',sourceUrl:officialPassageCatalog[0].centreSourceUrl,notes:'SYNTHETIC FIXTURE ONLY — not a real reviewed departure',verificationStatus:'VERIFIED'};
  await foundation.reviewDeparture('reviewer','c',departure);
  for(const [i,p]of points.entries())await foundation.reviewPassage('reviewer',p.id,{latitude:i===0?50:50.01,longitude:5.01,notes:'SYNTHETIC FIXTURE ONLY — test coordinates',verificationStatus:'VERIFIED'});
  const reviewed=await db.officialPassagePoint.findMany({where:{centreId:'c'},orderBy:{sequence:'asc'}});
  await foundation.importSource('reviewer','c');
  assert.deepEqual(await db.officialPassagePoint.findMany({where:{centreId:'c'},orderBy:{sequence:'asc'}}),reviewed,'Idempotent import preserves coordinate review and timestamps');

  const route=await foundation.generateDraft('reviewer','c',points.map(p=>p.id));
  assert.equal(route.status,'DRAFT');assert.equal(route.verificationStatus,'PENDING_REVIEW');assert.equal(route.durationMin,25);assert.equal(routingCalls,1);
  assert.equal((await foundation.generateDraft('reviewer','c',points.map(p=>p.id))).preserved,true);
  const admin=new AdminService(db,driving,{routePublished:async()=>{}},{},foundation);
  await assert.rejects(admin.updateRoute(route.id,{status:'PUBLISHED'},'reviewer'),/review/);
  await admin.updateRoute(route.id,{verificationStatus:'VERIFIED'},'reviewer');
  const published=await admin.updateRoute(route.id,{status:'PUBLISHED'},'reviewer');assert.equal(published.status,'PUBLISHED');
  const access=new RouteAccessService(db,foundation);
  assert.equal((await access.requireAccess('paid',route.id)).premium,true);
  const billing=new BillingService(db,foundation);
  assert.equal((await billing.subscription('paid')).plan,'Basic');
  const trial=await billing.startTrial('free',route.id);assert.equal(trial.expiresAt-trial.startedAt,86400000);
  assert.equal((await access.requireAccess('free',route.id)).premium,false);
  const sourceSummary=await foundation.summary('alken');assert.equal(sourceSummary.reviewedPointCount,2);assert.equal(sourceSummary.departureReviewed,true);
  const other=await db.examCentre.create({data:{slug:'unsupported-test',name:'TEST Unsupported',city:'TEST',region:'TEST',isPublished:true}});
  await assert.rejects(foundation.importSource('reviewer',other.id),/No operator source/);
  assert.equal((await foundation.summary(other.slug)).source,null);

  await foundation.reviewPassage('reviewer',points[0].id,{verificationStatus:'REJECTED',notes:'SYNTHETIC revocation test'});
  await assert.rejects(access.requireAccess('paid',route.id),/fresh source/);
  await assert.rejects(billing.startTrial('free-new',route.id),/review changed/);
  assert.equal(await db.routeTrial.count({where:{userId:'free-new'}}),0,'Unavailable route must not consume a new trial');
  const catalogue=await new ExamCentresService(db,access,foundation).getBySlug('alken','paid');
  const blocked=catalogue.routes.find(r=>r.id===route.id);assert.equal(blocked.needsReview,true);assert.equal(blocked.canAccess,false);assert.deepEqual(blocked.points,[]);assert.equal(blocked.foundation.departure,undefined);
  await assert.rejects(admin.updateRoute(route.id,{status:'PUBLISHED'},'reviewer'),/review changed/);
  await foundation.reviewPassage('reviewer',points[0].id,{verificationStatus:'VERIFIED',notes:'SYNTHETIC re-review test'});
  // Timestamp changes also invalidate snapshots: confirmation cannot revive old proof.
  await assert.rejects(access.requireAccess('paid',route.id),/fresh source/);

  await db.officialPassagePoint.update({where:{id:points[0].id},data:{sourceFingerprint:'outdated'}});
  await foundation.importSource('reviewer','c');
  const refreshed=await db.officialPassagePoint.findUniqueOrThrow({where:{id:points[0].id}});
  assert.equal(refreshed.latitude,50);assert.equal(refreshed.longitude,5.01);assert.equal(refreshed.verificationStatus,'PENDING_REVIEW');assert.equal(refreshed.verifiedBy,null);
  await assert.rejects(db.centreDeparture.update({where:{centreId:'c'},data:{reviewedBy:null}}),/constraint/);
  assert.ok(await db.auditLog.count({where:{action:'PASSAGE_COORDINATES_REVIEWED',userId:'reviewer'}}));
  const after=await preservedSnapshot();after.trials=before.trials;assert.deepEqual(after,before,'Workflows must not alter existing billing or route history');
  console.log('PASS: isolated 0018 migration; 156 source rows; idempotent import; reviewed departure/points; draft/review/publish; scoped paid and trial access; revocation; public redaction; immutable legacy route/payment/expiry. No external provider called.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
