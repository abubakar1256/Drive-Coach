const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(file,mocks={}){
 const filename=path.resolve(__dirname,'..',file),m=new Module(filename,module);m.paths=module.paths;m.require=id=>mocks[id]??require(id);
 m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);return m.exports;
}
const offers=load('lib/plan-offers.ts');
const planAccess=load('lib/plan-access.ts');
const data=['Basic','Premium'].flatMap((name,t)=>[24,168,720,2160].map((durationHours,i)=>({id:`${name}-${i}`,name,durationHours,priceCents:(t?[300,600,900,1200]:[200,400,600,800])[i],currency:'EUR',purchasable:true})));
test('unconfigured, inactive, zero and missing prices cannot become a checkout price',()=>{
 for(const offer of [undefined,{priceCents:null,purchasable:true},{priceCents:0,purchasable:true},{priceCents:200,purchasable:false}])assert.equal(offers.offerPrice(offer),null);
 assert.match(offers.offerPrice(data[0]),/2\.00/);
 assert.deepEqual(offers.accessPeriods.map(p=>p.hours),[24,168,720,2160]);
});
test('pricing renders approved prices for each period and no retired Diamond product',()=>{
 for(const hours of [24,168,720,2160]){
  const values=[hours,data];
  const Pricing=load('app/PricingPlans.tsx',{'react':{...React,useEffect:()=>{},useState:()=>[values.shift(),()=>{}]},'../lib/useLocale':{useCurrentLocale:()=> 'en'},'./PlanAccess':{usePlanAccess:()=>({state:'signed-out',plan:'Free'})},'../lib/plan-access':planAccess,'../lib/plan-offers':offers}).default;
  const html=renderToStaticMarkup(React.createElement(Pricing));
  for(const tier of ['Free','Basic','Premium'])assert.match(html,new RegExp(`<h3>${tier}</h3>`));
  for(const tier of ['Basic','Premium'])assert.ok(html.includes(offers.offerPrice(data.find(p=>p.name===tier&&p.durationHours===hours))));
  assert.doesNotMatch(html,/Diamond|14\.99|19\.99|Route A free at every centre/);
  assert.match(html,new RegExp(`period=${hours}`));assert.match(html,/single 24-hour trial per account/);
 }
});
const link={__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
function renderTrial(trial,state='ready',plan='Free'){
 const Trial=load('app/routes/RouteTrialAccess.tsx',{'next/link':link,'../PlanAccess':{usePlanAccess:()=>({state,plan,subscription:{trial}})},'../../lib/useLocale':{useCurrentLocale:()=> 'en'},'../../lib/clientSession':{}}).default;
 return renderToStaticMarkup(React.createElement(Trial,{routeId:'route-a',routeSlug:'route-a'}));
}
test('trial requires explicit confirmation, sign-in and one account-wide selected route',()=>{
 assert.match(renderTrial({available:true}),/Start my 24-hour route trial/);
 assert.match(renderTrial({available:true}),/cannot switch routes/);
 assert.doesNotMatch(renderTrial({available:true},'signed-out'),/Start my 24-hour route trial/);
 assert.match(renderTrial({available:false,active:true,routeId:'route-b',routeSlug:'route-b'}),/href="\/routes\/route-b"/);
 assert.doesNotMatch(renderTrial({available:false,active:true,routeId:'route-b'}),/Start my 24-hour route trial/);
 assert.match(renderTrial({available:false,active:false}),/one-time trial has ended/);
 assert.equal(renderTrial({available:true},'ready','Basic'),'');
 assert.equal(renderTrial({available:true},'ready','Premium'),'');
});
test('trial POST is explicit and refreshes shared access only after a successful claim',async()=>{
 const previousWindow=global.window;const calls=[],events=[];global.window={dispatchEvent:e=>events.push(e.type)};
 try{
  const Trial=load('app/routes/RouteTrialAccess.tsx',{'react':{...React,useState:init=>[init,()=>{}]},'next/link':link,'../PlanAccess':{usePlanAccess:()=>({state:'ready',plan:'Free',subscription:{trial:{available:true}}})},'../../lib/useLocale':{useCurrentLocale:()=> 'en'},'../../lib/clientSession':{authFetch:async(...args)=>{calls.push(args);return{ok:true,json:async()=>({id:'trial'})};}}}).default;
  const tree=Trial({routeId:'route-a',routeSlug:'route-a'});
  function findButton(node){if(!node||typeof node!=='object')return null;if(node.type==='button')return node;return React.Children.toArray(node.props?.children).map(findButton).find(Boolean);}
  assert.equal(calls.length,0);await findButton(tree).props.onClick();await new Promise(setImmediate);
  assert.equal(calls.length,1);assert.equal(calls[0][1].method,'POST');assert.deepEqual(JSON.parse(calls[0][1].body),{routeId:'route-a'});assert.deepEqual(events,['routepilot-auth-change']);
 }finally{global.window=previousWindow;}
});
test('centre cards never infer free access from catalogue order',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../app/centres/CentreRouteCatalog.tsx'),'utf8');
 assert.doesNotMatch(source,/isFree\s*\?\?|unlocked = free \|\|/);assert.match(source,/Boolean\(accessible && route.canAccess\)/);
});
test('route expiry clears the full route, maps, coach state and GPS controls',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../app/routes/RouteExperience.tsx'),'utf8');
 assert.match(source,/expiresAt.*setTimeout|setTimeout\(sync/);
 assert.match(source,/setActiveCentre\(centre\); setDriving\(initialDriving\); setAccessMode\("preview"\)/);
 for(const component of ['RouteCoach','PracticeControls'])assert.ok(source.includes(`<${component} key={\x60\${routeSlug}-\${accessMode}-\${hasVoiceAccess}\x60}`));
 assert.match(source,/clearTimeout\(expiryTimer\)/);
});
test('first-party images/videos use authenticated fetch, not bearer tokens in URLs',async()=>{
 const effects=[],calls=[];
 const Media=load('app/routes/RoutePointMedia.tsx',{'react':{...React,useEffect:fn=>effects.push(fn),useState:()=>[null,()=>{}]},'./DrivingIllustration':{__esModule:true,default:()=>null},'../../lib/clientSession':{authFetch:async(...args)=>{calls.push(args);return{ok:false};}}});
 for(const url of ['javascript:alert(1)','https://user:password@example.com/a.png','/api/v1/media/../../secret'])assert.equal(Media.safeMediaUrl(url),null);
 const html=renderToStaticMarkup(React.createElement(Media.default,{point:{title:'Test',imageUrl:'/api/v1/media/asset-123'}}));
 assert.doesNotMatch(html,/src=.*\/api\/v1\/media/);
 const cleanup=effects.map(fn=>fn());await new Promise(setImmediate);
 assert.equal(calls[0][0],'/api/v1/media/asset-123');assert.equal(calls[0][1].cache,'no-store');cleanup.forEach(fn=>fn?.());
});
