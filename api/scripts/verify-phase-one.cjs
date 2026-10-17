// Isolated integration verification. Never accepts a production database URL.
require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { BillingService } = require('../dist/src/billing/billing.service');
const { RouteAccessService } = require('../dist/src/routes/route-access.service');

const connection = process.env.PHASE_ONE_TEST_DATABASE_URL;
if (!connection) throw Error('Set PHASE_ONE_TEST_DATABASE_URL to a NEW, empty localhost test database.');
const url = new URL(connection);
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !/^\/drivecoach_phase1_test\w*$/.test(url.pathname)) throw Error('Only a named local phase-one test database is permitted.');
const db = new PrismaClient({ datasourceUrl: connection });
const psql = process.env.PHASE_ONE_PSQL_PATH || 'psql';
function sqlFile(file) { execFileSync(psql, [connection, '-X', '-v', 'ON_ERROR_STOP=1', '-q', '-f', file], { stdio: 'pipe' }); }

async function main() {
  const tables = await db.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname='public'`);
  assert.equal(tables.length, 0, 'Refusing to modify a non-empty database');
  const root = path.resolve(__dirname, '../prisma/migrations');
  for (const dir of fs.readdirSync(root).sort().filter(d => /^\d/.test(d) && d < '0017')) sqlFile(path.join(root, dir, 'migration.sql'));
  await db.$executeRawUnsafe(`INSERT INTO "User" ("id","email","passwordHash","updatedAt") VALUES ('legacy-basic','legacy-basic@example.invalid','not-a-login',NOW()),('legacy-premium','legacy-premium@example.invalid','not-a-login',NOW()),('trial-user','trial-user@example.invalid','not-a-login',NOW())`);
  await db.$executeRawUnsafe(`INSERT INTO "ExamCentre" ("id","slug","name","city","region","isPublished","updatedAt") VALUES ('centre-a','test-a','Test A','Test','Test',true,NOW()),('centre-b','test-b','Test B','Test','Test',true,NOW())`);
  await db.$executeRawUnsafe(`INSERT INTO "Subscription" ("id","userId","planId","centreId","status","startsAt","expiresAt","updatedAt") VALUES ('legacy-basic-sub','legacy-basic','plan_premium','centre-a','ACTIVE',NOW()-INTERVAL '1 day',NOW()+INTERVAL '20 days',NOW()),('legacy-premium-sub','legacy-premium','plan_diamond',NULL,'ACTIVE',NOW()-INTERVAL '1 day',NOW()+INTERVAL '25 days',NOW())`);
  await db.$executeRawUnsafe(`INSERT INTO "Payment" ("id","userId","planId","subscriptionId","provider","amountCents","currency","status") VALUES ('legacy-payment','legacy-basic','plan_premium','legacy-basic-sub','STRIPE',1499,'EUR','SUCCEEDED')`);
  const before = await db.$queryRawUnsafe(`SELECT "id","planId","centreId","startsAt","expiresAt" FROM "Subscription" ORDER BY "id"`);
  sqlFile(path.join(root, '0017_phase_one_access/migration.sql'));
  assert.deepEqual(await db.$queryRawUnsafe(`SELECT "id","planId","centreId","startsAt","expiresAt" FROM "Subscription" ORDER BY "id"`), before);
  assert.equal((await db.payment.findUnique({where:{id:'legacy-payment'}})).amountCents,1499);
  assert.equal((await db.plan.findUnique({where:{id:'plan_premium'}})).priceCents,1499);
  assert.equal((await db.plan.findUnique({where:{id:'plan_diamond'}})).priceCents,1999);
  const billing = new BillingService(db), access = new RouteAccessService(db);
  assert.equal((await billing.subscription('legacy-basic')).plan,'Basic');
  assert.equal((await billing.subscription('legacy-premium')).plan,'Premium');
  assert.equal((await access.centreAccess('legacy-basic','centre-a')).premium,true);
  assert.equal((await access.centreAccess('legacy-basic','centre-b')).premium,false);
  assert.equal((await access.centreAccess('legacy-premium','centre-b')).premium,true);
  const offers = await billing.listPlans();
  assert.equal(offers.length,8);
  for(const [name,prices] of [['Basic',[200,400,600,800]],['Premium',[300,600,900,1200]]]) {
    for(const [i,hours] of [24,168,720,2160].entries()) {
      const offer=offers.find(p=>p.name===name&&p.durationHours===hours);
      assert.equal(offer.priceCents,prices[i]); assert.equal(offer.purchasable,true);
    }
  }
  for(const [id,centreId] of [['route-a','centre-a'],['route-b','centre-b']]) await db.route.create({data:{id,slug:id,name:id,centreId,status:'PUBLISHED',verificationStatus:'ROAD_VALIDATED',reviewedBy:'test-reviewer',durationMin:25}});
  await assert.rejects(access.requireAccess('trial-user','route-a'),/24-hour trial/);
  assert.equal((await billing.trial('trial-user')).available,true);
  // Two tabs racing to choose different routes still create exactly one trial.
  const race=await Promise.allSettled([billing.startTrial('trial-user','route-a'),billing.startTrial('trial-user','route-b')]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(await db.routeTrial.count({where:{userId:'trial-user'}}),1);
  const trial=await db.routeTrial.findUnique({where:{userId:'trial-user'}});
  assert.equal(trial.expiresAt-trial.startedAt,86400000);
  await access.requireAccess('trial-user',trial.routeId);
  await assert.rejects(access.requireAccess('trial-user',trial.routeId==='route-a'?'route-b':'route-a'));
  assert.equal((await billing.startTrial('trial-user',trial.routeId)).id,trial.id);
  await assert.rejects(db.route.delete({where:{id:trial.routeId}}),/Foreign key constraint/);
  await assert.rejects(db.routeTrial.update({where:{id:trial.id},data:{expiresAt:new Date(trial.expiresAt.getTime()+1)}}),/constraint/);
  const ended=new Date(Date.now()-1000);
  await db.routeTrial.update({where:{id:trial.id},data:{startedAt:new Date(ended.getTime()-86400000),expiresAt:ended}});
  await assert.rejects(access.requireAccess('trial-user',trial.routeId));
  await assert.rejects(billing.startTrial('trial-user',trial.routeId),/already been used/);
  assert.equal((await billing.trial('trial-user')).available,false);
  console.log('PASS: migration, 8 prices, legacy history/expiry, scoped access, concurrent single trial, deletion/reset guards and expiry.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
