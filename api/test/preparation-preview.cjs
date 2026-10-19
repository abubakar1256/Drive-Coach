// Loopback-only synthetic browser QA; no database, email, payments or provider.
require('reflect-metadata');
const http=require('node:http');
const {PreparationService}=require('../dist/src/learning/preparation.service');
const {officialCentres}=require('../dist/src/exam-centres/official-centres');
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
