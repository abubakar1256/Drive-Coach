require('reflect-metadata');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {OfficialRouteFoundationService}=require('../dist/src/routes/official-route-foundation.service');
const {officialPassageCatalog,passageFingerprint}=require('../dist/src/exam-centres/official-passage-catalog');
const {uncoveredSelections}=require('../dist/src/routes/passage-coverage');
function fixture(){
 const source=officialPassageCatalog.find(s=>s.slug==='alken'),date=new Date('2026-10-18T00:00:00Z');
 const departure={latitude:50,longitude:5,version:1,reviewedAt:date,reviewedBy:'reviewer',verificationStatus:'VERIFIED'};
 const positions=[[5.01,50],[5.01,50.01],[5,50.01],[4.99,50.01]];
 const points=source.points.slice(0,4).map((p,i)=>{const r={...p,id:'p'+i,centreId:'c',latitude:positions[i][1],longitude:positions[i][0],sourceUrl:source.sourceUrl,sourceRevision:source.sourceRevision,verifiedAt:date,verifiedBy:'reviewer',verificationStatus:'VERIFIED'};r.sourceFingerprint=passageFingerprint(r);return r;});
 const proof={kind:'PUBLISHED_PASSAGE_PRACTICE',departure:{latitude:50,longitude:5,version:1,reviewedAt:date.toISOString()},points:points.slice(0,2).map(p=>({id:p.id,latitude:p.latitude,longitude:p.longitude,sourceFingerprint:p.sourceFingerprint,verifiedAt:date.toISOString()}))};
 const routes=[{id:'r',centreId:'c',slug:'source-loop',foundation:proof,points:[departure,...points.slice(0,2),departure]},{id:'road',centreId:'c',slug:'road-network',foundation:null,points:[]}];
 const db={examCentre:{findUnique:async()=>({id:'c',slug:'alken',name:'SYNTHETIC Alken',departure,officialPassagePoints:points}),findFirst:async()=>({id:'c'})},centreDeparture:{findUnique:async()=>departure},officialPassagePoint:{findMany:async()=>points},route:{findMany:async q=>{assert.equal(q.where.centreId,'c');assert.equal(q.where.centre.isPublished,true);return routes;}}};
 return {service:new OfficialRouteFoundationService(db,{requireValid(){throw Error('NO PROVIDER CALLS');}}),db,points,routes,departure};
}
test('coverage counts current published source proofs, never labels all reviewed points as covered',async()=>{
 const f=fixture(),r=await f.service.coverage('c');
 assert.equal(r.coveredPointCount,2);assert.equal(r.reviewedPointCount,4);assert.equal(r.uncoveredReviewedPointCount,2);
 assert.equal(r.pendingPointCount,28);assert.equal(r.sourceLinkedRouteCount,1);assert.equal(r.publishedRouteCount,2);assert.equal(r.complete,false);assert.equal(r.measuredNow,false);
 assert.doesNotMatch(JSON.stringify(r),/latitude|longitude|source-loop|Meerdegatstraat|p0|reviewer/);
});
test('changed reviewed location, departure or saved shape invalidates source coverage immediately',async()=>{
 for(const change of [f=>f.points[0].latitude+=.0001,f=>f.points[0].verifiedAt=new Date(),f=>f.departure.version++,f=>f.routes[0].points.reverse()]){
  const f=fixture();change(f);const r=await f.service.coverage('c');assert.equal(r.coveredPointCount,0);assert.equal(r.staleSourceRouteCount,1);
 }
});
test('duplicate routes do not double-count passage coverage; admin report exposes actionable gaps only',async()=>{
 const f=fixture();f.routes.push({...f.routes[0],slug:'another-loop'});
 const r=await f.service.coverage('c',true);assert.equal(r.coveredPointCount,2);assert.equal(r.sourceLinkedRouteCount,2);
 assert.deepEqual(r.points.find(p=>p.id==='p0').routes,['source-loop','another-loop']);
 assert.equal(r.points.find(p=>p.id==='p2').status,'NO_PUBLISHED_ROUTE');assert.equal(r.providerRequests,0);
 assert.ok(r.selections.length);assert.equal(r.selections[0].status,'NEEDS_DRIVING_VALIDATION');
});
test('gap selections never fabricate geometry or duration, repeat colocated junctions, or exceed provider waypoint contract',()=>{
 const points=Array.from({length:15},(_,i)=>({id:String(i),sequence:i+1,junction:'TEST',latitude:50+.01*Math.sin(i/15*2*Math.PI),longitude:5+.01*Math.cos(i/15*2*Math.PI)}));
 const plan=uncoveredSelections({latitude:50,longitude:5},points,new Set(['0','1']));
 const union=new Set(plan.flatMap(s=>s.passagePointIds));for(const p of points.slice(2))assert.ok(union.has(p.id));
 for(const s of plan){assert.ok(s.passagePointIds.length>=2&&s.passagePointIds.length<=6);assert.equal(new Set(s.passagePointIds).size,s.passagePointIds.length);assert.equal(s.durationSec,undefined);assert.equal(s.geometry,undefined);}
 assert.deepEqual(uncoveredSelections(null,points,new Set()),[]);
 const close=[{...points[0],id:'a'},{...points[0],id:'b'}];assert.deepEqual(uncoveredSelections({latitude:50,longitude:5},close,new Set()),[]);
});
test('operational database failures are not disguised as zero coverage',async()=>{
 const f=fixture();f.db.centreDeparture.findUnique=async()=>{throw Error('DATABASE_UNAVAILABLE');};
 await assert.rejects(f.service.coverage('c'),/DATABASE_UNAVAILABLE/);
});

async function withBudget(run){
 const keys=['PASSAGE_DAILY_REQUEST_BUDGET','PASSAGE_MONTHLY_REQUEST_BUDGET'],old=keys.map(k=>process.env[k]);
 process.env[keys[0]]='8';process.env[keys[1]]='16';try{await run();}finally{keys.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);}
}
function budgetFixture(){
 const f=fixture(),state={budgets:{},jobs:[],audits:[]};let calls=0;
 Object.assign(f.db,{
  user:{findUnique:async()=>({role:'ADMIN'})},$queryRawUnsafe:async()=>[],
  preparationRoutingBudget:{upsert:async({where})=>state.budgets[where.bucket]??={reserved:0},findUniqueOrThrow:async({where})=>state.budgets[where.bucket],update:async({where,data})=>state.budgets[where.bucket].reserved+=data.reserved.increment},
  preparationGeneration:{findUnique:async({where})=>state.jobs.find(j=>j.userId===where.userId_requestKey.userId&&j.requestKey===where.userId_requestKey.requestKey),create:async({data})=>{const j={...data,id:'job',state:'PENDING'};state.jobs.push(j);return j;},update:async({where,data})=>Object.assign(state.jobs.find(j=>j.id===where.id),data)},
  auditLog:{create:async({data})=>state.audits.push(data)},
  $transaction:async run=>{const before=structuredClone(state);try{return await run(f.db);}catch(e){Object.assign(state,before);throw e;}}
 });
 f.service.generateDraft=async()=>{calls++;return {id:'draft',slug:'checked-draft',status:'DRAFT'};};
 return {...f,state,calls:()=>calls,dto:{requestKey:'2e855e35-38b1-4886-a90e-66bdf0c52200',requestLimit:8,confirmed:true}};
}
test('coverage generation reserves a bounded allowance once, saves drafts only and rejects replay',async()=>withBudget(async()=>{
 const f=budgetFixture(),r=await f.service.generateCoverageDrafts('admin','c',f.dto);
 assert.equal(r.reservedRequests,1);assert.equal(f.calls(),1);assert.equal(r.published,false);assert.equal(r.complete,false);
 assert.equal(r.drafts.length,1);assert.equal(f.state.jobs[0].state,'SUCCEEDED');assert.equal(f.state.audits.length,1);
 await assert.rejects(f.service.generateCoverageDrafts('admin','c',f.dto),/already reserved/);assert.equal(f.calls(),1);
 assert.deepEqual(Object.values(f.state.budgets).map(b=>b.reserved),[1,1]);
}));
test('disabled/exhausted allowance and invalid requests perform no provider calls or partial reservations',async()=>withBudget(async()=>{
 for(const change of [{confirmed:false},{requestLimit:9},{requestKey:'not-uuid'},{role:'SUPER_ADMIN'}]){const f=budgetFixture();await assert.rejects(f.service.generateCoverageDrafts('admin','c',{...f.dto,...change}));assert.equal(f.calls(),0);}
 const f=budgetFixture();process.env.PASSAGE_DAILY_REQUEST_BUDGET='0';await assert.rejects(f.service.generateCoverageDrafts('admin','c',f.dto),/paused/);assert.equal(f.calls(),0);
 process.env.PASSAGE_DAILY_REQUEST_BUDGET='8';const month=`PASSAGE:MONTH:${new Date().toISOString().slice(0,7)}`;f.state.budgets[month]={reserved:16};
 await assert.rejects(f.service.generateCoverageDrafts('admin','c',f.dto),/exhausted/);assert.equal(f.calls(),0);assert.deepEqual(f.state.budgets,{[month]:{reserved:16}});assert.equal(f.state.jobs.length,0);
}));
test('generation rechecks current content permission and does not auto-retry rejected routes',async()=>withBudget(async()=>{
 const {BadRequestException}=require('@nestjs/common');const f=budgetFixture();
 f.db.user.findUnique=async()=>({role:'LEARNER'});await assert.rejects(f.service.generateCoverageDrafts('admin','c',f.dto),/permission/);assert.equal(f.state.jobs.length,0);
 f.db.user.findUnique=async()=>({role:'ADMIN'});let attempts=0;
 f.service.generateDraft=async()=>{attempts++;throw new BadRequestException({issues:['UNDER_23_MINUTES']});};
 const r=await f.service.generateCoverageDrafts('admin','c',f.dto);assert.equal(attempts,1);assert.equal(r.drafts.length,0);assert.deepEqual(r.failures[0].issues,['UNDER_23_MINUTES']);
}));

test('a preserved archived route is not reported as a newly saved draft',async()=>withBudget(async()=>{
 const f=budgetFixture();f.service.generateDraft=async()=>({id:'old',slug:'archived',status:'ARCHIVED',preserved:true});
 const r=await f.service.generateCoverageDrafts('admin','c',f.dto);assert.deepEqual(r.drafts,[]);assert.deepEqual(r.failures[0].issues,['EXISTING_ROUTE_REQUIRES_REVIEW']);
}));
