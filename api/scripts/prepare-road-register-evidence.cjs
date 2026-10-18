// Read-only, bounded and cached official road-register checks. Never verifies DB rows.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {metres}=require('../dist/src/learning/practice-progress');
const {normalize}=require('./prepare-passage-map-evidence.cjs');
const root=path.resolve(__dirname,'../../output/chatbot-audit/phase-two-offline-map');
const endpoint='https://geo.api.vlaanderen.be/GRB/ogc/features/v1/collections/Wegsegment/items';
function lineDistance(point,coordinates){
 let best=Infinity;const scale=Math.cos(point.latitude*Math.PI/180),q=[point.longitude,point.latitude];
 for(let i=1;i<coordinates.length;i++){
  const a=coordinates[i-1],b=coordinates[i],dx=(b[0]-a[0])*scale,dy=b[1]-a[1];
  const t=dx*dx+dy*dy?Math.max(0,Math.min(1,((q[0]-a[0])*scale*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy))):0;
  best=Math.min(best,metres(q,[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]));
 }return best;
}
function roadMatches(point,data,requiredName){
 return data.features.filter(f=>f.geometry?.type==='LineString'&&Array.isArray(f.geometry.coordinates)).map(f=>({id:f.id,properties:f.properties,distanceM:lineDistance(point,f.geometry.coordinates)})).filter(f=>f.distanceM<=40&&(!requiredName||[f.properties.LSTRNM,f.properties.RSTRNM].some(n=>normalize(n??'')===normalize(requiredName))));
}
function publicDrivableRoad(road){
 const p=road?.properties;
 const allowed=['weg bestaande uit één rijbaan','weg met gescheiden rijbanen die geen autosnelweg is','rotonde','ventweg','op- of afrit, behorende tot een gelijkgrondse verbinding','op- of afrit, behorende tot een niet-gelijkgrondse verbinding'];
 return Boolean(p&&p.TGBEP===1&&p.STATUS===4&&allowed.includes(p.LBLMORF));
}
async function main(){
 const evidence=JSON.parse(fs.readFileSync(path.join(root,'passage-evidence.json'),'utf8'));
 const routes=require('../prisma/data/road-practice-phase-two-prepared.json').routes;
 const cacheDir=path.join(root,'road-register');fs.mkdirSync(cacheDir,{recursive:true});
 let requests=0;const cap=250;
 async function check(point){
  const bbox=[point.longitude-.0012,point.latitude-.0008,point.longitude+.0012,point.latitude+.0008].map(n=>n.toFixed(7)).join(',');
  const url=`${endpoint}?${new URLSearchParams({f:'application/json',limit:'100',bbox})}`;
  const key=crypto.createHash('sha256').update(url).digest('hex');const file=path.join(cacheDir,`${key}.json`);
  let entry;
  if(fs.existsSync(file))entry=JSON.parse(fs.readFileSync(file,'utf8'));
  else{
   if(requests>=cap)throw Error('Official road-register request cap reached');requests++;
   const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'DriveCoach-SourceReview/1.0'}});
   if(!r.ok)throw Error(`Road-register unavailable (${r.status}); collection stopped`);
   const data=await r.json();if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||data.links?.some(l=>l.rel==='next'))throw Error('Incomplete road-register response; narrow the review area');
   entry={url,checkedAt:new Date().toISOString(),data};fs.writeFileSync(file,JSON.stringify(entry),{flag:'wx'});
   await new Promise(resolve=>setTimeout(resolve,400));
  }
  return {url:entry.url,checkedAt:entry.checkedAt,sha256:crypto.createHash('sha256').update(JSON.stringify(entry.data)).digest('hex'),roads:roadMatches(point,entry.data)};
 }
 const centres=[];
 for(const c of evidence.centres){
  const points=[];
  for(const p of c.points){
   const candidates=[];
   if(!p.duplicateOfSequence)for(const candidate of p.candidates){
    const checked=await check(candidate);
    const names=p.junction.split(/\s+[-–]\s+/);
    const matched=names.map(name=>checked.roads.filter(road=>[road.properties.LSTRNM,road.properties.RSTRNM].some(n=>normalize(n??'')===normalize(name))&&publicDrivableRoad(road)));
    candidates.push({...candidate,government:checked,eachNamedRoadPublic:matched.every(group=>group.length>0),matchedRoadIds:matched.map(group=>group.map(r=>r.id))});
   }
   points.push({...p,candidates});
  }
  const route=routes.find(r=>r.centreSlug===c.slug&&r.slot===1);
  const departure={...route.points[0],government:await check(route.points[0])};
  centres.push({...c,points,departure});
  const report={...evidence,createdAt:new Date().toISOString(),requests,centres,automaticallyVerified:false};
  fs.writeFileSync(path.join(root,'review-evidence.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({slug:c.slug,publicJunctions:points.filter(p=>p.candidates.some(x=>x.eachNamedRoadPublic)).length,departureRoads:departure.government.roads.filter(publicDrivableRoad).map(r=>({id:r.id,distanceM:+r.distanceM.toFixed(1),names:[r.properties.LSTRNM,r.properties.RSTRNM],access:r.properties.LBLTGBEP,status:r.properties.LBLSTATUS})),requests}));
 }
}
module.exports={lineDistance,roadMatches,publicDrivableRoad};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
