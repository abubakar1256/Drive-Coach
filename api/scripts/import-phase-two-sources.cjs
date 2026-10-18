// One-time user-authorized source import. Never verifies coordinates or publishes.
require('reflect-metadata');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {OfficialRouteFoundationService}=require('../dist/src/routes/official-route-foundation.service');
const {officialPassageCatalog}=require('../dist/src/exam-centres/official-passage-catalog');
const root=path.resolve(__dirname,'../../output/db-backups');
const receiptFile=path.resolve(process.argv[3]||''),url=new URL(process.env.DATABASE_URL||'');
if(process.argv[2]!=='--apply-production'||url.hostname!=='127.0.0.1'||url.port!=='15439'||!receiptFile.startsWith(root+path.sep))throw Error('Explicit private production operation and rehearsal receipt required');
const receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(!receipt.fullRestorePassed||!receipt.migrationRehearsalPassed||!receipt.protectedTablesUnchanged||!Number.isFinite(Date.parse(receipt.createdAt))||Date.now()-Date.parse(receipt.createdAt)>3600000||!path.resolve(receipt.archive).startsWith(root+path.sep)||sha(fs.readFileSync(receipt.archive))!==receipt.archiveSha256)throw Error('Recent full backup/restore rehearsal required');
const db=new PrismaClient({log:[]});
(async()=>{
 const migration=await db.$queryRawUnsafe('SELECT checksum,finished_at FROM "_prisma_migrations" WHERE migration_name=$1','0018_official_route_foundation');
 if(migration.length!==1||!migration[0].finished_at||migration[0].checksum!==receipt.migrationChecksum)throw Error('Additive migration not confirmed');
 if(!process.env.PHASE_TWO_ACTOR_EMAIL)throw Error('Explicit authorized administrator email required');
 const actor=await db.user.findUnique({where:{email:process.env.PHASE_TWO_ACTOR_EMAIL},select:{id:true,role:true}});
 if(!actor||!['ADMIN','SUPER_ADMIN'].includes(actor.role))throw Error('Previously authorized administrator is unavailable');
 const service=new OfficialRouteFoundationService(db,{}),centres=[];
 for(const source of officialPassageCatalog){
  const c=await db.examCentre.findUnique({where:{slug:source.slug},select:{id:true}});if(!c)throw Error('Expected source centre missing');
  const result=await service.importSource(actor.id,c.id);centres.push({slug:source.slug,...result});
 }
 const result={createdAt:new Date().toISOString(),centres,importedEntries:centres.reduce((n,c)=>n+c.imported,0),automaticallyVerified:false,published:false,financialRecordsChanged:false};
 const file=path.join(root,`phase-two-source-import-${Date.now()}.json`);fs.writeFileSync(file,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({receipt:file,...result}));
})().catch(e=>{console.error(`Source import stopped (${e.code||e.name}); sensitive details omitted. Inspect per-centre audit entries before retrying.`);process.exitCode=1;}).finally(()=>db.$disconnect());
