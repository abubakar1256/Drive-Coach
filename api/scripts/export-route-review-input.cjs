// Isolated archive restore + read-only route evidence export. Never production.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {coverageFingerprint}=require('../dist/src/learning/personalization-policy');
const {publishedRoutePolicy}=require('../dist/src/routes/published-route-policy');
const {fingerprints}=require('./rehearse-complete-passage-review.cjs');
const root=path.resolve(__dirname,'../../output/db-backups'),out=path.resolve(__dirname,'../../output/chatbot-audit/preparation-content');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const archive=path.resolve(process.argv[2]||'');
 if(!archive.startsWith(root+path.sep)||!archive.endsWith('.dump'))throw Error('Task-local archive required');
 const archiveSha256=sha(fs.readFileSync(archive));
 if(archiveSha256!==fs.readFileSync(archive+'.sha256','utf8').trim())throw Error('Archive checksum mismatch');
 const bin=path.join(root,'pg18-tools/pgsql/bin'),dir=path.join(root,'content-review-restore-'+Date.now()),data=path.join(dir,'data'),pwfile=path.join(dir,'password');
 fs.mkdirSync(dir,{mode:0o700});fs.mkdirSync(out,{recursive:true});
 const password=crypto.randomBytes(32).toString('hex');fs.writeFileSync(pwfile,password,{flag:'wx',mode:0o600});
 const env={...process.env,PGHOST:'127.0.0.1',PGPORT:'15443',PGUSER:'content_restore',PGPASSWORD:password,PGDATABASE:'content_restore'};
 function run(name,args){const r=cp.spawnSync(path.join(bin,name+'.exe'),args,{env,windowsHide:true,stdio:name==='pg_ctl'?'ignore':['ignore','pipe','pipe'],timeout:180000});if(r.status!==0||r.error)throw Error('Isolated '+name+' failed; details omitted');}
 let started=false,db;
 try{
  run('initdb',['-D',data,'-U',env.PGUSER,'--pwfile',pwfile,'--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C']);
  run('pg_ctl',['-D',data,'-l',path.join(dir,'server.log'),'-o','-h 127.0.0.1 -p 15443','-w','start']);started=true;
  run('createdb',[env.PGDATABASE]);run('pg_restore',['--exit-on-error','--no-owner','--no-acl','--dbname='+env.PGDATABASE,archive]);
  const url=new URL('postgresql://127.0.0.1:15443/content_restore');url.username=env.PGUSER;url.password=password;
  db=new PrismaClient({datasourceUrl:url.toString(),log:[]});const before=await fingerprints(db);
  const rows=await db.route.findMany({where:{...publishedRoutePolicy,centre:{isPublished:true}},include:{points:{orderBy:{sequence:'asc'}},centre:{select:{id:true,slug:true,name:true}}},orderBy:{id:'asc'}});
  const routes=rows.map(r=>({id:r.id,slug:r.slug,name:r.name,version:r.version,fingerprint:coverageFingerprint(r),centre:r.centre,durationMin:r.durationMin,points:r.points.map(p=>({id:p.id,sequence:p.sequence,title:p.title,category:p.category,latitude:p.latitude,longitude:p.longitude,bearing:p.bearing,description:p.description,warning:p.warning}))}));
  const centres=await db.examCentre.findMany({where:{isPublished:true},select:{id:true,slug:true,name:true,latitude:true,longitude:true},orderBy:{slug:'asc'}});
  const unchanged=JSON.stringify(before)===JSON.stringify(await fingerprints(db));if(!unchanged)throw Error('Read-only export changed restored data');
  const result={createdAt:new Date().toISOString(),archiveSha256,fullRestorePassed:true,protectedTablesUnchanged:true,productionChanged:false,providerRequests:0,centres,routes};
  const target=path.join(out,'route-input-'+Date.now()+'.json');fs.writeFileSync(target,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({file:target,archiveSha256,fullRestorePassed:true,protectedTablesUnchanged:true,routes:routes.length,centres:centres.length,productionChanged:false}));
 }finally{if(db)await db.$disconnect();if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);if(fs.existsSync(pwfile))fs.unlinkSync(pwfile);}
}
if(require.main===module)main().catch(()=>{console.error('Isolated route export stopped; sensitive details omitted.');process.exitCode=1;});
