// Stream the server-matched pg_dump over SSH; never export DB credentials.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const dir=path.resolve(__dirname,'../../output/db-backups');
const sshDir=path.resolve(process.env.TASK_SSH_KEY_DIRECTORY||path.join(dir,'temporary-ssh'));
if(!sshDir.startsWith(dir+path.sep))throw Error('Task key directory must stay within ignored backup output');
const target=path.join(dir,`drive-coach-pg18-${new Date().toISOString().replace(/[:.]/g,'-')}.dump`);
fs.mkdirSync(dir,{recursive:true});
const fd=fs.openSync(target,'wx',0o600);
const remote='PGHOST=127.0.0.1 PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD" PGDATABASE="$POSTGRES_DB" pg_dump --format=custom --no-owner --no-acl';
const child=spawn('C:/Windows/System32/OpenSSH/ssh.exe',['-T','-o','BatchMode=yes','-o','ConnectTimeout=15','-o','StrictHostKeyChecking=yes','-o',`UserKnownHostsFile=${path.join(sshDir,'known_hosts')}`,'-i',path.join(sshDir,'railway-route-maintenance'),'78b5d84e-292c-405f-91c7-142fd8008318@ssh.railway.com',remote],{windowsHide:true,stdio:['ignore',fd,'pipe']});
fs.closeSync(fd);
child.stderr.resume();
const timer=setTimeout(()=>child.kill(),300000);
child.on('error',()=>{clearTimeout(timer);console.error('Private backup could not start; details omitted.');process.exitCode=1;});
child.on('exit',code=>{
 clearTimeout(timer);
 if(code!==0){console.error('Private backup failed; incomplete archive must not be used.');process.exitCode=1;return;}
 const bytes=fs.readFileSync(target);
 if(bytes.subarray(0,5).toString()!=='PGDMP'){console.error('Invalid backup archive header.');process.exitCode=1;return;}
 const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 fs.writeFileSync(`${target}.sha256`,`${sha256}\n`,{flag:'wx',mode:0o600});
 console.log(JSON.stringify({archive:target,bytes:bytes.length,sha256,restoreTestRequired:true},null,2));
});
