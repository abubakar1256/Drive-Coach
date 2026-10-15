// Explicit version-preserving maintenance. Never invoked by app startup/seeding.
const fs=require('node:fs');
const crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const include={centre:{select:{slug:true}},points:{orderBy:{sequence:'asc'},include:{_count:{select:{mediaAssets:true,features:true}}}},_count:{select:{skillCoverage:true}}};
const policy={status:'PUBLISHED',verificationStatus:{in:['VERIFIED','ROAD_VALIDATED']},reviewedBy:{not:null},durationMin:{gte:24},centre:{isPublished:true}};
function validatePlan(plan){
 if(plan.format!==1||!Array.isArray(plan.routes)||plan.routes.length!==131)throw Error('Unexpected replacement plan');
 if(!Number.isFinite(Date.parse(plan.createdAt))||Date.now()-Date.parse(plan.createdAt)>3600000||Date.parse(plan.createdAt)>Date.now()+120000)throw Error('Stale replacement plan');
 if(new Set(plan.routes.map(r=>r.before.id)).size!==131)throw Error('Duplicate route identity');
 for(const r of plan.routes){
  if(r.before.reviewedBy!=='ROAD_ROUTING_ENGINE'||r.before.verificationStatus!=='ROAD_VALIDATED'||r.beforeHash!==digest(r.before))throw Error('Invalid source snapshot');
  if(!Number.isFinite(r.durationSec)||r.durationSec<1440||r.durationSec>1800)throw Error('Invalid duration');
  if(!Number.isFinite(Date.parse(r.checkedAt))||Date.now()-Date.parse(r.checkedAt)>3600000||Date.parse(r.checkedAt)>Date.now()+120000)throw Error('Stale provider validation');
  if(r.before._count.skillCoverage||r.before.points.some(p=>p._count.features||p._count.mediaAssets||p.warning||p.imageUrl||p.videoUrl))throw Error('Curated content must not be overwritten');
  if(r.after.length<2||r.after.length>25||r.after.some((p,i)=>p.sequence!==i+1||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||Math.abs(p.latitude)>90||Math.abs(p.longitude)>180||(p.bearing!==null&&!Number.isFinite(p.bearing))))throw Error('Invalid replacement anchors');
  if(r.after[0].latitude!==r.after.at(-1).latitude||r.after[0].longitude!==r.after.at(-1).longitude)throw Error('Unclosed loop');
 }
}
async function freeIds(db){
 const rows=await db.route.findMany({where:policy,orderBy:[{createdAt:'asc'},{id:'asc'}],select:{id:true,centreId:true}});
 const byCentre=new Map();for(const r of rows)if(!byCentre.has(r.centreId))byCentre.set(r.centreId,r.id);
 return [...byCentre].sort((a,b)=>a[0].localeCompare(b[0]));
}
function sameGeometry(a,b){
 if(a.length!==b.length)return false;
 return a.every((p,i)=>Math.abs(p.latitude-b[i].latitude)<=1e-12&&Math.abs(p.longitude-b[i].longitude)<=1e-12&&((p.bearing??null)===(b[i].bearing??null)||(Number.isFinite(p.bearing)&&Number.isFinite(b[i].bearing)&&Math.abs(p.bearing-b[i].bearing)<=1e-10)));
}
async function replace(db,plan){
 validatePlan(plan);
 return db.$transaction(async tx=>{
  await tx.$queryRawUnsafe("SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('short-route-replacement-v1'))");
  const freeBefore=await freeIds(tx);
  const missingSnapshots=await tx.practiceSession.count({where:{routeId:{in:plan.routes.map(r=>r.before.id)},routeSnapshot:{equals:require('@prisma/client').Prisma.DbNull}}});
  if(missingSnapshots)throw Error('Historical practice snapshots required');
  let changed=0;
  const currentRows=await tx.route.findMany({where:{id:{in:plan.routes.map(r=>r.before.id)}},include});
  const byId=new Map(currentRows.map(r=>[r.id,r]));
  const replacements=[],audits=[];
  for(const entry of plan.routes){
   const current=byId.get(entry.before.id);
   if(!current||digest(current)!==entry.beforeHash)throw Error('Route changed since planning; transaction cancelled');
   const durationMin=Math.ceil(entry.durationSec/60);
   if(sameGeometry(current.points,entry.after)&&current.durationMin===durationMin)continue;
   const updated=await tx.route.updateMany({where:{id:current.id,version:current.version,updatedAt:current.updatedAt},data:{durationMin,version:{increment:1},verifiedAt:new Date(entry.checkedAt)}});
   if(updated.count!==1)throw Error('Concurrent route modification');
   replacements.push({id:current.id,points:entry.after});
   audits.push({action:'SHORT_ROUTE_VERSION_REPLACED',entity:'Route',entityId:current.id,metadata:{planHash:digest(plan),durationSec:entry.durationSec,distanceM:entry.distanceM,instructorApproved:false,before:JSON.parse(JSON.stringify(current)),afterVersion:current.version+1}});
   changed++;
  }
  if(replacements.length){
   await tx.routePoint.deleteMany({where:{routeId:{in:replacements.map(r=>r.id)}}});
   await tx.routePoint.createMany({data:replacements.flatMap(r=>r.points.map(p=>({...p,routeId:r.id})))});
   await tx.auditLog.createMany({data:audits});
  }
  if(digest(await freeIds(tx))!==digest(freeBefore))throw Error('Free-route ordering changed; transaction cancelled');
  return {changed,preserved:plan.routes.length-changed,centres:freeBefore.length,freeOrderingPreserved:true};
 },{isolationLevel:'Serializable',timeout:180000,maxWait:10000});
}
async function main(){
 const [mode,file,receiptFile]=process.argv.slice(2);
 const url=new URL(process.env.DATABASE_URL||'');
 if(mode!=='--apply-production'||url.hostname!=='127.0.0.1'||url.port!=='15439')throw Error('Explicit private production operation required');
 const plan=JSON.parse(fs.readFileSync(file,'utf8'));
 const receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));
 if(receipt.planHash!==digest(plan)||!receipt.fullRestorePassed||!receipt.stagingReplacementPassed||!receipt.rollbackPassed||!receipt.protectedTablesUnchanged||!Number.isFinite(Date.parse(receipt.createdAt))||Date.now()-Date.parse(receipt.createdAt)>3600000)throw Error('Matching recent restore/rehearsal receipt required');
 const archive=fs.readFileSync(receipt.archive);
 if(crypto.createHash('sha256').update(archive).digest('hex')!==receipt.archiveSha256)throw Error('Backup checksum mismatch');
 const db=new PrismaClient({log:[]});
 try{console.log(JSON.stringify(await replace(db,plan)));}finally{await db.$disconnect();}
}
module.exports={digest,validatePlan,replace,freeIds,sameGeometry};
if(require.main===module)main().catch(error=>{console.error(`Replacement stopped (${error.code||error.name}); sensitive details omitted. Inspect transaction status before retrying.`);process.exitCode=1;});
