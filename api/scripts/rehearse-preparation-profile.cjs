// LOCAL-ONLY Phase 3 migration/profile rehearsal; never connects to production.
require('reflect-metadata');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
const {PreparationService}=require('../dist/src/learning/preparation.service');
const {fingerprints}=require('./rehearse-complete-passage-review.cjs');
const {sha}=require('./prepare-reviewed-passage-release.cjs');
const root=path.resolve(__dirname,'../../output/db-backups');
async function main(){
 const archive=path.resolve(process.argv[2]||'');
 if(!archive.startsWith(root+path.sep)||!archive.endsWith('.dump')||sha(fs.readFileSync(archive))!==fs.readFileSync(archive+'.sha256','utf8').trim())throw Error('Checked task-local archive required');
 const dir=path.join(root,'preparation-profile-restore-'+Date.now()),data=path.join(dir,'data'),pwfile=path.join(dir,'password'),password=crypto.randomBytes(32).toString('hex');
 fs.mkdirSync(dir,{mode:0o700});fs.writeFileSync(pwfile,password,{flag:'wx',mode:0o600});
 const bin=path.join(root,'pg18-tools/pgsql/bin'),env={...process.env,PGHOST:'127.0.0.1',PGPORT:'15441',PGUSER:'preparation_restore',PGPASSWORD:password,PGDATABASE:'preparation_restore'};
 function run(name,args){const r=cp.spawnSync(path.join(bin,name+'.exe'),args,{env,windowsHide:true,stdio:name==='pg_ctl'?'ignore':['ignore','pipe','pipe'],timeout:180000});if(r.status!==0||r.error)throw Error('Isolated '+name+' failed');}
 let started=false,db;
 try{
  run('initdb',['-D',data,'-U',env.PGUSER,'--pwfile',pwfile,'--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C']);
  run('pg_ctl',['-D',data,'-l',path.join(dir,'server.log'),'-o','-h 127.0.0.1 -p 15441','-w','start']);started=true;
  run('createdb',[env.PGDATABASE]);run('pg_restore',['--exit-on-error','--no-owner','--no-acl','--dbname='+env.PGDATABASE,archive]);
  const url=new URL('postgresql://127.0.0.1:15441/preparation_restore');url.username=env.PGUSER;url.password=password;db=new PrismaClient({datasourceUrl:url.toString(),log:[]});
  const before=await fingerprints(db),migration=path.resolve(__dirname,'../prisma/migrations/0019_private_preparation_profile/migration.sql');
  run('psql',['-X','-v','ON_ERROR_STOP=1','-q','-f',migration]);
  const afterMigration=await fingerprints(db);for(const table of Object.keys(before))assert.equal(afterMigration[table],before[table],'Migration changed '+table);
  assert.equal(await db.preparationProfile.count(),0,'No legacy profiles may be backfilled');
  const prefix='phase3_test_'+Date.now(),a=prefix+'_a',b=prefix+'_b';
  for(const id of [a,b])await db.user.create({data:{id,email:id+'@example.invalid',passwordHash:'SYNTHETIC NOT A LOGIN',displayName:'Synthetic private-profile test',role:'LEARNER'}});
  const baseline=await fingerprints(db),centre=await db.examCentre.findFirst({where:{isPublished:true},select:{id:true}}),service=new PreparationService(db);
  const first=await service.get(a);assert.equal(first.saved,false);assert.equal(first.version,0);
  await service.save(a,{ownerId:a,version:0,preferredName:'Synthetic profile',age:25,homeTown:'Leuven',centreId:centre.id,preferredLevel:'INTERMEDIATE'});
  assert.equal((await service.get(b)).age,null);
  await assert.rejects(service.save(b,{ownerId:a,version:1,age:40}));
  await assert.rejects(service.save(a,{ownerId:a,version:0,age:40}));
  await assert.rejects(service.save(a,{ownerId:a,version:1,centreId:'nonexistent-test-centre'}));
  const saved=await db.preparationProfile.findUnique({where:{userId:a}});
  const failing=new PreparationService(new Proxy(db,{get(target,key){if(key==='$transaction')return fn=>target.$transaction(tx=>fn(new Proxy(tx,{get(t,k){if(k==='auditLog')return {create:async()=>{throw Error('FORCED_TEST_AUDIT_FAILURE');}};return Reflect.get(t,k);}})));return Reflect.get(target,key);}}));
  await assert.rejects(failing.save(a,{ownerId:a,version:1,revision:saved.revision,age:26}),/FORCED_TEST_AUDIT_FAILURE/);
  assert.deepEqual(await db.preparationProfile.findUnique({where:{userId:a}}),saved,'Late audit failure must roll back profile writes');
  for(const sql of ['UPDATE "PreparationProfile" SET "age"=121 WHERE "userId"=$1','UPDATE "PreparationProfile" SET "preferredLevel"=\'UNKNOWN\' WHERE "userId"=$1','UPDATE "PreparationProfile" SET "version"=0 WHERE "userId"=$1'])await assert.rejects(db.$executeRawUnsafe(sql,a));
  await service.clear(a,{ownerId:a,version:1,revision:saved.revision});assert.equal(await db.preparationProfile.count(),0);
  const after=await fingerprints(db);for(const table of Object.keys(baseline))if(!['PreparationProfile','AuditLog'].includes(table))assert.equal(after[table],baseline[table],'Profile operation changed '+table);
  const c=prefix+'_cascade';await db.user.create({data:{id:c,email:c+'@example.invalid',passwordHash:'SYNTHETIC NOT A LOGIN',role:'LEARNER'}});
  await db.preparationProfile.create({data:{userId:c,centreId:centre.id}});await db.user.delete({where:{id:c}});assert.equal(await db.preparationProfile.findUnique({where:{userId:c}}),null);
  const receipt={createdAt:new Date().toISOString(),archiveSha256:sha(fs.readFileSync(archive)),migrationSha256:sha(fs.readFileSync(migration)),fullRestorePassed:true,additiveMigrationPreservedAllTables:true,legacyProfileBackfill:false,ownerAndVersionChecksPassed:true,lateAuditRollbackPassed:true,sqlConstraintsPassed:true,accountCascadePassed:true,protectedTablesUnchanged:true,productionChanged:false};
  const output=path.join(root,'preparation-profile-rehearsal-'+Date.now()+'.json');fs.writeFileSync(output,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({receipt:output,...receipt}));
 }finally{
  if(db)await db.$disconnect();
  if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);
  if(fs.existsSync(pwfile))fs.unlinkSync(pwfile);
 }
}
if(require.main===module)main().catch(()=>{console.error('Local preparation-profile rehearsal stopped; sensitive details omitted.');process.exitCode=1;});
