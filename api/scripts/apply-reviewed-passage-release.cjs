// One-time audited publication through the same review/draft/publication services
// as the administrator UI. No seed/startup job, role changes or billing writes.
require('reflect-metadata');
const fs=require('node:fs'),path=require('node:path');
const {PrismaClient}=require('@prisma/client');
const {DrivingRouteService}=require('../dist/src/routes/driving-route.service');
const {OfficialRouteFoundationService}=require('../dist/src/routes/official-route-foundation.service');
const {AdminService}=require('../dist/src/admin/admin.service');
const {NotificationsService}=require('../dist/src/notifications/notifications.service');
const {validatePrepared,sha}=require('./prepare-reviewed-passage-release.cjs');
const backupRoot=path.resolve(__dirname,'../../output/db-backups');
function validateRelease(bundle){
 validatePrepared(bundle);
 if(bundle.status!=='REMOTE_MAP_REGISTER_CONTENT_REVIEWED'||bundle.instructorApproved!==false||bundle.officialExamItinerary!==false||!Number.isFinite(Date.parse(bundle.reviewedAt))||Date.now()-Date.parse(bundle.reviewedAt)>86400000)throw Error('Recent explicit remote content review required');
}
async function apply(db,bundle,{actorEmail,forceConflict=false}={}){
 validateRelease(bundle);if(!actorEmail)throw Error('Authorized administrator email required');
 const actor=await db.user.findUnique({where:{email:actorEmail},select:{id:true,role:true}});
 if(!actor||!['ADMIN','SUPER_ADMIN'].includes(actor.role))throw Error('Authorized administrator unavailable');
 const driving=new DrivingRouteService();
 // Preflight every actual saved sequence BEFORE any writes. Reused only through
 // the ordinary short-lived routing cache during the single atomic transaction.
 for(const r of bundle.routes){
  const checked=await driving.evaluate(r.points);
  if(!checked.valid)throw Error(`Fresh preflight failed for ${r.centreSlug}: ${checked.issues.join(',')}`);
 }
 return db.$transaction(async tx=>{
  const nested=new Proxy(tx,{get(target,key){return key==='$transaction'?fn=>fn(nested):Reflect.get(target,key);}});
  const foundation=new OfficialRouteFoundationService(nested,driving);
  const admin=new AdminService(nested,driving,new NotificationsService(nested),{},foundation);
  const results=[];
  for(const r of bundle.routes){
   console.log(JSON.stringify({reviewing:r.centreSlug,staging:forceConflict}));
   const centre=await tx.examCentre.findUnique({where:{slug:r.centreSlug},include:{departure:true,officialPassagePoints:true}});
   if(!centre)throw Error('Expected source centre missing');
   const road=r.departure.government.roads.filter(p=>p.distanceM<=20&&publicDrivable(p)).sort((a,b)=>a.distanceM-b.distanceM)[0];
   const street=road.properties.LSTRNM==='nvt'?'Public-road':road.properties.LSTRNM;
   const notes=`Remote map/register review ${bundle.reviewedAt.slice(0,10)}: ${road.id}, TGBEP=1, STATUS=4; OSM/Mapbox road geometry. Drive-through start/finish only, not an exam entrance, parking permission or on-site/instructor approval. Recheck current signs. Evidence ${r.departure.government.sha256}.`;
   const departure={latitude:r.departure.latitude,longitude:r.departure.longitude,label:`${street} drive-through reference`,sourceUrl:r.departure.government.url,notes,verificationStatus:'VERIFIED'};
   const old=centre.departure;
   if(!old||Object.entries(departure).some(([key,value])=>old[key]!==value))await foundation.reviewDeparture(actor.id,centre.id,departure);
   const ids=[];
   for(const p of r.passages){
    const point=centre.officialPassagePoints.find(q=>q.sequence===p.sequence);if(!point||point.junction!==p.junction)throw Error('Live source differs from reviewed release');
    const note=`Remote map/register review ${bundle.reviewedAt.slice(0,10)}. OSM node ${p.osmNodeId}; exact source street names share this node. Flemish public/in-use roads (TGBEP=1, STATUS=4), evidence SHA256 ${p.government.sha256}. Not an on-site/instructor assessment; obey current signs. © OpenStreetMap contributors / ODbL; Digitaal Vlaanderen.`;
    if(point.latitude!==p.latitude||point.longitude!==p.longitude||point.verificationStatus!=='VERIFIED'||point.notes!==note)await foundation.reviewPassage(actor.id,point.id,{latitude:p.latitude,longitude:p.longitude,notes:note,verificationStatus:'VERIFIED'});
    ids.push(point.id);
   }
   const draft=await foundation.generateDraft(actor.id,centre.id,ids,r.shaped?r.points:undefined);
   const published=draft.status==='PUBLISHED'?draft:await admin.updateRoute(draft.id,{status:'PUBLISHED',verificationStatus:'VERIFIED'},actor.id);
   await foundation.validateSnapshot(published,await tx.routePoint.findMany({where:{routeId:published.id},orderBy:{sequence:'asc'}}));
   results.push({centreSlug:r.centreSlug,id:published.id,slug:published.slug,durationMin:published.durationMin,passages:ids.length,preserved:draft.status==='PUBLISHED'});
  }
  if(forceConflict)throw Error('STAGING_FORCED_LATE_ROLLBACK');
  await tx.auditLog.create({data:{userId:actor.id,action:'PHASE_TWO_PASSAGE_RELEASE_PUBLISHED',entity:'Route',metadata:{releaseSha256:sha(JSON.stringify(bundle)),reviewBasis:bundle.reviewBasis,routes:results.map(r=>r.id),officialExamItinerary:false}}});
  return results;
 },{isolationLevel:'Serializable',timeout:120000,maxWait:10000});
}
const publicDrivable=require('./prepare-road-register-evidence.cjs').publicDrivableRoad;
async function main(){
 const url=new URL(process.env.DATABASE_URL||''),file=path.resolve(process.argv[3]||''),receiptFile=path.resolve(process.argv[4]||'');
 if(process.argv[2]!=='--apply-private-production'||url.hostname!=='127.0.0.1'||url.port!=='15439'||!file.startsWith(path.resolve(__dirname,'../../output/chatbot-audit')+path.sep)||!receiptFile.startsWith(backupRoot+path.sep))throw Error('Explicit private production flag, task release and rehearsal receipt required');
 const bytes=fs.readFileSync(file),bundle=JSON.parse(bytes),receipt=JSON.parse(fs.readFileSync(receiptFile));
 if(!receipt.fullRestorePassed||!receipt.reviewedReleasePassed||!receipt.rollbackPassed||!receipt.protectedTablesUnchanged||receipt.releaseSha256!==sha(bytes)||Date.now()-Date.parse(receipt.createdAt)>7200000||!path.resolve(receipt.archive).startsWith(backupRoot+path.sep)||sha(fs.readFileSync(receipt.archive))!==receipt.archiveSha256)throw Error('Matching recent complete backup/restore/rollback rehearsal required');
 const db=new PrismaClient({log:[]});
 try{
  const results=await apply(db,bundle,{actorEmail:process.env.PHASE_TWO_ACTOR_EMAIL});
  const result={createdAt:new Date().toISOString(),releaseSha256:sha(bytes),results,billingChanged:false,existingRoutesReplaced:false};
  const output=path.join(backupRoot,`reviewed-passage-production-${Date.now()}.json`);fs.writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({receipt:output,...result}));
 }finally{await db.$disconnect();}
}
module.exports={apply,validateRelease};
if(require.main===module)main().catch(e=>{console.error(`Reviewed publication stopped (${e.code||e.name}); inspect the audit before retrying. Sensitive details omitted.`);process.exitCode=1;});
