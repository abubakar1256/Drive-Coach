// Read-only, task-scoped post-release verification. Never reads account details.
const fs=require('node:fs'),path=require('node:path');
const {PrismaClient}=require('@prisma/client');
const {coverageFingerprint,coverageCurrent}=require('../dist/src/learning/personalization-policy');
const {mappedCoverageDetails}=require('../dist/src/learning/mapped-preparation-coverage');
const {publishedRoutePolicy}=require('../dist/src/routes/published-route-policy');
const {validateRelease,sha}=require('./apply-preparation-content.cjs');
const sourceData=require('../prisma/data/supplemental-passage-sources.json');
const root=path.resolve(__dirname,'../../output/chatbot-audit/preparation-content');
async function main(){
 const url=new URL(process.env.DATABASE_URL||''),file=path.resolve(process.argv[2]||'');
 if(url.hostname!=='127.0.0.1'||url.port!=='15439'||!file.startsWith(root+path.sep))throw Error('Task-only private tunnel/release required');
 const bytes=fs.readFileSync(file),bundle=validateRelease(JSON.parse(bytes)),db=new PrismaClient({log:[]});
 try{
  const rows=await db.route.findMany({where:{...publishedRoutePolicy,centre:{isPublished:true}},include:{points:{orderBy:{sequence:'asc'}},preparationCoverage:true},orderBy:{id:'asc'}});
  if(rows.length!==137||await db.examCentre.count({where:{isPublished:true}})!==33)throw Error('Published catalogue changed');
  for(const expected of bundle.rows){const route=rows.find(r=>r.id===expected.routeId);if(!route||route.slug!==expected.slug||route.version!==expected.routeVersion||coverageFingerprint(route)!==expected.fingerprint||!coverageCurrent(route)||!mappedCoverageDetails(route.preparationCoverage.notes,route.preparationCoverage.complexity))throw Error('Coverage/version verification failed');}
  const repair=rows.find(r=>r.id===bundle.repair.id);if(repair.durationMin!==Math.ceil(bundle.repair.durationSec/60))throw Error('Repair duration changed');
  let sourceRows=0,pending=0;
  for(const source of sourceData.sources){
   const points=await db.officialPassagePoint.findMany({where:{centre:{slug:source.slug}}});
   if(points.length!==source.points.length||points.some(p=>p.latitude!==null||p.longitude!==null||p.verificationStatus!=='PENDING_REVIEW'||p.verifiedAt!==null||p.verifiedBy!==null))throw Error('New source names unexpectedly approved or changed');
   sourceRows+=points.length;pending+=points.filter(p=>p.duplicateOfSequence===null).length;
  }
  const original=await db.officialPassagePoint.count({where:{centre:{slug:{in:['alken','antwerp-geel','antwerp-north','antwerp-kontich','bree','haasrode']}},verificationStatus:'VERIFIED'}});
  if(original!==153)throw Error('Original source-location reviews changed');
  const result={createdAt:new Date().toISOString(),releaseSha256:sha(bytes),productionReadOnly:true,centres:33,publishedRoutes:rows.length,currentCoverageReviews:rows.filter(coverageCurrent).length,sourceBundles:sourceData.sources.length+6,newSourceNames:sourceRows,pendingNonDuplicateNewNames:pending,preservedLocationReviews:original,repairVersion:repair.version,repairMinutes:bundle.repair.durationSec/60};
  const target=path.resolve(__dirname,'../../output/db-backups/preparation-content-verified-'+Date.now()+'.json');fs.writeFileSync(target,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({receipt:target,...result}));
 }finally{await db.$disconnect();}
}
if(require.main===module)main().catch(()=>{console.error('Post-release read-only verification failed; sensitive details omitted.');process.exitCode=1;});
