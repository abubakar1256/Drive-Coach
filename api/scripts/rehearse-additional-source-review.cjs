// Fresh isolated private-archive restore; no live database connection is used.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const {apply,validate}=require('./apply-additional-source-review.cjs');
const {sha,root:releaseRoot}=require('./prepare-additional-source-review.cjs');
const {fingerprints}=require('./rehearse-complete-passage-review.cjs');
const root=path.resolve(__dirname,'../../output/db-backups');
async function rehearse(archive,file){
  archive=path.resolve(archive);file=path.resolve(file);
  if(!archive.startsWith(root+path.sep)||!archive.endsWith('.dump')||!file.startsWith(releaseRoot+path.sep))throw Error('Task-local archive/release required');
  const bytes=fs.readFileSync(file),bundle=JSON.parse(bytes);validate(bundle);
  const archiveSha256=sha(fs.readFileSync(archive));if(archiveSha256!==fs.readFileSync(archive+'.sha256','utf8').trim())throw Error('Backup checksum mismatch');
  const bin=path.join(root,'pg18-tools/pgsql/bin'),dir=path.join(root,`additional-source-restore-${Date.now()}`),data=path.join(dir,'data'),pwfile=path.join(dir,'password');
  const password=crypto.randomBytes(32).toString('hex');fs.mkdirSync(dir,{mode:0o700});fs.writeFileSync(pwfile,password,{flag:'wx',mode:0o600});
  const env={...process.env,PGHOST:'127.0.0.1',PGPORT:'15440',PGUSER:'source_restore',PGPASSWORD:password,PGDATABASE:'source_restore'};
  function run(name,args){const r=cp.spawnSync(path.join(bin,name+'.exe'),args,{env,windowsHide:true,stdio:name==='pg_ctl'?'ignore':['ignore','pipe','pipe'],timeout:180000});if(r.status!==0||r.error)throw Error(name+' failed; sensitive details omitted');}
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
    const result=await apply(db,bundle,{actorEmail:process.env.PHASE_TWO_ACTOR_EMAIL}),after=await fingerprints(db),allowed=new Set(['OfficialPassagePoint','AuditLog']);
    for(const table of Object.keys(before))if(!allowed.has(table)&&before[table]!==after[table])throw Error('Protected table changed: '+table);
    const selected=new Set(bundle.rows.map(r=>`${r.slug}:${r.sequence}`)),centres=await db.examCentre.findMany({select:{id:true,slug:true}}),sourceAfter=await db.officialPassagePoint.findMany({orderBy:{id:'asc'}});
    for(const old of sourceBefore){
      const current=sourceAfter.find(p=>p.id===old.id),slug=centres.find(c=>c.id===old.centreId)?.slug;
      if(!selected.has(`${slug}:${old.sequence}`)){if(sha(JSON.stringify(old))!==sha(JSON.stringify(current)))throw Error('Unselected source/proof changed');}
      else {const mutable=new Set(['latitude','longitude','verificationStatus','verifiedAt','verifiedBy','notes','updatedAt']),identity=p=>Object.fromEntries(Object.entries(p).filter(([k])=>!mutable.has(k)));if(sha(JSON.stringify(identity(old)))!==sha(JSON.stringify(identity(current))))throw Error('Reviewed source identity changed');}
    }
    if(result.imported!==486||result.reviewed!==117)throw Error('Unexpected release count');
    const again=await apply(db,bundle,{actorEmail:process.env.PHASE_TWO_ACTOR_EMAIL});
    if(again.imported||again.reviewed||sha(JSON.stringify(after))!==sha(JSON.stringify(await fingerprints(db))))throw Error('Idempotency failed');
    const receipt={createdAt:new Date().toISOString(),archive,archiveSha256,releaseSha256:sha(bytes),fullRestorePassed:true,rollbackPassed:true,protectedTablesUnchanged:true,existingSourcesPreserved:true,idempotent:true,...result};
    const output=path.join(root,`additional-source-rehearsal-${Date.now()}.json`);fs.writeFileSync(output,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({receipt:output,...receipt}));return receipt;
  }finally{
    if(db)await db.$disconnect();
    if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);
    if(fs.existsSync(pwfile))fs.unlinkSync(pwfile);
  }
}
module.exports={rehearse};
if(require.main===module)rehearse(process.argv[2]||'',process.argv[3]||'').catch(error=>{console.error(`Additional-source rehearsal stopped (${error.message?.startsWith('Unexpected release count')?'release count changed':'safe diagnostic withheld'}).`);process.exitCode=1;});
