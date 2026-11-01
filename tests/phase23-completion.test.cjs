const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function load(file,mocks){const target=path.join(__dirname,'..',file),m=new Module(target,module);m.filename=target;m.paths=Module._nodeModulePaths(path.dirname(target));const original=m.require.bind(m);m.require=name=>name.endsWith('.css')?{}:Object.prototype.hasOwnProperty.call(mocks,name)?mocks[name]:original(name);m._compile(ts.transpileModule(fs.readFileSync(target,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,target);return m.exports.default;}
const locale={'../../lib/useLocale':{useCurrentLocale:()=> 'en'}};
test('reflection dashboard distinguishes chosen/suggested workload and exposes explicit denominators',()=>{
 const Component=load('app/dashboard/ReflectionTrends.tsx',{...locale,'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)}});
 const trend={sessionCount:8,windowDays:90,recentSessionCount:6,previousSessionCount:2,selectedLevel:'DIFFICULT',suggestedLevel:'BEGINNER',reason:'Repeated reported difficulties.',limitation:'Reported preparation only; your chosen level and access stay unchanged.',skills:[{code:'roundabouts',status:'RECURRING',recentDifficultySessions:3,previousDifficultySessions:1,recentGoodSessions:1,assessedSessions:5,basis:['SELF_REPORTED','INSTRUCTOR_REPORTED']}]};
 const html=renderToStaticMarkup(React.createElement(Component,{trend}));
 for(const text of ['8/12','3/6','1/2','Recurring preparation focus','Difficult','Beginner','self-reported','instructor-reported','preparation-profile-heading','unchanged'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/passed your exam|driving score|<form/);
});
test('public source coverage displays reviewed-versus-linked gaps without promising that points are mandatory',()=>{
 const data={sourceAvailable:true,distinctSourceEntryCount:32,reviewedPointCount:32,coveredPointCount:2,uncoveredReviewedPointCount:30,pendingPointCount:0,coveragePercent:6,sourceLinkedRouteCount:1,publishedRouteCount:5,staleSourceRouteCount:0,complete:false,limitation:'No fresh driving check or mandatory exam-point claim.'};
 const hooks={...React,useState:initial=>[initial===null?data:initial,()=>{}],useEffect:()=>{}};
 const Component=load('app/centres/PassageCoverage.tsx',{...locale,react:hooks,'../../lib/clientSession':{authFetch:()=>{throw Error('NO NETWORK DURING RENDER');}}});
 const html=renderToStaticMarkup(React.createElement(Component,{slug:'alken'}));
 for(const text of ['2/32','30','1/5','locations reviewed','without a published source-linked route','No fresh driving check'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/Prepare coverage drafts|latitude|longitude|100%/);
});
