const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function fixture(){
 const previous={window:global.window,fetch:global.fetch},store=new Map([['routepilot.user',JSON.stringify({id:'account-a'})],['routepilot.accessToken','access-a'],['routepilot.refreshToken','refresh-a']]),events=[];
 global.window={sessionStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},dispatchEvent:e=>events.push(e.type)};
 const file=path.resolve(__dirname,'../lib/clientSession.ts'),m=new Module(file,module);m.paths=module.paths;m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
 return{session:m.exports,store,events,loginB:()=>{store.set('routepilot.user',JSON.stringify({id:'account-b'}));store.set('routepilot.accessToken','access-b');store.set('routepilot.refreshToken','refresh-b');},restore:()=>{global.window=previous.window;global.fetch=previous.fetch;}};
}
const response=(status,payload)=>({status,ok:status>=200&&status<300,json:async()=>payload});
test('same-account token refresh retries the request without an account-change/GPS reset event',async()=>{
 const f=fixture(),calls=[];try{global.fetch=async(url,init)=>{calls.push({url,init});if(url.endsWith('/auth/refresh'))return response(200,{accessToken:'fresh-a',refreshToken:'rotated-a'});return response(calls.length===1?401:200,{});};assert.equal((await f.session.authFetch('/private')).status,200);assert.deepEqual(f.events,['routepilot-session-refresh']);assert.equal(f.store.get('routepilot.accessToken'),'fresh-a');assert.equal(calls[2].init.headers.get('Authorization'),'Bearer fresh-a');}finally{f.restore();}
});
test('late successful refresh cannot overwrite a different account that logged in meanwhile',async()=>{
 const f=fixture();try{let resolve;global.fetch=()=>new Promise(r=>resolve=r);const pending=f.session.refreshClientSession();f.loginB();resolve(response(200,{accessToken:'stale-a',refreshToken:'stale-refresh-a'}));assert.equal(await pending,null);assert.equal(f.store.get('routepilot.accessToken'),'access-b');assert.equal(f.store.get('routepilot.refreshToken'),'refresh-b');assert.deepEqual(f.events,[]);}finally{f.restore();}
});
test('late failed refresh cannot log out a newer account',async()=>{
 const f=fixture();try{let resolve;global.fetch=()=>new Promise(r=>resolve=r);const pending=f.session.refreshClientSession();f.loginB();resolve(response(401,{}));assert.equal(await pending,null);assert.equal(f.store.get('routepilot.accessToken'),'access-b');assert.deepEqual(f.events,[]);}finally{f.restore();}
});
test('account switch while a request is pending rejects even a successful old-account response',async()=>{
 const f=fixture();try{let resolve,calls=0;global.fetch=()=>{calls++;return new Promise(r=>resolve=r);};const pending=f.session.authFetch('/private-owner-data');f.loginB();resolve(response(200,{private:'account-a'}));await assert.rejects(pending,f.session.SessionExpiredError);assert.equal(calls,1);assert.equal(f.store.get('routepilot.accessToken'),'access-b');}finally{f.restore();}
});
test('an old request cannot retry its action using the new account credentials',async()=>{
 const f=fixture();try{let resolve,calls=0;global.fetch=()=>{calls++;return new Promise(r=>resolve=r);};const pending=f.session.authFetch('/save-review',{method:'POST'});f.loginB();resolve(response(401,{}));await assert.rejects(pending,f.session.SessionExpiredError);assert.equal(calls,1);}finally{f.restore();}
});
test('logging out during refresh cannot resurrect a session',async()=>{
 const f=fixture();try{let resolve;global.fetch=()=>new Promise(r=>resolve=r);const pending=f.session.refreshClientSession();f.session.clearClientSession();resolve(response(200,{accessToken:'late-a',refreshToken:'late-r'}));assert.equal(await pending,null);assert.equal(f.store.get('routepilot.accessToken'),undefined);assert.deepEqual(f.events,['routepilot-auth-change']);}finally{f.restore();}
});
