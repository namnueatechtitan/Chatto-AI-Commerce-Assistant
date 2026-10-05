const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../lib/api.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleExports = {};
new Function('exports', 'require', compiled)(moduleExports, require);
const { getLatestMessages, ApiError } = moduleExports;
const merchantId = '00000000-0000-4000-8000-000000000001';

test('latest-message client requires selection, carries merchant ID and cookie credentials, and supports cancellation', async (t) => {
  const original = global.fetch, calls = [];
  global.fetch = async (url, options) => { calls.push({ url, options }); return new Response('[]'); };
  t.after(() => { global.fetch = original; });
  for (const invalid of [undefined, null, '', 'invalid']) await assert.rejects(getLatestMessages(invalid), (error) => error instanceof ApiError && error.status === 400);
  assert.equal(calls.length, 0);
  const controller = new AbortController();
  assert.deepEqual(await getLatestMessages(merchantId, controller.signal), []);
  assert.equal(calls[0].url, `/api/conversations/messages/latest?merchantId=${merchantId}`);
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.signal, controller.signal);
});

test('latest-message client exposes safe status-specific errors without echoing server metadata', async (t) => {
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  for (const status of [400, 401, 404, 500]) {
    global.fetch = async () => new Response('{"internal":"not for display"}', { status });
    await assert.rejects(getLatestMessages(merchantId), (error) => error instanceof ApiError && error.status === status && !error.message.includes('internal'));
  }
});
