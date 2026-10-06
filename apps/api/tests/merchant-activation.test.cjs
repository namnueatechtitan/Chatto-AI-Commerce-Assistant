'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {NestFactory}=require('@nestjs/core');
const {Module,ValidationPipe}=require('@nestjs/common');
const {AuthSessionService,hashToken}=require('../dist/auth/auth-session.service');
const {StoreInformationService}=require('../dist/modules/store-information/store-information.service');
const {MerchantActivationService}=require('../dist/modules/merchant-activation/merchant-activation.service');
const {MerchantActivationController}=require('../dist/modules/merchant-activation/merchant-activation.controller');
const {MerchantActivationGuard}=require('../dist/modules/merchant-activation/merchant-activation.guard');
const {LineWebhooksService}=require('../dist/modules/line-webhooks/line-webhooks.service');

function fixture(){
  const a=randomUUID(),b=randomUUID(),userA=randomUUID(),userB=randomUUID(),token='a'.repeat(43);
  const stores=new Map([a,b].map(id=>[id,{id,shopName:'Store '+id,businessCategory:'other',operatingHours:'09:00–18:00',status:'TRIAL'}]));
  const settings=new Map([a,b].map(id=>[id,{botName:'Assistant '+id,language:'th',tone:'friendly',fallbackBehavior:'NOTIFY_AND_HANDOFF',aiEnabled:false,aiActivatedAt:null}]));
  const channels=new Map([a,b].map(id=>[id,[{id:randomUUID(),status:'CONNECTED',isConnected:true,credentialRevision:2,externalChannelId:'7000000001',accessTokenEncrypted:'synthetic-encrypted',channelSecretEncrypted:'synthetic-encrypted',credentialsVerifiedAt:new Date(),webhookVerifiedAt:new Date(),lineClaimedAt:new Date(),lineBotUserId:'U'+'a'.repeat(32)}]]));
  const logs=[],queries=[];let role='Owner',active=true,prior=Promise.resolve(),failAudit=false;
  const membership=(user,id)=>(user===userA&&id===a||user===userB&&id===b)?{status:active?'ACTIVE':'INACTIVE',role:{name:role},merchant:{status:stores.get(id)?.status}}:null;
  const scoped=(q,value)=>{queries.push(q);assert.ok([a,b].includes(q.where.merchantId),'readiness query must be tenant scoped');return value;};
  const db={
    $executeRaw:async()=>1,$executeRawUnsafe:async()=>1,
    $queryRawUnsafe:async(sql,id,user)=>sql.includes('FROM merchant_users')?(membership(user,id)?[{id:randomUUID()}]:[]):[{id:'line-platform'}],
    merchantUser:{findUnique:async({where})=>membership(where.merchantId_userId.userId,where.merchantId_userId.merchantId),findFirst:async q=>scoped(q,{id:userA})},
    merchant:{findUnique:async q=>stores.get(q.where.id)},
    channel:{findMany:async q=>scoped(q,channels.get(q.where.merchantId)||[])},
    product:{count:async q=>scoped(q,0)},knowledgeBaseDocument:{count:async q=>scoped(q,0)},
    aiSetting:{findUnique:async q=>scoped(q,settings.get(q.where.merchantId)||null),update:async({where,data})=>Object.assign(settings.get(where.merchantId),data)},
    aiActionLog:{create:async({data})=>{if(failAudit)throw Error('PRIVATE_DATABASE_ERROR');logs.push(data);return data;}},
    $transaction:callback=>{const work=prior.then(async()=>{const snapshot=structuredClone(settings),logLength=logs.length;try{return await callback(db);}catch(error){settings.clear();for(const entry of snapshot)settings.set(...entry);logs.length=logLength;throw error;}});prior=work.catch(()=>{});return work;},
  };
  const service=new MerchantActivationService(db,new StoreInformationService(db,{}));
  const sessions=new AuthSessionService({authSession:{findUnique:async({where})=>where.tokenHash===hashToken(token)?{expiresAt:new Date(Date.now()+60000),user:{id:userA,status:'ACTIVE',name:'Owner',globalRole:'merchant_user'}}:null}});
  return {a,b,userA,userB,token,stores,settings,channels,logs,queries,service,sessions,setRole:value=>{role=value;},setActive:value=>{active=value;},setFailAudit:value=>{failAudit=value;}};
}
test('authorized readiness exposes safe persisted merchant summary; optional products and FAQ do not block',async()=>{
  const f=fixture(),r=await f.service.readiness(f.userA,f.a);
  assert.equal(r.ready,true);assert.equal(r.aiEnabled,false);assert.equal(r.checks.knowledge.productsCount,0);assert.equal(r.checks.knowledge.faqCount,0);
  assert.equal(r.aiSummary.assistantName,'Assistant '+f.a);assert.equal(r.channel.displayName,f.stores.get(f.a).shopName);
  assert.ok(!/Encrypted|synthetic-encrypted|channelSecret|accessToken/.test(JSON.stringify(r)));assert.equal(f.logs.length,0);
});
for(const operation of ['readiness','activate','deactivate'])test('Owner A cannot '+operation+' Merchant B',async()=>{
  const f=fixture();await assert.rejects(f.service[operation](f.userA,f.b),e=>e.getStatus()===404);assert.equal(f.queries.length,0);assert.equal(f.logs.length,0);
});
for(const [label,change,code]of [
  ['missing category',f=>{f.stores.get(f.a).businessCategory=null;},'STORE_INCOMPLETE'],
  ['missing hours',f=>{f.stores.get(f.a).operatingHours=' ';},'STORE_INCOMPLETE'],
  ['disconnected LINE',f=>{f.channels.get(f.a)[0].status='DISCONNECTED';},'LINE_NOT_CONNECTED'],
  ['missing encrypted credentials',f=>{f.channels.get(f.a)[0].accessTokenEncrypted=null;},'LINE_NOT_CONNECTED'],
  ['missing provider proof',f=>{f.channels.get(f.a)[0].credentialsVerifiedAt=null;},'LINE_NOT_CONNECTED'],
  ['missing webhook proof',f=>{f.channels.get(f.a)[0].webhookVerifiedAt=null;},'LINE_NOT_CONNECTED'],
  ['unclaimed LINE',f=>{f.channels.get(f.a)[0].lineClaimedAt=null;},'LINE_NOT_CONNECTED'],
  ['malformed bot identity',f=>{f.channels.get(f.a)[0].lineBotUserId='wrong';},'LINE_NOT_CONNECTED'],
  ['multiple LINE mappings',f=>{f.channels.get(f.a).push({...f.channels.get(f.a)[0],id:randomUUID()});},'LINE_NOT_CONNECTED'],
  ['missing settings',f=>{f.settings.delete(f.a);},'AI_CONTEXT_INCOMPLETE'],
  ['blank assistant',f=>{f.settings.get(f.a).botName=' ';},'AI_CONTEXT_INCOMPLETE'],
  ['invalid language',f=>{f.settings.get(f.a).language='xx';},'AI_CONTEXT_INCOMPLETE'],
  ['invalid tone',f=>{f.settings.get(f.a).tone='invalid';},'AI_CONTEXT_INCOMPLETE'],
])test(label+' prevents server activation',async()=>{
  const f=fixture();change(f);const r=await f.service.readiness(f.userA,f.a);assert.equal(r.ready,false);assert.ok(Object.values(r.checks).some(check=>check.code===code));
  await assert.rejects(f.service.activate(f.userA,f.a),e=>e.getStatus()===409&&e.getResponse().code==='MERCHANT_NOT_READY');assert.equal(f.settings.get(f.a)?.aiEnabled??false,false);assert.equal(f.logs.length,0);
});
test('concurrent/repeated activation is atomic, idempotent, timestamped and actor-scoped',async()=>{
  const f=fixture();const results=await Promise.all(Array.from({length:8},()=>f.service.activate(f.userA,f.a)));
  assert.equal(results.filter(r=>!r.alreadyEnabled).length,1);assert.equal(new Set(results.map(r=>r.activatedAt)).size,1);
  assert.equal(f.settings.get(f.a).aiEnabled,true);assert.equal(f.settings.get(f.a).aiActivatedByUserId,f.userA);assert.ok(f.settings.get(f.a).aiActivatedAt instanceof Date);
  assert.equal(f.settings.get(f.b).aiEnabled,false);assert.equal(f.logs.length,1);assert.equal(f.logs[0].actionType,'AI_ACTIVATED');
  f.channels.get(f.a)[0].webhookVerifiedAt=null;await assert.rejects(f.service.activate(f.userA,f.a),e=>e.getStatus()===409,'already enabled is still revalidated');
});
test('idempotent pause preserves LINE, AI context, last activation and other tenant',async()=>{
  const f=fixture();await f.service.activate(f.userA,f.a);await f.service.activate(f.userB,f.b);
  const channel=structuredClone(f.channels.get(f.a)),settings=structuredClone(f.settings.get(f.a));
  assert.equal((await f.service.deactivate(f.userA,f.a)).alreadyDisabled,false);assert.equal((await f.service.deactivate(f.userA,f.a)).alreadyDisabled,true);
  assert.deepEqual(f.channels.get(f.a),channel);assert.deepEqual({...f.settings.get(f.a),aiEnabled:true},settings);assert.equal(f.settings.get(f.b).aiEnabled,true);
  assert.equal(f.logs.filter(log=>log.actionType==='AI_DEACTIVATED').length,1);
});
test('audit failure rolls back activation and exposes only a safe 503',async()=>{
  const f=fixture();f.setFailAudit(true);await assert.rejects(f.service.activate(f.userA,f.a),e=>e.getStatus()===503&&!e.message.includes('PRIVATE'));assert.equal(f.settings.get(f.a).aiEnabled,false);
});
test('inactive membership rejected; Staff can read but cannot activate or pause',async()=>{
  const f=fixture();f.setRole('Staff');assert.equal((await f.service.readiness(f.userA,f.a)).ready,true);
  for(const op of ['activate','deactivate'])await assert.rejects(f.service[op](f.userA,f.a),e=>e.getStatus()===403);
  f.setActive(false);for(const op of ['readiness','activate','deactivate'])await assert.rejects(f.service[op](f.userA,f.a),e=>e.getStatus()===404);
});
test('real Nest endpoints enforce sessions, Owner scope, origin, UUID and empty commands',async()=>{
  const f=fixture();class TestModule{}
  Module({controllers:[MerchantActivationController],providers:[MerchantActivationGuard,{provide:AuthSessionService,useValue:f.sessions},{provide:MerchantActivationService,useValue:f.service}]})(TestModule);
  const app=await NestFactory.create(TestModule,{logger:false});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));await app.listen(0,'127.0.0.1');
  const base=await app.getUrl(),route='/merchants/'+f.a+'/activation';
  const call=(method,path=route,body,headers={})=>fetch(base+path,{method,headers:{Cookie:'chatto_session='+f.token,Origin:'http://localhost:3000',...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
  try{
    assert.equal((await fetch(base+route+'/readiness')).status,401);
    const r=await call('GET',route+'/readiness');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');
    assert.equal((await call('GET',route+'/readiness?merchantId='+f.b)).status,400);
    assert.equal((await call('POST','/merchants/invalid/activation',{})).status,400);
    for(const body of [{ready:true},{enabled:true},{merchantId:f.b},{actorUserId:f.userB},[],null])assert.equal((await call('POST',route,body)).status,400);
    assert.equal((await call('POST',route,{}, {Origin:'https://foreign.example'})).status,403);
    for(const method of ['GET','POST','DELETE'])assert.equal((await call(method,'/merchants/'+f.b+'/activation'+(method==='GET'?'/readiness':''),method==='GET'?undefined:{})).status,404);
    assert.equal((await call('POST',route,{})).status,200);assert.equal((await (await call('POST',route,{})).json()).alreadyEnabled,true);
    assert.equal((await call('DELETE',route,{})).status,200);assert.equal((await (await call('DELETE',route,{})).json()).alreadyDisabled,true);
    f.setRole('Staff');assert.equal((await call('POST',route,{})).status,403);assert.equal((await call('DELETE',route,{})).status,403);
  }finally{await app.close();}
});

for(const scenario of ['disabled before AI','pause during AI','pause and resume during AI','pause before delivery','enabled'])test('webhook response gate: '+scenario,async()=>{
  const epoch=new Date();const job={merchantId:randomUUID(),channelId:randomUUID(),customerId:randomUUID(),conversationId:randomUUID(),messageId:randomUUID(),eventId:randomUUID(),revision:2,activationEpoch:epoch.toISOString()};
  const event={id:randomUUID(),rawPayload:{revision:2,phase:'received'}},inbound={content:'hello',metadata:{line:{sourceWebhookEventId:job.eventId}}};
  let enabled=scenario!=='disabled before AI',aiCalls=0,replies=0,reserved=0,activeEpoch=epoch;
  const db={aiSetting:{findFirst:async q=>{assert.equal(q.where.merchantId,job.merchantId);return enabled?{aiActivatedAt:activeEpoch}:null;}},
    lineWebhookEvent:{findFirst:async()=>event,update:async({data})=>Object.assign(event,data)},
    message:{findFirst:async()=>inbound,create:async({data})=>{reserved++;if(scenario==='pause before delivery')enabled=false;return{...data,id:randomUUID()};},update:async()=>({})},conversation:{update:async()=>({})}};
  const runtime={locked:async(_job,action)=>action(db,{id:job.channelId}),accessToken:()=>{assert.equal(enabled,true);return 'synthetic';}};
  const ai={chat:async request=>{aiCalls++;if(scenario==='pause during AI')enabled=false;if(scenario==='pause and resume during AI')activeEpoch=new Date(epoch.getTime()+1);return{request_id:request.request_id,merchant_id:job.merchantId,conversation_id:job.conversationId,reply:{text:'reply'}};}};
  const service=new LineWebhooksService({lineWebhookEvent:{updateMany:async()=>{throw Error('Unexpected failure');}}},runtime,ai,{reply:async()=>{replies++;return{outcome:'delivered',statusCode:200};}});
  await service.respond(job,{timestamp:Date.now(),replyToken:'synthetic'});
  assert.equal(aiCalls,scenario==='disabled before AI'?0:1);assert.equal(replies,scenario==='enabled'?1:0);assert.equal(reserved,['enabled','pause before delivery'].includes(scenario)?1:0);
  assert.equal(event.rawPayload.phase,scenario==='enabled'?'delivered':'ai_disabled');
});
