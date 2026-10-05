'use strict';
// Production frontend + read-only in-memory API. Never accesses PostgreSQL or providers.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),web=path.join(root,'apps/web');
const out=path.join(root,'build/responsive-refactor'),apiPort=4027,webPort=3007,chromePort=9337;
const origin='http://localhost:'+webPort;
const viewports=[[1920,1080],[1600,900],[1536,864],[1512,982],[1440,900],[1366,768],[1280,800],[1024,768],[768,1024],[390,844]].filter(([width])=>!process.env.CHATTO_RESPONSIVE_WIDTHS||process.env.CHATTO_RESPONSIVE_WIDTHS.split(',').includes(String(width)));
const merchant={id:'00000000-0000-4000-8000-000000000071',shopName:'Responsive Fixture Store',slug:'responsive',status:'TRIAL',informationRevision:1,businessCategory:'other',operatingHours:'09:00–18:00',description:'Read-only browser fixture',phone:null,email:null,address:null};
const user={id:'00000000-0000-4000-8000-000000000072',name:'Responsive Test User',email:'fixture@chatto.invalid',status:'ACTIVE',globalRole:'merchant_user'};
const memberships=[{merchant,role:{name:'Owner'}},{merchant:{...merchant,id:'00000000-0000-4000-8000-000000000073',shopName:'Second Fixture Store'},role:{name:'Owner'}}];
let channel={id:'00000000-0000-4000-8000-000000000074',externalChannelId:'7000000001',status:'WEBHOOK_PENDING',isConnected:false,hasCredentials:true,revision:1,credentialsVerifiedAt:'2026-10-05T00:00:00.000Z',webhookVerifiedAt:null,issue:null};
const faqs=[{id:'00000000-0000-4000-8000-000000000075',question:'Opening hours?',answer:'09:00–18:00'}];
let mutationRequests=0,fixtureFresh=false,readiness={store:true,line:true,context:true,activation:false};
function progress(){let prior=true,assigned=false;const ids=['account','session','store','line','context','activation'],values=[true,true,readiness.store,readiness.line,readiness.context,readiness.activation];const steps=ids.map((id,index)=>{const done=prior&&values[index];prior=done;const state=done?'completed':assigned?'pending':'current';if(!done)assigned=true;return{id,state};});const completedSteps=steps.filter(s=>s.state==='completed').length;return{steps,completedSteps,progress:Math.round(completedSteps/6*100),complete:completedSteps===6};}
const api=http.createServer((request,response)=>{
 response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');
 const url=new URL(request.url,'http://127.0.0.1:'+apiPort);
 if(request.method!=='GET'){mutationRequests++;response.writeHead(403);response.end('{}');return;}
 const json=value=>response.end(JSON.stringify(value));
 if(url.pathname==='/auth/profile')return json({user});
 if(url.pathname==='/merchants')return json({memberships:fixtureFresh?[]:memberships});
 if(url.pathname==='/onboarding/status')return json({user,memberships:fixtureFresh?[]:memberships,merchant:fixtureFresh?null:merchant,role:fixtureFresh?null:'Owner',...progress(),capabilities:{lineSetup:true,contextSetup:false,activation:false}});
 if(url.pathname===`/merchants/${merchant.id}`)return json({merchant,role:{name:'Owner'},owners:[{user}]});
 if(url.pathname.endsWith('/information'))return json({merchant,faqs,canEdit:true});
 if(url.pathname.endsWith('/line-channel'))return json({current:channel,history:[]});
 if(url.pathname.endsWith('/catalog-imports'))return json({imports:[]});
 if(url.pathname==='/conversations/messages/latest')return json([]);
 response.writeHead(404);response.end('{}');
});
let next,chrome,socket,send,evaluate;const errors=[],results=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function ready(check,label,timeout=20000){const until=Date.now()+timeout;while(Date.now()<until){try{if(await check())return;}catch{}await pause(100);}throw Error('Timed out: '+label);}
async function navigate(route){
 await send('Page.navigate',{url:origin+route});await ready(()=>evaluate("document.readyState==='complete' && !!document.querySelector('main')"),route);
 const pathname=route.split('?')[0];
 if(pathname==='/onboarding')await ready(()=>evaluate("!!document.querySelector('[role=progressbar]') && document.querySelectorAll('ol li').length===6"),'onboarding data loaded');
 if(pathname==='/onboarding/store'||pathname==='/onboarding/store-information')await ready(()=>evaluate("document.querySelector('#shopName')?.value==='Responsive Fixture Store'"),'store form loaded');
 if(pathname==='/onboarding/line')await ready(()=>evaluate("document.querySelector('#channelId')?.value==='7000000001'"),'LINE metadata loaded');
 if(pathname==='/onboarding/context'||pathname==='/onboarding/activation')await ready(()=>evaluate("!!document.querySelector('#setup-heading')"),'setup page loaded');
 if(pathname==='/merchants')await ready(()=>evaluate("document.querySelectorAll('main li').length===2"),'merchant list loaded');
 if(pathname==='/merchants/new')await ready(()=>evaluate("!!document.querySelector('#shopName')"),'merchant form loaded');
 if(pathname==='/merchants/'+merchant.id)await ready(()=>evaluate("document.querySelector('h1')?.textContent==='Responsive Fixture Store'"),'merchant details loaded');
 await evaluate("Promise.all([document.fonts.ready,...[...document.images].map(img=>img.decode().catch(()=>{}))]).then(()=>true)");
 if(route.startsWith('/dashboard?')){await ready(()=>evaluate("document.querySelectorAll('.recharts-surface').length===2"),'chart hydration');await pause(1800);}else await pause(150);
}
const measureExpression=`(() => {
 const visible=e=>e.getClientRects().length&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
 const measure=e=>e?{width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,font:parseFloat(getComputedStyle(e).fontSize),padding:parseFloat(getComputedStyle(e).paddingLeft)}:null;
 // Decorative emoji bearings and the notification badge intentionally extend their own boxes.
 // Their containing controls are still checked; all content text overflow remains a failure.
 const overflow=[...document.querySelectorAll('main *,header *,aside *')].filter(e=>visible(e)&&e.clientWidth>0&&e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflowX==='visible'&&!['INPUT','TEXTAREA','SVG','PATH'].includes(e.tagName)&&e.getAttribute('aria-label')!=='Open notifications'&&!(e.getAttribute('aria-hidden')==='true'&&String(e.className).includes('wave'))).map(e=>({tag:e.tagName,class:e.className,width:e.clientWidth,scrollWidth:e.scrollWidth})).slice(0,12);
 const distortedImages=[...document.images].filter(img=>visible(img)&&img.naturalWidth&&getComputedStyle(img).objectFit!=='cover').filter(img=>Math.abs((img.getBoundingClientRect().width/img.getBoundingClientRect().height)/(img.naturalWidth/img.naturalHeight)-1)>.025).map(img=>img.getAttribute('src')?.split('?')[0]);
 const main=document.querySelector('main'),dashboard=!!document.querySelector('.dashboard-shell');
 const sections=dashboard?[...main.children[0].children].filter(e=>getComputedStyle(e).display==='grid'):[];
 return {path:location.pathname,root:parseFloat(getComputedStyle(document.documentElement).fontSize),viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,overflow,distortedImages,
 heading:measure(document.querySelector('h1')),button:measure(document.querySelector('form button')||document.querySelector('button')),icon:measure(document.querySelector('form button svg')||document.querySelector('header svg')),
 brand:measure(document.querySelector('img[class*="brand"]')),input:measure(document.querySelector('input:not([type="hidden"])')),sidebar:measure(document.querySelector('aside')),navbar:measure(document.querySelector('.dashboard-shell header')),
 desktopColumns:sections.map(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),card:measure(sections[1]?.children[0]),mainTransform:main?getComputedStyle(main).transform:null,
 minInputFont:[...document.querySelectorAll('input:not([type="hidden"]),textarea,select')].filter(visible).map(e=>parseFloat(getComputedStyle(e).fontSize)),brokenImages:[...document.images].filter(img=>visible(img)&&(!img.complete||!img.naturalWidth)).length};
})()`;
(async()=>{
 await fs.mkdir(out,{recursive:true});await new Promise((resolve,reject)=>{api.once('error',reject);api.listen(apiPort,'127.0.0.1',resolve);});
 next=spawn(process.execPath,[path.join(web,'node_modules/next/dist/bin/next'),'start','-p',String(webPort)],{cwd:web,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',NEXT_BUILD_DIR:process.env.CHATTO_RESPONSIVE_BUILD_DIR||'.next-responsive',API_INTERNAL_BASE_URL:'http://127.0.0.1:'+apiPort,LINE_PUBLIC_WEBHOOK_URL:'https://hooks.chatto.app/webhooks/line'},windowsHide:true,stdio:'ignore'});next.on('error',()=>{});
 await ready(async()=>(await fetch(origin+'/login',{signal:AbortSignal.timeout(2000)})).ok,'production Next server');
 chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port='+chromePort,'--user-data-dir='+path.join(out,'browser-profile'),'about:blank'],{windowsHide:true,stdio:'ignore'});chrome.on('error',()=>{});
 await ready(async()=>(await fetch('http://127.0.0.1:'+chromePort+'/json/version',{signal:AbortSignal.timeout(2000)})).ok,'Chrome');
 const target=await(await fetch('http://127.0.0.1:'+chromePort+'/json/new?about:blank',{method:'PUT'})).json();socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let sequence=0;const pending=new Map();socket.addEventListener('message',({data})=>{const message=JSON.parse(data);if(message.id&&pending.has(message.id)){const request=pending.get(message.id);pending.delete(message.id);clearTimeout(request.timeout);message.error?request.reject(Error('CDP command failed')):request.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')errors.push(message.params.args.filter(arg=>typeof arg.value==='string').map(arg=>arg.value).join(' ').slice(0,1000));});
 send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timeout=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout'));},20000);pending.set(id,{resolve,reject,timeout});socket.send(JSON.stringify({id,method,params}));});
 evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!result.exceptionDetails,'Browser evaluation succeeded');return result.result.value;};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
 await send('Network.setCookie',{name:'chatto_session',value:'r'.repeat(43),url:origin,httpOnly:true,sameSite:'Lax'});
 const query='?merchantId='+merchant.id;
 const routes=[['home','/'],['login','/login'],['onboarding','/onboarding'+query],['store','/onboarding/store'+query],['line','/onboarding/line'+query],['context','/onboarding/context'+query],['activation','/onboarding/activation'+query],['dashboard','/dashboard'+query],...['products','faq','conversations','handover','settings'].map(name=>[name,'/dashboard/'+name]),['merchants','/merchants'],['new-merchant','/merchants/new'],['merchant','/merchants/'+merchant.id]];
 for(const [width,height] of viewports){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  for(const [name,route] of routes){await navigate(route);const measured=await evaluate(measureExpression);assert.ok(measured.path!=='/login'||name==='login',name+' must not redirect to login');results.push({name,width,height,...measured});
   if(['login','onboarding','store','line','dashboard'].includes(name)){const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await fs.writeFile(path.join(out,name+'-'+width+'.png'),Buffer.from(image.data,'base64'));}
   if(width<768&&measured.minInputFont.length)assert.ok(measured.minInputFont.every(size=>size>=16),'Mobile inputs remain readable');
   if(name==='dashboard'){await evaluate('window.scrollTo(0,500)');assert.ok(await evaluate("Math.abs(document.querySelector('.dashboard-shell header').getBoundingClientRect().top)<1"),'Navbar remains sticky while scrolling');if(width>=1200)assert.ok(await evaluate("Math.abs(document.querySelector('aside').getBoundingClientRect().top)<1"),'Sidebar remains sticky while scrolling');await evaluate('window.scrollTo(0,0)');}
   if(name==='onboarding'){await evaluate("document.querySelector('summary').click()");const dropdown=await evaluate("(() => {const e=document.querySelector('[class*=profileMenu]'),r=e.getBoundingClientRect();return {left:r.left,right:r.right,visible:!!e.getClientRects().length};})()");assert.ok(dropdown.visible&&dropdown.left>=-1&&dropdown.right<=width+1,'Profile dropdown remains inside viewport');await evaluate("document.querySelector('summary').click()");}
  }
  console.log(JSON.stringify({viewport:width+'x'+height,pagesChecked:routes.length,overflowFailures:results.filter(r=>r.width===width&&r.horizontalOverflow).map(r=>r.name),componentOverflow:results.filter(r=>r.width===width&&r.overflow.length).map(r=>({name:r.name,overflow:r.overflow})),errors:errors.length}));
 }
 // Existing alias and first-use state: reads only, no login or writes.
 await navigate('/onboarding/store-information'+query);assert.equal(await evaluate('location.pathname'),'/onboarding/store');
 fixtureFresh=true;readiness={store:false,line:false,context:false,activation:false};await navigate('/onboarding');assert.ok(await evaluate("!document.body.innerText.includes('Responsive Fixture Store')"));fixtureFresh=false;
 assert.equal(mutationRequests,0,'No fixture mutations or provider actions');assert.equal(errors.length,0,'No hydration/runtime errors');
 const failures=results.filter(r=>r.horizontalOverflow||r.overflow.length||r.distortedImages.length||r.brokenImages);
 assert.equal(failures.length,0,'No page overflow or image distortion');
 const desktop=results.filter(r=>r.width>=1200);
 for(const name of ['login','onboarding','store','line','dashboard']){const reference=desktop.find(r=>r.name===name&&r.width===1440);for(const result of desktop.filter(r=>r.name===name)){assert.ok(Math.abs(result.root-result.width/90)<.02,'Central desktop scale');assert.equal(result.mainTransform,'none','No document transform');for(const key of ['heading','button','icon','brand','input','sidebar','navbar','card']){if(reference[key]&&result[key]){for(const metric of ['width','font','padding']){if(!reference[key][metric])continue;assert.ok(Math.abs((result[key][metric]/result.root)/(reference[key][metric]/reference.root)-1)<.055,`${name}/${key}/${metric} scales at ${result.width}`);}}}if(name==='dashboard')assert.deepEqual(result.desktopColumns,reference.desktopColumns,'Stable desktop column composition');}}
 const report={status:'PASS',fixtureOnly:true,databaseAccess:false,mutationRequests,viewports,pages:routes.map(([name,route])=>({name,route})),checks:results.length,runtimeErrors:errors.length,results};await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:'PASS',checks:results.length,mutationRequests,runtimeErrors:errors.length}));
})().catch(async error=>{await fs.writeFile(path.join(out,'results.json'),JSON.stringify({status:'FAIL',blocker:error.message,results,errors,mutationRequests},null,2));console.log(JSON.stringify({status:'FAIL',blocker:error.message}));process.exitCode=1;}).finally(async()=>{if(socket)socket.close();if(chrome&&!chrome.killed)chrome.kill();if(next&&!next.killed)next.kill();api.closeAllConnections();await new Promise(resolve=>api.close(resolve));});
