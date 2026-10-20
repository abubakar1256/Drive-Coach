// Cached public government checks of proposals. No database reviews/writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {roadMatches,publicDrivableRoad}=require('./prepare-road-register-evidence.cjs');
const {normalize}=require('./propose-remaining-passage-locations.cjs');
const root=path.resolve(__dirname,'../../output/chatbot-audit/phase-two-remaining'),cache=path.join(root,'government');
const endpoint='https://geo.api.vlaanderen.be/GRB/ogc/features/v1/collections/Wegsegment/items';
async function main(){
 const input=JSON.parse(fs.readFileSync(path.join(root,'location-proposals.json'),'utf8'));if(input.automaticallyVerified!==false)throw Error('Discovery input required');
 fs.mkdirSync(cache,{recursive:true});let requests=0;const cap=280,centres=[];
 for(const centre of input.centres.filter(s=>['SBAT','KM'].includes(s.operatorName)||s.slug==='asse-mollem')){
  const points=[];
  for(const point of centre.points){
   if(point.status!=='UNIQUE_MAP_PROPOSAL'){points.push(point);continue;}
   const p=point.candidates[0],bbox=[p.longitude-.0008,p.latitude-.0006,p.longitude+.0008,p.latitude+.0006].map(n=>n.toFixed(7)).join(','),url=endpoint+'?'+new URLSearchParams({f:'application/json',limit:'100',bbox}),key=crypto.createHash('sha256').update(url).digest('hex'),file=path.join(cache,key+'.json');let entry;
   if(fs.existsSync(file))entry=JSON.parse(fs.readFileSync(file,'utf8'));
   else{
    if(requests>=cap)throw Error('Explicit government request cap reached');requests++;
    const response=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('Government response '+response.status);const data=await response.json();
    if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||data.links?.some(l=>l.rel==='next'))throw Error('Incomplete bounded government response');
    entry={url,checkedAt:new Date().toISOString(),data};fs.writeFileSync(file,JSON.stringify(entry),{flag:'wx'});
    await new Promise(r=>setTimeout(r,250));
   }
   const roads=roadMatches(p,entry.data).filter(r=>r.distanceM<=15&&publicDrivableRoad(r)),matched=point.matchedNames.map(name=>roads.filter(r=>[r.properties.LSTRNM,r.properties.RSTRNM].some(n=>normalize(n??'')===name)));
   points.push({...point,government:{url:entry.url,checkedAt:entry.checkedAt,sha256:crypto.createHash('sha256').update(JSON.stringify(entry.data)).digest('hex'),roads},eachNamedRoadPublic:matched.length>0&&matched.every(g=>g.length),automaticallyVerified:false});
   fs.writeFileSync(path.join(root,'flemish-government-progress.json'),JSON.stringify({createdAt:new Date().toISOString(),requests,currentCentre:centre.slug,processed:points.length,databaseChanged:false}));
  }
  centres.push({...centre,points});fs.writeFileSync(path.join(root,'flemish-road-evidence.json'),JSON.stringify({createdAt:new Date().toISOString(),requests,mapSha256:input.mapSha256,sourceSha256:input.sourceSha256,automaticallyVerified:false,centres}));
  console.log(JSON.stringify({centre:centre.slug,uniqueMapProposals:points.filter(p=>p.status==='UNIQUE_MAP_PROPOSAL').length,matchingPublicRoadEvidence:points.filter(p=>p.eachNamedRoadPublic).length,requests}));
 }
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
