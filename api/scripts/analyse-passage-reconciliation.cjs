// Offline synthesis of source evidence. Proposals are NOT verified DB records.
const fs=require('node:fs'),path=require('node:path');
const {metres}=require('../dist/src/learning/practice-progress');
const {publicDrivableRoad}=require('./prepare-road-register-evidence.cjs');
const {normalize}=require('./prepare-passage-map-evidence.cjs');
const {decisions}=require('./passage-review-decisions.cjs');
const root=path.resolve(__dirname,'../../output/chatbot-audit');
const xy=p=>[p.longitude,p.latitude];
// The PDF uses districts as well as municipalities. These are explicit scope
// mappings, not a nearest-city fallback. Printed source fields remain untouched.
const municipalityScopes={Deurne:['Antwerpen'],Merksem:['Antwerpen'],Heverlee:['Leuven'],Haasrode:['Leuven','Oud-Heverlee']};
function inMunicipality(road,municipality){
 const accepted=[municipality,...(municipalityScopes[municipality]||[])].map(normalize);
 return [road?.properties?.LGEMEENTE,road?.properties?.RGEMEENTE].some(n=>n&&accepted.includes(normalize(n)));
}
function candidateInMunicipality(candidate,municipality){
 const roads=candidate.roads||candidate.government?.roads||[];
 return roads.some(r=>publicDrivableRoad(r)&&inMunicipality(r,municipality));
}
function clusters(candidates,radius=160){
 const groups=[];
 for(const point of candidates){const group=groups.find(g=>g.some(p=>metres(xy(p),xy(point))<radius));if(group)group.push(point);else groups.push([point]);}
 return groups;
}
function main(){
 const registry=JSON.parse(fs.readFileSync(path.join(root,'phase-two-reconciliation/registry-reconciliation.json'),'utf8'));
 const map=JSON.parse(fs.readFileSync(path.join(root,'phase-two-offline-map/review-evidence.json'),'utf8'));
 const published=JSON.parse(fs.readFileSync(path.join(root,'phase-two-offline-map/reviewed-passage-release.json'),'utf8'));
 const connectors=JSON.parse(fs.readFileSync(path.join(root,'phase-two-reconciliation/connector-evidence.json'),'utf8')).results;
 const centres=[];
 for(const c of registry.centres){
  const osm=map.centres.find(x=>x.slug===c.slug),live=published.routes.find(r=>r.centreSlug===c.slug);
  const points=c.points.map(p=>{
   if(p.duplicateOfSequence)return {...p,disposition:'SOURCE_DUPLICATE',proposals:[]};
   const preserved=live.passages.find(x=>x.sequence===p.sequence);
   if(preserved)return {...p,disposition:'PRESERVE_PUBLISHED_REVIEW',proposals:[preserved]};
   const decision=decisions[`${c.slug}:${p.sequence}`],towns=decision?.municipalities||[p.municipality];
   const scoped=x=>towns.some(t=>candidateInMunicipality(x,t));
   const local=connectors.find(x=>x.slug===c.slug&&x.sequence===p.sequence);
   if(decision?.roadIds){
    const roads=decision.roadIds.map(id=>local?.features.find(f=>f.id===id));
    if(roads.some(r=>!publicDrivableRoad(r)))throw Error(`Missing/restricted explicitly reviewed reference ${c.slug}:${p.sequence}`);
    const {lineDistance}=require('./prepare-road-register-evidence.cjs');
    if(roads.some(r=>lineDistance(decision,r.geometry.coordinates)>2))throw Error('Explicit reference is not on both public segments');
    return {...p,reviewDecision:decision,disposition:'EXPLICIT_QUALIFIED_REFERENCE_PROPOSAL',proposals:[{...decision,method:'EXPLICIT_REMOTE_REFERENCE_REVIEW',roads:roads.map(r=>({id:r.id,properties:r.properties})),governmentEvidence:{url:local.url,checkedAt:local.checkedAt,sha256:local.sha256}}]};
   }
   const old=osm.points.find(x=>x.sequence===p.sequence)?.candidates.filter(x=>x.eachNamedRoadPublic&&scoped(x))||[];
   const direct=p.candidates.filter(x=>x.publicDriving&&scoped(x));
   const connected=(local?.candidates||[]).filter(scoped).sort((a,b)=>a.connectorMetres-b.connectorMetres);
   if(decision?.latitude){
    const found=[...direct,...old,...connected].filter(x=>metres(xy(x),xy(decision))<2);
    if(!found.length)throw Error('Explicit alternate junction was not supported');
    return {...p,reviewDecision:decision,disposition:'EXPLICIT_QUALIFIED_REFERENCE_PROPOSAL',proposals:found};
   }
   const eligible=old.length?old:direct.length?direct:connected;
   const groups=clusters(eligible);
   if(groups.length===1)return {...p,reviewDecision:decision,disposition:decision?'EXPLICIT_QUALIFIED_REFERENCE_PROPOSAL':'SUPPORTED_REVIEW_PROPOSAL',proposals:groups[0]};
   if(groups.length>1)return {...p,disposition:'AMBIGUOUS_LOCATIONS',proposals:eligible};
   const qualified=p.candidates.filter(x=>candidateInMunicipality(x,p.municipality));
   if(clusters(qualified).length===1)return {...p,disposition:'PUBLIC_THROUGH_ROAD_WITH_RESTRICTED_BRANCH_REVIEW',proposals:qualified};
   return {...p,disposition:'UNRESOLVED',proposals:[]};
  });
  centres.push({...c,points});
  console.log(JSON.stringify({centre:c.slug,counts:points.reduce((n,p)=>(n[p.disposition]=(n[p.disposition]||0)+1,n),{}),unresolved:points.filter(p=>['UNRESOLVED','AMBIGUOUS_LOCATIONS'].includes(p.disposition)).map(p=>({n:p.sequence,j:p.junction,m:p.matchedRoads,proposals:p.proposals.map(x=>[x.latitude,x.longitude])}))}));
 }
 fs.writeFileSync(path.join(root,'phase-two-reconciliation/combined-proposals.json'),JSON.stringify({createdAt:new Date().toISOString(),automaticallyVerified:false,centres},null,2));
}
module.exports={clusters,inMunicipality,candidateInMunicipality};
if(require.main===module)main();
