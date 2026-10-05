const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { validate, plainToInstance } = (() => ({ ...require('class-validator'), ...require('class-transformer') }))();
const { CredentialCipherService } = require('../dist/security/credential-cipher.service');
const { ConfigureLineDto } = require('../dist/modules/merchant-line/merchant-line.dto');
const { LineProviderAdapter, InvalidLineCredentials } = require('../dist/modules/merchant-line/line-provider.adapter');
const apiPolicy = require('../dist/auth/service-token-policy');
const aiPolicy = require('../../ai-service/dist/service-token-policy');
const { assertScaffoldAvailable, scaffoldRoutes } = require('../dist/common/placeholders/scaffold-policy');
const context = { merchantId: randomUUID(), channelId: randomUUID(), field: 'channelSecret' };
const cipher = new CredentialCipherService();
const original = { ...process.env };
function keys(active = 'k1', ring = { k1: randomBytes(32).toString('base64') }) {
  process.env.LINE_CREDENTIAL_ACTIVE_KEY_ID = active;
  process.env.LINE_CREDENTIAL_KEYRING = JSON.stringify(ring);
  return ring;
}
test.after(() => {
  for (const name of ['LINE_CREDENTIAL_ACTIVE_KEY_ID', 'LINE_CREDENTIAL_KEYRING', 'LINE_CREDENTIAL_VERIFICATION_ENABLED', 'SCAFFOLD_501_APPROVED_ROUTES'])
    original[name] === undefined ? delete process.env[name] : process.env[name] = original[name];
});
test('API/AI production policy is identical; both purposes require distinct generated secrets', () => {
  assert.equal(fs.readFileSync(path.join(__dirname,'../src/auth/service-token-policy.ts'),'utf8'),
    fs.readFileSync(path.join(__dirname,'../../ai-service/src/service-token-policy.ts'),'utf8'));
  const strong = { NODE_ENV: 'production', AI_SERVICE_TOKEN: randomBytes(32).toString('hex'), INTERNAL_SERVICE_TOKEN: randomBytes(32).toString('base64url') };
  for (const policy of [apiPolicy, aiPolicy]) {
    assert.doesNotThrow(() => policy.validateProductionServiceCredentials(strong));
    for (const value of [undefined, '', 'dev_insecure_example', 'a'.repeat(64), 'simple-password', ' '.repeat(64), strong.AI_SERVICE_TOKEN + ' ']) {
      assert.throws(() => policy.validateProductionServiceCredentials({ ...strong, INTERNAL_SERVICE_TOKEN: value }), /configuration is unsafe/);
    }
    assert.throws(() => policy.validateProductionServiceCredentials({ ...strong, INTERNAL_SERVICE_TOKEN: strong.AI_SERVICE_TOKEN }));
    assert.doesNotThrow(() => policy.validateProductionServiceCredentials({ NODE_ENV: 'development' }));
  }
});
for (const [name, entry] of [
  ['API', path.resolve(__dirname, '../dist/app.module.js')],
  ['AI', path.resolve(__dirname, '../../ai-service/dist/index.js')],
]) test(name + ' production bootstrap refuses unsafe configuration before serving', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'chatto-b-startup-'));
  const code = "const reject=e=>{if(e?.message==='Production service authentication configuration is unsafe'){console.log('REJECTED');process.exit(0);}process.exit(2);};process.on('unhandledRejection',reject);try{require(" +
    JSON.stringify(entry) + ");}catch(e){reject(e);}setTimeout(()=>process.exit(3),1500);";
  try {
    // Cold Nest dependency loading on Windows can exceed four seconds.
    const result = spawnSync(process.execPath, ['-e', code], { cwd: temporary, windowsHide: true, encoding: 'utf8', timeout: 20000,
      env: { ...process.env, NODE_ENV: 'production', AI_SERVICE_TOKEN: '', INTERNAL_SERVICE_TOKEN: '',
        DATABASE_URL: 'postgresql://synthetic:synthetic@127.0.0.1:1/never_connect', AI_SERVICE_PORT: '0' } });
    assert.equal(result.status, 0); assert.equal(result.stdout.trim(), 'REJECTED');
  } finally {
    assert.equal(path.dirname(temporary), path.resolve(os.tmpdir())); assert.ok(path.basename(temporary).startsWith('chatto-b-startup-'));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
test('AES-GCM round trip, unique nonces and safe envelope', () => {
  keys();
  const one = cipher.encrypt('synthetic-secret', context), two = cipher.encrypt('synthetic-secret', context);
  assert.notEqual(one, two);
  assert.ok(!one.includes('synthetic-secret'));
  assert.equal(cipher.decrypt(one, context), 'synthetic-secret');
  assert.equal(one.split(':')[3].length, 16);
});
for (const [name, change] of Object.entries({
  merchant: { merchantId: randomUUID() }, channel: { channelId: randomUUID() }, field: { field: 'channelAccessToken' },
})) test('ciphertext substitution rejected: ' + name, () => {
  keys(); const envelope = cipher.encrypt('synthetic-secret', context);
  assert.throws(() => cipher.decrypt(envelope, { ...context, ...change }), (e) => e.getStatus() === 503 && !e.message.includes(envelope));
});
test('tampered ciphertext, nonce and tag are rejected', () => {
  keys(); const parts = cipher.encrypt('synthetic-secret', context).split(':');
  for (const index of [3,4,5]) {
    const changed = [...parts], bytes = Buffer.from(changed[index], 'base64'); bytes[0] ^= 1; changed[index] = bytes.toString('base64');
    assert.throws(() => cipher.decrypt(changed.join(':'), context), (e) => e.getStatus() === 503);
  }
  assert.throws(() => cipher.decrypt(parts.join(':') + ':extra', context));
});
test('wrong/missing key and invalid key material fail closed', () => {
  keys(); const envelope = cipher.encrypt('synthetic-secret', context);
  keys(); assert.throws(() => cipher.decrypt(envelope, context));
  keys('unknown', {}); assert.throws(() => cipher.encrypt('synthetic-secret', context));
  keys('k1', { k1: 'invalid' }); assert.throws(() => cipher.encrypt('synthetic-secret', context));
  delete process.env.LINE_CREDENTIAL_KEYRING; assert.throws(() => cipher.decrypt(envelope, context));
});
test('key ring rotation retains old decryption and reencrypts with active version', () => {
  const first = keys(); const old = cipher.encrypt('synthetic-secret', context);
  keys('k2', { ...first, k2: randomBytes(32).toString('base64') });
  assert.equal(cipher.decrypt(old, context), 'synthetic-secret');
  const rotated = cipher.reencrypt(old, context);
  assert.equal(rotated.split(':')[2], 'k2'); assert.equal(cipher.decrypt(rotated, context), 'synthetic-secret');
  const changed = old.replace(':k1:', ':k2:'); assert.throws(() => cipher.decrypt(changed, context));
  const ring = JSON.parse(process.env.LINE_CREDENTIAL_KEYRING); delete ring.k1; keys('k2', ring);
  assert.equal(cipher.decrypt(rotated, context), 'synthetic-secret'); assert.throws(() => cipher.decrypt(old, context));
});
test('credential DTO normalizes only provider identity and rejects invalid fields/revisions', async () => {
  const valid = { externalChannelId: ' 1234567890 ', channelSecret: 'b'.repeat(32), channelAccessToken: 'synthetic-token-only', expectedRevision: 0 };
  const instance = plainToInstance(ConfigureLineDto, valid);
  assert.equal(instance.externalChannelId, '1234567890'); assert.deepEqual(await validate(instance), []);
  for (const change of [{ externalChannelId: 'x' }, { channelSecret: 'short' }, { channelAccessToken: 'has spaces and controls' }, { expectedRevision: -1 }, { expectedRevision: '0' }])
    assert.ok((await validate(plainToInstance(ConfigureLineDto, { ...valid, ...change }))).length);
});
test('credential DTO permits omitted partial fields but rejects explicit null, empty and malformed values', async () => {
  for (const partial of [{ expectedRevision: 7 }, { externalChannelId: '1234567890', expectedRevision: 7 },
    { channelSecret: 'b'.repeat(32), expectedRevision: 7 }, { channelAccessToken: 'synthetic-token-only', expectedRevision: 7 }])
    assert.deepEqual(await validate(plainToInstance(ConfigureLineDto, partial)), []);
  for (const field of ['externalChannelId', 'channelSecret', 'channelAccessToken']) {
    for (const value of [null, '', ' ', 123]) {
      const errors = await validate(plainToInstance(ConfigureLineDto, { [field]: value, expectedRevision: 7 }));
      assert.ok(errors.some(error => error.property === field), 'Explicit invalid credential must fail validation');
    }
  }
});
const input = { externalChannelId: '1234567890', channelSecret: 'c'.repeat(32), channelAccessToken: 'synthetic-token-only' };
const botUserId = 'U' + 'a'.repeat(32);
test('LINE provider stays disabled without explicit deployment opt-in', async () => {
  delete process.env.LINE_CREDENTIAL_VERIFICATION_ENABLED;
  let calls = 0; const provider = new LineProviderAdapter(async () => { calls++; throw Error('must not run'); });
  await assert.rejects(provider.verify(input), (e) => e.getStatus() === 503); assert.equal(calls, 0);
});
test('mock LINE verification binds token/channel/secret/bot without secrets in URLs', async () => {
  process.env.LINE_CREDENTIAL_VERIFICATION_ENABLED = 'true';
  const calls = [];
  const provider = new LineProviderAdapter(async (url, init) => {
    calls.push({ url, init });
    const payload = url.endsWith('/verify') ? { client_id: input.externalChannelId, expires_in: 100 } :
      url.endsWith('/token') ? { access_token: 'ephemeral-mock-only', token_type: 'Bearer' } : { userId: botUserId };
    return Response.json(payload);
  });
  assert.deepEqual(await provider.verify(input), { botUserId });
  assert.equal(calls.length, 3);
  for (const call of calls) { assert.ok(!call.url.includes('?')); assert.equal(call.init.redirect, 'error'); }
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body.get('access_token'), input.channelAccessToken);
  assert.equal(calls[1].init.body.get('client_secret'), input.channelSecret);
  assert.equal(calls[2].init.headers.Authorization, 'Bearer ' + input.channelAccessToken);
});
test('LINE mock mismatched identity, invalid secret and oversized response cannot verify', async () => {
  process.env.LINE_CREDENTIAL_VERIFICATION_ENABLED = 'true';
  for (const response of [() => Response.json({ client_id: '9999', expires_in: 100 }), () => Response.json({}, { status: 401 }),
    () => new Response('x'.repeat(17000))]) {
    const provider = new LineProviderAdapter(async () => response());
    await assert.rejects(provider.verify(input), (e) => e instanceof InvalidLineCredentials);
  }
  let call = 0;
  const provider = new LineProviderAdapter(async () => ++call === 1 ? Response.json({ client_id: input.externalChannelId, expires_in: 100 }) : Response.json({}, { status: 400 }));
  await assert.rejects(provider.verify(input), (e) => e instanceof InvalidLineCredentials); assert.equal(call, 2);
});
test('provider network/body errors produce sanitized unavailability', async () => {
  process.env.LINE_CREDENTIAL_VERIFICATION_ENABLED = 'true';
  const provider = new LineProviderAdapter(async () => { throw Error(input.channelAccessToken + input.channelSecret); });
  await assert.rejects(provider.verify(input), (e) => e.getStatus() === 503 && !e.message.includes(input.channelSecret) && !e.message.includes(input.channelAccessToken));
});
test('scaffold opt-in is limited to documented routes and leaves real APIs intact', () => {
  assert.equal(scaffoldRoutes.size, 23);
  delete process.env.SCAFFOLD_501_APPROVED_ROUTES;
  for (const route of scaffoldRoutes) assert.doesNotThrow(() => assertScaffoldAvailable(route));
  process.env.SCAFFOLD_501_APPROVED_ROUTES = 'channels,conversations,messages,unknown';
  for (const route of ['channels', 'conversations', 'messages']) assert.throws(() => assertScaffoldAvailable(route), (e) => e.getStatus() === 501);
  for (const route of ['conversations/messages/latest', 'merchants', 'merchants/:merchantId/line-channel', 'unknown']) assert.doesNotThrow(() => assertScaffoldAvailable(route));
});
