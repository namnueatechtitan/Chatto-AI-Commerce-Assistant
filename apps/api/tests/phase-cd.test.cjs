const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
const { LineProviderAdapter } = require('../dist/modules/merchant-line/line-provider.adapter');
const { LineChannelRuntimeService } = require('../dist/modules/line-webhooks/line-channel-runtime.service');
const { LineWebhooksService } = require('../dist/modules/line-webhooks/line-webhooks.service');

test('LINE replies require separate live opt-in without performing a provider call', async t => {
  const previous = process.env.LINE_REPLY_ENABLED; delete process.env.LINE_REPLY_ENABLED;
  t.after(() => previous === undefined ? delete process.env.LINE_REPLY_ENABLED : process.env.LINE_REPLY_ENABLED = previous);
  let calls = 0; const provider = new LineProviderAdapter(async () => { calls++; throw Error('No external calls'); });
  await assert.rejects(provider.reply('synthetic-token', 'synthetic-reply', 'test'), e => e.getStatus() === 503); assert.equal(calls, 0);
});
test('reply adapter sends the resolved token only in Authorization and bounds text; no redirect/response-body exposure', async t => {
  const previous = process.env.LINE_REPLY_ENABLED; process.env.LINE_REPLY_ENABLED = 'true';
  t.after(() => previous === undefined ? delete process.env.LINE_REPLY_ENABLED : process.env.LINE_REPLY_ENABLED = previous);
  const calls = [], secret = randomBytes(32).toString('hex');
  const provider = new LineProviderAdapter(async (url, init) => { calls.push({ url, init }); return new Response('private-response-' + secret); });
  assert.deepEqual(await provider.reply(secret, 'synthetic-reply', 'x'.repeat(6000)), { outcome: 'delivered', statusCode: 200 });
  const { url, init } = calls[0]; assert.equal(url, 'https://api.line.me/v2/bot/message/reply'); assert.ok(!url.includes(secret));
  assert.equal(init.headers.Authorization, 'Bearer ' + secret); assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
  assert.equal(JSON.parse(init.body).messages[0].text.length, 5000);
});
test('provider transport/5xx results stay uncertain and errors do not expose bodies or credentials', async t => {
  const previous = process.env.LINE_REPLY_ENABLED; process.env.LINE_REPLY_ENABLED = 'true';
  t.after(() => previous === undefined ? delete process.env.LINE_REPLY_ENABLED : process.env.LINE_REPLY_ENABLED = previous);
  const secret = randomBytes(32).toString('hex');
  for (const fetcher of [async () => { throw Error(secret); }, async () => new Response(secret, { status: 503 }), async () => new Response(secret, { status: 401 })]) {
    const result = await new LineProviderAdapter(fetcher).reply(secret, 'synthetic', 'test');
    assert.ok(['unknown', 'rejected'].includes(result.outcome)); assert.ok(!JSON.stringify(result).includes(secret));
  }
});
function fixture(overrides = {}, platforms = 1, claims = 1) {
  const secret = randomBytes(16).toString('hex'), channelId = randomUUID(), merchantId = randomUUID(), platformId = randomUUID();
  let contexts = [];
  const channel = { id: channelId, merchantId, externalChannelId: '7000000001', status: 'WEBHOOK_PENDING',
    credentialRevision: 1, accessTokenEncrypted: 'ciphertext-token', channelSecretEncrypted: 'ciphertext-secret',
    credentialsVerifiedAt: new Date(), lineClaimedAt: new Date(), lineBotUserId: 'U' + 'c'.repeat(32), ...overrides };
  const runtime = new LineChannelRuntimeService({ $queryRawUnsafe: async () => Array.from({ length: platforms }, () => ({ id: platformId })),
    channel: { findFirst: async () => channel, findMany: async () => Array.from({ length: claims }, (_, i) => ({ id: i ? randomUUID() : channelId })) } },
    { decrypt: (value, context) => { contexts.push({ value, context }); return secret; } });
  const raw = Buffer.from(JSON.stringify({ destination: channel.lineBotUserId, events: [] }));
  const signature = createHmac('sha256', secret).update(raw).digest('base64');
  return { runtime, channelId, merchantId, contexts, raw, signature };
}
test('ambiguous platform or OA claims are rejected before decrypting credentials', async () => {
  for (const [platforms, claims] of [[2, 1], [1, 2], [0, 1]]) {
    const data = fixture({}, platforms, claims);
    await assert.rejects(data.runtime.authenticate(data.channelId, data.signature, data.raw), e => [404, 503].includes(e.getStatus()));
    assert.equal(data.contexts.length, 0);
  }
});
test('disconnected, configured, fabricated CONNECTED and incomplete proof cannot receive webhooks', async () => {
  for (const overrides of [{ status: 'DISCONNECTED' }, { status: 'CONFIGURED' }, { status: 'CONNECTED', isConnected: true, webhookVerifiedAt: null },
    { credentialsVerifiedAt: null }, { lineClaimedAt: null }, { lineBotUserId: 'invalid' }, { externalChannelId: 'unverified-name' }]) {
    const data = fixture(overrides);
    await assert.rejects(data.runtime.authenticate(data.channelId, data.signature, data.raw), e => e.getStatus() === 404); assert.equal(data.contexts.length, 0);
  }
});
test('signature decryption is bound to resolved merchant/channel/field, never payload claims', async () => {
  const data = fixture(); const context = await data.runtime.authenticate(data.channelId, data.signature, data.raw);
  assert.equal(context.merchantId, data.merchantId); assert.equal(context.channelId, data.channelId);
  assert.deepEqual(data.contexts[0], { value: 'ciphertext-secret', context: { merchantId: data.merchantId, channelId: data.channelId, field: 'channelSecret' } });
  await assert.rejects(data.runtime.accept(context, 'U' + 'd'.repeat(32)), e => e.getStatus() === 401);
});
test('webhook storage failures return sanitized 503 instead of logging ORM argument/customer-content dumps', async () => {
  const privateText = 'synthetic-private-content-' + randomUUID();
  const service = new LineWebhooksService({}, { authenticate: async () => { throw Error(privateText); } }, {}, {});
  await assert.rejects(service.receive(randomUUID(), 'synthetic', Buffer.from('{}')), e => e.getStatus() === 503 && !e.message.includes(privateText));
});

test('outbound generation and channel evidence survive reservation and final delivery without private provider payloads', async t => {
  const privateValue = 'synthetic-private-provider-output-' + randomUUID();
  const scenarios = [
    { name: 'real Gemini generation', input: { provider: 'gemini', model: 'gemini-3.1-flash-lite', used_external_provider: true, fallback_used: false },
      expected: { provider: 'gemini', model: 'gemini-3.1-flash-lite', used_external_provider: true, fallback_used: false } },
    { name: 'Gemini fallback remains distinguishable', input: { provider: 'gemini', model: 'gemini-3.1-flash-lite', used_external_provider: false, fallback_used: true },
      expected: { provider: 'gemini', model: 'gemini-3.1-flash-lite', used_external_provider: false, fallback_used: true } },
    { name: 'missing generation is not external-provider proof', input: undefined, expected: null },
    { name: 'unknown provider text is discarded', input: { provider: privateValue, model: privateValue, used_external_provider: true, fallback_used: false }, expected: null },
    { name: 'unrecognized model text is discarded', input: { provider: 'gemini', model: privateValue, used_external_provider: false, fallback_used: true },
      expected: { provider: 'gemini', model: null, used_external_provider: false, fallback_used: true } },
    { name: 'non-boolean generation claims are not evidence', input: { provider: 'gemini', model: 'gemini-3.1-flash-lite', used_external_provider: 'true', fallback_used: false }, expected: null },
  ];
  for (const scenario of scenarios) await t.test(scenario.name, async () => {
    const job = { merchantId: randomUUID(), channelId: randomUUID(), customerId: randomUUID(), conversationId: randomUUID(),
      messageId: randomUUID(), eventId: 'line_' + randomBytes(32).toString('hex'), revision: 7 };
    const event = { id: randomUUID(), rawPayload: { revision: job.revision, phase: 'received' } };
    const inbound = { id: job.messageId, content: 'Synthetic customer message', metadata: { line: { sourceWebhookEventId: job.eventId } } };
    const writes = [], providerCalls = [], failures = [];
    const db = {
      lineWebhookEvent: { findFirst: async () => event, update: async ({ data }) => Object.assign(event, data) },
      message: { findFirst: async () => inbound,
        create: async ({ data }) => { writes.push(structuredClone(data.metadata)); return { ...data, id: randomUUID() }; },
        update: async ({ data }) => { writes.push(structuredClone(data.metadata)); return data; } },
      conversation: { update: async () => ({}) },
    };
    const channel = { id: job.channelId, merchantId: job.merchantId, credentialRevision: job.revision };
    const runtime = { locked: async (context, action) => { assert.equal(context.merchantId, job.merchantId); return action(db, channel); },
      accessToken: resolved => { assert.equal(resolved.id, job.channelId); return 'synthetic-resolved-channel-token'; } };
    const ai = { chat: async request => {
      assert.equal(request.merchant_id, job.merchantId); assert.equal(request.conversation_id, job.conversationId);
      return { request_id: job.eventId, merchant_id: job.merchantId, conversation_id: job.conversationId, reply: { text: 'Synthetic reply' },
        ...(scenario.input ? { generation: { ...scenario.input, fallback_reason: privateValue, debug: privateValue, access_token: privateValue } } : {}),
        debug: { llm: { error: privateValue } } };
    } };
    const provider = { reply: async (...args) => { providerCalls.push(args); assert.equal(writes[0].line.delivery, 'reserved');
      return { outcome: 'delivered', statusCode: 200 }; } };
    const service = new LineWebhooksService({ lineWebhookEvent: { updateMany: async () => { failures.push(true); } } }, runtime, ai, provider);
    await service.respond(job, { timestamp: Date.now(), replyToken: 'synthetic-reply-token' });
    assert.equal(failures.length, 0); assert.equal(providerCalls.length, 1); assert.equal(writes.length, 2);
    assert.equal(providerCalls[0][0], 'synthetic-resolved-channel-token');
    for (const metadata of writes) {
      assert.deepEqual(metadata.ai, { requestId: job.eventId, generation: scenario.expected });
      assert.equal(metadata.line.sourceWebhookEventId, job.eventId); assert.equal(metadata.line.channelId, job.channelId);
      assert.equal(metadata.line.credentialRevision, job.revision); assert.ok(!JSON.stringify(metadata).includes(privateValue));
      assert.ok(!JSON.stringify(metadata).includes('synthetic-reply-token')); assert.ok(!JSON.stringify(metadata).includes('synthetic-resolved-channel-token'));
    }
    assert.equal(writes[0].line.delivery, 'reserved'); assert.equal(writes[1].line.delivery, 'delivered'); assert.equal(writes[1].line.statusCode, 200);
    assert.equal(event.rawPayload.phase, 'delivered');
  });
});
