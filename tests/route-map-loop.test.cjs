// Synthetic Mapbox/DOM only: no browser permissions, tokens, routes or spend.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function load(file,mocks={}){const f=path.resolve(__dirname,'..',file),m=new Module(f,module);m.paths=module.paths;m.require=id=>id in mocks?mocks[id]:require(id);m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);return m.exports;}
test('closed map has one shared start/finish, hidden shaping markers and direction arrows on real geometry',()=>{
  const originalDocument=global.document,originalToken=process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const effects=[],maps=[],markers=[];let refs=0;
  const element=()=>({children:[],classList:{toggle(){}},setAttribute(k,v){this[k]=v;},addEventListener(){},appendChild(c){this.children.push(c);}});
  class Map {constructor(){this.layers=[];this.sources={};maps.push(this);}on(_,fn){this.load=fn;}addSource(id,s){this.sources[id]=s;}addLayer(l){this.layers.push(l);}fitBounds(){}getSource(){return undefined;}remove(){}}
  class Marker {constructor({element}){this.element=element;markers.push(this);}setLngLat(c){this.position=c;return this;}addTo(){return this;}getElement(){return this.element;}remove(){}}
  class Bounds {extend(){return this;}}
  try{
    global.document={createElement:element};process.env.NEXT_PUBLIC_MAPBOX_TOKEN='test-not-a-real-token';
    const hooks={useRef:v=>({current:refs++===0?{}:v}),useState:v=>[v,()=>{}],useEffect:fn=>effects.push(fn)};
    const utils=load('lib/route-utils.ts'),component=load('app/routes/MapboxRouteMap.tsx',{react:hooks,'mapbox-gl':{Map,Marker,LngLatBounds:Bounds},'../../lib/useLocale':{useCurrentLocale:()=> 'en'},'../../lib/route-utils':utils}).default;
    const geometry=[[5,50],[5,50.01],[5.01,50.01],[5.01,50],[5,50]],points=geometry.map(([longitude,latitude])=>({longitude,latitude}));
    component({centre:{routePoints:points,routeCoordinates:geometry,roadGeometry:geometry},selectedIndex:0,onSelect(){},livePosition:null,liveTrack:[],tracking:false});
    effects.forEach(fn=>fn());maps[0].load();
    assert.equal(markers.length,4);assert.equal(markers.filter(m=>m.element['aria-label']==='START / FINISH').length,1);
    assert.equal(markers.filter(m=>m.element.hidden).length,3);
    const arrows=maps[0].layers.find(l=>l.id==='practice-route-direction');assert.equal(arrows.layout['symbol-placement'],'line');assert.equal(arrows.layout['text-keep-upright'],false);
    assert.deepEqual(maps[0].sources['practice-route'].data.features[0].geometry.coordinates,geometry);
  }finally{global.document=originalDocument;if(originalToken===undefined)delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;else process.env.NEXT_PUBLIC_MAPBOX_TOKEN=originalToken;}
});
