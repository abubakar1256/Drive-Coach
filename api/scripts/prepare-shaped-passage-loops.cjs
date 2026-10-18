// Preparation only: insert exactly sourced junctions into existing road-loop shapes,
// then recheck every coordinate, direction, road, passage order and exact duration.
// Nothing in this script changes database review/publication states.
require('reflect-metadata');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DrivingRouteService}=require('../dist/src/routes/driving-route.service');
const {PracticeLoopService}=require('../dist/src/routes/practice-loop.service');
const {orderedCoverageIssues,passageShapeIssues}=require('../dist/src/routes/foundation-quality');
const {durationIssues}=require('../dist/src/routes/route-quality');
const {metres}=require('../dist/src/learning/practice-progress');
const {roadMatches,publicDrivableRoad}=require('./prepare-road-register-evidence.cjs');
const root=path.resolve(__dirname,'../../output/chatbot-audit/phase-two-offline-map');
const xy=p=>[p.longitude,p.latitude];
function project(point,line){
 let best={distance:Infinity,along:0,bearing:0},along=0;
 const scale=Math.cos(point.latitude*Math.PI/180),q=xy(point);
 for(let i=1;i<line.length;i++){
  const a=line[i-1],b=line[i],dx=(b[0]-a[0])*scale,dy=b[1]-a[1],length=metres(a,b);
  const t=dx*dx+dy*dy?Math.max(0,Math.min(1,((q[0]-a[0])*scale*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy))):0;
  const distance=metres(q,[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
  if(distance<best.distance)best={distance,along:along+t*length,bearing:(Math.atan2(dx,dy)*180/Math.PI+360)%360};
  along+=length;
 }return best;
}
function candidates(centre,base,line){
 const departure=centre.departure,anchors=base.points.map(p=>({...p,position:project(p,line).along}));
 // The repeated finish has the same nearest projection as the start.
 anchors[anchors.length-1].position=line.slice(1).reduce((n,p,i)=>n+metres(line[i],p),0);
 const choices=centre.points.filter(p=>!p.duplicateOfSequence).flatMap(p=>p.candidates.filter(c=>c.eachNamedRoadPublic).map(c=>({...c,sequence:p.sequence,junction:p.junction,projection:project(c,line)})))
  .filter(c=>c.projection.distance<650&&metres(xy(c),xy(departure))>=80);
 const out=[];
 for(let a=0;a<choices.length;a++)for(let b=a+1;b<choices.length;b++){
  const passages=[choices[a],choices[b]].sort((a,b)=>a.projection.along-b.projection.along);
  if(passages[0].sequence===passages[1].sequence||metres(xy(passages[0]),xy(passages[1]))<80)continue;
  // Two nearby source junctions can occupy the same original control interval.
  // Remove two nearest distinct controls and merge by along-route position;
  // never reject their legitimate order merely because one old control was nearest.
  const removed=new Set();
  for(const p of passages){const pick=anchors.map((a,i)=>({i,d:Math.abs(a.position-p.projection.along)})).slice(1,-1).filter(a=>!removed.has(a.i)).sort((a,b)=>a.d-b.d)[0];removed.add(pick.i);}
  for(const withBearing of [true,false]){
   const merged=anchors.filter((p,i)=>!removed.has(i)).map(p=>({...p}));
   merged.push(...passages.map(p=>({latitude:p.latitude,longitude:p.longitude,position:p.projection.along,bearing:withBearing?p.projection.bearing:null})));
   merged.sort((a,b)=>a.position-b.position);
   const points=merged.map(({latitude,longitude,bearing})=>({latitude,longitude,...(bearing!=null?{bearing}:{})}));
   if(passageShapeIssues(points,departure,passages).length)continue;
   const score=passages.reduce((n,p)=>n+p.projection.distance,0);
   out.push({points,passages,score,baseSlot:base.slot});
   // Removing optional connecting controls proposes a shorter street connection;
   // source points and endpoints are never removed. A fresh road check decides
   // whether the resulting drive really remains logical and within the time band.
   for(const count of [2,4,6])for(const start of [2,6,10,14,18]){
    const shorter=points.filter((p,i)=>i<start||i>=start+count||i===points.length-1||passages.some(s=>metres(xy(p),xy(s))<=1));
    if(shorter.length===points.length||passageShapeIssues(shorter,departure,passages).length)continue;
    out.push({points:shorter,passages,score:score+count*30,baseSlot:base.slot});
   }
  }
 }
 return out.sort((a,b)=>a.score-b.score);
}
async function main(){
 const evidence=JSON.parse(fs.readFileSync(path.join(root,'review-evidence.json'),'utf8'));
 const simple=JSON.parse(fs.readFileSync(path.join(root,fs.existsSync(path.join(root,'prepared-shaped-passage-loops.json'))?'prepared-shaped-passage-loops.json':'prepared-passage-loops.json'),'utf8'));
 const cap=Number(process.argv[2]||256);if(!Number.isInteger(cap)||cap<1||cap>384)throw Error('Bounded request cap 1–384 required');
 // Compatibility with early preparation output: it omitted only the departure's
 // bearings although those headings were sent to the original provider request.
 // Restore those exact original endpoint controls, not a different road geometry.
 const driving=new DrivingRouteService(),ready=simple.routes.map(r=>r.shaped?r:{...r,shaped:true,points:r.points.map((p,i)=>({...p,...((i===0||i===r.points.length-1)&&r.departure.bearing!=null?{bearing:r.departure.bearing}:{})}))}),issues={},queues=new Map();
 let requests=0,stop=null,registryRequests=0;const original=global.fetch;
 async function reference(centre,point){
  if(metres(xy(point),xy(centre.departure))<1)return centre.departure;
  const bbox=[point.longitude-.0012,point.latitude-.0008,point.longitude+.0012,point.latitude+.0008].map(n=>n.toFixed(7)).join(',');
  const url=`https://geo.api.vlaanderen.be/GRB/ogc/features/v1/collections/Wegsegment/items?${new URLSearchParams({f:'application/json',limit:'100',bbox})}`;
  const key=crypto.createHash('sha256').update(url).digest('hex'),file=path.join(root,'road-register',`${key}.json`);let entry;
  if(fs.existsSync(file))entry=JSON.parse(fs.readFileSync(file,'utf8'));
  else{
   if(registryRequests>=12)throw Error('Departure registry request cap reached');registryRequests++;
   const r=await original(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Road register ${r.status}`);
   const data=await r.json();if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||data.links?.some(l=>l.rel==='next'))throw Error('Incomplete departure evidence');
   entry={url,checkedAt:new Date().toISOString(),data};fs.writeFileSync(file,JSON.stringify(entry),{flag:'wx'});
  }
  const government={url,checkedAt:entry.checkedAt,sha256:crypto.createHash('sha256').update(JSON.stringify(entry.data)).digest('hex'),roads:roadMatches(point,entry.data)};
  if(!government.roads.some(r=>r.distanceM<=20&&publicDrivableRoad(r)))return null;
  return {...point,government};
 }
 global.fetch=async(url,opts)=>{if(!String(url).startsWith('https://api.mapbox.com/directions/'))throw Error('Unexpected provider');if(stop||requests>=cap)throw Error('Budget reached');requests++;const r=await original(url,opts);if([401,402,403,429].includes(r.status))stop=`PROVIDER_${r.status}`;return r;};
 const save=()=>fs.writeFileSync(path.join(root,'prepared-shaped-passage-loops.json'),JSON.stringify({createdAt:new Date().toISOString(),status:'PREPARED_NEEDS_CONTENT_REVIEW',instructorApproved:false,requests,cap,stop,issues,routes:ready,pending:evidence.centres.filter(c=>!ready.some(r=>r.centreSlug===c.slug)).map(c=>c.slug)},null,2));
 try{
  for(const centre of evidence.centres){
   if(ready.some(r=>r.centreSlug===centre.slug))continue;
   const combined=[];
   for(const base of require('../prisma/data/road-practice-phase-two-prepared.json').routes.filter(r=>r.centreSlug===centre.slug)){
    if(stop||requests>=cap)break;
    const departure=await reference(centre,base.points[0]);if(!departure)continue;
    const checked=await driving.evaluate(base.points);if(!checked.valid)continue;
    combined.push(...candidates({...centre,departure},base,checked.coordinates).map(c=>({...c,departure})));
   }
   const seen=new Set();queues.set(centre.slug,combined.sort((a,b)=>a.score-b.score).filter(c=>{const k=JSON.stringify(c.points);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,64));
  }
  for(let round=0;round<64&&requests<cap&&!stop;round++)for(const centre of evidence.centres){
   if(requests>=cap||stop||ready.some(r=>r.centreSlug===centre.slug))continue;
   const c=queues.get(centre.slug)?.[round];if(!c)continue;
   const checked=await driving.evaluate(c.points);
   const problems=[...checked.issues,...durationIssues(checked.durationSec),...orderedCoverageIssues(checked.coordinates,c.points)];
   for(const issue of new Set(problems))issues[issue]=(issues[issue]||0)+1;
   if(!checked.valid||problems.length)continue;
   ready.push({centreSlug:centre.slug,departure:c.departure,passages:c.passages,points:c.points,shaped:true,baseSlot:c.baseSlot,checkedAt:new Date().toISOString(),durationSec:checked.durationSec,distanceM:checked.distanceM,geometry:checked.coordinates});
   save();console.log(JSON.stringify({ready:centre.slug,minutes:+(checked.durationSec/60).toFixed(2),passages:c.passages.map(p=>p.sequence),requests}));
  }
  if(process.env.PASSAGE_EXTENDED_SEARCH==='true')for(const centre of evidence.centres.filter(c=>!ready.some(r=>r.centreSlug===c.slug))){
   const starts=centre.points.flatMap(p=>p.candidates.filter(c=>c.eachNamedRoadPublic)).filter((p,i)=>i%3===0).slice(0,6);
   const loops=new PracticeLoopService(driving);
   extended: for(const start of starts)for(let variant=0;variant<4;variant++){
    if(stop||requests>=cap)break extended;
    let base;try{base=await loops.generate(start.latitude,start.longitude,variant);}catch{continue;}
    const departure=await reference(centre,base.snappedPoints[0]);if(!departure)continue;
    const options=candidates({...centre,departure},{points:base.snappedPoints,slot:null},base.coordinates).slice(0,20);
    for(const c of options){
     if(stop||requests>=cap)break extended;
     const checked=await driving.evaluate(c.points);
     const problems=[...checked.issues,...durationIssues(checked.durationSec),...orderedCoverageIssues(checked.coordinates,c.points)];
     for(const issue of new Set(problems))issues[issue]=(issues[issue]||0)+1;
     if(!checked.valid||problems.length)continue;
     ready.push({centreSlug:centre.slug,departure,passages:c.passages,points:c.points,shaped:true,baseSlot:null,checkedAt:new Date().toISOString(),durationSec:checked.durationSec,distanceM:checked.distanceM,geometry:checked.coordinates});
     save();console.log(JSON.stringify({ready:centre.slug,minutes:+(checked.durationSec/60).toFixed(2),passages:c.passages.map(p=>p.sequence),requests}));break extended;
    }
   }
  }
 }finally{global.fetch=original;save();console.log(JSON.stringify({ready:ready.length,pending:evidence.centres.filter(c=>!ready.some(r=>r.centreSlug===c.slug)).map(c=>c.slug),requests,stop,issues}));}
}
module.exports={project,candidates};
if(require.main===module)main().catch(e=>{console.error(`Preparation stopped: ${e.message}`);process.exitCode=1;});
