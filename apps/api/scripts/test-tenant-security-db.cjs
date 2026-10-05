// Creates only its own disposable PostgreSQL container. Never uses DATABASE_URL/.env.
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const api = path.resolve(__dirname, '..');
const nonce = randomBytes(8).toString('hex'), database = `chatto_a2_test_${nonce}`;
const name = `chatto-a2-test-${nonce}`, label = 'chatto.validation.phase';
const dockerEnv = { ...process.env, POSTGRES_PASSWORD: randomBytes(32).toString('hex') };
let container;
function docker(args, input) {
  const result = spawnSync('docker', args, { input, env: dockerEnv, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    const detail = (result.stderr || '').replaceAll(dockerEnv.POSTGRES_PASSWORD, '[redacted]').replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[test database URL]');
    throw new Error(`Docker test operation failed: ${args[0]} ${detail.trim()}`);
  }
  return result.stdout.trim();
}

(async () => {
  docker(['image', 'inspect', 'postgres:16-alpine']); // No image pull or existing-service mutation.
  container = docker(['run', '--detach', '--rm', '--name', name, '--label', `${label}=a2`,
    '--publish', '127.0.0.1::5432', '--tmpfs', '/var/lib/postgresql/data:rw',
    '-e', `POSTGRES_DB=${database}`, '-e', 'POSTGRES_USER=chatto_a2_test', '-e', 'POSTGRES_PASSWORD', 'postgres:16-alpine']);
  assert.match(container, /^[0-9a-f]{64}$/);
  const inspection = JSON.parse(docker(['inspect', container]))[0];
  assert.equal(inspection.Config.Labels[label], 'a2');
  assert.equal(inspection.Name, `/${name}`);
  const port = inspection.NetworkSettings.Ports['5432/tcp'][0].HostPort;
  assert.notEqual(port, '5432');
  let available = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    // The image's temporary init server accepts Unix sockets before final startup.
    const ready = spawnSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'chatto_a2_test', '-d', database], { stdio: 'ignore', windowsHide: true });
    if (ready.status === 0) { available = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(available, 'Disposable PostgreSQL is ready');
  const migrationRoot = path.join(api, 'prisma/migrations');
  for (const directory of fs.readdirSync(migrationRoot).sort()) {
    // A2 deliberately exercises corrupt legacy relationships to verify source
    // defenses. Keep that suite on the legacy constraint stage, with additive
    // columns for current Prisma compatibility. Phase B tests use ALL migrations.
    if (["20261003030000_tenant_composite_relations", "20261003040000_line_active_constraints"].includes(directory)) continue;
    const sql = path.join(migrationRoot, directory, 'migration.sql');
    if (fs.existsSync(sql)) docker(['exec', '-i', container, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'chatto_a2_test', '-d', database], fs.readFileSync(sql, 'utf8'));
  }
  console.log('Initialized disposable PostgreSQL from existing migration SQL; no existing services used.');
  const result = spawnSync(process.execPath, ['--test', 'tests/tenant-security-db.test.cjs'], {
    cwd: api, windowsHide: true, encoding: 'utf8',
    env: { ...process.env, CHATTO_A2_TEST_DATABASE_CONFIRMED: '1',
      CHATTO_A2_TEST_DATABASE_URL: `postgresql://chatto_a2_test:${dockerEnv.POSTGRES_PASSWORD}@127.0.0.1:${port}/${database}` },
  });
  const redact = (value) => (value || '').replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[disposable test database URL]');
  process.stdout.write(redact(result.stdout)); process.stderr.write(redact(result.stderr));
  process.exitCode = result.status ?? 1;
})().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => {
  if (container) {
    const inspection = JSON.parse(docker(['inspect', container]))[0];
    assert.equal(inspection.Config.Labels[label], 'a2'); assert.equal(inspection.Name, `/${name}`);
    docker(['stop', container]); // --rm removes only this test container and its tmpfs.
    console.log('Stopped and removed the disposable PostgreSQL test container.');
  }
});
