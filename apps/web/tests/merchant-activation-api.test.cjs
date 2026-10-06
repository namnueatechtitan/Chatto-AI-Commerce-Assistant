const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/merchant-activation-api.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const result={};new Function('exports','require',code)(result,require);
const {readActivation,activateMerchant,pauseMerchant,ActivationApiError}=result;
const merchant='00000000-0000-4000-8000-000000000001';
test('activation client scopes reads and empty Owner commands with session cookies and no cached truth',async t=>{
 const original=global.fetch,calls=[];t.after(()=>global.fetch=original);global.fetch=async(url,init)=>{calls.push({url,init});return Response.json({});};
 const controller=new AbortController();await readActivation(merchant,controller.signal);await activateMerchant(merchant);await pauseMerchant(merchant);
 assert.equal(calls[0].url,`/api/merchants/${merchant}/activation/readiness`);assert.equal(calls[0].init.signal.aborted,false);controller.abort();assert.equal(calls[0].init.signal.aborted,true);
 assert.deepEqual(calls.slice(1).map(c=>[c.init.method,c.init.body]),[['POST','{}'],['DELETE','{}']]);
 for(const call of calls){assert.equal(call.init.credentials,'same-origin');assert.equal(call.init.cache,'no-store');assert.ok(!call.url.includes('ready='));}
});
test('malformed merchant IDs never issue activation requests',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);global.fetch=async()=>{throw Error('must not fetch');};
 for(const action of [readActivation,activateMerchant,pauseMerchant])await assert.rejects(action('invalid'),e=>e instanceof ActivationApiError&&e.status===404);
});
test('409 recognizes only MERCHANT_NOT_READY and never echoes unsafe backend content',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);
 for(const status of [401,403,404,409,500]){global.fetch=async()=>Response.json({code:'MERCHANT_NOT_READY',message:'sensitive backend details'},{status});await assert.rejects(activateMerchant(merchant),e=>e instanceof ActivationApiError&&e.status===status&&!e.message.includes('sensitive')&&e.notReady===(status===409));}
 global.fetch=async()=>Response.json({code:'UNKNOWN',message:'sensitive'},{status:409});await assert.rejects(pauseMerchant(merchant),e=>!e.notReady&&!e.message.includes('sensitive'));
});
