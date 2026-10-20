// Bounded proposal only; never changes a route, publication, plan or history.
require('reflect-metadata');
const fs=require('node:fs'),path=require('node:path');
const {DrivingRouteService}=require('../dist/src/routes/driving-route.service');
const {simpleRoadCycles,cycleWaypoints}=require('../dist/src/routes/practice-loop.service');
const {similarRoads}=require('./build-road-catalog.cjs');
const root=path.resolve(__dirname,'../../output/chatbot-audit/preparation-content');
async function main(){
 if(process.argv[2]!=='--prepare-repair')throw Error('Explicit repair preparation required');
 const file=path.resolve(process.argv[3]||'');if(!file.startsWith(root+path.sep))throw Error('Task driving evidence required');
 const input=JSON.parse(fs.readFileSync(file,'utf8')),broken=input.routes.filter(r=>!r.valid);
 if(broken.length!==1||broken[0].slug!=='brussels-south-road-practice-loop-02')throw Error('Only the inspected failed route may be prepared');
 const target=path.join(root,'anderlecht-route-b-repair.json');if(fs.existsSync(target))throw Error('Existing repair receipt preserved; no automatic rerun');
 const old=broken[0],origin=[old.snappedPoints[0].longitude,old.snappedPoints[0].latitude],candidates=simpleRoadCycles(old.coordinates).filter(c=>c.length>50).map(c=>cycleWaypoints(c,origin));
 const report={createdAt:new Date().toISOString(),id:old.id,slug:old.slug,version:old.version,fingerprint:old.fingerprint,requestCap:4,requests:0,attempts:[],approved:false,databaseChanged:false};
 const save=()=>fs.writeFileSync(target,JSON.stringify(report,null,2),{mode:0o600}),original=global.fetch;
 global.fetch=async(url,options)=>{if(!String(url).startsWith('https://api.mapbox.com/directions/v5/mapbox/driving/')||report.requests>=report.requestCap)throw Error('Repair request cap/destination rejected');report.requests++;save();return original(url,options);};
 try{
  const driving=new DrivingRouteService();
  for(const points of candidates.slice(0,4)){
   const result=await driving.evaluate(points),duplicate=result.valid&&input.routes.some(r=>r.valid&&r.centre.id===old.centre.id&&similarRoads(r.coordinates,result.coordinates));
   report.attempts.push({valid:result.valid,issues:result.issues,durationSec:result.durationSec,duplicate});
   if(result.valid&&!duplicate){report.prepared={points, ...result};break;}
  }
  save();console.log(JSON.stringify({file:target,requests:report.requests,prepared:!!report.prepared,attempts:report.attempts,approved:false,databaseChanged:false}));
 }finally{global.fetch=original;}
}
if(require.main===module)main().catch(()=>{console.error('Bounded repair preparation stopped; no live route changed.');process.exitCode=1;});
