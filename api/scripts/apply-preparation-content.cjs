// One-time, explicitly reviewed content release. No account, payment or trial writes.
require('reflect-metadata');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {coverageFingerprint}=require('../dist/src/learning/personalization-policy');
const {mappedCoverageDetails}=require('../dist/src/learning/mapped-preparation-coverage');
const {passageFingerprint}=require('../dist/src/exam-centres/official-passage-catalog');
const supplemental=require('../prisma/data/supplemental-passage-sources.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const root=path.resolve(__dirname,'../../output/db-backups');
const evidenceRoot=path.resolve(__dirname,'../../output/chatbot-audit/preparation-content');
const hash=/^[a-f0-9]{64}$/;
function validateRelease(bundle){
 if(bundle.status!=='EXPLICIT_REMOTE_MAP_CONTENT_REVIEW'||bundle.officialExamItinerary!==false||bundle.instructorApproved!==false||!hash.test(bundle.archiveSha256)||!hash.test(bundle.mapSha256)||!hash.test(bundle.drivingSha256)||!Array.isArray(bundle.rows)||bundle.rows.length!==137||new Set(bundle.rows.map(r=>r.routeId)).size!==137)throw Error('Exact reviewed release required');
 const repair=bundle.repair;
 if(repair?.slug!=='brussels-south-road-practice-loop-02'||repair.afterVersion!==repair.beforeVersion+1||!hash.test(repair.beforeFingerprint)||!hash.test(repair.afterFingerprint)||!Array.isArray(repair.points)||repair.points.length!==25||!Number.isFinite(repair.durationSec)||repair.durationSec<1380||repair.durationSec>1620)throw Error('Exact bounded repair required');
 if(coverageFingerprint({id:repair.id,version:repair.afterVersion,points:repair.points})!==repair.afterFingerprint)throw Error('Repair content changed');
 if(new Set(repair.points.map(p=>p.id)).size!==25||repair.points.some((p,i)=>p.sequence!==i+1||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||p.latitude<49.4||p.latitude>51.6||p.longitude<2.4||p.longitude>6.5||(p.bearing!==null&&p.bearing!==undefined&&(!Number.isFinite(p.bearing)||p.bearing<0||p.bearing>=360))))throw Error('Bounded Belgian repair points required');
 for(const r of bundle.rows){
  if(!hash.test(r.fingerprint)||!Number.isSafeInteger(r.routeVersion)||r.routeVersion<1||!Array.isArray(r.skills)||!r.skills.length||new Set(r.skills).size!==r.skills.length||r.skills.some(s=>!['junctions','roundabouts'].includes(s))||typeof r.notes!=='string'||r.notes.length>2000||!/^https:\/\/www\.openstreetmap\.org\/(node|way)\/\d+$/.test(r.sourceUrl)||!mappedCoverageDetails(r.notes,r.complexity))throw Error('Invalid bounded map coverage');
  const n=JSON.parse(r.notes);
  if(n.mapSha256!==bundle.mapSha256||n.drivingSha256!==bundle.drivingSha256||!n.proofUrls?.includes(r.sourceUrl))throw Error('Coverage evidence binding changed');
 }
 if(!bundle.rows.some(r=>r.routeId===repair.id&&r.fingerprint===repair.afterFingerprint&&r.routeVersion===repair.afterVersion))throw Error('Repair coverage missing');
 return bundle;
}
function coverageData(r){return {routeId:r.routeId,routeVersion:r.routeVersion,fingerprint:r.fingerprint,skills:r.skills,complexity:r.complexity,sourceUrl:r.sourceUrl,notes:r.notes};}
function sameCoverage(current,row){return current&&Object.entries(coverageData(row)).every(([k,v])=>JSON.stringify(current[k])===JSON.stringify(v));}
async function apply(db,bundle,{actorEmail,forceConflict=false}={}){
 validateRelease(bundle);
 if(!actorEmail)throw Error('Explicit authorized administrator required');
 const actor=await db.user.findUnique({where:{email:actorEmail},select:{id:true,role:true}});
 if(!actor||!['ADMIN','SUPER_ADMIN'].includes(actor.role))throw Error('Authorized administrator unavailable');
 return db.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext($1))','phase23-reviewed-content');
  await tx.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id"=$1 FOR SHARE',actor.id);
  const freshActor=await tx.user.findUnique({where:{id:actor.id},select:{role:true}});
  if(!freshActor||!['ADMIN','SUPER_ADMIN'].includes(freshActor.role))throw Error('Administrator permission changed');
  const ids=bundle.rows.map(r=>r.routeId);
  await tx.$queryRawUnsafe('SELECT "id" FROM "Route" WHERE "id"=ANY($1::text[]) ORDER BY "id" FOR UPDATE',ids);
  await tx.$queryRawUnsafe('SELECT "id" FROM "RoutePoint" WHERE "routeId"=ANY($1::text[]) ORDER BY "id" FOR UPDATE',ids);
  const routes=await tx.route.findMany({where:{id:{in:ids}},include:{points:{orderBy:{sequence:'asc'}},preparationCoverage:true,centre:{select:{isPublished:true}}}});
  if(routes.length!==137)throw Error('Reviewed route set changed');
  const plans=[];let repaired=0;
  const missingSnapshots=await tx.practiceSession.count({where:{routeId:bundle.repair.id,routeSnapshot:{equals:require('@prisma/client').Prisma.DbNull}}});
  if(missingSnapshots)throw Error('Existing practice requires preserved historical snapshots');
  for(const row of bundle.rows){
   const route=routes.find(r=>r.id===row.routeId),repair=bundle.repair;
   if(!route||route.slug!==row.slug||!route.centre.isPublished||route.status!=='PUBLISHED'||!['VERIFIED','ROAD_VALIDATED'].includes(route.verificationStatus)||!route.reviewedBy)throw Error('Published route identity changed');
   const before=route.id===repair.id&&route.version===repair.beforeVersion&&coverageFingerprint(route)===repair.beforeFingerprint;
   if(!before&&(route.version!==row.routeVersion||coverageFingerprint(route)!==row.fingerprint)){console.error(JSON.stringify({route:row.slug,actualVersion:route.version,expectedVersion:row.routeVersion,actualFingerprint:coverageFingerprint(route),expectedFingerprint:row.fingerprint}));throw Error('Concurrent route content changed');}
   if(before&&(route.foundation||route.points.length!==repair.points.length||route.points.some((p,i)=>p.id!==repair.points[i].id||p.sequence!==repair.points[i].sequence)))throw Error('Repair cannot replace foundation or point identities');
   if(route.preparationCoverage&&!sameCoverage(route.preparationCoverage,row))throw Error('Existing human coverage review must be preserved');
   plans.push({row,before,route});
  }
  // Import only new names, never approve or overwrite existing location reviews.
  let imported=0;
  for(const source of supplemental.sources){
   const centre=await tx.examCentre.findUnique({where:{slug:source.slug},select:{id:true}});if(!centre)throw Error('Source centre missing');
   const existing=await tx.officialPassagePoint.findMany({where:{centreId:centre.id},orderBy:{sequence:'asc'}});
   const rows=source.points.map(p=>({...p,centreId:centre.id,sourceUrl:source.sourceUrl,sourceRevision:source.sourceRevision,sourceLabel:`${source.operatorName} published passage point — not mandatory on every exam`,sourceCheckedAt:new Date(source.sourceCheckedAt),sourceFingerprint:passageFingerprint({...p,sourceUrl:source.sourceUrl,sourceRevision:source.sourceRevision})}));
   if(existing.length){if(existing.length!==rows.length||existing.some((p,i)=>p.sourceFingerprint!==rows[i].sourceFingerprint||passageFingerprint(p)!==rows[i].sourceFingerprint||p.duplicateOfSequence!==rows[i].duplicateOfSequence))throw Error('Existing source content must be preserved');}
   else{await tx.officialPassagePoint.createMany({data:rows});imported+=rows.length;}
  }
  const pending=[];
  for(const {row,before,route}of plans){
   if(before){
    for(const p of bundle.repair.points)await tx.routePoint.update({where:{id:p.id},data:{latitude:p.latitude,longitude:p.longitude,bearing:p.bearing??null}});
    await tx.route.update({where:{id:route.id},data:{version:bundle.repair.afterVersion,durationMin:Math.ceil(bundle.repair.durationSec/60),verifiedAt:new Date(),reviewedBy:actor.id}});repaired++;
   }
   if(!route.preparationCoverage)pending.push({...coverageData(row),reviewedBy:actor.id});
  }
  if(pending.length)await tx.preparationCoverage.createMany({data:pending});
  if(forceConflict)throw Error('STAGING_FORCED_LATE_ROLLBACK');
  if(pending.length||imported||repaired)await tx.auditLog.create({data:{userId:actor.id,action:'PREPARATION_REMOTE_CONTENT_RELEASED',entity:'PreparationCoverage',metadata:{releaseSha256:sha(JSON.stringify(bundle)),coverage:pending.length,sourceNamesImported:imported,repaired,officialExamItinerary:false,instructorApproved:false}}});
  return {coverageCreated:pending.length,sourceNamesImported:imported,repaired,routeCount:routes.length,instructorApproved:false};
 },{isolationLevel:'Serializable',timeout:300000,maxWait:10000});
}
function validateReceipt(receipt,bytes){
 const archive=path.resolve(receipt.archive||''),age=Date.now()-Date.parse(receipt.createdAt);
 if(!receipt.fullRestorePassed||!receipt.rollbackPassed||!receipt.protectedTablesUnchanged||!receipt.routeIdentitiesPreserved||!receipt.idempotent||receipt.releaseSha256!==sha(bytes)||!Number.isFinite(age)||age< -60000||age>7200000||!archive.startsWith(root+path.sep)||!archive.endsWith('.dump')||Date.now()-fs.statSync(archive).mtimeMs>7200000||sha(fs.readFileSync(archive))!==receipt.archiveSha256||fs.readFileSync(archive+'.sha256','utf8').trim()!==receipt.archiveSha256)throw Error('Recent matching private backup and rehearsal required');
}
async function main(){
 const url=new URL(process.env.DATABASE_URL||''),file=path.resolve(process.argv[3]||''),receiptFile=path.resolve(process.argv[4]||'');
 if(process.argv[2]!=='--apply-private-production'||url.hostname!=='127.0.0.1'||url.port!=='15439'||!file.startsWith(evidenceRoot+path.sep)||!receiptFile.startsWith(root+path.sep))throw Error('Explicit private production and task-local manifest required');
 const bytes=fs.readFileSync(file);validateReceipt(JSON.parse(fs.readFileSync(receiptFile,'utf8')),bytes);const bundle=validateRelease(JSON.parse(bytes)),db=new PrismaClient({log:[]});
 try{const result=await apply(db,bundle,{actorEmail:process.env.PHASE_TWO_ACTOR_EMAIL}),receipt={createdAt:new Date().toISOString(),releaseSha256:sha(bytes),...result};const file=path.join(root,'preparation-content-production-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({receipt:file,...receipt}));}finally{await db.$disconnect();}
}
module.exports={apply,validateRelease,validateReceipt,sha,sameCoverage};
if(require.main===module)main().catch(()=>{console.error('Content release stopped; inspect the audit before retrying. Sensitive details omitted.');process.exitCode=1;});
