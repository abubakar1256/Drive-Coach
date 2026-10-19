const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('dashboard personalisation resets private data on auth/profile changes and never stores it locally',()=>{
 const s=read('app/dashboard/PersonalizedPracticePanel.tsx');assert.match(s,/routepilot-auth-change/);assert.match(s,/routepilot-preparation-change/);assert.match(s,/version:profile.version/);assert.match(s,/requestKey:crypto.randomUUID/);assert.match(s,/consent/);assert.doesNotMatch(s,/localStorage|sessionStorage|navigator.geolocation/);assert.match(s,/Coverage unknown/);
});
test('private route GPS requires explicit consent, pauses in background and has no forced completion control',()=>{
 const s=read('app/hometown/HometownPractice.tsx');assert.match(s,/gpsConsent\|\|!parked/);assert.match(s,/document.hidden/);assert.match(s,/clearWatch/);assert.match(s,/accuracyM:pos.coords.accuracy/);assert.match(s,/Location permission denied/);assert.doesNotMatch(s,/localStorage|completionPct:100/);assert.match(s,/Delete route & private history/);assert.match(s,/No speed-limit or priority-rule claims/);
});
test('AI profile sharing is opt-in, reset across accounts and server-scoped without age/town/GPS export',()=>{
 const ui=read('app/AIChatbot.tsx'),api=read('api/src/ai-chat/ai-chat.service.ts');assert.match(ui,/sharePreparation, setSharePreparation\] = useState\(false\)/);assert.match(ui,/setSharePreparation\(false\)/);assert.match(api,/sharePreparation === true/);assert.match(api,/level:p.preferredLevel/);assert.match(api,/Names, age, town, coordinates, raw notes and history are never sent/);
});
test('additive private tables are not public Route objects or trial/payment backfills',()=>{
 const sql=read('api/prisma/migrations/0020_private_personalized_practice/migration.sql');assert.match(sql,/CREATE TABLE "HometownRoute"/);assert.match(sql,/CREATE TABLE "PreparationRoutingBudget"/);assert.doesNotMatch(sql,/^\s*(?:UPDATE|DELETE FROM|INSERT INTO|ALTER TABLE) "(?:Route|Subscription|RouteTrial|Payment|PracticeSession)"/m);assert.match(read('api/src/learning/personalization.controller.ts'),/UseGuards\(JwtAuthGuard\)/);
});
