// Production Next + real Nest authentication/message handlers, with in-memory Prisma fixtures.
// Requires a .next-a1 build with API_INTERNAL_BASE_URL=http://127.0.0.1:4015.
// Never connects to PostgreSQL, LINE, Google or an AI provider.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..'), web = path.join(root, 'apps/web');
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
const { createFixture, createFixtureApp } = require(path.join(root, 'apps/api/tests/helpers/latest-messages-fixture.cjs'));
const { readCookie } = apiRequire('./dist/auth/auth-http');
const { buildOnboardingProgress } = apiRequire('./dist/modules/onboarding/onboarding-status');
const fixture = createFixture(), base = 'http://localhost:3003';
process.env.WEB_URL = base;
let app, next, chrome, socket, profile, evaluate, send;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function ready(check, label) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) { if (await check().catch(() => false)) return; await pause(50); }
  throw new Error(`Timed out: ${label}`);
}

(async () => {
  app = await createFixtureApp(fixture);
  // Read-only fixture resources for unchanged onboarding pages.
  app.use(async (request, response, next) => {
    const url = new URL(request.url, base);
    if (url.pathname !== '/onboarding/status' && !url.pathname.endsWith('/information') && !url.pathname.endsWith('/line-channel')) return next();
    try {
      const { user } = await fixture.auth.profile(readCookie(request, 'chatto_session'));
      const memberships = await fixture.merchantService.findForUser(user.id);
      const merchantId = url.pathname.endsWith('/information') || url.pathname.endsWith('/line-channel') ? url.pathname.split('/')[2] : url.searchParams.get('merchantId');
      const merchant = memberships.find((item) => item.merchant.id === merchantId)?.merchant;
      if (!merchant) return response.status(404).json({ message: 'Merchant not found' });
      if (url.pathname.endsWith('/line-channel')) {
        if (request.method !== 'GET') return response.status(403).json({ message: 'Read-only fixture' });
        return response.json({ current: null, history: [] });
      }
      if (url.pathname.endsWith('/information')) return response.json({ merchant: { ...merchant, informationRevision: 1 }, faqs: [{ id: '00000000-0000-4000-8000-000000000099', question: 'Fixture FAQ', answer: 'Fixture answer' }], canEdit: true });
      response.json({ user, memberships, merchant, role: 'Owner', ...buildOnboardingProgress({ store: true, line: false, context: false, activation: false }), capabilities: { lineSetup: false, contextSetup: false, activation: false } });
    } catch (error) { response.status(error.getStatus?.() ?? 500).json({ message: 'Unavailable' }); }
  });
  await app.listen(4015, '127.0.0.1');
  next = spawn(process.execPath, [path.join(web, 'node_modules/next/dist/bin/next'), 'start', '-p', '3003'], {
    cwd: web, env: { ...process.env, NEXT_BUILD_DIR: process.env.CHATTO_A1_BUILD_DIR || '.next-a1', API_INTERNAL_BASE_URL: 'http://127.0.0.1:4015' }, windowsHide: true, stdio: 'ignore',
  });
  next.on('error', () => { process.exitCode = 1; });
  await ready(async () => (await fetch(base + '/login', { signal: AbortSignal.timeout(2000) })).ok, 'isolated Next production server');
  console.log('Started isolated Next/Nest production test servers.');
  profile = await fs.mkdtemp(path.join(os.tmpdir(), 'chatto-a1-browser-'));
  chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9225', `--user-data-dir=${profile}`, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  chrome.on('error', () => { process.exitCode = 1; });
  await ready(async () => (await fetch('http://127.0.0.1:9225/json/version', { signal: AbortSignal.timeout(2000) })).ok, 'isolated Chrome');
  const target = await (await fetch('http://127.0.0.1:9225/json/new?about:blank', { method: 'PUT' })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  let id = 0;
  const pending = new Map(), consoleErrors = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data), callback = pending.get(message.id);
    if (callback) { clearTimeout(callback.timeout); pending.delete(message.id); message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') consoleErrors.push(message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') consoleErrors.push('console.error');
  });
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timeout = setTimeout(() => { pending.delete(requestId); reject(new Error(`Browser command timed out: ${method}`)); }, 10000);
    pending.set(requestId, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1024, deviceScaleFactor: 1, mobile: false });
  const signIn = (name) => send('Network.setCookie', { name: 'chatto_session', value: fixture.tokens[name], url: base, httpOnly: true, sameSite: 'Lax' });
  const goto = async (pathname, text) => { await send('Page.navigate', { url: base + pathname }); await ready(() => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`), pathname); };
  const messageRequests = () => fixture.requests.filter((url) => url.startsWith('/conversations/messages/latest'));
  const selectMerchant = async (merchantId) => {
    await ready(() => evaluate("Object.keys(document.querySelector('#messages-merchant') ?? {}).some(key=>key.startsWith('__reactProps$'))"), 'merchant selector hydration');
    await evaluate(`(() => { const e=document.querySelector('#messages-merchant'); e.value=${JSON.stringify(merchantId)}; e.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
  };

  await signIn('multi');
  await goto('/dashboard', 'เลือกร้านค้าก่อนดูข้อความล่าสุด');
  assert.equal(messageRequests().length, 0);
  assert.equal(await evaluate("document.querySelector('#messages-merchant').value"), '');
  console.log('PASS multiple merchants require selection; no unscoped request.');

  await selectMerchant(fixture.merchants.a.id);
  await ready(() => evaluate("document.body.innerText.includes('Merchant A message 25')"), 'merchant A feed');
  assert.ok(messageRequests().at(-1).includes(`merchantId=${fixture.merchants.a.id}`));
  await evaluate("globalThis.crossTenantLeak=false; globalThis.leakObserver=new MutationObserver(()=>{if(document.querySelector('#messages-merchant')?.value!==" + JSON.stringify(fixture.merchants.a.id) + " && document.body.innerText.includes('Merchant A message 25'))globalThis.crossTenantLeak=true;});leakObserver.observe(document.body,{subtree:true,childList:true,characterData:true});true");
  fixture.delay = 1000;
  const beforeRefresh = messageRequests().length;
  await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Refresh').click();true");
  await ready(async () => messageRequests().length > beforeRefresh, 'A request in flight before switching');
  await selectMerchant(fixture.merchants.b.id);
  await ready(() => evaluate("document.querySelector('#messages-merchant').value === " + JSON.stringify(fixture.merchants.b.id) + " && !document.body.innerText.includes('Merchant A message 25')"), 'old A data hidden immediately');
  await ready(() => evaluate("document.body.innerText.includes('Merchant B message 41')"), 'merchant B feed');
  assert.equal(await evaluate('globalThis.crossTenantLeak'), false);
  assert.ok(messageRequests().at(-1).includes(`merchantId=${fixture.merchants.b.id}`));
  await selectMerchant(fixture.merchants.a.id);
  await ready(() => evaluate("document.querySelector('#messages-merchant').value === " + JSON.stringify(fixture.merchants.a.id) + " && !document.body.innerText.includes('Merchant B message 41')"), 'B cache hidden when returning to A');
  await ready(() => evaluate("document.body.innerText.includes('Merchant A message 25')"), 'A reloaded');
  fixture.delay = 0;
  await selectMerchant(fixture.merchants.empty.id);
  await ready(() => evaluate("document.body.innerText.includes('ยังไม่มีข้อความเข้ามา')"), 'empty merchant');
  assert.equal(await evaluate("document.body.innerText.includes('Merchant A message 25') || document.body.innerText.includes('Merchant B message 41')"), false);
  console.log('PASS A/B cache separation, in-flight switching and empty merchant.');

  const beforeForeign = messageRequests().length;
  await signIn('a');
  await goto(`/dashboard?merchantId=${fixture.merchants.b.id}`, 'ไม่พบร้านค้าหรือคุณไม่มีสิทธิ์ดูข้อความของร้านนี้');
  assert.equal(messageRequests().length, beforeForeign);
  await goto('/dashboard?merchantId=invalid', 'ไม่พบร้านค้าหรือคุณไม่มีสิทธิ์ดูข้อความของร้านนี้');
  assert.equal(messageRequests().length, beforeForeign);
  await goto(`/dashboard?merchantId=${fixture.merchants.a.id}`, 'Merchant A message 25');
  await signIn('b');
  await goto('/dashboard', 'Merchant B message 41');
  assert.equal(await evaluate("document.body.innerText.includes('Merchant A message 25')"), false);
  console.log('PASS foreign/malformed selections do not query; user change does not retain previous user data.');

  fixture.sessions.delete(apiRequire('./dist/auth/auth-session.service').hashToken(fixture.tokens.b));
  await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Refresh').click();true");
  await ready(() => evaluate("document.body.innerText.includes('เซสชันหมดอายุ')"), 'expired session error');
  assert.equal(await evaluate("document.body.innerText.includes('Merchant B message 41')"), false);
  console.log('PASS expired session clears customer messages and offers login.');

  await signIn('multi');
  await goto(`/dashboard?merchantId=${fixture.merchants.a.id}`, 'Merchant A message 25');
  const output = path.join(root, 'build/a1-validation');
  await fs.mkdir(output, { recursive: true });
  const layoutFailures = [];
  for (const width of [1440, 768, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1024, deviceScaleFactor: 1, mobile: false });
    await pause(100);
    await evaluate("document.querySelector('#messages-merchant').scrollIntoView({block:'center'});true");
    const layout = await evaluate("(() => {const feed=document.querySelector('#messages-merchant').parentElement.parentElement.parentElement; const bounds=feed.getBoundingClientRect(); return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,feedWidth:feed.clientWidth,feedScrollWidth:feed.scrollWidth,feedRight:bounds.right};})()");
    assert.ok(layout.feedRight <= width && layout.feedScrollWidth <= layout.feedWidth, `A1 feed overflow at ${width}: ${JSON.stringify(layout)}`);
    if (layout.documentWidth > width) {
      const withoutFeed = await evaluate("(() => {const feed=document.querySelector('#messages-merchant').parentElement.parentElement.parentElement;feed.style.display='none';const width=document.documentElement.scrollWidth;feed.style.display='';return width;})()");
      assert.equal(withoutFeed, layout.documentWidth, 'Dashboard overflow persists with A1 feed removed');
      layoutFailures.push(`dashboard ${width}px: ${layout.documentWidth}px document width, unchanged when A1 feed is hidden`);
    }
    if (width === 1440 || width === 390) {
      await evaluate("document.querySelector('#messages-merchant').scrollIntoView({block:'center'});true");
      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      await fs.writeFile(path.join(output, `latest-messages-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    }
  }
  assert.deepEqual(consoleErrors, []);
  console.log('PASS browser console and A1 feed responsive widths 1440/768/390/320.');
  if (layoutFailures.length) console.log('FAIL existing dashboard layout outside A1:', layoutFailures.join('; '));

  fixture.delay = 1000;
  fixture.logoutDelay = 1200;
  const beforeLogout = messageRequests().length;
  await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Refresh').click();true");
  await ready(async () => messageRequests().length > beforeLogout, 'message request in flight before logout');
  await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='ออกจากระบบ').click();true");
  await ready(() => evaluate("location.pathname==='/dashboard' && !document.body.innerText.includes('Merchant A message 25')"), 'messages cleared before delayed logout completes');
  await ready(() => evaluate("location.pathname==='/login'"), 'logout redirect');
  fixture.delay = 0;
  fixture.logoutDelay = 0;
  assert.equal(await evaluate("document.body.innerText.includes('Merchant A message 25')"), false);
  await send('Page.navigate', { url: base + `/dashboard?merchantId=${fixture.merchants.a.id}` });
  await ready(() => evaluate("location.pathname==='/login'"), 'anonymous dashboard guard');
  assert.equal(await evaluate("document.querySelector('form[action=\"/api/auth/google\"]').method"), 'get');
  assert.equal(await evaluate("document.querySelector('form[action=\"/api/auth/line\"]').method"), 'get');
  console.log('PASS logout, anonymous dashboard guard and approved Google/LINE Login actions.');

  await signIn('a');
  await goto(`/onboarding/store?merchantId=${fixture.merchants.a.id}`, 'ข้อมูลพื้นฐานร้าน');
  assert.equal(await evaluate("document.querySelector('#shopName').value"), 'Merchant A');
  assert.equal(await evaluate("document.querySelector('[id^=question-]').value"), 'Fixture FAQ');
  const writesBeforeLine = fixture.mutations.length;
  const messagesBeforeLine = JSON.stringify(fixture.messages);
  await goto(`/onboarding/line?merchantId=${fixture.merchants.a.id}`, 'เชื่อมต่อ LINE OA');
  await ready(() => evaluate("Object.keys(document.querySelector('#channelSecret') ?? {}).some(key=>key.startsWith('__reactProps$'))"), 'Step 4 hydration');
  await ready(() => evaluate("!document.querySelector('#channelId').disabled"), 'Step 4 authorized metadata');
  assert.equal(await evaluate("document.querySelector('#channelSecret').type"), 'password');
  assert.equal(await evaluate("document.querySelector('button[aria-label=\"คัดลอก Webhook URL\"]').disabled"), true);
  await evaluate("document.querySelector('form').requestSubmit();true");
  await ready(() => evaluate("document.querySelectorAll('[aria-invalid=true]').length===3"), 'Step 4 validation');
  for (const [id, value] of [['channelId', '1234567890'], ['channelSecret', 'a'.repeat(32)], ['channelAccessToken', 'fixture-token-only']]) {
    await evaluate(`(() => {const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;const input=document.getElementById(${JSON.stringify(id)});set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
  }
  await evaluate("document.querySelector('button[aria-label=\"แสดง Channel Secret\"]').click();true");
  assert.equal(await evaluate("document.querySelector('#channelSecret').type"), 'text');
  await evaluate("document.querySelector('button[aria-label=\"ซ่อน Channel Secret\"]').click();true");
  assert.equal(await evaluate("document.querySelector('#channelSecret').type"), 'password');
  await evaluate("document.querySelector('button[aria-label=\"แสดง Channel Access Token\"]').click();true");
  assert.equal(await evaluate("document.querySelector('#channelAccessToken').type"), 'text');
  await evaluate("document.querySelector('form').requestSubmit();true");
  await ready(() => evaluate("document.body.innerText.includes('คุณไม่มีสิทธิ์แก้ไขการเชื่อมต่อ LINE OA')"), 'Read-only fixture rejects Step 4 mutation safely');
  assert.ok(await evaluate("document.body.innerText.includes('ยังไม่ได้เชื่อมต่อ')"));
  assert.deepEqual(fixture.mutations.slice(writesBeforeLine), [{ method: 'PUT', url: `/merchants/${fixture.merchants.a.id}/line-channel` }]);
  assert.equal(JSON.stringify(fixture.messages), messagesBeforeLine, 'Rejected fixture request cannot change message data');
  assert.ok(await evaluate("[...document.querySelectorAll('input')].every(e => e.value === '' && e.disabled)"));
  assert.deepEqual(consoleErrors, []);
  console.log('PASS unchanged Step 3 data/FAQ read and backend-integrated Step 4 masking/validation, safe permission failure and disconnected state.');
  await send('Browser.close');
})().catch(async (error) => {
  console.error(error.message);
  if (evaluate) console.error(await evaluate("({pathname:location.pathname, selection:document.querySelector('#messages-merchant')?.value, alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent)})").catch(() => 'Browser unavailable'));
  if (evaluate) console.error(await evaluate("({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(e=>({tag:e.tagName,className:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right}))})").catch(() => 'Layout unavailable'));
  if (send) {
    const screenshot = await send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
    if (screenshot) {
      const output = path.join(root, 'build/a1-validation');
      await fs.mkdir(output, { recursive: true });
      await fs.writeFile(path.join(output, 'failure.png'), Buffer.from(screenshot.data, 'base64'));
    }
  }
  console.error('Message requests:', fixture.requests.filter((url) => url.startsWith('/conversations/messages/latest')));
  process.exitCode = 1;
}).finally(async () => {
  socket?.close(); chrome?.kill(); next?.kill();
  if (app) await app.close();
  // Leave only ignored screenshots. The generated disposable browser profile is in OS temp.
});
