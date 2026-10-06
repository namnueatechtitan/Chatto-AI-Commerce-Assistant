const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { NestFactory } = require('@nestjs/core');
const { Module, ValidationPipe, ServiceUnavailableException } = require('@nestjs/common');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { AuthSessionService } = require('../dist/auth/auth-session.service');
const { MerchantsService } = require('../dist/modules/merchants.module');
const { StoreInformationService } = require('../dist/modules/store-information/store-information.service');
const { CredentialCipherService } = require('../dist/security/credential-cipher.service');
const { MerchantLineService } = require('../dist/modules/merchant-line/merchant-line.service');
const { MerchantLineController } = require('../dist/modules/merchant-line/merchant-line.controller');
const { MerchantLineGuard } = require('../dist/modules/merchant-line/merchant-line.guard');
const { InvalidLineCredentials } = require('../dist/modules/merchant-line/line-provider.adapter');
const { OnboardingService } = require('../dist/modules/onboarding/onboarding.service');
const { validateRuntimeDatabaseRole } = require('../dist/prisma/runtime-role');
test('Phase B disposable PostgreSQL: tenant constraints, encrypted lifecycle, authorization and races', async (t) => {
  const value = process.env.CHATTO_B_TEST_DATABASE_URL;
  assert.equal(process.env.CHATTO_B_TEST_DATABASE_CONFIRMED, '1');
  const url = new URL(value); assert.equal(url.hostname, '127.0.0.1'); assert.notEqual(url.port, '5432');
  assert.match(url.pathname, /^\/chatto_b_test_[0-9a-f]{16}$/);
  process.env.LINE_CREDENTIAL_ACTIVE_KEY_ID = 'test1';
  process.env.LINE_CREDENTIAL_KEYRING = JSON.stringify({ test1: randomBytes(32).toString('base64') });
  const prisma = new PrismaClient({ datasources: { db: { url: value } } });
  await prisma.$connect();
  let app;
  t.after(async () => { await app?.close(); await prisma.$disconnect(); });
  const merchants = new MerchantsService(prisma), ownership = new StoreInformationService(prisma, merchants), sessions = new AuthSessionService(prisma);
  const owner = await prisma.role.create({ data: { name: 'Owner', status: 'active' } });
  const staffRole = await prisma.role.create({ data: { name: 'Staff', status: 'active' } });
  async function merchant(label) {
    const user = await prisma.user.create({ data: { name: label, globalRole: 'merchant_user' } });
    const store = await prisma.merchant.create({ data: { shopName: label, slug: randomUUID(), status: 'TRIAL', businessCategory: 'flowers', operatingHours: '09:00-18:00' } });
    await prisma.merchantUser.create({ data: { merchantId: store.id, userId: user.id, roleId: owner.id } });
    return { user, store, token: await sessions.create(user.id) };
  }
  const a = await merchant('A'), b = await merchant('B'), c = await merchant('C');
  const staff = await prisma.user.create({ data: { name: 'staff', globalRole: 'merchant_user' } });
  await prisma.merchantUser.create({ data: { merchantId: a.store.id, userId: staff.id, roleId: staffRole.id } });
  const staffToken = await sessions.create(staff.id);
  const platform = await prisma.platform.findFirst({ where: { code: 'line' } }); assert.ok(platform);
  let mode = 'success', calls = 0, paused, release;
  const botId = 'U' + 'a'.repeat(32);
  const provider = { verify: async (credentials) => {
    calls++;
    if (mode === 'invalid') throw new InvalidLineCredentials();
    if (mode === 'unavailable') throw new ServiceUnavailableException('LINE verification is temporarily unavailable');
    if (mode === 'pause') { paused?.(); await new Promise(resolve => { release = resolve; }); }
    return { botUserId: credentials.externalChannelId === '1234567890' ? botId : 'U' + 'b'.repeat(32) };
  } };
  const cipher = new CredentialCipherService(), line = new MerchantLineService(prisma, ownership, cipher, provider);
  class TestModule {}
  Module({ controllers: [MerchantLineController], providers: [
    { provide: PrismaService, useValue: prisma }, { provide: AuthSessionService, useValue: sessions },
    { provide: StoreInformationService, useValue: ownership }, { provide: MerchantLineService, useValue: line }, MerchantLineGuard,
  ] })(TestModule);
  app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1'); const base = await app.getUrl(); process.env.WEB_URL = base;
  const route = (store) => '/merchants/' + store.id + '/line-channel';
  const input = { externalChannelId: '1234567890', channelSecret: 'b'.repeat(32), channelAccessToken: 'synthetic-token-only', expectedRevision: 0 };
  const request = (who, path, method = 'GET', body, origin = base) => fetch(base + path, {
    method, headers: { Cookie: 'chatto_session=' + who.token, Origin: origin, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const configure = async (who, data = input) => {
    const response = await request(who, route(who.store), 'PUT', data);
    assert.equal(response.status, 200); return response.json();
  };
  const current = (who) => line.read(who.user.id, who.store.id).then(r => r.current);
  await t.test('all current migrations applied; seven tenant FKs are validated and PKs retained', async () => {
    const history = await prisma.$queryRawUnsafe("SELECT count(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL");
    const fs = require('node:fs'), path = require('node:path');
    const migrations = path.resolve(__dirname, '../prisma/migrations');
    assert.equal(history[0].count, fs.readdirSync(migrations).filter(dir => fs.existsSync(path.join(migrations, dir, 'migration.sql'))).length);
    const constraints = await prisma.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_constraint WHERE conname LIKE '%tenant%fkey' AND convalidated");
    assert.equal(constraints[0].count, 7);
    const keys = await prisma.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_constraint WHERE contype='p' AND conrelid IN ('channels'::regclass,'customers'::regclass,'conversations'::regclass,'products'::regclass)");
    assert.equal(keys[0].count, 4);
  });
  await t.test('production database policy rejects privileged roles and accepts restricted role metadata', async () => {
    const admin = await prisma.$queryRawUnsafe("SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user");
    assert.throws(() => validateRuntimeDatabaseRole(admin[0], 'production'));
    await prisma.$executeRawUnsafe("CREATE ROLE chatto_b_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS");
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE chatto_b_app");
      const roles = await tx.$queryRawUnsafe("SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user");
      assert.doesNotThrow(() => validateRuntimeDatabaseRole(roles[0], 'production'));
    });
    assert.throws(() => validateRuntimeDatabaseRole(undefined, 'production'));
  });
  await t.test('session, origin, ownership, inactive membership and suspended merchant enforced', async () => {
    assert.equal((await fetch(base + route(a.store))).status, 401);
    assert.equal((await fetch(base + '/merchants/not-a-uuid/line-channel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
    assert.equal((await request(b, route(a.store))).status, 404);
    assert.equal((await request(b, route(a.store), 'PUT', input)).status, 404);
    assert.equal((await request({ token: staffToken }, route(a.store))).status, 200);
    assert.equal((await request({ token: staffToken }, route(a.store), 'PUT', input)).status, 403);
    for (const origin of ['', 'https://foreign.example']) assert.equal((await request(a, route(a.store), 'PUT', input, origin)).status, 403);
    await prisma.merchantUser.update({ where: { merchantId_userId: { merchantId: a.store.id, userId: a.user.id } }, data: { status: 'INACTIVE' } });
    assert.equal((await request(a, route(a.store))).status, 404);
    await prisma.merchantUser.update({ where: { merchantId_userId: { merchantId: a.store.id, userId: a.user.id } }, data: { status: 'ACTIVE' } });
    await prisma.merchant.update({ where: { id: a.store.id }, data: { status: 'SUSPENDED' } });
    assert.equal((await request(a, route(a.store), 'PUT', input)).status, 403);
    await prisma.merchant.update({ where: { id: a.store.id }, data: { status: 'TRIAL' } });
    assert.equal(calls, 0);
  });
  let channelA;
  await t.test('configure stores authenticated ciphertext and returns safe disconnected metadata', async () => {
    const invalid = await request(a, route(a.store), 'PUT', { ...input, channelSecret: 'short' }); assert.equal(invalid.status, 400);
    const response = await request(a, route(a.store), 'PUT', { ...input, externalChannelId: ' 1234567890 ', merchantId: b.store.id, status: 'CONNECTED' });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    channelA = await response.json(); assert.equal(channelA.status, 'CONFIGURED'); assert.equal(channelA.isConnected, false);
    assert.equal(channelA.revision, 1);
    const stored = await prisma.channel.findUnique({ where: { id: channelA.id } });
    assert.equal(stored.merchantId, a.store.id); assert.equal(stored.credentialsVerifiedAt, null);
    for (const field of ['channelSecretEncrypted', 'accessTokenEncrypted']) assert.match(stored[field], /^chatto-line:v1:test1:/);
    assert.equal(cipher.decrypt(stored.channelSecretEncrypted, { merchantId: a.store.id, channelId: channelA.id, field: 'channelSecret' }), input.channelSecret);
    const data = JSON.stringify(await (await request(a, route(a.store))).json());
    for (const secret of [input.channelSecret, input.channelAccessToken, stored.channelSecretEncrypted, stored.accessTokenEncrypted, b.store.id]) assert.ok(!data.includes(secret));
    assert.equal((await request(b, route(b.store) + '/' + channelA.id + '/verify', 'POST', { expectedRevision: 1 })).status, 404);
    assert.equal((await request(b, route(b.store) + '/' + channelA.id + '/disconnect', 'POST', { expectedRevision: 1 })).status, 404);
    assert.equal(calls, 0);
  });
  await t.test('one merchant slot and stale revision reject conflicting configuration', async () => {
    assert.equal((await request(a, route(a.store), 'PUT', { ...input, externalChannelId: '2222222222' })).status, 409);
    assert.equal((await request(a, route(a.store), 'PUT', input)).status, 409);
    assert.equal(await prisma.channel.count({ where: { merchantId: a.store.id } }), 1);
  });
  await t.test('invalid credentials become ERROR; transport errors make no writes', async () => {
    mode = 'unavailable';
    await assert.rejects(line.verify(a.user.id, a.store.id, channelA.id, 1), e => e.getStatus() === 503);
    assert.equal((await current(a)).revision, 1);
    mode = 'invalid';
    await assert.rejects(line.verify(a.user.id, a.store.id, channelA.id, 1), e => e.getStatus() === 400);
    const error = await current(a); assert.equal(error.status, 'ERROR'); assert.equal(error.isConnected, false); assert.equal(error.credentialsVerifiedAt, null);
    assert.equal(error.revision, 2);
  });
  await t.test('valid mocked credentials remain WEBHOOK_PENDING without completing onboarding', async () => {
    mode = 'success'; const result = await line.verify(a.user.id, a.store.id, channelA.id, 2);
    assert.equal(result.status, 'WEBHOOK_PENDING'); assert.equal(result.isConnected, false);
    assert.ok(result.credentialsVerifiedAt); assert.equal(result.webhookVerifiedAt, null); assert.equal(result.revision, 3);
    const status = await new OnboardingService(prisma, merchants).status(a.user.id, a.store.id);
    assert.equal(status.steps[3].state, 'current'); assert.equal(status.progress, 50);
    assert.equal(await prisma.channel.count({ where: { merchantId: a.store.id, isConnected: true } }), 0);
  });
  await t.test('verified OA is reserved to its owner; direct DB ownership transfer blocked', async () => {
    const response = await request(b, route(b.store), 'PUT', input); assert.equal(response.status, 409);
    assert.equal(await prisma.channel.count({ where: { merchantId: b.store.id } }), 0);
    await assert.rejects(prisma.channel.update({ where: { id: channelA.id }, data: { merchantId: b.store.id } }));
    await assert.rejects(prisma.channel.update({ where: { id: channelA.id }, data: { externalChannelId: '2222222222' } }));
    assert.equal((await prisma.channel.findUnique({ where: { id: channelA.id } })).merchantId, a.store.id);
  });
  await t.test('stale provider response cannot overwrite credential rotation', async () => {
    mode = 'pause'; const entered = new Promise(resolve => { paused = resolve; });
    const pending = line.verify(a.user.id, a.store.id, channelA.id, 3);
    await entered;
    const rotated = await configure(a, { ...input, expectedRevision: 3, channelAccessToken: 'synthetic-rotated-only' });
    release(); await assert.rejects(pending, e => e.getStatus() === 409);
    assert.equal((await current(a)).status, 'CONFIGURED'); assert.equal((await current(a)).revision, rotated.revision);
    mode = 'success';
  });
  await t.test('membership revoked during provider verification cannot commit result', async () => {
    mode = 'pause'; const entered = new Promise(resolve => { paused = resolve; });
    const pending = line.verify(a.user.id, a.store.id, channelA.id, 4);
    await entered;
    await prisma.merchantUser.update({ where: { merchantId_userId: { merchantId: a.store.id, userId: a.user.id } }, data: { status: 'INACTIVE' } });
    release(); await assert.rejects(pending, e => e.getStatus() === 404);
    assert.equal((await prisma.channel.findUnique({ where: { id: channelA.id } })).credentialRevision, 4);
    await prisma.merchantUser.update({ where: { merchantId_userId: { merchantId: a.store.id, userId: a.user.id } }, data: { status: 'ACTIVE' } });
    mode = 'success';
  });
  await t.test('disconnect releases claim, preserves history, and reconnect reuses row', async () => {
    let result = await line.disconnect(a.user.id, a.store.id, channelA.id, 4);
    assert.equal(result.status, 'DISCONNECTED'); assert.equal(result.hasCredentials, false);
    const stored = await prisma.channel.findUnique({ where: { id: channelA.id } });
    assert.equal(stored.lineClaimedAt, null); assert.equal(stored.accessTokenEncrypted, null); assert.equal(stored.channelSecretEncrypted, null);
    result = await configure(a, { ...input, expectedRevision: 5 }); assert.equal(result.id, channelA.id);
    assert.equal(await prisma.channel.count({ where: { merchantId: a.store.id } }), 1);
    const bChannel = await configure(b);
    await line.verify(a.user.id, a.store.id, channelA.id, 6);
    await assert.rejects(line.verify(b.user.id, b.store.id, bChannel.id, 1), e => e.getStatus() === 409);
    await line.disconnect(a.user.id, a.store.id, channelA.id, 7);
    const verifiedB = await line.verify(b.user.id, b.store.id, bChannel.id, 1);
    assert.equal(verifiedB.status, 'WEBHOOK_PENDING');
    assert.equal((await line.read(a.user.id, a.store.id)).history[0].id, channelA.id);
    assert.equal(await prisma.channel.count({ where: { externalChannelId: input.externalChannelId } }), 2);
  });
  await t.test('partial write failure rolls back encrypted row and returns sanitized error', async () => {
    let wrote = false;
    const wrapped = { $transaction: (callback, options) => prisma.$transaction(tx => callback(new Proxy(tx, {
      get(target, key) {
        if (key === 'channel') return new Proxy(target.channel, { get(model, name) {
          if (name === 'create') return async args => { await model.create(args); wrote = true; throw Error('Injected partial write failure'); };
          const value = model[name]; return typeof value === 'function' ? value.bind(model) : value;
        } });
        const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
      },
    })), options) };
    const service = new MerchantLineService(wrapped, ownership, cipher, provider);
    await assert.rejects(service.configure(c.user.id, c.store.id, { ...input, externalChannelId: '3333333333' }), e => e.getStatus() === 503);
    assert.equal(wrote, true); assert.equal(await prisma.channel.count({ where: { merchantId: c.store.id } }), 0);
  });
  await t.test('concurrent credential verification creates only one OA claim', async () => {
    const d = await merchant('D'), e = await merchant('E');
    const draft = { ...input, externalChannelId: '6666666666' };
    const [cd, ce] = await Promise.all([configure(d, draft), configure(e, draft)]);
    const results = await Promise.allSettled([
      line.verify(d.user.id, d.store.id, cd.id, 1), line.verify(e.user.id, e.store.id, ce.id, 1),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const rejected = results.find(r => r.status === 'rejected'); assert.equal(rejected.reason.getStatus(), 409);
    assert.equal(await prisma.channel.count({ where: { externalChannelId: draft.externalChannelId, lineClaimedAt: { not: null } } }), 1);
  });
  await t.test('UUID casing cannot bypass serialization/revision protection', async () => {
    const f = await merchant('F'), draft = { ...input, externalChannelId: '7777777777' };
    await configure(f, draft);
    // Identical credentials are intentionally a no-op. Race a genuine synthetic
    // credential change so revision protection is actually exercised.
    const changed = { ...draft, channelSecret: randomBytes(16).toString('hex'), expectedRevision: 1 };
    const responses = await Promise.all([
      request(f, route(f.store), 'PUT', changed),
      request(f, route({ id: f.store.id.toUpperCase() }), 'PUT', changed),
    ]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    assert.equal((await current(f)).revision, 2);
  });
  await t.test('legacy connected metadata is ERROR without rewriting stored flag', async () => {
    const legacy = await prisma.channel.findFirst({ where: { channelName: 'Legacy fixture' } }); assert.ok(legacy);
    await prisma.merchantUser.create({ data: { merchantId: legacy.merchantId, userId: c.user.id, roleId: owner.id } });
    const metadata = await line.read(c.user.id, legacy.merchantId);
    assert.equal(metadata.current.status, 'ERROR'); assert.equal(metadata.current.issue, 'LEGACY_UNVERIFIED'); assert.equal(metadata.current.isConnected, false);
    const preserved = await prisma.channel.findUnique({ where: { id: legacy.id } });
    assert.equal(preserved.status, 'CONNECTED'); assert.equal(preserved.isConnected, true);
  });
  await t.test('canonical platform and fabricated connected writes are rejected', async () => {
    await assert.rejects(prisma.platform.create({ data: { code: ' LINE ', name: 'duplicate', status: 'active' } }));
    await assert.rejects(prisma.platform.update({ where: { id: platform.id }, data: { code: 'renamed' } }));
    await assert.rejects(prisma.channel.create({ data: { merchantId: c.store.id, platformId: platform.id,
      channelName: 'Unverified', externalChannelId: '4444444444', status: 'CONNECTED', isConnected: true } }));
  });
  await t.test('seven composite FKs reject cross-merchant links; valid relations cascade', async (fk) => {
    const channelC = await prisma.channel.create({ data: { merchantId: c.store.id, platformId: platform.id, channelName: 'C', externalChannelId: '5555555555' } });
    const customerB = await prisma.customer.create({ data: { merchantId: b.store.id, channelId: (await current(b)).id, externalUserId: randomUUID() } });
    const customerC = await prisma.customer.create({ data: { merchantId: c.store.id, channelId: channelC.id, externalUserId: randomUUID() } });
    const convB = await prisma.conversation.create({ data: { merchantId: b.store.id, customerId: customerB.id, channelId: (await current(b)).id } });
    const convC = await prisma.conversation.create({ data: { merchantId: c.store.id, customerId: customerC.id, channelId: channelC.id } });
    const productB = await prisma.product.create({ data: { merchantId: b.store.id, name: 'B' } });
    const productC = await prisma.product.create({ data: { merchantId: c.store.id, name: 'C' } });
    const cases = {
      'Customer→Channel': () => prisma.customer.create({ data: { merchantId: c.store.id, channelId: (channelA.id), externalUserId: randomUUID() } }),
      'Conversation→Customer': () => prisma.conversation.create({ data: { merchantId: c.store.id, channelId: channelC.id, customerId: customerB.id } }),
      'Conversation→Channel': () => prisma.conversation.create({ data: { merchantId: c.store.id, channelId: channelA.id, customerId: customerC.id } }),
      'Message→Conversation': () => prisma.message.create({ data: { merchantId: c.store.id, conversationId: convB.id, senderType: 'CUSTOMER', messageType: 'TEXT', content: 'fixture' } }),
      'ProductVariant→Product': () => prisma.productVariant.create({ data: { merchantId: c.store.id, productId: productB.id, variantName: 'fixture' } }),
      'ProductImage→Product': () => prisma.productImage.create({ data: { merchantId: c.store.id, productId: productB.id, imageUrl: 'https://example.test/image' } }),
      'LineWebhookEvent→Channel': () => prisma.lineWebhookEvent.create({ data: { merchantId: c.store.id, channelId: channelA.id, webhookEventId: randomUUID(), eventType: 'message', rawPayload: {} } }),
    };
    for (const [name, action] of Object.entries(cases)) await fk.test(name, async () => {
      await assert.rejects(action(), e => e.code === 'P2003');
    });
    await prisma.message.create({ data: { merchantId: c.store.id, conversationId: convC.id, senderType: 'CUSTOMER', messageType: 'TEXT', content: 'valid fixture' } });
    await prisma.productVariant.create({ data: { merchantId: c.store.id, productId: productC.id, variantName: 'valid' } });
    await prisma.productImage.create({ data: { merchantId: c.store.id, productId: productC.id, imageUrl: 'https://example.test/valid' } });
    await prisma.lineWebhookEvent.create({ data: { merchantId: c.store.id, channelId: channelC.id, webhookEventId: randomUUID(), eventType: 'message', rawPayload: {} } });
    await prisma.product.delete({ where: { id: productC.id } });
    assert.equal(await prisma.productVariant.count({ where: { productId: productC.id } }), 0); assert.equal(await prisma.productImage.count({ where: { productId: productC.id } }), 0);
    await prisma.channel.delete({ where: { id: channelC.id } });
    for (const [model, where] of [['customer', { id: customerC.id }], ['conversation', { id: convC.id }], ['message', { conversationId: convC.id }], ['lineWebhookEvent', { channelId: channelC.id }]])
      assert.equal(await prisma[model].count({ where }), 0);
  });
});
