// Read-only post-import consistency proof, including stable access ordering.
const fs=require('node:fs');
const {PrismaClient}=require('@prisma/client');
const {sameGeometry,freeIds,digest}=require('./replace-short-routes.cjs');
const plan=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const db=new PrismaClient({log:[]});
(async()=>{
 let updated=0,preserved=0;
 const rows=await db.route.findMany({where:{id:{in:plan.routes.map(e=>e.before.id)}},include:{points:{orderBy:{sequence:'asc'}}}});
 const byId=new Map(rows.map(r=>[r.id,r]));
 if(process.argv[3]==='--status'){
  console.log(JSON.stringify({plannedRoutes:plan.routes.length,originalVersions:plan.routes.filter(e=>byId.get(e.before.id)?.version===e.before.version).length,advancedVersions:plan.routes.filter(e=>byId.get(e.before.id)?.version===e.before.version+1).length,matchingNewGeometry:plan.routes.filter(e=>sameGeometry(byId.get(e.before.id)?.points||[],e.after)).length,routeAuditEntries:await db.auditLog.count({where:{action:'SHORT_ROUTE_VERSION_REPLACED'}})},null,2));return;
 }
 for(const e of plan.routes){
  const r=byId.get(e.before.id);
  const changed=!sameGeometry(e.before.points,e.after)||e.before.durationMin!==Math.ceil(e.durationSec/60);
  if(!r||r.slug!==e.before.slug||r.centreId!==e.before.centreId||r.createdAt.toISOString()!==e.before.createdAt||r.version!==e.before.version+(changed?1:0)||r.durationMin!==Math.ceil(e.durationSec/60)||r.status!==e.before.status||r.verificationStatus!==e.before.verificationStatus||!sameGeometry(r.points,e.after))throw Error('Live route consistency check failed');
  changed?updated++:preserved++;
 }
 const original=new Map();for(const e of plan.routes)if(!original.has(e.before.centreId))original.set(e.before.centreId,e.before.id);
 const expected=[...original].sort((a,b)=>a[0].localeCompare(b[0]));
 if(digest(expected)!==digest(await freeIds(db)))throw Error('Free route ordering mismatch');
 const outside=await db.route.findMany({where:{status:'PUBLISHED',verificationStatus:'ROAD_VALIDATED',reviewedBy:'ROAD_ROUTING_ENGINE',centre:{isPublished:true},durationMin:{not:{gte:23,lte:27}}},select:{id:true}});
 if(outside.length)throw Error('Out-of-window published routes remain');
 console.log(JSON.stringify({liveRoutesVerified:plan.routes.length,updated,preserved,centres:original.size,freeOrderingPreserved:true,allGeneratedRoutes23to27:true,curatedPointFeatures:await db.routePointFeature.count(),practiceSessions:await db.practiceSession.count(),routeAuditEntries:await db.auditLog.count({where:{action:'SHORT_ROUTE_VERSION_REPLACED'}})},null,2));
})().catch(()=>{console.error('Live verification failed; sensitive details omitted.');process.exitCode=1;}).finally(()=>db.$disconnect());
