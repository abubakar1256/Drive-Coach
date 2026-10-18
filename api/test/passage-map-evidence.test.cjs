const test=require('node:test'),assert=require('node:assert/strict');
const {pointCandidates}=require('../scripts/prepare-passage-map-evidence.cjs');
const point={junction:'Road A - Road B',municipality:'Test',sequence:1};
const way=(id,name,nodes,tags={})=>({id,tags:{name,highway:'residential',...tags},nodes,geometry:nodes.map((n,i)=>({lat:50+i/1000,lon:5+i/1000}))});
test('exact shared-node map candidates never automatically verify a passage',()=>{
 const r=pointCandidates(point,[way(1,'Road A',[1,2]),way(2,'Road B',[2,3])]);
 assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].osmNodeId,2);
 assert.equal(r.automaticallyVerified,false);assert.equal(r.reviewStatus,'EXACT_SHARED_NODE_CANDIDATE');
});
test('private/no motor access, merely nearby roads, plazas and missing maps remain pending',()=>{
 for(const rows of [[],[way(1,'Road A',[1,2]),way(2,'Road B',[3,4])],[way(1,'Road A',[1,2],{access:'private'}),way(2,'Road B',[2,3])],[way(1,'Road A',[1,2]),way(2,'Road B',[2,3],{motorcar:'no'})]]){
  const r=pointCandidates(point,rows);assert.equal(r.candidates.length,0);assert.equal(r.reviewStatus,'PENDING_MAP_REVIEW');assert.equal(r.automaticallyVerified,false);
 }
 assert.equal(pointCandidates({...point,junction:'Square'},[way(1,'Square',[1,2])]).candidates.length,0);
});
test('multiple shared nodes remain ambiguous instead of choosing a coordinate',()=>{
 const r=pointCandidates(point,[way(1,'Road A',[1,2]),way(2,'Road B',[1,2])]);
 assert.equal(r.candidates.length,2);assert.equal(r.reviewStatus,'PENDING_MAP_REVIEW');
});
