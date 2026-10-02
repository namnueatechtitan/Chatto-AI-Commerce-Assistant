// Run only after explicit local-development confirmation and migrate deploy.
// Every fixture, product, FAQ and import is rolled back. No seed/reset is used.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {ConfigModule}=require('@nestjs/config');
const {PrismaClient}=require('@prisma/client');
const {MerchantsService}=require('../dist/modules/merchants.module');
const {StoreInformationService}=require('../dist/modules/store-information/store-information.service');
const {CatalogImportsService}=require('../dist/modules/catalog-imports/catalog-imports.service');
const {OnboardingService}=require('../dist/modules/onboarding/onboarding.service');
ConfigModule.forRoot({envFilePath:['../../.env','.env']});

test('PostgreSQL: atomic create, retries, FAQ isolation, revision conflicts, imports and rollback',{skip:process.env.CHATTO_LOCAL_DB_TESTS!=='1'},async()=>{
  const prisma=new PrismaClient(),userId=randomUUID(),outsiderId=randomUUID(),requestId=randomUUID();
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'chatto-pg-catalog-'));process.env.CATALOG_STORAGE_DIR=directory;
  const rollback=new Error('Rollback all store test fixtures');let imports;
  try{
    await assert.rejects(prisma.$transaction(async(tx)=>{
      let counter=0;
      const database=new Proxy(tx,{get(target,key){
        if(key==='$transaction')return async callback=>{
          const name=`store_test_${++counter}`;
          await tx.$executeRawUnsafe(`SAVEPOINT "${name}"`);
          try{const value=await callback(tx);await tx.$executeRawUnsafe(`RELEASE SAVEPOINT "${name}"`);return value;}
          catch(error){await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT "${name}"`);await tx.$executeRawUnsafe(`RELEASE SAVEPOINT "${name}"`);throw error;}
        };
        return Reflect.get(target,key);
      }});
      const merchants=new MerchantsService(database),information=new StoreInformationService(database,merchants),onboarding=new OnboardingService(database,merchants);
      imports=new CatalogImportsService(database,information);
      await tx.user.createMany({data:[{id:userId,name:'Store test',globalRole:'merchant_user'},{id:outsiderId,name:'Other store test',globalRole:'merchant_user'}]});
      const data={shopName:'ร้านทดสอบ',businessCategory:'flowers',operatingHours:'จ.–ศ. 09:30–18:00',requestId,faqs:[{question:'จัดส่งไหม?',answer:'จัดส่งทั่วประเทศ'}]};
      const first=await information.create(userId,data),id=first.merchant.id;
      assert.equal((await information.create(userId,data)).merchant.id,id);assert.equal(await tx.merchantUser.count({where:{userId}}),1);
      assert.equal(first.faqs.length,1);assert.equal((await onboarding.status(userId,id)).progress,50);
      await assert.rejects(information.create(userId,{...data,requestId:randomUUID()}),error=>error.getStatus()===409);
      const other=await information.create(outsiderId,{...data,requestId:randomUUID()}),foreignFaq=other.faqs[0];
      await assert.rejects(information.read(outsiderId,id),error=>error.getStatus()===404);
      const unrelated=await tx.knowledgeBaseDocument.create({data:{merchantId:id,type:'policy',title:'Keep this',content:'Unrelated policy'}});
      const revision=first.merchant.informationRevision;
      await assert.rejects(information.update(userId,id,{...data,revision,faqs:[foreignFaq]}),error=>error.getStatus()===400);
      assert.equal((await information.read(userId,id)).merchant.informationRevision,revision,'invalid FAQ rolls back the merchant update');
      const updated=await information.update(userId,id,{...data,revision,description:'Updated',faqs:[{...first.faqs[0],answer:'Updated FAQ'}]});
      assert.equal(updated.faqs[0].id,first.faqs[0].id);assert.equal(updated.merchant.id,id);
      await assert.rejects(information.update(userId,id,{...data,revision}),error=>error.getStatus()===409);
      const archived=await information.update(userId,id,{...data,revision:updated.merchant.informationRevision,faqs:[]});
      assert.equal(archived.faqs.length,0);assert.equal((await tx.knowledgeBaseDocument.findUnique({where:{id:first.faqs[0].id}})).status,'ARCHIVED');
      assert.equal((await tx.knowledgeBaseDocument.findUnique({where:{id:unrelated.id}})).status,'ACTIVE');assert.equal((await information.read(outsiderId,other.merchant.id)).faqs[0].answer,data.faqs[0].answer);
      assert.equal((await onboarding.status(userId,id)).progress,50,'empty FAQ and no catalog are valid for Step 3');
      const file=(name,text)=>({originalname:name,mimetype:'text/csv',buffer:Buffer.from(text),size:Buffer.byteLength(text)});
      const csv='name,description,category,brand\nดอกไม้,ช่อดอกไม้,flowers,Chatto\n,Invalid,,\n';
      const job=await imports.upload(userId,id,file('../../catalog.csv',csv));
      const wait=async(jobId)=>{for(let i=0;i<200;i++){const current=await imports.read(userId,id,jobId);if(current.status!=='PARSING')return current;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Parser timed out');};
      const preview=await wait(job.id);assert.equal(preview.status,'PREVIEW');assert.equal(await tx.product.count({where:{merchantId:id}}),0);
      await assert.rejects(imports.confirm(outsiderId,id,job.id),error=>error.getStatus()===404);
      await assert.rejects(imports.confirm(outsiderId,other.merchant.id,job.id),error=>error.getStatus()===404);
      const result=await imports.confirm(userId,id,job.id);assert.equal(result.createdCount,1);assert.equal(result.rejectedCount,1);assert.equal(result.status,'IMPORTED');
      assert.equal((await imports.confirm(userId,id,job.id)).createdCount,1);assert.equal((await imports.upload(userId,id,file('retry.csv',csv))).id,job.id);assert.equal(await tx.product.count({where:{merchantId:id}}),1);
      const changed=await imports.upload(userId,id,file('update.csv','name,description,category,brand\n ดอกไม้ ,New bouquet,flowers,Chatto\n'));await wait(changed.id);assert.equal((await imports.confirm(userId,id,changed.id)).updatedCount,1);assert.equal(await tx.product.count({where:{merchantId:id}}),1);
      const cancelled=await imports.upload(userId,id,file('cancel.csv','name\nAnother flower\n'));await wait(cancelled.id);await imports.cancel(userId,id,cancelled.id);await assert.rejects(imports.confirm(userId,id,cancelled.id),error=>error.getStatus()===409);
      const broken=await imports.upload(userId,id,file('broken.csv','wrong header\nvalue\n'));assert.equal((await wait(broken.id)).status,'FAILED');assert.ok((await imports.read(userId,id,broken.id)).error);
      assert.equal((await onboarding.status(userId,id)).progress,50,'draft imports do not fabricate AI readiness');
      await imports.onModuleDestroy();throw rollback;
    },{timeout:60000}),error=>error===rollback);
    assert.equal(await prisma.user.count({where:{id:{in:[userId,outsiderId]}}}),0);assert.equal(await prisma.merchant.count({where:{onboardingRequestId:requestId}}),0);
  }finally{await imports?.onModuleDestroy();await prisma.$disconnect();delete process.env.CATALOG_STORAGE_DIR;await fs.rm(directory,{recursive:true,force:true});}
});
