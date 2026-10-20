// Explicit bounded recheck of existing catalogue anchors, never route generation.
require('reflect-metadata');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DrivingRouteService}=require('../dist/src/routes/driving-route.service');
const root=path.resolve(__dirname,'../../output/chatbot-audit/preparation-content');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 if(process.argv[2]!=='--check-existing-routes')throw Error('Explicit bounded provider check required');
 const file=path.resolve(process.argv[3]||'');if(!file.startsWith(root+path.sep))throw Error('Task route export required');
 const input=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!input.fullRestorePassed||!input.protectedTablesUnchanged||input.productionChanged!==false||!Array.isArray(input.routes)||input.routes.length>160)throw Error('Verified isolated route export required');
 const limit=Number(process.env.PREPARATION_CONTENT_REQUEST_CAP||0);if(!Number.isInteger(limit)||limit<1||limit>160)throw Error('Explicit 1–160 request cap required');
 if(!(process.env.MAPBOX_DIRECTIONS_TOKEN??process.env.NEXT_PUBLIC_MAPBOX_TOKEN))throw Error('Existing Mapbox token required');
 const identity=sha(JSON.stringify(input.routes.map(r=>[r.id,r.version,r.fingerprint]))),target=path.join(root,'driving-evidence-'+identity+'.json');
 const report=fs.existsSync(target)?JSON.parse(fs.readFileSync(target,'utf8')):{createdAt:new Date().toISOString(),identity,inputFile:file,source:'MAPBOX_DRIVING',requestCap:limit,requests:0,routeMutation:false,automaticallyReviewed:false,routes:[]};
 if(report.identity!==identity||report.requestCap!==limit)throw Error('Existing request receipt must not be reset');
 const save=()=>{fs.writeFileSync(target+'.tmp',JSON.stringify(report),{mode:0o600});fs.renameSync(target+'.tmp',target);};
 const original=global.fetch;global.fetch=async(url,options)=>{
  if(!String(url).startsWith('https://api.mapbox.com/directions/v5/mapbox/driving/'))throw Error('Unexpected provider destination');
  if(report.requests>=limit)throw Error('Approved task request cap reached');
  report.requests++;save();const r=await original(url,options);
  if([401,402,403,429].includes(r.status)){report.stopReason='PROVIDER_ACCESS_OR_LIMIT';save();}
  return r;
 };
 try{
  const driving=new DrivingRouteService();
  for(const route of input.routes){
   if(report.routes.some(r=>r.id===route.id&&r.fingerprint===route.fingerprint))continue;
   if(report.stopReason||report.requests>=limit)break;
   const checked=await driving.evaluate(route.points);
   report.routes.push({id:route.id,slug:route.slug,version:route.version,fingerprint:route.fingerprint,centre:route.centre,checkedAt:new Date().toISOString(),...checked});save();
   console.log(JSON.stringify({slug:route.slug,valid:checked.valid,issues:checked.issues,requests:report.requests}));
  }
  console.log(JSON.stringify({file:target,requested:report.requests,checked:report.routes.length,valid:report.routes.filter(r=>r.valid).length,remaining:input.routes.length-report.routes.length,stopReason:report.stopReason??null,databaseChanged:false,automaticallyReviewed:false}));
 }finally{global.fetch=original;}
}
if(require.main===module)main().catch(()=>{console.error('Bounded route evidence check stopped; sensitive details omitted.');process.exitCode=1;});
