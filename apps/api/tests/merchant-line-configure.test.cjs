const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
const { ForbiddenException, NotFoundException, Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { MerchantLineService } = require('../dist/modules/merchant-line/merchant-line.service');
const { CredentialCipherService } = require('../dist/security/credential-cipher.service');
const { InvalidLineCredentials } = require('../dist/modules/merchant-line/line-provider.adapter');
const { LineChannelRuntimeService } = require('../dist/modules/line-webhooks/line-channel-runtime.service');
const { LineWebhooksService } = require('../dist/modules/line-webhooks/line-webhooks.service');
const { LineWebhooksController } = require('../dist/modules/line-webhooks/line-webhooks.controller');

// Every credential, key and row in this file is synthetic. No Prisma client,
// dotenv loader or external provider is started by these regression tests.
const previousKeys = {
  active: process.env.LINE_CREDENTIAL_ACTIVE_KEY_ID,
  ring: process.env.LINE_CREDENTIAL_KEYRING,
};
process.env.LINE_CREDENTIAL_ACTIVE_KEY_ID = 'configure-test';
process.env.LINE_CREDENTIAL_KEYRING = JSON.stringify({ 'configure-test': randomBytes(32).toString('base64') });
test.after(() => {
  for (const [name, value] of [
    ['LINE_CREDENTIAL_ACTIVE_KEY_ID', previousKeys.active], ['LINE_CREDENTIAL_KEYRING', previousKeys.ring],
  ]) value === undefined ? delete process.env[name] : process.env[name] = value;
});

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(part => matches(row, part));
    if (key === 'AND') return value.every(part => matches(row, part));
    if (key === 'merchant') return matches({ status: 'ACTIVE' }, value);
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('not' in value) return row[key] !== value.not;
      if ('notIn' in value) return !value.notIn.includes(row[key]);
      if ('in' in value) return value.in.includes(row[key]);
      throw Error('Unsupported test database predicate');
    }
    return row[key] === value;
  });
}
function fixture() {
  const userId = randomUUID(), merchantId = randomUUID(), otherMerchantId = randomUUID(), platformId = randomUUID();
  const input = { externalChannelId: '7000000001', channelSecret: randomBytes(16).toString('hex'),
    channelAccessToken: randomBytes(32).toString('base64url'), expectedRevision: 0 };
  const otherInput = { externalChannelId: '7000000002', channelSecret: randomBytes(16).toString('hex'),
    channelAccessToken: randomBytes(32).toString('base64url'), expectedRevision: 0 };
  const botUserId = 'U' + 'a'.repeat(32), otherBotUserId = 'U' + 'b'.repeat(32);
  const rows = [], writes = [], queries = [], locks = [], authorization = [], cipherCalls = [], providerCalls = [];
  const allowed = new Set([merchantId]);
  const actualCipher = new CredentialCipherService();
  const cipher = Object.fromEntries(['encrypt', 'decrypt'].map(method => [method, (value, context) => {
    cipherCalls.push({ method, context: structuredClone(context) });
    return actualCipher[method](value, context);
  }]));
  const scopedRow = where => rows.find(row => matches(row, where));
  const db = {
    $executeRawUnsafe: async (sql, ...params) => { locks.push({ sql, params }); return 1; },
    $queryRawUnsafe: async (sql, ...params) => {
      queries.push({ sql, params });
      return sql.includes('FROM platforms') ? [{ id: platformId, status: 'active' }] : [{ id: merchantId }];
    },
    channel: {
      findFirst: async ({ where }) => structuredClone(scopedRow(where) ?? null),
      findUnique: async ({ where }) => structuredClone(scopedRow(where.merchantId_platformId_externalChannelId ?? where) ?? null),
      findMany: async ({ where, take }) => structuredClone(rows.filter(row => matches(row, where)).slice(0, take ?? rows.length)),
      create: async ({ data }) => {
        assert.ok(data.merchantId && data.platformId && data.id, 'New channel must carry explicit trusted identity');
        const row = { createdAt: new Date(), updatedAt: new Date(), ...structuredClone(data) };
        rows.push(row); writes.push({ kind: 'create', merchantId: row.merchantId, id: row.id });
        return structuredClone(row);
      },
      update: async ({ where, data }) => {
        assert.ok(where.id && where.merchantId, 'Channel mutations must include merchant ownership');
        const row = scopedRow(where);
        if (!row) throw new NotFoundException('LINE channel not found');
        for (const [key, value] of Object.entries(data)) row[key] = value && typeof value === 'object' && 'increment' in value
          ? row[key] + value.increment : structuredClone(value);
        row.updatedAt = new Date(); writes.push({ kind: 'update', merchantId: row.merchantId, id: row.id });
        return structuredClone(row);
      },
    },
  };
  db.$transaction = async action => {
    const snapshot = structuredClone(rows);
    try { return await action(db); }
    catch (error) { rows.splice(0, rows.length, ...snapshot); throw error; }
  };
  const ownership = { authorize: async (user, merchant, write, transaction) => {
    authorization.push({ user, merchant, write, transactional: transaction === db });
    if (user !== userId || !allowed.has(merchant)) {
      if (write) throw new ForbiddenException('Store Owner access is required');
      throw new NotFoundException('Store not found');
    }
  } };
  let verifyBehavior = async credentials => ({ botUserId: credentials.externalChannelId === input.externalChannelId ? botUserId : otherBotUserId });
  const provider = { verify: async credentials => { providerCalls.push(structuredClone(credentials)); return verifyBehavior(credentials); },
    reply: async () => { throw Error('Empty verification requests must never send replies'); } };
  const service = new MerchantLineService(db, ownership, cipher, provider);
  const runtime = new LineChannelRuntimeService(db, cipher);
  const webhookService = new LineWebhooksService(db, runtime, { chat: async () => { throw Error('Empty verification requests must never call AI'); } }, provider);
  function rawProbe(channel, destination = channel.lineBotUserId) {
    const raw = Buffer.from(JSON.stringify({ destination, events: [] }));
    const secret = actualCipher.decrypt(channel.channelSecretEncrypted,
      { merchantId: channel.merchantId, channelId: channel.id, field: 'channelSecret' });
    return { raw, signature: createHmac('sha256', secret).update(raw).digest('base64') };
  }
  async function connected(merchant = merchantId, credentials = input) {
    allowed.add(merchant);
    const configured = await service.configure(userId, merchant, credentials);
    const verified = await service.verify(userId, merchant, configured.id, configured.revision);
    const probe = rawProbe(scopedRow({ id: configured.id }));
    await webhookService.receive(configured.id, probe.signature, probe.raw);
    return structuredClone(scopedRow({ id: configured.id }));
  }
  return { userId, merchantId, otherMerchantId, platformId, input, otherInput, botUserId, otherBotUserId,
    rows, writes, queries, locks, authorization, allowed, cipherCalls, providerCalls, actualCipher,
    db, service, runtime, webhookService, connected, rawProbe,
    behavior: callback => { verifyBehavior = callback; },
    clearEvidence: () => { writes.length = cipherCalls.length = providerCalls.length = authorization.length = queries.length = locks.length = 0; },
  };
}
const webhookUrl = id => 'https://hooks.fixture.com/webhooks/line/' + id;
const rowSnapshot = row => JSON.stringify(row);
function noSecrets(metadata, fixtureData) {
  const serialized = JSON.stringify(metadata);
  for (const name of ['accessTokenEncrypted', 'channelSecretEncrypted', 'channelSecret', 'channelAccessToken'])
    assert.ok(!Object.hasOwn(metadata, name), 'Credential fields must never be returned');
  for (const value of [fixtureData.input.channelSecret, fixtureData.input.channelAccessToken])
    assert.ok(!serialized.includes(value), 'Plaintext credentials must never be returned');
}

test('first save creates one UUID with encrypted tenant-bound credentials and derivable stable URL', async () => {
  const f = fixture(), saved = await f.service.configure(f.userId, f.merchantId, f.input);
  assert.equal(f.rows.length, 1); assert.equal(f.writes[0].kind, 'create');
  assert.match(saved.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(saved.status, 'CONFIGURED'); assert.equal(saved.revision, 1); assert.equal(saved.hasCredentials, true);
  const row = f.rows[0], context = { merchantId: f.merchantId, channelId: saved.id };
  assert.ok(f.actualCipher.decrypt(row.channelSecretEncrypted, { ...context, field: 'channelSecret' }) === f.input.channelSecret);
  assert.ok(f.actualCipher.decrypt(row.accessTokenEncrypted, { ...context, field: 'channelAccessToken' }) === f.input.channelAccessToken);
  assert.equal(webhookUrl(saved.id), webhookUrl(row.id)); noSecrets(saved, f);
  assert.ok(f.authorization.some(call => call.write && call.transactional));
  assert.ok(f.queries.some(query => query.sql.includes('FOR SHARE OF mu,m,r')));
  assert.ok(f.locks.some(lock => lock.params[0] === 'merchant-line:' + f.merchantId));
  assert.ok(f.locks.some(lock => lock.params[0] === 'line-oa:' + f.input.externalChannelId));
});

test('new or disconnected channel still requires complete first-save credentials', async t => {
  for (const name of ['externalChannelId', 'channelSecret', 'channelAccessToken']) await t.test('missing ' + name, async () => {
    const f = fixture(), partial = { ...f.input }; delete partial[name];
    await assert.rejects(f.service.configure(f.userId, f.merchantId, partial), error => error.getStatus() === 400);
    assert.equal(f.rows.length, 0); assert.equal(f.writes.length, 0); assert.equal(f.cipherCalls.length, 0);
  });
  const f = fixture(), before = await f.connected();
  const disconnected = await f.service.disconnect(f.userId, f.merchantId, before.id, before.credentialRevision);
  f.clearEvidence();
  await assert.rejects(f.service.configure(f.userId, f.merchantId,
    { externalChannelId: f.input.externalChannelId, channelAccessToken: f.input.channelAccessToken, expectedRevision: disconnected.revision }),
  error => error.getStatus() === 400);
  assert.equal(f.writes.length, 0); assert.equal(f.rows[0].status, 'DISCONNECTED');
});

test('repeated identical full credential saves preserve CONNECTED proofs, ciphertext, revision and URL without writes', async () => {
  const f = fixture(), before = await f.connected(), snapshot = rowSnapshot(before);
  f.clearEvidence();
  for (let repeat = 0; repeat < 2; repeat++) {
    const saved = await f.service.configure(f.userId, f.merchantId, { ...f.input, expectedRevision: before.credentialRevision });
    assert.equal(saved.status, 'CONNECTED'); assert.equal(saved.isConnected, true);
    assert.equal(saved.revision, before.credentialRevision); assert.equal(saved.id, before.id);
    assert.equal(webhookUrl(saved.id), webhookUrl(before.id)); noSecrets(saved, f);
  }
  assert.equal(rowSnapshot(f.rows[0]), snapshot); assert.equal(f.writes.length, 0);
  assert.equal(f.cipherCalls.filter(call => call.method === 'encrypt').length, 0);
  assert.equal(f.providerCalls.length, 0);
});

test('existing CONNECTED save with omitted credential fields retains ciphertext without decrypting or disconnecting', async () => {
  const f = fixture(), before = await f.connected(), snapshot = rowSnapshot(before); f.clearEvidence();
  const saved = await f.service.configure(f.userId, f.merchantId, { expectedRevision: before.credentialRevision });
  assert.equal(saved.id, before.id); assert.equal(saved.status, 'CONNECTED'); assert.equal(saved.isConnected, true);
  assert.equal(rowSnapshot(f.rows[0]), snapshot); assert.equal(f.cipherCalls.length, 0); assert.equal(f.writes.length, 0);
  assert.equal(f.providerCalls.length, 0);
});

test('explicit null or empty fields fail safely instead of erasing an existing credential or identity', async () => {
  const f = fixture(), before = await f.connected(), snapshot = rowSnapshot(before); f.clearEvidence();
  for (const field of ['externalChannelId', 'channelSecret', 'channelAccessToken']) for (const value of [null, ''])
    await assert.rejects(f.service.configure(f.userId, f.merchantId, { [field]: value, expectedRevision: before.credentialRevision }),
      error => error.getStatus() === 400);
  assert.equal(rowSnapshot(f.rows[0]), snapshot); assert.equal(f.cipherCalls.length, 0); assert.equal(f.writes.length, 0);
});

for (const [name, field, encryptedField, retainedField] of [
  ['Token', 'channelAccessToken', 'accessTokenEncrypted', 'channelSecretEncrypted'],
  ['Secret', 'channelSecret', 'channelSecretEncrypted', 'accessTokenEncrypted'],
]) test('updating only ' + name + ' retains the other ciphertext, reservation and UUID; verification uses merged DB credentials', async () => {
  const f = fixture(), before = await f.connected(); f.clearEvidence();
  const value = field === 'channelSecret' ? randomBytes(16).toString('hex') : randomBytes(32).toString('base64url');
  const saved = await f.service.configure(f.userId, f.merchantId, { [field]: value, expectedRevision: before.credentialRevision });
  const row = f.rows[0];
  assert.equal(saved.id, before.id); assert.equal(webhookUrl(saved.id), webhookUrl(before.id));
  assert.equal(row.externalChannelId, before.externalChannelId); assert.ok(row[retainedField] === before[retainedField]);
  assert.ok(row[encryptedField] !== before[encryptedField]);
  assert.equal(row.lineBotUserId, before.lineBotUserId); assert.deepEqual(row.lineClaimedAt, before.lineClaimedAt);
  assert.equal(saved.status, 'CONFIGURED'); assert.equal(saved.isConnected, false);
  assert.equal(saved.credentialsVerifiedAt, null); assert.equal(saved.webhookVerifiedAt, null);
  assert.equal(saved.revision, before.credentialRevision + 1);
  assert.equal(f.cipherCalls.filter(call => call.method === 'encrypt').length, 1);
  assert.ok(f.cipherCalls.every(call => call.context.field === field), 'Omitted credential must not be decrypted or encrypted');
  const verified = await f.service.verify(f.userId, f.merchantId, saved.id, saved.revision);
  assert.equal(verified.id, before.id); assert.equal(verified.status, 'WEBHOOK_PENDING');
  assert.equal(f.providerCalls.length, 1);
  assert.ok(f.providerCalls[0][field] === value);
  const unchanged = field === 'channelSecret' ? 'channelAccessToken' : 'channelSecret';
  assert.ok(f.providerCalls[0][unchanged] === f.input[unchanged]); noSecrets(verified, f);
});

test('same single supplied credential is a no-op, and a different active numeric Channel ID remains a safe 409', async () => {
  const f = fixture(), before = await f.connected(), snapshot = rowSnapshot(before); f.clearEvidence();
  await f.service.configure(f.userId, f.merchantId,
    { channelAccessToken: f.input.channelAccessToken, expectedRevision: before.credentialRevision });
  assert.equal(f.writes.length, 0); assert.equal(rowSnapshot(f.rows[0]), snapshot);
  f.clearEvidence();
  await assert.rejects(f.service.configure(f.userId, f.merchantId,
    { ...f.otherInput, expectedRevision: before.credentialRevision }),
  error => error.getStatus() === 409 && /Disconnect/.test(error.message));
  assert.equal(f.rows.length, 1); assert.equal(rowSnapshot(f.rows[0]), snapshot);
  assert.equal(f.cipherCalls.length, 0); assert.equal(f.writes.length, 0);
});

test('stale revisions and revoked Owner authorization block partial saves before decrypting or writing', async () => {
  const f = fixture(), before = await f.connected(), snapshot = rowSnapshot(before); f.clearEvidence();
  await assert.rejects(f.service.configure(f.userId, f.merchantId,
    { channelSecret: randomBytes(16).toString('hex'), expectedRevision: before.credentialRevision - 1 }),
  error => error.getStatus() === 409);
  f.allowed.delete(f.merchantId);
  await assert.rejects(f.service.configure(f.userId, f.merchantId,
    { channelSecret: randomBytes(16).toString('hex'), expectedRevision: before.credentialRevision }),
  error => error.getStatus() === 403);
  assert.equal(rowSnapshot(f.rows[0]), snapshot); assert.equal(f.cipherCalls.length, 0); assert.equal(f.writes.length, 0);
});

for (const field of ['channelAccessToken', 'channelSecret']) test('invalid replacement ' + field + ' never becomes CONNECTED and cannot affect another merchant', async () => {
  const f = fixture(), before = await f.connected();
  const other = await f.connected(f.otherMerchantId, f.otherInput), otherSnapshot = rowSnapshot(other); f.clearEvidence();
  const invalid = field === 'channelSecret' ? randomBytes(16).toString('hex') : randomBytes(32).toString('base64url');
  const saved = await f.service.configure(f.userId, f.merchantId, { [field]: invalid, expectedRevision: before.credentialRevision });
  f.behavior(async () => { throw new InvalidLineCredentials(); });
  await assert.rejects(f.service.verify(f.userId, f.merchantId, saved.id, saved.revision), error =>
    error.getStatus() === 400 && error.message === 'LINE credentials could not be verified' && !error.message.includes(invalid));
  const row = f.rows.find(value => value.id === before.id);
  assert.equal(row.id, before.id); assert.equal(row.status, 'ERROR'); assert.equal(row.isConnected, false);
  assert.equal(row.credentialsVerifiedAt, null); assert.equal(row.webhookVerifiedAt, null);
  assert.deepEqual(row.lineClaimedAt, before.lineClaimedAt);
  assert.equal(rowSnapshot(f.rows.find(value => value.id === other.id)), otherSnapshot);
});

test('read metadata reconstructs the stored UUID URL without returning credential fields or ciphertext', async () => {
  const f = fixture(), before = await f.connected(); f.clearEvidence();
  const result = await f.service.read(f.userId, f.merchantId);
  assert.equal(result.current.id, before.id); assert.equal(result.current.externalChannelId, f.input.externalChannelId);
  assert.equal(webhookUrl(result.current.id), webhookUrl(before.id)); assert.equal(result.current.isConnected, true);
  noSecrets(result.current, f);
  assert.ok(!JSON.stringify(result).includes(before.channelSecretEncrypted));
  assert.ok(!JSON.stringify(result).includes(before.accessTokenEncrypted)); assert.equal(f.cipherCalls.length, 0);
});

test('missing DB credentials cannot be replaced by global or tenant OA environment values', async t => {
  const names = ['LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN', 'LINE_OA_A_CHANNEL_SECRET',
    'LINE_OA_A_CHANNEL_ACCESS_TOKEN', 'LINE_OA_B_CHANNEL_SECRET', 'LINE_OA_B_CHANNEL_ACCESS_TOKEN'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  for (const name of names) process.env[name] = randomBytes(32).toString('hex');
  t.after(() => { for (const name of names)
    previous[name] === undefined ? delete process.env[name] : process.env[name] = previous[name]; });
  const f = fixture(), before = await f.connected();
  f.rows[0].channelSecretEncrypted = f.rows[0].accessTokenEncrypted = null; f.clearEvidence();
  const result = await f.service.read(f.userId, f.merchantId);
  assert.equal(result.current.hasCredentials, false); assert.equal(result.current.isConnected, false);
  await assert.rejects(f.service.verify(f.userId, f.merchantId, before.id, before.credentialRevision), error => error.getStatus() === 409);
  await assert.rejects(f.runtime.authenticate(before.id, createHmac('sha256', randomBytes(32)).update('{}').digest('base64'), Buffer.from('{}')),
    error => error.getStatus() === 404);
  assert.equal(f.cipherCalls.length, 0); assert.equal(f.providerCalls.length, 0); assert.equal(f.writes.length, 0);
});

test('merchant-scoped reads, writes, verification and OA reservations cannot use another merchant channel', async () => {
  const f = fixture(), a = await f.connected(), b = await f.connected(f.otherMerchantId, f.otherInput);
  const aSnapshot = rowSnapshot(a), bSnapshot = rowSnapshot(b); f.allowed.delete(f.otherMerchantId); f.clearEvidence();
  const read = await f.service.read(f.userId, f.merchantId);
  assert.equal(read.current.id, a.id); assert.ok(!JSON.stringify(read).includes(b.id));
  await assert.rejects(f.service.read(f.userId, f.otherMerchantId), error => error.getStatus() === 404);
  await assert.rejects(f.service.configure(f.userId, f.otherMerchantId,
    { channelAccessToken: randomBytes(32).toString('base64url'), expectedRevision: b.credentialRevision }), error => error.getStatus() === 403);
  await assert.rejects(f.service.verify(f.userId, f.merchantId, b.id, b.credentialRevision), error => error.getStatus() === 404);
  await assert.rejects(f.service.disconnect(f.userId, f.merchantId, b.id, b.credentialRevision), error => error.getStatus() === 404);
  // A third authorized merchant also cannot claim B's reserved numeric OA.
  const thirdMerchant = randomUUID(); f.allowed.add(thirdMerchant);
  await assert.rejects(f.service.configure(f.userId, thirdMerchant, f.otherInput), error => error.getStatus() === 409);
  assert.equal(f.rows.length, 2); assert.equal(rowSnapshot(f.rows.find(row => row.id === a.id)), aSnapshot);
  assert.equal(rowSnapshot(f.rows.find(row => row.id === b.id)), bSnapshot); assert.equal(f.writes.length, 0);
  assert.equal(f.providerCalls.length, 0); assert.equal(f.cipherCalls.length, 0);
});

test('provider completion rechecks revision and Owner authorization before restoring readiness', async t => {
  for (const race of ['revision', 'authorization']) await t.test(race, async () => {
    const f = fixture(), saved = await f.service.configure(f.userId, f.merchantId, f.input);
    f.behavior(async () => {
      if (race === 'revision') f.rows[0].credentialRevision++;
      else f.allowed.delete(f.merchantId);
      return { botUserId: f.botUserId };
    });
    await assert.rejects(f.service.verify(f.userId, f.merchantId, saved.id, saved.revision),
      error => error.getStatus() === (race === 'revision' ? 409 : 403));
    assert.equal(f.rows[0].status, 'CONFIGURED'); assert.equal(f.rows[0].isConnected, false);
    assert.equal(f.rows[0].credentialsVerifiedAt, null); assert.equal(f.rows[0].webhookVerifiedAt, null);
  });
});

test('real HTTP controller accepts signed empty events, rejects bad signature/destination/unknown UUID, and has no duplicate side effects', async t => {
  const f = fixture(), saved = await f.service.configure(f.userId, f.merchantId, f.input);
  const verified = await f.service.verify(f.userId, f.merchantId, saved.id, saved.revision);
  class ProbeModule {}
  Module({ controllers: [LineWebhooksController], providers: [{ provide: LineWebhooksService, useValue: f.webhookService }] })(ProbeModule);
  const app = await NestFactory.create(ProbeModule, { logger: false, rawBody: true });
  t.after(() => app.close()); await app.listen(0, '127.0.0.1');
  const origin = await app.getUrl(), route = '/webhooks/line/' + saved.id;
  const request = async (path, raw, signature) => fetch(origin + path, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-line-signature': signature }, body: raw });
  const probe = f.rawProbe(f.rows[0]); f.clearEvidence();
  assert.equal((await request(route, probe.raw, createHmac('sha256', randomBytes(32)).update(probe.raw).digest('base64'))).status, 401);
  const wrongDestination = f.rawProbe(f.rows[0], f.otherBotUserId);
  assert.equal((await request(route, wrongDestination.raw, wrongDestination.signature)).status, 401);
  assert.equal((await request('/webhooks/line/' + randomUUID(), probe.raw, probe.signature)).status, 404);
  assert.equal(f.writes.length, 0); assert.equal(f.rows[0].status, 'WEBHOOK_PENDING');
  const accepted = await request(route, probe.raw, probe.signature);
  assert.equal(accepted.status, 200); assert.deepEqual(await accepted.json(),
    { ok: true, receivedEvents: 0, processedEvents: 0, ignoredEvents: 0, duplicateEvents: 0 });
  assert.equal(f.rows[0].status, 'CONNECTED'); assert.equal(f.rows[0].isConnected, true);
  assert.equal(f.rows[0].credentialRevision, verified.revision + 1); assert.ok(f.rows[0].webhookVerifiedAt instanceof Date);
  const snapshot = rowSnapshot(f.rows[0]);
  assert.equal((await request(route, probe.raw, probe.signature)).status, 200);
  assert.equal(rowSnapshot(f.rows[0]), snapshot); assert.equal(f.writes.length, 1); assert.equal(f.providerCalls.length, 0);
});
