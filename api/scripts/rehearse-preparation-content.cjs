// Restore-only rehearsal; never connects to production.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const {apply,validateRelease,sha}=require('./apply-preparation-content.cjs');
const {fingerprints}=require('./rehearse-complete-passage-review.cjs');
const root=path.resolve(__dirname,'../../output/db-backups');
async function rehearse(archive,file){
 archive=path.resolve(archive);file=path.resolve(file);
 if(!archive.startsWith(root+path.sep)||!archive.endsWith('.dump')||!file.startsWith(path.resolve(__dirname,'../../output/chatbot-audit/preparation-content')+path.sep))throw Error('Task-local archive/release required');
 const bytes=fs.readFileSync(file),bundle=validateRelease(JSON.parse(bytes)),archiveSha256=sha(fs.readFileSync(archive));
 if(archiveSha256!==fs.readFileSync(archive+'.sha256','utf8').trim())throw Error('Backup checksum mismatch');
 const bin=path.join(root,'pg18-tools/pgsql/bin'),dir=path.join(root,'preparation-content-restore-'+Date.now()),data=path.join(dir,'data'),pwfile=path.join(dir,'password');
 const password=crypto.randomBytes(32).toString('hex');fs.mkdirSync(dir,{mode:0o700});fs.writeFileSync(pwfile,password,{flag:'wx',mode:0o600});
 const env={...process.env,PGHOST:'127.0.0.1',PGPORT:'15443',PGUSER:'content_restore',PGPASSWORD:password,PGDATABASE:'content_restore'};
 function run(name,args){const r=cp.spawnSync(path.join(bin,name+'.exe'),args,{env,windowsHide:true,stdio:name==='pg_ctl'?'ignore':['ignore','pipe','pipe'],timeout:180000});if(r.status!==0||r.error)throw Error('Isolated '+name+' failed');}
 let started=false,db;
 try{
  run('initdb',['-D',data,'-U',env.PGUSER,'--pwfile',pwfile,'--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C']);
  run('pg_ctl',['-D',data,'-l',path.join(dir,'server.log'),'-o','-h 127.0.0.1 -p 15443','-w','start']);started=true;
  run('createdb',[env.PGDATABASE]);run('pg_restore',['--exit-on-error','--no-owner','--no-acl','--dbname='+env.PGDATABASE,archive]);
  const url=new URL('postgresql://127.0.0.1:15443/content_restore');url.username=env.PGUSER;url.password=password;db=new PrismaClient({datasourceUrl:url.toString(),log:[]});
  const before=await fingerprints(db),routesBefore=await db.route.findMany({orderBy:{id:'asc'}}),pointsBefore=await db.routePoint.findMany({orderBy:{id:'asc'}}),sourcesBefore=await db.officialPassagePoint.findMany({orderBy:{id:'asc'}});
  let rolledBack=false;
  try{await apply(db,bundle,{actorEmail:process.env.PHASE_TWO_ACTOR_EMAIL,forceConflict:true});}catch(e){if(e.message==='STAGING_FORCED_LATE_ROLLBACK')rolledBack=true;else throw e;}
  if(!rolledBack||sha(JSON.stringify(before))!==sha(JSON.stringify(await fingerprints(db))))throw Error('Late-conflict rollback failed');
  console.log('Full private archive restore and late-write rollback passed.');
  const result=await apply(db,bundle,{actorEmail:process.env.PHASE_TWO_ACTOR_EMAIL}),after=await fingerprints(db),allowed=new Set(['Route','RoutePoint','OfficialPassagePoint','PreparationCoverage','AuditLog']);
  for(const table of Object.keys(before))if(!allowed.has(table)&&before[table]!==after[table])throw Error('Protected table changed');
  const routesAfter=await db.route.findMany({orderBy:{id:'asc'}}),pointsAfter=await db.routePoint.findMany({orderBy:{id:'asc'}}),sourcesAfter=await db.officialPassagePoint.findMany({orderBy:{id:'asc'}});
  const immutable=(r,mutable)=>Object.fromEntries(Object.entries(r).filter(([k])=>!mutable.has(k)));
  if(routesAfter.length!==routesBefore.length||pointsAfter.length!==pointsBefore.length)throw Error('Route/point identities changed');
  for(let i=0;i<routesBefore.length;i++){
   const old=routesBefore[i],fresh=routesAfter[i],mutable=new Set(old.id===bundle.repair.id?['version','durationMin','verifiedAt','reviewedBy','updatedAt']:[]);
   if(sha(JSON.stringify(immutable(old,mutable)))!==sha(JSON.stringify(immutable(fresh,mutable))))throw Error('Unrelated route changed');
  }
  for(let i=0;i<pointsBefore.length;i++){
   const old=pointsBefore[i],fresh=pointsAfter[i],mutable=new Set(old.routeId===bundle.repair.id?['latitude','longitude','bearing','updatedAt']:[]);
   if(sha(JSON.stringify(immutable(old,mutable)))!==sha(JSON.stringify(immutable(fresh,mutable))))throw Error('Point identity or unrelated content changed');
  }
  const repairPoints=pointsAfter.filter(p=>p.routeId===bundle.repair.id).sort((a,b)=>a.sequence-b.sequence);
  for(let i=0;i<repairPoints.length;i++)for(const field of ['latitude','longitude','bearing'])if(repairPoints[i][field]!==bundle.repair.points[i][field])console.log(JSON.stringify({repairSequence:i+1,field,roundtripDelta:repairPoints[i][field]-bundle.repair.points[i][field]}));
  for(const old of sourcesBefore){const fresh=sourcesAfter.find(s=>s.id===old.id);if(!fresh||sha(JSON.stringify(old))!==sha(JSON.stringify(fresh)))throw Error('Existing source review changed');}
  const inserted=sourcesAfter.filter(s=>!sourcesBefore.some(p=>p.id===s.id));
  if(inserted.some(s=>s.latitude!==null||s.longitude!==null||s.verifiedAt!==null||s.verifiedBy!==null||s.verificationStatus!=='PENDING_REVIEW'))throw Error('Source names incorrectly auto-approved');
  const again=await apply(db,bundle,{actorEmail:process.env.PHASE_TWO_ACTOR_EMAIL});
  if(again.coverageCreated||again.sourceNamesImported||again.repaired||sha(JSON.stringify(after))!==sha(JSON.stringify(await fingerprints(db))))throw Error('Idempotence failed');
  const receipt={createdAt:new Date().toISOString(),archive,archiveSha256,releaseSha256:sha(bytes),fullRestorePassed:true,rollbackPassed:true,protectedTablesUnchanged:true,routeIdentitiesPreserved:true,existingSourceReviewsPreserved:true,idempotent:true,...result};
  const target=path.join(root,'preparation-content-rehearsal-'+Date.now()+'.json');fs.writeFileSync(target,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({receipt:target,...receipt}));return receipt;
 }finally{if(db)await db.$disconnect();if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);if(fs.existsSync(pwfile))fs.unlinkSync(pwfile);}
}
module.exports={rehearse};
if(require.main===module)rehearse(process.argv[2]||'',process.argv[3]||'').catch(e=>{console.error('Content rehearsal failed ('+(['Late-conflict rollback failed','Idempotence failed','Concurrent route content changed','Existing human coverage review must be preserved'].includes(e.message)?e.message:'details omitted')+'); production unchanged.');process.exitCode=1;});
