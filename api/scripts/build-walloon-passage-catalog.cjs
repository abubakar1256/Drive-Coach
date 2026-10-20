// Deterministic factual transcription from the explicitly inspected car tables.
const fs=require('node:fs'),path=require('node:path');
const {plans}=require('./adopt-operator-pdf-downloads.cjs');
const {officialCentres}=require('../dist/src/exam-centres/official-centres');
const root=path.resolve(__dirname,'../../output/chatbot-audit/operator-sources-20261020');
const additional=[['aibv-braine-points','braine-le-comte','Braine-le-Comte',8,'Av. du Marouset 103, 7090 Braine-le-Comte'],['aibv-couillet-points','charleroi-couillet','Charleroi–Couillet',20,'Rue du Lion Belge 7, 6010 Couillet'],['aibv-mariembourg-points','couvin-mariembourg','Couvin–Mariembourg',8,'Rue Duc Saint Simon 17, 5660 Mariembourg']];
function build(){
 const sources=[...plans.map(([id,slug])=>['autosecurite-'+slug,slug,officialCentres.find(c=>c.slug===slug)?.name??slug,['1009','1011','1031'].includes(id)?20:id==='1027'?10:8,null]),...additional].map(([key,slug,name,count,address])=>{
  const r=JSON.parse(fs.readFileSync(path.join(root,key+'.json'),'utf8')),grid=JSON.parse(fs.readFileSync(path.join(root,key+'-category-b.json'),'utf8')),extracted=JSON.parse(fs.readFileSync(path.join(root,key+'-extracted.json'),'utf8'));
  if(grid.sourceCategory!=='B'||grid.automaticallyLocationReviewed!==false||grid.groups.length!==count||grid.groups.some(g=>g.length!==3||g.some(v=>typeof v!=='string'||!v.trim()))||!extracted.pages[0].text.includes('01/07/2026 au 30/06/2027'))throw Error('Exact current Category B source table required');
  const seen=new Map(),points=grid.groups.flat().map((junction,i)=>{const normalized=junction.toLocaleLowerCase('fr').replace(/\s+/g,' ').trim(),duplicateOfSequence=seen.get(normalized)??null;if(!seen.has(normalized))seen.set(normalized,i+1);return {sequence:i+1,municipality:'Not specified by operator',junction,duplicateOfSequence};});
  const pointGroups=grid.groups.map((_,i)=>[i*3+1,i*3+2,i*3+3]),operatorName=key.startsWith('aibv-')?'AIBV':'Autosécurité';
  return {slug,name,operatorName,address:address??'Consult the current operator centre directory. This document does not verify an entrance or legal stopping place.',centreSourceUrl:operatorName==='AIBV'?'https://www.aibv.be/nl/node/160':r.sourcePage,sourceUrl:r.url,sourceRevision:'2026-07-01',sourceCheckedAt:r.checkedAt,sourceSha256:r.sha256,validUntil:'2027-06-30',points,pointGroups,...(['liege-wandre','tournai-marquain'].includes(slug)?{pointGroupKinds:grid.groups.map((_,i)=>i<8?'RURAL':'URBAN')}:{}),qualification:'Category B table only; other licence-category columns are excluded. Original three-point groups and printed names are retained. These are not complete timed itineraries, coordinates, legal stopping permissions or mandatory points on every exam; order may change with local conditions. Municipality is not guessed.'};
 });
 if(sources.length!==14||sources.reduce((n,s)=>n+s.points.length,0)!==486)throw Error('Expected fourteen inspected source bundles / 486 references');
 return sources;
}
if(require.main===module){const sources=build();if(process.argv[2]==='--emit-patch'){const data={reviewedAt:new Date().toISOString(),reviewBasis:'Current operator-linked PDFs inspected as complete rendered pages and Category B crops; factual labels/grouping only.',instructorApproved:false,sources};console.log('*** Begin Patch\n*** Add File: C:/Users/muham/Desktop/Driving Test Route/api/prisma/data/walloon-passage-sources-2026.json\n'+JSON.stringify(data,null,2).split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch');}else console.log(JSON.stringify(sources.map(s=>({slug:s.slug,points:s.points.length,groups:s.pointGroups.length,duplicates:s.points.filter(p=>p.duplicateOfSequence!==null).length}))));}
module.exports={build};
