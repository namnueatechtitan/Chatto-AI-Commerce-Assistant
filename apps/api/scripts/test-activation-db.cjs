'use strict';
// All DB writes and migrations are confined to a random labelled tmpfs container.
// Never reads application .env, uses existing DB/volumes or pulls an image.
const {spawnSync}=require('node:child_process'),{randomBytes,randomUUID}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const api=path.resolve(__dirname,'..'),root=path.resolve(api,'../..'),nonce=randomBytes(8).toString('hex');
const name='chatto-activation-test-'+nonce,database='chatto_b_test_'+nonce,label='chatto.validation.activation';
const admin='chatto_activation_admin',restricted='chatto_activation_api',password=randomBytes(32).toString('hex'),apiPassword=randomBytes(32).toString('hex');
const env={...process.env,NODE_ENV:'test',POSTGRES_PASSWORD:password,CHECKPOINT_DISABLE:'1'};
const temporary=path.join(root,'build/activation-validation',nonce);let container,port;
const safe=value=>String(value||'').replaceAll(password,'[REDACTED]').replaceAll(apiPassword,'[REDACTED]').replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[TEST DATABASE URL]');
function docker(args,input){const r=spawnSync('docker',args,{input,env,encoding:'utf8',windowsHide:true,maxBuffer:16000000});if(r.status!==0)throw Error('Disposable Docker '+args[0]+' failed');return r.stdout.trim();}
function sql(value){return docker(['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',admin,'-d',database],value);}
function migrate(){const r=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.join(temporary,'prisma/schema.prisma')],{cwd:temporary,env:{...env,DATABASE_URL:`postgresql://${admin}:${password}@127.0.0.1:${port}/${database}`},encoding:'utf8',windowsHide:true,maxBuffer:4000000});if(r.status!==0)throw Error('Isolated migration rehearsal failed');}
(async()=>{
  docker(['image','inspect','postgres:16-alpine']);
  container=docker(['run','--detach','--rm','--name',name,'--label',label+'='+nonce,'--publish','127.0.0.1::5432','--tmpfs','/var/lib/postgresql/data:rw','-e','POSTGRES_DB='+database,'-e','POSTGRES_USER='+admin,'-e','POSTGRES_PASSWORD','postgres:16-alpine']);
  assert.match(container,/^[0-9a-f]{64}$/);const inspection=JSON.parse(docker(['inspect',container]))[0];assert.equal(inspection.Config.Labels[label],nonce);assert.equal(inspection.Name,'/'+name);
  port=inspection.NetworkSettings.Ports['5432/tcp'][0].HostPort;assert.notEqual(port,'5432');
  let ready=false;for(let i=0;i<120;i++){const r=spawnSync('docker',['exec',container,'pg_isready','-h','127.0.0.1','-U',admin,'-d',database],{stdio:'ignore',windowsHide:true});if(r.status===0){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(ready);
  const migrations=path.join(api,'prisma/migrations'),latest='20261006010000_merchant_ai_activation',copied=path.join(temporary,'prisma/migrations');fs.mkdirSync(copied,{recursive:true});
  fs.copyFileSync(path.join(api,'prisma/schema.prisma'),path.join(temporary,'prisma/schema.prisma'));fs.copyFileSync(path.join(migrations,'migration_lock.toml'),path.join(copied,'migration_lock.toml'));
  const names=fs.readdirSync(migrations).filter(dir=>fs.existsSync(path.join(migrations,dir,'migration.sql'))).sort();
  const lineProofMigration='20261003040000_line_active_constraints';
  for(const dir of names.filter(dir=>dir<lineProofMigration))fs.cpSync(path.join(migrations,dir),path.join(copied,dir),{recursive:true});migrate();
  const userId=randomUUID(),merchantId=randomUUID();sql(`INSERT INTO users(id,name,global_role,status,created_at,updated_at) VALUES ('${userId}','Migration preservation fixture','merchant_user','active',now(),now()); INSERT INTO merchants(id,shop_name,slug,status,created_at,updated_at) VALUES ('${merchantId}','Migration preservation fixture','${merchantId}','trial',now(),now()); INSERT INTO ai_settings(id,merchant_id,bot_name,language,created_at,updated_at) VALUES ('${randomUUID()}','${merchantId}','Existing assistant','th',now(),now());`);
  // The established Phase B suite intentionally verifies a preserved, unverified
  // legacy CONNECTED row. Create only this synthetic row before proof constraints.
  sql(`INSERT INTO platforms(id,code,name,status,created_at,updated_at) VALUES ('${randomUUID()}','line','LINE','active',now(),now()) ON CONFLICT (code) DO NOTHING; INSERT INTO channels(id,merchant_id,platform_id,channel_name,external_channel_id,is_connected,status,created_at,updated_at) SELECT '${randomUUID()}','${merchantId}',id,'Legacy fixture','9876543210',true,'connected',now(),now() FROM platforms WHERE code='line';`);
  for(const dir of names.filter(dir=>dir>=lineProofMigration&&dir!==latest))fs.cpSync(path.join(migrations,dir),path.join(copied,dir),{recursive:true});migrate();
  const before=JSON.parse(sql(`SELECT row_to_json(a) FROM ai_settings a WHERE merchant_id='${merchantId}';`));
  fs.cpSync(path.join(migrations,latest),path.join(copied,latest),{recursive:true});migrate();
  const after=JSON.parse(sql(`SELECT row_to_json(a) FROM ai_settings a WHERE merchant_id='${merchantId}';`));for(const key of Object.keys(before))assert.deepEqual(after[key],before[key]);assert.equal(after.ai_enabled,false);assert.equal(after.ai_activated_at,null);assert.equal(after.ai_activated_by_user_id,null);
  sql(`INSERT INTO roles(id,name,status,created_at,updated_at) VALUES ('${randomUUID()}','Owner','active',now(),now()),('${randomUUID()}','Staff','active',now(),now()); CREATE ROLE ${restricted} LOGIN PASSWORD '${apiPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; GRANT CONNECT ON DATABASE ${database} TO ${restricted}; GRANT USAGE ON SCHEMA public TO ${restricted}; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${restricted}; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${restricted};`);
  console.log('PASS all forward migrations in isolated PostgreSQL; existing settings preserved and AI disabled by default.');
  const suites=process.argv.includes('--regression')?['tests/merchant-activation-db.test.cjs','tests/merchant-ai-settings-db.test.cjs','tests/phase-b-db.test.cjs','tests/phase-cd-db.test.cjs','tests/store-information-db.test.cjs','tests/onboarding-db.test.cjs']:['tests/merchant-activation-db.test.cjs'];
  const results=[];
  for(const suite of suites){
    // Each established suite receives an independent clone, so synthetic user /
    // provider IDs from one suite cannot contaminate another's count assertions.
    const suiteDb='chatto_b_test_'+randomBytes(8).toString('hex');
    docker(['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',admin,'-d','postgres'],`CREATE DATABASE ${suiteDb} TEMPLATE ${database}; GRANT CONNECT ON DATABASE ${suiteDb} TO ${restricted};`);
    const restrictedUrl=`postgresql://${restricted}:${apiPassword}@127.0.0.1:${port}/${suiteDb}`,adminUrl=`postgresql://${admin}:${password}@127.0.0.1:${port}/${suiteDb}`;
    const r=spawnSync(process.execPath,['--test',suite],{cwd:api,env:{...env,DATABASE_URL:restrictedUrl,CHATTO_ACTIVATION_TEST_DATABASE_CONFIRMED:'1',CHATTO_ACTIVATION_TEST_DATABASE_URL:restrictedUrl,CHATTO_AI_SETTINGS_DB_TEST_URL:restrictedUrl,CHATTO_B_TEST_DATABASE_CONFIRMED:'1',CHATTO_B_TEST_DATABASE_URL:adminUrl,CHATTO_LOCAL_DB_TESTS:'1'},encoding:'utf8',windowsHide:true,maxBuffer:16000000});
    const output=safe((r.stdout||'')+(r.stderr||''));const summary=output.split(/\r?\n/).filter(line=>/^(?:# (?:Subtest|tests|pass|fail|skipped)|\s*(?:not ok|ok) \d)/.test(line));
    results.push({suite,exitCode:r.status,summary});summary.forEach(line=>console.log(line));if(r.status!==0)process.exitCode=1;
  }
  fs.writeFileSync(path.join(temporary,'results.json'),JSON.stringify(results,null,2));
})().catch(error=>{console.log(safe(error.message));process.exitCode=1;}).finally(()=>{if(container){const inspection=JSON.parse(docker(['inspect',container]))[0];assert.equal(inspection.Config.Labels[label],nonce);assert.equal(inspection.Name,'/'+name);docker(['stop',container]);console.log('Removed only the isolated activation test container.');}});
