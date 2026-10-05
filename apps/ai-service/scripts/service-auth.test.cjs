const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');
const { configuredServiceToken, requireServiceToken } = require('../dist/service-auth');
const { VectorStoreClient } = require('../dist/modules/vector-store');

test('missing service configuration cannot use a fallback or send a vector request', async (t) => {
  const oldAI = process.env.AI_SERVICE_TOKEN, oldInternal = process.env.INTERNAL_SERVICE_TOKEN, oldFetch = global.fetch;
  t.after(() => {
    oldAI === undefined ? delete process.env.AI_SERVICE_TOKEN : process.env.AI_SERVICE_TOKEN = oldAI;
    oldInternal === undefined ? delete process.env.INTERNAL_SERVICE_TOKEN : process.env.INTERNAL_SERVICE_TOKEN = oldInternal;
    global.fetch = oldFetch;
  });
  delete process.env.AI_SERVICE_TOKEN; delete process.env.INTERNAL_SERVICE_TOKEN;
  assert.throws(() => configuredServiceToken('AI_SERVICE_TOKEN'), /not configured/);
  let status, continued = false, calls = 0;
  const response = { status: (code) => { status = code; return response; }, json: () => response };
  requireServiceToken({ headers: {} }, response, () => { continued = true; });
  assert.equal(status, 503); assert.equal(continued, false);
  global.fetch = async () => { calls++; throw new Error('No network expected'); };
  await assert.rejects(new VectorStoreClient().syncDocuments('fixture', [{ merchant_id: 'fixture', metadata: { managed_by: 'chatto-live-chunker' }, embedding: [0.1] }]), /not configured/);
  assert.equal(calls, 0);
});

test('AI HTTP tools require configured service authentication while discovery remains public', async (t) => {
  const listener = net.createServer(); await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port; await new Promise((resolve) => listener.close(resolve));
  const token = randomBytes(32).toString('hex');
  const child = spawn(process.execPath, [path.resolve(__dirname, '../dist/index.js')], {
    cwd: __dirname, windowsHide: true, stdio: 'ignore',
    env: { ...process.env, AI_SERVICE_PORT: String(port), AI_SERVICE_TOKEN: token, AI_LLM_PROVIDER: 'mock', GEMINI_API_KEY: '', OPENAI_API_KEY: '', GEMINI_EMBEDDING_API_KEY: '' },
  });
  t.after(() => child.kill());
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (await fetch(base + '/health', { signal: AbortSignal.timeout(300) }).then((response) => response.ok).catch(() => false)) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal((await fetch(base + '/health')).status, 200);
  for (const route of ['/mcp/manifest', '/mcp/resources', '/mcp/tools']) assert.equal((await fetch(base + route)).status, 200);
  const send = (route, body, authorization) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) }, body: JSON.stringify(body) });
  for (const route of ['/mock-reply', '/mcp/resources/read', '/mcp/tools/chatto.create_embedding/call', '/mcp/chat', '/ai/chat']) {
    assert.equal((await send(route, {})).status, 401);
    assert.equal((await send(route, {}, 'Bearer wrong')).status, 401);
  }
  for (const method of ['initialize', 'mcp/manifest', 'resources/list', 'tools/list']) assert.equal((await send('/mcp', { method })).status, 200);
  for (const method of ['resources/read', 'tools/call']) assert.equal((await send('/mcp', { method })).status, 401);
  const classified = await send('/mcp/tools/chatto.classify_intent/call', { input: { message: 'สวัสดี' } }, `Bearer ${token}`);
  assert.equal(classified.status, 200);
  assert.equal((await classified.json()).output.intent, 'small_talk');
  const rpc = await send('/mcp', { id: 1, method: 'resources/read', params: { uri: 'chatto://ai/guardrails/default' } }, `Bearer ${token}`);
  assert.equal(rpc.status, 200);
});
