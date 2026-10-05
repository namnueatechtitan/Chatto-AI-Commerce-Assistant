const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/' + file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const result = {}; new Function('exports', 'require', code)(result, require); return result;
}
const { configureLine, changeLine, readLineConfiguration, lineConnected, lineWebhookReady, lineWebhookCopyable, LineApiError } = load('merchant-line-api.ts');
const { channelWebhookUrl } = load('line-webhook-url.ts');
const merchant = '00000000-0000-4000-8000-000000000001', channel = { id: '00000000-0000-4000-8000-000000000002', revision: 7 };
test('LINE client sends authenticated merchant-scoped writes with fresh revision and credentials only in PUT body', async t => {
  const original = global.fetch, calls = []; t.after(() => { global.fetch = original; });
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ current: null, history: [] }); };
  const input = { externalChannelId: '7000000001', channelSecret: 'a'.repeat(32), channelAccessToken: 'synthetic-token-only', expectedRevision: 7 };
  await configureLine(merchant, input); await changeLine(merchant, channel, 'verify'); await changeLine(merchant, channel, 'disconnect');
  await readLineConfiguration(merchant);
  assert.equal(calls.length, 4);
  for (const call of calls) { assert.ok(call.url.startsWith('/api/merchants/' + merchant + '/line-channel')); assert.equal(call.init.credentials, 'same-origin'); assert.equal(call.init.cache, 'no-store'); assert.ok(!call.url.includes(input.channelSecret)); assert.ok(!call.url.includes(input.channelAccessToken)); }
  assert.deepEqual(JSON.parse(calls[0].init.body), input);
  for (const call of calls.slice(1, 3)) assert.deepEqual(JSON.parse(call.init.body), { expectedRevision: 7 });
  assert.equal(calls[3].init.body, undefined);
});
test('partial saves omit absent credential fields and preserve the current revision in the request', async t => {
  const original = global.fetch, calls = []; t.after(() => { global.fetch = original; });
  global.fetch = async (url, init) => { calls.push({ url, init }); return Response.json(channel); };
  await configureLine(merchant, { channelAccessToken: 'replacement-fixture-token', expectedRevision: 7 });
  await configureLine(merchant, { channelSecret: 'b'.repeat(32), expectedRevision: 7 });
  await configureLine(merchant, { externalChannelId: undefined, channelSecret: undefined, channelAccessToken: undefined, expectedRevision: 7 });
  assert.deepEqual(calls.map(call => JSON.parse(call.init.body)), [
    { channelAccessToken: 'replacement-fixture-token', expectedRevision: 7 },
    { channelSecret: 'b'.repeat(32), expectedRevision: 7 },
    { expectedRevision: 7 },
  ]);
  assert.ok(calls.every(call => call.url === '/api/merchants/' + merchant + '/line-channel' && call.init.method === 'PUT'));
});
test('invalid merchant/channel IDs never issue requests', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; }); global.fetch = async () => { throw Error('Request forbidden'); };
  await assert.rejects(readLineConfiguration('bad'), e => e instanceof LineApiError && e.status === 400);
  await assert.rejects(changeLine(merchant, { ...channel, id: 'bad' }, 'verify'), e => e instanceof LineApiError && e.status === 400);
});
test('session/permission/revision/provider errors never echo backend content', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  for (const status of [400, 401, 403, 404, 409, 503]) {
    global.fetch = async () => new Response('private-token-and-provider-error', { status });
    await assert.rejects(readLineConfiguration(merchant), e => e instanceof LineApiError && e.status === status && !e.message.includes('private-token'));
  }
});
test('known ownership conflicts get actionable messages without echoing other response fields', async t => {
  const original = global.fetch; t.after(() => { global.fetch = original; });
  const input = { externalChannelId: '7000000001', channelSecret: 'a'.repeat(32), channelAccessToken: 'synthetic-token-only', expectedRevision: 0 };
  global.fetch = async () => Response.json({ message: 'LINE association is unavailable', private: input.channelAccessToken }, { status: 409 });
  await assert.rejects(configureLine(merchant, input), e => e instanceof LineApiError && e.status === 409 && e.message.includes('ร้านอื่น') && !e.message.includes(input.channelAccessToken));
  global.fetch = async () => Response.json({ message: 'untrusted ' + input.channelAccessToken }, { status: 409 });
  await assert.rejects(configureLine(merchant, input), e => e instanceof LineApiError && e.message.includes('ข้อมูลการเชื่อมต่อเปลี่ยนแล้ว') && !e.message.includes(input.channelAccessToken));
});
test('frontend readiness requires backend CONNECTED and both verification proofs', () => {
  const ready = { ...channel, status: 'CONNECTED', isConnected: true, hasCredentials: true, credentialsVerifiedAt: '2026-10-03', webhookVerifiedAt: '2026-10-03' };
  assert.equal(lineConnected(ready), true);
  for (const partial of [null, { ...ready, status: 'WEBHOOK_PENDING' }, { ...ready, isConnected: false }, { ...ready, webhookVerifiedAt: null }, { ...ready, credentialsVerifiedAt: null }]) assert.equal(lineConnected(partial), false);
});
test('copy URL exists only for explicitly configured public HTTPS channel route prefix', () => {
  // Synthetic fixture domain only; never imported by production configuration.
  assert.equal(channelWebhookUrl('https://hooks.fixture.com/webhooks/line/', channel.id), 'https://hooks.fixture.com/webhooks/line/' + channel.id);
  for (const prefix of [null, 'http://hooks.fixture.com/webhooks/line', 'https://localhost/webhooks/line', 'https://example.com/webhooks/line', 'https://hooks.fixture.com/other', 'https://token@hooks.fixture.com/webhooks/line']) assert.equal(channelWebhookUrl(prefix, channel.id), null);
  assert.equal(channelWebhookUrl('https://hooks.fixture.com/webhooks/line', undefined), null);
});
test('provider readiness requires provider proof and never implies webhook connection', () => {
  const pending = { ...channel, status: 'WEBHOOK_PENDING', hasCredentials: true, isConnected: false,
    credentialsVerifiedAt: '2026-10-05', webhookVerifiedAt: null };
  assert.equal(lineWebhookReady(pending), true);
  assert.equal(lineConnected(pending), false);
  for (const partial of [null, { ...pending, credentialsVerifiedAt: null }, { ...pending, hasCredentials: false },
    ...['CONFIGURED', 'ERROR', 'DISCONNECTED', 'DISABLED', 'CONNECTED'].map(status => ({ ...pending, status }))]) {
    assert.equal(lineWebhookReady(partial), false);
  }
  assert.equal(lineWebhookReady({ ...pending, status: 'CONNECTED', isConnected: true, webhookVerifiedAt: '2026-10-05' }), true);
});
test('a stable stored URL alone never grants readiness to copy or verify', () => {
  for (const status of ['CONFIGURED', 'ERROR', 'WEBHOOK_PENDING', 'DISCONNECTED', 'DISABLED']) {
    const stored = { ...channel, status, hasCredentials: true, isConnected: false, credentialsVerifiedAt: null, webhookVerifiedAt: null };
    assert.equal(channelWebhookUrl('https://hooks.fixture.com/webhooks/line', stored.id), 'https://hooks.fixture.com/webhooks/line/' + channel.id);
    assert.equal(lineWebhookCopyable(stored), false);
    assert.equal(lineWebhookReady(stored), false);
    assert.equal(lineConnected(stored), false);
  }
  const pending = { ...channel, status: 'WEBHOOK_PENDING', hasCredentials: true, isConnected: false,
    credentialsVerifiedAt: '2026-10-05', webhookVerifiedAt: null };
  assert.equal(lineWebhookCopyable(pending), true);
  assert.equal(lineWebhookCopyable({ ...pending, id: 'bad' }), false);
});
