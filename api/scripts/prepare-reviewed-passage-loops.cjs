// Bounded preparation only. No database writes or automatic review/publication.
require('reflect-metadata');
const fs=require('node:fs'),path=require('node:path');
const {DrivingRouteService}=require('../dist/src/routes/driving-route.service');
const {geometryIssues,durationIssues}=require('../dist/src/routes/route-quality');
const {orderedCoverageIssues}=require('../dist/src/routes/foundation-quality');
const {metres}=require('../dist/src/learning/practice-progress');
const {publicDrivableRoad}=require('./prepare-road-register-evidence.cjs');
const root=path.resolve(__dirname,'../../output/chatbot-audit/phase-two-offline-map');
const xy=p=>[p.longitude,p.latitude];
function candidateSequences(centre){
 const prepared=require('../prisma/data/road-practice-phase-two-prepared.json').routes.find(r=>r.centreSlug===centre.slug&&r.slot===1);
 const departure=centre.departure;
 if(!departure.government.roads.some(r=>r.distanceM<=20&&publicDrivableRoad(r)))throw Error(`No sufficiently close public-road departure: ${centre.slug}`);
 const options=centre.points.filter(p=>!p.duplicateOfSequence).flatMap(p=>p.candidates.filter(c=>c.eachNamedRoadPublic).map(c=>({...c,sequence:p.sequence,junction:p.junction})));
 let seed=centre.slug.split('').reduce((n,c)=>n+c.charCodeAt(0),1);const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const results=new Map();
 for(let sample=0;sample<6000;sample++){
  const count=2+(sample%5),selected=[];
  for(let tries=0;selected.length<count&&tries<40;tries++){
   const p=options[Math.floor(random()*options.length)];
   if(!p||selected.some(q=>q.sequence===p.sequence||metres(xy(q),xy(p))<80)||metres(xy(departure),xy(p))<80)continue;
   selected.push(p);
  }
  if(selected.length!==count)continue;
  const all=[departure,...selected],cx=all.reduce((n,p)=>n+p.longitude,0)/all.length,cy=all.reduce((n,p)=>n+p.latitude,0)/all.length;
  all.sort((a,b)=>Math.atan2(a.latitude-cy,a.longitude-cx)-Math.atan2(b.latitude-cy,b.longitude-cx));
  const at=all.indexOf(departure),ordered=[...all.slice(at),...all.slice(0,at)];
  for(const reverse of [false,true]){
   const points=reverse?[departure,...ordered.slice(1).reverse(),departure]:[...ordered,departure];
   if(geometryIssues(points.map(xy)).length)continue;
   const length=points.slice(1).reduce((n,p,i)=>n+metres(xy(points[i]),xy(p)),0);
   const score=Math.abs(length*1.35*prepared.durationSec/prepared.distanceM-1500);
   const passages=points.slice(1,-1),key=passages.map(p=>`${p.sequence}:${p.osmNodeId}`).join(',');
   results.set(key,{passages,points,score});
  }
 }
 // Spread attempts over different selections, not adjacent rotations of one loop.
 const sorted=[...results.values()].sort((a,b)=>a.score-b.score),used=new Set();
 return sorted.filter(c=>{const key=c.passages.map(p=>p.sequence).sort((a,b)=>a-b).join(',');if(used.has(key))return false;used.add(key);return true;}).slice(0,48);
}
async function main(){
 const evidence=JSON.parse(fs.readFileSync(path.join(root,'review-evidence.json'),'utf8'));
 if(evidence.centres.length!==6)throw Error('All six source-centre evidence sets required');
 const cap=Number(process.argv[2]||256);if(!Number.isInteger(cap)||cap<1||cap>288)throw Error('Bounded request cap 1–288 required');
 const driving=new DrivingRouteService(),prepared=[],issues={},sequences=new Map(evidence.centres.map(c=>[c.slug,candidateSequences(c)]));
 const original=global.fetch;let requests=0,stop=null;
 global.fetch=async(url,opts)=>{if(!String(url).startsWith('https://api.mapbox.com/directions/'))throw Error('Unexpected provider');if(stop||requests>=cap)throw Error('Budget reached');requests++;const r=await original(url,opts);if([401,402,403,429].includes(r.status))stop=`PROVIDER_${r.status}`;return r;};
 const save=()=>fs.writeFileSync(path.join(root,'prepared-passage-loops.json'),JSON.stringify({createdAt:new Date().toISOString(),status:'PREPARED_NEEDS_CONTENT_REVIEW',instructorApproved:false,requests,cap,stop,issues,routes:prepared,pending:evidence.centres.filter(c=>!prepared.some(r=>r.centreSlug===c.slug)).map(c=>c.slug)},null,2));
 try{
  for(let round=0;round<48&&requests<cap&&!stop;round++)for(const centre of evidence.centres){
   if(requests>=cap||stop||prepared.some(r=>r.centreSlug===centre.slug))continue;
   const candidate=sequences.get(centre.slug)[round];if(!candidate)continue;
   const checked=await driving.evaluate(candidate.points);
   const problems=[...checked.issues,...durationIssues(checked.durationSec),...orderedCoverageIssues(checked.coordinates,candidate.points)];
   for(const issue of new Set(problems))issues[issue]=(issues[issue]||0)+1;
   if(!checked.valid||problems.length)continue;
   prepared.push({centreSlug:centre.slug,departure:centre.departure,passages:candidate.passages,points:candidate.points.map(({latitude,longitude,bearing})=>({latitude,longitude,...(bearing!=null?{bearing}:{})})),shaped:true,checkedAt:new Date().toISOString(),durationSec:checked.durationSec,distanceM:checked.distanceM,geometry:checked.coordinates});
   save();console.log(JSON.stringify({ready:centre.slug,minutes:+(checked.durationSec/60).toFixed(2),passageSequences:candidate.passages.map(p=>p.sequence),requests}));
  }
 }finally{global.fetch=original;save();console.log(JSON.stringify({ready:prepared.length,pending:evidence.centres.filter(c=>!prepared.some(r=>r.centreSlug===c.slug)).map(c=>c.slug),requests,stop,issues}));}
}
module.exports={candidateSequences};
if(require.main===module)main().catch(e=>{console.error(`Preparation stopped: ${e.message}`);process.exitCode=1;});
