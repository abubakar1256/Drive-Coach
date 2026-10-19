// Coordinate-only release. No route, departure, account, entitlement or billing
// mutation. Previously published source proof and reviewer timestamps survive.
require('reflect-metadata');
const fs=require('node:fs'),path=require('node:path');
const {PrismaClient}=require('@prisma/client');
const {OfficialRouteFoundationService,reviewedPassage}=require('../dist/src/routes/official-route-foundation.service');
const {passageFingerprint}=require('../dist/src/exam-centres/official-passage-catalog');
const {validateCompleteReview}=require('./prepare-complete-passage-review.cjs');
const {sha}=require('./prepare-reviewed-passage-release.cjs');
const backupRoot=path.resolve(__dirname,'../../output/db-backups');
function pendingReviewState(point){
 return sha(JSON.stringify([point.id,point.centreId,point.sourceFingerprint,point.duplicateOfSequence,point.verificationStatus,point.latitude,point.longitude,point.notes,point.verifiedAt,point.verifiedBy,point.updatedAt]));
}
async function apply(db,bundle,{actorEmail,forceConflict=false}={}){
 validateCompleteReview(bundle);
 if(!actorEmail)throw Error('Explicit authorized administrator required');
 const actor=await db.user.findUnique({where:{email:actorEmail},select:{id:true,role:true}});
 if(!actor||!['ADMIN','SUPER_ADMIN'].includes(actor.role))throw Error('Authorized administrator unavailable');
 return db.$transaction(async tx=>{
  const nested=new Proxy(tx,{get(target,key){return key==='$transaction'?fn=>fn(nested):Reflect.get(target,key);}});
  const foundation=new OfficialRouteFoundationService(nested,{}),results=[];
  // Lock all source rows before any mutation. Changes during preflight cannot
  // silently rewrite somebody else's review or a previously published proof.
  const plans=[];
  const routes=(await tx.route.findMany({include:{points:{orderBy:{sequence:'asc'}}}})).filter(r=>r.foundation);
  const referenced=new Set(routes.flatMap(r=>r.foundation?.points?.map(p=>p.id)||[]));
  for(const c of bundle.centres){
   const centre=await tx.examCentre.findUnique({where:{slug:c.slug},include:{officialPassagePoints:true}});
   if(!centre||centre.officialPassagePoints.length!==c.points.length)throw Error('Live source count changed');
   for(const p of c.points){
    const current=centre.officialPassagePoints.find(q=>q.sequence===p.sequence);
    if(!current)throw Error('Live source row missing');
    await tx.$queryRawUnsafe('SELECT "id" FROM "OfficialPassagePoint" WHERE "id"=$1 FOR UPDATE',current.id);
    const fresh=await tx.officialPassagePoint.findUnique({where:{id:current.id}});
    if(!fresh||fresh.sourceFingerprint!==p.sourceFingerprint||passageFingerprint(fresh)!==p.sourceFingerprint)throw Error('Live source fingerprint changed');
    if(p.disposition==='SOURCE_DUPLICATE'){
     if(fresh.duplicateOfSequence!==p.duplicateOfSequence||fresh.verificationStatus==='VERIFIED')throw Error('Duplicate source unexpectedly changed');
     continue;
    }
    if(p.disposition==='PRESERVE_PUBLISHED_REVIEW'){
     if(!reviewedPassage(fresh)||fresh.latitude!==p.latitude||fresh.longitude!==p.longitude)throw Error('Published source review changed');
     continue;
    }
    const unchanged=reviewedPassage(fresh)&&fresh.latitude===p.latitude&&fresh.longitude===p.longitude&&fresh.notes===p.notes;
    const knownUnreviewedCoordinates=p.expectedPendingStateSha256&&p.expectedPendingStateSha256===pendingReviewState(fresh);
    if(!unchanged&&(referenced.has(fresh.id)||fresh.verificationStatus!=='PENDING_REVIEW'||fresh.verifiedAt!==null||fresh.verifiedBy!==null||((fresh.latitude!==null||fresh.longitude!==null)&&!knownUnreviewedCoordinates)))throw Error('Existing location review must not be overwritten');
    plans.push({centre:c.slug,id:fresh.id,p,unchanged});
   }
  }
  for(const plan of plans)if(!plan.unchanged)await foundation.reviewPassage(actor.id,plan.id,{latitude:plan.p.latitude,longitude:plan.p.longitude,notes:plan.p.notes,verificationStatus:'VERIFIED'});
  for(const route of routes)await foundation.validateSnapshot(route,route.points,tx,true);
  if(forceConflict)throw Error('STAGING_FORCED_LATE_ROLLBACK');
  for(const c of bundle.centres)results.push({centreSlug:c.slug,reviewed:c.points.filter(p=>p.disposition!=='SOURCE_DUPLICATE').length,duplicateEntries:c.points.filter(p=>p.disposition==='SOURCE_DUPLICATE').length,changed:plans.filter(p=>p.centre===c.slug&&!p.unchanged).length});
  if(plans.some(p=>!p.unchanged))await tx.auditLog.create({data:{userId:actor.id,action:'PHASE_TWO_SOURCE_LOCATIONS_RECONCILED',entity:'OfficialPassagePoint',metadata:{releaseSha256:sha(JSON.stringify(bundle)),remoteReview:true,officialExamItinerary:false,results}}});
  return {results,changed:plans.filter(p=>!p.unchanged).length,existingProofsPreserved:routes.length};
 // Remote SSH latency adds a round trip to each ordinary review/audit call.
 // Keep one bounded atomic operation; never split into partially applied batches.
 },{isolationLevel:'Serializable',timeout:300000,maxWait:10000});
}
function validateReceipt(receipt,releaseBytes){
 const archive=path.resolve(receipt.archive||'');
 if(!receipt.fullRestorePassed||!receipt.completeReviewPassed||!receipt.rollbackPassed||!receipt.protectedTablesUnchanged||!receipt.idempotent||receipt.releaseSha256!==sha(releaseBytes)||!Number.isFinite(Date.parse(receipt.createdAt))||Date.parse(receipt.createdAt)>Date.now()+60000||Date.now()-Date.parse(receipt.createdAt)>7200000||!archive.startsWith(backupRoot+path.sep)||!archive.endsWith('.dump')||Date.now()-fs.statSync(archive).mtimeMs>7200000||fs.statSync(archive).mtimeMs>Date.now()+60000||sha(fs.readFileSync(archive))!==receipt.archiveSha256)throw Error('Matching recent full backup/restore/rollback/idempotency rehearsal required');
}
async function main(){
 const url=new URL(process.env.DATABASE_URL||''),file=path.resolve(process.argv[3]||''),receiptFile=path.resolve(process.argv[4]||'');
 if(process.argv[2]!=='--apply-private-production'||url.hostname!=='127.0.0.1'||url.port!=='15439'||!file.startsWith(path.resolve(__dirname,'../../output/chatbot-audit/phase-two-reconciliation')+path.sep)||!receiptFile.startsWith(backupRoot+path.sep))throw Error('Explicit private production flag and task manifest/rehearsal required');
 const bytes=fs.readFileSync(file);validateReceipt(JSON.parse(fs.readFileSync(receiptFile,'utf8')),bytes);
 const bundle=JSON.parse(bytes),db=new PrismaClient({log:[]});
 try{
  const result=await apply(db,bundle,{actorEmail:process.env.PHASE_TWO_ACTOR_EMAIL});
  const output=path.join(backupRoot,`complete-passage-production-${Date.now()}.json`),receipt={createdAt:new Date().toISOString(),releaseSha256:sha(bytes),...result,routeAndBillingWrites:false};
  fs.writeFileSync(output,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({receipt:output,...receipt}));
 }finally{await db.$disconnect();}
}
module.exports={apply,validateReceipt,pendingReviewState};
if(require.main===module)main().catch(()=>{console.error('Source-location release stopped; inspect the audit before retrying. Sensitive details omitted.');process.exitCode=1;});
