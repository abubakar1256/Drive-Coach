// Approved private production reads only. No account, route or schema writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
const {fingerprints}=require('./rehearse-complete-passage-review.cjs');
const {sha}=require('./prepare-reviewed-passage-release.cjs');
const root=path.resolve(__dirname,'../../output/db-backups');
async function main(){
 const url=new URL(process.env.DATABASE_URL||'');if(url.hostname!=='127.0.0.1'||url.port!=='15439')throw Error('Task-only private tunnel required');
 const mode=process.argv[2],file=path.resolve(process.argv[3]||'');if(!file.startsWith(root+path.sep))throw Error('Task output required');
 const db=new PrismaClient({datasourceUrl:url.toString(),log:[]});try{
  const hashes=await fingerprints(db),migrationFiles=['0019_private_preparation_profile','0020_private_personalized_practice'].map(name=>({name,sha256:sha(fs.readFileSync(path.resolve(__dirname,'../prisma/migrations',name,'migration.sql')))}));
  if(mode==='before'){
   const rehearsal=JSON.parse(fs.readFileSync(process.argv[4],'utf8'));assert.equal(rehearsal.fullRestorePassed,true);assert.equal(rehearsal.lateAuditRollbackPassed,true);assert.deepEqual(rehearsal.migrations,migrationFiles);assert.ok(Date.now()-Date.parse(rehearsal.createdAt)<6*3600_000);
   fs.writeFileSync(file,JSON.stringify({createdAt:new Date().toISOString(),hashes,migrations:migrationFiles,rehearsal:process.argv[4]},null,2),{flag:'wx',mode:0o600});console.log('Phase 3 private pre-deploy table fingerprints saved; no production data changed.');
  }else if(mode==='after'){
   const before=JSON.parse(fs.readFileSync(file,'utf8'));assert.deepEqual(before.migrations,migrationFiles);
   const changed=Object.keys(before.hashes).filter(table=>table!=='_prisma_migrations'&&before.hashes[table]!==hashes[table]);
   const migrations=await db.$queryRawUnsafe('SELECT "migration_name", "finished_at", "rolled_back_at" FROM "_prisma_migrations" WHERE "migration_name" IN ($1,$2)',...migrationFiles.map(m=>m.name));
   assert.equal(migrations.filter(m=>m.finished_at&&!m.rolled_back_at).length,2);
   const counts={profiles:await db.preparationProfile.count(),privateRoutes:await db.hometownRoute.count(),coverageReviews:await db.preparationCoverage.count(),publicRoutes:await db.route.count({where:{status:'PUBLISHED'}}),centres:await db.examCentre.count({where:{isPublished:true}})};
   const receipt={createdAt:new Date().toISOString(),migrationsApplied:true,previousTablesUnchanged:changed.length===0,changedTableNames:changed,counts,productionReadOnly:true};
   fs.writeFileSync(file.replace(/\.json$/,'.after.json'),JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify(receipt));
   if(changed.length)throw Error('Concurrent table changes require review; do not silently overwrite or claim unchanged');
  }else throw Error('Choose before or after');
 }finally{await db.$disconnect();}
}
main().catch(()=>{console.error('Private Phase 3 verification stopped; no sensitive details printed.');process.exitCode=1;});
