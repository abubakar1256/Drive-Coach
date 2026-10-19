require('reflect-metadata');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {plainToInstance}=require('class-transformer'),{validateSync}=require('class-validator');
const {preparationFocus}=require('../dist/src/learning/preparation-policy');
const {PreparationService}=require('../dist/src/learning/preparation.service');
const {UpdatePreparationDto}=require('../dist/src/learning/dto/preparation.dto');
const valid={ownerId:'learner-a',version:0,preferredName:'TEST Learner',age:25,centreId:'centre-a',homeTown:'Leuven',preferredLevel:'BEGINNER'};
function fixture(){
 const state={profiles:[],audits:[]},calls=[];
 const user={findUnique:async({where})=>['learner-a','learner-b'].includes(where.id)?{id:where.id,displayName:'Synthetic learner'}:null};
 const db={user,
  preparationProfile:{findUnique:async({where})=>state.profiles.find(p=>p.userId===where.userId)||null,upsert:async({where,create,update})=>{const current=state.profiles.find(p=>p.userId===where.userId);if(current){Object.assign(current,update,{version:current.version+1});return current;}const p={version:1,preferredName:null,age:null,centreId:null,homeTown:null,preferredLevel:'BEGINNER',...create};state.profiles.push(p);return p;},deleteMany:async({where})=>{state.profiles=state.profiles.filter(p=>p.userId!==where.userId);}},
  selfReflection:{findFirst:async query=>{calls.push(query);return {difficultyCategories:['roundabouts'],instructorFeedback:true,instructorCategories:['observation']};}},
  examCentre:{findFirst:async({where})=>where.id==='centre-a'&&where.isPublished?{id:'centre-a'}:null},
  auditLog:{create:async({data})=>state.audits.push(data)},$queryRawUnsafe:async(...args)=>{calls.push(args);return [];},
  $transaction:async fn=>{const before=structuredClone(state);try{return await fn(db);}catch(e){Object.assign(state,before);throw e;}}
 };
 return {state,calls,db,service:new PreparationService(db)};
}
test('difficulty is user-selected, never inferred from age, GPS or reflection; all levels preserve route duration',()=>{
 for(const level of ['BEGINNER','INTERMEDIATE','DIFFICULT']){
  const plan=preparationFocus(level,{flaggedSpeeding:true,difficultyCategories:['priority']});
  assert.equal(plan.selectedLevel,level);assert.equal(plan.abilityInferred,false);assert.equal(plan.levelSource,'USER_CHOICE');
  assert.equal(plan.targetMinutes,25);assert.equal(plan.toleranceMinutes,2);assert.equal(plan.routeGeneration,'NOT_REQUESTED');
 }
 assert.throws(()=>preparationFocus('Diamond'));
 assert.equal(preparationFocus('BEGINNER',null,false).levelSource,'DEFAULT_NOT_YET_SELECTED');
});
test('reported focus is bounded, explainable and does not call instructor claims verified',()=>{
 const r=preparationFocus('INTERMEDIATE',{difficultyCategories:['roundabouts','unknown','speed'],instructorFeedback:true,instructorCategories:['observation','roundabouts']});
 assert.deepEqual(r.items.map(p=>p.code),['speed','roundabouts','observation']);
 assert.deepEqual(r.items[1].basis,['SELF_REPORTED','INSTRUCTOR_REPORTED']);
 assert.deepEqual(r.items[2].basis,['INSTRUCTOR_REPORTED']);
 assert.equal(preparationFocus('BEGINNER',{instructorFeedback:false,instructorCategories:['speed']}).needsReflection,true);
 assert.match(r.safety,/not detected traffic violations/);
});
test('profile DTO rejects invalid age/level and precise coordinates or address-like hometown input',()=>{
 const check=data=>validateSync(plainToInstance(UpdatePreparationDto,data),{whitelist:true,forbidNonWhitelisted:true});
 assert.equal(check(valid).length,0);
 for(const age of [0,121,-1,1.5,'25',NaN,Infinity])assert.ok(check({...valid,age}).length);
 for(const preferredLevel of ['Premium','easy',null,1])assert.ok(check({...valid,preferredLevel}).length);
 for(const homeTown of ['50.879, 4.700','Road 42','1000 Brussels','a','https://example.test'])assert.ok(check({...valid,homeTown}).length);
 for(const data of [{...valid,ownerId:''},{...valid,version:-1},{...valid,role:'ADMIN'},{...valid,preferredName:' '.repeat(4)}])assert.ok(check(data).length);
 assert.equal(check({...valid,age:null,homeTown:null,preferredName:null,centreId:null}).length,0);
});
test('new/legacy accounts get an optional default without creating a profile or changing access',async()=>{
 const f=fixture(),p=await f.service.get('learner-a');
 assert.equal(p.saved,false);assert.equal(p.version,0);assert.equal(p.age,null);assert.equal(p.focus.levelSource,'DEFAULT_NOT_YET_SELECTED');
 assert.equal(f.state.profiles.length,0);assert.equal(f.state.audits.length,0);
 assert.equal(f.calls[0].where.userId,'learner-a');
 await assert.rejects(f.service.get('not-an-account'),/Account not found/);
});
test('private updates are owner-bound, versioned and audit field names only',async()=>{
 const f=fixture(),result=await f.service.save('learner-a',valid);
 assert.equal(result.ownerId,'learner-a');assert.equal(result.age,25);assert.equal(result.version,1);
 assert.equal(f.state.profiles[0].userId,'learner-a');
 assert.equal(JSON.stringify(f.state.audits).includes('TEST Learner'),false);assert.equal(JSON.stringify(f.state.audits).includes('Leuven'),false);
 await assert.rejects(f.service.save('learner-b',{...valid,version:1}),/account changed/);
 await assert.rejects(f.service.save('learner-a',valid),/profile changed/);
 assert.equal(f.state.profiles.length,1);assert.equal(f.state.profiles[0].version,1);
});
test('invalid/unpublished centre, mass assignment and stale version cause no partial writes',async()=>{
 for(const change of [{centreId:'unpublished'},{userId:'learner-b'},{role:'ADMIN'},{preferredLevel:null},{version:99}]){
  const f=fixture();await assert.rejects(f.service.save('learner-a',{...valid,...change}));assert.deepEqual(f.state,{profiles:[],audits:[]});
 }
});
test('clear removes only the current optional profile and cannot clear another owner or stale data',async()=>{
 const f=fixture(),saved=await f.service.save('learner-a',valid);await f.service.save('learner-b',{...valid,ownerId:'learner-b'});
 await assert.rejects(f.service.clear('learner-a',{ownerId:'learner-b',version:1}));
 await assert.rejects(f.service.clear('learner-a',{ownerId:'learner-a',version:0}));
 const result=await f.service.clear('learner-a',{ownerId:'learner-a',version:1,revision:saved.revision});
 assert.equal(result.accessUnchanged,true);assert.deepEqual(f.state.profiles.map(p=>p.userId),['learner-b']);
});
test('name, age and hometown can be explicitly cleared without changing selected level or ownership',async()=>{
 const f=fixture(),saved=await f.service.save('learner-a',valid);
 const result=await f.service.save('learner-a',{ownerId:'learner-a',version:1,revision:saved.revision,preferredName:null,age:null,homeTown:null,centreId:null});
 assert.equal(result.age,null);assert.equal(result.homeTown,'');assert.equal(result.preferredLevel,'BEGINNER');assert.equal(result.ownerId,'learner-a');assert.equal(result.version,2);
});
test('real Nest endpoint enforces authentication, private caching and account-bound saves/clear',async()=>{
 const {Test}=require('@nestjs/testing'),{ValidationPipe}=require('@nestjs/common'),{JwtModule,JwtService}=require('@nestjs/jwt');
 const {PreparationController}=require('../dist/src/learning/preparation.controller'),{JwtAuthGuard}=require('../dist/src/auth/auth.guard'),{JWT_ACCESS_SECRET}=require('../dist/src/auth/auth.service');
 const f=fixture(),module=await Test.createTestingModule({imports:[JwtModule.register({secret:JWT_ACCESS_SECRET})],controllers:[PreparationController],providers:[JwtAuthGuard,{provide:PreparationService,useValue:f.service}]}).compile();
 const app=module.createNestApplication();app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));await app.listen(0,'127.0.0.1');
 try{
  const url=(await app.getUrl())+'/api/v1/me/preparation-profile',jwt=new JwtService(),token=id=>jwt.sign({sub:id},{secret:JWT_ACCESS_SECRET,expiresIn:'5m'});
  const request=(id,method='GET',body)=>fetch(url,{method,headers:{...(id?{Authorization:'Bearer '+token(id)}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await request(null)).status,401);
  const initial=await request('learner-a');assert.match(initial.headers.get('cache-control'),/private, no-store/);assert.equal((await initial.json()).saved,false);
  assert.equal((await request('learner-a','PATCH',valid)).status,200);
  const other=await (await request('learner-b')).json();assert.equal(other.ownerId,'learner-b');assert.equal(other.age,null);assert.equal(other.saved,false);
  assert.equal((await request('learner-b','PATCH',{...valid,version:1})).status,409);
  const existing=await (await request('learner-a')).json();
  assert.equal((await request('learner-a','PATCH',{...valid,version:1,revision:existing.revision,role:'ADMIN'})).status,200);
  assert.equal(f.state.profiles[0].role,undefined);
  assert.equal((await request('learner-b','DELETE',{ownerId:'learner-a',version:2})).status,409);
  const latest=await (await request('learner-a')).json();
  assert.equal((await request('learner-a','DELETE',{ownerId:'learner-a',version:2,revision:latest.revision})).status,200);
  assert.equal((await (await request('learner-a')).json()).saved,false);
 }finally{await app.close();}
});
test('clearing and recreating a profile cannot revive an old tab revision',async()=>{
 const f=fixture(),old=await f.service.save('learner-a',valid);
 await f.service.clear('learner-a',{ownerId:'learner-a',version:old.version,revision:old.revision});
 const current=await f.service.save('learner-a',valid);
 assert.equal(current.version,old.version);assert.notEqual(current.revision,old.revision);
 await assert.rejects(f.service.save('learner-a',{ownerId:'learner-a',version:old.version,revision:old.revision,age:40}),/profile changed/);
 await assert.rejects(f.service.clear('learner-a',{ownerId:'learner-a',version:old.version,revision:old.revision}),/profile changed/);
 assert.equal((await f.service.get('learner-a')).age,25);
});

test('account-owned after-drive checklist feeds reported focus without exporting notes or snapshot coordinates',async()=>{
 const f=fixture();f.db.practiceSession={findFirst:async({where})=>{assert.equal(where.userId,'learner-a');return {routeSnapshot:{geometry:[[5,50]],coachingReview:{source:'instructor_reported',ratings:{roundabouts:'good',priority:'practice',speed_choice:'not_assessed'},notes:'PRIVATE_MANUAL_NOTES',savedAt:new Date().toISOString()}}};}};
 const p=await f.service.get('learner-a');assert.deepEqual(p.focus.items.map(i=>i.code),['priority']);assert.deepEqual(p.focus.items[0].basis,['INSTRUCTOR_REPORTED']);assert.doesNotMatch(JSON.stringify(p),/PRIVATE_MANUAL_NOTES|"geometry":|"latitude":/);
});
