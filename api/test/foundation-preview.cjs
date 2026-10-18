// Visual QA fixture only: loopback, no database, credentials or external provider.
require('reflect-metadata');
const http=require('node:http');
const {officialCentres}=require('../dist/src/exam-centres/official-centres');
const {officialPassageCatalog}=require('../dist/src/exam-centres/official-passage-catalog');
const centres=officialCentres.map((c,i)=>({...c,id:`fixture-${i}`,isPublished:true,_count:{routes:0},routes:[]}));
const user={id:'fixture-admin',email:'fixture@example.invalid',displayName:'Local QA',role:'ADMIN',emailVerified:true};
const imported=new Set();
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname.replace(/^\/api\/v1/,'');
  let payload=[];
  if(pathname==='/auth/login'||pathname==='/auth/refresh')payload={user,accessToken:'local-fixture-token',refreshToken:'local-fixture-refresh'};
  else if(pathname==='/auth/me')payload=user;
  else if(pathname==='/admin/centres'||pathname==='/exam-centres')payload=centres;
  else if(pathname.startsWith('/admin/centres/')&&pathname.includes('/route-foundation')){
    const c=centres.find(c=>c.id===pathname.split('/')[3]);const source=officialPassageCatalog.find(s=>s.slug===c?.slug)??null;
    if(pathname.endsWith('/import'))imported.add(c.id);
    payload={centreName:c?.name,source,departure:null,points:source&&imported.has(c.id)?source.points.map(p=>({...p,id:`row-${p.sequence}`,latitude:null,longitude:null,verificationStatus:'PENDING_REVIEW',notes:null,verifiedAt:null,verifiedBy:null})):[],readyPointCount:0};
  }else if(pathname.startsWith('/exam-centres/')){
    const c=centres.find(c=>c.slug===pathname.split('/')[2]);const source=officialPassageCatalog.find(s=>s.slug===c?.slug);
    payload=pathname.endsWith('/route-foundation')?{source:source?{name:'Autoveiligheid',url:source.sourceUrl,centreUrl:source.centreSourceUrl,address:source.address,revision:source.sourceRevision,publishedEntries:source.points.length}:null,reviewedPointCount:0,departureReviewed:false,targetMinutes:25,toleranceMinutes:2}:{...c,access:{premium:false,plan:'Free',signedIn:false},routes:[]};
  }else if(pathname==='/me/subscription')payload={plan:'Free',status:'FREE'};
  else if(pathname==='/me/entitlements')payload={plan:'Free',status:'FREE',features:{aiChat:false}};
  else if(pathname==='/me/dashboard')payload={user,subscription:{plan:'Free',status:'FREE'},stats:{favoriteCount:0,sessionCount:0,completedSessions:0,averageProgress:0},favorites:[],sessions:[],recommendations:[]};
  else if(pathname==='/admin/reports/overview')payload={users:0,publishedCentres:33,routes:0,publishedRoutes:0,subscriptions:[],practice:{sessions:0,averageCompletion:0,reflections:0},analytics:{pageViews:0,centreViews:0,routeViews:0,revenue:[],failedPayments:0,popularCentres:[],popularRoutes:[]}};
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(payload));
});
server.listen(4620,'127.0.0.1',()=>console.log('Local Phase 2 UI fixture: http://127.0.0.1:4620'));
