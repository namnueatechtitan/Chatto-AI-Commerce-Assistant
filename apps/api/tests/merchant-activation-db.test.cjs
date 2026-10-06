'use strict';
// Real PostgreSQL + Nest + encrypted channel resolution/HMAC. Provider responses
// are deterministic fixtures, never evidence of real LINE or Gemini delivery.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {randomUUID,randomBytes,createHmac}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {NestFactory}=require('@nestjs/core'),{Module,ValidationPipe}=require('@nestjs/common');
const {AuthSessionService}=require('../dist/auth/auth-session.service');
const {StoreInformationService}=require('../dist/modules/store-information/store-information.service');
const {MerchantsService}=require('../dist/modules/merchants.module');
const {MerchantAiSettingsService}=require('../dist/modules/merchant-ai-settings/merchant-ai-settings.service');
const {MerchantActivationService}=require('../dist/modules/merchant-activation/merchant-activation.service');
const {MerchantActivationController}=require('../dist/modules/merchant-activation/merchant-activation.controller');
const {MerchantActivationGuard}=require('../dist/modules/merchant-activation/merchant-activation.guard');
const {LineWebhooksService}=require('../dist/modules/line-webhooks/line-webhooks.service');
const {LineWebhooksController}=require('../dist/modules/line-webhooks/line-webhooks.controller');
const {LineChannelRuntimeService}=require('../dist/modules/line-webhooks/line-channel-runtime.service');
const {CredentialCipherService}=require('../dist/security/credential-cipher.service');
const {InternalAiService}=require('../dist/modules/internal-ai/internal-ai.service');
const {AiIntegrationService}=require('../dist/modules/ai-integration/ai-integration.service');
const {OnboardingService}=require('../dist/modules/onboarding/onboarding.service');

test('isolated restricted PostgreSQL activation, pause, races and signed A/B runtime',async t=>{
  const value=process.env.CHATTO_ACTIVATION_TEST_DATABASE_URL;
  assert.equal(process.env.CHATTO_ACTIVATION_TEST_DATABASE_CONFIRMED,'1');
  const url=new URL(value);assert.equal(url.hostname,'127.0.0.1');assert.notEqual(url.port,'5432');assert.match(url.pathname,/^\/chatto_b_test_[0-9a-f]{16}$/);
  const prisma=new PrismaClient({datasources:{db:{url:value}},log:[]});
  const originalFetch=global.fetch,originalEnv={...process.env};let app,pauseAi,releaseAi,pauseReply,releaseReply;
  t.after(async()=>{global.fetch=originalFetch;await app?.close();await prisma.$disconnect();for(const name of ['AI_SERVICE_TOKEN','LINE_CREDENTIAL_ACTIVE_KEY_ID','LINE_CREDENTIAL_KEYRING','WEB_URL'])originalEnv[name]===undefined?delete process.env[name]:process.env[name]=originalEnv[name];});
  process.env.AI_SERVICE_TOKEN=randomBytes(32).toString('hex');process.env.LINE_CREDENTIAL_ACTIVE_KEY_ID='activation-test';process.env.LINE_CREDENTIAL_KEYRING=JSON.stringify({'activation-test':randomBytes(32).toString('base64')});
  const [dbRole]=await prisma.$queryRawUnsafe('SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user');
  assert.deepEqual(dbRole,{rolsuper:false,rolcreatedb:false,rolcreaterole:false});
  const owner=await prisma.role.findFirst({where:{name:'Owner'}}),platform=await prisma.platform.findFirst({where:{code:'line'}});assert.ok(owner&&platform);
  const merchants=new MerchantsService(prisma),ownership=new StoreInformationService(prisma,merchants),settings=new MerchantAiSettingsService(prisma,ownership),activation=new MerchantActivationService(prisma,ownership),sessions=new AuthSessionService(prisma),cipher=new CredentialCipherService();
  const tenants=[];
  for(const label of ['A','B']){
    const user=await prisma.user.create({data:{name:'Activation '+label,globalRole:'merchant_user'}});
    const merchant=await prisma.merchant.create({data:{shopName:'Activation '+label,slug:randomUUID(),businessCategory:'other',operatingHours:'09:00–18:00',merchantUsers:{create:{userId:user.id,roleId:owner.id}}}});
    const secret=randomBytes(16).toString('hex'),token=randomBytes(32).toString('base64url'),channelId=randomUUID(),bot='U'+randomBytes(16).toString('hex');
    const channel=await prisma.channel.create({data:{id:channelId,merchantId:merchant.id,platformId:platform.id,channelName:'Synthetic '+label,externalChannelId:label==='A'?'7100000001':'7100000002',status:'CONNECTED',isConnected:true,credentialRevision:1,credentialsVerifiedAt:new Date(),webhookVerifiedAt:new Date(),lineClaimedAt:new Date(),lineBotUserId:bot,
      channelSecretEncrypted:cipher.encrypt(secret,{merchantId:merchant.id,channelId,field:'channelSecret'}),accessTokenEncrypted:cipher.encrypt(token,{merchantId:merchant.id,channelId,field:'channelAccessToken'})}});
    await settings.update(user.id,merchant.id,{assistantName:'Assistant '+label,tone:label==='A'?'friendly':'professional',rules:[{text:'Rule '+label}]});
    tenants.push({user,merchant,channel,secret,token,bot,session:await sessions.create(user.id)});
  }
  const [a,b]=tenants,requests=[],replies=[];
  const internal=new InternalAiService(prisma,settings),integration=new AiIntegrationService(internal),runtime=new LineChannelRuntimeService(prisma,cipher);
  global.fetch=async(target,init)=>{
    if(String(target).endsWith('/mcp/chat')){const request=JSON.parse(init.body);requests.push(request);if(pauseAi){const notify=pauseAi;pauseAi=null;notify();await new Promise(resolve=>{releaseAi=resolve;});}return new Response(JSON.stringify({request_id:request.request_id,merchant_id:request.merchant_id,conversation_id:request.conversation_id,reply:{text:'Synthetic '+request.ai_context.merchant_settings.bot_name},generation:{provider:'mock',used_external_provider:false,fallback_used:true},handover_required:false}));}
    return originalFetch(target,init);
  };
  const webhooks=new LineWebhooksService(prisma,runtime,integration,{reply:async(token,_reply,text)=>{replies.push({token,text});if(pauseReply){const notify=pauseReply;pauseReply=null;notify();await new Promise(resolve=>{releaseReply=resolve;});}return{outcome:'delivered',statusCode:200};}});
  class TestModule{}
  Module({controllers:[MerchantActivationController,LineWebhooksController],providers:[MerchantActivationGuard,{provide:AuthSessionService,useValue:sessions},{provide:MerchantActivationService,useValue:activation},{provide:LineWebhooksService,useValue:webhooks}]})(TestModule);
  app=await NestFactory.create(TestModule,{logger:false,rawBody:true});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));await app.listen(0,'127.0.0.1');
  const base=await app.getUrl();process.env.WEB_URL=base;
  const call=(who,method,path,body)=>originalFetch(base+path,{method,headers:{Cookie:'chatto_session='+who.session,Origin:base,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  const event=id=>({type:'message',timestamp:Date.now(),webhookEventId:id,source:{type:'user',userId:'same-line-user'},replyToken:'synthetic-reply',message:{type:'text',id:'message-'+id,text:'hello'}});
  const send=(who,input=event(randomUUID()),signature,channelId=who.channel.id)=>{const raw=JSON.stringify({destination:who.bot,events:[input]});return originalFetch(base+'/webhooks/line/'+channelId,{method:'POST',headers:{'Content-Type':'application/json','x-line-signature':signature??createHmac('sha256',who.secret).update(raw).digest('base64')},body:raw});};
  const onboard=new OnboardingService(prisma,merchants),route=who=>'/merchants/'+who.merchant.id+'/activation';
  await t.test('readiness is safe, scoped and ready with zero optional products/FAQ',async()=>{
    for(const who of tenants){const response=await call(who,'GET',route(who)+'/readiness');assert.equal(response.status,200);const r=await response.json();assert.equal(r.ready,true);assert.equal(r.aiEnabled,false);assert.equal(r.checks.knowledge.faqCount,0);assert.equal(r.checks.knowledge.productsCount,0);assert.ok(!/Encrypted|channelSecret|accessToken/.test(JSON.stringify(r)));assert.equal((await onboard.status(who.user.id,who.merchant.id)).progress,83);}
    for(const method of ['GET','POST','DELETE'])assert.equal((await call(a,method,route(b)+(method==='GET'?'/readiness':''),method==='GET'?undefined:{})).status,404);
    assert.equal((await call(a,'POST',route(a),{ready:true})).status,400);
  });
  await t.test('disabled webhook stores inbound, returns 200, verifies HMAC and stays idempotent',async()=>{
    const input=event(randomUUID());const response=await send(a,input);assert.equal(response.status,200);assert.equal((await response.json()).ok,true);assert.equal(requests.length,0);assert.equal(replies.length,0);
    const duplicate=await send(a,input);assert.equal((await duplicate.json()).duplicateEvents,1);
    assert.equal(await prisma.message.count({where:{merchantId:a.merchant.id,senderType:'CUSTOMER'}}),1);assert.equal(await prisma.message.count({where:{merchantId:a.merchant.id,senderType:'AI'}}),0);
    assert.equal((await send(a,event(randomUUID()),'a'.repeat(43)+'=')).status,401);assert.equal((await send(a,event(randomUUID()),undefined,randomUUID())).status,404);
  });
  await t.test('simultaneous activation persists one timestamp, actor and audit event',async()=>{
    const results=await Promise.all(Array.from({length:8},()=>activation.activate(a.user.id,a.merchant.id)));
    assert.equal(results.filter(r=>!r.alreadyEnabled).length,1);assert.equal(new Set(results.map(r=>r.activatedAt)).size,1);
    const row=await prisma.aiSetting.findUnique({where:{merchantId:a.merchant.id}});assert.equal(row.aiEnabled,true);assert.equal(row.aiActivatedByUserId,a.user.id);assert.ok(row.aiActivatedAt);
    assert.equal(await prisma.aiActionLog.count({where:{merchantId:a.merchant.id,actionType:'AI_ACTIVATED'}}),1);assert.equal((await onboard.status(a.user.id,a.merchant.id)).progress,100);assert.equal((await activation.readiness(b.user.id,b.merchant.id)).aiEnabled,false);
  });
  await t.test('same LINE user stays isolated and only enabled merchant invokes scoped AI/credentials',async()=>{
    const input=event(randomUUID());await send(a,input);await send(b,input);assert.equal(requests.length,1);assert.equal(replies.length,1);assert.equal(requests[0].merchant_id,a.merchant.id);assert.equal(requests[0].ai_context.merchant_settings.ai_profile.rules[0].text,'Rule A');assert.equal(replies[0].token,a.token);
    const customers=await prisma.customer.findMany({where:{merchantId:{in:tenants.map(w=>w.merchant.id)},externalUserId:'same-line-user'}});assert.equal(customers.length,2);assert.notEqual(customers[0].id,customers[1].id);
    await activation.activate(b.user.id,b.merchant.id);await send(b);assert.equal(requests.at(-1).merchant_id,b.merchant.id);assert.equal(requests.at(-1).ai_context.merchant_settings.ai_profile.rules[0].text,'Rule B');assert.equal(replies.at(-1).token,b.token);
    for(const request of requests){assert.ok(request.ai_context.products.products.every(p=>p.merchant_id===request.merchant_id));assert.ok(request.ai_context.knowledge_base.knowledge_base.every(d=>d.merchant_id===request.merchant_id));}
  });
  await t.test('pause during LLM suppresses outbound without affecting B or disconnecting A',async()=>{
    const before=replies.length,channel=await prisma.channel.findUnique({where:{id:a.channel.id}}),profile=await settings.read(a.user.id,a.merchant.id);
    const started=new Promise(resolve=>{pauseAi=resolve;});const work=send(a);await started;await activation.deactivate(a.user.id,a.merchant.id);releaseAi();assert.equal((await work).status,200);assert.equal(replies.length,before);
    assert.equal((await activation.deactivate(a.user.id,a.merchant.id)).alreadyDisabled,true);assert.deepEqual(await prisma.channel.findUnique({where:{id:a.channel.id}}),channel);assert.deepEqual(await settings.read(a.user.id,a.merchant.id),profile);assert.equal((await activation.readiness(b.user.id,b.merchant.id)).aiEnabled,true);assert.equal((await onboard.status(a.user.id,a.merchant.id)).progress,83);
  });
  await t.test('pause waits for authorized in-flight delivery and no replies occur after it returns',async()=>{
    await activation.activate(a.user.id,a.merchant.id);const started=new Promise(resolve=>{pauseReply=resolve;});const work=send(a);await started;
    let paused=false;const pause=activation.deactivate(a.user.id,a.merchant.id).then(()=>{paused=true;});await new Promise(resolve=>setTimeout(resolve,100));assert.equal(paused,false);releaseReply();assert.equal((await work).status,200);await pause;
    const before=replies.length,aiBefore=requests.length;await send(a);assert.equal(replies.length,before);assert.equal(requests.length,aiBefore);
  });
  await t.test('pause then immediate resume invalidates the previous activation epoch',async()=>{
    await activation.activate(a.user.id,a.merchant.id);const before=replies.length,started=new Promise(resolve=>{pauseAi=resolve;});const work=send(a);await started;
    const previous=(await activation.readiness(a.user.id,a.merchant.id)).activatedAt;await activation.deactivate(a.user.id,a.merchant.id);await activation.activate(a.user.id,a.merchant.id);
    assert.notEqual((await activation.readiness(a.user.id,a.merchant.id)).activatedAt,previous);releaseAi();assert.equal((await work).status,200);assert.equal(replies.length,before);
    await send(a);assert.equal(replies.length,before+1);await activation.deactivate(a.user.id,a.merchant.id);
  });
  await t.test('webhook arriving during activation waits for committed state',async()=>{
    let release,started;const entered=new Promise(resolve=>{started=resolve;});
    const waitingDb=new Proxy(prisma,{get(target,key){
      if(key==='$transaction')return(callback,options)=>prisma.$transaction(async tx=>callback(new Proxy(tx,{get(db,field){
        if(field==='aiSetting')return new Proxy(tx.aiSetting,{get(model,method){if(method==='update')return async args=>{const row=await tx.aiSetting.update(args);started();await new Promise(resolve=>{release=resolve;});return row;};return Reflect.get(model,method);}});
        return Reflect.get(db,field);
      }})),options);
      return Reflect.get(target,key);
    }});
    const work=new MerchantActivationService(waitingDb,ownership).activate(a.user.id,a.merchant.id);await entered;
    const before=replies.length;let webhookFinished=false;const incoming=send(a).then(r=>{webhookFinished=true;return r;});await new Promise(resolve=>setTimeout(resolve,100));assert.equal(webhookFinished,false);
    release();await work;assert.equal((await incoming).status,200);assert.equal(replies.length,before+1);await activation.deactivate(a.user.id,a.merchant.id);
  });
  await t.test('server rejects changed readiness; no data deletion and no client enabled override',async()=>{
    await prisma.merchant.update({where:{id:a.merchant.id},data:{operatingHours:null}});const response=await call(a,'POST',route(a),{});assert.equal(response.status,409);assert.equal((await response.json()).code,'MERCHANT_NOT_READY');
    assert.equal((await call(a,'DELETE',route(a),{enabled:false})).status,400);assert.equal(await prisma.channel.count({where:{merchantId:a.merchant.id}}),1);assert.equal(await prisma.aiSetting.count({where:{merchantId:a.merchant.id}}),1);
  });
});
