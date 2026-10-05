const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { NestFactory } = require("@nestjs/core");
const { Module, ValidationPipe } = require("@nestjs/common");
const { AuthSessionService,hashToken } = require("../dist/auth/auth-session.service");
const { StoreInformationService } = require("../dist/modules/store-information/store-information.service");
const { StoreInformationController } = require("../dist/modules/store-information/store-information.controller");
const { CatalogImportsController } = require("../dist/modules/catalog-imports/catalog-imports.controller");
const { CatalogImportsService,validateCatalogFile } = require("../dist/modules/catalog-imports/catalog-imports.service");
const { OnboardingService } = require("../dist/modules/onboarding/onboarding.service");

const userId=randomUUID(),merchantId=randomUUID(),foreignId=randomUUID();
const valid={shopName:"Thai shop",businessCategory:"flowers",operatingHours:"09:30–18:00",revision:1,faqs:[]};
const store={id:merchantId,...valid,informationRevision:1,status:"TRIAL"};
const owner={status:"ACTIVE",role:{name:"Owner"},merchant:{status:"TRIAL"}};

test("authorization requires active membership and Owner for writes, and multiple stores require selection",async()=>{
  let membership=owner;
  const prisma={merchantUser:{findUnique:async({where})=>where.merchantId_userId.merchantId===merchantId?membership:null}};
  const info=new StoreInformationService(prisma,{});
  await info.authorize(userId,merchantId,true);
  await assert.rejects(info.authorize(userId,foreignId),e=>e.getStatus()===404);
  membership={...owner,role:{name:"Staff"}};await info.authorize(userId,merchantId);await assert.rejects(info.authorize(userId,merchantId,true),e=>e.getStatus()===403);
  membership={...owner,status:"INACTIVE"};await assert.rejects(info.authorize(userId,merchantId),e=>e.getStatus()===404);
  const onboarding=new OnboardingService({}, {findForUser:async()=>[{merchant:store,role:{name:"Owner"}},{merchant:{...store,id:foreignId},role:{name:"Owner"}}]});
  const result=await onboarding.status(userId);assert.equal(result.merchant,null);assert.equal(result.progress,33);assert.equal(result.memberships.length,2);
  let owners=[{user:{id:userId}}];
  const shared=new OnboardingService({$queryRawUnsafe:async()=>[{id:'canonical-line-platform'}],channel:{findFirst:async()=>null},aiSetting:{findUnique:async()=>null},product:{findFirst:async()=>null},knowledgeBaseDocument:{findMany:async()=>[]}}, {findForUser:async()=>[{merchant:store,role:{name:'Staff'}}],findOwners:async()=>owners});
  assert.equal((await shared.status(userId,merchantId)).progress,50,'read-only members see readiness of an owned store');owners=[];assert.equal((await shared.status(userId,merchantId)).progress,33);
});

test("atomic information revision checks reject concurrent stale writes before FAQ updates",async()=>{
  let revision=1,faqWrites=0,previous=Promise.resolve();
  const tx={
    $executeRaw:async()=>1,
    merchantUser:{findUnique:async()=>owner},
    merchant:{updateMany:async({where})=>{if(where.informationRevision!==revision)return{count:0};revision++;return{count:1};},findUniqueOrThrow:async()=>({...store,informationRevision:revision})},
    knowledgeBaseDocument:{findMany:async()=>[],updateMany:async()=>{faqWrites++;}},
  };
  const prisma={$transaction:callback=>{const request=previous.then(()=>callback(tx));previous=request.catch(()=>{});return request;}};
  const info=new StoreInformationService(prisma,{});
  const result=await Promise.allSettled([info.update(userId,merchantId,valid),info.update(userId,merchantId,valid)]);
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(result.find(r=>r.status==='rejected').reason.getStatus(),409);assert.equal(faqWrites,1);
});

test("real Nest endpoints validate DTOs, session identity, origin, UUIDs and multipart before writes",async()=>{
  const token="s".repeat(43);let expired=false,writes=0,uploads=0;
  const sessions=new AuthSessionService({authSession:{findUnique:async({where})=>where.tokenHash===hashToken(token)?{expiresAt:new Date(Date.now()+(expired?-1000:60000)),user:{id:userId,name:'Test',status:'ACTIVE',globalRole:'merchant_user'}}:null}});
  const information=new StoreInformationService({merchantUser:{findUnique:async({where})=>where.merchantId_userId.merchantId===merchantId?owner:null}},{});
  information.read=async(id,merchant)=>{assert.equal(id,userId);await information.authorize(id,merchant);return{merchant:store,faqs:[],canEdit:true};};
  information.update=async(id,merchant,body)=>{assert.equal(id,userId);await information.authorize(id,merchant,true);assert.equal(body.userId,undefined);writes++;return{merchant:store,faqs:[],canEdit:true};};
  const imports={reserveUpload:()=>()=>{},upload:async(id,merchant,file)=>{assert.equal(id,userId);assert.equal(merchant,merchantId);validateCatalogFile(file);uploads++;return{id:randomUUID(),status:'PARSING'};},read:async()=>{throw new Error('not used');}};
  class TestModule{}
  Module({controllers:[StoreInformationController,CatalogImportsController],providers:[{provide:AuthSessionService,useValue:sessions},{provide:StoreInformationService,useValue:information},{provide:CatalogImportsService,useValue:imports}]})(TestModule);
  const app=await NestFactory.create(TestModule,{logger:false});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));await app.listen(0,'127.0.0.1');
  const base=await app.getUrl();const request=(pathname,options={})=>fetch(base+pathname,{...options,headers:{Cookie:`chatto_session=${token}`,Origin:'http://localhost:3000',...options.headers}});
  const informationPath=`/merchants/${merchantId}/information`;
  try{
    assert.equal((await fetch(base+informationPath)).status,401);assert.equal((await request('/merchants/invalid/information')).status,400);assert.equal((await request(`/merchants/${foreignId}/information`)).status,404);
    const patch=(body,headers={})=>request(informationPath,{method:'PATCH',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
    for(const body of [{...valid,shopName:' '},{...valid,revision:-1},{...valid,faqs:[{question:'Q',answer:''}]},{...valid,email:'bad'}])assert.equal((await patch(body)).status,400);
    assert.equal(writes,0);assert.equal((await patch(valid,{Origin:'https://foreign.example'})).status,403);
    assert.equal((await patch({...valid,userId:foreignId})).status,200);assert.equal(writes,1);
    expired=true;assert.equal((await patch(valid)).status,401);expired=false;
    const upload=async(name,type,text,headers={})=>{const body=new FormData();body.append('file',new Blob([text],{type}),name);return request(`/merchants/${merchantId}/catalog-imports`,{method:'POST',body,headers});};
    assert.equal((await upload('catalog.csv','text/csv','name\nFlower')).status,202);assert.equal(uploads,1);
    assert.equal((await upload('catalog.pdf','application/pdf','fake')).status,400);assert.equal(uploads,1);
    assert.equal((await upload('catalog.csv','text/csv','name\nA',{Origin:'https://foreign.example'})).status,403);
    assert.equal((await request(`/merchants/${foreignId}/catalog-imports`,{method:'POST'})).status,404);
    const template=await request(`/merchants/${merchantId}/catalog-imports/template/csv`);assert.equal(template.status,200);assert.ok((await template.text()).includes('ดอกไม้'));assert.ok(template.headers.get('content-disposition').includes('attachment'));
  }finally{await app.close();}
});

test("isolated parser worker persists preview and failures and cleans private files without importing products",async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'chatto-worker-test-'));process.env.CATALOG_STORAGE_DIR=directory;
  const jobs=new Map();let mutations=0;
  const tx={$executeRaw:async()=>1,catalogImport:{
    findUnique:async({where})=>where.id?jobs.get(where.id):[...jobs.values()].find(job=>job.sha256===where.merchantId_sha256.sha256&&job.merchantId===where.merchantId_sha256.merchantId),
    create:async({data})=>{const job={id:randomUUID(),...data};jobs.set(job.id,job);return job;},
    updateMany:async({where,data})=>{let count=0;for(const job of jobs.values())if(job.id===where.id&&job.status===where.status&&(!where.storageKey||job.storageKey===where.storageKey)){Object.assign(job,data);count++;}return{count};},
  },product:{findMany:async()=>[],create:async()=>{mutations++;}}};
  tx.catalogImport.findUniqueOrThrow=async({where})=>jobs.get(where.id);
  const database={...tx,$transaction:callback=>callback(tx)};
  const WorkerService=process.env.CHATTO_TEST_SOURCE === '1' ? require('../src/modules/catalog-imports/catalog-imports.service.ts').CatalogImportsService : CatalogImportsService;
  const imports=new WorkerService(database,{authorize:async()=>owner});
  const file=(originalname,mimetype,text)=>({originalname,mimetype,buffer:Buffer.from(text),size:Buffer.byteLength(text)});
  const wait=async(id)=>{for(let i=0;i<200;i++){const job=jobs.get(id);if(job.status!=='PARSING')return job;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Worker timed out');};
  try{
    const job=await imports.upload(userId,merchantId,file('../../catalog.csv','text/csv','name,description\nดอกไม้,ช่อดอกไม้'));
    assert.equal(job.originalName,'catalog.csv');assert.equal((await wait(job.id)).status,'PREVIEW');assert.equal(job.preview.validCount,1);assert.equal(mutations,0);assert.deepEqual(await fs.readdir(directory),[]);
    const retry=await imports.upload(userId,merchantId,file('again.csv','text/csv','name,description\nดอกไม้,ช่อดอกไม้'));assert.equal(retry.id,job.id);assert.equal(jobs.size,1);
    const bad=await imports.upload(userId,merchantId,file('bad.pdf','application/pdf','%PDF-broken'));assert.equal((await wait(bad.id)).status,'FAILED');assert.ok(bad.error);assert.deepEqual(await fs.readdir(directory),[]);
    const releases=[imports.reserveUpload(),imports.reserveUpload()];assert.throws(()=>imports.reserveUpload(),error=>error.getStatus()===503);releases.forEach(release=>release());
  }finally{await imports.onModuleDestroy();delete process.env.CATALOG_STORAGE_DIR;await fs.rm(directory,{recursive:true,force:true});}
});

test("confirmation is merchant scoped, transactional and idempotent; omitted columns preserve existing product data",async()=>{
  const {previewTable}=require('../dist/modules/catalog-imports/catalog-parser');
  const job={id:randomUUID(),merchantId,status:'PREVIEW',expiresAt:new Date(Date.now()+60000),preview:previewTable([['name'],[' Existing '],['New'],['']])};
  let products=[{id:randomUUID(),name:'existing',description:'Keep this',category:'flowers',brand:'Original'}],lastError=null;
  const tx={$executeRaw:async()=>1,catalogImport:{
    findFirst:async({where})=>where.id===job.id&&where.merchantId===merchantId?job:null,
    update:async({data})=>{Object.assign(job,data);return job;},
  },product:{
    findMany:async({where})=>{assert.equal(where.merchantId,merchantId);return products;},
    create:async({data})=>{const product={id:randomUUID(),...data};products.push(product);return product;},
    update:async({where,data})=>{const product=products.find(p=>p.id===where.id);Object.assign(product,data);return product;},
  }};
  const database={...tx,catalogImport:{...tx.catalogImport,updateMany:async({where,data})=>{assert.equal(where.merchantId,merchantId);lastError=data.error;return{count:1};}},$transaction:async(callback)=>{
    const previousProducts=structuredClone(products),previousJob=structuredClone(job);
    try{return await callback(tx);}catch(error){products=previousProducts;Object.assign(job,previousJob);throw error;}
  }};
  const imports=new CatalogImportsService(database,{authorize:async(user)=>{if(user!==userId){const {NotFoundException}=require('@nestjs/common');throw new NotFoundException();}return owner;}});
  await assert.rejects(imports.confirm(userId,foreignId,job.id),error=>error.getStatus()===404);
  await assert.rejects(imports.confirm(foreignId,merchantId,job.id),error=>error.getStatus()===404);
  const result=await imports.confirm(userId,merchantId,job.id);assert.equal(result.status,'IMPORTED');assert.equal(result.createdCount,1);assert.equal(result.updatedCount,1);assert.equal(result.rejectedCount,1);assert.equal(products.length,2);assert.equal(products[0].description,'Keep this');
  await imports.confirm(userId,merchantId,job.id);assert.equal(products.length,2);
  await assert.rejects(imports.cancel(userId,merchantId,job.id),error=>error.getStatus()===409);
  job.status='PREVIEW';job.preview=previewTable([['name'],['Third'],['Fourth']]);let calls=0;
  tx.product.create=async({data})=>{if(++calls===2)throw Error('Simulated database failure');const product={id:randomUUID(),...data};products.push(product);return product;};
  await assert.rejects(imports.confirm(userId,merchantId,job.id),/Simulated database failure/);assert.equal(products.length,2);assert.equal(job.status,'PREVIEW');assert.ok(lastError.includes('no products were changed'));
  const cancelled=await imports.cancel(userId,merchantId,job.id);assert.equal(cancelled.status,'CANCELLED');assert.equal(job.storageKey,null);await assert.rejects(imports.confirm(userId,merchantId,job.id),error=>error.getStatus()===409);assert.equal(products.length,2);
});
