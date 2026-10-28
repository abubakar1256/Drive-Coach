// Synthetic only; never opens Waze, accesses GPS or calls a routing provider.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(file,mocks={}){const filename=path.resolve(__dirname,'..',file),m=new Module(filename,module);m.paths=module.paths;m.require=id=>id in mocks?mocks[id]:require(id);m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);return m.exports;}
const utils=load('lib/route-utils.ts');
const points=Array.from({length:25},(_,i)=>({latitude:50+i/1000,longitude:5}));
function render(sections,locale='en',selected=0){const component=load('app/routes/GoogleMapsLinks.tsx',{'../../lib/route-utils':utils,'../../lib/useLocale':{useCurrentLocale:()=>locale},react:{...React,useState:()=>[selected,()=>{}]}}).default;return renderToStaticMarkup(React.createElement(component,{sections,routeLabel:'Route A'}));}
test('Waze start link uses a fixed HTTPS destination with correct coordinate order and no credentials',()=>{
  const u=new URL(utils.wazeStartNavigationUrl({latitude:50.123,longitude:5.456}));
  assert.equal(u.origin,'https://waze.com');assert.equal(u.pathname,'/ul');
  assert.deepEqual([...u.searchParams.keys()],['ll','navigate','utm_source']);
  assert.equal(u.searchParams.get('ll'),'50.123,5.456');assert.equal(u.searchParams.get('navigate'),'yes');
  assert.equal(u.searchParams.get('utm_source'),'drivecoach');
});
test('Waze refuses missing or invalid coordinates, including non-numeric strings',()=>{
  for(const p of [null,undefined,{}, {latitude:NaN,longitude:5},{latitude:91,longitude:5},{latitude:50,longitude:181},{latitude:'50',longitude:5},{latitude:50,longitude:Infinity}])assert.equal(utils.wazeStartNavigationUrl(p),null);
  assert.ok(utils.wazeStartNavigationUrl({latitude:0,longitude:0}));
});
test('Waze always points to the entire selected route start, independent of Google section selection',()=>{
  const sections=utils.googleMapsRouteSections(points),first=render(sections),last=render(sections,'en',5);
  const href=h=>h.match(/href="(https:\/\/waze\.com[^\"]+)"/)[1];
  assert.equal(href(first),href(last));assert.match(first,/Open in Waze/);assert.match(first,/Route A · To start point/);
  assert.match(first,/not the full practice loop/);assert.match(first,/safely parked/);assert.match(first,/noopener noreferrer/);
  assert.doesNotMatch(first,/waze:\/\//);
});
test('no Waze link is rendered for locked/empty sections or legacy sections without an authorized start',()=>{
  assert.equal(render([]),'');
  const sections=utils.googleMapsRouteSections(points).map(({startPoint,...s})=>s);
  assert.doesNotMatch(render(sections),/waze\.com/);
  assert.doesNotMatch(render(utils.googleMapsRouteSections(points).slice(1)),/waze\.com/);
});
test('Dutch Waze copy clearly limits navigation to the start point',()=>{
  const html=render(utils.googleMapsRouteSections(points),'nl');assert.match(html,/Openen in Waze/);assert.match(html,/Naar startpunt/);assert.match(html,/niet de volledige oefenronde/);
});
