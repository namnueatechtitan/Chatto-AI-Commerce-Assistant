const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {NestFactory}=require('@nestjs/core'),{Module,ValidationPipe}=require('@nestjs/common');
const {MerchantAiSettingsService}=require('../dist/modules/merchant-ai-settings/merchant-ai-settings.service');
const {MerchantAiSettingsController}=require('../dist/modules/merchant-ai-settings/merchant-ai-settings.controller');
const {MerchantAiSettingsGuard}=require('../dist/modules/merchant-ai-settings/merchant-ai-settings.guard');
const {DEFAULT_MERCHANT_AI_SETTINGS:D}=require('../dist/modules/merchant-ai-settings/merchant-ai-settings.types');
const {StoreInformationService}=require('../dist/modules/store-information/store-information.service');
const {AuthSessionService,hashToken}=require('../dist/auth/auth-session.service');
const {AiIntegrationService}=require('../dist/modules/ai-integration/ai-integration.service');

function fixture(){
 const a=randomUUID(),b=randomUUID(),ua=randomUUID(),ub=randomUUID(),tokenA='a'.repeat(43),tokenB='b'.repeat(43);
 let rows=new Map(),rules=new Map(),role='Owner',active=true,failRule=false;
 const clean=data=>Object.fromEntries(Object.entries(data).filter(([,value])=>value!==undefined));
 const tx={
  $executeRaw:async()=>1,
  merchantUser:{findUnique:async({where})=>{
   const {merchantId,userId}=where.merchantId_userId;
   return ((merchantId===a&&userId===ua)||(merchantId===b&&userId===ub))?{status:active?'ACTIVE':'INACTIVE',role:{name:role},merchant:{status:'TRIAL'}}:null;
  }},
  aiSetting:{
   findUnique:async({where})=>{const row=rows.get(where.merchantId)||[...rows.values()].find(row=>row.id===where.id);return row?{...row,rules:[...rules.values()].filter(rule=>rule.aiSettingsId===row.id&&rule.isEnabled).sort((x,y)=>x.sortOrder-y.sortOrder)}:null;},
   upsert:async({where,create,update})=>{let row=rows.get(where.merchantId);if(row)Object.assign(row,clean(update));else{row={id:randomUUID(),pronoun:null,tone:null,useEmoji:true,responseLength:'MEDIUM',recommendProducts:true,checkStock:true,compareProducts:true,answerFaq:true,showPrices:true,showPromotions:true,recommendRelatedProducts:true,fallbackBehavior:'NOTIFY_AND_HANDOFF',memoryEnabled:null,rulesConfigured:false,storeRules:null,...clean(create)};rows.set(where.merchantId,row);}return row;},
   update:async({where,data})=>{const row=[...rows.values()].find(row=>row.id===where.id&&row.merchantId===where.merchantId);Object.assign(row,data);return row;},
  },
  merchantAiRule:{
   count:async({where})=>[...rules.values()].filter(rule=>rule.aiSettingsId===where.aiSettingsId&&where.id.in.includes(rule.id)).length,
   deleteMany:async({where})=>{for(const [id,rule]of rules)if(rule.aiSettingsId===where.aiSettingsId&&!where.id.notIn.includes(id))rules.delete(id);},
   create:async({data})=>{if(failRule)throw Error('private database diagnostics');const row={id:randomUUID(),isEnabled:true,...data};rules.set(row.id,row);return row;},
   update:async({where,data})=>{const row=rules.get(where.id);assert.equal(row.aiSettingsId,where.aiSettingsId);Object.assign(row,data);return row;},
  },
 };
 const db={...tx,$transaction:async cb=>{const before=structuredClone({rows,rules});try{return await cb(tx);}catch(error){rows=before.rows;rules=before.rules;throw error;}}};
 const settings=new MerchantAiSettingsService(db,new StoreInformationService(db,{}));
 const sessions=new AuthSessionService({authSession:{findUnique:async({where})=>{const id=where.tokenHash===hashToken(tokenA)?ua:where.tokenHash===hashToken(tokenB)?ub:null;return id?{expiresAt:new Date(Date.now()+60000),user:{id,status:'ACTIVE',name:'Fixture'}}:null;}}});
 return {a,b,ua,ub,tokenA,tokenB,settings,sessions,db,setRole:v=>role=v,setActive:v=>active=v,setFailRule:v=>failRule=v,count:()=>rows.size};
}

test('defaults require membership and GET never creates rows; Staff/inactive membership cannot save',async()=>{
 const f=fixture();assert.deepEqual(await f.settings.getSettingsForMerchant(f.a),D);assert.equal(f.count(),0);
 assert.equal((await f.settings.read(f.ua,f.a)).canEdit,true);assert.equal(f.count(),0);
 await assert.rejects(f.settings.read(f.ua,f.b),e=>e.getStatus()===404);
 f.setRole('Staff');assert.equal((await f.settings.read(f.ua,f.a)).canEdit,false);
 await assert.rejects(f.settings.update(f.ua,f.a,{assistantName:'A'}),e=>e.getStatus()===403);
 f.setActive(false);await assert.rejects(f.settings.read(f.ua,f.a),e=>e.getStatus()===404);
});
test('settings and stable rule IDs synchronize atomically and reject foreign/duplicate rule IDs',async()=>{
 const f=fixture();const a=await f.settings.update(f.ua,f.a,{assistantName:'A',rules:[{text:'Rule A'},{text:'Remove me'}]});
 const b=await f.settings.update(f.ub,f.b,{assistantName:'B',tone:'professional',rules:[{text:'Rule B'}]});
 await assert.rejects(f.settings.update(f.ua,f.a,{assistantName:'Hacked',rules:[{id:b.rules[0].id,text:'Foreign'}]}),e=>e.getStatus()===400);
 assert.equal((await f.settings.read(f.ua,f.a)).assistantName,'A');
 await assert.rejects(f.settings.update(f.ua,f.a,{rules:[a.rules[0],a.rules[0]]}),e=>e.getStatus()===400);
 const edited=await f.settings.update(f.ua,f.a,{rules:[{id:a.rules[0].id,text:'Edited A'},{text:'New A'}]});
 assert.equal(edited.rules[0].id,a.rules[0].id);assert.deepEqual(edited.rules.map(r=>r.text),['Edited A','New A']);
 f.setFailRule(true);await assert.rejects(f.settings.update(f.ua,f.a,{assistantName:'Must roll back',rules:[{text:'Failure'}]}),e=>e.getStatus()===503&&!e.message.includes('private'));
 assert.equal((await f.settings.read(f.ua,f.a)).assistantName,'A');assert.deepEqual((await f.settings.read(f.ua,f.a)).rules,edited.rules);
 assert.equal((await f.settings.read(f.ub,f.b)).rules[0].text,'Rule B');
 await f.settings.update(f.ua,f.a,{rules:[]});assert.deepEqual((await f.settings.read(f.ua,f.a)).rules,[]);
});
test('real Nest GET/PATCH enforce session, Origin, membership and DTO validation before persistence',async()=>{
 const f=fixture();class TestModule{}
 Module({controllers:[MerchantAiSettingsController],providers:[MerchantAiSettingsGuard,{provide:AuthSessionService,useValue:f.sessions},{provide:MerchantAiSettingsService,useValue:f.settings}]})(TestModule);
 const app=await NestFactory.create(TestModule,{logger:false});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));await app.listen(0,'127.0.0.1');
 const base=await app.getUrl(),route='/merchants/'+f.a+'/ai-settings';
 const request=(path=route,body,headers={})=>fetch(base+path,{method:body===undefined?'GET':'PATCH',headers:{Cookie:'chatto_session='+f.tokenA,Origin:'http://localhost:3000',...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
 try{
  assert.equal((await fetch(base+route)).status,401);assert.equal((await request()).status,200);assert.equal(f.count(),0);
  assert.equal((await request('/merchants/'+f.b+'/ai-settings')).status,404);
  assert.equal((await request('/merchants/'+f.b+'/ai-settings',{assistantName:'Forbidden'})).status,404);
  assert.equal((await request(route+'?merchantId='+f.b)).status,400);
  for(const body of [{merchantId:f.b},{userId:f.ub},{assistantName:' '},{assistantName:'x'.repeat(81)},{tone:'evil'},{language:'xx'},{pronoun:null},{useEmoji:'true'},{capabilities:{}},{rules:[{text:' '}]},{rules:Array.from({length:21},()=>({text:'Rule'}))},{rules:[{text:'x'.repeat(501)}]},{rules:[{id:'local-id',text:'Rule'}]},{fallbackBehavior:'fake'}])assert.equal((await request(route,body)).status,400,JSON.stringify(Object.keys(body)));
  assert.equal(f.count(),0);assert.equal((await request(route,{assistantName:'A'},{Origin:'https://foreign.example'})).status,403);
  const saved=await request(route,{assistantName:'  Saved A  ',tone:'polite',capabilities:{...D.capabilities,answerFaq:false},rules:[{text:'  Rule A  '}]});assert.equal(saved.status,200);
  const state=await saved.json();assert.equal(state.assistantName,'Saved A');assert.equal(state.rules[0].text,'Rule A');assert.equal(state.capabilities.answerFaq,false);
  assert.equal((await (await request()).json()).rules[0].id,state.rules[0].id);
  f.setRole('Staff');assert.equal((await request(route,{assistantName:'Not owner'})).status,403);
 }finally{await app.close();}
});
test('trusted runtime selects fresh A/B database settings and gates context access before AI transport',async t=>{
 const f=fixture();await f.settings.update(f.ua,f.a,{assistantName:'A',tone:'friendly',capabilities:{...D.capabilities,showPromotions:false},rules:[{text:'Rule A'}]});
 await f.settings.update(f.ub,f.b,{assistantName:'B',tone:'professional',rules:[{text:'Rule B'}]});
 const calls=[],exports=[];
 const internal={exportMerchantSettings:async id=>{const p=await f.settings.getSettingsForMerchant(id);return{merchant_id:id,store_name:id,bot_name:p.assistantName,default_language:p.language,ai_tone:p.tone,rules:p.rules.map(r=>r.text),ai_profile:p,enabled_features:{}};},
  exportProducts:async id=>{exports.push(['products',id]);return{merchant_id:id,products:[]};},exportKnowledgeBase:async id=>{exports.push(['faq',id]);return{merchant_id:id,knowledge_base:[]};},exportVectorDocuments:async id=>{exports.push(['vectors',id]);return[];},exportConversationHistory:async id=>{exports.push(['history',id]);return[];}};
 const oldFetch=global.fetch,oldToken=process.env.AI_SERVICE_TOKEN;process.env.AI_SERVICE_TOKEN='synthetic-test-service-token-with-enough-entropy-0123456789';
 global.fetch=async(_url,init)=>{const r=JSON.parse(init.body);calls.push(r);return new Response(JSON.stringify({request_id:r.request_id,merchant_id:r.merchant_id,conversation_id:r.conversation_id,reply:{text:'Synthetic'},handover_required:false}));};
 t.after(()=>{global.fetch=oldFetch;if(oldToken===undefined)delete process.env.AI_SERVICE_TOKEN;else process.env.AI_SERVICE_TOKEN=oldToken;});
 const service=new AiIntegrationService(internal),request=id=>({request_id:randomUUID(),merchant_id:id,channel:'line',conversation_id:randomUUID(),customer:{id:randomUUID()},message:{id:randomUUID(),text:'hello',timestamp:new Date().toISOString()}});
 await service.chat(request(f.a));assert.equal(exports.length,0);assert.equal(calls[0].ai_context.merchant_settings.ai_profile.rules[0].text,'Rule A');assert.equal(calls[0].ai_context.vector_sync_allowed,false);
 await service.chat(request(f.b));assert.ok(exports.every(([,id])=>id===f.b));assert.equal(calls[1].ai_context.merchant_settings.ai_profile.rules[0].text,'Rule B');
 await f.settings.update(f.ub,f.b,{capabilities:{...D.capabilities,answerFaq:false}});exports.length=0;await service.chat(request(f.b));assert.deepEqual(exports.map(([name])=>name),['products']);
 assert.equal(calls[2].ai_context.merchant_settings.ai_profile.capabilities.answerFaq,false);
 for(const disabled of ['showPrices','checkStock','showPromotions']){
  await f.settings.update(f.ub,f.b,{capabilities:{...D.capabilities,[disabled]:false}});exports.length=0;
  await service.chat(request(f.b));assert.deepEqual(exports,[],disabled+' must withhold untyped facts before data access');
 }
 for(const [disabled,text] of [['recommendProducts','recommend products'],['compareProducts','compare products'],['recommendRelatedProducts','similar products']]){
  await f.settings.update(f.ub,f.b,{capabilities:{...D.capabilities,[disabled]:false}});exports.length=0;
  await service.chat({...request(f.b),message:{...request(f.b).message,text}});
  assert.deepEqual(exports,[]);assert.equal(calls.at(-1).ai_context.policy_denied,true);
 }
});
