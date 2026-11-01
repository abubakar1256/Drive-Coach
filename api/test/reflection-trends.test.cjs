require('reflect-metadata');
const {test}=require('node:test'),assert=require('node:assert/strict');
const {reportedObservations,reflectionTrends}=require('../dist/src/learning/reflection-trends');
const {PreparationService}=require('../dist/src/learning/preparation.service');
const now=new Date('2026-11-01T12:00:00Z');
const time=days=>new Date(now.getTime()-days*86400000).toISOString();
const report=(key,days,issues=[],good=[],source='SELF_REPORTED')=>({sessionKey:key,drivenAt:time(days),savedAt:time(days),source,difficulties:issues,assessedGood:good});

test('repeated self/supervisor reports count drives, not saves, and never overwrite selected difficulty',()=>{
 const a=report('a',1,['roundabouts']);
 const r=reflectionTrends([a,a,{...a,source:'INSTRUCTOR_REPORTED'},report('b',2,['roundabouts']),report('c',3,['speed'])],'DIFFICULT',now);
 assert.equal(r.sessionCount,3);assert.equal(r.skills.find(s=>s.code==='roundabouts').recentDifficultySessions,2);
 assert.equal(r.suggestedLevel,'BEGINNER');assert.equal(r.selectedLevel,'DIFFICULT');assert.equal(r.automaticallyApplied,false);
 assert.deepEqual(r.focus.items.find(s=>s.code==='roundabouts').basis,['SELF_REPORTED','INSTRUCTOR_REPORTED']);
});

test('missing/not-assessed reports cannot become improvement or promote workload',()=>{
 const empty=reportedObservations('a',time(1),time(1),{difficultyCategories:[],overallFeeling:'good'});
 const unassessed=reportedObservations('b',time(2),time(2),{source:'self',ratings:{priority:'not_assessed',mirrors:'not_assessed'}},true);
 assert.deepEqual(empty,[]);assert.deepEqual(unassessed,[]);
 const r=reflectionTrends(Array.from({length:8},(_,i)=>report(String(i),i+1,[],[])),'BEGINNER',now);
 assert.equal(r.suggestedLevel,null);assert.equal(r.sessionCount,0);
});

test('higher workload needs explicit recent positive assessments; one positive check is insufficient',()=>{
 const positive=Array.from({length:3},(_,i)=>report(String(i),i+1,[],['roundabouts','priority','observation']));
 assert.equal(reflectionTrends(positive,'BEGINNER',now).suggestedLevel,'INTERMEDIATE');
 assert.equal(reflectionTrends([...positive,report('4',5,[],['priority']),report('5',6,[],['roundabouts'])],'BEGINNER',now).suggestedLevel,'DIFFICULT');
 assert.equal(reflectionTrends(positive.map(r=>({...r,assessedGood:['priority']})),'BEGINNER',now).suggestedLevel,null);
 assert.equal(reflectionTrends([...positive,{...positive[0],source:'INSTRUCTOR_REPORTED',difficulties:['priority'],assessedGood:[]}],'BEGINNER',now).suggestedLevel,null);
});

test('improvement requires explicit good reports after an earlier difficulty; silence remains unknown',()=>{
 const rows=[report('a',1,[],['roundabouts']),report('b',2,[],['roundabouts']),...Array.from({length:4},(_,i)=>report('m'+i,i+3,['speed'])),report('old',8,['roundabouts'])];
 assert.equal(reflectionTrends(rows,'BEGINNER',now).skills.find(s=>s.code==='roundabouts').status,'REPORTED_IMPROVEMENT');
 const missing=rows.map(r=>({...r,assessedGood:[]}));
 assert.notEqual(reflectionTrends(missing,'BEGINNER',now).skills.find(s=>s.code==='roundabouts').status,'REPORTED_IMPROVEMENT');
});

test('window is bounded to 12 distinct drives in 90 days and old edits do not become new drives',()=>{
 const rows=Array.from({length:20},(_,i)=>report(String(i),i+1,['speed']));
 rows.push({...report('very-old',91,['priority']),savedAt:time(0)},report('future',-2,['priority']));
 const r=reflectionTrends(rows,'INTERMEDIATE',now);
 assert.equal(r.sessionCount,12);assert.equal(r.recentSessionCount,6);assert.equal(r.previousSessionCount,6);
 assert.equal(r.skills.some(s=>s.code==='priority'),false);
});

test('checklist normalization preserves explicit negatives and never exposes raw notes, geometry or unknown skills',()=>{
 const rows=reportedObservations('a',time(1),time(1),{source:'instructor_reported',notes:'SECRET_NOTES',geometry:[[5,50]],ratings:{mirrors:'good',blind_spots:'practice',priority:'good',role:'ADMIN'}},true);
 assert.deepEqual(rows[0].difficulties,['observation']);assert.deepEqual(rows[0].assessedGood,['priority']);
 const r=reflectionTrends(rows,'BEGINNER',now);
 assert.doesNotMatch(JSON.stringify(r),/SECRET_NOTES|"geometry"|ADMIN|sessionKey/);
 assert.deepEqual(reportedObservations('x','bad',time(1),{}),[]);
});

test('history queries are owner-scoped and bounded; returned analytics omit private notes and snapshots',async()=>{
 const queries=[];const capture=rows=>async q=>{queries.push(q);return rows;};
 const recent=new Date();
 const db={selfReflection:{findMany:capture([{sessionId:'s',updatedAt:recent,session:{startedAt:recent},difficultyCategories:['roundabouts'],notes:'SECRET'}])},practiceSession:{findMany:capture([{id:'s',startedAt:recent,routeSnapshot:{geometry:[[5,50]],coachingReview:{source:'instructor_reported',savedAt:recent.toISOString(),ratings:{priority:'practice'},notes:'SECRET'}}}])},hometownSession:{findMany:capture([])}};
 const r=await new PreparationService(db).history('owner-a','INTERMEDIATE');
 assert.equal(r.sessionCount,1);assert.equal(queries.length,3);
 for(const q of queries){assert.equal(q.where.userId,'owner-a');assert.equal(q.take,30);assert.ok(q.orderBy.length);}
 assert.doesNotMatch(JSON.stringify(r),/SECRET|"geometry"|owner-a/);
});

test('positive supervisor feedback is never relabelled as a supervisor-reported difficulty',()=>{
 const r=reflectionTrends([report('a',1,['priority']),report('a',1,[],['priority'],'INSTRUCTOR_REPORTED')],'BEGINNER',now);
 assert.deepEqual(r.focus.items[0].basis,['SELF_REPORTED']);
 assert.deepEqual(r.skills[0].basis,['SELF_REPORTED','INSTRUCTOR_REPORTED']);
});
