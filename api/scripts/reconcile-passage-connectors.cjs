// Bounded government topology evidence. Coordinates are discovery windows, not
// reviewed passage locations. No database, routing, or automatic verification.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {metres}=require('../dist/src/learning/practice-progress');
const {publicDrivableRoad}=require('./prepare-road-register-evidence.cjs');
const {matches}=require('./reconcile-passage-registry.cjs');
const root=path.resolve(__dirname,'../../output/chatbot-audit/phase-two-reconciliation');
const endpoint='https://geo.api.vlaanderen.be/GRB/ogc/features/v1/collections/Wegsegment/items';
const windows=[
 ['alken',[1],50.88909,5.30707],['alken',[30],50.9017,5.3082],
 ['antwerp-geel',[7],51.1527,4.975],['antwerp-geel',[15],51.1772,4.8507],
 ['antwerp-north',[25],51.22125,4.46903],
 ['antwerp-kontich',[7],51.1299762,4.4361896],['antwerp-kontich',[16],51.14136,4.45733],
 ['bree',[13,20],51.13997,5.5878],
 ['haasrode',[11],50.8539,4.7264],['haasrode',[18],50.8435,4.7164],
];
const ends=f=>[f.geometry.coordinates[0],f.geometry.coordinates.at(-1)];
const length=f=>f.geometry.coordinates.slice(1).reduce((n,p,i)=>n+metres(p,f.geometry.coordinates[i]),0);
function connectorPaths(features,left,right){
 const roads=features.filter(f=>f.geometry?.type==='LineString'&&publicDrivableRoad(f));
 const starts=roads.filter(f=>matches(f,left)),targets=roads.filter(f=>matches(f,right));
 const found=[];
 for(const start of starts)for(const target of targets){
  if(start.id===target.id)continue;
  for(const source of ends(start)){
   const queue=[{at:source,via:[],distance:0}];
   while(queue.length){
    const current=queue.shift();
    if(ends(target).some(p=>metres(p,current.at)<=2)){
     found.push({latitude:source[1],longitude:source[0],finish:current.at,method:current.via.length?'GOVERNMENT_CONNECTED_PUBLIC_SEGMENTS':'GOVERNMENT_SHARED_ENDPOINT',roads:[start,...current.via,target].map(f=>({id:f.id,properties:f.properties})),connectorMetres:current.distance,publicDriving:true});
     break;
    }
    if(current.via.length>=4)continue;
    for(const road of roads){
     if([start.id,target.id,...current.via.map(f=>f.id)].includes(road.id))continue;
     const e=ends(road),i=e.findIndex(p=>metres(p,current.at)<=2),distance=current.distance+length(road);
     if(i>=0&&distance<=250)queue.push({at:e[1-i],via:[...current.via,road],distance});
    }
   }
  }
 }
 return [...new Map(found.map(p=>[`${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`,p])).values()];
}
async function main(){
 const cache=path.join(root,'connectors');fs.mkdirSync(cache,{recursive:true});
 const registry=JSON.parse(fs.readFileSync(path.join(root,'registry-reconciliation.json'),'utf8'));let requests=0;const results=[];
 for(const [slug,sequences,latitude,longitude]of windows){
  const bbox=[longitude-.004,latitude-.0025,longitude+.004,latitude+.0025].map(n=>n.toFixed(7)).join(',');
  const url=endpoint+'?'+new URLSearchParams({f:'application/json',limit:'1000',bbox});
  const file=path.join(cache,crypto.createHash('sha256').update(url).digest('hex')+'.json');let entry;
  if(fs.existsSync(file))entry=JSON.parse(fs.readFileSync(file,'utf8'));
  else{
   if(++requests>20)throw Error('Government connector request cap reached');
   const response=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error(`Government response ${response.status}`);
   const data=await response.json();if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||data.links?.some(l=>l.rel==='next'))throw Error('Incomplete topology window');
   entry={url,checkedAt:new Date().toISOString(),data};fs.writeFileSync(file,JSON.stringify(entry),{flag:'wx'});
   await new Promise(r=>setTimeout(r,250));
  }
  const centre=registry.centres.find(c=>c.slug===slug);
  for(const sequence of sequences){
   const source=centre.points.find(p=>p.sequence===sequence),names=source.junction.split(/\s+[-–]\s+/);
   const candidates=connectorPaths(entry.data.features,...names);
   const result={slug,sequence,junction:source.junction,url:entry.url,checkedAt:entry.checkedAt,sha256:crypto.createHash('sha256').update(JSON.stringify(entry.data)).digest('hex'),features:entry.data.features,candidates};
   results.push(result);
   console.log(JSON.stringify({slug,sequence,candidates:candidates.length,localNames:[...new Set(entry.data.features.flatMap(f=>[f.properties.LSTRNM,f.properties.RSTRNM]).filter(n=>n&&n!=='nvt'))]}));
  }
 }
 fs.writeFileSync(path.join(root,'connector-evidence.json'),JSON.stringify({createdAt:new Date().toISOString(),requests,automaticallyVerified:false,results},null,2));
}
module.exports={connectorPaths};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
