// Fixed public operator URLs only. Cache evidence; never import or approve rows.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../output/chatbot-audit/operator-sources-20261020');
const sources=[
 ['sbat-category-b','https://www.sbat.be/rijbewijs/centra/type/praktijk-examen-rijbewijs-b'],
 ['sbat-sint-denijs-westrem','https://www.sbat.be/files/files/file/92.pdf'],
 ['sbat-eeklo','https://www.sbat.be/files/files/file/93.pdf'],
 ['sbat-brakel','https://www.sbat.be/files/files/file/94.pdf'],
 ['sbat-erembodegem','https://www.sbat.be/files/files/file/95.pdf'],
 ['sbat-sint-niklaas','https://www.sbat.be/files/files/file/96.pdf'],
 ['km-brugge','https://www.km.be/rijbewijs/examenlocatie/Brugge'],
 ['km-centres','https://www.km.be/rijbewijs/examencentra'],
 ['km-brugge-points','https://www.km.be/sites/default/files/2026-07/doorgangspunten%201012%20%202026%20-%202027.pdf'],
 ['aibv-asse','https://www.aibv.be/nl/examencentrum-asse-mollem'],
 ['aibv-asse-points','https://www.aibv.be/sites/default/files/uploads/Doorgangspunten%20categorie%20B%20vanaf%2001%2007%202026.pdf'],
 ['km-oostende','https://www.km.be/rijbewijs/examenlocatie/oostende'],
 ['km-roeselare','https://www.km.be/rijbewijs/examenlocatie/roeselare'],
 ['km-wevelgem','https://www.km.be/rijbewijs/examenlocatie/wevelgem'],
 ['km-oostende-points','https://www.km.be/sites/default/files/2026-07/doorgangspunten%201002%202026%20-2027.pdf'],
 ['km-roeselare-points','https://www.km.be/sites/default/files/2026-07/doorgangspunten%201010%202026-2027%20cat%20B.pdf'],
 ['km-wevelgem-points','https://www.km.be/sites/default/files/2026-07/doorgangspunten%201013%202026-2027.pdf'],
 ['autosecurite-brochures','https://www.autosecurite.be/fr/permis-de-conduire/brochures-videos/'],
 ['aibv-documents','https://www.aibv.be/nl/node/96'],
 ['aibv-walloon-passage-index','https://www.aibv.be/nl/node/160'],
 ['aibv-couillet-points','https://www.aibv.be/sites/default/files/uploads/Points%20de%20passage%202026-2027%20-%20Couillet.pdf'],
 ['aibv-braine-points','https://www.aibv.be/sites/default/files/uploads/Points%20de%20passage%202026-2027%20-%20Braine-le-Comte.pdf'],
 ['aibv-mariembourg-points','https://www.aibv.be/sites/default/files/uploads/Points%20de%20passage%202026-2027%20-%20Mariembourg.pdf'],
];
async function main(){
 fs.mkdirSync(root,{recursive:true});const results=[];
 for(const[name,url]of sources){
  const receipt=path.join(root,name+'.json');
  if(fs.existsSync(receipt)){const r=JSON.parse(fs.readFileSync(receipt,'utf8'));if(r.url!==url)throw Error('Cached source identity changed');results.push(r);continue;}
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(25000),redirect:'error',headers:{'User-Agent':'DriveCoach-PublicSourceReview/1.0'}});
   if(!response.ok)throw Error('HTTP_'+response.status);
   const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>20_000_000)throw Error('Source exceeds bounded size');
   const pdf=bytes.subarray(0,5).toString()==='%PDF-',file=path.join(root,name+(pdf?'.pdf':'.html'));
   const text=pdf?'':bytes.toString('utf8');
   const links=pdf?[]:[...text.matchAll(/(?:href|data-url|data-file)\s*=\s*["']([^"']+)["']/gi)].map(m=>{try{return new URL(m[1].replace(/&amp;/g,'&'),url).href;}catch{return '';}}).filter(u=>/^https:\/\//.test(u)&&/\.pdf(?:\?|$)|examenlocatie|centres.*examen|examencentra/.test(u));
   fs.writeFileSync(file,bytes,{flag:'wx'});
   const row={name,url,checkedAt:new Date().toISOString(),file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),kind:pdf?'PDF':'HTML',links:[...new Set(links)],automaticallyReviewed:false};
   fs.writeFileSync(receipt,JSON.stringify(row,null,2),{flag:'wx'});results.push(row);
  }catch(e){results.push({name,url,status:'UNAVAILABLE',reason:/^(HTTP_\d+|Source exceeds bounded size)$/.test(e.message)?e.message:'FETCH_FAILED',automaticallyReviewed:false});}
 }
 fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({checkedAt:new Date().toISOString(),sources:results,productionChanged:false},null,2));
 for(const r of results)console.log(JSON.stringify({name:r.name,kind:r.kind,status:r.status||'FETCHED',links:r.links}));
}
if(require.main===module)main().catch(()=>{console.error('Public evidence collection stopped.');process.exitCode=1;});
module.exports={sources};
