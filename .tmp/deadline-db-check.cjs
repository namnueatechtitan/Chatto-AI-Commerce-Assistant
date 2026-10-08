
const fs=require('fs'),crypto=require('crypto'),{PrismaClient}=require('../apps/api/node_modules/@prisma/client');
process.env.DATABASE_URL=fs.readFileSync('.env','utf8').match(/^DATABASE_URL\s*=\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const db=new PrismaClient(),merchantId='ae1b5a4b-77a8-4d71-9d1d-9f1aa4161662';
(async()=>{
 const state=await db.$transaction(async tx=>{
 await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
 const identity=await tx.$queryRawUnsafe('SELECT current_database() AS database, current_user AS db_user, inet_server_addr()::text AS server_address, inet_server_port() AS server_port');
 if(identity[0].database!=='chatto_phase2')throw Error('wrong_database');
 const merchant=await tx.merchant.findUnique({where:{id:merchantId},select:{id:true,shopName:true,status:true}});
 const channel=await tx.channel.findFirst({where:{id:'d4e81b0d-946e-47a4-84fc-aea63e3b358f',merchantId,externalChannelId:'2011922166'},select:{id:true,merchantId:true,channelName:true,externalChannelId:true,status:true,isConnected:true,credentialRevision:true,credentialsVerifiedAt:true,webhookVerifiedAt:true,lineClaimedAt:true}});
 if(!merchant||merchant.shopName!=='Yuepaochatto'||!channel||channel.status!=='CONNECTED')throw Error('ownership_or_status');
 const products=await tx.product.findMany({where:{merchantId},orderBy:{id:'asc'},include:{variants:{orderBy:{id:'asc'}},images:{orderBy:{id:'asc'}}}});
 const setting=await tx.aiSetting.findUnique({where:{merchantId},select:{aiEnabled:true,aiActivatedAt:true}});
 const migrations=await tx.$queryRawUnsafe('SELECT count(*)::int AS count FROM "_prisma_migrations"');
 const pending=await tx.lineWebhookEvent.count({where:{merchantId,processedAt:null,createdAt:{gte:new Date(Date.now()-60000)},OR:[{rawPayload:{path:['phase'],equals:'received'}},{rawPayload:{path:['phase'],equals:'ai_started'}}]}});
 return {identity:identity[0],merchant,channel,setting,productCount:products.length,variantCount:products.reduce((n,p)=>n+p.variants.length,0),catalogSha256:crypto.createHash('sha256').update(JSON.stringify(products)).digest('hex'),migrationCount:migrations[0].count,pendingRecentAiJobs:pending};
 });
 if(process.argv[2]==='before'){
  if(state.pendingRecentAiJobs!==0)throw Error('recent_active_jobs');
  fs.writeFileSync('.tmp/deadline-apply-db-before.json',JSON.stringify(state,null,2));
 }else{
  const baseline=JSON.parse(fs.readFileSync('.tmp/deadline-apply-db-before.json'));
  for(const field of ['identity','merchant','channel','setting','productCount','variantCount','catalogSha256','migrationCount'])
   if(JSON.stringify(state[field])!==JSON.stringify(baseline[field]))throw Error('database_snapshot_changed_'+field);
  state.beforeAfterMatch=true;
  fs.writeFileSync('.tmp/deadline-apply-db-after.json',JSON.stringify(state,null,2));
 }
 console.log(JSON.stringify(state));
})().catch(e=>{console.log(JSON.stringify({error:'Database precheck or verification failed',category:e.name,reason:/^[a-z_]+$/.test(e.message)?e.message:undefined}));process.exitCode=1}).finally(()=>db.$disconnect());
