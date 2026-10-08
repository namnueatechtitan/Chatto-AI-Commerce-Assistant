const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { RequestBudget, operationControl } = require("../dist/request-budget");
const { GeminiClient } = require("../dist/modules/llm/gemini-client");
const { EmbeddingsService } = require("../dist/modules/embeddings");
const { buildProductKnowledgeDocuments, toVectorDocumentRows } = require("../dist/modules/rag/vector-document.builder");

const profile = { assistantName:"Assistant",pronoun:"I",tone:"friendly",language:"th",useEmoji:false,
  responseLength:"medium",rules:[],fallbackBehavior:"notify_and_handoff",capabilities:{
    recommendProducts:true,checkStock:true,compareProducts:true,answerFaq:true,showPrices:true,
    rememberCustomerInterest:true,showPromotions:true,recommendRelatedProducts:true}};
function fixture(warm = true) {
 const product={id:"p1",merchant_id:"a",name:"เสื้อยืด",description:"เสื้อยืดสีดำ",price:null,currency:"THB",
  status:"active",updated_at:"2026-10-08",image_urls:[],variants:[{id:"v1",product_id:"p1",variant_name:"Black M",
  color:"Black / ดำ",size:"M",price:null,currency:"THB",stock_known:false,stock_qty:0,reserved_qty:0,available_qty:0,status:"active"}]};
 const products={merchant_id:"a",products:[product]};
 const vectors=toVectorDocumentRows(buildProductKnowledgeDocuments(products)).map(row=>({
  id:row.id,merchant_id:row.merchantId,source_type:row.sourceType,source_id:row.sourceId,
  chunk_text:row.chunkText,status:"active",embedding:[1,...Array(127).fill(0)],
  metadata:{...row.metadata,embedding_model:"gemini-embedding-2",embedding_dimensions:128}}));
 return {request_id:"synthetic-request",merchant_id:"a",channel:"line",conversation_id:"conversation",
  customer:{id:"customer"},message:{id:"message",text:"มีเสื้อสีดำไซส์ M ไหม",timestamp:new Date().toISOString()},
  ai_context:{merchant_settings:{merchant_id:"a",store_name:"Synthetic",bot_name:"Assistant",
    default_language:"th",ai_tone:"friendly",rules:[],enabled_features:{},ai_profile:profile},
    products,knowledge_base:{merchant_id:"a",knowledge_base:[]},vector_documents:warm?vectors:[],
    conversation_history:[],vector_sync_allowed:true,policy_denied:false}};
}
async function server(t,scenario) {
 const socket=net.createServer();await new Promise(r=>socket.listen(0,"127.0.0.1",r));
 const port=socket.address().port;await new Promise(r=>socket.close(r));
 const code = `
 const scenario=${JSON.stringify(scenario)};
 const values=[1,...Array(127).fill(0)];
 const notify=(event)=>process.send?.(event);
 function stalled(signal,kind){
  return new Promise((resolve,reject)=>{
   const abort=()=>{notify({kind,event:"aborted"});const error=new Error("synthetic");error.name="AbortError";reject(error);};
   if(signal.aborted)abort();else signal.addEventListener("abort",abort,{once:true});
  });
 }
 global.fetch=async(url,init)=>{
  const body=JSON.parse(init.body||"{}");
  const kind=String(url).includes(":embedContent") ? (body.content.parts[0].text.startsWith("title:")?"document_embedding":"query_embedding")
    : String(url).endsWith("/interactions")?"generation"
    : String(url).endsWith("/sync")?"vector_sync":"unknown";
  notify({kind,event:"started"});
  if(kind==="unknown")throw Error("Unexpected external call blocked");
  if(kind==="generation"){
    if(scenario==="generation_timeout"||scenario==="disconnect_generation")return stalled(init.signal,kind);
    if(scenario==="provider_failure")return new Response("synthetic error",{status:429});
    return new Response(JSON.stringify({output_text:"คำตอบสังเคราะห์จาก Gemini"}));
  }
  if((scenario==="query_slow"&&kind==="query_embedding")||
     (scenario==="document_slow"&&kind==="document_embedding")||
     (scenario==="sync_slow"&&kind==="vector_sync")||
     (scenario==="disconnect_embedding"&&kind==="query_embedding"))return stalled(init.signal,kind);
  if(kind==="vector_sync")return new Response(JSON.stringify({merchant_id:"a",upserted:1,deleted:0}));
  return new Response(JSON.stringify({embedding:{values}}));
 };
 const {GeminiClient}=require(${JSON.stringify(path.resolve(__dirname,"../dist/modules/llm/gemini-client.js"))});
 const originalGeneration=GeminiClient.prototype.generateReply;
 GeminiClient.prototype.generateReply=function(input){notify({kind:"generation_budget",timeoutMs:input.control?.timeoutMs});return originalGeneration.call(this,input);};
 require(${JSON.stringify(path.resolve(__dirname,"../dist/index.js"))});
 `;
 const child=spawn(process.execPath,["-e",code],{cwd:__dirname,windowsHide:true,stdio:["ignore","ignore","ignore","ipc"],
  env:{...process.env,NODE_ENV:"test",AI_SERVICE_PORT:String(port),AI_SERVICE_TOKEN:"synthetic-service",
   AI_LLM_PROVIDER:"gemini",GEMINI_API_KEY:"synthetic-key",GEMINI_MODEL:"gemini-3.1-flash-lite",
   GEMINI_EMBEDDING_MODEL:"gemini-embedding-2",GEMINI_EMBEDDING_DIMENSIONS:"128",
   GEMINI_API_BASE_URL:"https://mock.invalid/interactions",INTERNAL_SERVICE_TOKEN:"synthetic-internal",
   GEMINI_TIMEOUT_MS:"10000",GEMINI_EMBEDDING_TIMEOUT_MS:"10000",OPENAI_API_KEY:""}});
 const events=[];child.on("message",event=>events.push(event));
 t.after(()=>child.kill());
 const base="http://127.0.0.1:"+port;
 let healthy=false;
 for(let i=0;i<100;i++){if(await fetch(base+"/health").then(r=>r.ok).catch(()=>false)){healthy=true;break;}await new Promise(r=>setTimeout(r,20));}
 assert.ok(healthy,"isolated mocked AI fixture started");
 return {events,base,send:async(body,signal)=>{
   const r=await fetch(base+"/mcp/chat",{method:"POST",signal,headers:{Authorization:"Bearer synthetic-service","Content-Type":"application/json"},body:JSON.stringify(body)});
   assert.equal(r.status,200);return r.json();
 }};
}
test("20s upstream budget reserves overhead and caps preparation and generation",()=>{
 const budget=new RequestBudget(Date.now()+19000);
 try {assert.ok(budget.preprocessingMs(10000)<=3000);assert.ok(budget.generationMs()<=15000);assert.ok(budget.remainingMs()<=19000);}
 finally{budget.dispose();}
});
test("expired or insufficient budgets never permit a generation start",async()=>{
 for(const remaining of [-10,600]){
  const budget=new RequestBudget(Date.now()+remaining);
  try{
   const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw Error("must not run")};
   try{const client=new GeminiClient();const result=await client.generateReply({fallbackReply:"safe",control:{signal:budget.signal,timeoutMs:budget.generationMs()}});
    assert.equal(result.requestAttempted,false);assert.equal(result.errorCategory,"deadline_exceeded");assert.equal(calls,0);}
   finally{global.fetch=original;}
  }finally{budget.dispose();}
 }
});
test("fast retrieval + successful Gemini, fresh indexed embeddings reused, unchanged sync skipped",async t=>{
 const f=await server(t,"fast"),result=await f.send(fixture());
 assert.equal(result.generation.provider_success,true);assert.equal(result.generation.model,"gemini-3.1-flash-lite");
 assert.equal(result.generation.fallback_used,false);assert.ok(result.generation.stage_timings.retrieval);
 assert.ok(f.events.some(e=>e.kind==="generation_budget"&&e.timeoutMs===15000));
 t.diagnostic(JSON.stringify({scenario:"fast",pipeline_ms:result.generation.pipeline_latency_ms,stages:result.generation.stage_timings}));
 assert.equal(result.generation.stage_timings.vector_sync.outcome,"skipped");
 assert.equal(result.debug.embeddingsReady.reused,1);
 assert.equal(f.events.filter(e=>e.kind==="document_embedding").length,0);
 assert.equal(f.events.filter(e=>e.kind==="vector_sync").length,0);
});
for(const [scenario,warm,stage,minimum] of [["query_slow",true,"query_embedding",1200],["document_slow",false,"document_embedding",600],["sync_slow",false,"vector_sync",400]]){
 test("bounded "+scenario+" leaves Gemini budget and continues without retries",async t=>{
  const f=await server(t,scenario);const result=await f.send(fixture(warm));
  assert.equal(result.generation.provider_success,true);
  t.diagnostic(JSON.stringify({scenario,pipeline_ms:result.generation.pipeline_latency_ms,stages:result.generation.stage_timings}));
  assert.equal(result.generation.stage_timings[stage].outcome,"timed_out");
  assert.ok(result.generation.stage_timings[stage].latency_ms>=minimum);
  assert.ok(result.generation.pipeline_latency_ms<4000);
  assert.equal(f.events.filter(e=>e.kind===stage&&e.event==="started").length,1);
  assert.ok(f.events.some(e=>e.kind===stage&&e.event==="aborted"));
  assert.equal(f.events.filter(e=>e.kind==="generation"&&e.event==="started").length,1);
 });
}
test("slow generation returns trusted catalog fallback before its request deadline",async t=>{
 const f=await server(t,"generation_timeout"),body=fixture();
 const start=Date.now();body.execution={deadline_at_ms:start+1800};
 const result=await f.send(body);
 assert.equal(result.generation.error_category,"timeout");assert.equal(result.generation.timed_out,true);
 assert.equal(result.generation.fallback_source,"trusted_catalog");assert.equal(result.generation.provider_request_attempted,true);
 assert.match(result.reply.text,/Black \/ ดำ \/ M/);assert.match(result.reply.text,/ไม่มีข้อมูลสต็อก/);
 assert.ok(Date.now()-start<1800);assert.equal(result.generation.stage_timings.generation.outcome,"timed_out");
 t.diagnostic(JSON.stringify({scenario:"generation_timeout",pipeline_ms:result.generation.pipeline_latency_ms,stages:result.generation.stage_timings}));
});
test("insufficient time returns catalog fallback with no provider requests",async t=>{
 const f=await server(t,"fast"),body=fixture();body.execution={deadline_at_ms:Date.now()+800};
 const result=await f.send(body);
 assert.equal(result.generation.error_category,"deadline_exceeded");assert.equal(result.generation.provider_request_attempted,false);
 assert.equal(result.generation.fallback_source,"trusted_catalog");assert.equal(f.events.filter(e=>e.kind!=="generation_budget").length,0);
});
for(const [scenario,kind] of [["disconnect_embedding","query_embedding"],["disconnect_generation","generation"]]){
 test("client disconnection cancels "+kind+" and starts no later provider work",async t=>{
  const f=await server(t,scenario),controller=new AbortController();
  const pending=f.send(fixture(),controller.signal);
  const rejection=assert.rejects(pending,error=>error.name==="AbortError");
  for(let i=0;i<100&&!f.events.some(e=>e.kind===kind&&e.event==="started");i++)await new Promise(r=>setTimeout(r,10));
  assert.ok(f.events.some(e=>e.kind===kind&&e.event==="started"));controller.abort();await rejection;
  for(let i=0;i<100&&!f.events.some(e=>e.kind===kind&&e.event==="aborted");i++)await new Promise(r=>setTimeout(r,10));
  assert.ok(f.events.some(e=>e.kind===kind&&e.event==="aborted"));
  const count=f.events.filter(e=>e.kind!=="generation_budget").length;await new Promise(r=>setTimeout(r,100));assert.equal(f.events.filter(e=>e.kind!=="generation_budget").length,count);
 });
}
test("freshness rejects stale or foreign reused embeddings",async t=>{
 const f=await server(t,"fast");
 for(const mutation of ["hash","tenant"]){
  const body=fixture();const row=body.ai_context.vector_documents[0];
  if(mutation==="hash")row.metadata.content_hash="stale";else row.merchant_id="b";
  const result=await f.send(body);assert.equal(result.debug.embeddingsReady.reused,0);
  assert.equal(result.generation.provider_success,true);assert.ok(result.sources.every(s=>s.source_id==="p1"));
 }
 assert.equal(f.events.filter(e=>e.kind==="document_embedding"&&e.event==="started").length,1);
});
test("provider failure retains NULL stock/missing price and rejects cross-merchant evidence",async t=>{
 const f=await server(t,"provider_failure"),body=fixture();body.message.text="เสื้อสีดำราคาเท่าไหร่";
 const result=await f.send(body);
 assert.equal(result.generation.error_category,"rate_limit");assert.equal(result.generation.fallback_source,"trusted_catalog");
 assert.match(result.reply.text,/ไม่มีราคาที่ระบุ/);assert.match(result.reply.text,/ไม่มีข้อมูลสต็อก/);assert.doesNotMatch(result.reply.text,/0 THB/);
 const foreign=fixture();foreign.ai_context.products.products[0].merchant_id="b";foreign.ai_context.vector_documents=[];
 const denied=await f.send(foreign);assert.equal(denied.generation.provider_request_attempted,false);
 assert.equal(denied.generation.fallback_source,"merchant_policy");assert.equal(denied.sources.length,0);
});
test("policy denial performs no provider, embedding or sync request",async t=>{
 const f=await server(t,"fast"),body=fixture();body.ai_context.policy_denied=true;
 const result=await f.send(body);assert.equal(result.generation.provider,"policy");assert.equal(result.generation.provider_request_attempted,false);
 assert.equal(f.events.filter(e=>e.kind!=="generation_budget").length,0);
});
test("cancelled late successful provider output is discarded",async()=>{
 const original=global.fetch,oldKey=process.env.GEMINI_API_KEY;
 process.env.GEMINI_API_KEY="synthetic";const parent=new AbortController();let calls=0;
 global.fetch=async()=>{calls++;parent.abort();return new Response(JSON.stringify({output_text:"late"}));};
 try{
  const result=await new GeminiClient().generateReply({fallbackReply:"safe",intent:"unknown",language:"th",customerMessage:"synthetic",
   systemInstruction:"synthetic",retrievedChunks:[],conversationHistory:[],control:{signal:parent.signal,timeoutMs:15000}});
  assert.equal(result.text,"safe");assert.equal(result.errorCategory,"cancelled");assert.equal(calls,1);
 }finally{global.fetch=original;if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;}
});
test("cancellation of one identical embedding request does not cancel another",async()=>{
 const original=global.fetch,oldKey=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY="synthetic";
 global.fetch=async(_url,init)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>resolve(new Response(JSON.stringify({embedding:{values:[1,0]}}))),30);
  init.signal.addEventListener("abort",()=>{clearTimeout(timer);reject(Error("cancelled"));},{once:true});
 });
 try{
  const service=new EmbeddingsService(),one=new AbortController(),two=new AbortController();
  const a=service.embedQuery("synthetic",{signal:one.signal,timeoutMs:1000});
  const rejected=assert.rejects(a);const b=service.embedQuery("synthetic",{signal:two.signal,timeoutMs:1000});
  one.abort();await rejected;assert.deepEqual((await b).values,[1,0]);
 }finally{global.fetch=original;if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;}
});
