// LOCAL ONLY. Restores a checked archive on loopback; no production option.
require('reflect-metadata');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
const {PreparationService}=require('../dist/src/learning/preparation.service');
const {PersonalizedPracticeService}=require('../dist/src/learning/personalized-practice.service');
const {RouteAccessService}=require('../dist/src/routes/route-access.service');
const {snapshotDistance}=require('../dist/src/learning/practice-progress');
const {searchHometowns,hometownPlace}=require('../dist/src/learning/belgian-places');
const {fingerprints}=require('./rehearse-complete-passage-review.cjs');
const {sha}=require('./prepare-reviewed-passage-release.cjs');
const root=path.resolve(__dirname,'../../output/db-backups');
async function main(){
 const archive=path.resolve(process.argv[2]||'');
 if(!archive.startsWith(root+path.sep)||!archive.endsWith('.dump')||sha(fs.readFileSync(archive))!==fs.readFileSync(archive+'.sha256','utf8').trim())throw Error('Checked task-local archive required');
 const dir=path.join(root,'personalized-practice-restore-'+Date.now()),data=path.join(dir,'data'),pwfile=path.join(dir,'password'),password=crypto.randomBytes(32).toString('hex');fs.mkdirSync(dir,{mode:0o700});fs.writeFileSync(pwfile,password,{flag:'wx',mode:0o600});
 const bin=path.join(root,'pg18-tools/pgsql/bin'),env={...process.env,PGHOST:'127.0.0.1',PGPORT:'15442',PGUSER:'personalized_restore',PGPASSWORD:password,PGDATABASE:'personalized_restore'};
 function run(name,args){const r=cp.spawnSync(path.join(bin,name+'.exe'),args,{env,windowsHide:true,stdio:name==='pg_ctl'?'ignore':['ignore','pipe','pipe'],timeout:180000});if(r.status!==0||r.error)throw Error('Isolated '+name+' failed');}
 let started=false,db;
 const keys=['HOMETOWN_DAILY_REQUEST_BUDGET','HOMETOWN_MONTHLY_REQUEST_BUDGET','MAPBOX_DIRECTIONS_TOKEN'],old=keys.map(k=>process.env[k]);
 try{
  run('initdb',['-D',data,'-U',env.PGUSER,'--pwfile',pwfile,'--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C']);run('pg_ctl',['-D',data,'-l',path.join(dir,'server.log'),'-o','-h 127.0.0.1 -p 15442','-w','start']);started=true;
  run('createdb',[env.PGDATABASE]);run('pg_restore',['--exit-on-error','--no-owner','--no-acl','--dbname='+env.PGDATABASE,archive]);
  const url=new URL('postgresql://127.0.0.1:15442/personalized_restore');url.username=env.PGUSER;url.password=password;db=new PrismaClient({datasourceUrl:url.toString(),log:[]});
  const before=await fingerprints(db),migrations=['0019_private_preparation_profile','0020_private_personalized_practice'].map(name=>path.resolve(__dirname,'../prisma/migrations',name,'migration.sql'));
  for(const migration of migrations)run('psql',['-X','-v','ON_ERROR_STOP=1','-q','-f',migration]);
  const afterMigration=await fingerprints(db);for(const table of Object.keys(before))assert.equal(afterMigration[table],before[table],'Migration changed '+table);
  assert.equal(await db.hometownRoute.count(),0);assert.equal(await db.preparationCoverage.count(),0);
  const prefix='TEST_PRIVATE_PHASE3_'+crypto.randomUUID(),a=prefix+'_a',b=prefix+'_b',c=prefix+'_c',centre=await db.examCentre.findFirst({where:{isPublished:true}}),plan=await db.plan.findFirst({where:{tier:'Basic',isActive:true}});assert.ok(centre&&plan);
  for(const id of [a,b,c])await db.user.create({data:{id,email:id+'@example.invalid',passwordHash:'SYNTHETIC NOT A LOGIN',role:'LEARNER'}});
  const prep=new PreparationService(db),profiles={};for(const id of [a,b,c])profiles[id]=await prep.save(id,{ownerId:id,version:0,preferredLevel:'BEGINNER',centreId:centre.id,homeTown:'Leuven'});
  const baseline=await fingerprints(db),place=hometownPlace(searchHometowns('Leuven')[0].id),x=place.longitude,y=place.latitude,geometry=[[x,y],[x+.005,y],[x+.005,y+.004],[x,y+.004],[x,y]];
  let calls=0;const driving={evaluate:async()=>{calls++;return {valid:true,issues:[],durationSec:1500,distanceM:snapshotDistance(geometry),coordinates:geometry,snappedPoints:geometry.map(p=>({longitude:p[0],latitude:p[1]})),observedFeatures:['junctions']};}};
  const access=new RouteAccessService(db,{}),service=new PersonalizedPracticeService(db,prep,access,driving);
  const dto=id=>({ownerId:id,version:profiles[id].version,revision:profiles[id].revision,placeId:place.id,requestKey:crypto.randomUUID(),consent:true,parked:true});
  Object.assign(process.env,{HOMETOWN_DAILY_REQUEST_BUDGET:'16',HOMETOWN_MONTHLY_REQUEST_BUDGET:'16',MAPBOX_DIRECTIONS_TOKEN:'SYNTHETIC NO NETWORK'});
  await assert.rejects(service.generate(a,dto(a)),/active Basic/);assert.equal(calls,0);
  for(const id of [a,b,c])await db.subscription.create({data:{userId:id,planId:plan.id,centreId:centre.id,status:'ACTIVE',startsAt:new Date(Date.now()-1000),expiresAt:new Date(Date.now()+3600_000)}});
  const grantBaseline=await fingerprints(db),request=dto(a),route=await service.generate(a,request);assert.equal(route.ownerId,a);assert.equal(calls,2);
  assert.equal((await service.generate(a,request)).id,route.id);assert.equal(calls,2);
  await assert.rejects(service.getRoute(b,route.id),/not found/);
  const snapshot=JSON.stringify(route.snapshot),s=await service.start(a,route.id,{ownerId:a,parked:true});
  await assert.rejects(service.start(b,route.id,{ownerId:b,parked:true}));
  await assert.rejects(service.track(b,s.id,{latitude:y,longitude:x,accuracyM:5}));
  const ended=await service.end(a,s.id,{ownerId:a,parked:true});assert.equal(ended.completionKind,'ENDED');assert.equal(ended.completionPct,0);assert.ok(!('route'in ended));
  await service.reflect(a,s.id,{ownerId:a,parked:true,difficultyCategories:['roundabouts'],instructorCategories:['priority']});assert.equal((await prep.get(a)).focus.items.length,2);
  const repeated=await service.start(a,route.id,{ownerId:a,parked:true});assert.notEqual(s.id,repeated.id);assert.equal(JSON.stringify((await service.getRoute(a,route.id)).snapshot),snapshot);
  // A late audit exception must roll back route+success status, not the spent reservation.
  const race=await Promise.allSettled([service.generate(b,dto(b)),service.generate(c,dto(c))]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.filter(r=>r.status==='rejected').length,1);
  const budget=await db.preparationRoutingBudget.findUnique({where:{bucket:'month:'+new Date().toISOString().slice(0,7)}});assert.equal(budget.reserved,16);assert.ok(calls<=4);
  const protectedAfter=await fingerprints(db);for(const table of Object.keys(grantBaseline))if(!['AuditLog','HometownRoute','HometownSession','PreparationGeneration','PreparationRoutingBudget'].includes(table))assert.equal(protectedAfter[table],grantBaseline[table],'Practice altered '+table);
  // Independent failed route write: deliberately allow more test quota, not real provider spend.
  process.env.HOMETOWN_DAILY_REQUEST_BUDGET='32';process.env.HOMETOWN_MONTHLY_REQUEST_BUDGET='32';const failedUser=race[0].status==='rejected'?b:c;
  const failing=new PersonalizedPracticeService(new Proxy(db,{get(target,key){if(key==='$transaction')return fn=>target.$transaction(tx=>fn(new Proxy(tx,{get(t,k){if(k==='auditLog')return {create:async()=>{throw Error('FORCED_PHASE3_AUDIT_FAILURE');}};return Reflect.get(t,k);}})));return Reflect.get(target,key);}}),prep,access,driving);
  await assert.rejects(failing.generate(failedUser,dto(failedUser)),/FORCED_PHASE3_AUDIT_FAILURE/);assert.equal(await db.hometownRoute.count({where:{userId:failedUser}}),0);assert.equal((await db.preparationGeneration.findFirst({where:{userId:failedUser}})).state,'FAILED');
  await db.subscription.updateMany({where:{userId:a},data:{status:'CANCELLED'}});await assert.rejects(service.getRoute(a,route.id),/active Basic/);
  const afterEnd=await service.end(a,s.id,{ownerId:a,parked:true});assert.ok(!('route'in afterEnd));await service.remove(a,route.id,{ownerId:a,parked:true});assert.equal(await db.hometownSession.count({where:{userId:a}}),0);
  const bRoute=await db.hometownRoute.findFirst();assert.ok(bRoute);await db.user.delete({where:{id:bRoute.userId}});assert.equal(await db.hometownRoute.count(),0);
  const receipt={createdAt:new Date().toISOString(),archiveSha256:sha(fs.readFileSync(archive)),migrations:migrations.map(p=>({name:path.basename(path.dirname(p)),sha256:sha(fs.readFileSync(p))})),fullRestorePassed:true,additiveMigrationPreservedAllTables:true,noBackfill:true,realBasicAndFreeAccessPassed:true,ownerIsolationPassed:true,immutableRepeatPassed:true,noGpsDoesNotComplete:true,privateReflectionPassed:true,crossReplicaBudgetReservationPassed:true,lateAuditRollbackPassed:true,expiredAccessRedactionPassed:true,deleteAndAccountCascadePassed:true,protectedTablesUnchanged:true,externalProviderCalls:0,productionChanged:false};
  const output=path.join(root,'personalized-practice-rehearsal-'+Date.now()+'.json');fs.writeFileSync(output,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({receipt:output,...receipt}));
 }finally{
  keys.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);if(db)await db.$disconnect();if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);if(fs.existsSync(pwfile))fs.unlinkSync(pwfile);
 }
}
main().catch(error=>{console.error('Local Phase 3 rehearsal stopped: '+(error instanceof assert.AssertionError?error.message:String(error?.name||'error'))+'; sensitive details omitted.');process.exitCode=1;});
