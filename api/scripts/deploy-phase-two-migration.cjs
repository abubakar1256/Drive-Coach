// Explicit one-time additive migration; never app startup or seed content.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const root=path.resolve(__dirname,'../../output/db-backups');
const receiptFile=path.resolve(process.argv[3]||'');
const url=new URL(process.env.DATABASE_URL||'');
if(process.argv[2]!=='--apply-production'||url.hostname!=='127.0.0.1'||url.port!=='15439'||!receiptFile.startsWith(root+path.sep))throw Error('Explicit private production operation and task rehearsal receipt required');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const migration='0018_official_route_foundation';
const migrations=path.resolve(__dirname,'../prisma/migrations');
const receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));
if(!receipt.fullRestorePassed||!receipt.migrationRehearsalPassed||!receipt.existingValuesPreserved||!receipt.protectedTablesUnchanged||Date.now()-Date.parse(receipt.createdAt)>3600000||!Number.isFinite(Date.parse(receipt.createdAt)))throw Error('Recent successful full restore/migration rehearsal required');
if(!path.resolve(receipt.archive).startsWith(root+path.sep)||sha(fs.readFileSync(receipt.archive))!==receipt.archiveSha256||sha(fs.readFileSync(path.join(migrations,migration,'migration.sql')))!==receipt.migrationChecksum)throw Error('Backup/migration checksum mismatch');
const db=new PrismaClient({log:[]});
(async()=>{
 const rows=await db.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations"');
 if(rows.some(r=>!r.finished_at&&!r.rolled_back_at))throw Error('Unresolved migration requires manual review');
 const applied=rows.filter(r=>r.finished_at&&!r.rolled_back_at);
 const pending=fs.readdirSync(migrations,{withFileTypes:true}).filter(e=>e.isDirectory()&&!applied.some(r=>r.migration_name===e.name)).map(e=>e.name);
 if(!pending.length){
  if(applied.find(r=>r.migration_name===migration)?.checksum!==receipt.migrationChecksum)throw Error('Applied migration checksum mismatch');
  console.log(JSON.stringify({migration,alreadyApplied:true}));return;
 }
 if(pending.length!==1||pending[0]!==migration)throw Error('Unexpected pending migrations; production unchanged');
 const prismaCli=path.join(path.dirname(require.resolve('prisma/package.json')),'build/index.js');
 const run=cp.spawnSync(process.execPath,[prismaCli,'migrate','deploy','--schema',path.resolve(__dirname,'../prisma/schema.prisma')],{env:process.env,windowsHide:true,encoding:'utf8',timeout:180000});
 if(run.status!==0||run.error)throw Error('Prisma migration deploy failed; inspect migration state before retrying');
 const confirmed=await db.$queryRawUnsafe('SELECT checksum,finished_at FROM "_prisma_migrations" WHERE migration_name=$1',migration);
 if(confirmed.length!==1||!confirmed[0].finished_at||confirmed[0].checksum!==receipt.migrationChecksum)throw Error('Migration completion not confirmed');
 console.log(JSON.stringify({migration,applied:true,backupSha256:receipt.archiveSha256,routeContentChanged:false,financialRecordsChanged:false}));
})().catch(e=>{console.error(`Phase 2 migration stopped: ${e.message}`);process.exitCode=1;}).finally(()=>db.$disconnect());
