// Real Nest + PostgreSQL/Prisma + existing AI agent. Only LINE and LLM output
// are deterministic provider fixtures. Never consumes the application's DB URL.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { PrismaClient } = require('@prisma/client');
const { NestFactory } = require('@nestjs/core');
const { Module, ValidationPipe } = require('@nestjs/common');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { AuthSessionService } = require('../dist/auth/auth-session.service');
const { MerchantsService } = require('../dist/modules/merchants.module');
const { StoreInformationService } = require('../dist/modules/store-information/store-information.service');
const { CredentialCipherService } = require('../dist/security/credential-cipher.service');
const { MerchantLineService } = require('../dist/modules/merchant-line/merchant-line.service');
const { MerchantLineController } = require('../dist/modules/merchant-line/merchant-line.controller');
const { MerchantLineGuard } = require('../dist/modules/merchant-line/merchant-line.guard');
const { LineChannelRuntimeService } = require('../dist/modules/line-webhooks/line-channel-runtime.service');
const { LineWebhooksService, scopedLineEventId } = require('../dist/modules/line-webhooks/line-webhooks.service');
const { LineWebhooksController } = require('../dist/modules/line-webhooks/line-webhooks.controller');
const { InternalAiService } = require('../dist/modules/internal-ai/internal-ai.service');
const { InternalAiController } = require('../dist/modules/internal-ai/internal-ai.controller');
const { AiIntegrationService } = require('../dist/modules/ai-integration/ai-integration.service');
const { OnboardingService } = require('../dist/modules/onboarding/onboarding.service');
const { CatalogImportsService } = require('../dist/modules/catalog-imports/catalog-imports.service');

test('Phase C+D isolated database: signed channel → scoped DB → real AI agent → channel reply', async t => {
  const value = process.env.CHATTO_B_TEST_DATABASE_URL;
  assert.equal(process.env.CHATTO_B_TEST_DATABASE_CONFIRMED, '1');
  const url = new URL(value); assert.equal(url.hostname, '127.0.0.1'); assert.notEqual(url.port, '5432');
  assert.match(url.pathname, /^\/chatto_b_test_[0-9a-f]{16}$/);
  process.env.LINE_CREDENTIAL_ACTIVE_KEY_ID = 'cd';
  process.env.LINE_CREDENTIAL_KEYRING = JSON.stringify({ cd: randomBytes(32).toString('base64') });
  process.env.AI_SERVICE_TOKEN = randomBytes(32).toString('hex');
  process.env.INTERNAL_SERVICE_TOKEN = randomBytes(32).toString('hex');
  const prisma = new PrismaClient({ datasources: { db: { url: value } } }); await prisma.$connect();
  const merchants = new MerchantsService(prisma), ownership = new StoreInformationService(prisma, merchants);
  const sessions = new AuthSessionService(prisma), cipher = new CredentialCipherService(), internal = new InternalAiService(prisma);
  const runtime = new LineChannelRuntimeService(prisma, cipher);
  const role = await prisma.role.create({ data: { name: 'Owner', status: 'active' } });
  const replies = [], requests = [], responses = [];
  let mode = 'delivered', pauseAi, releaseAi, pauseReply, releaseReply, app, aiProcess;
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chatto-cd-ai-'));
  t.after(async () => {
    aiProcess?.kill(); await app?.close(); await prisma.$disconnect();
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('chatto-cd-ai-')); await fs.rm(directory, { recursive: true, force: true });
  });
  const provider = { verify: async input => ({ botUserId: 'U' + (input.externalChannelId === '7000000001' ? 'c' : 'd').repeat(32) }),
    reply: async (token, replyToken, text) => {
      replies.push({ token, replyToken, text });
      if (pauseReply) { pauseReply(); await new Promise(resolve => { releaseReply = resolve; }); }
      return mode === 'unauthorized' ? { outcome: 'rejected', statusCode: 401 }
        : { outcome: mode, ...(mode === 'delivered' ? { statusCode: 200 } : {}) };
    } };
  const line = new MerchantLineService(prisma, ownership, cipher, provider);
  async function tenant(label, externalChannelId) {
    const user = await prisma.user.create({ data: { name: label, globalRole: 'merchant_user' } });
    const merchant = await prisma.merchant.create({ data: { shopName: label, slug: randomUUID(), status: 'TRIAL', businessCategory: 'flowers', operatingHours: '09:00-18:00' } });
    await prisma.merchantUser.create({ data: { merchantId: merchant.id, userId: user.id, roleId: role.id } });
    const secret = randomBytes(16).toString('hex'), token = 'synthetic-cd-' + randomBytes(16).toString('hex');
    const configured = await line.configure(user.id, merchant.id, { externalChannelId, channelSecret: secret, channelAccessToken: token, expectedRevision: 0 });
    const channel = await line.verify(user.id, merchant.id, configured.id, configured.revision);
    const product = await prisma.product.create({ data: { merchantId: merchant.id, name: label + ' orchid', status: 'ACTIVE' } });
    await prisma.productVariant.create({ data: { merchantId: merchant.id, productId: product.id, variantName: label + ' only', status: 'ACTIVE', stockOnHand: 12, stockReserved: 2 } });
    const faq = await prisma.knowledgeBaseDocument.create({ data: { merchantId: merchant.id, type: 'faq', title: 'shipping', content: label + ' private shipping answer' } });
    const promotion = await prisma.knowledgeBaseDocument.create({ data: { merchantId: merchant.id, type: 'promotion', title: 'Existing knowledge only', content: label + ' private promotion information' } });
    const vector = await prisma.vectorDocument.create({ data: { merchantId: merchant.id, sourceId: faq.id, sourceType: 'faq', chunkText: label + ' private shipping answer' } });
    return { user, merchant, channel, secret, token, product, faq, promotion, vector, session: await sessions.create(user.id) };
  }
  const a = await tenant('CD Alpha', '7000000001'), b = await tenant('CD Beta', '7000000002');
  const onboarding = new OnboardingService(prisma, merchants);
  // Start the existing AI service from a directory with no application .env.
  const listener = net.createServer(); await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const aiPort = listener.address().port; await new Promise(resolve => listener.close(resolve));
  process.env.AI_SERVICE_BASE_URL = 'http://127.0.0.1:' + aiPort;
  const integration = new AiIntegrationService(internal);
  const ai = { chat: async request => {
    requests.push(request);
    if (pauseAi) { pauseAi(); await new Promise(resolve => { releaseAi = resolve; }); }
    if (mode === 'foreign_ai') return { ...request, merchant_id: b.merchant.id, reply: { text: 'Must never be sent' } };
    const result = await integration.chat(request); responses.push(result); return result;
  } };
  const webhooks = new LineWebhooksService(prisma, runtime, ai, provider);
  class TestModule {}
  Module({ controllers: [MerchantLineController, LineWebhooksController, InternalAiController], providers: [
    { provide: PrismaService, useValue: prisma }, { provide: AuthSessionService, useValue: sessions },
    { provide: StoreInformationService, useValue: ownership }, { provide: MerchantLineService, useValue: line }, MerchantLineGuard,
    { provide: LineWebhooksService, useValue: webhooks }, { provide: InternalAiService, useValue: internal },
  ] })(TestModule);
  app = await NestFactory.create(TestModule, { logger: false, rawBody: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); await app.listen(0, '127.0.0.1');
  const base = await app.getUrl(); process.env.WEB_URL = base;
  aiProcess = spawn(process.execPath, [path.resolve('../ai-service/dist/index.js')], {
    cwd: directory, windowsHide: true, stdio: 'ignore', env: { ...process.env, NODE_ENV: 'test', AI_SERVICE_PORT: String(aiPort),
      AI_LLM_PROVIDER: 'mock', GEMINI_API_KEY: '', OPENAI_API_KEY: '', INTERNAL_API_BASE_URL: base },
  });
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(process.env.AI_SERVICE_BASE_URL + '/health', { signal: AbortSignal.timeout(500) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Existing AI service starts with synthetic credentials and mock LLM');
  const event = (id, extra = {}) => ({ type: 'message', timestamp: Date.now(), webhookEventId: id, replyToken: 'synthetic-reply-' + id,
    source: { type: 'user', userId: 'same-line-user' }, message: { type: 'text', id: 'message-' + id, text: 'shipping' }, ...extra });
  const send = (who, events = [], extra = {}, signature, route) => {
    const raw = JSON.stringify({ destination: 'U' + (who === a ? 'c' : 'd').repeat(32), events, ...extra });
    return fetch(base + (route || '/webhooks/line/' + who.channel.id), { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-line-signature': signature ?? createHmac('sha256', who.secret).update(raw).digest('base64') }, body: raw });
  };
  const current = who => line.read(who.user.id, who.merchant.id).then(data => data.current);
  await t.test('credential verification leaves pending; unsigned/mismatched probes cannot complete Step 4', async () => {
    assert.equal((await current(a)).status, 'WEBHOOK_PENDING'); assert.equal((await onboarding.status(a.user.id, a.merchant.id)).completedSteps, 3);
    const count = await prisma.lineWebhookEvent.count();
    assert.equal((await send(a, [], {}, 'wrong')).status, 401);
    assert.equal((await send(a, [], { destination: 'U' + 'd'.repeat(32) })).status, 401);
    assert.equal((await current(a)).isConnected, false); assert.equal(await prisma.lineWebhookEvent.count(), count);
  });
  await t.test('unknown/unverified routes and legacy global fallback are rejected', async () => {
    assert.equal((await send(a, [], {}, undefined, '/webhooks/line/' + randomUUID())).status, 404);
    assert.equal((await send(a, [], {}, undefined, '/webhooks/line')).status, 503);
    const user = await prisma.user.create({ data: { name: 'Configured only', globalRole: 'merchant_user' } });
    const merchant = await prisma.merchant.create({ data: { shopName: 'Configured only', slug: randomUUID(), status: 'TRIAL' } });
    await prisma.merchantUser.create({ data: { merchantId: merchant.id, userId: user.id, roleId: role.id } });
    const channel = await line.configure(user.id, merchant.id, { externalChannelId: '7000000003', channelSecret: a.secret, channelAccessToken: a.token, expectedRevision: 0 });
    assert.equal((await send(a, [], {}, undefined, '/webhooks/line/' + channel.id)).status, 404);
  });
  await t.test('exact raw-body HMAC is channel-specific and whitespace-sensitive', async () => {
    const raw = JSON.stringify({ destination: 'U' + 'c'.repeat(32), events: [] });
    const signed = createHmac('sha256', a.secret).update(raw).digest('base64');
    assert.equal((await send(b, [], { destination: 'U' + 'c'.repeat(32) }, signed)).status, 401);
    const altered = await fetch(base + '/webhooks/line/' + a.channel.id, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-line-signature': signed }, body: raw + ' ' });
    assert.equal(altered.status, 401);
    assert.equal((await fetch(base + '/webhooks/line/' + a.channel.id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw })).status, 401);
  });
  await t.test('only signed identity-matching readiness probe promotes backend CONNECTED', async () => {
    assert.equal((await send(a)).status, 200); assert.equal((await send(b)).status, 200);
    for (const who of [a, b]) { const metadata = await current(who); assert.equal(metadata.status, 'CONNECTED'); assert.ok(metadata.webhookVerifiedAt); assert.ok(metadata.credentialsVerifiedAt); }
    assert.equal((await onboarding.status(a.user.id, a.merchant.id)).completedSteps, 4);
  });
  await t.test('A/B complete pipeline isolates same LINE user, provider event/message ID and forged merchant claims', async () => {
    const input = event('shared-provider-event', { merchant_id: b.merchant.id });
    assert.equal((await send(a, [input], { merchant_id: b.merchant.id })).status, 200);
    assert.equal((await send(b, [input])).status, 200);
    assert.equal(replies.length, 2); assert.equal(requests.length, 2);
    assert.deepEqual(requests.map(r => r.merchant_id), [a.merchant.id, b.merchant.id]);
    assert.deepEqual(replies.map(r => r.token), [a.token, b.token]);
    assert.ok(!replies[0].text.includes('CD Beta')); assert.ok(!replies[1].text.includes('CD Alpha'));
    const customers = await prisma.customer.findMany({ where: { externalUserId: 'same-line-user' } });
    assert.equal(customers.length, 2); assert.notEqual(customers[0].id, customers[1].id);
    for (const who of [a, b]) {
      const conversation = await prisma.conversation.findFirst({ where: { merchantId: who.merchant.id, channelId: who.channel.id } });
      assert.equal(await prisma.message.count({ where: { merchantId: who.merchant.id, conversationId: conversation.id } }), 2);
      const response = responses.find(r => r.merchant_id === who.merchant.id);
      assert.equal(response.generation.used_external_provider, false); assert.equal(response.generation.provider, 'mock');
      assert.ok(response.sources.length > 0, 'Existing AI agent actually retrieved tenant knowledge');
      assert.ok(response.sources.every(s => [who.faq.id, who.product.id].includes(s.source_id)));
    }
  });
  await t.test('products, FAQ, stock, vectors and conversation history remain tenant-scoped', async () => {
    const products = await internal.exportProducts(a.merchant.id); assert.deepEqual(products.products.map(p => p.id), [a.product.id]);
    assert.equal(products.products[0].variants[0].available_qty, 10);
    assert.deepEqual(new Set((await internal.exportKnowledgeBase(a.merchant.id)).knowledge_base.map(d => d.id)), new Set([a.faq.id, a.promotion.id]));
    assert.deepEqual((await internal.exportVectorDocuments(a.merchant.id)).map(d => d.id), [a.vector.id]);
    const foreign = await prisma.conversation.findFirst({ where: { merchantId: b.merchant.id } });
    assert.deepEqual(await internal.exportConversationHistory(a.merchant.id, foreign.id), []);
    assert.equal(await prisma.customerMemory.count(), 0, 'Existing memory adapter is an empty scaffold, not newly implemented');
  });
  await t.test('duplicate, concurrent redelivery and changed reply token cause no additional AI/reply/message', async () => {
    const beforeMessages = await prisma.message.count(), beforeAi = requests.length, beforeReplies = replies.length;
    const input = event('shared-provider-event', { replyToken: 'different-redelivery-token' });
    for (const response of await Promise.all([send(a, [input]), send(a, [input])])) { assert.equal(response.status, 200); assert.equal((await response.json()).duplicateEvents, 1); }
    assert.equal(await prisma.message.count(), beforeMessages); assert.equal(requests.length, beforeAi); assert.equal(replies.length, beforeReplies);
  });
  await t.test('same provider message with different event ID also remains idempotent', async () => {
    const input = event('another-event', { message: { type: 'text', id: 'message-shared-provider-event', text: 'shipping' } });
    const before = replies.length; assert.equal((await (await send(a, [input])).json()).duplicateEvents, 1); assert.equal(replies.length, before);
  });
  await t.test('stored event/message metadata excludes reply tokens, channel secrets and access tokens', async () => {
    const rows = await prisma.lineWebhookEvent.findMany({ where: { merchantId: { in: [a.merchant.id, b.merchant.id] } } });
    const messages = await prisma.message.findMany({ where: { merchantId: { in: [a.merchant.id, b.merchant.id] } } });
    const metadata = JSON.stringify([rows.map(r => r.rawPayload), messages.map(r => r.metadata)]);
    for (const privateValue of [a.secret, b.secret, a.token, b.token, 'synthetic-reply-', 'same-line-user']) assert.ok(!metadata.includes(privateValue));
  });
  await t.test('foreign processing job cannot read a guessed conversation/message or send a reply', async () => {
    const foreign = await prisma.message.findFirst({ where: { merchantId: b.merchant.id, senderType: 'CUSTOMER' } });
    const own = await current(a), before = replies.length;
    await webhooks.respond({ merchantId: a.merchant.id, channelId: a.channel.id, revision: own.revision, botUserId: 'U' + 'c'.repeat(32),
      eventId: scopedLineEventId(a.channel.id, event('shared-provider-event')), customerId: requests[1].customer.id,
      conversationId: foreign.conversationId, messageId: foreign.id }, event('job'));
    assert.equal(replies.length, before);
  });
  await t.test('foreign import jobs cannot be read, confirmed or cancelled', async () => {
    const job = await prisma.catalogImport.create({ data: { merchantId: b.merchant.id, uploadedById: b.user.id,
      originalName: 'synthetic.csv', format: 'csv', mimeType: 'text/csv', byteSize: 10, sha256: randomBytes(32).toString('hex'), status: 'PREVIEW', expiresAt: new Date(Date.now() + 60000) } });
    const imports = new CatalogImportsService(prisma, ownership);
    for (const action of ['read', 'confirm', 'cancel']) await assert.rejects(imports[action](a.user.id, a.merchant.id, job.id), e => e.getStatus() === 404);
    assert.equal((await prisma.catalogImport.findUnique({ where: { id: job.id } })).status, 'PREVIEW');
  });
  await t.test('unauthorized Step 4, foreign reads/writes and channel ownership are denied', async () => {
    const route = '/merchants/' + b.merchant.id + '/line-channel';
    assert.equal((await fetch(base + route)).status, 401);
    for (const method of ['GET', 'PUT']) assert.equal((await fetch(base + route, { method, headers: { Cookie: 'chatto_session=' + a.session, Origin: base } })).status, 404);
    for (const action of ['verify', 'disconnect']) assert.equal((await fetch(base + '/merchants/' + a.merchant.id + '/line-channel/' + b.channel.id + '/' + action,
      { method: 'POST', headers: { Cookie: 'chatto_session=' + a.session, Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision: 3 }) })).status, 404);
    const metadata = JSON.stringify(await current(b)); assert.ok(!metadata.includes(b.secret)); assert.ok(!metadata.includes(b.token));
  });
  await t.test('malformed signed payload is rejected without messages or connection changes', async () => {
    const before = await prisma.message.count(); assert.equal((await send(a, [null])).status, 400);
    assert.equal((await send(a, 'invalid')).status, 400); assert.equal(await prisma.message.count(), before);
  });
  await t.test('unsupported and standby/group events never invoke AI or outbound reply', async () => {
    const before = replies.length, beforeAi = requests.length;
    assert.equal((await send(a, [event('standby', { mode: 'standby' }), event('group', { source: { type: 'group', userId: 'same-line-user' } })])).status, 200);
    assert.equal(replies.length, before); assert.equal(requests.length, beforeAi);
  });
  await t.test('foreign AI response identity cannot be persisted or sent', async () => {
    mode = 'foreign_ai'; const before = replies.length, count = await prisma.message.count({ where: { senderType: 'AI' } });
    assert.equal((await send(a, [event('wrong-ai')])).status, 200);
    assert.equal(replies.length, before); assert.equal(await prisma.message.count({ where: { senderType: 'AI' } }), count); mode = 'delivered';
  });
  await t.test('ambiguous provider timeout is recorded and never automatically resent', async () => {
    mode = 'unknown'; const input = event('uncertain-delivery'), before = replies.length;
    assert.equal((await send(a, [input])).status, 200); assert.equal((await send(a, [input])).status, 200);
    assert.equal(replies.length, before + 1);
    const stored = await prisma.lineWebhookEvent.findUnique({ where: { webhookEventId: scopedLineEventId(a.channel.id, input) } });
    assert.equal(stored.rawPayload.phase, 'unknown'); mode = 'delivered';
  });
  await t.test('provider authentication rejection clears readiness without releasing ownership or retrying', async () => {
    mode = 'unauthorized'; const input = event('expired-channel-token'), before = replies.length;
    assert.equal((await send(a, [input])).status, 200); assert.equal(replies.length, before + 1);
    const metadata = await current(a); assert.equal(metadata.status, 'ERROR'); assert.equal(metadata.isConnected, false);
    assert.equal(metadata.credentialsVerifiedAt, null); assert.equal(metadata.webhookVerifiedAt, null);
    const stored = await prisma.channel.findUnique({ where: { id: a.channel.id } }); assert.ok(stored.lineClaimedAt);
    assert.equal((await onboarding.status(a.user.id, a.merchant.id)).completedSteps, 3);
    assert.equal((await send(a, [input])).status, 404); assert.equal(replies.length, before + 1);
    mode = 'delivered'; await line.verify(a.user.id, a.merchant.id, metadata.id, metadata.revision);
    assert.equal((await current(a)).status, 'WEBHOOK_PENDING'); assert.equal((await send(a)).status, 200);
  });
  await t.test('credential rotation invalidates an old AI job, then requires fresh credentials and signed webhook proof', async () => {
    const before = replies.length; let started; const barrier = new Promise(resolve => { started = resolve; }); pauseAi = started;
    const pending = send(b, [event('stale-after-rotation')]); await barrier;
    const snapshot = await current(b), nextSecret = randomBytes(16).toString('hex');
    const configured = await line.configure(b.user.id, b.merchant.id, { externalChannelId: '7000000002', channelSecret: nextSecret,
      channelAccessToken: b.token, expectedRevision: snapshot.revision });
    pauseAi = null; releaseAi(); assert.equal((await pending).status, 200); assert.equal(replies.length, before);
    assert.equal((await current(b)).isConnected, false); assert.equal((await send(b)).status, 404);
    await line.verify(b.user.id, b.merchant.id, b.channel.id, configured.revision);
    assert.equal((await send(b)).status, 401, 'Old secret no longer authenticates');
    b.secret = nextSecret; assert.equal((await send(b)).status, 200);
  });
  await t.test('human takeover and blocked customers preserve inbound messages without automated replies', async () => {
    const conversation = await prisma.conversation.findFirst({ where: { merchantId: a.merchant.id } });
    const before = replies.length;
    await prisma.conversation.update({ where: { id: conversation.id }, data: { status: 'HUMAN_ACTIVE' } });
    assert.equal((await send(a, [event('human-takeover')])).status, 200); assert.equal(replies.length, before);
    await prisma.conversation.update({ where: { id: conversation.id }, data: { status: 'AI_ACTIVE' } });
    await prisma.customer.update({ where: { id: conversation.customerId }, data: { isBlocked: true } });
    assert.equal((await send(a, [event('blocked-customer')])).status, 200); assert.equal(replies.length, before);
    await prisma.customer.update({ where: { id: conversation.customerId }, data: { isBlocked: false } });
  });
  await t.test('disconnect during AI invalidates stale job before AI persistence or LINE delivery', async () => {
    const before = replies.length, beforeAiMessages = await prisma.message.count({ where: { senderType: 'AI' } });
    let started; const barrier = new Promise(resolve => { started = resolve; }); pauseAi = started;
    const pending = send(b, [event('stale-after-disconnect')]); await barrier;
    const snapshot = await current(b); await line.disconnect(b.user.id, b.merchant.id, snapshot.id, snapshot.revision);
    pauseAi = null; releaseAi(); assert.equal((await pending).status, 200);
    assert.equal(replies.length, before); assert.equal(await prisma.message.count({ where: { senderType: 'AI' } }), beforeAiMessages);
    assert.equal((await send(b)).status, 404);
  });
  await t.test('rotation/disconnect waits for an already-authorized in-flight LINE reply', async () => {
    let started; const barrier = new Promise(resolve => { started = resolve; }); pauseReply = started;
    const pending = send(a, [event('reply-lock')]); await barrier;
    let disconnected = false; const snapshot = await current(a);
    const disconnect = line.disconnect(a.user.id, a.merchant.id, snapshot.id, snapshot.revision).then(() => { disconnected = true; });
    await new Promise(resolve => setTimeout(resolve, 100)); assert.equal(disconnected, false);
    pauseReply = null; releaseReply(); assert.equal((await pending).status, 200); await disconnect;
    assert.equal((await send(a)).status, 404); assert.equal((await onboarding.status(a.user.id, a.merchant.id)).completedSteps, 3);
  });
});
