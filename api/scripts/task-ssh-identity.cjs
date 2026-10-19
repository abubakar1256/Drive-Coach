// Explicit user-approved task key only. Never reads/changes personal SSH config.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const backupRoot=path.resolve(__dirname,'../../output/db-backups');
const dir=path.resolve(process.env.TASK_SSH_KEY_DIRECTORY||path.join(backupRoot,'temporary-ssh'));
if(!dir.startsWith(backupRoot+path.sep))throw Error('Task key directory must stay within ignored backup output');
const name=process.env.TASK_SSH_KEY_NAME||'drivecoach-phase2-temporary-20261018';
if(!/^drivecoach-phase[23]-[a-z0-9-]+$/.test(name))throw Error('Explicit task-only identity name required');
const receiptFile=path.join(dir,name.startsWith('drivecoach-phase3-')?'phase-three-key-receipt.json':'phase-two-key-receipt.json');
const key=path.join(dir,'railway-route-maintenance');
const cli=process.env.RAILWAY_CLI_PATH;
if(!cli)throw Error('Explicit official Railway CLI path required');
function api(query,variables){
 const r=cp.spawnSync(cli,['api','--compact','--variables',JSON.stringify(variables)],{input:query,encoding:'utf8',windowsHide:true,timeout:30000});
 if(r.status!==0||r.error)throw Error('Railway key operation failed; sensitive details omitted');
 const result=JSON.parse(r.stdout);if(result.errors)throw Error('Railway rejected the scoped key operation');return result.data??result;
}
const mode=process.argv[2];
if(mode==='register'){
 if(fs.existsSync(receiptFile))throw Error('Existing registration receipt must be reconciled, not overwritten');
 const publicKey=fs.readFileSync(`${key}.pub`,'utf8').trim();
 if(!publicKey.startsWith('ssh-ed25519 ')||publicKey.split(' ').length!==3||publicKey.split(' ')[2]!==name)throw Error('Unexpected task public key');
 const data=api('mutation Register($input:SshPublicKeyCreateInput!){sshPublicKeyCreate(input:$input){id name fingerprint}}',{input:{name,publicKey}}).sshPublicKeyCreate;
 fs.writeFileSync(receiptFile,JSON.stringify({...data,createdAt:new Date().toISOString()},null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({registered:data.name,id:data.id,fingerprint:data.fingerprint,revokeRequired:true}));
}else if(mode==='pin-host'){
 const target=path.join(dir,'known_hosts');if(fs.existsSync(target))throw Error('Existing pinned host file preserved; inspect before reuse');
 const scan=cp.spawnSync('C:/Windows/System32/OpenSSH/ssh-keyscan.exe',['-T','10','-t','ed25519','ssh.railway.com'],{encoding:'utf8',windowsHide:true,timeout:20000});
 const lines=scan.stdout?.split(/\r?\n/).filter(l=>/^ssh\.railway\.com ssh-ed25519 [A-Za-z0-9+/=]+$/.test(l));
 if(!lines?.length||new Set(lines).size!==1)throw Error('Could not obtain one consistent SSH relay host key');
 fs.writeFileSync(target,`${lines[0]}\n`,{flag:'wx',mode:0o600});
 const fingerprint=cp.spawnSync('C:/Windows/System32/OpenSSH/ssh-keygen.exe',['-lf',target],{encoding:'utf8',windowsHide:true});
 console.log(JSON.stringify({host:'ssh.railway.com',firstConnectionPin:fingerprint.stdout.trim(),strictHostChecking:true}));
}else if(mode==='revoke'){
 const receipt=JSON.parse(fs.readFileSync(receiptFile,'utf8'));
 if(receipt.name!==name||!receipt.id)throw Error('Unexpected registration receipt');
 if(receipt.revokedAt){console.log('Task SSH key was already revoked.');process.exit(0);}
 if(api('mutation Revoke($id:String!){sshPublicKeyDelete(id:$id)}',{id:receipt.id}).sshPublicKeyDelete!==true)throw Error('Task key revocation was not confirmed');
 fs.writeFileSync(receiptFile,JSON.stringify({...receipt,revokedAt:new Date().toISOString()},null,2),{mode:0o600});
 console.log(JSON.stringify({revoked:receipt.name,id:receipt.id}));
}else throw Error('Choose register, pin-host or revoke');
