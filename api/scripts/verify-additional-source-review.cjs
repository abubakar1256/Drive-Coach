// Read-only private checks; deliberately never prints users, secrets or GPS.
require('reflect-metadata');
const fs=require('node:fs'),path=require('node:path');
const {PrismaClient}=require('@prisma/client');
const {passageSourceCatalog}=require('../dist/src/exam-centres/passage-source-catalog');
const {sourceReviewCounts,OfficialRouteFoundationService}=require('../dist/src/routes/official-route-foundation.service');
const {coverageCurrent}=require('../dist/src/learning/personalization-policy');
const {publishedRoutePolicy}=require('../dist/src/routes/published-route-policy');
const {validate}=require('./apply-additional-source-review.cjs');
const {sha,root}=require('./prepare-additional-source-review.cjs');
async function main(){
  const url=new URL(process.env.DATABASE_URL||''),file=path.resolve(process.argv[2]||'');
  if(url.hostname!=='127.0.0.1'||url.port!=='15439'||!file.startsWith(root+path.sep))throw Error('Task-only private tunnel required');
  const bytes=fs.readFileSync(file),bundle=JSON.parse(bytes);validate(bundle);
  const db=new PrismaClient({log:[]});
  try{
    const foundation=new OfficialRouteFoundationService(db,{}),centres=await db.examCentre.findMany({include:{officialPassagePoints:true}});
    const results=passageSourceCatalog.map(s=>{const c=centres.find(c=>c.slug===s.slug);if(!c||c.officialPassagePoints.length!==s.points.length)throw Error('Source row count changed');return {slug:s.slug,...sourceReviewCounts(s,c.officialPassagePoints)};});
    for(const r of bundle.rows){const p=centres.find(c=>c.slug===r.slug)?.officialPassagePoints.find(p=>p.sequence===r.sequence);if(!p||p.verificationStatus!=='VERIFIED'||p.latitude!==r.latitude||p.longitude!==r.longitude||p.notes!==r.notes||!p.verifiedAt||!p.verifiedBy)throw Error('Reviewed row mismatch');}
    const routes=await db.route.findMany({where:{...publishedRoutePolicy,centre:{isPublished:true}},include:{points:{orderBy:{sequence:'asc'}},preparationCoverage:true}});
    for(const route of routes)await foundation.validateSnapshot(route,route.points);
    const totals={sourceBundles:results.length,printedRows:centres.reduce((n,c)=>n+c.officialPassagePoints.length,0),reviewedLocations:centres.reduce((n,c)=>n+c.officialPassagePoints.filter(p=>p.verificationStatus==='VERIFIED').length,0),pendingNonDuplicate:results.reduce((n,c)=>n+c.pendingPointCount,0),excludedDuplicateRows:results.reduce((n,c)=>n+c.duplicateEntryCount,0),completeSourceBundles:results.filter(c=>c.reviewComplete).length,publishedRoutes:routes.length,currentCoverage:routes.filter(coverageCurrent).length,foundationRoutes:routes.filter(r=>r.foundation).length};
    if(totals.sourceBundles!==30||totals.printedRows!==1226||totals.reviewedLocations!==270||totals.pendingNonDuplicate!==863||totals.excludedDuplicateRows!==93||totals.completeSourceBundles!==6||totals.publishedRoutes!==137||totals.currentCoverage!==137||totals.foundationRoutes!==6||routes.some(r=>r.durationMin<23||r.durationMin>27))throw Error('Post-release totals changed');
    const receipt={createdAt:new Date().toISOString(),releaseSha256:sha(bytes),productionReadOnly:true,phaseTwoComplete:false,...totals,centres:results};
    const output=path.resolve(__dirname,`../../output/db-backups/additional-source-verified-${Date.now()}.json`);fs.writeFileSync(output,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({receipt:output,...totals,phaseTwoComplete:false}));
  }finally{await db.$disconnect();}
}
if(require.main===module)main().catch(()=>{console.error('Additional source verification failed; sensitive details omitted.');process.exitCode=1;});
