// Synthetic only; never opens Waze, accesses GPS or calls a routing provider.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(file,mocks={}){const filename=path.resolve(__dirname,'..',file),m=new Module(filename,module);m.paths=module.paths;m.require=id=>id in mocks?mocks[id]:require(id);m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);return m.exports;}
const utils=load('lib/route-utils.ts');
const points=Array.from({length:25},(_,i)=>({latitude:50+i/1000,longitude:5}));
function render(links, locale = 'en') {
  const component = load('app/routes/GoogleMapsLinks.tsx', {
    '../../lib/useLocale': {useCurrentLocale: () => locale},
  }).default;
  return renderToStaticMarkup(React.createElement(component, {links, routeLabel: 'Route A'}));
}
test('Waze start link uses a fixed HTTPS destination with correct coordinate order and no credentials',()=>{
  const u=new URL(utils.wazeStartNavigationUrl({latitude:50.123,longitude:5.456}));
  assert.equal(u.origin,'https://www.waze.com');assert.equal(u.pathname,'/ul');
  assert.deepEqual([...u.searchParams.keys()],['ll','navigate','utm_source']);
  assert.equal(u.searchParams.get('ll'),'50.123,5.456');assert.equal(u.searchParams.get('navigate'),'yes');
  assert.equal(u.searchParams.get('utm_source'),'drivecoach');
});
test('Waze refuses missing or invalid coordinates, including non-numeric strings',()=>{
  for(const p of [null,undefined,{}, {latitude:NaN,longitude:5},{latitude:91,longitude:5},{latitude:50,longitude:181},{latitude:'50',longitude:5},{latitude:50,longitude:Infinity}])assert.equal(utils.wazeStartNavigationUrl(p),null);
  assert.ok(utils.wazeStartNavigationUrl({latitude:0,longitude:0}));
});
test('the Waze button receives the selected route start and no private location', () => {
  const links = utils.routeNavigationLinks(points);
  const html = render(links);
  assert.equal(new URL(links.wazeUrl).searchParams.get('ll'), '50,5');
  assert.match(html, /href="https:\/\/www\.waze\.com\/ul\?ll=50%2C5/);
  assert.match(html, /Navigate to start in Waze/);
  assert.match(html, /referrerPolicy="no-referrer"/i);
  assert.doesNotMatch(html, /target="_blank"|waze:\/\//);
  assert.equal(render(null), '');
  assert.match(render(links, 'nl'), /Naar startpunt met Waze/);
});
