// Offline candidate analysis only. Government road checks are a separate step.
const fs=require('node:fs'),path=require('node:path');
const {officialPassageCatalog}=require('../dist/src/exam-centres/official-passage-catalog');
const {officialCentres}=require('../dist/src/exam-centres/official-centres');
const {metres}=require('../dist/src/learning/practice-progress');
const {pointCandidates}=require('./prepare-passage-map-evidence.cjs');
const root=path.resolve(__dirname,'../../output/chatbot-audit/phase-two-offline-map');
function main(){
 const map=JSON.parse(fs.readFileSync(path.join(root,'road-evidence.json'),'utf8'));
 if(map.automaticallyVerified!==false||!map.sourceSha256||!Array.isArray(map.elements))throw Error('Dated public-map evidence required');
 const centres=officialPassageCatalog.map(source=>{
  const anchor=officialCentres.find(c=>c.slug===source.slug);
  const roads=map.elements.filter(w=>w.geometry?.some(p=>metres([anchor.longitude,anchor.latitude],[p.lon,p.lat])<30000));
  const points=source.points.map(point=>pointCandidates(point,roads));
  return {...source,points};
 });
 const result={createdAt:new Date().toISOString(),sourceUrl:map.sourceUrl,sourceSha256:map.sourceSha256,attribution:map.attribution,licenseUrl:map.licenseUrl,automaticallyVerified:false,centres};
 fs.writeFileSync(path.join(root,'passage-evidence.json'),JSON.stringify(result,null,2));
 for(const c of centres)console.log(JSON.stringify({slug:c.slug,rows:c.points.length,unique:c.points.filter(p=>p.candidates.length===1&&!p.duplicateOfSequence).length,pending:c.points.filter(p=>p.candidates.length!==1&&!p.duplicateOfSequence).map(p=>({sequence:p.sequence,junction:p.junction,matches:p.matchedRoadCounts,candidates:p.candidates.length})),duplicates:c.points.filter(p=>p.duplicateOfSequence).map(p=>p.sequence)}));
}
if(require.main===module)main();
