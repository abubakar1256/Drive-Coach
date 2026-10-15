const {test}=require('node:test');
const assert=require('node:assert/strict');
const {digest,validatePlan,sameGeometry}=require('../scripts/replace-short-routes.cjs');
function fixture(){
 return {format:1,createdAt:new Date().toISOString(),routes:Array.from({length:131},(_,i)=>{
  const before={id:`route-${i}`,reviewedBy:'ROAD_ROUTING_ENGINE',verificationStatus:'ROAD_VALIDATED',_count:{skillCoverage:0},points:[{_count:{features:0,mediaAssets:0}}]};
  return {before,beforeHash:digest(before),durationSec:1620,checkedAt:new Date().toISOString(),after:[{sequence:1,latitude:50,longitude:5,bearing:null},{sequence:2,latitude:50,longitude:5,bearing:null}]};
 })};
}
test('accepts a fresh complete replacement plan',()=>assert.doesNotThrow(()=>validatePlan(fixture())));
test('database float round-trip preserves geometry without accepting shifted anchors',()=>{
 const a=[{latitude:50.890989,longitude:5.306214,bearing:351.14204018620114}];
 assert.equal(sameGeometry(a,[{...a[0],bearing:351.1420401862011}]),true);
 assert.equal(sameGeometry(a,[{...a[0],latitude:a[0].latitude+0.000001}]),false);
 assert.equal(sameGeometry(a,[{...a[0],bearing:a[0].bearing+0.000001}]),false);
 assert.equal(sameGeometry(a,[{...a[0],bearing:null}]),false);
});
for(const [name,change] of [
 ['short driving time',p=>p.routes[0].durationSec=1439.99],
 ['long driving time',p=>p.routes[0].durationSec=1800.01],
 ['invalid time',p=>p.createdAt='invalid'],
 ['stale provider result',p=>p.routes[0].checkedAt='2020-01-01'],
 ['duplicate route identity',p=>p.routes[1]=p.routes[0]],
 ['curated point features',p=>{p.routes[0].before.points[0]._count.features=1;p.routes[0].beforeHash=digest(p.routes[0].before);}],
 ['changed source snapshot',p=>p.routes[0].before.id='tampered'],
 ['instructor content',p=>{p.routes[0].before.reviewedBy='instructor';p.routes[0].beforeHash=digest(p.routes[0].before);}],
 ['open loop',p=>p.routes[0].after[1].latitude=51],
 ['invalid anchor',p=>p.routes[0].after[0].longitude=NaN],
 ['invalid bearing',p=>p.routes[0].after[0].bearing=NaN],
])test(`rejects ${name}`,()=>{const p=fixture();change(p);assert.throws(()=>validatePlan(p));});
