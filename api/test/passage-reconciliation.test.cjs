const {test}=require('node:test'),assert=require('node:assert/strict');
const {directCandidates,matches}=require('../scripts/reconcile-passage-registry.cjs');
const {connectorPaths}=require('../scripts/reconcile-passage-connectors.cjs');
const {inMunicipality}=require('../scripts/analyse-passage-reconciliation.cjs');
const {officialPassageCatalog,passageFingerprint}=require('../dist/src/exam-centres/official-passage-catalog');
const {validateCompleteReview}=require('../scripts/prepare-complete-passage-review.cjs');
const {apply,pendingReviewState}=require('../scripts/apply-complete-passage-review.cjs');
const {sourceReviewCounts}=require('../dist/src/routes/official-route-foundation.service');
const road=(id,name,coordinates,change={})=>({id,properties:{LSTRNM:name,RSTRNM:name,LGEMEENTE:'Hasselt',TGBEP:1,STATUS:4,LBLMORF:'weg bestaande uit één rijbaan',...change},geometry:{type:'LineString',coordinates}});
test('junction evidence requires shared endpoints, never an arbitrary planar crossing',()=>{
 const p={junction:'First - Second'};
 const a=road('a','First',[[5,50],[5,50.001]]),b=road('b','Second',[[4.999,50.0005],[5.001,50.0005]]);
 assert.equal(directCandidates(p,[a,b]).candidates.length,0);
 b.geometry.coordinates=[[5,50.001],[5.001,50.001]];
 assert.equal(directCandidates(p,[a,b]).candidates[0].publicDriving,true);
 b.properties.TGBEP=4;assert.equal(directCandidates(p,[a,b]).candidates[0].publicDriving,false);
});
test('discovery aliases are exact normalized alternatives, not fuzzy name matching',()=>{
 assert.equal(matches(road('a','Jozef Droogmansstraat',[]),'Sint-Lambertusstraat'),true);
 assert.equal(matches(road('a','Beukenlaan',[]),'Beukenhofstraat'),false);
 assert.equal(matches(road('a','Daniëlsstraatje',[]),'Daniëlstraat'),false);
});
test('municipality scope disambiguates same-name towns and explicitly includes districts only',()=>{
 assert.equal(inMunicipality(road('a','First',[]),'Hasselt'),true);
 assert.equal(inMunicipality(road('a','First',[],{LGEMEENTE:'Diest'}),'Hasselt'),false);
 assert.equal(inMunicipality(road('a','First',[],{LGEMEENTE:'Antwerpen'}),'Deurne'),true);
 assert.equal(inMunicipality(road('a','First',[],{LGEMEENTE:'Edegem'}),'Kontich'),false);
});
test('public connectors respect topology, length, access and driving morphology',()=>{
 const a=road('a','First',[[5,50],[5.001,50]]),b=road('b','Second',[[5.002,50],[5.003,50]]),link=road('c','nvt',[[5.001,50],[5.002,50]]);
 assert.equal(connectorPaths([a,b,link],'First','Second').length,1);
 for(const change of [{TGBEP:4},{STATUS:1},{LBLMORF:'wandel- of fietsweg, niet toegankelijk voor andere voertuigen'}])assert.equal(connectorPaths([a,b,{...link,properties:{...link.properties,...change}}],'First','Second').length,0);
 link.geometry.coordinates=[[5.001,50],[5.002,50.01],[5.002,50]];
 assert.equal(connectorPaths([a,b,link],'First','Second').length,0);
 assert.equal(connectorPaths([a,b],'First','Second').length,0);
});
const preserved={alken:[18,32],bree:[1,22],'antwerp-north':[1,12],'antwerp-geel':[2,10],'antwerp-kontich':[13,21],haasrode:[6,7,9]};
function fixture(){
 const centres=officialPassageCatalog.map((c,i)=>({slug:c.slug,points:c.points.map(p=>{
  const base={...p,sourceFingerprint:passageFingerprint({...p,sourceUrl:c.sourceUrl,sourceRevision:c.sourceRevision})};
  if(p.duplicateOfSequence!==null)return {...base,disposition:'SOURCE_DUPLICATE'};
  const loc={latitude:50+i*.01+p.sequence*.0001,longitude:5+i*.01};
  return {...base,...loc,disposition:preserved[c.slug].includes(p.sequence)?'PRESERVE_PUBLISHED_REVIEW':'REVIEW_LOCATION',method:'GOVERNMENT_SHARED_ENDPOINT',notes:'Synthetic unit-test evidence only. This is not an actual location review and must never be published or seeded into production.'.repeat(2),roads:[road('synthetic','TEST road',[])],evidence:[{url:'https://geo.api.vlaanderen.be/TEST-SYNTHETIC',sha256:'a'.repeat(64)}]};
 })}));
 const bundle={status:'EXPLICIT_REMOTE_SOURCE_LOCATION_REVIEW',reviewedAt:new Date().toISOString(),evidenceSha256:'a'.repeat(64),instructorApproved:false,officialExamItinerary:false,centres};
 const points=centres.flatMap((c,i)=>c.points.map(p=>{const src=officialPassageCatalog.find(x=>x.slug===c.slug);return {...p,id:`p-${i}-${p.sequence}`,centreId:c.slug,sourceUrl:src.sourceUrl,sourceRevision:src.sourceRevision,latitude:p.disposition==='PRESERVE_PUBLISHED_REVIEW'?p.latitude:null,longitude:p.disposition==='PRESERVE_PUBLISHED_REVIEW'?p.longitude:null,verificationStatus:p.disposition==='PRESERVE_PUBLISHED_REVIEW'?'VERIFIED':'PENDING_REVIEW',verifiedAt:p.disposition==='PRESERVE_PUBLISHED_REVIEW'?new Date('2026-10-18'):null,verifiedBy:p.disposition==='PRESERVE_PUBLISHED_REVIEW'?'old-reviewer':null,notes:null};}));
 const state={points,audits:[],routes:[]},locks=[];
 const db={
  user:{findUnique:async()=>({id:'approved-admin',role:'ADMIN'})},
  examCentre:{findUnique:async({where})=>({id:where.slug,officialPassagePoints:state.points.filter(p=>p.centreId===where.slug)})},
  officialPassagePoint:{findUnique:async({where})=>state.points.find(p=>p.id===where.id),update:async({where,data})=>Object.assign(state.points.find(p=>p.id===where.id),data)},
  route:{findMany:async()=>state.routes},auditLog:{create:async({data})=>state.audits.push(data)},
  $queryRawUnsafe:async(sql,id)=>{locks.push(id);return [];},
  $transaction:async fn=>{const copy=structuredClone(state);try{return await fn(db);}catch(e){Object.assign(state,copy);throw e;}}
 };
 return {bundle,db,state,locks};
}
test('complete review requires exact six sources, 13 preserved, 140 new reviews and 3 excluded duplicates',()=>{
 const f=fixture();assert.deepEqual(validateCompleteReview(f.bundle),{preserved:13,reviewed:140,duplicates:3,total:156});
 for(const change of [b=>b.centres.pop(),b=>b.centres[0].points.pop(),b=>b.centres[0].points[0].sourceFingerprint='changed',b=>b.centres[0].points[0].latitude=52,b=>b.centres[0].points[0].roads[0].properties.TGBEP=4,b=>b.centres[0].points[0].notes='',b=>b.instructorApproved=true,b=>b.reviewedAt='not-a-date',b=>b.reviewedAt=new Date(Date.now()+120000).toISOString(),b=>b.centres.find(c=>c.slug==='antwerp-geel').points[10].latitude=50]){
  const copy=structuredClone(f.bundle);change(copy);assert.throws(()=>validateCompleteReview(copy));
 }
});
test('coordinate-only release records actor, preserves existing reviews and is exactly idempotent',async()=>{
 const f=fixture(),before=structuredClone(f.state.points.filter(p=>p.verificationStatus==='VERIFIED'));
 const first=await apply(f.db,f.bundle,{actorEmail:'administrator@example.invalid'});assert.equal(first.changed,140);
 assert.equal(f.locks.length>=156,true);assert.equal(f.state.audits.length,141);
 assert.deepEqual(f.state.points.filter(p=>p.verifiedBy==='old-reviewer'),before);
 assert.equal(f.state.points.filter(p=>p.verificationStatus==='VERIFIED').length,153);
 assert.equal(f.state.points.filter(p=>p.verifiedBy==='approved-admin').length,140);
 assert.equal((await apply(f.db,f.bundle,{actorEmail:'administrator@example.invalid'})).changed,0);assert.equal(f.state.audits.length,141);
});
test('all-centre forced conflict rolls back every coordinate and audit',async()=>{
 const f=fixture(),before=structuredClone(f.state);
 await assert.rejects(apply(f.db,f.bundle,{actorEmail:'administrator@example.invalid',forceConflict:true}),/STAGING_FORCED_LATE_ROLLBACK/);
 assert.deepEqual(f.state,before);
});
test('a known unreviewed coordinate requires an exact preimage and cannot override later edits or review',async()=>{
 const f=fixture(),point=f.state.points[0],entry=f.bundle.centres[0].points[0];
 point.latitude=50.2;point.longitude=5.2;
 await assert.rejects(apply(f.db,f.bundle,{actorEmail:'administrator@example.invalid'}),/must not be overwritten/);
 entry.expectedPendingStateSha256=pendingReviewState(f.state.points[0]);
 const changed=structuredClone(f.bundle);changed.centres[0].points[0].expectedPendingStateSha256='0'.repeat(64);
 await assert.rejects(apply(f.db,changed,{actorEmail:'administrator@example.invalid'}),/must not be overwritten/);
 await apply(f.db,f.bundle,{actorEmail:'administrator@example.invalid'});
 assert.equal(f.state.points[0].latitude,entry.latitude);
 assert.equal(f.state.points[0].verifiedBy,'approved-admin');
});
test('role, source conflict, existing location and published proof are fail-closed before any write',async()=>{
 for(const change of [f=>f.db.user.findUnique=async()=>({id:'learner',role:'LEARNER'}),f=>f.state.points[0].junction='Changed operator row',f=>f.state.points[0].latitude=50,f=>f.state.points.find(p=>p.verifiedBy==='old-reviewer').longitude=6,f=>f.state.routes.push({foundation:{points:[{id:f.state.points[0].id}]}})]){
  const f=fixture();change(f);await assert.rejects(apply(f.db,f.bundle,{actorEmail:'administrator@example.invalid'}));assert.equal(f.state.audits.length,0);
 }
});
test('public completion counters exclude duplicates, require current source and expose no private locations',()=>{
 const f=fixture(),source=officialPassageCatalog.find(c=>c.slug==='antwerp-geel');
 const points=f.state.points.filter(p=>p.centreId===source.slug).map(p=>p.duplicateOfSequence===null?{...p,latitude:50,longitude:5,verificationStatus:'VERIFIED',verifiedAt:new Date(),verifiedBy:'test-reviewer'}:p);
 const summary=sourceReviewCounts(source,points);
 assert.deepEqual(summary,{eligibleEntryCount:24,duplicateEntryCount:3,pendingPointCount:0,reviewComplete:true});
 assert.equal(JSON.stringify(summary).includes('latitude'),false);
 assert.equal(sourceReviewCounts(source,points.filter(p=>p.duplicateOfSequence===null)).reviewComplete,false);
 points[0].junction='Stale operator name';
 assert.equal(sourceReviewCounts(source,points).pendingPointCount,1);
 assert.equal(sourceReviewCounts(source,points).reviewComplete,false);
 assert.equal(sourceReviewCounts(null,[]).reviewComplete,false);
});
