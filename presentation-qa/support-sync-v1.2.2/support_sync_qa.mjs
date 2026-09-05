import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE=(process.env.DPRO_BASE_URL||'https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/').replace(/\/?$/,'/');
const ROOT=path.resolve('presentation-qa/support-sync-v1.2.2');
const OUT=path.join(ROOT,'runtime-output');
const SCREENS=path.join(ROOT,'screens');
fs.mkdirSync(OUT,{recursive:true});
fs.mkdirSync(SCREENS,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const result={version:'SUPPORT_SYNC_V1.2.2',base:BASE,started_at:new Date().toISOString(),guide:{},tutorial:{},viewports:{},screens:[],business_mutations:[],console_errors:[],request_errors:[],broken_links:[],blockers:[]};
function assert(c,m){if(!c){result.blockers.push(m);throw new Error(m)}}
function monitor(page){page.on('console',m=>{if(m.type()==='error')result.console_errors.push({url:page.url(),text:m.text()})});page.on('request',q=>{if(['POST','PATCH','PUT','DELETE'].includes(q.method()))result.business_mutations.push({method:q.method(),url:q.url()})});page.on('requestfailed',q=>result.request_errors.push({method:q.method(),url:q.url(),error:q.failure()?.errorText||''}))}
async function waitMarker(browser,route,marker,timeout=240000){const page=await browser.newPage({viewport:{width:1280,height:900}});const end=Date.now()+timeout;try{while(Date.now()<end){try{const r=await page.goto(BASE+route+'?support_sync_probe='+Date.now(),{waitUntil:'domcontentloaded',timeout:30000});const text=await page.locator('body').innerText().catch(()=> '');if(r?.ok()&&text.includes(marker))return true}catch{}await sleep(4000)}throw new Error(`Pages marker timeout: ${route} ${marker}`)}finally{await page.close()}}
async function runtime(page){return page.evaluate(()=>window.__DPRO_TUTORIAL_V122__?.getRuntime())}
async function waitFound(page,n,timeout=24000){await page.waitForFunction(step=>{const r=window.__DPRO_TUTORIAL_V122__?.getRuntime();return r?.step===step&&r?.targetState==='found'},n,{timeout});const r=await runtime(page);assert(r?.lastEvidence?.found===true,`step ${n} missing found evidence`);return r}
async function screenshot(page,name,opts={}){const p=path.join(SCREENS,name);await page.screenshot({path:p,fullPage:opts.fullPage??false});result.screens.push(name);return p}
async function guideGeometry(page,width){return page.evaluate(w=>{const doc=document.documentElement;const buttons=[...document.querySelectorAll('.actions .btn')].map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent.trim(),left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}});return {width:w,scrollWidth:doc.scrollWidth,clientWidth:doc.clientWidth,overflow:Math.max(0,doc.scrollWidth-doc.clientWidth),buttons,all_buttons_visible:buttons.every(r=>r.width>30&&r.height>30&&r.left>=-1&&r.right<=w+1)}} ,width)}
async function checkLinks(page,route){await page.goto(BASE+route,{waitUntil:'domcontentloaded'});const links=await page.locator('a[href]').evaluateAll(as=>as.map(a=>a.getAttribute('href')).filter(Boolean));for(const href of links){if(href.startsWith('mailto:')||href.startsWith('tel:')||href.startsWith('javascript:'))continue;const u=new URL(href,page.url());if(u.origin!==new URL(BASE).origin)continue;let ok=true,status=0,detail='';try{if(href.startsWith('#')){const id=decodeURIComponent(u.hash.slice(1));ok=!id||await page.evaluate(x=>!!document.getElementById(x),id);status=ok?200:404;detail='fragment'}else{const res=await page.request.get(u.href,{timeout:30000});status=res.status();ok=res.ok();if(ok&&u.hash){const p2=await page.context().newPage();try{await p2.goto(u.href,{waitUntil:'domcontentloaded'});const id=decodeURIComponent(u.hash.slice(1));ok=!id||await p2.evaluate(x=>!!document.getElementById(x),id);detail='fragment'}finally{await p2.close()}}}}catch(e){ok=false;detail=String(e)}result.broken_links.push({source:route,href,url:u.href,status,ok,detail})}}

const browser=await chromium.launch({headless:true});
try{
  await waitMarker(browser,'guide-center.html','GUIDE CENTER V1.2.2');
  await waitMarker(browser,'quick-start.html','QUICK START MASTER V1.2.2');
  await waitMarker(browser,'detailed-manual.html','DETAILED MANUAL MASTER V1.2.2');
  result.pages_marker='PASS';

  for(const width of [390,768,1440]){const ctx=await browser.newContext({viewport:{width,height:width===390?844:width===768?900:1000}});const p=await ctx.newPage();monitor(p);await p.goto(BASE+'guide-center.html',{waitUntil:'domcontentloaded'});const g=await guideGeometry(p,width);assert(g.overflow<=1,`Guide ${width} horizontal overflow ${g.overflow}`);assert(g.all_buttons_visible,`Guide ${width} action clipped`);result.viewports[width]={...g,status:'PASS'};await screenshot(p,`guide-${width}.png`,{fullPage:true});await ctx.close()}

  const gc=await browser.newContext({viewport:{width:1280,height:900}}),g=await gc.newPage();monitor(g);
  await g.goto(BASE+'guide-center.html',{waitUntil:'domcontentloaded'});await g.locator('#startFirst10').click();await g.waitForURL(/tutorial\.html\?mode=start/);await waitFound(g,1);result.guide.start='PASS';
  await g.goto(BASE+'guide-center.html',{waitUntil:'domcontentloaded'});await g.evaluate(()=>localStorage.setItem('dpro_landscape_first10_v11',JSON.stringify({step:6,done:false,version:'DPRO_TUTORIAL_NAVIGATION_V1.2.2'})));await g.locator('#resumeFirst10').click();await g.waitForURL(/tutorial\.html\?mode=resume/);await waitFound(g,7);result.guide.resume='PASS';
  await g.goto(BASE+'guide-center.html',{waitUntil:'domcontentloaded'});await g.evaluate(()=>{localStorage.setItem('dpro_replay_canary','KEEP');localStorage.setItem('dpro_landscape_first10_v11',JSON.stringify({step:8,done:false,version:'DPRO_TUTORIAL_NAVIGATION_V1.2.2'}))});await g.locator('#replayFirst10').click();await g.waitForURL(/tutorial\.html\?mode=replay/);await waitFound(g,1);assert(await g.evaluate(()=>localStorage.getItem('dpro_replay_canary'))==='KEEP','Replay cleared non-Tutorial state');result.guide.replay='PASS';await gc.close();

  const tc=await browser.newContext({viewport:{width:1440,height:1000}}),t=await tc.newPage();monitor(t);await t.goto(BASE+'tutorial.html?mode=start&qa=1',{waitUntil:'domcontentloaded'});await waitFound(t,1);assert(await t.evaluate(()=>window.__DPRO_TUTORIAL_V122__.steps.length)===10,'First10 count != 10');await screenshot(t,'tutorial-step-01.png');
  const expected={4:'owner-dynamic-target.png',7:'staff-after-photo-target.png',9:'customer-approval-target.png',10:'system-check-target.png'};
  for(const n of [4,7,9,10]){await t.evaluate(step=>window.__DPRO_TUTORIAL_V122__.openStep(step),n);const r=await waitFound(t,n);assert(r.lastEvidence?.visible===true,`step ${n} target not visible`);await screenshot(t,expected[n])}
  await t.evaluate(()=>window.__DPRO_TUTORIAL_V122__.qaForceSelector('#__support_sync_missing__'));await t.waitForFunction(()=>window.__DPRO_TUTORIAL_V122__.getRuntime().targetState==='missing',{timeout:24000});assert(await t.locator('#next').isDisabled(),'Next not disabled on TARGET_MISSING');assert(await t.locator('#retry').isVisible(),'Retry not visible');assert(await t.locator('#guideRecovery').isVisible(),'Guide recovery not visible');await screenshot(t,'target-missing-recovery.png');result.tutorial.target_missing='PASS';await t.evaluate(()=>window.__DPRO_TUTORIAL_V122__.qaClearForce());await waitFound(t,10).catch(async()=>{await t.evaluate(()=>window.__DPRO_TUTORIAL_V122__.openStep(1));await waitFound(t,1)});await tc.close();

  const mc=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),m=await mc.newPage();monitor(m);await m.goto(BASE+'tutorial.html?mode=start&qa=1',{waitUntil:'domcontentloaded'});await waitFound(m,1);assert(await m.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))<=1,'Tutorial 390 overflow');await screenshot(m,'mobile-390.png',{fullPage:true});await mc.close();

  const lc=await browser.newContext({viewport:{width:1200,height:900}}),lp=await lc.newPage();for(const route of ['guide-center.html','quick-start.html','detailed-manual.html'])await checkLinks(lp,route);await lc.close();
  const broken=result.broken_links.filter(x=>!x.ok);assert(broken.length===0,`broken links ${broken.length}`);
  assert(result.business_mutations.length===0,`business mutations ${result.business_mutations.length}`);
  result.tutorial.business_mutation_count=0;
  result.status='PASS';
}catch(e){result.status='FAIL';result.fatal=String(e?.stack||e)}finally{
  result.finished_at=new Date().toISOString();
  fs.writeFileSync(path.join(OUT,'GUIDE_CENTER_RUNTIME_QA.json'),JSON.stringify({status:result.status,guide:result.guide,viewports:result.viewports},null,2));
  fs.writeFileSync(path.join(OUT,'BROKEN_LINK_QA.json'),JSON.stringify({status:result.broken_links.every(x=>x.ok)?'PASS':'FAIL',links:result.broken_links},null,2));
  fs.writeFileSync(path.join(OUT,'VISUAL_QA_RESULT.txt'),JSON.stringify({status:result.status,viewports:result.viewports,screens:result.screens},null,2));
  fs.writeFileSync(path.join(OUT,'SUPPORT_RUNTIME_QA.json'),JSON.stringify(result,null,2));
  await browser.close();
}
if(result.status!=='PASS')process.exit(1);
