// Synthetic-only Phase 3 tests. No live accounts, directions or model requests.
require('reflect-metadata');
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {ForbiddenException}=require('@nestjs/common');
const {plainToInstance}=require('class-transformer'),{validateSync}=require('class-validator');
const {PersonalizedPracticeService}=require('../dist/src/learning/personalized-practice.service');
const {PreparationCoverageController}=require('../dist/src/learning/preparation-coverage.controller');
const {coverageCurrent,coverageFingerprint,rankPreparation,checkedPrivateSnapshot}=require('../dist/src/learning/personalization-policy');
const {preparationFocus}=require('../dist/src/learning/preparation-policy');
const {HometownGenerationDto,HometownReflectionDto,CoverageReviewDto}=require('../dist/src/learning/dto/personalization.dto');
const {searchHometowns,hometownPlace}=require('../dist/src/learning/belgian-places');
const {snapshotDistance}=require('../dist/src/learning/practice-progress');
const {LearningService}=require('../dist/src/learning/learning.service');
const revision='c76469a2-1ce8-4e91-8ae0-3186fa2e15a2';
function publicRoute(id='route-a'){
 const r={id,version:1,name:'SYNTHETIC route',slug:id,centreId:'c',centre:{name:'TEST centre',slug:'test'},durationMin:25,points:[{id:'p',sequence:1,title:'Unreviewed roundabout keyword',category:'roundabout',latitude:50,longitude:5}]};
 r.preparationCoverage={routeVersion:1,fingerprint:coverageFingerprint(r),skills:['roundabouts'],complexity:'LOW',sourceUrl:'https://example.invalid/review',reviewedAt:new Date(),reviewedBy:'test-admin'};return r;
}
function syntheticLoop(place){
 const x=place.longitude,y=place.latitude,geometry=[[x,y],[x+.005,y],[x+.005,y+.004],[x,y+.004],[x,y]];
 return {valid:true,issues:[],durationSec:1500,distanceM:snapshotDistance(geometry),coordinates:geometry,snappedPoints:geometry.map(p=>({longitude:p[0],latitude:p[1]})),observedFeatures:['roundabouts']};
}
function fixture(){
 const state={requests:[],budgets:{},routes:[],sessions:[],audits:[]},place=hometownPlace(searchHometowns('Leuven')[0].id),driving=syntheticLoop(place);
 const profile={ownerId:'a',version:1,revision,saved:true,centreId:'c',preferredLevel:'BEGINNER',focus:preparationFocus('BEGINNER',{difficultyCategories:['roundabouts']})};
 let allowed=true,calls=0;
 const db={
  $queryRawUnsafe:async()=>[],
  preparationProfile:{findUnique:async()=>profile},
  examCentre:{findFirst:async()=>({id:'c'})},
  preparationRoutingBudget:{upsert:async({where})=>state.budgets[where.bucket]??=( {bucket:where.bucket,reserved:0}),findUniqueOrThrow:async({where})=>state.budgets[where.bucket],update:async({where,data})=>{state.budgets[where.bucket].reserved+=data.reserved.increment;}},
  preparationGeneration:{findUnique:async({where})=>state.requests.find(r=>r.userId===where.userId_requestKey.userId&&r.requestKey===where.userId_requestKey.requestKey),findFirst:async({where})=>state.requests.find(r=>r.userId===where.userId&&r.createdAt>where.createdAt.gt),create:async({data})=>{const r={...data,state:'PENDING',createdAt:new Date()};state.requests.push(r);return r;},update:async({where,data})=>{Object.assign(state.requests.find(r=>r.userId===where.userId_requestKey.userId&&r.requestKey===where.userId_requestKey.requestKey),data);},updateMany:async({where,data})=>{for(const r of state.requests)if(r.userId===where.userId&&r.requestKey===where.requestKey&&r.state===where.state)Object.assign(r,data);}},
  hometownRoute:{create:async({data})=>{const r={...data,id:crypto.randomUUID(),createdAt:new Date()};state.routes.push(r);return r;},findFirst:async({where})=>state.routes.find(r=>r.id===where.id&&r.userId===where.userId),findMany:async({where})=>state.routes.filter(r=>r.userId===where.userId),deleteMany:async({where})=>{const n=state.routes.length;state.routes=state.routes.filter(r=>!(r.id===where.id&&r.userId===where.userId));return {count:n-state.routes.length};}},
  hometownSession:{findMany:async({where})=>state.sessions.filter(s=>s.userId===where.userId&&s.routeId===where.routeId),findFirst:async({where})=>{const s=state.sessions.find(s=>s.userId===where.userId&&(!where.id||s.id===where.id)&&(!where.routeId||s.routeId===where.routeId)&&(where.completedAt===undefined||(where.completedAt===null?!s.completedAt:!!s.completedAt)));return s?{...s,route:state.routes.find(r=>r.id===s.routeId)}:null;},findFirstOrThrow:async({where})=>{const s=state.sessions.find(s=>s.id===where.id&&s.userId===where.userId);if(!s)throw Error('Not found');return s;},create:async({data})=>{const s={...data,id:crypto.randomUUID(),startedAt:new Date(),completedAt:null,completionPct:0,progressM:0,visitedPoints:0,completionKind:'TRACKING',lastSampleAt:null};state.sessions.push(s);return s;},update:async({where,data})=>{const s=state.sessions.find(s=>s.id===where.id);Object.assign(s,data);return s;}},
  auditLog:{create:async({data})=>state.audits.push(data)},
  route:{findMany:async()=>[publicRoute('a'),publicRoute('locked')]},practiceSession:{findMany:async()=>[]},
  $transaction:async fn=>{const before=structuredClone(state);try{return await fn(db);}catch(e){Object.assign(state,before);throw e;}}
 };
 const access={centreAccess:async()=>({premium:allowed}),requireAccess:async(_,id)=>{if(id==='locked')throw new ForbiddenException('Locked');return {route:publicRoute(id),premium:allowed};}};
 const service=new PersonalizedPracticeService(db,{get:async()=>profile},access,{evaluate:async()=>{calls++;return driving;}});
 const dto={ownerId:'a',version:1,revision,placeId:place.id,requestKey:crypto.randomUUID(),consent:true,parked:true};
 return {state,profile,db,access,service,dto,driving,place,deny:()=>allowed=false,calls:()=>calls};
}
async function withBudget(fn){const keys=['HOMETOWN_DAILY_REQUEST_BUDGET','HOMETOWN_MONTHLY_REQUEST_BUDGET','MAPBOX_DIRECTIONS_TOKEN'],old=keys.map(k=>process.env[k]);Object.assign(process.env,{HOMETOWN_DAILY_REQUEST_BUDGET:'16',HOMETOWN_MONTHLY_REQUEST_BUDGET:'32',MAPBOX_DIRECTIONS_TOKEN:'SYNTHETIC'});try{await fn();}finally{keys.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);}}

test('only current source-backed coverage ranks; descriptions and stale seed tags are not evidence',()=>{
 const r=publicRoute(),focus=preparationFocus('BEGINNER',{difficultyCategories:['roundabouts'],instructorFeedback:true,instructorCategories:['priority']});
 assert.equal(coverageCurrent(r),true);assert.equal(rankPreparation([r],focus,'BEGINNER')[0].score,12);
 r.points[0].latitude+=.0001;assert.equal(coverageCurrent(r),false);const next=rankPreparation([r],focus,'BEGINNER')[0];assert.equal(next.score,0);assert.deepEqual(next.matched,[]);assert.match(next.reason,/No reviewed match/);
 r.preparationCoverage=null;assert.equal(rankPreparation([r],focus,'DIFFICULT')[0].coverage.status,'UNKNOWN');
});
test('coverage fingerprint changes on version, point order/coordinates, bearings or reviewed content',()=>{
 const r=publicRoute(),initial=coverageFingerprint(r);for(const change of [{version:2},{points:[{...r.points[0],bearing:90}]},{points:[{...r.points[0],warning:'Changed'}]}])assert.notEqual(coverageFingerprint({...r,...change}),initial);
});
test('private snapshots enforce exact duration, connected closure, ordered coverage and real measured geometry',()=>{
 const f=fixture(),points=f.driving.snappedPoints,anchor=[f.place.longitude,f.place.latitude];
 assert.ok(checkedPrivateSnapshot(f.driving,points,anchor));
 for(const durationSec of [1379.999,1620.001,null,NaN])assert.equal(checkedPrivateSnapshot({...f.driving,durationSec},points,anchor),null);
 for(const durationSec of [1380,1620])assert.ok(checkedPrivateSnapshot({...f.driving,durationSec},points,anchor));
 assert.equal(checkedPrivateSnapshot({...f.driving,distanceM:1},points,anchor),null);
 assert.equal(checkedPrivateSnapshot(f.driving,[points[0],points[2],points[1],points[3],points[4]],anchor),null);
 assert.equal(checkedPrivateSnapshot(f.driving,points,[0,0]),null);
 const crossing=[points[0],points[2],points[1],points[3],points[0]].map(p=>[p.longitude,p.latitude]);assert.equal(checkedPrivateSnapshot({...f.driving,coordinates:crossing},points,anchor),null);
});
test('licensed town lookup is bounded and cannot accept an arbitrary address, URL or coordinates as a town id',()=>{
 const list=searchHometowns('Leuven');assert.ok(list.length>0&&list.length<=12);assert.ok(hometownPlace(list[0].id));assert.equal(hometownPlace('https://example.invalid'),undefined);assert.deepEqual(searchHometowns(''),[]);assert.ok(list.every(p=>!('latitude'in p)&&!('longitude'in p)));
});
test('generation and review DTOs reject missing consent, stale-shaped ids, arbitrary coordinates and plan mass assignment',()=>{
 const f=fixture(),check=v=>validateSync(plainToInstance(HometownGenerationDto,v),{whitelist:true,forbidNonWhitelisted:true});assert.equal(check(f.dto).length,0);
 for(const v of [{...f.dto,consent:false},{...f.dto,parked:false},{...f.dto,placeId:'50,5'},{...f.dto,requestKey:'x'},{...f.dto,plan:'Premium'},{...f.dto,latitude:50}])assert.ok(check(v).length);
 assert.ok(validateSync(plainToInstance(HometownReflectionDto,{ownerId:'a',parked:true,difficultyCategories:['fake'],instructorCategories:[]})).length);
 assert.ok(validateSync(plainToInstance(CoverageReviewDto,{routeVersion:1,fingerprint:'x',skills:['roundabouts'],complexity:'HIGH',sourceUrl:'http://example.invalid',notes:'unreviewed',confirmReviewed:false})).length);
});
test('Free / wrong-centre access, changed owner/profile and unknown town fail before provider spend',async()=>withBudget(async()=>{
 const f=fixture();f.deny();await assert.rejects(f.service.generate('a',f.dto),/active Basic/);assert.equal(f.calls(),0);assert.equal(f.state.requests.length,0);
 const g=fixture();for(const dto of [{...g.dto,ownerId:'b'},{...g.dto,version:0},{...g.dto,revision:crypto.randomUUID()},{...g.dto,placeId:'gn:0'}])await assert.rejects(g.service.generate('a',dto));assert.equal(g.calls(),0);
}));
test('unconfigured approved allowance does not silently incur any provider spend',async()=>{
 const f=fixture(),old=process.env.HOMETOWN_DAILY_REQUEST_BUDGET;delete process.env.HOMETOWN_DAILY_REQUEST_BUDGET;try{await assert.rejects(f.service.generate('a',f.dto),/approved provider allowance/);assert.equal(f.calls(),0);}finally{if(old!==undefined)process.env.HOMETOWN_DAILY_REQUEST_BUDGET=old;}
});
test('bounded generation saves a private immutable snapshot only, and identical retry never spends again',async()=>withBudget(async()=>{
 const f=fixture(),result=await f.service.generate('a',f.dto);assert.equal(f.calls(),2);assert.equal(result.ownerId,'a');assert.equal(f.state.routes.length,1);assert.equal(f.state.requests[0].state,'SUCCEEDED');assert.ok(Object.values(f.state.budgets).every(b=>b.reserved===8));assert.equal(result.snapshot.source,'PRIVATE_HOMETOWN_PRACTICE');
 const again=await f.service.generate('a',f.dto);assert.equal(again.id,result.id);assert.equal(f.calls(),2);assert.match(result.label,/not an official/);assert.ok(f.state.audits.every(a=>!JSON.stringify(a).includes('latitude')));
 await assert.rejects(f.service.getRoute('b',result.id),/not found/);
}));
test('budget/cooldown exhaustion and failed validation never publish, fabricate or reset the allowance',async()=>withBudget(async()=>{
 const f=fixture();f.driving.durationSec=500;await assert.rejects(f.service.generate('a',f.dto),/Nothing was fabricated/);assert.ok(f.calls()<=8);assert.equal(f.state.routes.length,0);assert.equal(f.state.requests[0].state,'FAILED');await assert.rejects(f.service.generate('a',f.dto),/already reserved/);await assert.rejects(f.service.generate('a',{...f.dto,requestKey:crypto.randomUUID()}),/five minutes/);
 const g=fixture();g.state.budgets['month:'+new Date().toISOString().slice(0,7)]={reserved:32};await assert.rejects(g.service.generate('a',g.dto),/allowance/);assert.equal(g.calls(),0);assert.equal(g.state.requests.length,0);
}));
test('route is not saved if the profile changes while provider generation is in flight',async()=>withBudget(async()=>{
 const f=fixture();let count=0;f.service.driving.evaluate=async()=>{if(++count===2)f.profile.revision=crypto.randomUUID();return f.driving;};const original={...f.dto};await assert.rejects(f.service.generate('a',original),/Save\/reload/);assert.equal(f.state.routes.length,0);assert.equal(f.state.requests[0].state,'FAILED');
}));
test('recommendations redact locked coverage, never expose coordinates and never claim a trial',async()=>{
 const f=fixture(),result=await f.service.recommendations('a');assert.equal(result.ownerId,'a');assert.equal(result.routes[0].unlocked,true);const locked=result.routes.find(r=>!r.unlocked);assert.equal(locked.coverage.status,'LOCKED');assert.deepEqual(locked.matched,[]);assert.equal(locked.score,0);assert.doesNotMatch(JSON.stringify(result),/latitude|longitude|fingerprint/);assert.doesNotMatch(JSON.stringify(locked),/example.invalid\/review/);assert.equal(f.state.requests.length,0);
});
test('private practice keeps exact route for repeat, never marks no-GPS completion and redacts end after expiry',async()=>withBudget(async()=>{
 const f=fixture(),route=await f.service.generate('a',f.dto),saved=JSON.stringify(route.snapshot),body={ownerId:'a',parked:true};
 const session=await f.service.start('a',route.id,body);const ended=await f.service.end('a',session.id,body);assert.equal(ended.completionPct,0);assert.equal(ended.completionKind,'ENDED');assert.ok(!('route'in ended));
 const second=await f.service.start('a',route.id,body);assert.notEqual(session.id,second.id);assert.equal(JSON.stringify(f.state.routes[0].snapshot),saved);
 await assert.rejects(f.service.track('b',second.id,{latitude:50,longitude:5,accuracyM:3}),/not found/);
 const weak=await f.service.track('a',second.id,{latitude:f.place.latitude,longitude:f.place.longitude,accuracyM:150});assert.equal(weak.reason,'GPS_ACCURACY');
 f.deny();await assert.rejects(f.service.getRoute('a',route.id),/active Basic/);const endedAgain=await f.service.end('a',session.id,body);assert.ok(!('route'in endedAgain));
 await f.service.remove('a',route.id,body);assert.equal(f.state.routes.length,0);
}));
test('source coverage edits refuse stale route preimages and audit failures are transactional',async()=>{
 const route=publicRoute(),rows=[],db={user:{findUnique:async()=>({role:'ADMIN'})},$queryRawUnsafe:async()=>[],route:{findFirst:async()=>route},preparationCoverage:{upsert:async args=>rows.push(args)},auditLog:{create:async()=>{throw Error('TEST AUDIT FAILURE');}},$transaction:async fn=>{try{return await fn(db);}catch(e){rows.length=0;throw e;}}};const c=new PreparationCoverageController(db),dto={routeVersion:1,fingerprint:coverageFingerprint(route),skills:['roundabouts'],complexity:'LOW',sourceUrl:'https://example.invalid/review',notes:'Synthetic explicitly reviewed test coverage only.',confirmReviewed:true};
 await assert.rejects(c.review({user:{sub:'admin'}},route.id,{...dto,routeVersion:2}),/Route changed/);assert.equal(rows.length,0);await assert.rejects(c.review({user:{sub:'admin'}},route.id,dto),/AUDIT FAILURE/);assert.equal(rows.length,0);
});
test('repeat saved public route requires ownership, access and exact version/fingerprint without rewriting history',async()=>{
 const r=publicRoute(),loop=syntheticLoop(hometownPlace(searchHometowns('Leuven')[0].id)),old={geometry:loop.coordinates,points:loop.coordinates,distanceM:loop.distanceM,durationSec:1500,routeVersion:1,routeFingerprint:coverageFingerprint(r),coachingReview:{notes:'Private old note'}};let created;
 const previous={id:'s',userId:'a',routeId:r.id,completedAt:new Date(),routeSnapshot:old};const db={practiceSession:{findFirst:async({where})=>where.id==='s'&&where.userId==='a'?previous:null,create:async({data})=>{created=data;return {id:'new',...data};}},routePoint:{findMany:async()=>r.points},$executeRawUnsafe:async()=>0,auditLog:{create:async()=>{}},$transaction:async fn=>fn(db)};
 const service=new LearningService(db,{}, {requireAccess:async()=>({route:r})},{});await assert.rejects(service.repeatSession('b','s'),/not found/);await service.repeatSession('a','s');assert.deepEqual(created.routeSnapshot.geometry,old.geometry);assert.ok(!created.routeSnapshot.coachingReview);assert.ok(old.coachingReview);r.version=2;await assert.rejects(service.repeatSession('a','s'),/fresh check/);
});

test('real HTTP endpoints enforce JWT, private no-store, account ownership and current reviewer permission',async()=>withBudget(async()=>{
 const {Test}=require('@nestjs/testing'),{JwtModule,JwtService}=require('@nestjs/jwt'),{ValidationPipe,Logger}=require('@nestjs/common');Logger.overrideLogger(false);
 const {PersonalizationController}=require('../dist/src/learning/personalization.controller'),{JwtAuthGuard}=require('../dist/src/auth/auth.guard'),{JWT_ACCESS_SECRET}=require('../dist/src/auth/auth.service'),{PrismaService}=require('../dist/src/prisma.service');
 const f=fixture();f.db.user={findUnique:async()=>({role:'LEARNER'})};
 const module=await Test.createTestingModule({imports:[JwtModule.register({secret:JWT_ACCESS_SECRET})],controllers:[PersonalizationController,PreparationCoverageController],providers:[JwtAuthGuard,{provide:PersonalizedPracticeService,useValue:f.service},{provide:PrismaService,useValue:f.db}]}).compile();
 const app=module.createNestApplication();app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));await app.listen(0,'127.0.0.1');
 try{
  const base=(await app.getUrl())+'/api/v1',jwt=new JwtService(),token=(id,role='LEARNER')=>jwt.sign({sub:id,role},{secret:JWT_ACCESS_SECRET,expiresIn:'5m'});
  const req=(path,id,method='GET',body,role='LEARNER')=>fetch(base+path,{method,headers:{...(id?{Authorization:'Bearer '+token(id,role)}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await req('/me/preparation/towns?q=Leuven',null)).status,401);assert.equal(f.calls(),0);
  const towns=await req('/me/preparation/towns?q=Leuven','a');assert.equal(towns.status,200);assert.match(towns.headers.get('cache-control'),/private, no-store/);
  const made=await req('/me/preparation/hometown-routes','a','POST',f.dto);assert.equal(made.status,201);const route=await made.json();assert.equal(route.ownerId,'a');
  assert.equal((await req('/me/preparation/hometown-routes/'+route.id,'b')).status,404);
  assert.equal((await req('/me/preparation/hometown-routes/'+route.id+'/sessions','a','POST',{ownerId:'b',parked:true})).status,409);
  assert.equal((await req('/admin/preparation-coverage','a')).status,403);
  assert.equal((await req('/admin/preparation-coverage','a','GET',null,'ADMIN')).status,403,'A previously signed admin token does not preserve removed reviewer permission');
  f.db.user.findUnique=async()=>({role:'ADMIN'});assert.equal((await req('/admin/preparation-coverage','a','GET',null,'ADMIN')).status,200);
 }finally{await app.close();}
}));

test('startup bootstraps missing centres but does not overwrite existing directory content or timestamps',async()=>{
 const {ExamCentresService}=require('../dist/src/exam-centres/exam-centres.service'),calls=[];
 const service=new ExamCentresService({examCentre:{upsert:async args=>{calls.push(args);assert.deepEqual(args.update,{});return {id:'existing',isPublished:false,name:'Reviewed custom name'};}}},{},{});await service.onModuleInit();assert.equal(calls.length,32);assert.ok(calls.every(c=>c.create.isPublished===true));
});
