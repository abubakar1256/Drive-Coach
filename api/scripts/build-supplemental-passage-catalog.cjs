// Deterministic transcription of visually inspected operator PDFs. Emits a patch
// for review; never imports coordinates, approves locations or writes a database.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../output/chatbot-audit/operator-sources-20261020');
const plans=[
 ['sbat-sint-denijs-westrem','sint-denijs-westrem','Sint-Denijs-Westrem','SBAT','Poortakkerstraat 131, 9051 Sint-Denijs-Westrem','2026-07-01',40],
 ['sbat-eeklo','eeklo','Eeklo','SBAT','Industrielaan 15, 9900 Eeklo','2026-07-01',92],
 ['sbat-brakel','brakel','Brakel','SBAT','Industrielaan 8, 9660 Brakel','2026-07-01',27],
 ['sbat-erembodegem','erembodegem','Erembodegem','SBAT','Industrielaan 26, 9320 Erembodegem','2026-07-01',96],
 ['sbat-sint-niklaas','sint-niklaas','Sint-Niklaas','SBAT','Oostjachtpark 8, 9100 Sint-Niklaas','2025-07-01',65],
 ['aibv-asse-points','asse-mollem','Asse–Mollem','AIBV','Industriezone Z.5 Mollem 81, 1730 Asse-Mollem','2026-07-01',24],
 ['km-brugge-points','brugge','Brugge','KM','Monnikenwerve 204, 8000 Brugge','2026-07-01',60],
 ['km-oostende-points','oostende','Oostende','KM','Zandvoordestraat 442A, 8400 Oostende','2026-07-01',60],
 ['km-roeselare-points','roeselare','Roeselare','KM','Brugsesteenweg 366, 8800 Roeselare','2026-07-01',60],
 ['km-wevelgem-points','wevelgem','Wevelgem','KM','Noordstraat 3, 8560 Wevelgem','2026-07-01',60],
];
function build(){return plans.map(([key,slug,name,operatorName,address,revision,count])=>{
 const receipt=JSON.parse(fs.readFileSync(path.join(root,key+'.json'),'utf8')),extracted=JSON.parse(fs.readFileSync(path.join(root,key+'-extracted.json'),'utf8'));
 let labels=[],groups=[];
 if(operatorName==='SBAT')labels=extracted.pages.flatMap(p=>p.text.split('\n').filter(l=>l.trim()&&!/^Doorgangspunten examencentrum|^SBAT nv/.test(l))).map(l=>l.trim());
 else if(operatorName==='AIBV'){
  const lines=extracted.pages[0].text.split('\n').filter(l=>l.trim()&&!/^Doorgangspunten|^Examencentrum/.test(l));let group=0;
  for(const line of lines){const m=line.match(/^(\d+)\)\s+(.*)$/);if(m){group=Number(m[1]);labels.push(m[2]);groups.push([labels.length]);}else{labels.push(line.trim());groups[group-1].push(labels.length);}}
  if(groups.length!==8||groups.some(g=>g.length!==3))throw Error('Exact Asse 8 × 3 source grouping required');
 }else{
  const table=extracted.pages[0].tables.find(t=>t.some(r=>r.includes('Punt 1')));if(!table)throw Error('Printed point columns required');
  for(const row of table.slice(1)){
   // Brugge row 7 visibly overflows a narrow PDF cell; the extraction splits
   // the street across the number/point columns. Preserve the rendered cells.
   if(key==='km-brugge-points'&&row[2]==='Bla7nke'){
    labels.push('Blankenbergsesteenweg / St.Pietersmolenstraat','Oostendesteenweg/St.Pietersmolenstr.','Kluifrotonde');groups.push([labels.length-2,labels.length-1,labels.length]);continue;
   }
   if(!/^\d+$/.test(row[2]||''))continue;
   if(Number(row[2])!==groups.length+1)throw Error('Printed circuit order changed');
   const group=[];for(const value of row.slice(3,6)){if(!value?.trim())throw Error('Missing printed point');labels.push(value.replace(/\s*\n\s*/g,' ').trim().replace(/St-\s+Pieters/g,'St-Pieters').replace('B lankenbergsestwg','Blankenbergsestwg').replace('G r o enestraat','Groenestraat').replace('Fabrieksstra at','Fabrieksstraat').replace('Onledegoeds traat','Onledegoedstraat').replace('r o t R o tsestraat','rot Rotsestraat').replace('K a lkenstraat','Kalkenstraat').replace('W estlaan','Westlaan').replace('Lendeleedsestr aat','Lendeleedsestraat').replace('Bl.steenw eg.','Bl.steenweg.').replace('St - Pieters','St-Pieters'));group.push(labels.length);}groups.push(group);
  }
  if(groups.length!==20||groups.some(g=>g.length!==3))throw Error('Exact KM 20 × 3 source grouping required');
 }
 if(labels.length!==count)throw Error(key+': expected '+count+' printed references; found '+labels.length);
 const seen=new Map(),points=labels.map((junction,index)=>{const key=junction.toLocaleLowerCase('nl').replace(/\s+/g,' ').trim(),duplicateOfSequence=seen.get(key)??null;if(!seen.has(key))seen.set(key,index+1);return {sequence:index+1,municipality:'Not specified by operator',junction,duplicateOfSequence};});
 const centreSourceUrl=operatorName==='SBAT'?'https://www.sbat.be/rijbewijs/centra/'+slug:operatorName==='KM'?'https://www.km.be/rijbewijs/examenlocatie/'+slug:'https://www.aibv.be/nl/examencentrum-asse-mollem';
 return {slug,name,operatorName,address:operatorName==='KM'?'Consult the linked operator centre page for the current address. This is not a reviewed departure point.':address,centreSourceUrl,sourceUrl:receipt.url,sourceRevision:revision,sourceCheckedAt:receipt.checkedAt,sourceSha256:receipt.sha256,validUntil:operatorName==='KM'?'2027-06-30':null,points,pointGroups:groups,qualification:'Published names/grouping only. The operator does not supply exact coordinates for these references. Municipality is not inferred from the centre. Not a fixed examiner itinerary or reviewed location/entrance.'};
});}
if(require.main===module){
 try{const sources=build(),asset={reviewedAt:new Date().toISOString(),reviewBasis:'Operator-linked Category B PDF pages inspected as text and rendered pages; factual names and original grouping only.',instructorApproved:false,sources};
 if(process.argv[2]==='--emit-patch')console.log('*** Begin Patch\n*** Add File: C:/Users/muham/Desktop/Driving Test Route/api/prisma/data/supplemental-passage-sources.json\n'+JSON.stringify(asset,null,2).split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch');
 else console.log(JSON.stringify(sources.map(s=>({slug:s.slug,points:s.points.length,groups:s.pointGroups.length,duplicates:s.points.filter(p=>p.duplicateOfSequence!==null).length}))));
 }catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={build,plans};
