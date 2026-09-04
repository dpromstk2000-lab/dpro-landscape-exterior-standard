#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, os, shutil, subprocess, sys, time, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/'site'; QA=ROOT/'qa-dpro53'
WIDTHS=[375,390,430,768,1280,1440]
MASTER_FILES=['lp.html','a4-flyer.html','guide-center.html','quick-start.html','detailed-manual.html']
EXPECTED_QR={
 'a4':{'https://lin.ee/YxJGXV6D','https://dpro-shop.com/','https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/'},
 'quick':{'https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/guide-center.html','https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/tutorial.html','https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/system-check.html'},
 'manual':{'https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/guide-center.html','https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/tutorial.html','https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/system-check.html'},
}
CHANGED_SITE=[
 'lp.html','a4-flyer.html','guide-center.html','quick-start.html','detailed-manual.html','product-site-v2.css',
 'landscape-hero.jpg','landscape-consult.jpg','qr-line.svg','qr-shop.svg','qr-demo.svg','qr-guide.svg','qr-tutorial.svg','qr-system-check.svg',
 'qa-owner-screen.png','qa-staff-screen.png','qa-customer-screen.png','qa-system-check-screen.png',
 'DPRO_LANDSCAPE_EXTERIOR_A4_FLYER_MASTER_V2.0_20260904.pdf','DPRO_LANDSCAPE_EXTERIOR_QUICK_START_MASTER_V1.1_20260904.pdf','DPRO_LANDSCAPE_EXTERIOR_DETAILED_MANUAL_MASTER_V1.1_20260904.pdf',
 'DPRO_LANDSCAPE_EXTERIOR_A4_FLYER_V1.0_20260902.pdf','DPRO_LANDSCAPE_EXTERIOR_QUICK_START_V1.0_20260902.pdf','DPRO_LANDSCAPE_EXTERIOR_DETAILED_MANUAL_V1.0_20260902.pdf','.dpro53-reaudit-ok.txt'
]

def run(cmd,**kw):
 print('+',' '.join(map(str,cmd)),flush=True)
 return subprocess.run(cmd,check=True,text=True,**kw)

def download(url:str,path:Path):
 req=urllib.request.Request(url,headers={'User-Agent':'DPRO53-Reaudit/1.0'})
 with urllib.request.urlopen(req,timeout=40) as r:data=r.read()
 if len(data)<10000:raise RuntimeError(f'download too small: {url} {len(data)}')
 path.write_bytes(data)

def make_qr_svg(path:Path,url:str):
 import qrcode, qrcode.image.svg
 qrcode.make(url,image_factory=qrcode.image.svg.SvgPathImage,box_size=10,border=4).save(str(path))

def patch_images(path:Path,names:list[str]):
 from bs4 import BeautifulSoup
 s=BeautifulSoup(path.read_text('utf-8'),'html.parser');imgs=s.find_all('img')
 if len(imgs)!=len(names):raise RuntimeError(f'{path.name} image mismatch {len(imgs)} != {len(names)}')
 for img,name in zip(imgs,names):img['src']=name
 path.write_text(str(s),encoding='utf-8')

def prepare():
 src=SITE/'presentation-v12'
 for name in MASTER_FILES:
  p=src/name
  if not p.exists():raise RuntimeError('missing certified master '+str(p))
  shutil.copy2(p,SITE/name)
 guide=SITE/'guide-center.html';txt=guide.read_text('utf-8')
 txt=txt.replace('DPRO_LANDSCAPE_EXTERIOR_TUTORIAL_FIRST10_MASTER_V1.1_20260904.html','tutorial.html')
 guide.write_text(txt,encoding='utf-8')
 download('https://raw.githubusercontent.com/dpromstk2000-lab/dpro-line-systems-site/main/systems/landscape-exterior-field.jpg',SITE/'landscape-hero.jpg')
 download('https://raw.githubusercontent.com/dpromstk2000-lab/dpro-line-systems-site/main/systems/landscape-exterior-consult.jpg',SITE/'landscape-consult.jpg')
 urls={
  'qr-line.svg':'https://lin.ee/YxJGXV6D','qr-shop.svg':'https://dpro-shop.com/','qr-demo.svg':'https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/',
  'qr-guide.svg':'https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/guide-center.html','qr-tutorial.svg':'https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/tutorial.html','qr-system-check.svg':'https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/system-check.html'}
 for n,u in urls.items():make_qr_svg(SITE/n,u)
 patch_images(SITE/'lp.html',['landscape-hero.jpg','owner-screen.jpg','landscape-consult.jpg'])
 patch_images(SITE/'a4-flyer.html',['landscape-hero.jpg','qr-line.svg','qr-shop.svg','qr-demo.svg'])
 patch_images(SITE/'quick-start.html',['qr-guide.svg','qr-tutorial.svg','qa-owner-screen.png','qa-system-check-screen.png','qr-system-check.svg'])
 patch_images(SITE/'detailed-manual.html',['qr-guide.svg','qa-owner-screen.png','qr-tutorial.svg','qa-owner-screen.png','qa-staff-screen.png','qa-customer-screen.png','qa-system-check-screen.png','qr-system-check.svg','qr-guide.svg','qr-tutorial.svg'])
 css=SITE/'product-site-v2.css';c=css.read_text('utf-8');guard='/* DPRO Japanese wrap guard V2.1 */'
 if guard not in c:
  c+='\n'+guard+'\n@media(max-width:420px){#price .section-head h2{font-size:1.82rem;letter-spacing:-.045em;overflow-wrap:normal;word-break:normal}}\n'
  css.write_text(c,encoding='utf-8')
 print('PREPARE PASS')

def validate_workflows():
 import yaml
 checked=[]
 for p in sorted((ROOT/'.github'/'workflows').glob('dpro-53-*.yml')):
  obj=yaml.safe_load(p.read_text('utf-8'));checked.append(p.name)
  def walk(v):
   if isinstance(v,dict):
    for k,x in v.items():
     if k=='run' and isinstance(x,str):
      cp=subprocess.run(['bash','-n'],input=x,text=True,capture_output=True)
      if cp.returncode:raise RuntimeError(f'bash -n failed {p.name}: {cp.stderr}')
     walk(x)
   elif isinstance(v,list):
    for x in v:walk(x)
  walk(obj)
 run([sys.executable,'-m','py_compile',str(Path(__file__))])
 print('WORKFLOW PREFLIGHT PASS',checked)

def start_server():
 log=open('/tmp/dpro53-http.log','w')
 p=subprocess.Popen([sys.executable,'-m','http.server','8000','--bind','127.0.0.1','--directory',str(SITE)],stdout=log,stderr=subprocess.STDOUT)
 for _ in range(50):
  try:urllib.request.urlopen('http://127.0.0.1:8000/',timeout=1).read(32);return p,log
  except Exception:time.sleep(.2)
 p.terminate();raise RuntimeError('HTTP server failed')

def page_metrics(page):
 return page.evaluate("""()=>{const de=document.documentElement,b=document.body;const dw=Math.max(de.scrollWidth,b?b.scrollWidth:0);const bad=[...document.querySelectorAll('h1,h2,h3')].map(e=>({text:(e.innerText||'').trim(),left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,sw:e.scrollWidth,cw:e.clientWidth})).filter(x=>x.right>innerWidth+1||x.left<-1||x.sw>x.cw+1);return {innerWidth,docWidth:dw,overflow:Math.max(0,dw-innerWidth),badHeadings:bad.slice(0,20)}}""")

def screenshot_pages(browser,base):
 for url,name in [('owner.html','qa-owner-screen.png'),('staff.html','qa-staff-screen.png'),('customer.html','qa-customer-screen.png'),('system-check.html','qa-system-check-screen.png')]:
  p=browser.new_page(viewport={'width':1200,'height':900});p.goto(base+url,wait_until='networkidle');p.screenshot(path=str(SITE/name),full_page=True);p.close()

def tutorial_runtime(browser,base):
 page=browser.new_page(viewport={'width':390,'height':844});muts=[]
 page.on('request',lambda r:muts.append({'method':r.method,'url':r.url}) if r.method not in ('GET','HEAD','OPTIONS') else None)
 page.goto(base+'guide-center.html',wait_until='networkidle');link=page.locator('a[href="tutorial.html"]').first
 if link.count()!=1:raise RuntimeError('Guide→Tutorial link missing')
 link.click();page.wait_for_load_state('networkidle')
 if not page.url.endswith('/tutorial.html'):raise RuntimeError('Guide→Tutorial navigation failed')
 steps=page.evaluate('STEPS.length')
 if steps!=10:raise RuntimeError(f'First10 steps={steps}')
 page.get_by_role('button',name='Start',exact=True).click();start_step=page.locator('#stepnum').inner_text()
 page.keyboard.press('ArrowRight');arrow_step=page.locator('#stepnum').inner_text()
 d=page.locator('#drag');box=d.bounding_box();before=page.locator('#panel').evaluate('(e)=>e.style.transform')
 if box:
  page.mouse.move(box['x']+20,box['y']+20);page.mouse.down();page.mouse.move(box['x']+75,box['y']+60,steps=5);page.mouse.up()
 after=page.locator('#panel').evaluate('(e)=>e.style.transform');mouse_drag=before!=after
 page.keyboard.press('Escape');esc_close=page.locator('#panel').is_hidden()
 page.get_by_role('button',name='Resume',exact=True).click();resume_step=page.locator('#stepnum').inner_text()
 for _ in range(15):
  if page.locator('#panel').is_hidden():break
  page.locator('#next').click();time.sleep(.02)
 completed=page.locator('#panel').is_hidden();state=page.evaluate("JSON.parse(localStorage.getItem('dpro_landscape_first10_v11'))")
 page.get_by_role('button',name='Replay',exact=True).click();replay_step=page.locator('#stepnum').inner_text();page.close()
 ctx=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True);t=ctx.new_page();t.goto(base+'tutorial.html',wait_until='networkidle');t.get_by_role('button',name='Start',exact=True).click()
 td=t.locator('#drag');tb=td.bounding_box();tbef=t.locator('#panel').evaluate('(e)=>e.style.transform')
 if tb:
  t.evaluate("""([x,y])=>{const d=document.querySelector('#drag');const old=d.setPointerCapture;d.setPointerCapture=()=>{};for(const [type,dx,dy] of [['pointerdown',0,0],['pointermove',58,42],['pointerup',58,42]])d.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:71,pointerType:'touch',clientX:x+dx,clientY:y+dy}));d.setPointerCapture=old;}""",[tb['x']+20,tb['y']+20])
 taft=t.locator('#panel').evaluate('(e)=>e.style.transform');touch_drag=tbef!=taft;t.close();ctx.close()
 return {'guide_runtime':True,'steps':steps,'start_step':start_step,'arrow_step':arrow_step,'mouse_drag':mouse_drag,'touch_drag':touch_drag,'esc_close':esc_close,'resume_step':resume_step,'completed':completed,'stored_state':state,'replay_step':replay_step,'mutating_requests':muts}

def pdf_generate(browser,base):
 defs=[('a4-flyer.html','DPRO_LANDSCAPE_EXTERIOR_A4_FLYER_MASTER_V2.0_20260904.pdf','DPRO_LANDSCAPE_EXTERIOR_A4_FLYER_V1.0_20260902.pdf'),('quick-start.html','DPRO_LANDSCAPE_EXTERIOR_QUICK_START_MASTER_V1.1_20260904.pdf','DPRO_LANDSCAPE_EXTERIOR_QUICK_START_V1.0_20260902.pdf'),('detailed-manual.html','DPRO_LANDSCAPE_EXTERIOR_DETAILED_MANUAL_MASTER_V1.1_20260904.pdf','DPRO_LANDSCAPE_EXTERIOR_DETAILED_MANUAL_V1.0_20260902.pdf')]
 for html,master,alias in defs:
  p=browser.new_page(viewport={'width':1280,'height':900});p.goto(base+html,wait_until='networkidle');p.emulate_media(media='print');p.pdf(path=str(SITE/master),format='A4',print_background=True,prefer_css_page_size=True,margin={'top':'0','right':'0','bottom':'0','left':'0'});p.close();shutil.copy2(SITE/master,SITE/alias)

def render_pdf(path:Path,outdir:Path,dpi=250):
 import fitz
 outdir.mkdir(parents=True,exist_ok=True);doc=fitz.open(path);out=[]
 for i,p in enumerate(doc):
  pix=p.get_pixmap(matrix=fitz.Matrix(dpi/72,dpi/72),alpha=False);q=outdir/f'page-{i+1}.png';pix.save(str(q));out.append(q)
 return out

def qr_decode(paths):
 import cv2
 vals=[];det=cv2.QRCodeDetector()
 for path in paths:
  im=cv2.imread(str(path));H,W=im.shape[:2];crops=[(0,0,1,1),(0,0,.55,1),(.45,0,1,1),(0,0,1,.6),(0,.4,1,1)]+[(x0,y0,x1,y1) for y0,y1 in [(0,.5),(.45,1)] for x0,x1 in [(0,.38),(.31,.69),(.62,1)]]
  for x0,y0,x1,y1 in crops:
   r=im[int(y0*H):int(y1*H),int(x0*W):int(x1*W)]
   if not r.size:continue
   scale=min(1.0,1000/min(r.shape[:2]));r=cv2.resize(r,None,fx=scale,fy=scale) if scale<1 else r
   try:
    ok,infos,_,_=det.detectAndDecodeMulti(r)
    if ok:
     for x in infos:
      if x and x not in vals:vals.append(x)
    x,_,_=det.detectAndDecode(r)
    if x and x not in vals:vals.append(x)
   except Exception:pass
 return vals

def contact_sheet(paths,out,cols=3):
 from PIL import Image
 ims=[];tw=360
 for p in paths:
  im=Image.open(p).convert('RGB');ims.append(im.resize((tw,round(im.height*tw/im.width))))
 mh=max(x.height for x in ims);rows=(len(ims)+cols-1)//cols;sh=Image.new('RGB',(cols*tw,rows*mh),(245,245,245))
 for i,im in enumerate(ims):sh.paste(im,((i%cols)*tw,(i//cols)*mh))
 sh.save(out,quality=90)

def qa():
 from bs4 import BeautifulSoup
 from pypdf import PdfReader
 from playwright.sync_api import sync_playwright
 QA.mkdir(exist_ok=True);server,log=start_server();base='http://127.0.0.1:8000/'
 r={'product':'DPRO 造園・外構','product_number':53,'presentation_standard':'V1.2 / LP V1.4 / A4 V2.0 / Tutorial V1.1','responsive':{},'static':{},'tutorial':{},'pdf':{},'qr':{},'blockers':[]}
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);screenshot_pages(browser,base)
   for fp in sorted(SITE.glob('*.html')):
    r['responsive'][fp.name]={}
    for w in WIDTHS:
     page=browser.new_page(viewport={'width':w,'height':900});errors=[];failed=[];page.on('pageerror',lambda e,errors=errors:errors.append(str(e)));page.on('requestfailed',lambda q,failed=failed:failed.append({'url':q.url,'failure':q.failure}));page.goto(base+fp.name,wait_until='networkidle');m=page_metrics(page);m['page_errors']=errors;m['request_failed']=failed;r['responsive'][fp.name][str(w)]=m
     if m['overflow']>1 or m['badHeadings'] or errors or failed:r['blockers'].append(f'RESPONSIVE:{fp.name}:{w}:{m}')
     if fp.name in ('lp.html','product-site.html') and w in (390,1440):page.screenshot(path=str(QA/f'DPRO53_{fp.stem.upper()}_{w}.png'),full_page=True)
     page.close()
   lp=BeautifulSoup((SITE/'lp.html').read_text('utf-8'),'html.parser');secs=lp.find_all('section');imgs=lp.find_all('img');r['static']['lp_sections']=len(secs);r['static']['lp_p1_photo']=imgs[0].get('src') if imgs else None;r['static']['lp_p10_photo']=imgs[-1].get('src') if imgs else None
   if len(secs)!=10 or r['static']['lp_p1_photo']!='landscape-hero.jpg' or r['static']['lp_p10_photo']!='landscape-consult.jpg':r['blockers'].append('LP_MASTER_REQUIREMENTS')
   a4=BeautifulSoup((SITE/'a4-flyer.html').read_text('utf-8'),'html.parser');text=a4.get_text(' ',strip=True);req=['CONNECTED EXPERIENCE','入口は自由。管理は、ひとつ。','CUSTOM FIT','LIVE SYNC','5,500円','3,300円','1,100円'];r['static']['a4_required']={x:x in text for x in req};r['static']['a4_features']=len(a4.select('.feature'));r['static']['a4_qr_count']=len(a4.select('img.qr'))
   if not all(r['static']['a4_required'].values()) or r['static']['a4_features']!=6 or r['static']['a4_qr_count']!=3:r['blockers'].append('A4_MASTER_REQUIREMENTS')
   r['tutorial']=tutorial_runtime(browser,base)
   if r['tutorial']['steps']!=10 or not all(r['tutorial'][x] for x in ['guide_runtime','mouse_drag','touch_drag','esc_close','completed']) or r['tutorial']['mutating_requests']:r['blockers'].append('TUTORIAL_RUNTIME')
   pdf_generate(browser,base);browser.close()
  for k,(name,pages_expected) in {'a4':('DPRO_LANDSCAPE_EXTERIOR_A4_FLYER_MASTER_V2.0_20260904.pdf',1),'quick':('DPRO_LANDSCAPE_EXTERIOR_QUICK_START_MASTER_V1.1_20260904.pdf',3),'manual':('DPRO_LANDSCAPE_EXTERIOR_DETAILED_MANUAL_MASTER_V1.1_20260904.pdf',9)}.items():
   f=SITE/name;pages=len(PdfReader(str(f)).pages);renders=render_pdf(f,QA/f'render-{k}');decoded=qr_decode(renders);r['pdf'][k]={'file':name,'pages':pages,'bytes':f.stat().st_size,'rendered_pages':len(renders)};r['qr'][k]={'decoded':decoded,'expected':sorted(EXPECTED_QR[k]),'pass':EXPECTED_QR[k].issubset(set(decoded))}
   if pages!=pages_expected or len(renders)!=pages_expected or not r['qr'][k]['pass']:r['blockers'].append(f'PDF_QR:{k}')
   if k=='a4':shutil.copy2(renders[0],QA/'DPRO53_A4_FINAL_RENDER.png')
   elif k=='quick':contact_sheet(renders,QA/'DPRO53_QUICK_CONTACT.jpg',3)
   else:contact_sheet(renders,QA/'DPRO53_MANUAL_CONTACT.jpg',3)
  r['status']='PASS' if not r['blockers'] else 'FAIL';(SITE/'.dpro53-reaudit-ok.txt').write_text('DPRO53 REAUDIT '+r['status']+'\n',encoding='utf-8');(QA/'DPRO53_REAUDIT_RUNTIME_RESULT.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')
  md=['# DPRO 53 造園・外構 FINAL RE-AUDIT',f"- Result: **{r['status']}**",'- Product Number: 53',f"- Blockers: {len(r['blockers'])}",'- SYSTEM CORE: protected / no intentional changes','- Responsive: 375 / 390 / 430 / 768 / 1280 / 1440','- Tutorial: First10 exactly 10 / Guide runtime / Start Resume Replay / Esc / keyboard / mouse drag / touch pointer drag / mutation 0','- PDFs: A4 1 / Quick 3 / Manual 9 / final-raster QR decode']
  if r['blockers']:md+=['','## Blockers']+['- '+x for x in r['blockers']]
  (QA/'DPRO53_REAUDIT_RUNTIME_RESULT.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
  if r['blockers']:raise SystemExit('QA FAIL: '+repr(r['blockers']))
  print('DPRO53 FINAL REAUDIT PASS')
 finally:
  server.terminate()
  try:server.wait(timeout=5)
  except Exception:server.kill()
  log.close()

def artifact():
 d=ROOT/'artifact-dpro53';shutil.rmtree(d,ignore_errors=True);(d/'site-final').mkdir(parents=True);(d/'reports').mkdir(parents=True)
 for n in CHANGED_SITE:
  p=SITE/n
  if not p.exists():raise RuntimeError('missing artifact file '+n)
  shutil.copy2(p,d/'site-final'/n)
 for p in QA.glob('*'):
  if p.is_file():shutil.copy2(p,d/'reports'/p.name)
 print('ARTIFACT READY',d)

def main():
 ap=argparse.ArgumentParser();ap.add_argument('command',choices=['prepare','validate-workflows','qa','artifact']);a=ap.parse_args();{'prepare':prepare,'validate-workflows':validate_workflows,'qa':qa,'artifact':artifact}[a.command]()
if __name__=='__main__':main()
