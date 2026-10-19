// Explicit build-time GeoNames import; never a production startup job.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
async function main(){
 const root=path.resolve(__dirname,'../../output/phase-three-places');fs.mkdirSync(root,{recursive:true});
 const url='https://download.geonames.org/export/dump/BE.zip',archive=path.join(root,'BE.zip');
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Place source unavailable');
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>5e6)throw Error('Unexpected source size');fs.writeFileSync(archive,bytes);
 const extract=path.join(root,'extract-'+Date.now());
 const result=cp.spawnSync('powershell.exe',['-NoProfile','-Command',`Expand-Archive -LiteralPath '${archive.replaceAll("'","''")}' -DestinationPath '${extract.replaceAll("'","''")}'`],{windowsHide:true});if(result.status)throw Error('Archive extraction failed');
 const places=fs.readFileSync(path.join(extract,'BE.txt'),'utf8').trim().split(/\r?\n/).map(line=>line.split('\t')).filter(c=>c[6]==='P'&&/^PPL(?:A[1-4]?|C)?$/.test(c[7])&&c[8]==='BE').map(c=>({id:'gn:'+c[0],name:c[1],aliases:[...new Set([c[2],...c[3].split(',')])].filter(Boolean).slice(0,25),latitude:Number(c[4]),longitude:Number(c[5]),region:c[10],district:c[11],population:Number(c[14])}));
 if(places.length<500||places.some(p=>!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)))throw Error('Invalid Belgian place extract');
 const output={source:url,attribution:'GeoNames, CC BY 4.0',license:'https://creativecommons.org/licenses/by/4.0/',retrievedAt:new Date().toISOString(),archiveSha256:crypto.createHash('sha256').update(bytes).digest('hex'),places};
 fs.writeFileSync(path.resolve(__dirname,'../prisma/data/belgian-places.json'),JSON.stringify(output));console.log(JSON.stringify({places:places.length,source:url,archiveSha256:output.archiveSha256}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
