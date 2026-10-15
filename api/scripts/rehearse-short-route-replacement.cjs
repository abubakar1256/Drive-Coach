// Restore only into a NEW, password-protected loopback PostgreSQL 18 cluster.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const {digest,replace,validatePlan,sameGeometry}=require('./replace-short-routes.cjs');
const root=path.resolve(__dirname,'../../output/db-backups');
const bin=path.join(root,'pg18-tools/pgsql/bin');
const archive=path.resolve(process.argv[2]||'');
const planFile=path.resolve(process.argv[3]||'');
if(!archive.startsWith(root+path.sep)||!planFile.startsWith(root+path.sep))throw Error('Task-local backup and plan required');
const cluster=path.join(root,`restore-test-${Date.now()}`);
const data=path.join(cluster,'data');
const pwfile=path.join(cluster,'password');
const password=crypto.randomBytes(32).toString('hex');
fs.mkdirSync(cluster,{recursive:false,mode:0o700});
fs.writeFileSync(pwfile,password,{flag:'wx',mode:0o600});
const env={...process.env,PGHOST:'127.0.0.1',PGPORT:'15440',PGUSER:'route_restore',PGPASSWORD:password,PGDATABASE:'postgres'};
function run(name,args,extraEnv=env){
 const r=spawnSync(path.join(bin,`${name}.exe`),args,{env:extraEnv,windowsHide:true,stdio:name==='pg_ctl'?'ignore':['ignore','pipe','pipe'],timeout:180000});
 if(r.error||r.status!==0)throw Error(`${name} failed; sensitive details omitted`);
 return r.stdout?.toString() || '';
}
async function fingerprints(db,all=false){
 const tables=await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
 const out={};
 for(const {tablename} of tables){
  if(!all&&['Route','RoutePoint','AuditLog'].includes(tablename))continue;
  const safe=tablename.replace(/"/g,'""');
  const rows=await db.$queryRawUnsafe(`SELECT md5(COALESCE(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text),'')) AS fingerprint FROM public."${safe}" t`);
  out[tablename]=rows[0].fingerprint;
 }
 return out;
}
let started=false,db;
(async()=>{
 const plan=JSON.parse(fs.readFileSync(planFile,'utf8'));validatePlan(plan);
 const archiveSha256=crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
 if(archiveSha256!==fs.readFileSync(`${archive}.sha256`,'utf8').trim())throw Error('Backup checksum mismatch');
 run('initdb',['-D',data,'-U','route_restore','--pwfile',pwfile,'--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C']);
 run('pg_ctl',['-D',data,'-l',path.join(cluster,'server.log'),'-o','-h 127.0.0.1 -p 15440','-w','start']);started=true;
 run('createdb',['route_restore']);
 run('pg_restore',['--exit-on-error','--no-owner','--no-acl','--dbname=route_restore',archive]);
 console.log('Full PostgreSQL 18 backup restore passed in isolated loopback cluster.');
 const url=new URL('postgresql://127.0.0.1:15440/route_restore');url.username='route_restore';url.password=password;
 db=new PrismaClient({datasourceUrl:url.toString(),log:[]});
 const beforeAll=await fingerprints(db,true),protectedBefore=await fingerprints(db);
 // Force a late concurrent-content conflict and prove all earlier writes roll back.
 const conflict=JSON.parse(JSON.stringify(plan));const last=conflict.routes.at(-1);
 last.before.name+=' concurrent edit simulation';last.beforeHash=digest(last.before);
 let rejected=false;try{await replace(db,conflict);}catch{rejected=true;}
 if(!rejected||digest(beforeAll)!==digest(await fingerprints(db,true)))throw Error('Rollback rehearsal failed');
 console.log('Late-conflict rollback rehearsal passed; all tables unchanged.');
 const result=await replace(db,plan);
 if(digest(protectedBefore)!==digest(await fingerprints(db)))throw Error('Protected tables changed');
 for(const entry of plan.routes){
  const r=await db.route.findUnique({where:{id:entry.before.id},include:{points:{orderBy:{sequence:'asc'}}}});
  const checks={exists:!!r,slug:r?.slug===entry.before.slug,centre:r?.centreId===entry.before.centreId,createdAt:r?.createdAt.toISOString()===entry.before.createdAt,duration:r?.durationMin===Math.ceil(entry.durationSec/60),geometry:!!r&&sameGeometry(r.points,entry.after)};
  if(Object.values(checks).some(ok=>!ok)){console.log(JSON.stringify({route:entry.before.slug,preservationChecks:checks}));throw Error('Staged route preservation check failed');}
 }
 const receipt={createdAt:new Date().toISOString(),archive,archiveSha256,planHash:digest(plan),fullRestorePassed:true,stagingReplacementPassed:true,rollbackPassed:true,protectedTablesUnchanged:true,...result};
 const receiptFile=path.join(root,`restore-rehearsal-${Date.now()}.json`);
 fs.writeFileSync(receiptFile,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({receipt:receiptFile,...result,protectedTablesUnchanged:true},null,2));
})().catch(error=>{console.error(`Restore/rehearsal stopped (${error.message.includes('failed')?error.message:'validation failure'}); production unchanged.`);process.exitCode=1;}).finally(async()=>{
 if(db)await db.$disconnect();
 if(started){try{run('pg_ctl',['-D',data,'-m','fast','-w','stop']);console.log('Local restore-test server stopped.');}catch{console.error('Local restore-test server needs explicit shutdown.');process.exitCode=1;}}
 // Only this script's generated password file; never delete the backup archive.
 if(fs.existsSync(pwfile))fs.unlinkSync(pwfile);
});
