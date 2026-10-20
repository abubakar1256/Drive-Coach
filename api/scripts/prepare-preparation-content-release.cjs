// Explicit review manifest only. No database connection or provider calls.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {coverageFingerprint}=require('../dist/src/learning/personalization-policy');
const {mappedWorkload}=require('../dist/src/learning/mapped-preparation-coverage');
const {geometryIssues,durationIssues}=require('../dist/src/routes/route-quality');
const {orderedCoverageIssues}=require('../dist/src/routes/foundation-quality');
const {proposals}=require('./analyse-preparation-map-evidence.cjs');
const root=path.resolve(__dirname,'../../output/chatbot-audit/preparation-content');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function prepare(input,driving,map,repair){
 if(input.routes.length!==137||driving.routes.length!==137||input.archiveSha256.length!==64||!input.fullRestorePassed||!repair.prepared||repair.approved!==false||repair.databaseChanged!==false)throw Error('Exact inspected export and repair proposal required');
 const old=input.routes.find(r=>r.id===repair.id);
 if(!old||old.version!==repair.version||old.fingerprint!==repair.fingerprint||old.slug!=='brussels-south-road-practice-loop-02'||old.points.length!==repair.prepared.points.length)throw Error('Repair preimage changed');
 if(!repair.prepared.valid||geometryIssues(repair.prepared.coordinates).length||durationIssues(repair.prepared.durationSec).length||orderedCoverageIssues(repair.prepared.coordinates,repair.prepared.points).length)throw Error('Repair geometry/order/time invalid');
 // Directions itself uses integer bearings. Store that exact same input rather
 // than an over-precise float that may change on the database JSON round-trip.
 const points=old.points.map((p,i)=>({...p,latitude:repair.prepared.points[i].latitude,longitude:repair.prepared.points[i].longitude,bearing:Number.isFinite(repair.prepared.points[i].bearing)?Math.round(repair.prepared.points[i].bearing)%360:null}));
 const after={...old,version:old.version+1,points};after.fingerprint=coverageFingerprint(after);
 const checked={...driving,routes:driving.routes.map(r=>r.id===repair.id?{...r,...repair.prepared,version:after.version,fingerprint:after.fingerprint}:r)};
 const proposed=proposals(checked,map),drivingSha256=sha(JSON.stringify(driving)),mapSha256=sha(JSON.stringify(map));
 if(proposed.some(p=>p.status!=='MAP_EVIDENCE_PROPOSAL'))throw Error('Every target requires supported map features and checked driving geometry');
 const rows=proposed.map(p=>{
  const workload=mappedWorkload(p.counts);if(!workload)throw Error('Mapped workload evidence missing');
  const proofUrls=[...p.wayProofs.filter(w=>w.kind==='roundabout').map(w=>w.url),...p.junctionProofs.map(j=>j.url)].slice(0,5);
  const notes=JSON.stringify({kind:'REMOTE_MAP_FEATURES_V1',rubric:workload.rubric,metrics:{junctionClusters:p.counts.junctionClusters,signalClusters:p.counts.signalClusters,roundaboutClusters:p.counts.roundaboutClusters,motorwayRampWays:p.counts.motorwayRampWays},mapSha256,drivingSha256,proofUrls,qualification:'Remote review of matched OSM road objects and current checked driving geometry. Workload is a mapped-interaction planning band, not instructor approval, learner ability, a legal-rule assessment or guaranteed current signs/traffic. Unsupported skills remain unknown. © OpenStreetMap contributors; ODbL.'});
  if(notes.length>2000||!p.proposedSkills.every(s=>['junctions','roundabouts'].includes(s)))throw Error('Bounded explicit feature review required');
  return {routeId:p.id,slug:p.slug,routeVersion:p.version,fingerprint:p.fingerprint,skills:p.proposedSkills,complexity:workload.band,sourceUrl:proofUrls[0],notes,counts:p.counts};
 });
 return {createdAt:new Date().toISOString(),status:'EXPLICIT_REMOTE_MAP_CONTENT_REVIEW',archiveSha256:input.archiveSha256,inputSha256:sha(JSON.stringify(input)),drivingSha256,mapSha256,sourceUrl:map.sourceUrl,sourceSha256:map.sourceSha256,officialExamItinerary:false,instructorApproved:false,rows,repair:{id:old.id,slug:old.slug,beforeVersion:old.version,beforeFingerprint:old.fingerprint,afterVersion:after.version,afterFingerprint:after.fingerprint,durationSec:repair.prepared.durationSec,points},proposals:proposed};
}
if(require.main===module){
 try{
  const mode=process.argv[2];if(!['--review-proposals','--confirm-remote-review'].includes(mode))throw Error('Choose proposal inspection or explicit remote review');
  const inputFile=path.resolve(process.argv[3]||''),drivingFile=path.resolve(process.argv[4]||'');if(![inputFile,drivingFile].every(f=>f.startsWith(root+path.sep)))throw Error('Task-local inputs required');
  const result=prepare(JSON.parse(fs.readFileSync(inputFile,'utf8')),JSON.parse(fs.readFileSync(drivingFile,'utf8')),JSON.parse(fs.readFileSync(path.join(root,'route-map-evidence.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(root,'anderlecht-route-b-repair.json'),'utf8')));
  if(mode==='--review-proposals'){for(const r of result.rows)console.log([r.slug,r.routeVersion,r.counts.junctionClusters,r.counts.signalClusters,r.counts.roundaboutClusters,r.skills.join('+'),r.complexity,r.sourceUrl].join(' | '));}
  else{const file=path.join(root,'reviewed-content-release.json');if(fs.existsSync(file))throw Error('Existing explicit release must be preserved');fs.writeFileSync(file,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({file,sha256:sha(fs.readFileSync(file)),rows:result.rows.length,repairMinutes:result.repair.durationSec/60,databaseChanged:false,instructorApproved:false}));}
 }catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={prepare,sha};
