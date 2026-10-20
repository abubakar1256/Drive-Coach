// Synthetic-only content safety tests. Never uses live accounts or provider calls.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {mappedWorkload,mappedCoverageDetails}=require('../dist/src/learning/mapped-preparation-coverage');
const {passageSourceCatalog,currentPassageSource,sourceCurrent}=require('../dist/src/exam-centres/passage-source-catalog');
const {indexGeometry,near,overlaps,vertical,verticalIndex,followsArms,clusterCount,proposals}=require('../scripts/analyse-preparation-map-evidence.cjs');
const {coverageFingerprint,rankPreparation}=require('../dist/src/learning/personalization-policy');
const {preparationFocus}=require('../dist/src/learning/preparation-policy');
const {validateRelease,sameCoverage}=require('../scripts/apply-preparation-content.cjs');
const metrics=(j=40,s=2,r=1,m=0)=>({junctionClusters:j,signalClusters:s,roundaboutClusters:r,motorwayRampWays:m});
const notes=m=>JSON.stringify({kind:'REMOTE_MAP_FEATURES_V1',rubric:'MAPPED_INTERACTIONS_V1',metrics:m,mapSha256:'a'.repeat(64),drivingSha256:'b'.repeat(64),proofUrls:['https://www.openstreetmap.org/node/1']});
const geometry=[[5,50],[5.002,50]],index=indexGeometry(geometry);
const node=(id,longitude,latitude)=>({id,longitude,latitude});
test('workload bands are bounded transparent interaction preferences, never ability scores',()=>{
 assert.equal(mappedWorkload(metrics(55,0,0)).band,'LOW');assert.equal(mappedWorkload(metrics(56,0,0)).band,'MEDIUM');assert.equal(mappedWorkload(metrics(105,0,0)).band,'MEDIUM');assert.equal(mappedWorkload(metrics(106,0,0)).band,'HIGH');assert.equal(mappedWorkload(metrics(1,0,0,1)).band,'HIGH');
 for(const m of [metrics(0),metrics(-1),metrics(NaN),metrics(Infinity),metrics(1.5),metrics(10001),{junctionClusters:1}])assert.equal(mappedWorkload(m),null);
 assert.equal(mappedCoverageDetails(notes(metrics()),'LOW').label,'Map-based workload');assert.equal(mappedCoverageDetails(notes(metrics()),'HIGH'),null);assert.equal(mappedCoverageDetails('legacy human notes','LOW'),null);assert.equal(mappedCoverageDetails(notes(metrics()).replace('a'.repeat(64),'bad'),'LOW'),null);
});
test('spatial evidence requires aligned matched roads, not nearby perpendicular crossings',()=>{
 const aligned={nodes:[node(1,5,50),node(2,5.002,50)]},crossing={nodes:[node(3,5.001,49.999),node(4,5.001,50.001)]},parallel={nodes:[node(5,5,50.00015),node(6,5.002,50.00015)]};
 assert.ok(overlaps(index,aligned).matchedM>100);assert.equal(overlaps(index,crossing).matchedM,0);assert.equal(overlaps(index,parallel).matchedM,0);
 assert.ok(near(index,[5.001,50])<.01);
});
test('junction evidence requires two traversed arms and excludes grade-separated roads',()=>{
 const centre=node(1,5.001,50),left=node(2,5,50),right=node(3,5.002,50),up=node(4,5.001,50.001);
 assert.equal(followsArms(index,{...centre,arms:new Map([[2,left],[3,right],[4,up]])}),true);assert.equal(followsArms(index,{...centre,arms:new Map([[4,up]])}),false);
 assert.ok(vertical({tags:{bridge:'yes'}}));assert.ok(vertical({tags:{layer:'-1'}}));assert.equal(Boolean(vertical({tags:{bridge:'no',layer:'0'}})),false);
 assert.ok(near(verticalIndex([{tags:{bridge:'yes'},nodes:[left,right]}]),[5.001,50])<.01);
 const ways=[{id:1,url:'https://www.openstreetmap.org/way/1',tags:{highway:'residential'},nodes:[left,centre,right]},{id:2,url:'https://www.openstreetmap.org/way/2',tags:{highway:'residential'},nodes:[centre,up]}];
 const driving={identity:'test',routes:[{id:'r',valid:true,coordinates:geometry}]},map={inputIdentity:'test',automaticallyReviewed:false,ways,nodes:[]};
 assert.deepEqual(proposals(driving,map)[0].proposedSkills,['junctions']);ways[1].tags.bridge='yes';assert.equal(proposals(driving,map)[0].status,'NO_SUPPORTED_FEATURE');
 assert.throws(()=>proposals(driving,{...map,inputIdentity:'changed'}),/identities/);
 assert.equal(clusterCount([centre,{...centre,longitude:5.00101},right],25),2);
});
test('operator catalogue preserves historical sources and all inspected car-only groups, never coordinates',()=>{
 assert.equal(passageSourceCatalog.length,30);const newSources=passageSourceCatalog.filter(s=>s.operatorName);assert.equal(newSources.length,24);assert.equal(newSources.reduce((n,s)=>n+s.points.length,0),1070);
 const historical=require('../prisma/data/supplemental-passage-sources.json').sources,walloon=require('../prisma/data/walloon-passage-sources-2026.json').sources;
 assert.equal(historical.length,10);assert.equal(historical.reduce((n,s)=>n+s.points.length,0),584);assert.equal(walloon.length,14);assert.equal(walloon.reduce((n,s)=>n+s.points.length,0),486);
 assert.ok(walloon.every(s=>s.validUntil==='2027-06-30'&&s.sourceRevision==='2026-07-01'&&s.pointGroups.every(g=>g.length===3)));
 for(const slug of ['liege-wandre','tournai-marquain']){const s=walloon.find(s=>s.slug===slug);assert.equal(s.pointGroupKinds.filter(k=>k==='RURAL').length,8);assert.equal(s.pointGroupKinds.filter(k=>k==='URBAN').length,12);}
 for(const source of newSources){assert.match(source.sourceUrl,/^https:\/\//);assert.match(source.sourceSha256,/^[a-f0-9]{64}$/);assert.ok(source.points.every((p,i)=>p.sequence===i+1&&!('latitude'in p)&&!('longitude'in p)));assert.ok(source.points.every(p=>p.duplicateOfSequence===null||p.duplicateOfSequence<p.sequence));if(source.pointGroups.length)assert.deepEqual(source.pointGroups.flat(),source.points.map(p=>p.sequence));}
 assert.equal(currentPassageSource('not-real'),null);assert.equal(sourceCurrent({validUntil:'2027-06-30'},new Date('2027-06-30T21:59:59Z')),true);assert.equal(sourceCurrent({validUntil:'2027-06-30'},new Date('2027-06-30T22:00:00Z')),false);
 assert.equal(currentPassageSource('brugge',new Date('2027-07-01T00:00:00Z')),null);
});
test('stale reviewed geometry cannot gain a map badge or recommendation match',()=>{
 const route={id:'test',version:1,points:[{id:'p',sequence:1,latitude:50,longitude:5}]};route.preparationCoverage={routeVersion:1,fingerprint:coverageFingerprint(route),skills:['junctions'],complexity:'LOW',sourceUrl:'https://www.openstreetmap.org/node/1',reviewedAt:new Date(),reviewedBy:'test',notes:notes(metrics())};
 const focus=preparationFocus('BEGINNER',{difficultyCategories:['junctions']});assert.ok(rankPreparation([route],focus,'BEGINNER')[0].coverage.details);
 route.points[0].latitude+=.001;const stale=rankPreparation([route],focus,'BEGINNER')[0];assert.equal(stale.coverage.status,'UNKNOWN');assert.equal(stale.coverage.details,null);assert.deepEqual(stale.matched,[]);
});
test('one-time release rejects altered repair and unsupported feature claims',()=>{
 const points=Array.from({length:25},(_,i)=>({id:'p'+i,sequence:i+1,latitude:50,longitude:5+i*.0001})),repair={id:'r0',slug:'brussels-south-road-practice-loop-02',beforeVersion:3,afterVersion:4,beforeFingerprint:'c'.repeat(64),afterFingerprint:coverageFingerprint({id:'r0',version:4,points}),points,durationSec:1500};
 const rows=Array.from({length:137},(_,i)=>({routeId:'r'+i,slug:i?'s'+i:repair.slug,routeVersion:i?1:4,fingerprint:i?'d'.repeat(64):repair.afterFingerprint,skills:['junctions'],complexity:'LOW',sourceUrl:'https://www.openstreetmap.org/node/1',notes:notes(metrics())}));
 const release={status:'EXPLICIT_REMOTE_MAP_CONTENT_REVIEW',officialExamItinerary:false,instructorApproved:false,archiveSha256:'e'.repeat(64),mapSha256:'a'.repeat(64),drivingSha256:'b'.repeat(64),rows,repair};assert.equal(validateRelease(release),release);
 assert.throws(()=>validateRelease({...release,instructorApproved:true}));const changed=structuredClone(release);changed.repair.points[0].latitude+=.001;assert.throws(()=>validateRelease(changed),/Repair content changed/);
 const unsupported=structuredClone(release);unsupported.rows[1].skills=['priority'];assert.throws(()=>validateRelease(unsupported),/map coverage/);
 assert.ok(sameCoverage({...rows[0]},rows[0]));assert.equal(sameCoverage({...rows[0],notes:'different'},rows[0]),false);
});
