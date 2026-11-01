// Isolated synthetic PostgreSQL + actual service/concurrency checks. No live DB,
// routing generation, payment provider or email calls. --preview is local only.
require('reflect-metadata');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {LearningService}=require('../dist/src/learning/learning.service');
const {RouteAccessService}=require('../dist/src/routes/route-access.service');
const {BillingService}=require('../dist/src/billing/billing.service');
const {MediaService}=require('../dist/src/media/media.service');
const {PreparationService}=require('../dist/src/learning/preparation.service');
const {coverageFingerprint}=require('../dist/src/learning/personalization-policy');
const {sessionReviews}=require('../dist/src/learning/session-reviews');
const {snapshotDistance}=require('../dist/src/learning/practice-progress');
async function main(){
 const root=path.resolve(__dirname,'../../output/db-backups'),bin=path.join(root,'pg18-tools/pgsql/bin'),dir=path.join(root,'phase4-synthetic-'+Date.now()),data=path.join(dir,'data'),pwfile=path.join(dir,'password');
 if(!dir.startsWith(root+path.sep)||!fs.existsSync(path.join(bin,'initdb.exe')))throw Error('Workspace PostgreSQL tools required');
 fs.mkdirSync(dir,{mode:0o700});const password=crypto.randomBytes(32).toString('hex');fs.writeFileSync(pwfile,password,{flag:'wx',mode:0o600});
 const env={...process.env,PGHOST:'127.0.0.1',PGPORT:'15449',PGUSER:'phase4_synthetic',PGPASSWORD:password,PGDATABASE:'phase4_synthetic'};
 function run(name,args){const r=cp.spawnSync(path.join(bin,name+'.exe'),args,{env,windowsHide:true,stdio:name==='pg_ctl'?'ignore':['ignore','pipe','pipe'],timeout:180000});if(r.status!==0||r.error){fs.writeFileSync(path.join(dir,name+'-error.log'),String(r.stderr??r.error));throw Error('Isolated '+name+' failed');}}
 let started=false,db,apiChild;const originalFetch=global.fetch,oldMediaProvider=process.env.MEDIA_PROVIDER;process.env.MEDIA_PROVIDER="database";let providerCalls=0;
 global.fetch=async()=>{providerCalls++;throw Error('EXTERNAL_HTTP_FORBIDDEN');};
 try{
  run('initdb',['-D',data,'-U',env.PGUSER,'--pwfile',pwfile,'--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C']);run('pg_ctl',['-D',data,'-l',path.join(dir,'server.log'),'-o','-h 127.0.0.1 -p 15449','-w','start']);started=true;run('createdb',['--maintenance-db=postgres',env.PGDATABASE]);
  const migrations=path.resolve(__dirname,'../prisma/migrations');for(const name of fs.readdirSync(migrations).filter(n=>fs.existsSync(path.join(migrations,n,'migration.sql'))).sort())run('psql',['-v','ON_ERROR_STOP=1','-f',path.join(migrations,name,'migration.sql')]);
  const url=new URL('postgresql://127.0.0.1:15449/phase4_synthetic');url.username=env.PGUSER;url.password=password;db=new PrismaClient({datasourceUrl:url.toString(),log:[]});
  const testPassword='LocalPreviewOnly-Phase4!',passwordHash=await require('bcrypt').hash(testPassword,10);
  const user=await db.user.create({data:{email:'phase4-preview@example.invalid',displayName:'Synthetic Phase 4 preview',emailVerifiedAt:new Date(),passwordHash}}), other=await db.user.create({data:{email:'phase4-other@example.invalid',passwordHash,emailVerifiedAt:new Date()}});
  const centre=await db.examCentre.create({data:{slug:'phase4-synthetic',name:'SYNTHETIC TEST CENTRE · DO NOT DRIVE',city:'TEST',region:'TEST',isPublished:true}}), otherCentre=await db.examCentre.create({data:{slug:'phase4-other',name:'Other synthetic centre',city:'TEST',region:'TEST',isPublished:true}});
  const route=await db.route.create({data:{centreId:centre.id,slug:'phase4-synthetic-route',name:'SYNTHETIC DEMO · DO NOT DRIVE',status:'PUBLISHED',verificationStatus:'ROAD_VALIDATED',reviewedBy:user.id,durationMin:25}}), otherRoute=await db.route.create({data:{centreId:otherCentre.id,slug:'phase4-other-route',name:'SYNTHETIC OTHER',status:'PUBLISHED',verificationStatus:'ROAD_VALIDATED',reviewedBy:user.id,durationMin:25}});
  const geometry=[[4,50],[4.01,50],[4.01,50.01],[4,50.01],[4,50]];
  for(let i=0;i<geometry.length;i++)await db.routePoint.create({data:{routeId:route.id,sequence:i+1,title:i===0?'Synthetic start':i===4?'Synthetic return':'Synthetic point '+i,category:i===2?'roundabout':'warning',longitude:geometry[i][0],latitude:geometry[i][1]}});
  const points=await db.routePoint.findMany({where:{routeId:route.id},orderBy:{sequence:'asc'}}),snapshot={geometry,points:geometry,distanceM:snapshotDistance(geometry),durationSec:1500,routeVersion:route.version,routeFingerprint:coverageFingerprint({...route,points})};
  const plan=await db.plan.findUnique({where:{id:'basic_1month'}});assert.ok(plan);
  const subscription=await db.subscription.create({data:{userId:user.id,planId:plan.id,centreId:centre.id,status:'ACTIVE',startsAt:new Date(Date.now()-1000),expiresAt:new Date(Date.now()+86400000)}});
  const protectedBefore=JSON.stringify({plans:await db.plan.findMany({orderBy:{id:'asc'}}),subscriptions:await db.subscription.findMany({orderBy:{id:'asc'}}),trials:await db.routeTrial.findMany(),payments:await db.payment.findMany()});
  const access=new RouteAccessService(db,{}),billing=new BillingService(db,{}),service=new LearningService(db,{requireValid:async()=>{throw Error('No provider request during saved-session operations');}},access,billing),media=new MediaService(db,access);
  const ended=await db.practiceSession.create({data:{userId:user.id,routeId:route.id,routeSnapshot:snapshot,startedAt:new Date(Date.now()-1500000),completedAt:new Date(),completionKind:'ENDED',completionPct:40,visitedPoints:2}});
  await db.practiceSession.create({data:{userId:other.id,routeId:route.id,routeSnapshot:snapshot,completedAt:new Date(),completionKind:'COMPLETED',completionPct:100}});
  const feedback=(source,notes,expectedSavedAt=null)=>({source,notes,ratings:{mirrors:'practice',signals:'good'},expectedSavedAt,parked:true});
  await Promise.all([service.saveDriveReview(user.id,ended.id,feedback('self','SYNTHETIC SELF')),service.saveDriveReview(user.id,ended.id,feedback('instructor_reported','SYNTHETIC SUPERVISOR'))]);
  let report=await service.driveReport(user.id,ended.id);assert.equal(report.reviews.length,2);assert.deepEqual(report.geometry,geometry);assert.equal(report.completionPct,40);assert.equal(report.events.length,0);
  const self=report.reviews.find(r=>r.source==='self');const race=await Promise.allSettled([service.saveDriveReview(user.id,ended.id,feedback('self','Edit A',self.savedAt)),service.saveDriveReview(user.id,ended.id,feedback('self','Edit B',self.savedAt))]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.filter(r=>r.status==='rejected').length,1);
  await assert.rejects(service.driveReport(other.id,ended.id),/not found/);
  await assert.rejects(service.saveDriveReview(other.id,ended.id,feedback('self','not mine')),/not found/);
  const beforeRollback=JSON.stringify((await db.practiceSession.findUnique({where:{id:ended.id}})).routeSnapshot);
  const failingDb=new Proxy(db,{get(target,key){if(key==='$transaction')return fn=>target.$transaction(tx=>fn(new Proxy(tx,{get(t,k){if(k==='auditLog')return{create:async()=>{throw Error('FORCED_AUDIT_FAILURE');}};return Reflect.get(t,k);}})));return Reflect.get(target,key);}});
  const current=sessionReviews(JSON.parse(beforeRollback)).find(r=>r.source==='instructor_reported');await assert.rejects(new LearningService(failingDb).saveDriveReview(user.id,ended.id,feedback('instructor_reported','ROLLBACK',current.savedAt)),/FORCED_AUDIT_FAILURE/);assert.equal(JSON.stringify((await db.practiceSession.findUnique({where:{id:ended.id}})).routeSnapshot),beforeRollback);
  const repeat=await service.repeatSession(user.id,ended.id,route.id);assert.notEqual(repeat.id,ended.id);assert.deepEqual(repeat.routeSnapshot.geometry,geometry);assert.ok(!repeat.routeSnapshot.coachingReview&&!repeat.routeSnapshot.coachingReviews);
  const resumed=await service.sessionState(user.id,repeat.id);assert.equal(resumed.completionPct,0);assert.deepEqual(resumed.routeSnapshot.geometry,geometry);
  await assert.rejects(service.sessionState(other.id,repeat.id),/not found/);await assert.rejects(service.repeatSession(user.id,ended.id,route.id),/active practice/);
  let status=await service.practiceStatus(user.id,centre.slug);assert.equal(status.items.length,1);assert.equal(status.items[0].attempts,2);assert.equal(status.items[0].completedDrives,0);assert.equal(status.items[0].activeSessionId,repeat.id);assert.ok(!('routeSnapshot'in status.items[0]));
  assert.equal((await service.practiceStatus(other.id,centre.slug)).items[0].completedDrives,1);
  const noGps=await service.updateSession(user.id,repeat.id,{complete:true});assert.equal(noGps.completionKind,'ENDED');assert.equal(noGps.completionPct,0);
  for(let i=0;i<10;i++)await db.practiceSession.create({data:{userId:user.id,routeId:route.id,routeSnapshot:snapshot,startedAt:new Date(Date.now()-((i+1)*86400000)),completedAt:new Date(),completionKind:i===0?'COMPLETED':'ENDED',completionPct:i===0?100:10}});
  const dashboard=await service.dashboard(user.id);assert.equal(dashboard.stats.sessionCount,12);assert.equal(dashboard.sessions.length,8);assert.equal(dashboard.stats.completedSessions,1);
  const trends=await new PreparationService(db).get(user.id,true);assert.equal(trends.history.sessionCount,1);assert.equal(trends.history.skills.find(s=>s.code==='observation').basis.length,2);
  const png=fs.readFileSync(path.resolve(__dirname,'../content/learning-media/observation.png'));const asset=await media.uploadFile(user.id,points[0].id,{buffer:png,originalname:'synthetic-owned.png',mimetype:'image/png',size:png.length},{rightsType:'OWNED',rightsHolder:'SYNTHETIC TEST PROJECT',licenseName:'Original test image',permissionConfirmed:true});
  assert.equal((await media.description(user.id,asset.id)).rights.verification,'UPLOADER_DECLARED');await assert.rejects(media.file(other.id,asset.id),/trial|choose|Basic|Premium/);
  assert.equal((await media.learningFile(user.id,route.id,'observation','video')).mimeType,'video/mp4');await assert.rejects(media.learningFile(user.id,otherRoute.id,'observation','video'),/trial|choose|Basic|Premium/);await assert.rejects(media.learningFile(other.id,route.id,'observation','video'),/trial|choose|Basic|Premium/);
  await db.subscription.update({where:{id:subscription.id},data:{status:'CANCELLED'}});const expired=await service.driveReport(user.id,ended.id);assert.deepEqual(expired.geometry,[]);assert.equal(expired.reviews.length,2);await assert.rejects(media.learningFile(user.id,route.id,'observation','video'),/trial|choose|Basic|Premium/);await db.subscription.update({where:{id:subscription.id},data:{status:'ACTIVE'}});
  const protectedAfter=JSON.stringify({plans:await db.plan.findMany({orderBy:{id:'asc'}}),subscriptions:(await db.subscription.findMany({orderBy:{id:'asc'}})).map(s=>({...s,updatedAt:JSON.parse(protectedBefore).subscriptions.find(x=>x.id===s.id)?.updatedAt})),trials:await db.routeTrial.findMany(),payments:await db.payment.findMany()});assert.equal(protectedAfter,protectedBefore);assert.equal(providerCalls,0);
  const result={checkedAt:new Date().toISOString(),syntheticDatabaseOnly:true,actualOwnerIsolation:true,realSqlStatusPassed:true,fullHistoryTotalsPassed:true,separateFeedbackConcurrencyPassed:true,staleFeedbackRejected:true,lateAuditRollbackPassed:true,savedGeometryResumeAndRepeatPassed:true,noGpsDoesNotComplete:true,mediaRightsRecorded:true,exactCentreMediaAccessPassed:true,expiredGeometryRedacted:true,plansTrialsPaymentsPreserved:true,providerHttpRequests:providerCalls,productionChanged:false};fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  if(process.argv.includes('--preview')){
    const log=fs.openSync(path.join(dir,'preview-api.log'),'a');apiChild=cp.spawn(process.execPath,['dist/src/main.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,DATABASE_URL:url.toString(),NODE_ENV:'development',PORT:'4014',WEB_ORIGIN:'http://localhost:3104',JWT_ACCESS_SECRET:crypto.randomBytes(32).toString('hex'),NOTIFICATION_SCHEDULER_ENABLED:'false',MAPBOX_DIRECTIONS_TOKEN:'',NEXT_PUBLIC_MAPBOX_TOKEN:'',MEDIA_PROVIDER:'database'},windowsHide:true,stdio:['ignore',log,log]});fs.closeSync(log);
    const preview=path.join(root,'phase4-preview.json');fs.writeFileSync(preview,JSON.stringify({email:user.email,password:testPassword,apiPort:4014,routeId:route.id,otherRouteId:otherRoute.id,routeSlug:route.slug,reportId:ended.id,apiPid:apiChild.pid,stopFile:path.join(dir,'stop-preview'),syntheticOnly:true},null,2),{mode:0o600});console.log('SYNTHETIC preview ready; private connection and login details remain in ignored output.');
    await new Promise(resolve=>{let timer,limit;const stop=()=>{clearInterval(timer);clearTimeout(limit);resolve();};timer=setInterval(()=>{if(fs.existsSync(path.join(dir,'stop-preview')))stop();},1000);limit=setTimeout(stop,900000);process.once('SIGINT',stop);process.once('SIGTERM',stop);});
    if(fs.existsSync(preview))fs.unlinkSync(preview);
  }
 }finally{global.fetch=originalFetch;if(oldMediaProvider===undefined)delete process.env.MEDIA_PROVIDER;else process.env.MEDIA_PROVIDER=oldMediaProvider;if(apiChild&&apiChild.exitCode===null){apiChild.kill();await new Promise(r=>apiChild.once('exit',r));}if(db)await db.$disconnect();if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);if(fs.existsSync(pwfile))fs.unlinkSync(pwfile);}
}
main().catch(e=>{console.error(e instanceof assert.AssertionError?e.message:String(e?.name||'error'));process.exitCode=1;});
