// Serialize an explicit remote review only after reading every proposal and the
// exceptional source decisions. This is never a seeder or geocoding approval.
const fs=require('node:fs'),path=require('node:path');
const {officialPassageCatalog,passageFingerprint}=require('../dist/src/exam-centres/official-passage-catalog');
const {belgianCoordinate}=require('../dist/src/routes/foundation-quality');
const {publicDrivableRoad}=require('./prepare-road-register-evidence.cjs');
const {sha}=require('./prepare-reviewed-passage-release.cjs');
const root=path.resolve(__dirname,'../../output/chatbot-audit/phase-two-reconciliation');
const statuses=['SUPPORTED_REVIEW_PROPOSAL','EXPLICIT_QUALIFIED_REFERENCE_PROPOSAL'];
const methods=['GOVERNMENT_SHARED_ENDPOINT','GOVERNMENT_CONNECTED_PUBLIC_SEGMENTS','NAMED_PUBLIC_CARRIAGEWAY_IN_SOURCE_PLACE','EXPLICIT_REMOTE_REFERENCE_REVIEW','OSM_SHARED_NODE_AND_PUBLIC_REGISTER'];
function validateCompleteReview(bundle){
 if(bundle.status!=='EXPLICIT_REMOTE_SOURCE_LOCATION_REVIEW'||bundle.instructorApproved!==false||bundle.officialExamItinerary!==false||!Number.isFinite(Date.parse(bundle.reviewedAt))||Date.parse(bundle.reviewedAt)>Date.now()+60000||Date.now()-Date.parse(bundle.reviewedAt)>86400000)throw Error('Recent explicit remote review required');
 if(bundle.centres?.length!==officialPassageCatalog.length||new Set(bundle.centres.map(c=>c.slug)).size!==officialPassageCatalog.length||!/^[a-f0-9]{64}$/.test(bundle.evidenceSha256||''))throw Error('Exact six-centre evidence manifest required');
 let preserved=0,reviewed=0,duplicates=0;
 for(const source of officialPassageCatalog){
  const centre=bundle.centres.find(c=>c.slug===source.slug);
  if(!centre||centre.points?.length!==source.points.length||new Set(centre.points.map(p=>p.sequence)).size!==source.points.length)throw Error('Complete source order required');
  for(const original of source.points){
   const p=centre.points.find(p=>p.sequence===original.sequence);
   const expected=passageFingerprint({...original,sourceUrl:source.sourceUrl,sourceRevision:source.sourceRevision});
   if(!p||p.sourceFingerprint!==expected||p.junction!==original.junction||p.municipality!==original.municipality)throw Error('Current operator fingerprint required');
   if(original.duplicateOfSequence!==null){
    if(p.disposition!=='SOURCE_DUPLICATE'||p.duplicateOfSequence!==original.duplicateOfSequence||p.latitude!=null||p.longitude!=null)throw Error('Source duplicates must stay unverified/excluded');
    duplicates++;continue;
   }
   if(!belgianCoordinate(p))throw Error('Reviewed Belgian road reference required');
   if(p.disposition==='PRESERVE_PUBLISHED_REVIEW'){preserved++;continue;}
   if(p.disposition!=='REVIEW_LOCATION'||typeof p.notes!=='string'||p.notes.length<100||!methods.includes(p.method)||!p.roads?.length||!p.roads.every(publicDrivableRoad)||!p.evidence?.length||p.evidence.some(e=>!/^https:\/\/geo\.api\.vlaanderen\.be\//.test(e.url||'')||!/^[a-f0-9]{64}$/.test(e.sha256||'')))throw Error('Explicit public-road evidence and qualifications required');
   reviewed++;
  }
 }
 if(preserved!==13||reviewed!==140||duplicates!==3)throw Error('Expected 13 preserved + 140 reviewed + 3 excluded source rows');
 return {preserved,reviewed,duplicates,total:preserved+reviewed+duplicates};
}
function prepare(report){
 if(report.automaticallyVerified!==false)throw Error('Read-only reconciliation evidence required');
 const reviewedAt=new Date().toISOString(),evidenceSha256=sha(JSON.stringify(report));
 const centres=report.centres.map(c=>({slug:c.slug,points:c.points.map(p=>{
  const base={sequence:p.sequence,junction:p.junction,municipality:p.municipality,sourceFingerprint:passageFingerprint({...p,sourceUrl:c.sourceUrl,sourceRevision:c.sourceRevision})};
  if(p.disposition==='SOURCE_DUPLICATE')return {...base,disposition:p.disposition,duplicateOfSequence:p.duplicateOfSequence};
  const chosen=p.proposals?.[0];
  if(!chosen)throw Error(`Missing reviewed reference ${c.slug}:${p.sequence}`);
  const location={latitude:chosen.latitude,longitude:chosen.longitude};
  if(p.disposition==='PRESERVE_PUBLISHED_REVIEW')return {...base,...location,disposition:p.disposition};
  if(!statuses.includes(p.disposition))throw Error(`Unresolved/ambiguous point ${c.slug}:${p.sequence}`);
  const method=chosen.method||'OSM_SHARED_NODE_AND_PUBLIC_REGISTER';
  const roads=(chosen.roads||chosen.government.roads).filter(publicDrivableRoad);
  const government=chosen.governmentEvidence||chosen.government;
  const localConnector=method==='GOVERNMENT_CONNECTED_PUBLIC_SEGMENTS';
  let evidence=government?[{url:government.url,checkedAt:government.checkedAt,sha256:government.sha256}]:c.governmentPages;
  // Connector geometry comes from an additional small-window dataset, not the
  // centre-wide named-road pages. Attach that exact response hash as well.
  if(localConnector){
   const input=JSON.parse(fs.readFileSync(path.join(root,'connector-evidence.json'),'utf8')).results.find(r=>r.slug===c.slug&&r.sequence===p.sequence);
   evidence=[{url:input.url,checkedAt:input.checkedAt,sha256:input.sha256}];
  }
  const names=[...new Set(roads.flatMap(r=>[r.properties.LSTRNM,r.properties.RSTRNM]).filter(n=>n&&n!=='nvt'))];
  const towns=[...new Set(roads.flatMap(r=>[r.properties.LGEMEENTE,r.properties.RGEMEENTE]).filter(n=>n&&n!=='ng'))];
  const qualification=p.reviewDecision?.note||'';
  const connectedNote=localConnector?`Public connecting-road approach (${Math.round(chosen.connectorMetres)} m), not a claim that the two printed streets share one flat intersection. Connectors: ${names.join(' / ')}. `:'';
  const note=`Remote map/register review ${reviewedAt.slice(0,10)}. ${method}; public/in-use carriageways TGBEP=1, STATUS=4. Mapped names: ${names.join(' / ')}; register municipality: ${towns.join(' / ')}. ${connectedNote}${qualification} Source label/municipality retained verbatim. Review evidence ${evidenceSha256}. Not an on-site/instructor assessment, parking permission or prescribed exam itinerary; obey current signs. © OpenStreetMap contributors / ODbL; Wegenregister / Digitaal Vlaanderen.`;
  return {...base,...location,disposition:'REVIEW_LOCATION',method,notes:note,roads,evidence,qualifications:qualification,additionalSources:p.reviewDecision?.sources||[],osmWays:p.reviewDecision?.osmWays||chosen.ways?.map(w=>w.id)||[]};
 })}));
 const bundle={status:'EXPLICIT_REMOTE_SOURCE_LOCATION_REVIEW',reviewedAt,evidenceSha256,instructorApproved:false,officialExamItinerary:false,scope:'Six published operator bundles; qualified public-road location references only. No new routes, road legality guarantees, field approval or official lists for other centres.',centres};
 validateCompleteReview(bundle);return bundle;
}
if(require.main===module){
 if(process.argv[2]!=='--confirm-remote-review')throw Error('Explicit content-review confirmation required');
 const bundle=prepare(JSON.parse(fs.readFileSync(path.join(root,'combined-proposals.json'),'utf8')));
 const file=path.join(root,'complete-reviewed-locations.json');fs.writeFileSync(file,JSON.stringify(bundle,null,2));
 console.log(JSON.stringify({file,sha256:sha(fs.readFileSync(file)),...validateCompleteReview(bundle),databaseChanged:false}));
}
module.exports={prepare,validateCompleteReview};
