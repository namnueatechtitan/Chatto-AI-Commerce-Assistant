const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { NestFactory } = require('@nestjs/core');
const { Module, ValidationPipe } = require('@nestjs/common');
const { AuthSessionService } = require('../dist/auth/auth-session.service');
const { MerchantsService } = require('../dist/modules/merchants.module');
const { ConversationsService } = require('../dist/modules/conversations/conversations.service');
const { ConversationsController } = require('../dist/modules/conversations/conversations.controller');
const { StoreInformationService } = require('../dist/modules/store-information/store-information.service');
const { StoreInformationController } = require('../dist/modules/store-information/store-information.controller');
const { CatalogImportsService } = require('../dist/modules/catalog-imports/catalog-imports.service');
const { CatalogImportsController } = require('../dist/modules/catalog-imports/catalog-imports.controller');
const { InternalAiService } = require('../dist/modules/internal-ai/internal-ai.service');
const { InternalAiController } = require('../dist/modules/internal-ai/internal-ai.controller');
const { LineSignatureService } = require('../dist/modules/line-webhooks/line-signature.service');
const { LineWebhooksService, scopedLineEventId } = require('../dist/modules/line-webhooks/line-webhooks.service');
const { LineChannelRuntimeService } = require('../dist/modules/line-webhooks/line-channel-runtime.service');
const { CredentialCipherService } = require('../dist/security/credential-cipher.service');
const { LineWebhooksController } = require('../dist/modules/line-webhooks/line-webhooks.controller');

test('isolated PostgreSQL: sessions, tenant reads/writes, immutable vectors and signed webhook relationships', async (t) => {
  const value = process.env.CHATTO_A2_TEST_DATABASE_URL;
  assert.ok(value && process.env.CHATTO_A2_TEST_DATABASE_CONFIRMED === '1', 'Use the disposable-container test runner');
  const url = new URL(value);
  assert.equal(url.hostname, '127.0.0.1'); assert.notEqual(url.port, '5432');
  assert.match(url.pathname, /^\/chatto_a2_test_[0-9a-f]{16}$/);
  const prisma = new PrismaClient({ datasources: { db: { url: value } } });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chatto-a2-pg-'));
  const originalStorage = process.env.CATALOG_STORAGE_DIR;
  process.env.CATALOG_STORAGE_DIR = directory;
  process.env.WEB_URL = 'http://localhost:3000';
  process.env.INTERNAL_SERVICE_TOKEN = randomBytes(32).toString('hex');
  let app;
  t.after(async () => {
    await app?.close(); await prisma.$disconnect();
    originalStorage === undefined ? delete process.env.CATALOG_STORAGE_DIR : process.env.CATALOG_STORAGE_DIR = originalStorage;
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir())); assert.ok(path.basename(resolved).startsWith('chatto-a2-pg-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  await prisma.$connect();
  const users = {};
  for (const name of ['a', 'b', 'multi', 'staff']) users[name] = await prisma.user.create({ data: { name, globalRole: 'merchant_user' } });
  const merchants = new MerchantsService(prisma), sessions = new AuthSessionService(prisma);
  const information = new StoreInformationService(prisma, merchants);
  const settings = new (require('../dist/modules/merchant-ai-settings/merchant-ai-settings.service').MerchantAiSettingsService)(prisma, information);
  const internal = new InternalAiService(prisma, settings);
  const basic = { shopName: 'Fixture A', businessCategory: 'flowers', operatingHours: '09:00–18:00', faqs: [] };
  const a = (await information.create(users.a.id, { ...basic, requestId: randomUUID() })).merchant;
  const b = (await information.create(users.b.id, { ...basic, shopName: 'Fixture B', requestId: randomUUID() })).merchant;
  const owner = await prisma.role.findFirst({ where: { name: 'Owner' } });
  const staffRole = await prisma.role.create({ data: { name: 'Staff', status: 'active' } });
  await prisma.merchantUser.createMany({ data: [
    { merchantId: a.id, userId: users.multi.id, roleId: owner.id }, { merchantId: b.id, userId: users.multi.id, roleId: owner.id },
    { merchantId: a.id, userId: users.staff.id, roleId: staffRole.id },
  ] });
  const tokens = {};
  for (const name of Object.keys(users)) tokens[name] = await sessions.create(users[name].id);
  const platform = await prisma.platform.create({ data: { code: 'line', name: 'LINE', status: 'active' } });
  const channelA = await prisma.channel.create({ data: { merchantId: a.id, platformId: platform.id, channelName: 'A', externalChannelId: '7000000011' } });
  const channelB = await prisma.channel.create({ data: { merchantId: b.id, platformId: platform.id, channelName: 'B', externalChannelId: '7000000012' } });
  const customerA = await prisma.customer.create({ data: { merchantId: a.id, channelId: channelA.id, externalUserId: 'a', displayName: 'A customer' } });
  const customerB = await prisma.customer.create({ data: { merchantId: b.id, channelId: channelB.id, externalUserId: 'b', displayName: 'B customer' } });
  const conversationA = await prisma.conversation.create({ data: { merchantId: a.id, customerId: customerA.id, channelId: channelA.id } });
  const conversationB = await prisma.conversation.create({ data: { merchantId: b.id, customerId: customerB.id, channelId: channelB.id } });
  await prisma.message.createMany({ data: [
    { merchantId: a.id, conversationId: conversationA.id, senderType: 'CUSTOMER', messageType: 'TEXT', content: 'A only' },
    { merchantId: b.id, conversationId: conversationB.id, senderType: 'CUSTOMER', messageType: 'TEXT', content: 'B only' },
    { merchantId: a.id, conversationId: conversationB.id, senderType: 'CUSTOMER', messageType: 'TEXT', content: 'Broken foreign conversation' },
  ] });
  const productA = await prisma.product.create({ data: { merchantId: a.id, name: 'A product', status: 'ACTIVE' } });
  const productB = await prisma.product.create({ data: { merchantId: b.id, name: 'B product', status: 'ACTIVE' } });
  await prisma.productVariant.create({ data: { merchantId: b.id, productId: productA.id, variantName: 'Foreign variant', status: 'ACTIVE' } });
  await prisma.productImage.create({ data: { merchantId: b.id, productId: productA.id, imageUrl: 'https://example.test/foreign.png' } });
  const faqA = await prisma.knowledgeBaseDocument.create({ data: { merchantId: a.id, type: 'faq', title: 'A FAQ', content: 'A answer' } });
  const faqB = await prisma.knowledgeBaseDocument.create({ data: { merchantId: b.id, type: 'faq', title: 'B FAQ', content: 'B answer' } });
  const imports = new CatalogImportsService(prisma, information);
  const secret = randomBytes(32).toString('hex');
  const fixture = { LINE_CHANNEL_SECRET: secret, LINE_CHANNEL_ID: 'fixture-a' };
  const config = { get: (key) => fixture[key] };
  process.env.LINE_CREDENTIAL_ACTIVE_KEY_ID = 'a2';
  process.env.LINE_CREDENTIAL_KEYRING = JSON.stringify({ a2: randomBytes(32).toString('base64') });
  const cipher = new CredentialCipherService();
  for (const channel of [channelA, channelB]) {
    const context = { merchantId: channel.merchantId, channelId: channel.id };
    await prisma.channel.update({ where: { id: channel.id }, data: {
      status: 'CONNECTED', isConnected: true, credentialRevision: 1, credentialsVerifiedAt: new Date(),
      webhookVerifiedAt: new Date(), lineClaimedAt: new Date(), lineBotUserId: 'U' + (channel === channelA ? 'a' : 'b').repeat(32),
      channelSecretEncrypted: cipher.encrypt(secret, { ...context, field: 'channelSecret' }),
      accessTokenEncrypted: cipher.encrypt('synthetic-only-token', { ...context, field: 'channelAccessToken' }),
    } });
  }
  const line = new LineWebhooksService(prisma, new LineChannelRuntimeService(prisma, cipher), { chat: async () => { throw new Error('Provider calls prohibited in tests'); } }, {});
  class TestModule {}
  Module({ controllers: [ConversationsController, StoreInformationController, CatalogImportsController, InternalAiController, LineWebhooksController], providers: [
    { provide: AuthSessionService, useValue: sessions }, { provide: ConversationsService, useValue: new ConversationsService(prisma, merchants) },
    { provide: StoreInformationService, useValue: information }, { provide: CatalogImportsService, useValue: imports },
    { provide: InternalAiService, useValue: internal }, { provide: LineWebhooksService, useValue: line },
  ] })(TestModule);
  app = await NestFactory.create(TestModule, { logger: false, rawBody: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1'); const base = await app.getUrl();
  const request = (name, route, method = 'GET', body) => fetch(base + route, { method, headers: {
    Cookie: `chatto_session=${tokens[name]}`, Origin: 'http://localhost:3000', ...(body ? { 'Content-Type': 'application/json' } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  await t.test('A1 real sessions and membership isolation', async () => {
    assert.equal((await fetch(base + `/conversations/messages/latest?merchantId=${a.id}`)).status, 401);
    assert.equal((await request('a', `/conversations/messages/latest?merchantId=${b.id}&userId=${users.b.id}&role=Owner`)).status, 404);
    const own = await (await request('a', `/conversations/messages/latest?merchantId=${a.id}`)).json();
    assert.deepEqual(own.map((message) => message.message), ['A only']);
    const other = await (await request('multi', `/conversations/messages/latest?merchantId=${b.id}`)).json();
    assert.deepEqual(other.map((message) => message.message), ['B only']);
    for (const status of ['INACTIVE', 'SUSPENDED']) {
      await prisma.merchantUser.update({ where: { merchantId_userId: { merchantId: a.id, userId: users.a.id } }, data: { status } });
      assert.equal((await request('a', `/conversations/messages/latest?merchantId=${a.id}`)).status, 404);
    }
    await prisma.merchantUser.update({ where: { merchantId_userId: { merchantId: a.id, userId: users.a.id } }, data: { status: 'ACTIVE' } });
  });
  await t.test('nested exports and history exclude inconsistent tenant relations', async () => {
    const exported = await internal.exportProducts(a.id);
    assert.equal(exported.products.length, 1); assert.deepEqual(exported.products[0].variants, []); assert.deepEqual(exported.products[0].image_urls, []);
    assert.deepEqual(await internal.exportConversationHistory(a.id, conversationB.id), []);
  });
  await t.test('store/FAQ policy and foreign IDs cannot mutate records; rollback preserves revision', async () => {
    const pathA = `/merchants/${a.id}/information`, input = { ...basic, revision: 1, faqs: [{ id: faqB.id, question: 'Stolen', answer: 'Changed' }] };
    assert.equal((await request('b', pathA, 'PATCH', input)).status, 404);
    assert.equal((await request('staff', pathA, 'PATCH', input)).status, 403);
    assert.equal((await request('a', pathA, 'PATCH', input)).status, 400);
    assert.equal((await prisma.merchant.findUnique({ where: { id: a.id } })).informationRevision, 1);
    assert.equal((await prisma.knowledgeBaseDocument.findUnique({ where: { id: faqB.id } })).content, 'B answer');
    assert.equal((await request('a', pathA, 'PATCH', { ...basic, revision: 1, faqs: [{ id: faqA.id, question: 'A FAQ', answer: 'Updated A' }] })).status, 200);
    assert.equal((await prisma.knowledgeBaseDocument.findUnique({ where: { id: faqA.id } })).content, 'Updated A');
    await prisma.merchant.update({ where: { id: a.id }, data: { status: 'SUSPENDED' } });
    assert.equal((await request('a', pathA)).status, 200);
    assert.equal((await request('a', pathA, 'PATCH', { ...basic, revision: 2 })).status, 403);
    await prisma.merchant.update({ where: { id: a.id }, data: { status: 'TRIAL' } });
  });
  await t.test('foreign import cannot be read, confirmed or cancelled under another merchant', async () => {
    const job = await prisma.catalogImport.create({ data: { merchantId: b.id, uploadedById: users.b.id, originalName: 'fixture.csv', format: 'csv', mimeType: 'text/csv', byteSize: 10, sha256: randomBytes(32).toString('hex'), status: 'PREVIEW', expiresAt: new Date(Date.now() + 60000) } });
    for (const suffix of ['', '/confirm', '/cancel']) assert.equal((await request('a', `/merchants/${a.id}/catalog-imports/${job.id}${suffix}`, suffix ? 'POST' : 'GET')).status, 404);
    assert.equal((await prisma.catalogImport.findUnique({ where: { id: job.id } })).status, 'PREVIEW');
  });
  const vector = (merchantId, sourceId, overrides = {}) => ({ id: randomUUID(), merchant_id: merchantId, source_type: 'product', source_id: sourceId, chunk_text: 'Fixture chunk', embedding: [0.1, 0.2], metadata: { managed_by: 'chatto-live-chunker' }, status: 'active', ...overrides });
  await t.test('vector sync validates references and cannot overwrite or reassign foreign IDs; batch is atomic', async () => {
    const foreign = vector(b.id, productB.id); await internal.syncVectorDocuments(b.id, [foreign]);
    const own = vector(a.id, productA.id); await internal.syncVectorDocuments(a.id, [own]);
    const mismatchedVariant = await prisma.productVariant.create({ data: { merchantId: a.id, productId: productB.id, variantName: 'Broken parent' } });
    await assert.rejects(internal.syncVectorDocuments(a.id, [vector(a.id, mismatchedVariant.id, { source_type: 'product_variant' })]), (error) => error.getStatus() === 400);
    await assert.rejects(internal.syncVectorDocuments(a.id, [vector(a.id, productB.id)]), (error) => error.getStatus() === 400);
    await assert.rejects(internal.syncVectorDocuments(a.id, [vector(a.id, productA.id, { merchant_id: b.id })]), (error) => error.getStatus() === 400);
    const before = await prisma.vectorDocument.findUnique({ where: { id: foreign.id } });
    await assert.rejects(internal.syncVectorDocuments(a.id, [vector(a.id, productA.id), vector(a.id, productA.id, { id: foreign.id })]), (error) => error.getStatus() === 400);
    assert.deepEqual(await prisma.vectorDocument.findUnique({ where: { id: foreign.id } }), before);
    assert.equal(await prisma.vectorDocument.count({ where: { merchantId: a.id } }), 1);
    await assert.rejects(internal.syncVectorDocuments(a.id, [{ ...own, source_id: faqA.id, source_type: 'faq' }]), (error) => error.getStatus() === 400);
    await internal.syncVectorDocuments(a.id, [{ ...own, chunk_text: 'Updated own chunk' }]);
    assert.equal((await prisma.vectorDocument.findUnique({ where: { id: own.id } })).chunkText, 'Updated own chunk');
    const validFaq = vector(a.id, faqA.id, { source_type: 'faq' }); await internal.syncVectorDocuments(a.id, [validFaq]);
    assert.equal(await prisma.vectorDocument.count({ where: { merchantId: a.id } }), 2);
    const foreignStale = await prisma.vectorDocument.create({ data: { merchantId: b.id, sourceType: 'product', sourceId: productA.id, chunkText: 'Foreign stale row', metadata: { managed_by: 'chatto-live-chunker' } } });
    const manual = await prisma.vectorDocument.create({ data: { merchantId: a.id, sourceType: 'product', sourceId: productA.id, chunkText: 'Manual row', metadata: { managed_by: 'manual' } } });
    await assert.rejects(internal.syncVectorDocuments(a.id, [vector(a.id, productA.id, { id: manual.id })]), (error) => error.getStatus() === 400);
    await internal.syncVectorDocuments(a.id, [own]);
    assert.ok(await prisma.vectorDocument.findUnique({ where: { id: foreignStale.id } }));
    assert.equal((await prisma.vectorDocument.findUnique({ where: { id: manual.id } })).chunkText, 'Manual row');
  });
  const signedWebhook = (event) => {
    const raw = JSON.stringify({ destination: 'U' + 'a'.repeat(32), events: [event] });
    return fetch(base + '/webhooks/line/' + channelA.id, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-line-signature': createHmac('sha256', secret).update(raw).digest('base64') }, body: raw });
  };
  await t.test('signed webhook cannot reuse a foreign customer or modify a foreign duplicate event', async () => {
    await prisma.customer.create({ data: { merchantId: b.id, channelId: channelA.id, externalUserId: 'broken-customer' } });
    const event = { type: 'message', timestamp: Date.now(), webhookEventId: 'bad-relation-event', replyToken: 'fixture-only', source: { type: 'user', userId: 'broken-customer' }, message: { id: 'fixture-message', type: 'text', text: 'Fixture' } };
    const before = await prisma.message.count();
    assert.equal((await signedWebhook(event)).status, 400);
    assert.equal(await prisma.message.count(), before);
    assert.equal(await prisma.lineWebhookEvent.count({ where: { webhookEventId: scopedLineEventId(channelA.id, event) } }), 0);
    const duplicate = { type: 'follow', timestamp: Date.now(), webhookEventId: 'foreign-duplicate', source: { type: 'user', userId: 'fixture' } };
    const foreign = await prisma.lineWebhookEvent.create({ data: { merchantId: b.id, channelId: channelB.id, webhookEventId: scopedLineEventId(channelA.id, duplicate), eventType: 'follow', rawPayload: {} } });
    assert.equal((await signedWebhook(duplicate)).status, 400);
    assert.equal((await prisma.lineWebhookEvent.findUnique({ where: { id: foreign.id } })).isDuplicate, false);
    await assert.rejects(line.ownedJob(prisma, { merchantId: a.id, channelId: channelA.id,
      eventId: foreign.webhookEventId, revision: 1, conversationId: conversationB.id, customerId: customerB.id, messageId: randomUUID() }), (error) => error.getStatus() === 400);
    assert.equal(await prisma.message.count(), before);
  });
});
