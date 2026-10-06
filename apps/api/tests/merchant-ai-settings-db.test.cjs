// Explicit opt-in. Synthetic users/merchants/channels are inside one rolled-back
// PostgreSQL transaction; no real provider calls or existing records are changed.
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID,randomBytes,createHmac}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {NestFactory}=require('@nestjs/core'),{Module,ValidationPipe}=require('@nestjs/common');
const {AuthSessionService,hashToken}=require('../dist/auth/auth-session.service');
const {MerchantAiSettingsController}=require('../dist/modules/merchant-ai-settings/merchant-ai-settings.controller');
const {MerchantAiSettingsGuard}=require('../dist/modules/merchant-ai-settings/merchant-ai-settings.guard');
const {MerchantAiSettingsService}=require('../dist/modules/merchant-ai-settings/merchant-ai-settings.service');
const {StoreInformationService}=require('../dist/modules/store-information/store-information.service');
const {InternalAiService}=require('../dist/modules/internal-ai/internal-ai.service');
const {AiIntegrationService}=require('../dist/modules/ai-integration/ai-integration.service');
const {LineWebhooksService}=require('../dist/modules/line-webhooks/line-webhooks.service');
const {LineChannelRuntimeService}=require('../dist/modules/line-webhooks/line-channel-runtime.service');
const {CredentialCipherService}=require('../dist/security/credential-cipher.service');
const {DEFAULT_MERCHANT_AI_SETTINGS:D}=require('../dist/modules/merchant-ai-settings/merchant-ai-settings.types');

test('restricted-role PostgreSQL settings/rules and signed LINE A/B pipeline remain tenant-scoped with rollback', {skip:!process.env.CHATTO_AI_SETTINGS_DB_TEST_URL},async t=>{
 const prisma=new PrismaClient({datasources:{db:{url:process.env.CHATTO_AI_SETTINGS_DB_TEST_URL}},log:[]});
 const rollback=Error('ROLLBACK_SYNTHETIC_AI_SETTINGS_FIXTURES'),originalFetch=global.fetch;
 const savedEnv=Object.fromEntries(['AI_SERVICE_TOKEN','LINE_CREDENTIAL_ACTIVE_KEY_ID','LINE_CREDENTIAL_KEYRING'].map(key=>[key,process.env[key]]));
 process.env.AI_SERVICE_TOKEN=randomBytes(32).toString('hex');process.env.LINE_CREDENTIAL_ACTIVE_KEY_ID='test';process.env.LINE_CREDENTIAL_KEYRING=JSON.stringify({test:randomBytes(32).toString('base64')});
 t.after(async()=>{global.fetch=originalFetch;for(const [key,value]of Object.entries(savedEnv))value===undefined?delete process.env[key]:process.env[key]=value;await prisma.$disconnect();});
 await assert.rejects(prisma.$transaction(async tx=>{
  const database=new Proxy(tx,{get(target,key){if(key==='$transaction')return callback=>callback(target);return Reflect.get(target,key);}});
  const role=await tx.role.findFirst({where:{name:'Owner'}}),platform=await tx.platform.findFirst({where:{code:'line',status:'active'}});
  assert.ok(role&&platform,'Existing reference roles/platform must be available');
  const stores=[];
  for(const label of ['A','B']){
   const user=await tx.user.create({data:{name:'AI settings rollback '+label,globalRole:'merchant_user'}});
   const merchant=await tx.merchant.create({data:{shopName:'AI settings rollback '+label,slug:randomUUID(),businessCategory:'other',operatingHours:'09:00–18:00',merchantUsers:{create:{userId:user.id,roleId:role.id}}}});
   stores.push({user,merchant});
  }
  const ownership=new StoreInformationService(database,{}),settings=new MerchantAiSettingsService(database,ownership);
  const [a,b]=stores;
  const session=randomBytes(32).toString('base64url');
  await tx.authSession.create({data:{userId:a.user.id,tokenHash:hashToken(session),expiresAt:new Date(Date.now()+60000)}});
  class DatabaseHttpModule{}
  Module({controllers:[MerchantAiSettingsController],providers:[MerchantAiSettingsGuard,{provide:AuthSessionService,useValue:new AuthSessionService(database)},{provide:MerchantAiSettingsService,useValue:settings}]})(DatabaseHttpModule);
  const app=await NestFactory.create(DatabaseHttpModule,{logger:false});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));await app.listen(0,'127.0.0.1');
  try{
   const base=await app.getUrl(),route='/merchants/'+a.merchant.id+'/ai-settings';
   const call=(pathname,body)=>originalFetch(base+pathname,{method:body===undefined?'GET':'PATCH',headers:{Cookie:'chatto_session='+session,Origin:'http://localhost:3000',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
   assert.equal((await originalFetch(base+route)).status,401);
   const defaults=await call(route);assert.equal(defaults.status,200);assert.equal((await defaults.json()).assistantName,D.assistantName);assert.equal(await tx.aiSetting.count({where:{merchantId:a.merchant.id}}),0);
   assert.equal((await call('/merchants/'+b.merchant.id+'/ai-settings')).status,404);
   assert.equal((await call('/merchants/'+b.merchant.id+'/ai-settings',{assistantName:'Forbidden'})).status,404);
   assert.equal((await call(route,{merchantId:b.merchant.id})).status,400);
   assert.equal((await call(route,{assistantName:'HTTP saved A',rules:[{text:'HTTP Rule A'}]})).status,200);
   const state=await (await call(route)).json();assert.equal(state.assistantName,'HTTP saved A');assert.equal(state.rules.length,1);
   assert.equal((await call(route,{rules:[{id:state.rules[0].id,text:'HTTP edited A'}]})).status,200);
   assert.equal((await call(route,{rules:[]})).status,200);
  }finally{await app.close();}
  assert.equal((await settings.read(a.user.id,a.merchant.id)).assistantName,'HTTP saved A');
  const stateA=await settings.update(a.user.id,a.merchant.id,{assistantName:'Assistant A',tone:'friendly',capabilities:{...D.capabilities,showPromotions:false},rules:[{text:'Rule A'},{text:'Remove A'}]});
  const stateB=await settings.update(b.user.id,b.merchant.id,{assistantName:'Assistant B',tone:'professional',rules:[{text:'Rule B'}]});
  await assert.rejects(settings.read(a.user.id,b.merchant.id),e=>e.getStatus()===404);
  await assert.rejects(settings.update(a.user.id,b.merchant.id,{assistantName:'Forbidden'}),e=>e.getStatus()===404);
  await assert.rejects(settings.update(a.user.id,a.merchant.id,{rules:[{id:stateB.rules[0].id,text:'Foreign'}]}),e=>e.getStatus()===400);
  const edit=await settings.update(a.user.id,a.merchant.id,{rules:[{id:stateA.rules[0].id,text:'Rule A edited'}]});
  assert.equal(edit.rules[0].id,stateA.rules[0].id);assert.equal(edit.rules.length,1);
  assert.equal((await settings.read(b.user.id,b.merchant.id)).rules[0].text,'Rule B');
  const internal=new InternalAiService(database,settings),requests=[],delivered=[];
  global.fetch=async(_url,init)=>{const body=JSON.parse(init.body);requests.push(body);return new Response(JSON.stringify({request_id:body.request_id,merchant_id:body.merchant_id,conversation_id:body.conversation_id,reply:{text:'Synthetic '+body.ai_context.merchant_settings.bot_name},handover_required:false,generation:{provider:'mock',model:null,used_external_provider:false,fallback_used:true}}));};
  const cipher=new CredentialCipherService(),runtime=new LineChannelRuntimeService(database,cipher);
  const webhooks=new LineWebhooksService(database,runtime,new AiIntegrationService(internal),{reply:async(token,_reply,text)=>{delivered.push({token,text});return{outcome:'delivered',statusCode:200};}});
  for(const store of stores){
   const channelId=randomUUID(),secret=randomBytes(16).toString('hex'),accessToken=randomBytes(32).toString('base64url'),bot='U'+randomBytes(16).toString('hex');
   const channel=await tx.channel.create({data:{id:channelId,merchantId:store.merchant.id,platformId:platform.id,channelName:'Synthetic rollback LINE',externalChannelId:String(1000000000+Math.floor(Math.random()*900000000)),credentialRevision:1,status:'CONNECTED',isConnected:true,credentialsVerifiedAt:new Date(),webhookVerifiedAt:new Date(),lineClaimedAt:new Date(),lineBotUserId:bot,
    channelSecretEncrypted:cipher.encrypt(secret,{merchantId:store.merchant.id,channelId,field:'channelSecret'}),accessTokenEncrypted:cipher.encrypt(accessToken,{merchantId:store.merchant.id,channelId,field:'channelAccessToken'})}});
   const marker='SYNTHETIC '+store.merchant.id;
   await new (require('../dist/modules/merchant-activation/merchant-activation.service').MerchantActivationService)(database,ownership).activate(store.user.id,store.merchant.id);
   const event={destination:bot,events:[{type:'message',timestamp:Date.now(),webhookEventId:randomUUID(),source:{type:'user',userId:'U'+ 'f'.repeat(32)},replyToken:'synthetic-reply',message:{id:randomUUID(),type:'text',text:marker}}]};
   const raw=Buffer.from(JSON.stringify(event)),signature=createHmac('sha256',secret).update(raw).digest('base64');
   const result=await webhooks.receive(channel.id,signature,raw);assert.equal(result.processedEvents,1);
   const duplicate=await webhooks.receive(channel.id,signature,raw);assert.equal(duplicate.duplicateEvents,1);
   await assert.rejects(webhooks.receive(channel.id,'a'.repeat(43)+'=',raw),e=>e.getStatus()===401);
   const wrongMerchant=stores.find(s=>s!==store).merchant.id;
   assert.equal(await tx.message.count({where:{merchantId:wrongMerchant,content:marker}}),0);
   assert.equal(requests.at(-1).merchant_id,store.merchant.id);
   const p=requests.at(-1).ai_context.merchant_settings.ai_profile;
   assert.deepEqual(p.rules.map(r=>r.text),store===a?['Rule A edited']:['Rule B']);
   assert.equal(delivered.at(-1).token,accessToken);
  }
  assert.equal(requests.length,2);assert.equal(delivered.length,2);
  const customers=await tx.customer.findMany({where:{merchantId:{in:stores.map(s=>s.merchant.id)}}});assert.equal(customers.length,2);assert.notEqual(customers[0].id,customers[1].id);assert.equal(customers[0].externalUserId,customers[1].externalUserId);
  throw rollback;
 },{timeout:30000}),error=>error===rollback);
});
