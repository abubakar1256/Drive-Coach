// Deterministic review worksheet. It never approves/imports source locations.
const fs=require('node:fs'),path=require('node:path');
const {normalize}=require('./propose-remaining-passage-locations.cjs');
const {publicDrivableRoad}=require('./prepare-road-register-evidence.cjs');
const {metres}=require('../dist/src/learning/practice-progress');
const root=path.resolve(__dirname,'../../output/chatbot-audit/phase-two-remaining');
function labelCovered(label,names){
 let rest=normalize(label.replace(/^\s*(Kruispunt|Carrefour)\s*:?\s*/i,''));
 if(!names.length||new Set(names).size!==names.length||names.some(name=>!name||!rest.includes(name)))return false;
 for(const name of [...names].sort((a,b)=>b.length-a.length))rest=rest.replace(name,'');
 return rest.length===0;
}
function sharedGovernmentNode(p,data){
 const groups=p.matchedNames.map(name=>data.features.filter(f=>f.geometry?.type==='LineString'&&publicDrivableRoad(f)&&[f.properties.LSTRNM,f.properties.RSTRNM].some(n=>normalize(n??'')===name)));
 if(groups.length<2||groups.some(g=>!g.length)||!labelCovered(p.junction,p.matchedNames))return null;
 const ends=f=>[f.geometry.coordinates[0],f.geometry.coordinates.at(-1)],source=p.candidates[0];
 const possible=[];
 for(const first of groups[0])for(const coordinate of ends(first)){
  if(metres(coordinate,[source.longitude,source.latitude])>15)continue;
  const selected=[first];let okay=true;
  for(const group of groups.slice(1)){const f=group.find(f=>!selected.some(s=>s.id===f.id)&&ends(f).some(end=>metres(end,coordinate)<=2));if(!f){okay=false;break;}selected.push(f);}
  if(okay)possible.push({latitude:coordinate[1],longitude:coordinate[0],method:'GOVERNMENT_SHARED_ENDPOINT',roads:selected.map(f=>({id:f.id,properties:f.properties})),osmNodeId:source.nodeId,osmUrls:source.proofs.map(w=>w.url),governmentUrl:p.government.url});
 }
 const distinct=[];for(const c of possible)if(!distinct.some(k=>metres([k.longitude,k.latitude],[c.longitude,c.latitude])<3))distinct.push(c);
 return distinct.length===1?distinct[0]:null;
}
function main(){
 const evidence=JSON.parse(fs.readFileSync(path.join(root,'flemish-road-evidence.json'),'utf8')),centres=[];
 for(const centre of evidence.centres){
  const rows=[];
  for(const p of centre.points){
   if(!p.eachNamedRoadPublic||p.candidates[0]?.method!=='SHARED_GROUND_ROAD_NODE_PROPOSAL')continue;
   const key=require('node:crypto').createHash('sha256').update(p.government.url).digest('hex'),entry=JSON.parse(fs.readFileSync(path.join(root,'government',key+'.json'),'utf8')),candidate=sharedGovernmentNode(p,entry.data);
   if(candidate)rows.push({...p,reviewProposal:candidate,reviewed:false});
  }
  centres.push({slug:centre.slug,sourceUrl:centre.sourceUrl,points:rows});
  for(const p of rows)console.log([centre.slug,p.sequence,p.junction,p.reviewProposal.roads.map(r=>[r.id,r.properties.LSTRNM,r.properties.RSTRNM,r.properties.LGEMEENTE,r.properties.RGEMEENTE].join(':')).join(' | ')].join(' :: '));
 }
 fs.writeFileSync(path.join(root,'strict-junction-worksheet.json'),JSON.stringify({createdAt:new Date().toISOString(),automaticallyVerified:false,centres},null,2));
 console.log(JSON.stringify({proposedExactJunctions:centres.reduce((n,c)=>n+c.points.length,0),databaseChanged:false}));
}
module.exports={labelCovered,sharedGovernmentNode};if(require.main===module)main();
