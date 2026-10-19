// The only writes are to a fresh, isolated restore of the private archive.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const {apply}=require('./apply-complete-passage-review.cjs');
const {validateCompleteReview}=require('./prepare-complete-passage-review.cjs');
const {sha}=require('./prepare-reviewed-passage-release.cjs');
const root=path.resolve(__dirname,'../../output/db-backups');
async function fingerprints(db){
 const tables=await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"),out={};
 for(const {tablename}of tables){const safe=tablename.replace(/"/g,'""');const rows=await db.$queryRawUnsafe(`SELECT md5(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),'')) AS hash FROM public."${safe}" t`);out[tablename]=rows[0].hash;}return out;
}
async function rehearse(archive,file){
 archive=path.resolve(archive);file=path.resolve(file);
 if(!archive.startsWith(root+path.sep)||!archive.endsWith('.dump')||!file.startsWith(path.resolve(__dirname,'../../output/chatbot-audit/phase-two-reconciliation')+path.sep))throw Error('Task-local archive/release required');
 const bytes=fs.readFileSync(file),bundle=JSON.parse(bytes);validateCompleteReview(bundle);
 const archiveSha256=sha(fs.readFileSync(archive));if(archiveSha256!==fs.readFileSync(`${archive}.sha256`,'utf8').trim())throw Error('Backup checksum mismatch');
 const bin=path.join(root,'pg18-tools/pgsql/bin'),dir=path.join(root,`complete-passage-restore-${Date.now()}`),data=path.join(dir,'data'),pwfile=path.join(dir,'password');
 const password=crypto.randomBytes(32).toString('hex');fs.mkdirSync(dir,{mode:0o700});fs.writeFileSync(pwfile,password,{flag:'wx',mode:0o600});
 const env={...process.env,PGHOST:'127.0.0.1',PGPORT:'15440',PGUSER:'source_restore',PGPASSWORD:password,PGDATABASE:'source_restore'};
 function run(name,args){const r=cp.spawnSync(path.join(bin,`${name}.exe`),args,{env,windowsHide:true,stdio:name==='pg_ctl'?'ignore':['ignore','pipe','pipe'],timeout:180000});if(r.status!==0||r.error)throw Error(`${name} failed; sensitive details omitted`);}
 let started=false,db;
 try{
  run('initdb',['-D',data,'-U','source_restore','--pwfile',pwfile,'--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C']);
  run('pg_ctl',['-D',data,'-l',path.join(dir,'server.log'),'-o','-h 127.0.0.1 -p 15440','-w','start']);started=true;
  run('createdb',['source_restore']);run('pg_restore',['--exit-on-error','--no-owner','--no-acl','--dbname=source_restore',archive]);
  const url=new URL('postgresql://127.0.0.1:15440/source_restore');url.username=env.PGUSER;url.password=password;db=new PrismaClient({datasourceUrl:url.toString(),log:[]});
  const before=await fingerprints(db),sourceBefore=await db.officialPassagePoint.findMany({orderBy:{id:'asc'}});
  let rolledBack=false;
  try{await apply(db,bundle,{actorEmail:process.env.PHASE_TWO_ACTOR_EMAIL,forceConflict:true});}catch(e){if(e.message==='STAGING_FORCED_LATE_ROLLBACK')rolledBack=true;else throw e;}
  if(!rolledBack||sha(JSON.stringify(before))!==sha(JSON.stringify(await fingerprints(db))))throw Error('Late-conflict rollback failed');
  console.log('Full archive restore and all-centre late-conflict rollback passed.');
  const result=await apply(db,bundle,{actorEmail:process.env.PHASE_TWO_ACTOR_EMAIL});
  const after=await fingerprints(db),allowed=new Set(['OfficialPassagePoint','AuditLog']);
  for(const table of Object.keys(before))if(!allowed.has(table)&&before[table]!==after[table])throw Error(`Protected table changed: ${table}`);
  const sourceAfter=await db.officialPassagePoint.findMany({orderBy:{id:'asc'}}),mutable=new Set(['latitude','longitude','verificationStatus','verifiedAt','verifiedBy','notes','updatedAt']);
  const identity=rows=>rows.map(p=>Object.fromEntries(Object.entries(p).filter(([k])=>!mutable.has(k))));
  if(sha(JSON.stringify(identity(sourceBefore)))!==sha(JSON.stringify(identity(sourceAfter))))throw Error('Printed source identity changed');
  for(const c of bundle.centres)for(const p of c.points){
   const centre=await db.examCentre.findUnique({where:{slug:c.slug},select:{id:true}});
   const current=sourceAfter.find(q=>q.centreId===centre.id&&q.sequence===p.sequence),old=sourceBefore.find(q=>q.id===current?.id);
   if(p.disposition!=='REVIEW_LOCATION'&&sha(JSON.stringify(current))!==sha(JSON.stringify(old)))throw Error('Preserved proof/duplicate row changed');
  }
  const again=await apply(db,bundle,{actorEmail:process.env.PHASE_TWO_ACTOR_EMAIL});
  if(again.changed!==0||sha(JSON.stringify(after))!==sha(JSON.stringify(await fingerprints(db))))throw Error('Idempotent review failed');
  const receipt={createdAt:new Date().toISOString(),archive,archiveSha256,releaseSha256:sha(bytes),fullRestorePassed:true,completeReviewPassed:true,rollbackPassed:true,protectedTablesUnchanged:true,sourceIdentityPreserved:true,idempotent:true,...result};
  const output=path.join(root,`complete-passage-rehearsal-${Date.now()}.json`);fs.writeFileSync(output,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({receipt:output,...receipt}));
  return receipt;
 }finally{
  if(db)await db.$disconnect();
  if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);
  if(fs.existsSync(pwfile))fs.unlinkSync(pwfile);
 }
}
module.exports={rehearse,fingerprints};
if(require.main===module)rehearse(process.argv[2]||'',process.argv[3]||'').catch(error=>{
 const safe=['Published source review changed','Existing location review must not be overwritten','Live source fingerprint changed','Live source count changed','Backup checksum mismatch','Late-conflict rollback failed','Idempotent review failed'];
 console.error(`Complete review rehearsal stopped${safe.includes(error.message)?': '+error.message:'. Sensitive details omitted.'}`);process.exitCode=1;
});
