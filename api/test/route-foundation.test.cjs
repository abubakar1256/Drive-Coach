require('reflect-metadata');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {officialPassageCatalog, passageFingerprint} = require('../dist/src/exam-centres/official-passage-catalog');
const {OfficialRouteFoundationService, publicFoundation, reviewedPassage} = require('../dist/src/routes/official-route-foundation.service');
const {orderedCoverageIssues, belgianCoordinate} = require('../dist/src/routes/foundation-quality');
const {durationIssues} = require('../dist/src/routes/route-quality');
const {RouteAccessService} = require('../dist/src/routes/route-access.service');
const {centreRouteCatalog} = require('../dist/src/exam-centres/exam-centres.service');

// Synthetic locations only. These fixtures are never geocoded, seeded or published.
function fixture() {
  const source = officialPassageCatalog[0];
  const reviewedAt = new Date('2026-10-18T00:00:00Z');
  const departure = {centreId: 'c', latitude: 50, longitude: 5, version: 1, label: 'TEST departure', notes: 'Synthetic fixture only', sourceUrl: source.centreSourceUrl, verificationStatus: 'VERIFIED', reviewedBy: 'reviewer', reviewedAt};
  const points = source.points.slice(0, 2).map((p, i) => {
    const point = {...p, id: `p${i}`, centreId: 'c', latitude: i === 0 ? 50 : 50.01, longitude: 5.01, sourceUrl: source.sourceUrl, sourceRevision: source.sourceRevision, verificationStatus: 'VERIFIED', verifiedBy: 'reviewer', verifiedAt: reviewedAt};
    point.sourceFingerprint = passageFingerprint(point);
    return point;
  });
  const routePoints = [departure, ...points, departure];
  const geometry = routePoints.map(p => [p.longitude, p.latitude]);
  const audits = [], created = [], locks = [];
  const db = {
    examCentre: {findUnique: async () => ({id:'c', slug:'alken', name:'TEST Alken', latitude:50, longitude:5, departure, officialPassagePoints: points})},
    centreDeparture: {findUnique: async () => departure},
    officialPassagePoint: {findMany: async () => points, findUnique: async ({where}) => points.find(p => p.id === where.id), update: async ({where,data}) => Object.assign(points.find(p => p.id === where.id), data)},
    auditLog: {create: async ({data}) => {audits.push(data); return data;}},
    route: {findUnique: async () => created[0] ?? null, create: async ({data}) => {const r={id:'draft', ...data}; created.push(r);return r;}},
    $queryRawUnsafe: async (...args) => {locks.push(args); return [];},
    $transaction: async fn => fn(db),
  };
  let calls = 0;
  const driving = {requireValid: async input => {calls++; assert.deepEqual(input.map(p => [p.longitude,p.latitude]), geometry); return {valid:true, issues:[], durationSec:1500, distanceM:12000, coordinates: geometry};}};
  const service = new OfficialRouteFoundationService(db, driving);
  return {source, departure, points, routePoints, geometry, audits, created, db, service, driving, locks, calls:()=>calls};
}

test('six operator bundles preserve 156 numbered source rows and revision dates, with no invented coordinates', () => {
  assert.deepEqual(Object.fromEntries(officialPassageCatalog.map(s=>[s.slug,s.points.length])), {alken:32,bree:24,'antwerp-north':29,'antwerp-geel':27,'antwerp-kontich':25,haasrode:19});
  assert.equal(officialPassageCatalog.reduce((n,s)=>n+s.points.length,0),156);
  for (const s of officialPassageCatalog) {
    assert.match(s.sourceUrl,/^https:\/\/www\.autoveiligheid\.be\/storage\/files\/.+\.pdf$/);
    assert.match(s.sourceRevision,/^202[45]-\d{2}-\d{2}$/);
    assert.ok(s.address && s.centreSourceUrl);
    assert.deepEqual(s.points.map(p=>p.sequence),Array.from({length:s.points.length},(_,i)=>i+1));
    for(const p of s.points) {assert.ok(p.municipality && p.junction); assert.equal(p.latitude,undefined); assert.equal(p.longitude,undefined);}
  }
  const geel=officialPassageCatalog.find(s=>s.slug==='antwerp-geel');
  assert.equal(geel.sourceRevision,'2025-10-31');
  assert.equal(geel.points[24].duplicateOfSequence,19);
});
test('exact duration policy accepts 23–27 minutes and never rounds into the band', () => {
  for(const seconds of [1380,1500,1620])assert.deepEqual(durationIssues(seconds),[]);
  assert.deepEqual(durationIssues(1379.999),['UNDER_23_MINUTES']); assert.deepEqual(durationIssues(1620.001),['OVER_27_MINUTES']);
  for(const seconds of [NaN,Infinity,null,undefined,-1])assert.ok(durationIssues(seconds).length);
});
test('ordered coverage accepts a closed sequence and rejects a missing, moved or reordered passage', () => {
  const f=fixture(); assert.deepEqual(orderedCoverageIssues(f.geometry,f.routePoints),[]);
  assert.deepEqual(orderedCoverageIssues([],f.routePoints),['FOUNDATION_GEOMETRY_MISSING']);
  assert.deepEqual(orderedCoverageIssues(f.geometry,[f.departure,f.points[1],f.points[0],f.departure]),['PASSAGE_POINT_NOT_VISITED_IN_ORDER']);
  assert.deepEqual(orderedCoverageIssues(f.geometry,[{latitude:51,longitude:6},...f.routePoints.slice(1)]),['START_FINISH_MISMATCH']);
  assert.deepEqual(orderedCoverageIssues(f.geometry,[f.departure,{latitude:50.2,longitude:5.2},f.points[1],f.departure]),['PASSAGE_POINT_NOT_VISITED_IN_ORDER']);
});
test('coordinate and review gate fails closed for missing evidence, duplicates, stale names and outside-Belgium locations', () => {
  const f=fixture(),p=f.points[0]; assert.equal(reviewedPassage(p),true);
  for(const change of [{sourceFingerprint:null},{latitude:null},{verifiedBy:null},{verifiedAt:null},{duplicateOfSequence:1},{junction:'Changed source'},{latitude:52},{verificationStatus:'PENDING_REVIEW'}])assert.equal(reviewedPassage({...p,...change}),false);
  assert.equal(belgianCoordinate({latitude:NaN,longitude:5}),false);
});
test('draft generation saves only a bounded checked draft, private proof and ordered source names', async () => {
  const f=fixture(), result=await f.service.generateDraft('admin','c',f.points.map(p=>p.id));
  assert.equal(f.calls(),1); assert.equal(result.status,'DRAFT'); assert.equal(result.verificationStatus,'PENDING_REVIEW');assert.equal(result.durationMin,25);
  assert.match(result.sourceLabel,/not an official exam itinerary/); assert.equal(result.points.create.length,4);
  assert.equal(result.points.create[1].title,f.points[0].junction);assert.deepEqual(result.points.create.map(p=>[p.longitude,p.latitude]),f.geometry);
  assert.ok(f.locks.some(([sql])=>sql.includes('FOR SHARE')));assert.equal(f.audits[0].userId,'admin');
  const again=await f.service.generateDraft('admin','c',f.points.map(p=>p.id));assert.equal(again.preserved,true);assert.equal(f.created.length,1);
});
test('missing departure, unreviewed coordinates, duplicate or foreign selection never calls routing or saves a route', async () => {
  for(const mutate of [f=>f.departure.verificationStatus='PENDING_REVIEW',f=>f.points[0].latitude=null,f=>f.points[0].duplicateOfSequence=2]) {
    const f=fixture();mutate(f);await assert.rejects(f.service.generateDraft('admin','c',['p0','p1']));assert.equal(f.calls(),0);assert.equal(f.created.length,0);
  }
  for(const ids of [[],['p0'],['p0','p0'],['foreign','p1']]) {const f=fixture();await assert.rejects(f.service.generateDraft('admin','c',ids));assert.equal(f.calls(),0);}
});
test('provider failure, missing passage geometry and out-of-band exact time save nothing', async () => {
  for(const overrides of [{durationSec:1379.999},{durationSec:1620.001},{coordinates:[[5,50],[5,50.01],[5,50]]}]) {
    const f=fixture();f.driving.requireValid=async()=>({valid:true,durationSec:1500,coordinates:f.geometry,...overrides});
    await assert.rejects(f.service.generateDraft('admin','c',['p0','p1']));assert.equal(f.created.length,0);
  }
  const f=fixture();f.driving.requireValid=async()=>{throw Error('ROUTING_UNAVAILABLE');};await assert.rejects(f.service.generateDraft('admin','c',['p0','p1']));assert.equal(f.created.length,0);
});
test('source revocation during slow routing is detected again inside the saving transaction', async () => {
  const f=fixture();f.driving.requireValid=async()=>{f.points[0].verificationStatus='REJECTED';return {valid:true,durationSec:1500,coordinates:f.geometry};};
  await assert.rejects(f.service.generateDraft('admin','c',['p0','p1']),/review changed/);assert.equal(f.created.length,0);
});
test('provenance invalidates on any departure/source/coordinate/reviewer-time change', async () => {
  for(const mutate of [f=>f.departure.version++,f=>f.points[0].junction='Changed',f=>f.points[0].latitude+=.001,f=>f.points[0].verifiedAt=new Date(),f=>f.points[0].verificationStatus='REJECTED']) {
    const f=fixture(),r=await f.service.generateDraft('admin','c',['p0','p1']);mutate(f);await assert.rejects(f.service.validateSnapshot(r,f.routePoints));
  }
  const f=fixture();await assert.rejects(f.service.validateSnapshot({centreId:'c',foundation:{kind:'PUBLISHED_PASSAGE_PRACTICE',points:[]}},f.routePoints),/provenance/);
});
test('coordinate review records server actor and invalidates verification after a move', async () => {
  const f=fixture();await f.service.reviewPassage('content-manager','p0',{latitude:50.0001,notes:'Location changed, requires review'});
  assert.equal(f.points[0].verificationStatus,'PENDING_REVIEW');assert.equal(f.points[0].verifiedBy,null);
  await assert.rejects(f.service.reviewPassage('reviewer','p0',{verificationStatus:'VERIFIED'}));
  await f.service.reviewPassage('reviewer','p0',{verificationStatus:'VERIFIED',notes:'Reviewed against exact public junction evidence'});
  assert.equal(f.points[0].verifiedBy,'reviewer');assert.equal(f.audits.at(-1).userId,'reviewer');
});
test('departure review requires a source, evidence and nearby Belgian coordinates', async () => {
  const f=fixture();for(const data of [{latitude:52,longitude:5},{latitude:50,longitude:5,notes:'',sourceUrl:'https://example.invalid',label:'Meeting'},{latitude:51.5,longitude:6.4,notes:'Review notes',sourceUrl:'https://example.invalid',label:'Meeting'}])await assert.rejects(f.service.reviewDeparture('a','c',data));
});
test('public proof summary and catalogue never leak raw source ids or coordinates, and stale review cannot unlock even Premium', () => {
  const proof={kind:'PUBLISHED_PASSAGE_PRACTICE',departure:{latitude:50,longitude:5},points:[{id:'private',latitude:50,longitude:5}]};
  assert.deepEqual(publicFoundation(proof),{kind:'PUBLISHED_PASSAGE_PRACTICE',passagePointCount:1,officialExamItinerary:false});
  const result=centreRouteCatalog({name:'Test',city:'Test',region:'Test',routes:[{id:'r',foundation:proof,foundationReady:false,points:[{title:'SECRET',latitude:50,longitude:5}]}]}, {premium:true,plan:'Premium'},true);
  assert.equal(result.routes[0].canAccess,false);assert.equal(result.routes[0].needsReview,true);assert.deepEqual(result.routes[0].points,[]);assert.ok(!JSON.stringify(result).includes('private'));
});
test('direct route access rejects stale foundation before returning paid content', async () => {
  const service=new RouteAccessService({route:{findFirst:async()=>({id:'r',foundation:{kind:'x'}})},routePoint:{findMany:async()=>[]}}, {validateSnapshot:async()=>{throw Error('stale');}});
  await assert.rejects(service.requireAccess('paid','r'),/fresh source/);
});
test('admin and public Nest module wiring resolves the shared foundation service', async () => {
  const {Test}=require('@nestjs/testing');const {AdminModule}=require('../dist/src/admin/admin.module');const {ExamCentresModule}=require('../dist/src/exam-centres/exam-centres.module');const {PrismaService}=require('../dist/src/prisma.service');
  const module=await Test.createTestingModule({imports:[AdminModule,ExamCentresModule]}).overrideProvider(PrismaService).useValue({}).compile();
  try {assert.ok(module.get(OfficialRouteFoundationService));}finally{await module.close();}
});
test('foundation mutation endpoints retain admin guards and strict departure/selection DTO validation', async () => {
  const {validate}=require('class-validator');
  const {AdminController}=require('../dist/src/admin/admin.controller');
  const {AdminGuard}=require('../dist/src/admin/admin.guard');
  const {JwtAuthGuard}=require('../dist/src/auth/auth.guard');
  const {GeneratePassageRouteDto,ReviewDepartureDto}=require('../dist/src/admin/dto/admin-route.dto');
  const guards=Reflect.getMetadata('__guards__',AdminController);
  assert.ok(guards.includes(AdminGuard)&&guards.includes(JwtAuthGuard));
  for(const ids of [[],['one'],['one','one'],Array.from({length:7},(_,i)=>`${i}`)]) assert.ok((await validate(Object.assign(new GeneratePassageRouteDto(),{passagePointIds:ids}))).length);
  assert.equal((await validate(Object.assign(new GeneratePassageRouteDto(),{passagePointIds:['one','two']}))).length,0);
  const valid={latitude:50,longitude:5,label:'TEST public-road departure',notes:'Review evidence for synthetic fixture',sourceUrl:'https://example.invalid/source',verificationStatus:'VERIFIED'};
  assert.equal((await validate(Object.assign(new ReviewDepartureDto(),valid))).length,0);
  for(const change of [{verificationStatus:'AUTO_VERIFIED'},{notes:''},{sourceUrl:'javascript:alert(1)'},{latitude:100}])assert.ok((await validate(Object.assign(new ReviewDepartureDto(),{...valid,...change}))).length);
});
