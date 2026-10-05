const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { Module, ValidationPipe } = require('@nestjs/common');
const { InternalAiController } = require('../dist/modules/internal-ai/internal-ai.controller');
const { InternalAiService } = require('../dist/modules/internal-ai/internal-ai.service');
const { AiIntegrationService } = require('../dist/modules/ai-integration/ai-integration.service');
const { LineWebhooksController } = require('../dist/modules/line-webhooks/line-webhooks.controller');
const { LineWebhooksService } = require('../dist/modules/line-webhooks/line-webhooks.service');
const { LineSignatureService } = require('../dist/modules/line-webhooks/line-signature.service');
const { LineChannelRuntimeService } = require('../dist/modules/line-webhooks/line-channel-runtime.service');

test('internal HTTP routes authenticate before validation and reject missing tenant scope or credentials', async (t) => {
  const original = process.env.INTERNAL_SERVICE_TOKEN;
  const token = randomBytes(32).toString('hex'), merchantId = randomUUID();
  process.env.INTERNAL_SERVICE_TOKEN = token;
  t.after(() => { original === undefined ? delete process.env.INTERNAL_SERVICE_TOKEN : process.env.INTERNAL_SERVICE_TOKEN = original; });
  let calls = 0;
  const internal = new InternalAiService({ product: { findMany: async () => { calls++; return []; } } });
  class TestModule {}
  Module({ controllers: [InternalAiController], providers: [{ provide: InternalAiService, useValue: internal }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1'); t.after(() => app.close());
  const base = await app.getUrl(), headers = { Authorization: `Bearer ${token}` };
  for (const route of ['products/export', 'knowledge-base/export', 'vector-documents/export', `merchant-settings/${merchantId}`]) {
    for (const authorization of [undefined, 'Bearer wrong', 'Basic wrong']) {
      assert.equal((await fetch(`${base}/internal/ai/${route}`, { headers: authorization ? { Authorization: authorization } : {} })).status, 401);
    }
  }
  for (const query of ['', '?merchant_id=invalid', `?merchant_id=${merchantId}&merchant_id=${randomUUID()}`]) {
    assert.equal((await fetch(`${base}/internal/ai/products/export${query}`, { headers })).status, 400);
  }
  assert.equal(calls, 0);
  assert.equal((await fetch(`${base}/internal/ai/products/export?merchant_id=${merchantId}`, { headers })).status, 200);
  assert.equal(calls, 1);
  for (const body of [{}, { merchant_id: merchantId, documents: 'invalid' }, { merchant_id: merchantId, documents: [null] },
    { merchant_id: merchantId, documents: [{ id: 'invalid', merchant_id: merchantId, source_id: randomUUID(), source_type: 'faq', chunk_text: 'Text', status: 'active', embedding: ['not-a-number'] }] }]) {
    assert.equal((await fetch(`${base}/internal/ai/vector-documents/sync`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, 400);
  }
  delete process.env.INTERNAL_SERVICE_TOKEN;
  assert.equal((await fetch(`${base}/internal/ai/products/export?merchant_id=${merchantId}`, { headers })).status, 503);
  assert.equal(calls, 1);
});

test('direct internal callers cannot omit tenant filters; nested exports carry tenant scope', async () => {
  const merchantId = randomUUID(), conversationId = randomUUID();
  let queries = [];
  const prisma = Object.fromEntries(['product', 'knowledgeBaseDocument', 'vectorDocument', 'message'].map((name) => [name, { findMany: async (query) => { queries.push(query); return []; } }]));
  const internal = new InternalAiService(prisma);
  for (const invalid of [undefined, '', 'invalid']) {
    for (const method of ['exportProducts', 'exportKnowledgeBase', 'exportVectorDocuments', 'exportMerchantSettings']) {
      await assert.rejects(internal[method](invalid), (error) => error.getStatus() === 400);
    }
  }
  assert.equal(queries.length, 0);
  await internal.exportProducts(merchantId);
  const productQuery = queries.pop();
  assert.equal(productQuery.where.merchantId, merchantId);
  assert.equal(productQuery.include.variants.where.merchantId, merchantId);
  assert.equal(productQuery.include.images.where.merchantId, merchantId);
  await internal.exportConversationHistory(merchantId, conversationId);
  const historyQuery = queries.pop();
  for (const scoped of [historyQuery.where, historyQuery.where.conversation, historyQuery.where.conversation.customer, historyQuery.where.conversation.channel]) assert.equal(scoped.merchantId, merchantId);
  await assert.rejects(internal.syncVectorDocuments(merchantId, [{ merchant_id: randomUUID() }]), (error) => error.getStatus() === 400);
});

test('channel webhook requires exact raw-body HMAC before event processing; global fallback fails closed', async (t) => {
  const secret = randomBytes(32).toString('hex'), raw = Buffer.from('{"events":[]}');
  const signature = createHmac('sha256', secret).update(raw).digest('base64');
  let lookups = 0;
  // ConfigService v3 prioritizes process.env; Nest's global ConfigModule may load
  // root .env asynchronously. This fixture must never consume live configuration.
  const fixture = { LINE_CHANNEL_SECRET: secret, LINE_CHANNEL_ID: 'fixture-line-channel' };
  const config = { get: (key) => fixture[key] };
  const channelId = randomUUID(), merchantId = randomUUID(), platformId = randomUUID();
  const runtime = new LineChannelRuntimeService({
    $queryRawUnsafe: async () => [{ id: platformId }],
    channel: { findFirst: async () => ({ id: channelId, merchantId, externalChannelId: '1234567890', credentialRevision: 1,
      status: 'WEBHOOK_PENDING', accessTokenEncrypted: 'fixture', channelSecretEncrypted: 'fixture',
      credentialsVerifiedAt: new Date(), lineClaimedAt: new Date(), lineBotUserId: 'U' + 'a'.repeat(32) }),
      findMany: async () => [{ id: channelId }] },
  }, { decrypt: () => secret });
  runtime.accept = async context => { lookups++; return context; };
  const service = new LineWebhooksService({}, runtime, {}, {});
  class TestModule {}
  Module({ controllers: [LineWebhooksController], providers: [{ provide: LineWebhooksService, useValue: service }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false, rawBody: true });
  await app.listen(0, '127.0.0.1'); t.after(() => app.close());
  const base = await app.getUrl();
  const send = (body, signed) => fetch(base + '/webhooks/line/' + channelId, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(signed ? { 'x-line-signature': signed } : {}) }, body });
  assert.equal((await send(raw)).status, 401);
  assert.equal((await send(raw, 'wrong')).status, 401);
  assert.equal((await send('{"events":[],"modified":true}', signature)).status, 401);
  assert.equal(lookups, 0);
  assert.equal((await send(raw, signature)).status, 200);
  assert.equal(lookups, 1);
  assert.equal((await fetch(base + '/webhooks/line', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 503);
});

test('AI integration fails closed before exports and rejects mismatched response identities without leaking provider errors', async (t) => {
  const original = process.env.AI_SERVICE_TOKEN, originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; original === undefined ? delete process.env.AI_SERVICE_TOKEN : process.env.AI_SERVICE_TOKEN = original; });
  let exports = 0;
  const context = Object.fromEntries(['exportMerchantSettings', 'exportProducts', 'exportKnowledgeBase', 'exportVectorDocuments', 'exportConversationHistory'].map((method) => [method, async () => { exports++; return []; }]));
  const service = new AiIntegrationService(context);
  const request = { request_id: randomUUID(), merchant_id: randomUUID(), conversation_id: randomUUID(), customer: { id: randomUUID() }, message: { id: randomUUID(), text: 'Fixture', timestamp: new Date().toISOString() }, channel: 'line' };
  delete process.env.AI_SERVICE_TOKEN;
  await assert.rejects(service.chat(request), (error) => error.getStatus() === 503);
  assert.equal(exports, 0);
  process.env.AI_SERVICE_TOKEN = randomBytes(32).toString('hex');
  for (const property of ['merchant_id', 'conversation_id', 'request_id']) {
    global.fetch = async () => new Response(JSON.stringify({ ...request, [property]: randomUUID(), reply: { text: 'Fixture reply' } }));
    await assert.rejects(service.chat(request), (error) => error.getStatus() === 502);
  }
  global.fetch = async () => new Response('private-provider-error', { status: 500 });
  await assert.rejects(service.chat(request), (error) => error.getStatus() === 502 && !error.message.includes('private-provider-error'));
  global.fetch = async () => new Response(JSON.stringify({ ...request, reply: { text: 'Fixture reply' } }));
  assert.equal((await service.chat(request)).reply.text, 'Fixture reply');
});
