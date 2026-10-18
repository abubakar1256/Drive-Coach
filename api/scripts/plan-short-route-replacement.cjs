// Read-only production planning. Fresh provider checks; no DB writes.
require('reflect-metadata');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {DrivingRouteService}=require('../dist/src/routes/driving-route.service');
const {similarRoads}=require('./build-road-catalog.cjs');
const dataRoot=path.resolve(__dirname,'../prisma/data');
const bundleFile=path.resolve(process.env.ROAD_REPLACEMENT_BUNDLE||path.join(dataRoot,'road-practice-short-prepared.json'));
if(!bundleFile.startsWith(dataRoot+path.sep)||!bundleFile.endsWith('.json'))throw Error('Reviewed task route data asset required');
const bundle=JSON.parse(fs.readFileSync(bundleFile,'utf8'));
const prisma=new PrismaClient({log:[]});
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function main(){
 if(!process.env.MAPBOX_DIRECTIONS_TOKEN&&!process.env.NEXT_PUBLIC_MAPBOX_TOKEN)throw Error('Routing token missing');
 const routes=await prisma.route.findMany({where:{status:'PUBLISHED',verificationStatus:'ROAD_VALIDATED',reviewedBy:'ROAD_ROUTING_ENGINE',centre:{isPublished:true}},include:{centre:{select:{slug:true}},points:{orderBy:{sequence:'asc'},include:{_count:{select:{mediaAssets:true,features:true}}}},_count:{select:{skillCoverage:true}}},orderBy:[{createdAt:'asc'},{id:'asc'}]});
 if(routes.length!==131)throw Error('Unexpected generated-route inventory; review required');
 const ids=routes.map(r=>r.id);
 const sessions=await prisma.practiceSession.findMany({where:{routeId:{in:ids}},select:{routeSnapshot:true}});
 if(sessions.some(s=>!s.routeSnapshot))throw Error('Historical session has no immutable snapshot');
 const driving=new DrivingRouteService();
 const checks=new Map(),geometries=new Map(),planned=[];
 let requests=0;
 const original=global.fetch;
 global.fetch=async(url,options)=>{
   if(!String(url).startsWith('https://api.mapbox.com/directions/')||++requests>131)throw Error('Provider budget exceeded');
   const response=await original(url,options);
   if([401,402,403,429].includes(response.status))throw Error('Provider limit/access failure');
   return response;
 };
 try{
  for(const route of routes){
   if(route._count.skillCoverage||route.points.some(p=>p._count.mediaAssets||p._count.features||p.imageUrl||p.videoUrl||p.warning))throw Error('Generated route has curated content; preserve manually');
   const match=route.slug.match(/-road-practice-loop-(\d+)$/);
   if(!match)throw Error('Unexpected generated route identity');
   const centreSlug=route.centre.slug==='ghent-east'?'sint-denijs-westrem':route.centre.slug;
   const slot=Number(match[1]);
   const item=bundle.routes.find(r=>r.centreSlug===centreSlug&&(r.slot??1)===slot);
   if(!item)throw Error('Prepared route missing');
   const key=`${centreSlug}:${slot}`;
   let checked=checks.get(key);
   if(!checked){
    checked=await driving.evaluate(item.points);
    if(!checked.valid||checked.durationSec<1380||checked.durationSec>1620)throw Error(`Fresh route validation failed for ${key}`);
    if(item.points[0].latitude!==item.points.at(-1).latitude||item.points[0].longitude!==item.points.at(-1).longitude)throw Error('Meeting-point closure failed');
    const prior=geometries.get(centreSlug)||[];
    if(prior.some(g=>similarRoads(g,checked.coordinates)))throw Error('Routes are insufficiently distinct');
    prior.push(checked.coordinates);geometries.set(centreSlug,prior);checks.set(key,checked);
   }
   const after=item.points.map((p,i)=>({sequence:i+1,latitude:p.latitude,longitude:p.longitude,bearing:p.bearing??null,category:i===0?'start':i===item.points.length-1?'finish':'waypoint',title:i===0?'Mapped practice meeting point':i===item.points.length-1?'Return to meeting point':`Road waypoint ${i+1}`,description:'Mapped road-network practice. Follow current signs and instructor guidance. Meeting point is not a confirmed exam-centre entrance.'}));
   planned.push({before:route,beforeHash:digest(route),after,durationSec:checked.durationSec,distanceM:checked.distanceM,checkedAt:new Date().toISOString()});
   if(planned.length%20===0)console.log(`Fresh checks: ${planned.length}/${routes.length}`);
  }
 }finally{global.fetch=original;}
 const plan={format:1,createdAt:new Date().toISOString(),sourceHash:digest(bundle),routes:planned,untouchedUnverifiedRoutes:await prisma.route.count({where:{status:'PUBLISHED',verificationStatus:'UNVERIFIED'}})};
 const file=path.resolve(__dirname,`../../output/db-backups/short-route-plan-${Date.now()}.json`);
 fs.writeFileSync(file,JSON.stringify(plan,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({plan:file,sha256:digest(plan),routes:planned.length,providerRequests:requests,minMinutes:Math.min(...planned.map(r=>r.durationSec))/60,maxMinutes:Math.max(...planned.map(r=>r.durationSec))/60,productionChanged:false},null,2));
}
main().catch(e=>{console.error(`Route replacement planning stopped: ${e.message.includes('token')?'Routing token missing':e.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]')}`);process.exitCode=1;}).finally(()=>prisma.$disconnect());
