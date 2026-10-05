// Isolated migration/restore rehearsal. Never reads .env or uses DATABASE_URL.
// Only its random, labelled tmpfs container is started/stopped.
const { spawnSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const api = path.resolve(__dirname, '..'), root = path.resolve(api, '../..');
const nonce = randomBytes(8).toString('hex'), name = 'chatto-b-test-' + nonce;
const database = 'chatto_b_test_' + nonce, restored = 'chatto_b_restore_' + nonce, bad = 'chatto_b_bad_' + nonce;
const label = 'chatto.validation.phase', username = 'chatto_b_test';
const env = { ...process.env, NODE_ENV: 'test', POSTGRES_PASSWORD: randomBytes(32).toString('hex'),
  AI_SERVICE_TOKEN: randomBytes(32).toString('hex'), INTERNAL_SERVICE_TOKEN: randomBytes(32).toString('hex'),
  LINE_CREDENTIAL_VERIFICATION_ENABLED: 'false', CHECKPOINT_DISABLE: '1' };
const migrationRoot = path.join(api, 'prisma/migrations');
const sourceMigrations = fs.readdirSync(migrationRoot).filter(dir => fs.existsSync(path.join(migrationRoot, dir, 'migration.sql'))).sort();
let container, temporary, port;
const redact = (value) => String(value ?? '').replaceAll(env.POSTGRES_PASSWORD, '[synthetic password]')
  .replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[disposable test database URL]');
function docker(args, input, binary = false) {
  const result = spawnSync('docker', args, { input, env, encoding: binary ? undefined : 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('Disposable Docker operation failed: ' + args[0] + ' ' + redact(result.stderr));
  return binary ? result.stdout : result.stdout.trim();
}
function sql(db, input) {
  assert.ok([database, restored, bad].includes(db));
  return docker(['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', username, '-d', db], input);
}
function migrate(db, shouldPass = true) {
  assert.ok([database, restored, bad].includes(db));
  const cli = require.resolve('prisma/build/index.js', { paths: [api] });
  const result = spawnSync(process.execPath, [cli, 'migrate', 'deploy', '--schema', path.join(temporary, 'prisma/schema.prisma')], {
    cwd: temporary, windowsHide: true, encoding: 'utf8',
    env: { ...env, DATABASE_URL: 'postgresql://' + username + ':' + env.POSTGRES_PASSWORD + '@127.0.0.1:' + port + '/' + db },
    maxBuffer: 4 * 1024 * 1024,
  });
  if (shouldPass && result.status !== 0) throw new Error('Disposable migration rehearsal failed: ' + redact(result.stdout + result.stderr));
  if (!shouldPass) assert.notEqual(result.status, 0, 'Corrupt fixture must fail migration validation');
}
function restore(db, dump) {
  sql(database, 'CREATE DATABASE "' + db + '";');
  docker(['exec', '-i', container, 'pg_restore', '--no-owner', '--no-acl', '--exit-on-error', '-U', username, '-d', db], dump);
}
(async () => {
  docker(['image', 'inspect', 'postgres:16-alpine']); // cached image only, no pull
  container = docker(['run', '--detach', '--rm', '--name', name, '--label', label + '=b',
    '--publish', '127.0.0.1::5432', '--tmpfs', '/var/lib/postgresql/data:rw',
    '-e', 'POSTGRES_DB=' + database, '-e', 'POSTGRES_USER=' + username, '-e', 'POSTGRES_PASSWORD', 'postgres:16-alpine']);
  assert.match(container, /^[0-9a-f]{64}$/);
  const inspect = JSON.parse(docker(['inspect', container]))[0];
  assert.equal(inspect.Config.Labels[label], 'b'); assert.equal(inspect.Name, '/' + name);
  port = inspect.NetworkSettings.Ports['5432/tcp'][0].HostPort; assert.notEqual(port, '5432');
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    const probe = spawnSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', username, '-d', database], { stdio: 'ignore', windowsHide: true });
    if (probe.status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready);
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'chatto-b-rehearsal-'));
  const copied = path.join(temporary, 'prisma/migrations'); fs.mkdirSync(copied, { recursive: true });
  fs.copyFileSync(path.join(api, 'prisma/schema.prisma'), path.join(temporary, 'prisma/schema.prisma'));
  fs.copyFileSync(path.join(migrationRoot, 'migration_lock.toml'), path.join(copied, 'migration_lock.toml'));
  function copyMigration(dir) { fs.cpSync(path.join(migrationRoot, dir), path.join(copied, dir), { recursive: true }); }
  for (const dir of sourceMigrations.filter(dir => !dir.startsWith('20261003'))) copyMigration(dir);
  migrate(database);
  const legacyMerchant = randomUUID(), legacyPlatform = randomUUID(), legacyChannel = randomUUID();
  sql(database, "INSERT INTO merchants(id,shop_name,slug,status,created_at,updated_at) VALUES ('" + legacyMerchant + "','Legacy merchant','legacy-rehearsal','trial',now(),now());\n" +
    "INSERT INTO platforms(id,code,name,status,created_at,updated_at) VALUES ('" + legacyPlatform + "','line','LINE','active',now(),now());\n" +
    "INSERT INTO channels(id,merchant_id,platform_id,channel_name,external_channel_id,is_connected,status,created_at,updated_at) VALUES ('" + legacyChannel + "','" + legacyMerchant + "','" + legacyPlatform + "','Legacy fixture','9876543210',true,'connected',now(),now());");
  const before = JSON.parse(sql(database, "SELECT row_to_json(c) FROM channels c WHERE id='" + legacyChannel + "';"));
  const dump = docker(['exec', container, 'pg_dump', '-Fc', '--no-owner', '--no-acl', '-U', username, '-d', database], undefined, true);
  assert.ok(dump.length > 1000);
  restore(restored, dump);
  assert.equal(sql(restored, "SELECT count(*) FROM channels WHERE is_connected AND access_token_encrypted IS NULL AND channel_secret_encrypted IS NULL;"), '1');
  assert.equal(sql(restored, "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;"), '4');
  console.log('PASS custom-format backup/restore of all legacy tables and migration history (synthetic disposable DB).');
  restore(bad, dump);
  const badMerchant = randomUUID();
  sql(bad, "INSERT INTO merchants(id,shop_name,slug,status,created_at,updated_at) VALUES ('" + badMerchant + "','Bad fixture','bad-rehearsal','trial',now(),now());\n" +
    "INSERT INTO customers(id,merchant_id,channel_id,external_user_id,created_at,updated_at) VALUES ('" + randomUUID() + "','" + badMerchant + "','" + legacyChannel + "','synthetic-only',now(),now());");
  for (const dir of sourceMigrations.filter(dir => dir.startsWith('20261003'))) copyMigration(dir);
  migrate(bad, false);
  assert.equal(sql(bad, "SELECT count(*) FROM pg_constraint WHERE conname IN ('customers_channel_id_fkey','conversations_customer_id_fkey','conversations_channel_id_fkey','messages_conversation_id_fkey','product_variants_product_id_fkey','product_images_product_id_fkey','line_webhook_events_channel_id_fkey');"), '7');
  assert.equal(sql(bad, "SELECT count(*) FROM pg_constraint WHERE conname LIKE '%tenant%fkey';"), '0');
  console.log('PASS failed FK validation preserves all seven old FKs; no partial replacement committed.');
  migrate(database); migrate(restored);
  assert.equal(sql(database, "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;"), '8');
  const after = JSON.parse(sql(database, "SELECT row_to_json(c) FROM channels c WHERE id='" + legacyChannel + "';"));
  for (const key of Object.keys(before)) assert.deepEqual(after[key], before[key], 'Legacy field preserved: ' + key);
  assert.equal(sql(database, "SELECT convalidated FROM pg_constraint WHERE conname='channels_line_connection_proof_check';"), 'f');
  console.log('PASS migrate deploy rehearsal on original and restored disposable DBs; legacy CONNECTED row preserved, proof constraint explicitly NOT VALID.');
  const suites = ['tests/phase-b-db.test.cjs', ...(process.env.CHATTO_PHASE_CD_TESTS === '1' ? ['tests/phase-cd-db.test.cjs'] : [])];
  const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...suites], { cwd: api, env: { ...env,
    CHATTO_B_TEST_DATABASE_CONFIRMED: '1',
    CHATTO_B_TEST_DATABASE_URL: 'postgresql://' + username + ':' + env.POSTGRES_PASSWORD + '@127.0.0.1:' + port + '/' + database,
  }, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  process.stdout.write(redact(result.stdout)); process.stderr.write(redact(result.stderr)); process.exitCode = result.status ?? 1;
  const output = path.join(root, process.env.CHATTO_PHASE_CD_TESTS === '1' ? 'build/phase-cd-validation' : 'build/phase-b-validation'); fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'database-results.txt'), redact(result.stdout + result.stderr));
  fs.writeFileSync(path.join(output, 'rehearsal.json'), JSON.stringify({ baselineMigrations: 4, finalMigrations: 8,
    backupRestore: 'PASS', failedValidationRollback: 'PASS', legacyRowPreserved: true, connectedProofConstraintValidated: false,
    phaseBDbTestsExitCode: result.status }, null, 2));
})().catch(error => { console.error(redact(error.message)); process.exitCode = 1; }).finally(() => {
  if (temporary) {
    assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temporary).startsWith('chatto-b-rehearsal-'));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  if (container) {
    const inspect = JSON.parse(docker(['inspect', container]))[0];
    assert.equal(inspect.Config.Labels[label], 'b'); assert.equal(inspect.Name, '/' + name);
    docker(['stop', container]); console.log('Removed only the Phase B disposable test container.');
  }
});
