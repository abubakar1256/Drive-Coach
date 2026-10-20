// Synthetic fixtures only. No provider, production or real-account requests.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {labelCovered,sharedGovernmentNode}=require('../scripts/review-remaining-junction-evidence.cjs');
const {normalize,allowed,propose}=require('../scripts/propose-remaining-passage-locations.cjs');
const {decisions}=require('../scripts/prepare-additional-source-review.cjs');
const {validate,validateReceipt}=require('../scripts/apply-additional-source-review.cjs');
const road=(id,name,coordinates,extra={})=>({id,geometry:{type:'LineString',coordinates},properties:{LSTRNM:name,RSTRNM:name,TGBEP:1,STATUS:4,LBLMORF:'weg bestaande uit één rijbaan',...extra}});
const a=road('a','Teststraat',[[4,51],[4.001,51]]),b=road('b','Schoolstraat',[[4.001,51],[4.001,51.001]]);
const point={junction:'Kruispunt Teststraat – Schoolstraat',matchedNames:['teststraat','schoolstraat'],candidates:[{nodeId:1,longitude:4.001,latitude:51,proofs:[{url:'https://www.openstreetmap.org/way/1'}]}],government:{url:'https://example.test'}};
test('full operator label must be explained, not just one or two substring matches',()=>{
  assert.ok(labelCovered(point.junction,point.matchedNames));
  assert.equal(labelCovered(point.junction+' – Thirdstraat',point.matchedNames),false);
  assert.equal(labelCovered('Teststraat',point.matchedNames),false);
  assert.equal(normalize('Teirlinckstr.'),'teirlinckstraat');
});
test('shared government ground topology, independent features and a unique nearby node required',()=>{
  const data={features:[a,b]};assert.ok(sharedGovernmentNode(point,data));
  assert.equal(sharedGovernmentNode(point,{features:[a,{...b,id:'a'}]}),null);
  assert.equal(sharedGovernmentNode(point,{features:[a,road('b','Schoolstraat',[[4.0011,51],[4.0011,51.001]])]}),null);
  assert.equal(sharedGovernmentNode(point,{features:[a,road('b','Schoolstraat',b.geometry.coordinates,{TGBEP:3})]}),null);
  assert.equal(sharedGovernmentNode({...point,matchedNames:['teststraat']},data),null);
  assert.equal(sharedGovernmentNode({...point,candidates:[{...point.candidates[0],longitude:4.1}]},data),null);
  assert.equal(sharedGovernmentNode({...point,junction:point.junction+' Otherstraat'},data),null);
});
test('offline discovery excludes private/grade-separated ways and cannot approve coordinates',()=>{
  for(const tags of [{bridge:'yes'},{tunnel:'yes'},{layer:'1'},{access:'private'},{motorcar:'no'}])assert.equal(allowed({tags}),false);
  assert.ok(allowed({tags:{bridge:'no',layer:'0',highway:'residential'}}));
  const rows=propose({slug:'alken',points:[{sequence:1,junction:'N80',duplicateOfSequence:null},{sequence:2,junction:'Teststraat',duplicateOfSequence:1}]},[]);
  assert.equal(rows[0].status,'BROAD_NETWORK_REFERENCE');assert.deepEqual(rows[0].candidates,[]);assert.equal(rows[1].status,'SOURCE_DUPLICATE');
});
test('release has an explicit conservative subset; neither proposals nor receipts imply approval',()=>{
  assert.equal(Object.values(decisions).flat().length,117);
  assert.ok(!decisions.brakel.includes(6));assert.ok(!decisions['sint-niklaas'].includes(20));assert.ok(!decisions.oostende.includes(56));
  assert.throws(()=>validate({kind:'PROPOSALS',rows:[]}));
  assert.throws(()=>validateReceipt({createdAt:new Date().toISOString()},Buffer.from('test')));
});
