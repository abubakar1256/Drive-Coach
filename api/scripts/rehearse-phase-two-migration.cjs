// Restore a real backup into a NEW isolated password-protected loopback cluster.
// No production connection or live writes. Never deletes backup/restore data.
require('reflect-metadata');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const {OfficialRouteFoundationService}=require('../dist/src/routes/official-route-foundation.service');
const {officialPassageCatalog}=require('../dist/src/exam-centres/official-passage-catalog');
const root=path.resolve(__dirname,'../../output/db-backups');
const archive=path.resolve(process.argv[2]||'');
if(!archive.startsWith(root+path.sep)||!archive.endsWith('.dump'))throw Error('Task-local backup archive required');
const bin=path.join(root,'pg18-tools/pgsql/bin');
const migration=path.resolve(__dirname,'../prisma/migrations/0018_official_route_foundation/migration.sql');
const dir=path.join(root,`phase-two-restore-${Date.now()}`),data=path.join(dir,'data'),pwfile=path.join(dir,'password');
const password=crypto.randomBytes(32).toString('hex');
fs.mkdirSync(dir,{mode:0o700});fs.writeFileSync(pwfile,password,{flag:'wx',mode:0o600});
const env={...process.env,PGHOST:'127.0.0.1',PGPORT:'15440',PGUSER:'phase_two_restore',PGPASSWORD:password,PGDATABASE:'phase_two_restore'};
function run(name,args){const r=cp.spawnSync(path.join(bin,`${name}.exe`),args,{env,windowsHide:true,stdio:name==='pg_ctl'?'ignore':['ignore','pipe','pipe'],timeout:180000});if(r.status!==0||r.error)throw Error(`${name} failed; sensitive details omitted`);}
async function fingerprints(db){
 const tables=await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"),hashes={};
 for(const {tablename}of tables){const safe=tablename.replace(/"/g,'""');const rows=await db.$queryRawUnsafe(`SELECT md5(COALESCE(string_agg(jsonb_strip_nulls(to_jsonb(t))::text,E'\\n' ORDER BY jsonb_strip_nulls(to_jsonb(t))::text),'')) AS fingerprint FROM public."${safe}" t`);hashes[tablename]=rows[0].fingerprint;}
 return hashes;
}
let started=false,db;
(async()=>{
 const archiveSha256=crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
 if(archiveSha256!==fs.readFileSync(`${archive}.sha256`,'utf8').trim())throw Error('Backup checksum mismatch');
 run('initdb',['-D',data,'-U','phase_two_restore','--pwfile',pwfile,'--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C']);
 run('pg_ctl',['-D',data,'-l',path.join(dir,'server.log'),'-o','-h 127.0.0.1 -p 15440','-w','start']);started=true;
 run('createdb',['phase_two_restore']);run('pg_restore',['--exit-on-error','--no-owner','--no-acl','--dbname=phase_two_restore',archive]);
 const url=new URL('postgresql://127.0.0.1:15440/phase_two_restore');url.username=env.PGUSER;url.password=password;
 db=new PrismaClient({datasourceUrl:url.toString(),log:[]});const before=await fingerprints(db);
 const columns=await db.$queryRawUnsafe("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Route' AND column_name='foundation'");
 if(!columns.length)run('psql',['-X','-v','ON_ERROR_STOP=1','-q','-f',migration]);
 else {
  const applied=await db.$queryRawUnsafe('SELECT checksum,finished_at FROM "_prisma_migrations" WHERE migration_name=$1','0018_official_route_foundation');
  // Git checks out CRLF on Windows, while Railway applies the committed LF file.
  // Accept only byte-identical SQL with that single newline conversion, never a
  // different statement, trimmed whitespace, or a changed migration history row.
  const sql=fs.readFileSync(migration,'utf8'),lf=sql.replace(/\r\n/g,'\n');
  const checksums=new Set([sql,lf,lf.replace(/\n/g,'\r\n')].map(text=>crypto.createHash('sha256').update(text).digest('hex')));
  if(applied.length!==1||!applied[0].finished_at||!checksums.has(applied[0].checksum))throw Error('Restored foundation migration checksum mismatch');
  console.log(JSON.stringify({appliedMigrationChecksum:applied[0].checksum,localLfChecksum:crypto.createHash('sha256').update(lf).digest('hex'),newlineOnlyComparison:true}));
 }
 const after=await fingerprints(db);for(const table of Object.keys(before))if(before[table]!==after[table])throw Error(`Migration changed existing values in ${table}`);
 console.log('Full archive restore and additive migration passed; every existing table value preserved.');
 const actor=await db.user.findFirst({where:{role:{in:['ADMIN','SUPER_ADMIN']}},select:{id:true}});if(!actor)throw Error('No existing administrator for staging import verification');
 const service=new OfficialRouteFoundationService(db,{});let imported=0;
 for(const source of officialPassageCatalog){const centre=await db.examCentre.findUnique({where:{slug:source.slug},select:{id:true}});if(!centre)throw Error(`Source centre missing: ${source.slug}`);await service.importSource(actor.id,centre.id);imported+=source.points.length;}
 const importedHashes=await fingerprints(db);for(const table of Object.keys(before).filter(t=>!['OfficialPassagePoint','AuditLog'].includes(t)))if(before[table]!==importedHashes[table])throw Error(`Import changed protected table ${table}`);
 const receipt={createdAt:new Date().toISOString(),archive,archiveSha256,migrationChecksum:crypto.createHash('sha256').update(fs.readFileSync(migration,'utf8').replace(/\r\n/g,'\n')).digest('hex'),fullRestorePassed:true,migrationRehearsalPassed:true,existingValuesPreserved:true,protectedTablesUnchanged:true,sourceRowsImported:imported,publishedRoutes:await db.route.count({where:{status:'PUBLISHED'}})};
 const file=path.join(root,`phase-two-migration-rehearsal-${Date.now()}.json`);fs.writeFileSync(file,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({receipt:file,...receipt}));
})().catch(e=>{console.error(`Phase 2 rehearsal stopped: ${e.message}`);process.exitCode=1;}).finally(async()=>{if(db)await db.$disconnect();if(started){try{run('pg_ctl',['-D',data,'-m','fast','-w','stop']);}catch{console.error('Isolated restore server needs explicit shutdown');process.exitCode=1;}}if(fs.existsSync(pwfile))fs.unlinkSync(pwfile);});
