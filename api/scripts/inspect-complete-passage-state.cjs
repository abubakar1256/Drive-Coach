// Read-only, task-scoped preflight; never print database credentials/user rows.
const fs=require('node:fs'),path=require('node:path');
const {PrismaClient}=require('@prisma/client');
const {sha}=require('./prepare-reviewed-passage-release.cjs');
const {pendingReviewState}=require('./apply-complete-passage-review.cjs');
async function main(){
 const url=new URL(process.env.DATABASE_URL||'');
 if(url.hostname!=='127.0.0.1'||url.port!=='15439')throw Error('Private task tunnel required');
 const file=path.resolve(__dirname,'../../output/chatbot-audit/phase-two-reconciliation/complete-reviewed-locations.json');
 const bundle=JSON.parse(fs.readFileSync(file,'utf8')),bind=process.argv[2]==='--bind-known-unreviewed-alken-reference';
 const db=new PrismaClient({log:[]});
 try{
  const routes=await db.route.findMany({select:{foundation:true}}),referenced=new Set(routes.flatMap(r=>r.foundation?.points?.map(p=>p.id)||[]));
  const results=[];
  for(const c of bundle.centres){
   const centre=await db.examCentre.findUnique({where:{slug:c.slug},include:{officialPassagePoints:true}});
   for(const p of c.points.filter(p=>p.disposition==='REVIEW_LOCATION')){
    const q=centre.officialPassagePoints.find(q=>q.sequence===p.sequence);
    if(q.verificationStatus!=='PENDING_REVIEW'||q.latitude!==null||q.longitude!==null||referenced.has(q.id)){
     results.push({centre:c.slug,sequence:p.sequence,junction:p.junction,status:q.verificationStatus,hasCoordinates:q.latitude!==null||q.longitude!==null,referenced:referenced.has(q.id),notesSha256:sha(q.notes||''),sourceFingerprint:q.sourceFingerprint});
     if(bind){
      if(c.slug!=='alken'||p.sequence!==1||q.verificationStatus!=='PENDING_REVIEW'||q.verifiedAt!==null||q.verifiedBy!==null||referenced.has(q.id)||q.notes||q.sourceFingerprint!==p.sourceFingerprint)throw Error('Unexpected pending state cannot be bound automatically');
      p.expectedPendingStateSha256=pendingReviewState(q);
     }
    }
   }
  }
  if(bind){
   if(results.length!==1)throw Error('Expected exactly one known unreviewed reference');
   fs.writeFileSync(file,JSON.stringify(bundle,null,2));
  }
  console.log(JSON.stringify({databaseReadOnly:true,localManifestBound:bind,unexpectedInitialStates:results},null,2));
 }finally{await db.$disconnect();}
}
if(require.main===module)main().catch(()=>{console.error('Read-only preflight stopped; sensitive details omitted.');process.exitCode=1;});
