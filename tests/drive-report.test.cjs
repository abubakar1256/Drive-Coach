const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const fixture={id:'fixture',route:{name:'Route A',slug:'a'},ended:true,startedAt:'2026-10-15T10:00:00Z',completedAt:'2026-10-15T10:30:00Z',durationSec:1800,completionPct:40,truncated:false,gps:{sampleCount:0,usableSamples:0,weakSamples:0,gaps:0,coveragePct:0,distanceM:0,maxSpeedKph:null,confidence:'low'},points:{total:25,visited:10,unconfirmed:15},events:[],review:null,geometry:[[5,50],[5.01,50.01]],track:[],limitations:['No official pass/fail score.']};
function load(file,mocks){const filename=path.resolve(__dirname,'..',file),m=new Module(filename,module);m.paths=module.paths;m.require=id=>id.endsWith(".css")?{}:mocks[id]??require(id);m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);return m.exports;}
const nodes=t=>Array.isArray(t)?t.flatMap(nodes):t&&typeof t==='object'?[t,...nodes(t.props?.children)]:[];
const text=t=>Array.isArray(t)?t.map(text).join(''):t&&typeof t==='object'?text(t.props?.children):typeof t==='string'||typeof t==='number'?String(t):'';
const flush=()=>new Promise(r=>setImmediate(r));
function harness(report=fixture,options={}){
 const states=[report,{source:'self',ratings:{},notes:''},'', '',false,false,'overview'];let cursor=0,tree,calls=[];
 const component=load('app/practice/DriveReport.tsx',{
  react:{...React,useEffect:()=>{},useRef:()=>({current:0}),useState:init=>{const i=cursor++;if(!(i in states))states[i]=init;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];}},
  'next/link':{__esModule:true,default:props=>React.createElement('a',props)},
  'next/navigation':{useRouter:()=>({replace:()=>{}})},
  '../../lib/usePracticeStatus':{notifyPracticeChange:()=>{}},
  '../../lib/clientSession':{SessionExpiredError:class extends Error{},authFetch:async(url,init)=>{calls.push({url,init});return{ok:options.ok!==false,status:options.status??(options.ok===false?503:200),json:async()=>{const b=JSON.parse(init.body);const review={source:b.source,ratings:b.ratings,notes:b.notes,savedAt:"2026-11-02T10:00:00.000Z"};return{review,reviews:[review]};}};}}
 }).default;
 function render(){cursor=0;tree=component({sessionId:'fixture'});return tree;}render();
 return{states,calls,render,html:()=>renderToStaticMarkup(tree),button:label=>nodes(tree).find(n=>n.type==='button'&&text(n).includes(label)),nodes:()=>nodes(tree)};
}
test('empty GPS report stays honest about missing evidence and unconfirmed points',()=>{const h=harness();const html=h.html();assert.match(html,/Insufficient GPS data/);assert.match(html,/15 · may reflect gaps/);assert.match(html,/Not assessed · no verified limit data/);assert.doesNotMatch(html,/passed|mistake-free drive confirmed/i);});
test('manual checklist defaults to not assessed, with source and safety gate',()=>{const h=harness();h.button('Instructor / self checklist').props.onClick();h.render();assert.equal(h.nodes().filter(n=>n.type==='button'&&n.props['aria-pressed']&&text(n)==='Not assessed').length,12);assert.equal(h.button('Save session checklist').props.disabled,true);assert.match(h.html(),/does not verify the instructor/);});
test('active session cannot save checklist even by directly calling button handler',async()=>{const h=harness({...fixture,ended:false});h.states[6]='checklist';h.states[5]=true;h.render();assert.equal(h.nodes().find(n=>n.type==='fieldset').props.disabled,true);h.button('Save session checklist').props.onClick();await flush();assert.equal(h.calls.length,0);});
test('saved instructor-reported checklist sends no fabricated GPS observations',async()=>{const h=harness();h.states[6]='checklist';h.states[5]=true;h.states[1]={source:'instructor_reported',ratings:{mirrors:'practice',signals:'good'},notes:'Review mirrors'};h.render();h.button('Save session checklist').props.onClick();await flush();h.render();assert.equal(h.calls.length,1);assert.equal(h.calls[0].url,'/api/v1/practice-sessions/fixture/review');assert.deepEqual(JSON.parse(h.calls[0].init.body),{source:"instructor_reported",ratings:{mirrors:"practice",signals:"good"},notes:"Review mirrors",parked:true,expectedSavedAt:null});assert.equal(h.states[1].savedAt,"2026-11-02T10:00:00.000Z");assert.match(h.html(),/Feedback saved/);h.states[6]='overview';h.render();assert.match(h.html(),/Review mirrors|Build a consistent mirror-check routine/);});
test('failed save retains checklist and does not claim persistence',async()=>{const h=harness(fixture,{ok:false});h.states[6]='checklist';h.states[5]=true;h.states[1]={source:'self',ratings:{signals:'practice'},notes:'Keep this draft'};h.render();h.button('Save session checklist').props.onClick();await flush();h.render();assert.match(h.html(),/Could not save checklist/);assert.equal(h.states[1].notes,'Keep this draft');assert.equal(h.states[0].review,null);});
test('loading and errors do not display a previous report',()=>{const h=harness(null);assert.match(h.html(),/Loading your private/);h.states[2]='Report not found';h.render();assert.match(h.html(),/Report unavailable/);assert.doesNotMatch(h.html(),/Your strengths/);});
test('pre-drive component does not promise automatic traffic-law or braking detection',()=>{const component=load('app/routes/DrivePreparation.tsx',{react:React}).default;const html=renderToStaticMarkup(React.createElement(component,{active:true,feedback:{status:'possible_deviation',distanceFromRouteM:80,speedKph:30},paid:false}));assert.match(html,/Not a confirmed driving mistake/);assert.match(html,/overspeed, braking and acceleration are not assessed/);assert.doesNotMatch(html,/Play preparation reminder/);});


test('switching feedback sources retains independent unsaved drafts without a save request',()=>{
 const self={source:'self',ratings:{signals:'good'},notes:'Saved self',savedAt:'2026-11-01T10:00:00Z'},instructor={source:'instructor_reported',ratings:{mirrors:'practice'},notes:'Saved supervisor',savedAt:'2026-11-01T10:01:00Z'};
 const h=harness({...fixture,review:instructor,reviews:[self,instructor]});h.states[1]={...self,notes:'Unsaved learner draft'};h.states[6]='checklist';h.render();
 const source=()=>h.nodes().find(n=>n.type==='select');source().props.onChange({target:{value:'instructor_reported'}});h.render();assert.equal(h.states[1].notes,'Saved supervisor');
 h.nodes().find(n=>n.type==='textarea').props.onChange({target:{value:'Unsaved supervisor draft'}});h.render();source().props.onChange({target:{value:'self'}});h.render();assert.equal(h.states[1].notes,'Unsaved learner draft');source().props.onChange({target:{value:'instructor_reported'}});h.render();assert.equal(h.states[1].notes,'Unsaved supervisor draft');assert.equal(h.calls.length,0);
});
test('stale checklist conflict retains edits and never claims a successful save',async()=>{
 const previous={source:'self',ratings:{signals:'good'},notes:'Saved',savedAt:'2026-11-01T10:00:00Z'};const h=harness({...fixture,review:previous,reviews:[previous]},{ok:false,status:409});h.states[1]={...previous,notes:'Keep my conflicting edit'};h.states[6]='checklist';h.states[5]=true;h.render();h.button('Save session checklist').props.onClick();await flush();h.render();assert.equal(h.states[1].notes,'Keep my conflicting edit');assert.deepEqual(h.states[0].review,previous);assert.match(h.html(),/another tab/);assert.doesNotMatch(h.html(),/Feedback saved/);assert.equal(JSON.parse(h.calls[0].init.body).expectedSavedAt,previous.savedAt);
});
