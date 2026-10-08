const assert=require("node:assert/strict");
const test=require("node:test");
const {randomUUID}=require("node:crypto");
const {AiIntegrationService}=require("../dist/modules/ai-integration/ai-integration.service");
const {LineWebhooksService}=require("../dist/modules/line-webhooks/line-webhooks.service");
const {DEFAULT_MERCHANT_AI_SETTINGS}=require("../dist/modules/merchant-ai-settings/merchant-ai-settings.types");

function request(){return {request_id:randomUUID(),merchant_id:randomUUID(),conversation_id:randomUUID(),
 customer:{id:randomUUID()},channel:"line",message:{id:randomUUID(),text:"synthetic shirt",timestamp:new Date().toISOString()}};}
function context(settingsDelay=0){
 const exports=[];
 return {exports,exportMerchantSettings:async merchant_id=>{exports.push("settings");if(settingsDelay)await new Promise(r=>setTimeout(r,settingsDelay));return {merchant_id,ai_profile:DEFAULT_MERCHANT_AI_SETTINGS}},
 exportProducts:async merchant_id=>{exports.push("products");return {merchant_id,products:[]}},
 exportKnowledgeBase:async merchant_id=>{exports.push("knowledge");return {merchant_id,knowledge_base:[]}},
 exportVectorDocuments:async()=>[],exportConversationHistory:async()=>[]};
}
async function mocked(t,fetcher){
 const oldFetch=global.fetch,oldToken=process.env.AI_SERVICE_TOKEN;
 process.env.AI_SERVICE_TOKEN="synthetic-service";global.fetch=fetcher;
 t.after(()=>{global.fetch=oldFetch;if(oldToken===undefined)delete process.env.AI_SERVICE_TOKEN;else process.env.AI_SERVICE_TOKEN=oldToken});
}
test("API keeps 20s deadline, exports deduct remaining time and propagates absolute deadline",async t=>{
 const body=request(),ctx=context(10);let captured,signal;
 await mocked(t,async(_url,init)=>{captured=JSON.parse(init.body);signal=init.signal;return new Response(JSON.stringify({
  ...body,reply:{text:"synthetic answer"},generation:{provider:"gemini",model:"gemini-3.1-flash-lite",used_external_provider:true,fallback_used:false}}));});
 const service=new AiIntegrationService(ctx);assert.equal(service.aiServiceTimeoutMs,20000);
 const start=Date.now(),result=await service.chat(body);
 assert.ok(captured.execution.deadline_at_ms>=start+18990&&captured.execution.deadline_at_ms<=start+19010);
 assert.equal(signal.aborted,false);assert.ok(result.generation.context_export_ms>=5);
 assert.equal(captured.merchant_id,body.merchant_id);assert.equal(captured.ai_context.products.merchant_id,body.merchant_id);
});
test("slow context export expires before provider call and cannot launch later work",async t=>{
 let calls=0;await mocked(t,async()=>{calls++;throw Error("must not run")});
 const ctx=context(60),service=new AiIntegrationService(ctx);service.aiServiceTimeoutMs=20;
 await assert.rejects(service.chat(request()),/timed out after 20ms/);
 await new Promise(r=>setTimeout(r,70));
 assert.equal(calls,0);assert.deepEqual(ctx.exports,["settings"]);
});
test("API deadline aborts AI transport without retry",async t=>{
 let calls=0,aborted=false;
 await mocked(t,async(_url,init)=>{calls++;return new Promise((_resolve,reject)=>{
  init.signal.addEventListener("abort",()=>{aborted=true;const e=Error("synthetic");e.name="AbortError";reject(e)},{once:true});
 });});
 const service=new AiIntegrationService(context());service.aiServiceTimeoutMs=25;
 await assert.rejects(service.chat(request()),/timed out after 25ms/);
 assert.equal(aborted,true);assert.equal(calls,1);
});
test("late provider transport output is rejected even if a mock ignores abort",async t=>{
 await mocked(t,async(_url,init)=>{await new Promise(r=>setTimeout(r,50));return new Response(JSON.stringify({...JSON.parse(init.body),reply:{text:"late"}}));});
 const service=new AiIntegrationService(context());service.aiServiceTimeoutMs=20;
 await assert.rejects(service.chat(request()),/timed out after 20ms/);
});
function lineFixture(ai){
 const epoch=new Date(),body=request();
 const job={merchantId:body.merchant_id,channelId:randomUUID(),customerId:body.customer.id,conversationId:body.conversation_id,
  messageId:body.message.id,eventId:body.request_id,revision:2,activationEpoch:epoch.toISOString()};
 const event={id:randomUUID(),rawPayload:{revision:2,phase:"received"}};
 let sends=0,reserves=0,prior=Promise.resolve();
 const db={aiSetting:{findFirst:async()=>({aiActivatedAt:epoch})},
  lineWebhookEvent:{findFirst:async()=>event,update:async({data})=>Object.assign(event,data)},
  message:{findFirst:async()=>({content:"synthetic",metadata:{line:{sourceWebhookEventId:job.eventId}}}),
   create:async({data})=>{reserves++;return {...data,id:randomUUID()}},update:async()=>({})},
  conversation:{update:async()=>({})}};
 const runtime={accessToken:()=>"synthetic",
  locked:(_job,fn)=>{const work=prior.then(()=>fn(db,{id:job.channelId}));prior=work.catch(()=>{});return work;}};
 const prisma={lineWebhookEvent:{updateMany:async({data})=>{Object.assign(event,data);return {count:1}}}};
 const service=new LineWebhooksService(prisma,runtime,ai,{reply:async()=>{sends++;return {outcome:"delivered",statusCode:200}}});
 return {service,job,event,counters:()=>({sends,reserves}),input:{timestamp:Date.now(),replyToken:"synthetic"}};
}
test("timed-out AI produces no late LINE reply and no retry for the same event",async t=>{
 let calls=0;
 await mocked(t,async(_url,init)=>{calls++;await new Promise(r=>setTimeout(r,50));return new Response(JSON.stringify({...JSON.parse(init.body),reply:{text:"late"}}));});
 const ai=new AiIntegrationService(context());ai.aiServiceTimeoutMs=20;
 const f=lineFixture(ai);
 await f.service.respond(f.job,f.input);await f.service.respond(f.job,f.input);
 assert.deepEqual(f.counters(),{sends:0,reserves:0});assert.equal(calls,1);assert.equal(f.event.rawPayload.phase,"failed_or_stale");
});
test("successful fallback is reserved once and never duplicated on repeated/concurrent event",async()=>{
 let calls=0;
 const f=lineFixture({chat:async r=>{calls++;return {...r,reply:{text:"conservative catalog fallback"},
  generation:{provider:"gemini",model:"gemini-3.1-flash-lite",fallback_used:true,used_external_provider:false,error_category:"deadline_exceeded"}}}});
 await Promise.all([f.service.respond(f.job,f.input),f.service.respond(f.job,f.input)]);
 await f.service.respond(f.job,f.input);
 assert.equal(calls,1);assert.deepEqual(f.counters(),{sends:1,reserves:1});assert.equal(f.event.rawPayload.phase,"delivered");
});
test("stage diagnostics persist only bounded numbers and fixed categories",()=>{
 const service=Object.create(LineWebhooksService.prototype);
 const result=service.generationMetadata({provider:"gemini",model:"gemini-3.1-flash-lite",fallback_used:true,
  used_external_provider:false,error_category:"deadline_exceeded",fallback_reason:"deadline_exceeded",
  pipeline_latency_ms:18000,context_export_ms:40,stage_timings:{
   query_embedding:{latency_ms:1500,outcome:"timed_out",prompt:"private"},
   generation:{latency_ms:Infinity,outcome:"completed"},retrieval:{latency_ms:1,outcome:"customer-message"},
   unknown:{latency_ms:1,outcome:"completed"}}});
 assert.equal(result.error_category,"deadline_exceeded");
 assert.deepEqual(result.stage_timings,{query_embedding:{latency_ms:1500,outcome:"timed_out"}});
 assert.equal(result.context_export_ms,40);
 assert.doesNotMatch(JSON.stringify(result),/private|customer-message|unknown/);
});
