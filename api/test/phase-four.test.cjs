const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'),crypto=require('node:crypto');
const {LearningService}=require('../dist/src/learning/learning.service');
const {sessionReviews,withoutSessionFeedback}=require('../dist/src/learning/session-reviews');
const {coverageFingerprint}=require('../dist/src/learning/personalization-policy');
const {checkedMediaRights}=require('../dist/src/media/media-rights');
const {MediaService}=require('../dist/src/media/media.service');
const geometry=[[4,50],[4.01,50],[4.01,50.01],[4,50.01],[4,50]], points=geometry.map(([longitude,latitude],i)=>({id:'p'+i,sequence:i+1,longitude,latitude}));
const route={id:'r',version:1,points}, base={geometry,points:geometry,durationSec:1500,distanceM:3000,routeVersion:1,routeFingerprint:coverageFingerprint(route)};
function reviewsFixture(snapshot={...base}) {
 const state={id:'s',routeId:'r',userId:'u',completedAt:new Date(),routeSnapshot:snapshot};
 const db={ $queryRawUnsafe:async()=>[],practiceSession:{findFirst:async({where})=>where.userId==='u'?state:null,update:async({data})=>Object.assign(state,data)},auditLog:{create:async()=>{}},$transaction:async f=>f(db)};
 return{state,service:new LearningService(db)};
}
const dto=(source,notes,expectedSavedAt=null)=>({source,ratings:{mirrors:'practice'},notes,parked:true,expectedSavedAt});
test('separate feedback sources preserve both reviews and exact route snapshot',async()=>{
 const f=reviewsFixture();await f.service.saveDriveReview('u','s',dto('self','Learner observation'));
 const first=f.state.routeSnapshot.coachingReview;
 const result=await f.service.saveDriveReview('u','s',dto('instructor_reported','Supervisor observation'));
 assert.equal(result.reviews.length,2);assert.equal(sessionReviews(f.state.routeSnapshot).find(r=>r.source==='self').notes,'Learner observation');
 assert.deepEqual(withoutSessionFeedback(f.state.routeSnapshot),base);
 await assert.rejects(f.service.saveDriveReview('u','s',dto('self','stale',null)),/another tab/);
 await f.service.saveDriveReview('u','s',dto('self','Updated observation',first.savedAt));
 assert.equal(sessionReviews(f.state.routeSnapshot).find(r=>r.source==='instructor_reported').notes,'Supervisor observation');
 assert.notEqual(f.state.routeSnapshot.coachingReview.savedAt,first.savedAt);
});
test('existing feedback requires its revision and cannot silently be replaced by a legacy stale client',async()=>{
 const old={source:'self',ratings:{signals:'good'},notes:'Saved',savedAt:'2026-10-20T10:00:00.000Z'}, f=reviewsFixture({...base,coachingReview:old});
 await assert.rejects(f.service.saveDriveReview('u','s',{source:'self',ratings:{},notes:'overwrite'}),/another tab/);
 assert.deepEqual(f.state.routeSnapshot.coachingReview,old);
 const repeat=withoutSessionFeedback({...f.state.routeSnapshot,coachingReviews:{self:old}});assert.deepEqual(repeat,base);assert.ok(f.state.routeSnapshot.coachingReview);
});
test('checklist refuses false parked attestation and still requires ownership',async()=>{
 const f=reviewsFixture();await assert.rejects(f.service.saveDriveReview('u','s',{...dto('self',''),parked:false}),/safely parked/);
 await assert.rejects(f.service.saveDriveReview('another','s',dto('self','')),/not found/);
 assert.ok(!f.state.routeSnapshot.coachingReview);
});
test('resume is owner-bound, returns only its saved geometry and makes no Directions call',async()=>{
 const session={id:'s',routeId:'r',userId:'u',completionPct:35,routeSnapshot:{...base,coachingReviews:{self:{notes:'not route data'}}}};
 const service=new LearningService({practiceSession:{findFirst:async({where})=>where.userId==='u'?session:null},routePoint:{findMany:async()=>points}},{requireValid:()=>{throw Error('No rerouting');}},{requireAccess:async()=>({route})});
 await assert.rejects(service.sessionState('outsider','s'),/not found/);
 const r=await service.sessionState('u','s');assert.equal(r.completionPct,35);assert.deepEqual(r.routeSnapshot,base);
 session.routeSnapshot.routeVersion=2;await assert.rejects(service.sessionState('u','s'),/older route version/);
});
test('resume after access expiry cannot expose saved paid geometry; ended reports keep only identity',async()=>{
 const {ForbiddenException}=require('@nestjs/common'); const session={id:'s',routeId:'r',completionPct:99,routeSnapshot:base};
 const service=new LearningService({practiceSession:{findFirst:async()=>session}},null,{requireAccess:async()=>{throw new ForbiddenException();}});
 await assert.rejects(service.sessionState('u','s'),ForbiddenException);
 session.completedAt=new Date();const ended=await service.sessionState('u','s');assert.ok(!('routeSnapshot'in ended));assert.equal(ended.reportHref,'/practice/s');
});
test('practice status uses account parameters and rejects malformed references before querying',async()=>{
 let parameters;const service=new LearningService({$queryRawUnsafe:async(sql,...p)=>{parameters=p;return[];}});
 await assert.rejects(service.practiceStatus('u',"alken'; DROP TABLE"),/Invalid/);
 const r=await service.practiceStatus('u','alken','r');assert.deepEqual(parameters,['u','alken','r']);assert.equal(r.ownerId,'u');assert.deepEqual(r.items,[]);
});
test('media requires a usage-rights declaration and an HTTPS source for third-party files',()=>{
 for(const v of [undefined,{}, {rightsType:'OWNED',permissionConfirmed:false}])assert.throws(()=>checkedMediaRights(v),/Confirm/);
 const owned={rightsType:'OWNED',rightsHolder:'Project',licenseName:'Original project image',permissionConfirmed:true};assert.equal(checkedMediaRights(owned).verification,'UPLOADER_DECLARED');
 for(const sourceUrl of [undefined,'http://example.test/license','https://name:secret@example.test/license'])assert.throws(()=>checkedMediaRights({...owned,rightsType:'LICENSED',sourceUrl}));
 assert.equal(checkedMediaRights({...owned,rightsType:'LICENSED',sourceUrl:'https://example.test/license'}).sourceUrl,'https://example.test/license');
});
test('learning video/image files enforce the current exact-route entitlement, including free trials',async()=>{
 let calls=[];const media=new MediaService({}, {requireAccess:async(u,r)=>{calls.push([u,r]);return{premium:false};}});
 await assert.rejects(media.learningFile('u','r','observation','video'),/Paid access/);assert.deepEqual(calls,[['u','r']]);
 const paid=new MediaService({}, {requireAccess:async(u,r)=>{assert.equal(r,'paid-route');return{premium:true};}});
 const video=await paid.learningFile('u','paid-route','roundabouts','video');assert.equal(video.mimeType,'video/mp4');assert.equal(video.buffer.toString('ascii',4,8),'ftyp');
 const captions=await paid.learningFile('u','paid-route','roundabouts','captions-nl');assert.match(captions.buffer.toString(),/WEBVTT/);
 await assert.rejects(paid.learningFile('u','paid-route','../secret','video'),/not found/);
});
test('packaged original media has matching hashes, four clips and accessible captions',()=>{
 const root=path.resolve(__dirname,'../content/learning-media'),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
 assert.equal(manifest.locationEvidence,false);assert.equal(manifest.lessons.length,4);assert.equal(manifest.durationSeconds,8);
 for(const lesson of manifest.lessons){assert.equal(lesson.files.length,4);for(const f of lesson.files){const bytes=fs.readFileSync(path.join(root,f.name));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),f.sha256);assert.ok(bytes.length>0);}assert.equal(lesson.transcriptEn.length,3);assert.equal(lesson.transcriptNl.length,3);}
});
