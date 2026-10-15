// Public read-only smoke checks. No credentials, accounts or practice sessions.
const base='https://courageous-embrace-production-98c2.up.railway.app/api/v1';
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Public endpoint unavailable');return r.json();}
(async()=>{
 const centres=await get(`${base}/exam-centres`);
 const routes=await get(`${base}/routes`);
 if(centres.length!==33||routes.length!==131||routes.some(r=>r.durationMin<24||r.durationMin>30))throw Error('Public duration/catalogue check failed');
 let checked=0,free=0,locked=0;
 for(const centre of centres){
  const c=await get(`${base}/exam-centres/${encodeURIComponent(centre.slug)}`);
  if(!c.routes.length||c.routes.filter(r=>r.isFree).length!==1||!c.routes[0].canAccess||c.premiumInfo!==null||c.routes.slice(1).some(r=>r.canAccess||r.points.length))throw Error('Public Free/Premium gating check failed');
  checked++;free++;locked+=c.routes.length-1;
 }
 const paid=await get(`${base}/routes/alken-road-practice-loop-02/points`);
 if(!Array.isArray(paid)||paid.length)throw Error('Paid point endpoint leaked content');
 console.log(JSON.stringify({publicCentresChecked:checked,publishedRoutes:routes.length,minMinutes:Math.min(...routes.map(r=>r.durationMin)),maxMinutes:Math.max(...routes.map(r=>r.durationMin)),freeRoutes:free,lockedRoutes:locked,paidPointPreviewBlocked:true,alken:routes.filter(r=>r.centre.slug==='alken').map(r=>({slug:r.slug,durationMin:r.durationMin}))},null,2));
})().catch(()=>{console.error('Public route smoke check failed.');process.exitCode=1;});
