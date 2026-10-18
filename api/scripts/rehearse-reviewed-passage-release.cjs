// A real production archive, restored to a new isolated loopback cluster. Only
// this restored copy is written. Preserve backups and stop the helper on exit.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const {apply,validateRelease}=require('./apply-reviewed-passage-release.cjs');
const {sha}=require('./prepare-reviewed-passage-release.cjs');
const root=path.resolve(__dirname,'../../output/db-backups'),archive=path.resolve(process.argv[2]||''),file=path.resolve(process.argv[3]||'');
if(!archive.startsWith(root+path.sep)||!archive.endsWith('.dump')||!file.startsWith(path.resolve(__dirname,'../../output/chatbot-audit')+path.sep))throw Error('Task-local archive/release required');
const bin=path.join(root,'pg18-tools/pgsql/bin'),dir=path.join(root,`passage-release-restore-${Date.now()}`),data=path.join(dir,'data'),pwfile=path.join(dir,'password');
const password=crypto.randomBytes(32).toString('hex');fs.mkdirSync(dir,{mode:0o700});fs.writeFileSync(pwfile,password,{flag:'wx',mode:0o600});
const env={...process.env,PGHOST:'127.0.0.1',PGPORT:'15440',PGUSER:'passage_restore',PGPASSWORD:password,PGDATABASE:'passage_restore'};
function run(name,args){const r=cp.spawnSync(path.join(bin,`${name}.exe`),args,{env,windowsHide:true,stdio:name==='pg_ctl'?'ignore':['ignore','pipe','pipe'],timeout:180000});if(r.status!==0||r.error)throw Error(`${name} failed; sensitive details omitted`);}
async function fingerprints(db){
 const tables=await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"),out={};
 for(const {tablename}of tables){const safe=tablename.replace(/"/g,'""');const rows=await db.$queryRawUnsafe(`SELECT md5(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),'')) AS hash FROM public."${safe}" t`);out[tablename]=rows[0].hash;}return out;
}
let started=false,db;
(async()=>{
 const bytes=fs.readFileSync(file),bundle=JSON.parse(bytes);validateRelease(bundle);
 const archiveSha256=sha(fs.readFileSync(archive));if(archiveSha256!==fs.readFileSync(`${archive}.sha256`,'utf8').trim())throw Error('Backup checksum mismatch');
 run('initdb',['-D',data,'-U','passage_restore','--pwfile',pwfile,'--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C']);
 run('pg_ctl',['-D',data,'-l',path.join(dir,'server.log'),'-o','-h 127.0.0.1 -p 15440','-w','start']);started=true;
 run('createdb',['passage_restore']);run('pg_restore',['--exit-on-error','--no-owner','--no-acl','--dbname=passage_restore',archive]);
 const url=new URL('postgresql://127.0.0.1:15440/passage_restore');url.username=env.PGUSER;url.password=password;db=new PrismaClient({datasourceUrl:url.toString(),log:[]});
 const migration=await db.$queryRawUnsafe('SELECT checksum,finished_at FROM "_prisma_migrations" WHERE migration_name=$1','0018_official_route_foundation');
 const sql=fs.readFileSync(path.resolve(__dirname,'../prisma/migrations/0018_official_route_foundation/migration.sql'),'utf8').replace(/\r\n/g,'\n');
 if(migration.length!==1||!migration[0].finished_at||migration[0].checksum!==sha(sql))throw Error('Exact committed migration not confirmed');
 const before=await fingerprints(db),original=await db.route.findMany({include:{points:{orderBy:{sequence:'asc'}}},orderBy:{id:'asc'}}),ids=original.map(r=>r.id);
 let rolledBack=false;
 try{await apply(db,bundle,{actorEmail:process.env.PHASE_TWO_ACTOR_EMAIL,forceConflict:true});}catch(e){if(e.message==='STAGING_FORCED_LATE_ROLLBACK')rolledBack=true;else throw e;}
 if(!rolledBack||sha(JSON.stringify(before))!==sha(JSON.stringify(await fingerprints(db))))throw Error('Late-conflict rollback verification failed');
 console.log('Full restore and six-centre late-conflict rollback passed.');
 const results=await apply(db,bundle,{actorEmail:process.env.PHASE_TWO_ACTOR_EMAIL});
 const after=await fingerprints(db),allowed=new Set(['Route','RoutePoint','OfficialPassagePoint','CentreDeparture','AuditLog','Notification']);
 for(const table of Object.keys(before))if(!allowed.has(table)&&before[table]!==after[table])throw Error(`Protected table changed: ${table}`);
 const oldAfter=await db.route.findMany({where:{id:{in:ids}},include:{points:{orderBy:{sequence:'asc'}}},orderBy:{id:'asc'}});
 if(sha(JSON.stringify(original))!==sha(JSON.stringify(oldAfter)))throw Error('Existing route IDs/content/history changed');
 const again=await apply(db,bundle,{actorEmail:process.env.PHASE_TWO_ACTOR_EMAIL});
 if(again.some((r,i)=>r.id!==results[i].id||!r.preserved))throw Error('Idempotent publication failed');
 const receipt={createdAt:new Date().toISOString(),archive,archiveSha256,releaseSha256:sha(bytes),fullRestorePassed:true,reviewedReleasePassed:true,rollbackPassed:true,protectedTablesUnchanged:true,existingRoutesPreserved:ids.length,idempotent:true,results};
 const out=path.join(root,`reviewed-passage-rehearsal-${Date.now()}.json`);fs.writeFileSync(out,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({receipt:out,...receipt}));
})().catch(e=>{console.error(`Reviewed release rehearsal stopped: ${e.message.slice(0,300)}`);process.exitCode=1;}).finally(async()=>{if(db)await db.$disconnect();if(started){try{run('pg_ctl',['-D',data,'-m','fast','-w','stop']);}catch{console.error('Isolated restore needs explicit shutdown');process.exitCode=1;}}if(fs.existsSync(pwfile))fs.unlinkSync(pwfile);});
