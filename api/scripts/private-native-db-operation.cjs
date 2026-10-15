// Task-local identity and known-hosts; credentials never leave process memory.
const {spawn, spawnSync} = require('node:child_process');
const path = require('node:path');
const net = require('node:net');
const cli = process.env.RAILWAY_CLI_PATH;
const root = path.resolve(__dirname);
const target = path.resolve(process.argv[2] || '');
if (!cli || !target.startsWith(root + path.sep) || !target.endsWith('.cjs')) throw Error('Explicit CLI and maintenance-script paths required');
const project = '05b7486b-46a3-4fa5-9cb6-bdbe02e871d6';
const environment = 'd9734e0c-0ef6-406d-8104-815f5500de8c';
const service = 'd3f60050-9276-4b79-af8c-bc85e13803aa';
const key = path.resolve(root, '../../output/db-backups/temporary-ssh/railway-route-maintenance');
const known = path.join(path.dirname(key), 'known_hosts');
let tunnel, worker, timer, finished = false;
function finish(code, message) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  if (message) console.error(message);
  worker?.kill(); tunnel?.kill(); process.exitCode = code;
}
function api(args) {
  const result = spawnSync(cli, args, {encoding:'utf8', windowsHide:true, stdio:['ignore','pipe','pipe'], timeout:30000});
  if (result.error || result.status !== 0) throw Error('Railway read failed; sensitive output omitted');
  return result.stdout;
}
(async () => {
  const vars = JSON.parse(api(['variable','list','-p',project,'-e',environment,'-s',service,'--json']));
  const url = new URL(vars.DATABASE_URL);
  if (!url.hostname.endsWith('.railway.internal') || !['postgres:','postgresql:'].includes(url.protocol)) throw Error('Unexpected database destination');
  const config = api(['ssh','config','-p',project,'-e',environment,'-s',service,'-i',key,'--dry-run']);
  const host = config.match(/^\s*HostName\s+(\S+)/m)?.[1];
  const user = config.match(/^\s*User\s+(\S+)/m)?.[1];
  if (host !== 'ssh.railway.com' || !/^[a-f0-9-]{36}$/.test(user || '')) throw Error('Unexpected SSH destination');
  const port = 15439;
  await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(port,'127.0.0.1',()=>server.close(resolve));});
  tunnel = spawn('C:/Windows/System32/OpenSSH/ssh.exe', ['-T','-N','-o','BatchMode=yes','-o','ExitOnForwardFailure=yes','-o','ConnectTimeout=15','-o','StrictHostKeyChecking=yes','-o',`UserKnownHostsFile=${known}`,'-i',key,'-L',`127.0.0.1:${port}:127.0.0.1:${url.port || '5432'}`,`${user}@${host}`], {windowsHide:true,stdio:['ignore','pipe','pipe']});
  tunnel.on('error',()=>finish(1,'Private SSH could not start.'));
  tunnel.on('exit',()=>{if(!finished)finish(1,'Private SSH ended; operation stopped.');});
  timer = setTimeout(()=>finish(1,'Private operation timed out.'),900000);
  for(let attempt=0;attempt<60;attempt++) {
    if(finished)return;
    const ready=await new Promise(resolve=>{const socket=net.connect(port,'127.0.0.1');socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>resolve(false));});
    if(ready)break;
    if(attempt===59)throw Error('Private tunnel readiness timeout');
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  url.hostname='127.0.0.1';url.port=String(port);
  console.log('Private tunnel ready. Credentials remain in process memory.');
  worker=spawn(process.execPath,[target,...process.argv.slice(3)],{env:{...process.env,DATABASE_URL:url.toString(),PATH:`C:\\Program Files\\PostgreSQL\\17\\bin;${process.env.PATH || ''}`},windowsHide:true,stdio:['ignore','inherit','inherit']});
  worker.on('error',()=>finish(1,'Maintenance script could not start.'));
  worker.on('exit',code=>{worker=null;finish(code??1);});
})().catch(()=>finish(1,'Private database operation failed; sensitive details omitted.'));
process.on('SIGINT',()=>finish(1,'Private operation interrupted.'));
