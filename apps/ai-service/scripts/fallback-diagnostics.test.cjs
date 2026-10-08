const assert = require("node:assert/strict");
const test = require("node:test");
const { MockAiReplyService } = require("../dist/modules/mock-ai-reply");
const { GeminiClient } = require("../dist/modules/llm/gemini-client");
const { RagService } = require("../dist/modules/rag");
const { buildProductKnowledgeDocument } = require("../dist/modules/rag/vector-document.builder");
const { resolveMerchantFallback } = require("../dist/modules/merchant-policy");
const { IntentClassifier } = require("../dist/modules/intent-classifier");

const profile = {rules:[],assistantName:"Chatto",pronoun:"I",tone:"friendly",useEmoji:false,responseLength:"medium",language:"th",fallbackBehavior:"notify_and_handoff",capabilities:{
  showPrices:true,checkStock:true,showPromotions:true,answerFaq:true,recommendProducts:true,
  compareProducts:true,recommendRelatedProducts:true,rememberCustomerInterest:true}};
function fixture(stockKnown=false) {
  const product={id:"p1",merchant_id:"a",name:"เสื้อยืด Yuepaochatto",status:"active",price:null,
    currency:"THB",image_urls:[],updated_at:"2026-10-08",variants:[]};
  for(const color of ["Black / ดำ","White / ขาว","Gray / เทา","Navy / กรมท่า","Cream / ครีม"])
    for(const size of ["S","M","L","XL","2XL","3XL"])
      product.variants.push({id:color+size,product_id:"p1",variant_name:color+size,color,size,
        price:null,currency:"THB",stock_known:stockKnown,stock_qty:0,reserved_qty:0,available_qty:0,status:"active"});
  return {merchantId:"a",products:{merchant_id:"a",products:[product]},
    retrievedChunks:[{merchant_id:"a",source_type:"product",source_id:"p1",chunk_text:"",score:0.5,
      lexical_score:0.5,intent_score:0,metadata:{},title:product.name}],
    merchantSettings:{merchant_id:"a",bot_name:"Chatto",default_language:"th",ai_profile:profile},
    confidence:0.65,intent:"unknown",language:"th"};
}
function fallback(message,input=fixture()) {
  return new MockAiReplyService().generateReply({...input,customerMessage:message});
}
for (const message of ["ร้านนายขายอะไร","อยากได้เสื้อยืดสีดำ","มีเสื้อสีดำไซส์ M ไหม"]) {
  test("natural product question uses scoped structured evidence: "+message,()=>{
    const result=fallback(message);
    assert.equal(result.fallback_source,"trusted_catalog");
    assert.match(result.reply,/เสื้อยืด/);
    assert.doesNotMatch(result.reply,/ยังไม่เข้าใจ|พร้อมจำหน่าย/);
  });
}
test("unknown intent with relevant evidence is conservative about a color-size pair",()=>{
  const result=fallback("มีเสื้อสีดำไซส์ M ไหม");
  assert.match(result.reply,/Black \/ ดำ \/ M/);
  assert.doesNotMatch(result.reply,/\/ XL/);
  assert.match(result.reply,/ไม่มีข้อมูลสต็อกที่ยืนยันได้/);
});
test("unknown without evidence and unrelated evidence retain safe fallback",()=>{
  const input=fixture();input.retrievedChunks=[];
  assert.match(fallback("อยากได้เสื้อยืดสีดำ",input).reply,/ยังไม่เข้าใจ/);
  assert.match(fallback("เครื่องยนต์รถยนต์ทำงานอย่างไร").reply,/ยังไม่เข้าใจ/);
  assert.match(fallback("เสื้อยืดจัดส่งพรุ่งนี้ไหม").reply,/ยังไม่เข้าใจ/);
});
test("NULL and documented zero stock remain distinct",()=>{
  assert.match(fallback("มีเสื้อสีดำไซส์ M ไหม").reply,/ไม่มีข้อมูลสต็อก/);
  assert.match(fallback("มีเสื้อสีดำไซส์ M ไหม",fixture(true)).reply,/ระบุเป็น 0/);
  const doc=buildProductKnowledgeDocument(fixture().products.products[0]);
  assert.match(doc.content,/Stock: not specified/);
  assert.doesNotMatch(doc.content,/Available quantity: 0/);
});
test("missing price is not fabricated",()=>{
  const result=fallback("เสื้อยืดสีดำราคาเท่าไหร่");
  assert.match(result.reply,/ไม่มีราคาที่ระบุ/);
  assert.doesNotMatch(result.reply,/0 THB/);
});
test("overlapping names do not authorize another merchant's data",()=>{
  for(const mode of ["export","row","chunk"]){
    const input=fixture();
    if(mode==="export")input.products.merchant_id="b";
    if(mode==="row")input.products.products[0].merchant_id="b";
    if(mode==="chunk")input.retrievedChunks[0].merchant_id="b";
    assert.notEqual(fallback("อยากได้เสื้อยืดสีดำ",input).fallback_source,"trusted_catalog");
  }
});
test("retrieval rejects cross-merchant candidates and missing tenant",()=>{
  const doc={merchant_id:"b",source_type:"product",source_id:"p1",chunk_text:"เสื้อยืดสีดำ",
    status:"active",metadata:{title:"เสื้อยืด"},embedding:null};
  assert.equal(new RagService().retrieve({merchant_id:"a",query:"เสื้อยืดสีดำ",documents:[doc]}).chunks.length,0);
  assert.equal(new RagService().retrieve({query:"เสื้อยืดสีดำ",documents:[doc]}).chunks.length,0);
});
test("policy denial and disabled facts prevent catalog fallback",()=>{
  const input=fixture();input.policyDenied=true;
  assert.notEqual(fallback("อยากได้เสื้อยืดสีดำ",input).fallback_source,"trusted_catalog");
  assert.ok(resolveMerchantFallback(profile,"unknown","อยากได้เสื้อยืดสีดำ",input.retrievedChunks,true));
  input.policyDenied=false;
  input.merchantSettings={...input.merchantSettings,ai_profile:{...profile,capabilities:{...profile.capabilities,showPrices:false}}};
  assert.notEqual(fallback("อยากได้เสื้อยืดสีดำ",input).fallback_source,"trusted_catalog");
});
test("small talk is unchanged even when product context exists",()=>{
  const result=fallback("สวัสดี",{...fixture(),intent:"small_talk"});
  assert.match(result.reply,/สวัสดี/);assert.doesNotMatch(result.reply,/เสื้อยืด/);
});
test("invalid variant ownership and ambiguous product matches fail closed",()=>{
  const input=fixture();input.products.products[0].variants.forEach(v=>v.product_id="foreign");
  assert.notEqual(fallback("อยากได้เสื้อยืดสีดำ",input).fallback_source,"trusted_catalog");
  const ambiguous=fixture();const p={...ambiguous.products.products[0],id:"p2"};
  ambiguous.products.products.push(p);ambiguous.retrievedChunks.push({...ambiguous.retrievedChunks[0],source_id:"p2"});
  assert.notEqual(fallback("อยากได้เสื้อยืดสีดำ",ambiguous).fallback_source,"trusted_catalog");
});
async function mockedProvider(fetcher,fn) {
  const savedFetch=global.fetch,savedKey=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY="unit-test-key";global.fetch=fetcher;
  try {await fn(new GeminiClient());}
  finally {global.fetch=savedFetch;if(savedKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=savedKey;}
}
const request={intent:"unknown",customerMessage:"private customer message",language:"th",
  conversationHistory:[],fallbackReply:"safe fallback",retrievedChunks:[],systemInstruction:"private prompt"};
for(const [status,category] of [[401,"authentication"],[403,"authentication"],[429,"rate_limit"],[500,"http_error"]]){
  test("Gemini HTTP "+status+" is sanitized as "+category,async()=>{
    await mockedProvider(async()=>new Response("sensitive provider body",{status}),async client=>{
      const result=await client.generateReply(request);
      assert.equal(result.errorCategory,category);assert.equal(result.httpStatus,status);
      assert.equal(result.requestAttempted,true);assert.equal(result.text,"safe fallback");
      assert.doesNotMatch(JSON.stringify(result),/sensitive provider|private customer|private prompt|unit-test-key/);
    });
  });
}
test("Gemini timeout is classified without raw error text",async()=>{
  await mockedProvider(async()=>{const e=new Error("sensitive error");e.name="AbortError";throw e;},async client=>{
    const r=await client.generateReply(request);assert.equal(r.errorCategory,"timeout");assert.equal(r.timedOut,true);
    assert.equal(r.error,"timeout");
  });
});
test("Gemini network failure is sanitized",async()=>{
  await mockedProvider(async()=>{throw new Error("secret URL");},async client=>{
    assert.equal((await client.generateReply(request)).errorCategory,"network_error");
  });
});
for(const [payload,category] of [[{},"empty_output"],[{output_text:123},"invalid_response"],["wrong","invalid_response"]]){
  test("Gemini "+category+" classification",async()=>{
    await mockedProvider(async()=>new Response(JSON.stringify(payload)),async client=>{
      assert.equal((await client.generateReply(request)).errorCategory,category);
    });
  });
}
test("Gemini malformed JSON is invalid_response",async()=>{
  await mockedProvider(async()=>new Response("not JSON"),async client=>{
    assert.equal((await client.generateReply(request)).errorCategory,"invalid_response");
  });
});
test("Gemini successful generation uses output and records success",async()=>{
  await mockedProvider(async()=>new Response(JSON.stringify({output_text:"usable answer"})),async client=>{
    const r=await client.generateReply(request);
    assert.equal(r.text,"usable answer");assert.equal(r.usedExternalProvider,true);
    assert.equal(r.requestAttempted,true);assert.equal(r.httpStatus,200);assert.equal(r.errorCategory,undefined);
  });
});
test("provider timeout integrates with evidence-aware fallback",async()=>{
  const input=fixture(),message="มีเสื้อสีดำไซส์ M ไหม";
  const intent=new IntentClassifier().classify(message);
  const reply=new MockAiReplyService().generateReply({...input,...intent,customerMessage:message});
  await mockedProvider(async()=>{const e=new Error();e.name="AbortError";throw e;},async client=>{
    const r=await client.generateReply({...request,customerMessage:message,fallbackReply:reply.reply});
    assert.equal(r.errorCategory,"timeout");assert.equal(r.text,reply.reply);
    assert.match(r.text,/Black \/ ดำ \/ M/);
  });
});

test("actual HTTP orchestration preserves catalog fallback and diagnostics on mocked rate limits",async t=>{
  const net=require("node:net"),path=require("node:path"),{spawn}=require("node:child_process");
  const listener=net.createServer();await new Promise(r=>listener.listen(0,"127.0.0.1",r));
  const port=listener.address().port;await new Promise(r=>listener.close(r));
  const entry=path.resolve(__dirname,"../dist/index.js");
  const preload='global.fetch=async(url)=>{if(String(url).includes(":embedContent"))return new Response(JSON.stringify({embedding:{values:[1,0]}}));if(String(url).endsWith("/interactions"))return new Response("private provider body",{status:429});throw new Error("Unexpected network call blocked");};require('+JSON.stringify(entry)+');';
  const child=spawn(process.execPath,["-e",preload],{cwd:__dirname,windowsHide:true,stdio:"ignore",
    env:{...process.env,NODE_ENV:"test",AI_SERVICE_PORT:String(port),AI_SERVICE_TOKEN:"test-only-service",
      AI_LLM_PROVIDER:"gemini",GEMINI_API_KEY:"synthetic-test-key",INTERNAL_SERVICE_TOKEN:"",
      OPENAI_API_KEY:"",GEMINI_API_BASE_URL:"https://mock.invalid/interactions"}});
  t.after(()=>child.kill());
  const base="http://127.0.0.1:"+port;
  for(let i=0;i<100;i++){if(await fetch(base+"/health").then(r=>r.ok).catch(()=>false))break;await new Promise(r=>setTimeout(r,25));}
  for(const message of ["ร้านนายขายอะไร","อยากได้เสื้อยืดสีดำ","มีเสื้อสีดำไซส์ M ไหม"]){
    const f=fixture();
    const body={request_id:"request",merchant_id:"a",channel:"line",conversation_id:"conversation",
      customer:{id:"customer"},message:{id:"message",text:message,timestamp:new Date().toISOString()},
      ai_context:{merchant_settings:f.merchantSettings,products:f.products,
        knowledge_base:{merchant_id:"a",knowledge_base:[]},vector_documents:[],conversation_history:[],
        vector_sync_allowed:false,policy_denied:false}};
    const response=await fetch(base+"/mcp/chat",{method:"POST",headers:{Authorization:"Bearer test-only-service",
      "Content-Type":"application/json"},body:JSON.stringify(body)});
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(result.generation.error_category,"rate_limit");
    assert.equal(result.generation.provider_http_status,429);
    assert.equal(result.generation.provider_request_attempted,true);
    assert.equal(result.generation.provider_success,false);
    assert.equal(result.generation.fallback_source,"trusted_catalog");
    assert.ok(result.generation.retrieved_chunk_count>0);
    assert.match(result.reply.text,/เสื้อยืด/);
    assert.doesNotMatch(JSON.stringify(result.generation),/private provider body|synthetic-test-key/);
    body.ai_context.policy_denied=true;
    const denied=await fetch(base+"/mcp/chat",{method:"POST",headers:{Authorization:"Bearer test-only-service",
      "Content-Type":"application/json"},body:JSON.stringify(body)}).then(r=>r.json());
    assert.equal(denied.generation.fallback_source,"merchant_policy");
    assert.equal(denied.generation.provider_request_attempted,false);
  }
});

test("unsupported color or size requests do not confirm other variants",()=>{
  assert.notEqual(fallback("อยากได้เสื้อยืดสีแดง").fallback_source,"trusted_catalog");
  assert.notEqual(fallback("มีเสื้อสีดำไซส์ 4XL ไหม").fallback_source,"trusted_catalog");
});
test("missing Gemini configuration records no provider attempt",async t=>{
  const key=process.env.GEMINI_API_KEY,fetcher=global.fetch;
  delete process.env.GEMINI_API_KEY;
  global.fetch=async()=>{assert.fail("No provider call expected");};
  t.after(()=>{global.fetch=fetcher;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;});
  const result=await new GeminiClient().generateReply(request);
  assert.equal(result.requestAttempted,false);
  assert.equal(result.errorCategory,"not_configured");
});
test("configured timeout aborts a mocked pending request",async t=>{
  const oldTimeout=process.env.GEMINI_TIMEOUT_MS;
  process.env.GEMINI_TIMEOUT_MS="1000";
  t.after(()=>{if(oldTimeout===undefined)delete process.env.GEMINI_TIMEOUT_MS;else process.env.GEMINI_TIMEOUT_MS=oldTimeout;});
  await mockedProvider((_url,init)=>new Promise((_resolve,reject)=>{
    init.signal.addEventListener("abort",()=>reject(new Error("private transport error")),{once:true});
  }),async client=>{
    const result=await client.generateReply(request);
    assert.equal(result.errorCategory,"timeout");assert.equal(result.timedOut,true);
    assert.ok(result.latencyMs>=900);assert.equal(result.requestAttempted,true);
  });
});
