const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('profile UI is optional, labels reported focus and keeps plan/centre rights separate',()=>{
 const source=read('app/dashboard/PreparationProfilePanel.tsx');
 for(const copy of ['Private · Optional','Age','town/area','does not move a Basic purchase','Hometown route generation is not enabled yet','not GPS-confirmed mistakes','Instructor-reported','Self-reported'])assert.ok(source.includes(copy),copy);
 assert.match(source,/<fieldset/);assert.match(source,/type="radio"/);assert.match(source,/maxLength=\{80\}/);
 assert.equal(source.includes('navigator.geolocation'),false);assert.equal(source.includes('localStorage'),false);
});
test('profile requests carry current owner/version, auth changes clear stale state and clearing is explicit',()=>{
 const source=read('app/dashboard/PreparationProfilePanel.tsx');
 assert.match(source,/ownerId: owner, version: profile.version/);
 assert.match(source,/ownerId: profile.ownerId, version: profile.version/);
 assert.match(source,/generation.current/);assert.match(source,/routepilot-auth-change/);
 assert.match(source,/setProfile\(null\); setForm\(null\)/);
 assert.match(source,/role="alertdialog"/);assert.match(source,/Your account, purchases and practice history stay intact/);
});
test('profile rollout is additive and privacy disclosure explains optional collection and clearing',()=>{
 const sql=read('api/prisma/migrations/0019_private_preparation_profile/migration.sql'),privacy=read('lib/legalCopy.ts');
 assert.match(sql,/CREATE TABLE "PreparationProfile"/);assert.match(sql,/ON DELETE CASCADE/);assert.match(sql,/ON DELETE SET NULL/);
 assert.equal(/^\s*(UPDATE|DELETE FROM|DROP TABLE|ALTER TABLE)\b/m.test(sql.replace(/--[^\n]*/g,'')),false);
 for(const phrase of ['Optional preparation profile','optional age','do not use age to infer driving ability','clear these optional preferences','Optioneel voorbereidingsprofiel'])assert.ok(privacy.includes(phrase),phrase);
});
