// Copies only fixed, public operator PDFs downloaded through the normal browser.
// Never reads browser credentials/cookies, approves locations or writes a database.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../output/chatbot-audit/operator-sources-20261020');
const downloads='C:/Users/muham/Downloads';
const plans=[['1007','namur-suarlee','2500611','2025/07'],['1009','liege-wandre','2500611','2025/07'],['1011','tournai-marquain','2500611','2025/07'],['1025','louvain-la-neuve','2300521','2025/07'],['1026','marche-en-famenne','2300521','2026/01'],['1027','huy-tihange','2500611','2025/07'],['1028','bastogne','2500611','2025/07'],['1029','eupen-lontzen','2500611','2025/07'],['1030','lobbes','2500611','2025/07'],['1031','mons-cuesmes','2500611','2025/07'],['1032','arlon-weyler','2500611','2025/07']];
function main(){
 if(process.argv[2]!=='--adopt-public-downloads')throw Error('Explicit public-download adoption required');
 fs.mkdirSync(root,{recursive:true});
 for(const[id,slug,prefix,directory]of plans){
  const basename=`${prefix}-Circuits-permis-de-conduire-${id}.pdf`,name='autosecurite-'+slug,source=path.join(downloads,basename),target=path.join(root,name+'.pdf'),receipt=path.join(root,name+'.json');
  const bytes=fs.readFileSync(source);if(bytes.length>2000000||bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Expected bounded public PDF');
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  if(fs.existsSync(receipt)){if(JSON.parse(fs.readFileSync(receipt,'utf8')).sha256!==sha256)throw Error('Previously adopted source changed');continue;}
  if(fs.existsSync(target))throw Error('Unreceipted PDF preserved for inspection');
  fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);
  const row={name,url:`https://www.autosecurite.be/uploads/${directory}/${basename}`,sourcePage:'https://www.autosecurite.be/fr/permis-de-conduire/brochures-videos/',checkedAt:new Date().toISOString(),file:target,bytes:bytes.length,sha256,kind:'PDF',links:[],automaticallyReviewed:false};
  fs.writeFileSync(receipt,JSON.stringify(row,null,2),{flag:'wx'});console.log(JSON.stringify({name,bytes:bytes.length,sha256,automaticallyReviewed:false}));
 }
}
module.exports={plans};if(require.main===module)main();
