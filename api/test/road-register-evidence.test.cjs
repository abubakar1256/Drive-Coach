const {test}=require('node:test');const assert=require('node:assert/strict');
const {publicDrivableRoad,roadMatches,lineDistance}=require('../scripts/prepare-road-register-evidence.cjs');
const {project}=require('../scripts/prepare-shaped-passage-loops.cjs');
const road=(change={})=>({properties:{TGBEP:1,STATUS:4,LBLMORF:'weg bestaande uit één rijbaan',...change}});
test('government evidence requires explicit public, in-use, recognized driving morphology',()=>{
 assert.equal(publicDrivableRoad(road()),true);
 for(const TGBEP of [null,2,3,4,5,6,'1'])assert.equal(publicDrivableRoad(road({TGBEP})),false);
 for(const STATUS of [null,1,2,3,5,'4'])assert.equal(publicDrivableRoad(road({STATUS})),false);
 for(const LBLMORF of [null,'unknown','tramweg, niet toegankelijk voor andere voertuigen','wandel- of fietsweg, niet toegankelijk voor andere voertuigen','in- of uitrit van een parking'])assert.equal(publicDrivableRoad(road({LBLMORF})),false);
 for(const bad of [null,{}, {properties:null}])assert.equal(publicDrivableRoad(bad),false);
});
test('road evidence keeps exact normalized street names and excludes remote geometries',()=>{
 const point={latitude:50,longitude:5};
 const item=(id,name,line)=>({id,properties:{LSTRNM:name},geometry:{type:'LineString',coordinates:line}});
 const data={features:[item('near','Één-straat',[[5,49.99],[5,50.01]]),item('far','Een straat',[[6,50],[6,50.01]]),item('other','Different street',[[5,49.99],[5,50.01]])]};
 assert.deepEqual(roadMatches(point,data,'Een straat').map(r=>r.id),['near']);
 assert.equal(lineDistance(point,[[5,49.99],[5,50.01]]),0);
});
test('shape projection provides ordered distance and forward bearing without changing coordinates',()=>{
 const line=[[5,50],[5.01,50],[5.01,50.01]];
 const a=project({latitude:50,longitude:5.005},line),b=project({latitude:50.005,longitude:5.01},line);
 assert.ok(a.distance<.01&&b.distance<.01);assert.ok(b.along>a.along);assert.ok(Math.abs(a.bearing-90)<.01);assert.ok(b.bearing<.01);
});
