// Public reads only. No sign-in, trial claim, Directions call or provider spend.
const fs=require('node:fs'),path=require('node:path');
const base='https://courageous-embrace-production-98c2.up.railway.app/api/v1';
async function get(route){const r=await fetch(base+route,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Public API smoke failed: '+r.status);return r.json();}
async function main(){
  const centres=await get('/exam-centres'),routes=await get('/routes'),summaries=[];
  if(centres.length!==33||routes.length!==137||routes.some(r=>r.points?.length||r.foundation?.points||r.foundation?.departure))throw Error('Public catalogue identity/redaction changed');
  for(const c of centres){const s=await get(`/exam-centres/${encodeURIComponent(c.slug)}/route-foundation`);if('points'in s||'departure'in s||s.officialExamItinerary!==false)throw Error('Private source proof exposed');summaries.push({slug:c.slug,...s});}
  const total={centres:centres.length,routes:routes.length,sourceBundles:summaries.filter(s=>s.source).length,reviewedLocations:summaries.reduce((n,s)=>n+s.reviewedPointCount,0),pendingNonDuplicate:summaries.reduce((n,s)=>n+s.pendingPointCount,0),completeSourceBundles:summaries.filter(s=>s.reviewComplete).length};
  if(total.sourceBundles!==30||total.reviewedLocations!==270||total.pendingNonDuplicate!==863||total.completeSourceBundles!==6)throw Error('Public source totals changed');
  const slug=encodeURIComponent(routes[0].slug),points=await get(`/routes/${slug}/points`);
  if(!Array.isArray(points)||points.length)throw Error('Guest paid route points exposed');
  for(const route of [`/routes/${slug}/access`,'/me/preparation/hometown-routes']){const r=await fetch(base+route,{signal:AbortSignal.timeout(20000)});if(r.status!==401)throw Error('Private endpoint guard changed');}
  const receipt={checkedAt:new Date().toISOString(),publicReadOnly:true,routePointsRedacted:true,privateGuardsPassed:true,phaseTwoComplete:false,...total};
  const file=path.resolve(__dirname,`../../output/chatbot-audit/phase-two-remaining/public-smoke-${Date.now()}.json`);fs.writeFileSync(file,JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify({receipt:file,...receipt}));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
