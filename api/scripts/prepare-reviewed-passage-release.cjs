// Explicit, task-only remote map/register content review. No database connection.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {officialPassageCatalog}=require('../dist/src/exam-centres/official-passage-catalog');
const {publicDrivableRoad}=require('./prepare-road-register-evidence.cjs');
const {normalize}=require('./prepare-passage-map-evidence.cjs');
const {passageShapeIssues,orderedCoverageIssues}=require('../dist/src/routes/foundation-quality');
const {geometryIssues,durationIssues}=require('../dist/src/routes/route-quality');
const dir=path.resolve(__dirname,'../../output/chatbot-audit/phase-two-offline-map');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function validatePrepared(bundle){
 if(bundle.routes?.length!==6||new Set(bundle.routes.map(r=>r.centreSlug)).size!==6||bundle.pending?.length)throw Error('Six distinct ready source centres required');
 for(const r of bundle.routes){
  const source=officialPassageCatalog.find(s=>s.slug===r.centreSlug);if(!source)throw Error('Unknown source centre');
  if(geometryIssues(r.geometry).length||durationIssues(r.durationSec).length||orderedCoverageIssues(r.geometry,r.points).length||passageShapeIssues(r.points,r.departure,r.passages).length)throw Error('Prepared geometry/time/order failed');
  if(!r.departure.government.roads.some(p=>p.distanceM<=20&&publicDrivableRoad(p)))throw Error('Departure public-road reference not supported');
  if(r.passages.length<2||r.passages.length>6||new Set(r.passages.map(p=>p.sequence)).size!==r.passages.length)throw Error('Distinct 2–6 source rows required');
  for(const p of r.passages){
   const original=source.points.find(q=>q.sequence===p.sequence);
   if(!original||original.junction!==p.junction||original.duplicateOfSequence!==null)throw Error('Source row mismatch');
   for(const name of p.junction.split(/\s+[-–]\s+/))if(!p.government.roads.some(road=>road.distanceM<=40&&publicDrivableRoad(road)&&[road.properties.LSTRNM,road.properties.RSTRNM].some(n=>normalize(n??'')===normalize(name))))throw Error('Source road/access evidence missing');
   if(!Number.isInteger(p.osmNodeId)||!p.ways?.every(w=>w.url===`https://www.openstreetmap.org/way/${w.id}`))throw Error('Map provenance missing');
  }
 }
}
function main(){
 if(process.argv[2]!=='--confirm-remote-review')throw Error('Explicit remote review confirmation required; never automatic or on-site approval');
 const input=fs.readFileSync(path.join(dir,'prepared-shaped-passage-loops.json'));
 const bundle=JSON.parse(input);validatePrepared(bundle);
 const release={...bundle,status:'REMOTE_MAP_REGISTER_CONTENT_REVIEWED',reviewedAt:new Date().toISOString(),reviewBasis:'Public operator names + exact shared OSM junction + public/in-use Flemish road register + fresh driving geometry. Not field/instructor approval or parking permission.',preparedSha256:sha(input),attribution:'© OpenStreetMap contributors (ODbL 1.0); Wegenregister / Digitaal Vlaanderen',officialExamItinerary:false,instructorApproved:false};
 const file=path.join(dir,'reviewed-passage-release.json');fs.writeFileSync(file,JSON.stringify(release,null,2));
 console.log(JSON.stringify({file,sha256:sha(fs.readFileSync(file)),centres:release.routes.map(r=>r.centreSlug),reviewedPoints:release.routes.reduce((n,r)=>n+r.passages.length,0),databaseChanged:false}));
}
module.exports={validatePrepared,sha};
if(require.main===module)main();
