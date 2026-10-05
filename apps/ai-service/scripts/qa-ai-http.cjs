/* Explicit isolated smoke check, without LINE or shop-data writes. */
const assert=require('node:assert/strict');
if(process.env.RUN_QA_AI_HTTP!=='1'){console.log('Skipped isolated AI HTTP smoke check.');process.exit(0);}
assert.equal(process.env.QA_AI_BASE_URL,'http://127.0.0.1:5500');
assert.ok(process.env.QA_AI_TOKEN);
const merchant='11111111-1111-4111-8111-111111111111';
const base={request_id:'qa-http',merchant_id:merchant,conversation_id:'qa-http-conversation',channel:'web_chat',customer:{id:'qa-http-customer'},ai_options:{backend_retrieval:true,language:'en'}};
async function call(text,history=[]){
 const body={...base,message:{id:'qa-http-message',text,timestamp:new Date().toISOString()},ai_context:{conversation_history:history}};
 const response=await fetch(`${process.env.QA_AI_BASE_URL}/mcp/chat`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.QA_AI_TOKEN}`,'X-Merchant-Id':merchant},body:JSON.stringify(body)});
 assert.equal(response.status,200);return response.json();
}
(async()=>{
 const greeting=await call('Hello!');assert.equal(greeting.confidence.reasons[0],'CONTEXT_FREE_GREETING');assert.equal(greeting.generation.used_external_provider,false);assert.equal(greeting.sources.length,0);
 const answer=await call('What is the Ink Basic Tee price?');assert.equal(answer.confidence.decision,'answer');assert.match(answer.reply.text,/390 THB/);assert.equal(answer.generation.provider,'ollama');assert.ok(answer.sources.length>0);assert.deepEqual(answer.actions,[]);
 const first=await call('How much is that one?');assert.equal(first.clarification_required,true);assert.equal(first.handover_required,false);
 const second=await call('How much is that one?',[{sender_type:'ai',content:first.reply.text,created_at:new Date().toISOString()}]);assert.equal(second.handover_required,true);assert.equal(second.clarification_required,false);
 const unauth=await fetch(`${process.env.QA_AI_BASE_URL}/mcp/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(base)});assert.equal(unauth.status,401);
 console.log(JSON.stringify({ok:true,checks:['context-free greeting','real Qwen + live SQL answer','first ambiguity clarification','repeated ambiguity handover','internal authentication'],shop_writes:false,line_delivery:false}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
