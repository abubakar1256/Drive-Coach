const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const React=require('react');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const nodes=tree=>Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];
const text=tree=>Array.isArray(tree)?tree.map(text).join(''):tree&&typeof tree==='object'?text(tree.props?.children):typeof tree==='string'||typeof tree==='number'?String(tree):'';
function harness(){
 const states=[],refs=[],calls=[],watches=[],cleared=[],tracking=[],positions=[];let cursor=0,refCursor=0;
 const Dialog=()=>null;
 const oldWindow=global.window,oldNavigator=Object.getOwnPropertyDescriptor(global,'navigator');
 global.window={location:{search:''},sessionStorage:{getItem:()=> 'fixture-token'}};
 Object.defineProperty(global,'navigator',{configurable:true,value:{geolocation:{watchPosition:(ok,error)=>{watches.push({ok,error});return watches.length;},clearWatch:id=>cleared.push(id)}}});
 const filename=path.resolve(__dirname,'../app/routes/PracticeControls.tsx'),loaded=new Module(filename,module);loaded.paths=module.paths;
 const mocks={
  react:{...React,useEffect:()=>{},useRef:initial=>{const i=refCursor++;return refs[i]??=( {current:initial} );},useState:initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];}},
  'next/navigation':{useRouter:()=>({push:()=>{}})},
  'next/link':{__esModule:true,default:props=>React.createElement('a',props)},
  './DrivePreparation':{__esModule:true,default:()=>null},
  '../../lib/clientSession':{authFetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.endsWith('/track')?{completionPct:23}:{id:'test-session',routeId:'route-a',completionPct:0}};}},
  '../../lib/i18n':{isLocale:()=>true},
  '../../lib/useLocale':{useSiteCopy:()=>({route:{startPractice:'Start practice',completePractice:'Complete practice',enableGps:'Enable optional GPS tracking',stopGps:'Stop GPS tracking',gpsEnabled:'GPS tracking enabled',locationUnsupported:'GPS not supported'}})},
  '../../lib/route-progression':{confirmedRouteCompletion:()=>false},
  './NextRoutePrompt':{__esModule:true,default:()=>null},'./GoogleMapsLinks':{__esModule:true,default:()=>null},'./GpsConsentDialog':{__esModule:true,default:Dialog},
 };
 loaded.require=id=>mocks[id]??require(id);
 loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
 let tree;
 function render(){cursor=0;refCursor=0;tree=loaded.exports.default({routeLabel:'Route A',nextRoute:null,centreSlug:'alken',paidCentreAccess:false,practiceReady:true,routeId:'route-a',routeSlug:'alken-a',onPositionUpdate:p=>positions.push(p),onTrackingChange:v=>tracking.push(v)});return tree;}
 render();
 return {calls,watches,cleared,tracking,positions,render,dialog:()=>nodes(tree).find(n=>n.type===Dialog).props,button:label=>nodes(tree).find(n=>n.type==='button'&&text(n).includes(label)),text:()=>text(tree),progress:()=>nodes(tree).find(n=>n.type==='progress').props.value,restore:()=>{global.window=oldWindow;if(oldNavigator)Object.defineProperty(global,'navigator',oldNavigator);else delete global.navigator;}};
}
test('Start opens consent first; cancel performs no session or location request',()=>{
 const h=harness();try{h.button('Start practice').props.onClick();h.render();assert.equal(h.dialog().open,true);assert.equal(h.calls.length,0);assert.equal(h.watches.length,0);h.dialog().onClose();h.render();assert.equal(h.dialog().open,false);assert.equal(h.calls.length,0);}finally{h.restore();}
});
test('continue without GPS starts practice without requesting or collecting location',async()=>{
 const h=harness();try{h.button('Start practice').props.onClick();h.render();h.dialog().onWithoutGps();await flush();h.render();assert.equal(h.calls.length,1);assert.equal(h.watches.length,0);assert.equal(h.progress(),0);assert.match(h.text(),/No location points are being collected/);}finally{h.restore();}
});
test('GPS becomes live only after a real position; stopped callbacks cannot upload data',async()=>{
 const h=harness();try{
  h.button('Start practice').props.onClick();h.render();h.dialog().onEnable();await flush();h.render();
  assert.equal(h.watches.length,1);assert.equal(h.tracking.length,0);assert.match(h.text(),/Waiting for location permission/);assert.doesNotMatch(h.text(),/GPS tracking enabled/);
  const position={coords:{latitude:50,longitude:5,accuracy:8,speed:null}};
  h.watches[0].ok(position);await flush();h.render();assert.equal(h.positions.length,1);assert.equal(h.tracking.at(-1),true);assert.equal(h.progress(),23);
  h.button('Stop GPS tracking').props.onClick();h.render();const before=h.calls.length;h.watches[0].ok(position);await flush();assert.equal(h.calls.length,before);assert.equal(h.tracking.at(-1),false);assert.equal(h.cleared.length,1);
 }finally{h.restore();}
});
for(const [code,expected] of [[1,/Location permission denied/],[2,/location is unavailable/],[3,/GPS request timed out/]])test(`GPS error ${code} has its own message and stops tracking`,async()=>{
 const h=harness();try{h.button('Start practice').props.onClick();h.render();h.dialog().onEnable();await flush();h.watches[0].error({code});h.render();assert.match(h.text(),expected);assert.equal(h.tracking.at(-1),false);assert.equal(h.progress(),0);assert.equal(h.positions.length,0);}finally{h.restore();}
});
