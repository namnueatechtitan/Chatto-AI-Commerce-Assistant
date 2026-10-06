const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID,randomBytes}=require('node:crypto'),net=require('node:net'),path=require('node:path'),{spawn}=require('node:child_process');
const {PromptManager}=require('../dist/modules/prompt-manager');
const {resolveMerchantFallback,applyMerchantOutputPolicy}=require('../dist/modules/merchant-policy');
const {GeminiClient}=require('../dist/modules/llm/gemini-client');
// Test fixtures use the real backend defaults rather than a second production set.
const D=require('../../api/dist/modules/merchant-ai-settings/merchant-ai-settings.types').DEFAULT_MERCHANT_AI_SETTINGS;
const profile=(name)=>({...structuredClone(D),assistantName:name,rules:[{text:'Rule '+name,sortOrder:0}]});
test('merchant behavior/rules use subordinate structured context and Gemini payload contains only this merchant',async t=>{
 const a=profile('A'),b={...profile('B'),tone:'professional'};
 const pm=new PromptManager();assert.ok(pm.getPrompt('default',a).systemPrompt.includes('"assistantName":"A"'));assert.ok(!pm.getPrompt('default',a).systemPrompt.includes('"assistantName":"B"'));
 assert.ok(pm.getPrompt('default',b).systemPrompt.includes('professional'));
 assert.ok(pm.getPrompt('default',{...a,fallbackBehavior:'general_knowledge'}).systemPrompt.includes('General knowledge may answer genuinely general questions only'));
 const oldFetch=global.fetch,oldKey=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='synthetic-unusable-test-key';let payload;
 global.fetch=async(_url,init)=>{payload=JSON.parse(init.body);return new Response(JSON.stringify({output_text:'Reply A'}));};
 t.after(()=>{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;});
 const result=await new GeminiClient().generateReply({intent:'product_question',customerMessage:'product?',language:'th',conversationHistory:[],fallbackReply:'fallback',merchantSettings:{merchant_id:'A',store_name:'Store A',bot_name:'A',ai_profile:a},retrievedChunks:[],systemInstruction:pm.getPrompt('default',a).systemPrompt});
 assert.equal(result.text,'Reply A');assert.ok(payload.input.includes('Rule A'));assert.ok(!payload.input.includes('Rule B'));assert.ok(payload.system_instruction.includes('subordinate'));
});
test('fallback never invents merchant facts or operational handoff; general questions require general_knowledge',()=>{
 for(const fallbackBehavior of ['notify_and_handoff','handoff_immediately','general_knowledge']){
  const p={...profile('A'),fallbackBehavior};
  const fallback=resolveMerchantFallback(p,'product_question','what is the current price?',[],false);
  assert.equal(fallback.handoverRequired,true);assert.ok(!/notified|transferred|ส่งต่อแล้ว/.test(fallback.text));
  assert.ok(resolveMerchantFallback(p,'product_question','price?',[],true));
 }
 assert.equal(resolveMerchantFallback({...profile('A'),fallbackBehavior:'general_knowledge'},'unknown','Explain photosynthesis',[],false),null);
 assert.ok(resolveMerchantFallback(profile('A'),'unknown','Explain photosynthesis',[],false));
 for(const question of ['What are your opening hours?','Explain your delivery status','What is your return policy?','ร้านเปิดกี่โมง','อธิบายการคืนสินค้า']){
  assert.ok(resolveMerchantFallback({...profile('A'),fallbackBehavior:'general_knowledge'},'unknown',question,[],false),question);
 }
 assert.equal(resolveMerchantFallback(profile('A'),'small_talk','hello',[],false),null);
 assert.equal(applyMerchantOutputPolicy('Hello 🙂 🇹🇭 1️⃣',{...profile('A'),useEmoji:false}),'Hello');
});
test('actual AI HTTP pipeline uses A/B profiles, excludes foreign context, and skips filtered vector synchronization',async t=>{
 const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 const token=randomBytes(32).toString('hex');
 const child=spawn(process.execPath,[path.resolve(__dirname,'../dist/index.js')],{cwd:__dirname,windowsHide:true,stdio:'ignore',env:{...process.env,NODE_ENV:'test',AI_SERVICE_PORT:String(port),AI_SERVICE_TOKEN:token,INTERNAL_SERVICE_TOKEN:'',AI_LLM_PROVIDER:'mock',GEMINI_API_KEY:'',OPENAI_API_KEY:'',GEMINI_EMBEDDING_API_KEY:''}});
 t.after(()=>child.kill());const base='http://127.0.0.1:'+port;
 for(let i=0;i<100;i++){if(await fetch(base+'/health').then(r=>r.ok).catch(()=>false))break;await new Promise(r=>setTimeout(r,50));}
 const send=async(name,denied=false)=>{
  const id=randomUUID(),p=profile(name);
  const body={request_id:id,merchant_id:name,channel:'line',conversation_id:randomUUID(),customer:{id:randomUUID()},message:{id:randomUUID(),text:denied?'current price?':'hello',timestamp:new Date().toISOString()},ai_context:{merchant_settings:{merchant_id:name,store_name:name,bot_name:name,ai_profile:p,enabled_features:{}},policy_denied:denied,vector_sync_allowed:false,products:{merchant_id:name,products:[]},knowledge_base:{merchant_id:name,knowledge_base:[]},vector_documents:[],conversation_history:[]}};
  const response=await fetch(base+'/mcp/chat',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,200);return response.json();
 };
 const a=await send('A'),b=await send('B');assert.equal(a.merchant_id,'A');assert.equal(b.merchant_id,'B');assert.ok(a.reply.text.includes('A:'));assert.ok(!a.reply.text.includes('B:'));assert.ok(b.reply.text.includes('B:'));
 assert.equal(a.debug.embeddingsReady.vector_sync.skipped,'merchant_policy');
 const denied=await send('A',true);assert.equal(denied.generation.provider,'policy');assert.equal(denied.generation.used_external_provider,false);assert.equal(denied.handover_required,true);assert.deepEqual(denied.sources,[]);
});
