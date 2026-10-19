// Bounded read-only source reconciliation, not an automatic verification/import.
// Named government segments supply exact topology; every proposal still needs
// explicit content review. Unknown/ambiguous/restricted points remain unresolved.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {officialPassageCatalog}=require('../dist/src/exam-centres/official-passage-catalog');
const {officialCentres}=require('../dist/src/exam-centres/official-centres');
const {normalize}=require('./prepare-passage-map-evidence.cjs');
const {metres}=require('../dist/src/learning/practice-progress');
const {publicDrivableRoad}=require('./prepare-road-register-evidence.cjs');
const root=path.resolve(__dirname,'../../output/chatbot-audit/phase-two-reconciliation');
const endpoint='https://geo.api.vlaanderen.be/GRB/ogc/features/v1/collections/Wegsegment/items';
const aliases={
 'Expressweg':['Expresweg'], 'Daniëlstraat':['Daniëlsstraat'],
 'Dr. Peetersstraat':['Dokter Peetersstraat','Doctor Peetersstraat'],
 'Dr. De Biestraat':['Dokter De Biestraat','Doctor De Biestraat'],
 'Augustijnerlaan':['Augustijnenlaan'], 'Belcrowlaan':['Belcrownlaan'],
 'Deurnesesteenweg':['Deurnsesteenweg','Deurnesteenweg'], 'Planckenbergstraat':['Plankenbergstraat'],
 'Gemeenteplein Kontich':['Gemeenteplein'], 'Gruitroderkeizel':['Gruitroderkiezel'],
 'Oppiterkiezel':['Opitterkiezel'], 'Neringerweg':['Neringenweg'],
 'Ruelensvest':['Erasme Ruelensvest'], 'Hertogstraat (Het Brood)':['Hertogstraat'],
 // Discovery only. The current names need separate, recorded human/source
 // review; adding an alias never verifies a source point or changes its label.
 'Sint-Lambertusstraat':['Jozef Droogmansstraat'],
 'Beukenhofstraat':['Beukenhoflaan'],
 'Schuttersstraat':['Schutterstraat'],
 'Rotonde Peerderbaan':['Peerderbaan'],
};
const sourceNames=p=>p.junction.split(/\s+[-–]\s+/);
const alternatives=name=>[name,...(aliases[name]||[])];
const roadNames=f=>[f.properties.LSTRNM,f.properties.RSTRNM].filter(n=>n&&n!=='nvt');
const matches=(f,name)=>roadNames(f).some(n=>alternatives(name).some(a=>normalize(n)===normalize(a)));
const endpoints=f=>[f.geometry.coordinates[0],f.geometry.coordinates.at(-1)];
const isRoad=f=>f.geometry?.type==='LineString'&&f.geometry.coordinates.length>=2;
function directCandidates(point,features){
 const names=sourceNames(point),groups=names.map(n=>features.filter(f=>matches(f,n)&&isRoad(f))),found=[];
 if(groups.length===2)for(const a of groups[0])for(const b of groups[1])for(const x of endpoints(a))for(const y of endpoints(b)){
  if(a.id===b.id||metres(x,y)>2)continue;
  found.push({latitude:x[1],longitude:x[0],method:'GOVERNMENT_SHARED_ENDPOINT',roads:[a,b].map(f=>({id:f.id,properties:f.properties})),publicDriving:[a,b].every(publicDrivableRoad)});
 }
 if(groups.length===1)for(const f of groups[0])if(publicDrivableRoad(f)){
  const coords=f.geometry.coordinates,p=coords[Math.floor(coords.length/2)];
  found.push({latitude:p[1],longitude:p[0],method:'NAMED_PUBLIC_CARRIAGEWAY_IN_SOURCE_PLACE',roads:[{id:f.id,properties:f.properties}],publicDriving:true});
 }
 const unique=new Map(found.map(c=>[`${c.latitude.toFixed(6)},${c.longitude.toFixed(6)}`,c]));
 return {matchedRoads:groups.map(g=>g.length),candidates:[...unique.values()]};
}
async function main(){
 fs.mkdirSync(root,{recursive:true});const cache=path.join(root,'government');fs.mkdirSync(cache,{recursive:true});let requests=0;
 const cap=120,centres=[];
 for(const source of officialPassageCatalog){
  const centre=officialCentres.find(c=>c.slug===source.slug);
  const names=[...new Set(source.points.flatMap(sourceNames).flatMap(alternatives))];
  const features=new Map(),urls=[];
  for(let i=0;i<names.length;i+=24){
   // Punctuation/spacing may differ between two official datasets. Wildcards
   // discover candidates only; the response is still checked by exact normalized
   // letters/digits against an explicitly listed source name or alias below.
   const literals=names.slice(i,i+24).map(n=>{const pattern=n.replace(/'/g,"''").replace(/[.\s-]+/g,'%');return `(LSTRNM ILIKE '${pattern}' OR RSTRNM ILIKE '${pattern}')`;});
   const bbox=[centre.longitude-.20,centre.latitude-.13,centre.longitude+.20,centre.latitude+.13].join(',');
   let url=endpoint+'?'+new URLSearchParams({f:'application/json',limit:'10000',bbox,'filter-lang':'ecql-text',filter:literals.join(' OR ')});
   while(url){
    const hash=crypto.createHash('sha256').update(url).digest('hex'),file=path.join(cache,hash+'.json');let entry;
    if(fs.existsSync(file))entry=JSON.parse(fs.readFileSync(file,'utf8'));
    else{
     if(requests>=cap)throw Error('Government request cap reached');requests++;
     const response=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error(`Government response ${response.status}`);
     const data=await response.json();if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('Incomplete government page');
     entry={url,checkedAt:new Date().toISOString(),data};fs.writeFileSync(file,JSON.stringify(entry),{flag:'wx'});
     await new Promise(resolve=>setTimeout(resolve,250));
    }
    if(entry.data.features.some(f=>!roadNames(f).some(n=>names.slice(i,i+24).some(a=>normalize(n)===normalize(a)))))throw Error('Government filter was ignored or broadened');
    for(const f of entry.data.features)features.set(f.id,f);urls.push({url:entry.url,checkedAt:entry.checkedAt,sha256:crypto.createHash('sha256').update(JSON.stringify(entry.data)).digest('hex')});
    const next=entry.data.links?.find(l=>l.rel==='next')?.href;
    if(next){const n=new URL(next);if(n.origin!=='https://geo.api.vlaanderen.be'||n.pathname!==new URL(endpoint).pathname)throw Error('Unexpected pagination destination');}url=next;
   }
  }
  const roads=[...features.values()],points=source.points.map(p=>({...p,...directCandidates(p,roads)}));
  centres.push({...source,governmentPages:urls,features:roads,points});
  fs.writeFileSync(path.join(root,'registry-reconciliation.json'),JSON.stringify({createdAt:new Date().toISOString(),requests,automaticallyVerified:false,aliases,centres},null,2));
  console.log(JSON.stringify({centre:source.slug,roads:roads.length,proposals:points.filter(p=>p.candidates.some(c=>c.publicDriving)).length,unresolved:points.filter(p=>!p.duplicateOfSequence&&!p.candidates.some(c=>c.publicDriving)).map(p=>({n:p.sequence,j:p.junction,m:p.matchedRoads})),requests}));
 }
}
module.exports={directCandidates,matches,alternatives};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
