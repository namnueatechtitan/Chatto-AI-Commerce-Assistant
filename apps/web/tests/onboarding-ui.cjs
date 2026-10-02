// Opt-in browser check against a production Next build and an isolated API fixture.
// No fixture data is imported by production code or written to PostgreSQL.
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");
const { spawn } = require("node:child_process");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../../..");
const web = path.join(root, "apps/web");
const fixtureApiPort = Number(process.env.CHATTO_UI_API_PORT || 4000);
assert.ok(Number.isInteger(fixtureApiPort) && fixtureApiPort > 0 && fixtureApiPort <= 65535, "Valid fixture API port required");
const fixtureApiUrl = `http://127.0.0.1:${fixtureApiPort}`;
const apiRequire = createRequire(path.join(root, "apps/api/package.json"));
const { buildOnboardingProgress } = require(path.join(root, "apps/api/dist/modules/onboarding/onboarding-status.js"));
const user = { id: "55f55778-6df2-4530-a5a3-5c691b4de45e", name: "Nattawat Siriwithayanukul", email: null, globalRole: "merchant_user", status: "ACTIVE" };
const merchant = { id: "0aa80d25-a3c7-4d84-8f58-f12741b47061", shopName: "UI Validation Store", slug: "test", status: "TRIAL", businessCategory: null, operatingHours: null, informationRevision: 0 };
let faqs = [], writes = 0, importsConfirmed = 0;
let additionalMerchant = null;
const jobs = new Map();
let readiness = { store: false, line: false, context: false, activation: false };
let unavailable = false;
let statusReads = 0;
const api = http.createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  const url = new URL(request.url, fixtureApiUrl);
  if (url.pathname === "/auth/logout") {
    response.setHeader("Set-Cookie", "chatto_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax");
    response.end(JSON.stringify({ message: "Signed out" })); return;
  }
  if (!request.headers.cookie?.includes("chatto_session=")) { response.writeHead(401); response.end("{}"); return; }
  if (url.pathname === "/auth/profile") { response.end(JSON.stringify({ user })); return; }
  if (url.pathname === "/onboarding/store" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const data = JSON.parse(body);
    if (!data.shopName?.trim() || !data.businessCategory || !data.operatingHours) { response.writeHead(400); response.end("{}"); return; }
    Object.assign(merchant,data,{informationRevision:1}); faqs=(data.faqs||[]).map(faq=>({...faq,id:crypto.randomUUID()})); writes++;
    readiness.store = true;
    response.end(JSON.stringify({ merchant,faqs,canEdit:true })); return;
  }
  if (url.pathname === `/merchants/${merchant.id}/information`) {
    if(request.method === 'PATCH') {
      let body='';for await(const chunk of request)body+=chunk; const data=JSON.parse(body);
      if(data.revision!==merchant.informationRevision){response.writeHead(409);response.end('{}');return;}
      Object.assign(merchant,data,{informationRevision:merchant.informationRevision+1});faqs=data.faqs.map(faq=>({...faq,id:faq.id||crypto.randomUUID()}));writes++;
    }
    response.end(JSON.stringify({merchant,faqs,canEdit:true}));return;
  }
  const catalogPath=`/merchants/${merchant.id}/catalog-imports`;
  if(url.pathname === catalogPath && request.method === 'GET'){response.end(JSON.stringify({imports:[...jobs.values()]}));return;}
  if(url.pathname === catalogPath && request.method === 'POST'){
    const multer=require(path.join(root,'apps/api/node_modules/multer'));
    await new Promise((resolve,reject)=>multer({storage:multer.memoryStorage()}).single('file')(request,response,error=>error?reject(error):resolve()));
    const {previewTable}=require(path.join(root,'apps/api/dist/modules/catalog-imports/catalog-parser'));
    const {parse}=apiRequire('csv-parse/sync');
    const preview=previewTable(parse(request.file.buffer,{bom:true,skip_empty_lines:true}));
    const job={id:crypto.randomUUID(),merchantId:merchant.id,originalName:request.file.originalname,status:'PARSING',format:'csv',preview:null,error:null,createdCount:0,updatedCount:0,rejectedCount:0};
    jobs.set(job.id,job);setTimeout(()=>Object.assign(job,{status:'PREVIEW',preview}),400);
    response.writeHead(202);response.end(JSON.stringify({import:job}));return;
  }
  if(url.pathname.startsWith(catalogPath+'/')) {
    const [id,action]=url.pathname.slice(catalogPath.length+1).split('/');const job=jobs.get(id);
    if(!job){response.writeHead(404);response.end('{}');return;}
    if(action==='confirm'){importsConfirmed++;Object.assign(job,{status:'IMPORTED',createdCount:job.preview.validCount,rejectedCount:job.preview.rows.length-job.preview.validCount});}
    if(action==='cancel')job.status='CANCELLED';response.end(JSON.stringify({import:job}));return;
  }
  if (url.pathname === "/merchants") {
    if(request.method==='POST'){let body='';for await(const chunk of request)body+=chunk;additionalMerchant={id:crypto.randomUUID(),shopName:JSON.parse(body).shopName,slug:'additional',status:'TRIAL'};response.end(JSON.stringify({merchant:additionalMerchant}));return;}
    response.end(JSON.stringify({ memberships: readiness.store ? [{ merchant, role: { name: "Owner" } },...(additionalMerchant?[{merchant:additionalMerchant,role:{name:'Owner'}}]:[])] : [] })); return;
  }
  if(url.pathname===`/merchants/${merchant.id}` || additionalMerchant && url.pathname===`/merchants/${additionalMerchant.id}`){response.end(JSON.stringify({merchant:url.pathname.endsWith(merchant.id)?merchant:additionalMerchant,role:{name:'Owner'},owners:[{user:{id:user.id,name:user.name}}]}));return;}
  if (url.pathname !== "/onboarding/status") { response.writeHead(404); response.end("{}"); return; }
  statusReads++;
  if (unavailable) { response.writeHead(503); response.end("{}"); return; }
  if (url.searchParams.has("merchantId") && url.searchParams.get("merchantId") !== merchant.id) { response.writeHead(404); response.end("{}"); return; }
  const selected=readiness.store && (!additionalMerchant || url.searchParams.get('merchantId')===merchant.id)?merchant:null;
  response.end(JSON.stringify({ user, merchant:selected, role:selected?'Owner':null,
    memberships:readiness.store?[{merchant,role:{name:'Owner'}},...(additionalMerchant?[{merchant:additionalMerchant,role:{name:'Owner'}}]:[])]:[],
    ...buildOnboardingProgress({...readiness,store:Boolean(selected)}), capabilities: { lineSetup: false, contextSetup: false, activation: false } }));
});

let chrome, next, socket;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function ready(check, label, ms = 15000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) { try { if (await check()) return; } catch {} await pause(100); }
  throw new Error(`Timed out: ${label}`);
}

(async () => {
  await new Promise((resolve, reject) => { api.once("error", reject); api.listen(fixtureApiPort, "127.0.0.1", resolve); });
  next = spawn(process.execPath, [path.join(web, "node_modules/next/dist/bin/next"), "start", "-p", "3002"], {
    cwd: web, env: { ...process.env, NEXT_BUILD_DIR: ".next-validation", API_INTERNAL_BASE_URL: fixtureApiUrl }, windowsHide: true, stdio: "ignore",
  });
  next.on("error", (error) => { console.error(error); process.exitCode = 1; });
  await ready(async () => (await fetch("http://localhost:3002/login", { signal: AbortSignal.timeout(3000) })).ok, "Next production server");
  chrome = spawn(process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=9223", `--user-data-dir=${path.join(root, "build/onboarding-browser-profile")}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  chrome.on("error", (error) => { console.error(error); process.exitCode = 1; });
  await ready(async () => (await fetch("http://127.0.0.1:9223/json/version", { signal: AbortSignal.timeout(3000) })).ok, "isolated headless Chrome");
  const target = await (await fetch("http://127.0.0.1:9223/json/new?about:blank", { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve); socket.addEventListener("error", reject); });
  let id = 0;
  let checkingLine = false, lineMutations = 0;
  const lineConsoleErrors = [];
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (checkingLine && message.method === "Network.requestWillBeSent" && !["GET", "HEAD"].includes(message.params.request.method)) lineMutations++;
    if (checkingLine && (message.method === "Runtime.exceptionThrown" || message.method === "Runtime.consoleAPICalled" && message.params.type === "error" || message.method === "Log.entryAdded" && message.params.entry.level === "error")) lineConsoleErrors.push(message.method);
    const callback = pending.get(message.id);
    if (callback) { pending.delete(message.id); message.error ? callback.reject(message.error) : callback.resolve(message.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const requestId = ++id; pending.set(requestId, { resolve, reject }); socket.send(JSON.stringify({ id: requestId, method, params })); });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("Log.enable");
  await send("Network.setCacheDisabled", {cacheDisabled:true});
  const signIn = () => send("Network.setCookie", { name: "chatto_session", value: "s".repeat(43), url: "http://localhost:3002", httpOnly: true, sameSite: "Lax" });
  const goto = async (pathname, text) => {
    await send("Page.navigate", { url: `http://localhost:3002${pathname}` });
    await ready(() => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`), pathname);
    await evaluate("document.fonts.ready.then(() => true)");
  };
  await signIn();
  await goto("/onboarding", user.name);
  await fs.mkdir(path.join(root, "docs/validation"), { recursive: true });
  for (const [width, height, name] of [[1440, 1024, "onboarding-desktop.png"], [1920, 1080], [1280, 900], [768, 1024], [390, 900, "onboarding-mobile.png"], [320, 900]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await pause(150);
    const metrics = await evaluate(`({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
      name: document.querySelector('h1')?.innerText, progress: document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow'),
      steps: document.querySelectorAll('ol li').length, current: document.querySelector('[aria-current=step] h3')?.textContent,
      lockedLinks: document.querySelectorAll('ol li:nth-child(n+4) a').length,
      brandWidth: document.querySelector('main > section')?.getBoundingClientRect().width })`);
    if(metrics.scrollWidth>width){console.log(metrics);console.log(await evaluate("Promise.all([...document.querySelectorAll('link[rel=stylesheet]')].map(async e=>({href:e.href,status:(await fetch(e.href)).status})))"));}
    assert.ok(metrics.scrollWidth <= width, `Horizontal overflow at ${width}`);
    assert.equal(metrics.steps, 6); assert.equal(metrics.progress, "33");
    assert.ok(metrics.name.includes(user.name)); assert.equal(metrics.current, "เพิ่มข้อมูลร้านค้า"); assert.equal(metrics.lockedLinks, 0);
    if (name) {
      const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: metrics.height, scale: 1 } });
      await fs.writeFile(path.join(root, "docs/validation", name), Buffer.from(result.data, "base64"));
    }
    console.log(`PASS layout ${width}px (document width ${metrics.scrollWidth}px)`);
  }
  user.name = "AnExceptionallyLongUnbrokenAuthenticatedDisplayNameThatMustWrapNaturallyOnSmallScreens";
  await goto("/onboarding", user.name);
  assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"));
  user.name = "";
  await goto("/onboarding", "ผู้ใช้งาน Chatto");
  assert.equal(await evaluate("document.querySelectorAll('header img').length"), 0);
  user.name = "Nattawat Siriwithayanukul";
  await goto("/onboarding/store", "ข้อมูลพื้นฐานร้าน");
  for(const [width,height,name] of [[1440,1024,'store-desktop.png'],[1920,1080],[1280,900],[768,1024],[390,900,'store-mobile.png'],[320,900]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(100);
    const metrics=await evaluate(`({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,inputs:[...document.querySelectorAll('input:not([type=file]),select,textarea')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))})`);
    assert.ok(metrics.width<=width,`Store form overflow at ${width}`);assert.ok(metrics.inputs.every(e=>e.width>40));
    if(width<768)assert.ok(metrics.inputs.every(e=>e.height>=44));
    if(name){const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:metrics.height,scale:1}});await fs.writeFile(path.join(root,'docs/validation',name),Buffer.from(result.data,'base64'));}
    console.log(`PASS store form layout ${width}px (height ${metrics.height}px)`);
  }
  await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent==='ข้ามไปก่อน').click();true");
  await ready(()=>evaluate("document.querySelectorAll('[aria-invalid=true]').length===3"),'required fields on skip');assert.equal(writes,0);
  const fill=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));return true;})()`);
  await fill('#shopName','UI Validation Store');await fill('#businessCategory','flowers');await fill('#operatingHours','Mon–Fri 09:30–18:00');
  await fill('[id^=question-]','Delivery?');
  await evaluate("document.querySelector('form').requestSubmit();true");await ready(()=>evaluate("document.body.innerText.includes('กรอกคำถามและคำตอบให้ครบ')"),'FAQ pair validation');assert.equal(writes,0);
  await fill('[id^=answer-]','Nationwide delivery');
  await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent==='+ เพิ่มคำถาม-คำตอบ').click();true");
  assert.equal(await evaluate("document.querySelectorAll('[id^=question-]').length"),2);
  await evaluate("document.querySelector('[aria-label=\"ลบคำถามที่ 2\"]').click();true");assert.equal(await evaluate("document.querySelectorAll('[id^=question-]').length"),1);
  const fileNode=await send('DOM.getDocument');const fileInput=await send('DOM.querySelector',{nodeId:fileNode.root.nodeId,selector:'input[type=file]'});
  await send('DOM.setFileInputFiles',{nodeId:fileInput.nodeId,files:[path.join(web,'public/templates/catalog.csv')]});
  await ready(()=>evaluate("document.body.innerText.includes('ยืนยันนำเข้า 1 สินค้า')"),'upload parses preview');assert.equal(importsConfirmed,0,'preview does not auto-import');assert.equal(readiness.store,true);assert.equal(faqs.length,1);
  await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent==='ยืนยันนำเข้า 1 สินค้า').click();true");
  await ready(()=>evaluate("document.body.innerText.includes('นำเข้าเสร็จแล้ว: เพิ่ม 1')"),'explicit import confirmation');assert.equal(importsConfirmed,1);
  await evaluate("(()=>{const transfer=new DataTransfer();transfer.items.add(new File([['name','Cancelled flower'].join(String.fromCharCode(10))],'cancel.csv',{type:'text/csv'}));document.querySelector('input[type=file]').parentElement.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}));return true;})()");
  await ready(()=>evaluate("document.body.innerText.includes('cancel.csv') && [...document.querySelectorAll('button')].some(e=>e.textContent==='ยกเลิกการนำเข้า')"),'drag/drop preview');
  await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent==='ยกเลิกการนำเข้า').click();true");
  await ready(()=>evaluate("document.body.innerText.includes('ยกเลิกแล้ว ไม่ได้นำเข้าสินค้า')"),'import cancellation');assert.equal(importsConfirmed,1);
  await evaluate("document.querySelector('form').requestSubmit();true");
  await ready(() => evaluate("location.pathname === '/onboarding' && document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') === '50'"), "store creation refetch");
  const priorReads = statusReads;
  await send("Page.reload");
  await ready(() => evaluate("document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') === '50'"), "refresh persists status");
  assert.ok(statusReads > priorReads);
  await goto(`/onboarding/store?merchantId=${merchant.id}`,'ข้อมูลพื้นฐานร้าน');assert.equal(await evaluate("document.querySelector('#shopName').value"),merchant.shopName);assert.equal(await evaluate("document.querySelectorAll('[id^=question-]').length"),1);
  await fill('#description','Changed business description');
  await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent==='+ เพิ่มคำถาม-คำตอบ').click();true");
  await fill("[id^=question-]:not([id='question-"+faqs[0].id+"'])",'Incomplete optional FAQ');
  await evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent==='ข้ามไปก่อน').click();true");
  await ready(()=>evaluate("location.pathname==='/onboarding'"),'existing store update');assert.equal(merchant.description,'Changed business description');assert.equal(faqs.length,1);
  await goto("/dashboard", "Dashboard");
  assert.equal(await evaluate("location.pathname"), "/dashboard", "existing dashboard remains available to store members");
  // Step 3 still advances via the authoritative checklist to the existing Step 4 route.
  await goto(`/onboarding?merchantId=${merchant.id}`, "50%");
  await ready(() => evaluate("location.pathname === '/onboarding' && document.querySelector('[aria-current=step] a')?.getAttribute('href')?.startsWith('/onboarding/line')"), "Step 4 action ready");
  await evaluate("document.querySelector('[aria-current=step] a').click();true");
  try {
    await ready(() => evaluate("location.pathname === '/onboarding/line' && Boolean(document.querySelector('#channelId'))"), "Step 3 to Step 4 navigation");
  } catch (error) {
    console.log(await evaluate("({path:location.pathname,heading:document.querySelector('h1')?.textContent,text:document.body.innerText.slice(-1000)})"));
    throw error;
  }
  checkingLine = true;
  assert.equal(await evaluate("document.querySelector('#line-setup-heading').textContent"), "เชื่อมต่อ LINE OA");
  assert.ok(await evaluate("document.body.innerText.includes('ขั้นตอนที่ 4 จาก 6')"));
  for (const [width, height] of [[1440, 1024], [1920, 1080], [768, 1024], [390, 900], [320, 900]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await evaluate("document.fonts.ready.then(() => true)");
    await pause(150);
    await ready(() => evaluate("[...document.images].filter(e => e.getBoundingClientRect().width > 0).every(e => e.complete && e.naturalWidth > 0)"), `Visible LINE assets at ${width}px`);
    const metrics = await evaluate(`({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
      inputs: [...document.querySelectorAll('input')].map(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height })),
      elementsOutside: [...document.querySelectorAll('input,button,a,h1,h2,label')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 1 && (r.left < 0 || r.right > innerWidth); }).length,
      imagesLoaded: [...document.images].filter(e => e.getBoundingClientRect().width > 0).every(e => e.complete && e.naturalWidth > 0) })`);
    assert.ok(metrics.width <= width, `LINE page overflow at ${width}`);
    assert.equal(metrics.elementsOutside, 0, `LINE content outside viewport at ${width}`);
    assert.ok(metrics.imagesLoaded, "Existing branding assets load");
    assert.equal(metrics.inputs.length, 3);
    assert.ok(metrics.inputs.every(e => e.width > 40));
    if (width < 768) assert.ok(metrics.inputs.every(e => e.height >= 44));
    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: metrics.height, scale: 1 } });
    await fs.writeFile(path.join(root, "docs/validation", `line-${width}.png`), Buffer.from(screenshot.data, "base64"));
    console.log(`PASS LINE layout ${width}px (document width ${metrics.width}px)`);
  }
  const copySelector = 'button[aria-label="คัดลอก Webhook URL"]';
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(copySelector)}).disabled`), true);
  assert.ok(await evaluate("document.body.innerText.includes('ยังไม่ได้กำหนด Webhook URL')"));
  assert.equal(await evaluate("document.querySelector('#channelSecret').type"), "password");
  assert.equal(await evaluate("document.querySelector('#channelAccessToken').type"), "password");
  assert.equal(await evaluate("document.querySelector('a[target=_blank]').href"), "https://developers.line.biz/en/docs/messaging-api/getting-started/");
  await evaluate("document.querySelector('form').requestSubmit();true");
  await ready(() => evaluate("document.querySelectorAll('[aria-invalid=true]').length === 3"), "LINE required validation");
  assert.equal(await evaluate("document.activeElement.id"), "channelId");
  assert.ok(await evaluate("[...document.querySelectorAll('input')].every(e => document.getElementById(e.getAttribute('aria-describedby'))?.textContent)"), "Accessible validation descriptions");
  await fill("#channelId", "bad-id");
  await evaluate("document.querySelector('form').requestSubmit();true");
  await ready(() => evaluate("document.body.innerText.includes('กรอก Channel ID เป็นตัวเลขเท่านั้น')"), "LINE ID format validation");
  // Dummy values are only supplied to the local UI. They never enter fixture API responses.
  await fill("#channelId", "1234567890");
  await fill("#channelSecret", "frontend-demo-secret");
  await fill("#channelAccessToken", "frontend-demo-token");
  for (const [field, label] of [["channelSecret", "Channel Secret"], ["channelAccessToken", "Channel Access Token"]]) {
    await evaluate(`document.querySelector('button[aria-label="แสดง ${label}"]').click();true`);
    assert.equal(await evaluate(`document.querySelector('#${field}').type`), "text");
    assert.equal(await evaluate(`document.querySelector('button[aria-label="ซ่อน ${label}"]').getAttribute('aria-pressed')`), "true");
    await evaluate(`document.querySelector('button[aria-label="ซ่อน ${label}"]').click();true`);
    assert.equal(await evaluate(`document.querySelector('#${field}').type`), "password");
  }
  const writesBeforeLine = writes;
  await evaluate("document.querySelector('form').requestSubmit();true");
  await ready(() => evaluate("document.body.innerText.includes('ระบบเชื่อมต่อ LINE OA จะพร้อมใช้งานเมื่อเชื่อมต่อ Backend')"), "Honest LINE demonstration message");
  assert.equal(await evaluate("document.querySelectorAll('[aria-invalid=true]').length"), 0);
  assert.ok(await evaluate("[...document.querySelectorAll('input')].every(e => e.value === '')"), "Local credentials cleared after demonstration");
  assert.ok(await evaluate("document.body.innerText.includes('ยังไม่ได้เชื่อมต่อ')"));
  assert.equal(writes, writesBeforeLine); assert.equal(lineMutations, 0); assert.equal(readiness.line, false);
  assert.equal(await evaluate("Object.keys(localStorage).length + Object.keys(sessionStorage).length"), 0);
  assert.deepEqual((await send("Network.getCookies")).cookies.map(cookie => cookie.name), ["chatto_session"]);
  await send("Page.reload");
  await ready(() => evaluate("document.querySelector('#channelId') && document.body.innerText.includes('ยังไม่ได้เชื่อมต่อ')"), "Refresh keeps LINE disconnected");
  assert.ok(await evaluate("[...document.querySelectorAll('input')].every(e => e.value === '')"));
  assert.equal(await evaluate("document.querySelector('#channelSecret').type"), "password");
  await evaluate("[...document.querySelectorAll('a')].find(e => e.textContent === 'ข้ามไปก่อน').click();true");
  await ready(() => evaluate("location.pathname === '/onboarding' && document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') === '50'"), "Skip preserves persisted progress");
  assert.equal(await evaluate("new URL(location.href).searchParams.get('merchantId')"), merchant.id);
  await goto(`/onboarding/line?merchantId=${merchant.id}`, "เชื่อมต่อ LINE OA");
  await evaluate("[...document.querySelectorAll('a')].find(e => e.textContent === 'กลับไปยังการตั้งค่า').click();true");
  await ready(() => evaluate("location.pathname === '/onboarding'"), "Back to settings");
  assert.equal(lineMutations, 0); assert.deepEqual(lineConsoleErrors, []);
  checkingLine = false;
  console.log("PASS LINE validation, masking/toggles, guide, disabled copy, local demonstration, no writes/storage, refresh, skip/back navigation and console.");
  await goto(`/onboarding/context?merchantId=${merchant.id}`, "Welcome,");
  assert.equal(await evaluate("location.pathname"), "/onboarding");
  await goto("/onboarding?merchantId=fdfb94e3-354b-47f5-b7d7-c8e00e257af1", "ไม่พบร้านค้า");
  readiness = { store: true, line: true, context: true, activation: false };
  await goto(`/onboarding?merchantId=${merchant.id}`, "83%");
  assert.equal(await evaluate("document.querySelector('[aria-current=step] h3').textContent"), "เปิดใช้งานจริง");
  readiness.activation = true;
  await evaluate("window.dispatchEvent(new Event('focus')); true");
  await ready(() => evaluate("location.pathname === '/dashboard'"), "completed routing after authoritative refresh");
  readiness.activation = false;
  unavailable = true;
  await goto("/onboarding", "ไม่สามารถโหลดข้อมูลการตั้งค่าได้");
  unavailable = false;
  await evaluate("[...document.querySelectorAll('button')].find(el => el.textContent === 'ลองอีกครั้ง').click(); true");
  await ready(() => evaluate("document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') === '83'"), "error retry");
  await evaluate("document.querySelector('details').open = true; [...document.querySelectorAll('button')].find(el => el.textContent === 'ออกจากระบบ').click(); true");
  await ready(() => evaluate("location.pathname === '/login'"), "logout");
  await goto("/onboarding", "เข้าสู่ระบบ/สมัครสมาชิก");
  assert.equal(await evaluate("location.pathname"), "/login");
  assert.equal(await evaluate("document.querySelector('form[action=\"/api/auth/google\"]').method"), "get");
  assert.equal(await evaluate("document.querySelector('form[action=\"/api/auth/line\"]').method"), "get");
  for (const [width, height] of [[1440, 1024], [1920, 1080], [768, 1024], [390, 900], [320, 900]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await pause(100);
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `Login overflow at ${width}`);
  }
  console.log("PASS approved Login layout and Google/LINE OAuth form destinations unchanged.");
  await signIn();
  await goto(`/onboarding?merchantId=${merchant.id}`, "83%");
  await goto(`/merchants/${merchant.id}`,'บทบาทของคุณ: Owner');assert.equal(await evaluate("document.querySelector('h1').textContent"),merchant.shopName);
  await goto('/merchants/new','สร้างร้านค้า');await fill('#shopName','Additional validation store');await evaluate("document.querySelector('form').requestSubmit();true");
  await ready(()=>evaluate("document.querySelector('h1')?.textContent==='Additional validation store'"),'legacy additional store creation');
  await goto('/onboarding/store','เลือกร้านที่ต้องการแก้ไข');assert.equal(await evaluate("document.querySelectorAll('form').length"),0,'multiple stores do not silently choose a form');
  await goto(`/onboarding/store?merchantId=${merchant.id}`,'ข้อมูลพื้นฐานร้าน');assert.equal(await evaluate("document.querySelector('#shopName').value"),merchant.shopName);
  console.log("PASS names, avatar fallback, step locks, store creation, refetch, refresh, completion routing, API retry, logout/relogin and anonymous redirect (isolated API fixture).");
  await send("Browser.close");
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  socket?.close(); chrome?.kill(); next?.kill(); api.closeAllConnections(); await new Promise((resolve) => api.close(resolve));
});
