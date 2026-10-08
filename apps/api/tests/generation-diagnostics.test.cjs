const assert=require("node:assert/strict");
const test=require("node:test");
const {randomUUID}=require("node:crypto");
const {LineWebhooksService}=require("../dist/modules/line-webhooks/line-webhooks.service");
const {InternalAiService}=require("../dist/modules/internal-ai/internal-ai.service");

test("webhook retains safe diagnostics in existing JSON metadata",()=>{
  const service=Object.create(LineWebhooksService.prototype);
  const input={provider:"gemini",model:"gemini-3.1-flash-lite",used_external_provider:false,fallback_used:true,
    provider_request_attempted:true,provider_success:false,error_category:"timeout",fallback_reason:"timeout",
    timed_out:true,provider_http_status:429,latency_ms:10000,retrieved_chunk_count:3,fallback_source:"trusted_catalog"};
  assert.deepEqual(service.generationMetadata(input),input);
});
test("policy diagnostics are persisted without claiming a provider call",()=>{
  const service=Object.create(LineWebhooksService.prototype);
  const result=service.generationMetadata({provider:"policy",model:null,used_external_provider:false,
    fallback_used:true,provider_request_attempted:false,provider_success:false,error_category:"merchant_policy",
    fallback_reason:"merchant_policy",latency_ms:0,retrieved_chunk_count:0,fallback_source:"merchant_policy"});
  assert.equal(result.provider_request_attempted,false);
  assert.equal(result.fallback_reason,"merchant_policy");
});
test("arbitrary errors, prompts, secrets and invalid numeric diagnostics cannot be persisted",()=>{
  const service=Object.create(LineWebhooksService.prototype);
  const result=service.generationMetadata({provider:"gemini",model:"SECRET token",used_external_provider:false,
    fallback_used:true,error_category:"secret",fallback_reason:"customer text",latency_ms:Infinity,
    retrieved_chunk_count:-1,provider_http_status:999,fallback_source:"raw prompt",
    provider_request_attempted:"secret",prompt:"full prompt",token:"secret"});
  assert.deepEqual(result,{provider:"gemini",model:null,used_external_provider:false,fallback_used:true});
});
test("unknown provider identities cannot introduce metadata",()=>{
  const service=Object.create(LineWebhooksService.prototype);
  assert.equal(service.generationMetadata({provider:"untrusted",used_external_provider:false,fallback_used:true}),null);
});
test("product export distinguishes unknown inventory from known zero without changing prices",async()=>{
  const merchantId=randomUUID(),productId=randomUUID();
  let observed;
  const product={id:productId,merchantId,name:"Fixture shirt",description:null,category:null,brand:null,
    status:"ACTIVE",updatedAt:new Date(),images:[],variants:[null,0].map((stock,i)=>({
      id:randomUUID(),productId,variantName:"M"+i,sku:"test"+i,color:"Black",size:"M",price:null,
      currency:null,stockOnHand:stock,stockReserved:stock,lowStockThreshold:null,status:"ACTIVE"}))};
  const service=new InternalAiService({product:{findMany:async query=>{observed=query;return [product];}}},{});
  const result=await service.exportProducts(merchantId);
  assert.equal(observed.where.merchantId,merchantId);
  assert.equal(observed.include.variants.where.merchantId,merchantId);
  assert.equal(result.products[0].variants[0].stock_known,false);
  assert.equal(result.products[0].variants[1].stock_known,true);
  assert.equal(result.products[0].variants[0].price,null);
});
