// Explicit one-time, atomic release. No route/departure/account/financial writes.
require('reflect-metadata');
const fs=require('node:fs'),path=require('node:path');
const {PrismaClient}=require('@prisma/client');
const {passageSourceCatalog,currentPassageSource}=require('../dist/src/exam-centres/passage-source-catalog');
const {passageFingerprint}=require('../dist/src/exam-centres/official-passage-catalog');
const {OfficialRouteFoundationService}=require('../dist/src/routes/official-route-foundation.service');
const {belgianCoordinate}=require('../dist/src/routes/foundation-quality');
const {decisions,sha,root}=require('./prepare-additional-source-review.cjs');
const backupRoot=path.resolve(__dirname,'../../output/db-backups');
function validate(bundle){
  if(bundle.kind!=='ADDITIONAL_OPERATOR_SOURCE_REVIEW_V1'||bundle.officialExamItinerary!==false||bundle.instructorApproved!==false||bundle.sourceCatalogueSha256!==sha(JSON.stringify(passageSourceCatalog))||!Number.isFinite(Date.parse(bundle.reviewedAt))||Date.now()-Date.parse(bundle.reviewedAt)>86400000||Date.parse(bundle.reviewedAt)>Date.now()+60000)throw Error('Current explicitly reviewed release required');
  const expected=require('../prisma/data/walloon-passage-sources-2026.json').sources;
  // Freeze the actual explicitly reviewed coordinates/evidence, not just the
  // row allowlist. A changed road, coordinate or note requires a fresh review.
  if(bundle.worksheetSha256!=='706fc7582ababacc3c628a979bf702c55ca23b89f57d819a17d9872ee4525b30'||sha(JSON.stringify(bundle.rows))!=='819086429fd276c46796a70097df3c3d51d5fe0b6bbac2b1cc5c645008ce4e2e')throw Error('Explicit reviewed evidence changed');
  if(bundle.sources?.length!==14||new Set(bundle.sources.map(s=>s.slug)).size!==14||bundle.rows?.length!==117||new Set(bundle.rows.map(r=>`${r.slug}:${r.sequence}`)).size!==117)throw Error('Exact release set required');
  for(const source of expected){const s=bundle.sources.find(s=>s.slug===source.slug);if(!s||s.sourceUrl!==source.sourceUrl||s.sourceSha256!==source.sourceSha256||sha(JSON.stringify(s.fingerprints))!==sha(JSON.stringify(source.points.map(p=>passageFingerprint({...p,sourceUrl:source.sourceUrl,sourceRevision:source.sourceRevision})))))throw Error('Operator source changed');}
  for(const r of bundle.rows){
    const source=currentPassageSource(r.slug),p=source?.points.find(p=>p.sequence===r.sequence);
    if(!decisions[r.slug]?.includes(r.sequence)||!p||p.duplicateOfSequence!==null||r.junction!==p.junction||r.sourceFingerprint!==passageFingerprint({...p,sourceUrl:source.sourceUrl,sourceRevision:source.sourceRevision})||!belgianCoordinate(r)||typeof r.notes!=='string'||r.notes.length<100||r.notes.length>4000||!/^https:\/\/geo\.api\.vlaanderen\.be\//.test(r.government?.url||'')||!/^[a-f0-9]{64}$/.test(r.government?.sha256||'')||!Number.isSafeInteger(r.osmNodeId)||r.government.ids?.length<2)throw Error('Reviewed row changed');
  }
}
async function apply(db,bundle,{actorEmail,forceConflict=false}={}){
  validate(bundle);if(!actorEmail)throw Error('Authorized administrator required');
  return db.$transaction(async tx=>{
    await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext($1))','phase-two-additional-source-review');
    const actor=await tx.user.findUnique({where:{email:actorEmail},select:{id:true,role:true}});
    if(!actor||!['ADMIN','SUPER_ADMIN'].includes(actor.role))throw Error('Authorized administrator unavailable');
    await tx.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id"=$1 FOR SHARE',actor.id);
    const lockedActor=await tx.user.findUnique({where:{id:actor.id},select:{role:true}});if(!lockedActor||!['ADMIN','SUPER_ADMIN'].includes(lockedActor.role))throw Error('Administrator permission changed');
    const nested=new Proxy(tx,{get(target,key){return key==='$transaction'?fn=>fn(nested):Reflect.get(target,key);}}),foundation=new OfficialRouteFoundationService(nested,{});
    let imported=0,reviewed=0;
    for(const manifest of bundle.sources){
      const source=currentPassageSource(manifest.slug),centre=await tx.examCentre.findUnique({where:{slug:manifest.slug},select:{id:true}});
      if(!centre||!source)throw Error('Current centre/source unavailable');
      await tx.$queryRawUnsafe('SELECT "id" FROM "ExamCentre" WHERE "id"=$1 FOR UPDATE',centre.id);
      const existing=await tx.officialPassagePoint.findMany({where:{centreId:centre.id},orderBy:{sequence:'asc'}});
      if(existing.length){if(existing.length!==source.points.length||existing.some((p,i)=>p.sourceFingerprint!==manifest.fingerprints[i]||passageFingerprint(p)!==manifest.fingerprints[i]))throw Error('Existing source must not be overwritten');}
      else{await tx.officialPassagePoint.createMany({data:source.points.map((p,i)=>({...p,centreId:centre.id,sourceUrl:source.sourceUrl,sourceRevision:source.sourceRevision,sourceLabel:`${source.operatorName} published passage point — not mandatory on every exam`,sourceCheckedAt:new Date(source.sourceCheckedAt),sourceFingerprint:manifest.fingerprints[i]}))});imported+=source.points.length;}
    }
    for(const r of bundle.rows){
      const centre=await tx.examCentre.findUnique({where:{slug:r.slug},select:{id:true}});if(!centre)throw Error('Review centre unavailable');
      const p=await tx.officialPassagePoint.findUnique({where:{centreId_sequence:{centreId:centre.id,sequence:r.sequence}}});if(!p)throw Error('Reviewed source row missing');
      await tx.$queryRawUnsafe('SELECT "id" FROM "OfficialPassagePoint" WHERE "id"=$1 FOR UPDATE',p.id);
      const fresh=await tx.officialPassagePoint.findUnique({where:{id:p.id}});
      if(!fresh||fresh.sourceFingerprint!==r.sourceFingerprint||passageFingerprint(fresh)!==r.sourceFingerprint||fresh.duplicateOfSequence!==null)throw Error('Review source fingerprint changed');
      if(fresh.verificationStatus==='VERIFIED'&&fresh.latitude===r.latitude&&fresh.longitude===r.longitude&&fresh.notes===r.notes&&fresh.verifiedAt&&fresh.verifiedBy)continue;
      if(fresh.verificationStatus!=='PENDING_REVIEW'||fresh.latitude!==null||fresh.longitude!==null||fresh.verifiedAt!==null||fresh.verifiedBy!==null)throw Error('Existing review must not be overwritten');
      await foundation.reviewPassage(actor.id,p.id,{latitude:r.latitude,longitude:r.longitude,notes:r.notes,verificationStatus:'VERIFIED'});reviewed++;
    }
    const routes=(await tx.route.findMany({include:{points:{orderBy:{sequence:'asc'}}}})).filter(r=>r.foundation);
    for(const route of routes)await foundation.validateSnapshot(route,route.points,tx,true);
    if(forceConflict)throw Error('STAGING_FORCED_LATE_ROLLBACK');
    if(imported||reviewed)await tx.auditLog.create({data:{userId:actor.id,action:'ADDITIONAL_OPERATOR_SOURCES_REVIEWED',entity:'OfficialPassagePoint',metadata:{releaseSha256:sha(JSON.stringify(bundle)),imported,reviewed,officialExamItinerary:false,instructorApproved:false}}});
    return {imported,reviewed,existingFoundationRoutesPreserved:routes.length,routeAndFinancialWrites:false};
  },{isolationLevel:'Serializable',timeout:300000,maxWait:10000});
}
function validateReceipt(receipt,bytes){
  const archive=path.resolve(receipt.archive||''),age=Date.now()-Date.parse(receipt.createdAt);
  if(!receipt.fullRestorePassed||!receipt.rollbackPassed||!receipt.protectedTablesUnchanged||!receipt.existingSourcesPreserved||!receipt.idempotent||receipt.releaseSha256!==sha(bytes)||!Number.isFinite(age)||age< -60000||age>7200000||!archive.startsWith(backupRoot+path.sep)||!archive.endsWith('.dump')||Date.now()-fs.statSync(archive).mtimeMs>7200000||sha(fs.readFileSync(archive))!==receipt.archiveSha256||fs.readFileSync(archive+'.sha256','utf8').trim()!==receipt.archiveSha256)throw Error('Recent matching private restore/rollback rehearsal required');
}
async function main(){
  const url=new URL(process.env.DATABASE_URL||''),file=path.resolve(process.argv[3]||''),receiptFile=path.resolve(process.argv[4]||'');
  if(process.argv[2]!=='--apply-private-production'||url.hostname!=='127.0.0.1'||url.port!=='15439'||!file.startsWith(root+path.sep)||!receiptFile.startsWith(backupRoot+path.sep))throw Error('Explicit private release required');
  const bytes=fs.readFileSync(file);validateReceipt(JSON.parse(fs.readFileSync(receiptFile,'utf8')),bytes);
  const bundle=JSON.parse(bytes),db=new PrismaClient({log:[]});
  try{const result=await apply(db,bundle,{actorEmail:process.env.PHASE_TWO_ACTOR_EMAIL}),receipt={createdAt:new Date().toISOString(),releaseSha256:sha(bytes),...result},out=path.join(backupRoot,`additional-source-production-${Date.now()}.json`);fs.writeFileSync(out,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({receipt:out,...receipt}));}finally{await db.$disconnect();}
}
module.exports={validate,apply,validateReceipt};
if(require.main===module)main().catch(()=>{console.error('Additional source release stopped. Inspect audit; sensitive details omitted.');process.exitCode=1;});
