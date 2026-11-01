// Disposable PostgreSQL integration check. Never reads a production connection,
// never restores user data and forbids provider HTTP requests.
require('reflect-metadata');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {PreparationService}=require('../dist/src/learning/preparation.service');
const {OfficialRouteFoundationService}=require('../dist/src/routes/official-route-foundation.service');
async function main(){
 const root=path.resolve(__dirname,'../../output/db-backups'),bin=path.join(root,'pg18-tools/pgsql/bin');
 const dir=path.join(root,'phase23-synthetic-'+Date.now()),data=path.join(dir,'data'),pwfile=path.join(dir,'password');
 if(!dir.startsWith(root+path.sep)||!fs.existsSync(path.join(bin,'initdb.exe')))throw Error('Workspace PostgreSQL tools required');
 fs.mkdirSync(dir,{mode:0o700});const password=crypto.randomBytes(32).toString('hex');fs.writeFileSync(pwfile,password,{flag:'wx',mode:0o600});
 const env={...process.env,PGHOST:'127.0.0.1',PGPORT:'15447',PGUSER:'phase23_synthetic',PGPASSWORD:password,PGDATABASE:'phase23_synthetic'};
 function run(name,args){const r=cp.spawnSync(path.join(bin,name+'.exe'),args,{env,windowsHide:true,stdio:name==='pg_ctl'?'ignore':['ignore','pipe','pipe'],timeout:180000});if(r.status!==0||r.error){fs.writeFileSync(path.join(dir,name+'-error.log'),String(r.stderr??r.error??'No command output'));throw Error(`Isolated ${name} failed; inspect the task-local error log`);}}
 let started=false,db;const oldFetch=global.fetch;
 global.fetch=async()=>{throw Error('PROVIDER_HTTP_FORBIDDEN');};
 try{
  run('initdb',['-D',data,'-U',env.PGUSER,'--pwfile',pwfile,'--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C']);
  run('pg_ctl',['-D',data,'-l',path.join(dir,'server.log'),'-o','-h 127.0.0.1 -p 15447','-w','start']);started=true;run('createdb',['--maintenance-db=postgres',env.PGDATABASE]);
  const migrations=path.resolve(__dirname,'../prisma/migrations');
  for(const name of fs.readdirSync(migrations).filter(n=>fs.existsSync(path.join(migrations,n,'migration.sql'))).sort())run('psql',['-v','ON_ERROR_STOP=1','-f',path.join(migrations,name,'migration.sql')]);
  const url=new URL('postgresql://127.0.0.1:15447/phase23_synthetic');url.username=env.PGUSER;url.password=password;
  db=new PrismaClient({datasourceUrl:url.toString(),log:[]});
  const plansBefore=await db.plan.findMany({orderBy:{id:'asc'}});
  const learner=await db.user.create({data:{email:'phase23-learner@example.invalid',passwordHash:'SYNTHETIC_NOT_A_LOGIN'}});
  const other=await db.user.create({data:{email:'phase23-other@example.invalid',passwordHash:'SYNTHETIC_NOT_A_LOGIN'}});
  const admin=await db.user.create({data:{email:'phase23-admin@example.invalid',passwordHash:'SYNTHETIC_NOT_A_LOGIN',role:'ADMIN'}});
  const secondAdmin=await db.user.create({data:{email:'phase23-admin2@example.invalid',passwordHash:'SYNTHETIC_NOT_A_LOGIN',role:'ADMIN'}});
  const centre=await db.examCentre.create({data:{slug:'synthetic-phase23',name:'SYNTHETIC TEST CENTRE',city:'TEST',region:'TEST',isPublished:true}});
  const route=await db.route.create({data:{centreId:centre.id,slug:'synthetic-phase23-route',name:'SYNTHETIC DRAFT',status:'DRAFT'}});
  for(let i=0;i<3;i++){
   const driven=new Date(Date.now()-(i+1)*86400000);
   const session=await db.practiceSession.create({data:{userId:learner.id,routeId:route.id,startedAt:driven,completedAt:driven,completionKind:'ENDED',routeSnapshot:{coachingReview:{source:'instructor_reported',ratings:{roundabouts:'practice',priority:'good'},savedAt:driven.toISOString(),notes:'PRIVATE_TEST_NOTE'}}}});
   await db.selfReflection.create({data:{userId:learner.id,sessionId:session.id,difficultyCategories:['roundabouts']}});
  }
  const preparation=new PreparationService(db),profile=await preparation.get(learner.id,true),empty=await preparation.get(other.id,true);
  assert.equal(profile.history.sessionCount,3);assert.equal(profile.history.suggestedLevel,'BEGINNER');assert.equal(profile.saved,false);
  assert.equal(profile.focus.items.find(i=>i.code==='roundabouts').basis.length,2);assert.equal(empty.history.sessionCount,0);
  assert.doesNotMatch(JSON.stringify(profile.history),/PRIVATE_TEST_NOTE|coachingReview|routeSnapshot/);
  assert.equal(await db.preparationProfile.count(),0);assert.equal(await db.routeTrial.count(),0);assert.equal(await db.payment.count(),0);assert.equal(await db.subscription.count(),0);
  const service=new OfficialRouteFoundationService(db,{});let providerCalls=0;
  service.coverage=async()=>({departureReviewed:true,selections:[{passagePointIds:['synthetic-one','synthetic-two'],sequences:[1,2]}]});
  service.generateDraft=async()=>{providerCalls++;return {id:'synthetic-draft',slug:'synthetic-draft',status:'DRAFT'};};
  const old=[process.env.PASSAGE_DAILY_REQUEST_BUDGET,process.env.PASSAGE_MONTHLY_REQUEST_BUDGET];
  process.env.PASSAGE_DAILY_REQUEST_BUDGET='1';process.env.PASSAGE_MONTHLY_REQUEST_BUDGET='1';
  try{
   const request=()=>({confirmed:true,requestLimit:1,requestKey:crypto.randomUUID()});
   const results=await Promise.allSettled([service.generateCoverageDrafts(admin.id,centre.id,request()),service.generateCoverageDrafts(secondAdmin.id,centre.id,request())]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(providerCalls,1);
   assert.equal(await db.preparationGeneration.count(),1);assert.equal(await db.auditLog.count({where:{action:'PASSAGE_COVERAGE_DRAFTS_PREPARED'}}),1);
   const buckets=await db.preparationRoutingBudget.findMany({where:{bucket:{startsWith:'PASSAGE:'}}});assert.equal(buckets.length,2);assert.ok(buckets.every(b=>b.reserved===1));
   await db.user.update({where:{id:admin.id},data:{role:'LEARNER'}});
   await assert.rejects(service.generateCoverageDrafts(admin.id,centre.id,request()),/permission/);
   assert.equal(providerCalls,1);assert.equal(await db.route.count({where:{status:'PUBLISHED'}}),0);
  }finally{['PASSAGE_DAILY_REQUEST_BUDGET','PASSAGE_MONTHLY_REQUEST_BUDGET'].forEach((key,i)=>old[i]===undefined?delete process.env[key]:process.env[key]=old[i]);}
  assert.deepEqual(await db.plan.findMany({orderBy:{id:'asc'}}),plansBefore);assert.equal(await db.routeTrial.count(),0);assert.equal(await db.subscription.count(),0);assert.equal(await db.payment.count(),0);
  const result={checkedAt:new Date().toISOString(),syntheticDatabaseOnly:true,historyOwnerIsolation:true,realPrismaQueriesPassed:true,concurrentBudgetLimitPassed:true,permissionRevocationPassed:true,plansAndTrialsUnchanged:true,productionChanged:false,providerHttpRequests:0};
  fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
 }finally{global.fetch=oldFetch;if(db)await db.$disconnect();if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);if(fs.existsSync(pwfile))fs.unlinkSync(pwfile);}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
