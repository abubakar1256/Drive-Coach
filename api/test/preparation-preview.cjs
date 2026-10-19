// Loopback-only synthetic browser QA; no database, email, payments or provider.
require('reflect-metadata');
const http=require('node:http');
const {PreparationService}=require('../dist/src/learning/preparation.service');
const {officialCentres}=require('../dist/src/exam-centres/official-centres');
const {searchHometowns}=require('../dist/src/learning/belgian-places');
const user={id:'phase3-preview-learner',email:'preview@example.invalid',displayName:'Synthetic learner',role:'LEARNER',emailVerified:true};
const centres=officialCentres.map((c,i)=>({...c,id:'preview-centre-'+i}));
let profile=null;
const db={
 user:{findUnique:async()=>user},selfReflection:{findFirst:async()=>({difficultyCategories:['roundabouts'],instructorFeedback:true,instructorCategories:['observation']})},
 examCentre:{findFirst:async({where})=>centres.find(c=>c.id===where.id)||null},
 preparationProfile:{findUnique:async()=>profile,upsert:async({create,update})=>{profile=profile?{...profile,...update,version:profile.version+1}:{preferredName:null,age:null,homeTown:null,centreId:null,preferredLevel:'BEGINNER',version:1,...create};return profile;},deleteMany:async()=>{profile=null;}},
 auditLog:{create:async()=>({})},$queryRawUnsafe:async()=>[],$transaction:async fn=>fn(db),
};
const service=new PreparationService(db),access={plan:'Free',status:'FREE',trial:{available:true,active:false,routeId:null}};
const privateId='6450db2f-02b2-488f-91e1-7f340ac8e6ea',sessions=[];
const privateRoute={id:privateId,ownerId:user.id,placeName:'SYNTHETIC QA LOOP',level:'BEGINNER',label:'Synthetic browser fixture — NOT a real road route or provider validation',evidence:'Synthetic test data only. Do not navigate this fixture.',attribution:'Town lookup: GeoNames · CC BY 4.0. All geometry below is a synthetic UI fixture.',matchedFocus:[],unknownFocus:['roundabouts'],expiresAt:new Date(Date.now()+86400_000).toISOString(),snapshot:{geometry:[[4.7,50.88],[4.705,50.88],[4.705,50.884],[4.7,50.884],[4.7,50.88]],points:[[4.7,50.88],[4.705,50.88],[4.705,50.884],[4.7,50.884],[4.7,50.88]],distanceM:1600,durationSec:1500,observedFeatures:['junctions']},sessions};
const server=http.createServer(async(req,res)=>{
 try{
  let body='';for await(const chunk of req){body+=chunk;if(body.length>16384)throw Error('Fixture input too long');}
  const input=body?JSON.parse(body):{},pathname=new URL(req.url,'http://127.0.0.1').pathname.replace(/^\/api\/v1/,'');
  let result=[];
  if(['/auth/login','/auth/refresh'].includes(pathname))result={user,accessToken:'phase3-preview-token',refreshToken:'phase3-preview-refresh'};
  else if(pathname==='/auth/me')result=user;
  else if(pathname==='/exam-centres')result=centres;
  else if(pathname==='/me/subscription')result=access;
  else if(pathname==='/me/entitlements')result={...access,features:{aiChat:false,voice:false}};
  else if(pathname==='/me/dashboard')result={user,subscription:access,stats:{favoriteCount:0,sessionCount:0,completedSessions:0,averageProgress:0},favorites:[],sessions:[],recommendations:[]};
  else if(pathname==='/me/preparation/recommendations'){const p=await service.get(user.id);result={ownerId:user.id,selectedLevel:p.preferredLevel,centreId:p.centreId,routes:[{id:'fixture-a',name:'Synthetic available practice',centreName:'Alken',durationMin:25,unlocked:true,matched:[],levelMatched:false,coverage:{status:'UNKNOWN'},reason:'No reviewed skill coverage. Synthetic browser QA only.',href:'/centres/alken'},{id:'fixture-b',name:'Synthetic locked practice',centreName:'Alken',durationMin:26,unlocked:false,matched:[],levelMatched:false,coverage:{status:'LOCKED'},reason:'Your access is required. A recommendation does not claim a trial.',href:'/centres/alken'}],history:[],hometown:{configured:false,allowed:false,maxRequests:8},safety:'Synthetic UI fixture. The Free plan is unchanged. No routes were generated.'};}
  else if(pathname==='/me/preparation/towns')result=searchHometowns(new URL(req.url,'http://127.0.0.1').searchParams.get('q')??'');
  else if(pathname==='/me/preparation/hometown-routes')result={ownerId:user.id,routes:[{id:privateId,placeName:privateRoute.placeName,level:'BEGINNER',expiresAt:privateRoute.expiresAt}]};
  else if(pathname===`/me/preparation/hometown-routes/${privateId}`)result=privateRoute;
  else if(pathname===`/me/preparation/hometown-routes/${privateId}/sessions`){let s=sessions.find(s=>!s.completedAt);if(!s){s={id:'60564104-4410-4126-89a3-9d75026b709c',startedAt:new Date().toISOString(),completedAt:null,completionPct:0,completionKind:'TRACKING'};sessions.push(s);}result=s;}
  else if(pathname.match(/\/me\/preparation\/hometown-sessions\/[^/]+\/end$/)){const s=sessions[0];if(s){s.completedAt=new Date().toISOString();s.completionKind='ENDED';}result=s;}
  else if(pathname.match(/\/me\/preparation\/hometown-sessions\/[^/]+\/reflection$/)){if(sessions[0])sessions[0].reflection=input;result={saved:true};}
  else if(pathname==='/me/preparation-profile'){
   if(req.headers.authorization!=='Bearer phase3-preview-token'){res.statusCode=401;result={message:'Synthetic fixture sign-in required'};}
   else if(req.method==='PATCH')result=await service.save(user.id,input);
   else if(req.method==='DELETE')result=await service.clear(user.id,input);
   else result=await service.get(user.id);
  }else if(pathname==='/me/notifications/preferences')result={remindersEnabled:false,examDate:null,practiceReminderAt:null};
  else if(pathname==='/b2b/me')result={instructor:null,studentEnrollments:[],enrollments:[],ownedSchool:null};
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','private, no-store');res.end(JSON.stringify(result));
 }catch(e){res.statusCode=e.getStatus?.()||400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({message:e.message}));}
});
server.listen(4630,'127.0.0.1',()=>console.log('Synthetic Phase 3 preview API on 127.0.0.1:4630; no real accounts or external writes.'));
