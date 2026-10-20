// Offline proposals only. A unique map name is not a verified location/access review.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {metres}=require('../dist/src/learning/practice-progress');
const {officialCentres}=require('../dist/src/exam-centres/official-centres');
const root=path.resolve(__dirname,'../../output/chatbot-audit/phase-two-remaining');
function normalize(v){return v.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/str\.(?=\W|$)/g,'straat ').replace(/stwg\.?/g,'steenweg ').replace(/[^a-z0-9]/g,'');}
function allowed(w){return !['access','vehicle','motor_vehicle','motorcar'].some(k=>['no','private','destination','customers','delivery'].includes(w.tags[k]))&&!((w.tags.bridge&&w.tags.bridge!=='no')||(w.tags.tunnel&&w.tags.tunnel!=='no')||(w.tags.layer&&w.tags.layer!=='0'));}
function components(ways){const byNode=new Map(),visited=new Set(),result=[];for(const w of ways)for(const n of w.nodes){if(!byNode.has(n.id))byNode.set(n.id,[]);byNode.get(n.id).push(w);}for(const w of ways){if(visited.has(w.id))continue;const group=[],queue=[w];visited.add(w.id);while(queue.length){const current=queue.pop();group.push(current);for(const n of current.nodes)for(const next of byNode.get(n.id)||[])if(!visited.has(next.id)){visited.add(next.id);queue.push(next);}}result.push(group);}return result;}
function propose(source,ways){
 const anchor=officialCentres.find(c=>c.slug===source.slug);if(!anchor)throw Error('Known source centre required');
 const nearby=ways.filter(w=>allowed(w)&&w.nodes.some(n=>metres([anchor.longitude,anchor.latitude],[n.longitude,n.latitude])<30000)),byName=new Map();
 for(const w of nearby)for(const name of w.names){const key=normalize(name);if(key.length<4)continue;if(!byName.has(key))byName.set(key,[]);byName.get(key).push(w);}
 return source.points.map(p=>{
  if(p.duplicateOfSequence!==null)return {...p,status:'SOURCE_DUPLICATE',candidates:[]};
  const label=normalize(p.junction),matches=[...byName.keys()].filter(n=>label.includes(n)).filter(n=>![...byName.keys()].some(other=>other!==n&&other.includes(n)&&label.includes(other)));
  if(/^(?:E|N|A|R)\s*\d+$/i.test(p.junction.trim()))return {...p,status:'BROAD_NETWORK_REFERENCE',matchedNames:matches,candidates:[]};
  const groups=matches.map(n=>[...new Map(byName.get(n).map(w=>[w.id,w])).values()]),candidates=[];
  if(groups.length>=2&&groups.length<=4){
   for(const w of groups[0])for(const n of w.nodes)if(groups.slice(1).every(g=>g.some(other=>other.nodes.some(q=>q.id===n.id)))){
    const proofs=groups.flatMap(g=>g.filter(w=>w.nodes.some(q=>q.id===n.id))).map(w=>({id:w.id,url:w.url,tags:w.tags}));
    candidates.push({latitude:n.latitude,longitude:n.longitude,nodeId:n.id,method:'SHARED_GROUND_ROAD_NODE_PROPOSAL',proofs});
   }
  }else if(groups.length===1){
   for(const group of components(groups[0])){
    const nodes=group.flatMap(w=>w.nodes).sort((a,b)=>metres([anchor.longitude,anchor.latitude],[a.longitude,a.latitude])-metres([anchor.longitude,anchor.latitude],[b.longitude,b.latitude]));
    const n=nodes[0];candidates.push({latitude:n.latitude,longitude:n.longitude,nodeId:n.id,method:'NAMED_ROAD_COMPONENT_PROPOSAL',qualification:'Operator publishes a road/place reference, not this exact coordinate. This representative near-centre road node is discovery only.',proofs:group.map(w=>({id:w.id,url:w.url,tags:w.tags}))});
   }
  }
  const unique=[...new Map(candidates.map(c=>[c.nodeId,c])).values()];
  return {...p,matchedNames:matches,status:unique.length===1?'UNIQUE_MAP_PROPOSAL':unique.length?'AMBIGUOUS_MAP_PROPOSALS':'UNRESOLVED_REFERENCE',candidates:unique,automaticallyVerified:false};
 });
}
if(require.main===module){
 const file=path.join(root,'named-road-candidates.json'),bytes=fs.readFileSync(file),data=JSON.parse(bytes);if(data.automaticallyVerified!==false)throw Error('Unapproved discovery input required');
 const centres=data.sources.map(s=>({...s,points:propose(s,data.ways)})),result={createdAt:new Date().toISOString(),mapSha256:crypto.createHash('sha256').update(bytes).digest('hex'),sourceUrl:data.sourceUrl,sourceSha256:data.sourceSha256,automaticallyVerified:false,centres};
 fs.writeFileSync(path.join(root,'location-proposals.json'),JSON.stringify(result),{mode:0o600});
 for(const s of centres)console.log(JSON.stringify({slug:s.slug,points:s.points.length,statuses:s.points.reduce((r,p)=>(r[p.status]=(r[p.status]||0)+1,r),{})}));
}
module.exports={normalize,allowed,components,propose};
