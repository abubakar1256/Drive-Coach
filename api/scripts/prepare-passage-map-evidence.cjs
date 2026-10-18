// Read-only public-map evidence collection. Never verifies/publishes database rows.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {officialPassageCatalog}=require('../dist/src/exam-centres/official-passage-catalog');
const root=path.resolve(__dirname,'../../output/chatbot-audit/phase-two-map-evidence');
const endpoint=process.env.PASSAGE_OVERPASS_ENDPOINT||'https://overpass.private.coffee/api/interpreter';
if(!['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter'].includes(endpoint))throw Error('Unapproved public map evidence endpoint');
const normalize=s=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const streets=s=>s.split(/\s+[-–]\s+/).map(s=>s.trim());
const groups=new Map();
for(const source of officialPassageCatalog)for(const point of source.points){const names=groups.get(point.municipality)??new Set();for(const street of streets(point.junction))names.add(street);groups.set(point.municipality,names);}
function pointCandidates(point,elements){
  const roads=streets(point.junction);
  const matches=roads.map(road=>elements.filter(w=>normalize(w.tags?.name??'')===normalize(road)));
  const positions=new Map();
  if(roads.length>1&&matches.every(a=>a.length)){
   for(const w of matches[0])for(const [i,id]of w.nodes.entries()){
    if(!matches.slice(1).every(group=>group.some(other=>other.nodes.includes(id))))continue;
    const ways=matches.flatMap(group=>group.filter(x=>x.nodes.includes(id)).map(x=>({id:x.id,name:x.tags.name,highway:x.tags.highway,access:x.tags.access??null,motorVehicle:x.tags.motor_vehicle??x.tags.motorcar??x.tags.vehicle??null,url:`https://www.openstreetmap.org/way/${x.id}`})));
    positions.set(id,{osmNodeId:id,latitude:w.geometry[i].lat,longitude:w.geometry[i].lon,ways});
   }
  }
  const candidates=[...positions.values()].filter(c=>c.ways.every(w=>['primary','secondary','tertiary','residential','unclassified','living_street','primary_link','secondary_link','tertiary_link'].includes(w.highway)&&!['private','no'].includes(w.access)&&!['private','no'].includes(w.motorVehicle)));
  return {...point,matchedRoadCounts:matches.map(a=>a.length),candidates,reviewStatus:candidates.length===1?'EXACT_SHARED_NODE_CANDIDATE':'PENDING_MAP_REVIEW',automaticallyVerified:false};
}
async function collect(cacheOnly=false){
 fs.mkdirSync(root,{recursive:true});
 const datasets=new Map(),unavailable=[];let requests=0;
 for(const [municipality,names]of groups){
  const regex=[...names].map(escapeRegex).join('|');
  const query=`[out:json][timeout:35];rel[boundary=administrative][name=${JSON.stringify(municipality)}][admin_level~"^(8|9|10)$"](49.4,2.4,51.6,6.5);map_to_area->.city;way(area.city)[highway][name~${JSON.stringify(regex)},i];out geom;`;
  const hash=crypto.createHash('sha256').update(query).digest('hex');const cache=path.join(root,`${normalize(municipality)}-${hash.slice(0,10)}.json`);
  let result;
  if(fs.existsSync(cache))result=JSON.parse(fs.readFileSync(cache,'utf8'));
  else if(cacheOnly){unavailable.push(municipality);result={elements:[]};}
  else{
   if(requests>=30)throw Error('Public map request cap reached');requests++;
   try{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'DriveCoach-SourceReview/1.0 (+https://drive-coach-production.up.railway.app)'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(45000)});
    if(!response.ok){if([401,403,406,429].includes(response.status))throw Object.assign(Error('Provider access/rate limit; stop all collection'),{stop:true});throw Error(`Provider ${response.status}`);}
    const data=await response.json();if(data.remark||!Array.isArray(data.elements))throw Error('Incomplete public map response');
    result={municipality,query,endpoint,fetchedAt:new Date().toISOString(),license:'ODbL 1.0',attribution:'© OpenStreetMap contributors',...data};
    fs.writeFileSync(cache,JSON.stringify(result),{flag:'wx'});
   }catch(error){
    if(error.stop)throw error;
    unavailable.push(municipality);result={elements:[]};console.warn(JSON.stringify({municipality,status:'EVIDENCE_UNAVAILABLE',retried:false}));
   }
  }
  datasets.set(municipality,result);console.log(JSON.stringify({municipality,ways:result.elements.length,requests}));
 }
 const centres=officialPassageCatalog.map(source=>({...source,points:source.points.map(point=>pointCandidates(point,datasets.get(point.municipality).elements))}));
 const report={createdAt:new Date().toISOString(),attribution:'© OpenStreetMap contributors',licenseUrl:'https://www.openstreetmap.org/copyright',provider:endpoint,requests,unavailableMunicipalities:unavailable,centres};
 fs.writeFileSync(path.join(root,'passage-candidates.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({centres:centres.map(s=>({slug:s.slug,entries:s.points.length,unambiguousCandidates:s.points.filter(p=>p.candidates.length===1).length})),databaseChanged:false,automaticallyVerified:false}));
}
module.exports={normalize,pointCandidates};
if(require.main===module)collect(process.argv.includes('--cache-only')).catch(e=>{console.error(e.message);process.exitCode=1;});
