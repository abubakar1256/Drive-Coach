const {test} = require('node:test');
const assert = require('node:assert/strict');
const {buildDriveReport, gpsObservation, reviewItems} = require('../dist/src/learning/drive-report');
const {LearningService} = require('../dist/src/learning/learning.service');
const start = Date.parse('2026-10-15T10:00:00Z');
const snapshot = {geometry:[[5,50],[5.01,50]],points:[[5,50],[5.005,50],[5.01,50]],distanceM:715};
const session = {id:'s',startedAt:new Date(start),completedAt:new Date(start+60000),completionPct:25,visitedPoints:1,routeSnapshot:snapshot};
const sample = (sec, longitude=5, latitude=50, accuracyM=5, speedKph=30) => ({longitude,latitude,accuracyM,speedKph,recordedAt:new Date(start+sec*1000)});

test('no GPS means insufficient evidence, never 100% or zero mistakes',()=>{
 const r=buildDriveReport(session,[]); assert.equal(r.gps.coveragePct,0); assert.equal(r.gps.confidence,'low');assert.equal(r.gps.maxSpeedKph,null);assert.equal(r.completionPct,25);assert.equal(r.points.unconfirmed,2);assert.equal(r.events.length,0);assert.match(r.limitations.join(' '),/not necessarily missed/);
});
test('weak and missing accuracy cannot create deviation evidence or speed claims',()=>{
 for(const accuracy of [null,100,-1]){ const data=[sample(0,5,50.002,accuracy),sample(5,5,50.002,accuracy),sample(10,5,50.002,accuracy)];const r=buildDriveReport(session,data);assert.equal(r.events.length,0);assert.equal(r.gps.usableSamples,0);assert.equal(r.gps.maxSpeedKph,null);assert.equal(r.track.length,0); }
});
test('sustained accurate deviations carry location, time and uncertainty',()=>{
 const r=buildDriveReport(session,[sample(0,5,50.002),sample(3,5,50.002),sample(6,5,50.002),sample(9,5,50.002)]);assert.equal(r.events.length,1);assert.equal(r.events[0].latitude,50.002);assert.equal(r.events[0].at,new Date(start).toISOString());assert.equal(r.events[0].confidence,'medium');assert.match(r.events[0].detail,/not proof/);assert.equal(r.completionPct,25);
});
test('single outlier, GPS jumps and gaps do not become sustained deviations',()=>{
 for(const points of [[sample(0),sample(5,5,50.002),sample(10)],[sample(0),sample(1,7,52),sample(2,7,52)],[sample(0,5,50.002),sample(31,5,50.002),sample(62,5,50.002)]])assert.equal(buildDriveReport(session,points).events.length,0);
});
test('near-route samples, jitter and unreliable speeds are handled conservatively',()=>{
 const r=buildDriveReport(session,[sample(0),sample(5,5.000001,50,5,null),sample(10,5,50,5,-1),sample(15,5,50,5,999)]);assert.equal(r.events.length,0);assert.equal(r.gps.distanceM,0);assert.equal(r.gps.maxSpeedKph,30);assert.equal(r.gps.coveragePct,25);assert.equal(gpsObservation(snapshot,sample(0)).status,'near_route');
});
test('distance accumulates slow movement across uncertainty-sized steps without counting tiny jitter',()=>{
 const r=buildDriveReport(session,Array.from({length:12},(_,i)=>sample(i,5+i*.00005,50,10,12)));assert.ok(r.gps.distanceM>20);assert.ok(r.gps.distanceM<50);
});
test('review DTO rejects missing source, array ratings, and excessive notes',async()=>{
 const {validate}=require('class-validator');const {SaveDriveReviewDto}=require('../dist/src/learning/dto/learning.dto');
 for(const body of [{source:'official',ratings:{},notes:''},{source:'self',ratings:[],notes:''},{source:'self',ratings:{},notes:'x'.repeat(2001)}]){assert.ok((await validate(Object.assign(new SaveDriveReviewDto(),body))).length>0);}
 assert.equal((await validate(Object.assign(new SaveDriveReviewDto(),{source:'self',ratings:{},notes:''}))).length,0);
});
test('plot segments break across interruptions and weak signal',()=>{
 const r=buildDriveReport(session,[sample(0),sample(3),sample(5,5,50,100),sample(8),sample(45)]);assert.notEqual(r.track[1].segment,r.track[2].segment);assert.notEqual(r.track[2].segment,r.track[3].segment);assert.equal(r.gps.gaps,1);
});
test('manual review is preserved separately from GPS findings',()=>{
 const review={source:'self',ratings:{mirrors:'practice'},notes:'Work on observation'};const r=buildDriveReport({...session,routeSnapshot:{...snapshot,coachingReview:review}},[]);assert.deepEqual(r.review,review);assert.equal(r.events.length,0);assert.equal(reviewItems.length,12);
});
test('report is owner-scoped before any track access',async()=>{
 let readTrack=false;const service=new LearningService({practiceSession:{findFirst:async args=>{assert.deepEqual(args.where,{id:'s',userId:'outsider'});return null;}},practiceTrackPoint:{findMany:async()=>{readTrack=true;return[];}}});await assert.rejects(service.driveReport('outsider','s'),/not found/);assert.equal(readTrack,false);
});
test('report reads saved session snapshot, not regenerated or newly paid route data',async()=>{
 const service=new LearningService({practiceSession:{findFirst:async()=>({...session,route:{name:'A',slug:'a'}})},practiceTrackPoint:{findMany:async args=>{assert.equal(args.where.sessionId,'s');assert.equal(args.take,20001);return[];}}},null,{requireAccess:async()=>({})});const r=await service.driveReport('owner','s');assert.equal(r.id,'s');assert.deepEqual(r.geometry,snapshot.geometry);assert.equal(r.truncated,false);
});
test('expired paid access hides saved route geometry but keeps personal report',async()=>{
 const {ForbiddenException}=require('@nestjs/common');const service=new LearningService({practiceSession:{findFirst:async()=>({...session,route:{name:'B',slug:'b'}})},practiceTrackPoint:{findMany:async()=>[]}},null,{requireAccess:async()=>{throw new ForbiddenException();}});const r=await service.driveReport('u','s');assert.equal(r.routeVisible,false);assert.deepEqual(r.geometry,[]);assert.equal(r.completionPct,25);
});
test('checklist save requires owner, ended session and allowed rating keys',async()=>{
 const dto={source:'self',ratings:{mirrors:'good'},notes:'Good routine'};
 for(const target of [null,{...session,completedAt:null}]){let saved=false;const tx={$queryRawUnsafe:async()=>[],practiceSession:{findFirst:async args=>{assert.equal(args.where.userId,'u');return target;},update:async()=>{saved=true;}}};const service=new LearningService({$transaction:fn=>fn(tx)});await assert.rejects(service.saveDriveReview('u','s',dto));assert.equal(saved,false);}
 const service=new LearningService({});await assert.rejects(service.saveDriveReview('u','s',{...dto,ratings:{pass_fail:'good'}}),/Invalid/);await assert.rejects(service.saveDriveReview('u','s',{...dto,ratings:{mirrors:'passed'}}),/Invalid/);
});
test('saving review is additive, bounded, audited, and does not overwrite reflection or progress',async()=>{
 let written,audited=false;const tx={$queryRawUnsafe:async()=>[],practiceSession:{findFirst:async()=>session,update:async args=>{written=args.data;}},auditLog:{create:async args=>{assert.equal(args.data.action,'DRIVE_REVIEW_SAVED');audited=true;}}};await new LearningService({$transaction:fn=>fn(tx)}).saveDriveReview('u','s',{source:'instructor_reported',ratings:{signals:'practice'},notes:'Review signal timing'});assert.deepEqual(written.routeSnapshot.geometry,snapshot.geometry);assert.deepEqual(Object.keys(written),['routeSnapshot']);assert.equal(written.routeSnapshot.coachingReview.source,'instructor_reported');assert.equal(audited,true);
});
test('off-route and poor accuracy samples are stored without increasing progress',async()=>{
 for(const accuracy of [5,150]){let stored=false,progress=false;const active={...session,completedAt:null,progressM:0,visitedPoints:0};const tx={$queryRawUnsafe:async()=>[],practiceSession:{findFirst:async()=>active,update:async()=>{progress=true;}},practiceTrackPoint:{findFirst:async()=>null,create:async()=>{stored=true;}}};const r=await new LearningService({$transaction:fn=>fn(tx)}).recordTrackPoint('u','s',{longitude:5,latitude:50.002,accuracyM:accuracy});assert.equal(stored,true);assert.equal(progress,false);assert.equal(r.accepted,false);assert.equal(r.completionPct,25);assert.equal(r.feedback.status,accuracy===5?'possible_deviation':'weak_signal');}
});
test('stale positions do not become live evidence or recorded samples',async()=>{
 const tx={$queryRawUnsafe:async()=>[],practiceSession:{findFirst:async()=>({...session,completedAt:null})},practiceTrackPoint:{create:async()=>{throw Error('must not store');}}};const r=await new LearningService({$transaction:fn=>fn(tx)}).recordTrackPoint('u','s',{longitude:5,latitude:50,accuracyM:5,recordedAt:'2020-01-01T00:00:00Z'});assert.equal(r.reason,'STALE_GPS');assert.equal(r.feedback.status,'unavailable');
});
