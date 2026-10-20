// Stream the server-matched pg_dump over SSH; never export DB credentials.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn,spawnSync}=require('node:child_process');
const dir=path.resolve(__dirname,'../../output/db-backups');
const sshDir=path.resolve(process.env.TASK_SSH_KEY_DIRECTORY||path.join(dir,'temporary-ssh'));
if(!sshDir.startsWith(dir+path.sep))throw Error('Task key directory must stay within ignored backup output');
const cli=process.env.RAILWAY_CLI_PATH;
if(!cli)throw Error('Explicit official Railway CLI path required');
const config=spawnSync(cli,['ssh','config','-p','05b7486b-46a3-4fa5-9cb6-bdbe02e871d6','-e','d9734e0c-0ef6-406d-8104-815f5500de8c','-s','d3f60050-9276-4b79-af8c-bc85e13803aa','-i',path.join(sshDir,'railway-route-maintenance'),'--dry-run'],{encoding:'utf8',windowsHide:true,timeout:30000});
const host=config.stdout?.match(/^\s*HostName\s+(\S+)/m)?.[1],user=config.stdout?.match(/^\s*User\s+(\S+)/m)?.[1];
if(config.status!==0||host!=='ssh.railway.com'||!/^[a-f0-9-]{36}$/.test(user||''))throw Error('Current private database SSH destination could not be verified');
const target=path.join(dir,`drive-coach-pg18-${new Date().toISOString().replace(/[:.]/g,'-')}.dump`);
fs.mkdirSync(dir,{recursive:true});
const fd=fs.openSync(target,'wx',0o600);
const remote='PGHOST=127.0.0.1 PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD" PGDATABASE="$POSTGRES_DB" pg_dump --format=custom --no-owner --no-acl';
const child=spawn('C:/Windows/System32/OpenSSH/ssh.exe',['-T','-o','BatchMode=yes','-o','ConnectTimeout=15','-o','StrictHostKeyChecking=yes','-o',`UserKnownHostsFile=${path.join(sshDir,'known_hosts')}`,'-i',path.join(sshDir,'railway-route-maintenance'),`${user}@${host}`,remote],{windowsHide:true,stdio:['ignore',fd,'pipe']});
fs.closeSync(fd);
let failureClass='details omitted';
child.stderr.on('data',bytes=>{const message=bytes.toString();for(const [pattern,label]of [[/Permission denied/i,'SSH identity rejected'],[/Host key verification failed/i,'pinned host verification failed'],[/timed out/i,'connection timeout'],[/not found/i,'remote backup tool unavailable']])if(pattern.test(message))failureClass=label;});
const timer=setTimeout(()=>child.kill(),300000);
child.on('error',()=>{clearTimeout(timer);console.error('Private backup could not start; details omitted.');process.exitCode=1;});
child.on('exit',code=>{
 clearTimeout(timer);
 if(code!==0){console.error(`Private backup failed (${failureClass}); incomplete archive must not be used.`);process.exitCode=1;return;}
 const bytes=fs.readFileSync(target);
 if(bytes.subarray(0,5).toString()!=='PGDMP'){console.error('Invalid backup archive header.');process.exitCode=1;return;}
 const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 fs.writeFileSync(`${target}.sha256`,`${sha256}\n`,{flag:'wx',mode:0o600});
 console.log(JSON.stringify({archive:target,bytes:bytes.length,sha256,restoreTestRequired:true},null,2));
});
