const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/dashboard-model.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const model={};new Function('exports','require',code)(model,require);
test('dashboard selection uses authorized membership; invalid IDs never fall back to another tenant',()=>{
 const a={merchant:{id:'a'},role:{name:'Owner'}},b={merchant:{id:'b'},role:{name:'Staff'}};
 assert.equal(model.dashboardMembership([a],null),a);assert.equal(model.dashboardMembership([a,b],null),null);
 assert.equal(model.dashboardMembership([a,b],'b'),b);assert.equal(model.dashboardMembership([a],'b'),null);
 assert.equal(model.dashboardMembership([a],''),null);
});
test('readiness cache identity contains both session user and merchant',()=>{
 assert.notDeepEqual(model.dashboardReadinessKey('user1','a'),model.dashboardReadinessKey('user1','b'));
 assert.notDeepEqual(model.dashboardReadinessKey('user1','a'),model.dashboardReadinessKey('user2','a'));
});
test('message filters preserve individual IDs and do not infer unread, ownership or merged histories',()=>{
 const messages=[{id:'one',customerName:'same name',message:'first message'},{id:'two',customerName:'same name',message:'second message',ownership:'WAITING_HANDOVER'}];
 assert.deepEqual(model.filterDashboardMessages(messages,' same NAME ',false),messages);
 assert.deepEqual(model.filterDashboardMessages(messages,'second',false),[messages[1]]);
 assert.deepEqual(model.filterDashboardMessages(messages,'',true),[messages[1]]);
 assert.equal(model.dashboardTime('invalid'),'—');
});
