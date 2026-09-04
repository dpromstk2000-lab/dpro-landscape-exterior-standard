#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
QA = ROOT / 'qa-dpro53-fix-r1'
WIDTHS = [375, 390, 430, 768, 1280, 1440]
TARGET_PAGES = ['a4-flyer.html', 'product-site.html', 'lp.html']
CORE_FILES = [
    'SYSTEM_MASTER.yml', 'AUTH_ROLE_MATRIX.yml', 'LINE_INTEGRATION_CONTRACT.yml',
    'SHARED_SUPABASE_BINDING.yml', 'STORAGE_INTEGRATION_CONTRACT.yml', 'schema.sql',
    'site/app-core.js', 'site/auth-client.js', 'site/config.js',
    'worker/ENV_REQUIRED.txt', 'worker/worker.js', 'worker/wrangler.toml',
]
COMPOUNDS = [
    '施工', '完了承認', '現場カルテ', 'つなぐ', '現地調査', '写真相談',
    '施工完了', '施工管理', '施工前後', '季節フォロー', '見積根拠',
]
EXPECTED_QR = {
    'a4': {
        'https://lin.ee/YxJGXV6D',
        'https://dpro-shop.com/',
        'https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/',
    },
    'quick': {
        'https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/guide-center.html',
        'https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/tutorial.html',
        'https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/system-check.html',
    },
    'manual': {
        'https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/guide-center.html',
        'https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/tutorial.html',
        'https://dpromstk2000-lab.github.io/dpro-landscape-exterior-standard/system-check.html',
    },
}
SITE_FINAL = [
    'a4-flyer.html',
    'product-site.html',
    'presentation-v12/a4-flyer.html',
    'DPRO_LANDSCAPE_EXTERIOR_A4_FLYER_MASTER_V2.0_20260904.pdf',
    'DPRO_LANDSCAPE_EXTERIOR_A4_FLYER_V1.0_20260902.pdf',
    '.dpro53-fix-r1-ok.txt',
]

A4_R1_CSS = r'''
/* DPRO CENTRAL FIX R1: semantic Japanese wrap + true viewport fit */
.sheet-stage{position:relative;width:min(794px,100%);height:calc(1123px * var(--dpro-a4-scale,1));margin:20px auto;overflow:hidden}
.sheet-stage>.sheet{position:absolute!important;left:0;top:0;margin:0!important;width:794px;height:1123px;transform-origin:top left;transform:scale(var(--dpro-a4-scale,1))}
.semantic-headline .dline{display:block;white-space:nowrap;word-break:keep-all;overflow-wrap:normal}
@media(max-width:820px){body{overflow-x:hidden}.sheet-stage{margin:0 auto}}
@media print{
  body{background:#fff;overflow:visible}.sheet-stage{width:210mm;height:297mm;margin:0;overflow:visible}
  .sheet-stage>.sheet{position:static!important;transform:none!important;width:210mm;height:297mm;margin:0!important;box-shadow:none}
}
'''.strip()

PRODUCT_R1_CSS = r'''
/* DPRO CENTRAL FIX R1: semantic Japanese headline lines */
.hero .semantic-headline{font-size:clamp(2.85rem,4vw,3.65rem)}
.hero .semantic-headline .dline{display:block;white-space:nowrap;word-break:keep-all;overflow-wrap:normal}
.hero .semantic-headline .dline-mobile{display:none}
@media(max-width:680px){
  .hero .semantic-headline .dline-pc{display:none}
  .hero .semantic-headline .dline-mobile{display:block}
  .hero .semantic-headline{font-size:clamp(2rem,9vw,2.55rem)}
}
@media(max-width:420px){.hero .semantic-headline{font-size:2rem}}
'''.strip()

A4_FIT_SCRIPT = r'''(()=>{function dproFitA4(){const w=document.documentElement.clientWidth||innerWidth;document.documentElement.style.setProperty('--dpro-a4-scale',String(Math.min(1,w/794)))}dproFitA4();addEventListener('resize',dproFitA4)})()'''


def run(cmd, **kw):
    print('+', ' '.join(map(str, cmd)), flush=True)
    return subprocess.run(cmd, check=True, text=True, **kw)


def add_style(soup, marker: str, css: str):
    for st in soup.find_all('style'):
        if marker in (st.string or st.get_text() or ''):
            st.decompose()
    st = soup.new_tag('style')
    st.string = css
    soup.head.append(st)


def set_headline(soup, selector: str, lines: list[tuple[str, str | None]], classes: list[str]):
    h = soup.select_one(selector)
    if not h:
        raise RuntimeError(f'missing headline selector: {selector}')
    h.clear()
    h['class'] = sorted(set((h.get('class') or []) + classes))
    for text, extra in lines:
        sp = soup.new_tag('span')
        sp['class'] = ['dline'] + ([extra] if extra else [])
        if text.startswith('<em>') and text.endswith('</em>'):
            em = soup.new_tag('em')
            em.string = text[4:-5]
            sp.append(em)
        else:
            sp.string = text
        h.append(sp)


def patch_a4(path: Path):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(path.read_text(encoding='utf-8'), 'html.parser')
    set_headline(
        soup,
        '.hero h1',
        [
            ('写真だけじゃない。', None),
            ('相談・現調・見積から', None),
            ('施工完了まで、', None),
            ('ひとつにつなぐ。', None),
        ],
        ['semantic-headline'],
    )
    main = soup.select_one('main.sheet')
    if not main:
        raise RuntimeError(f'missing A4 sheet: {path}')
    parent_classes = (main.parent.get('class') or []) if getattr(main.parent, 'get', None) else []
    if 'sheet-stage' not in parent_classes:
        stage = soup.new_tag('div')
        stage['class'] = ['sheet-stage']
        main.wrap(stage)
    add_style(soup, 'DPRO CENTRAL FIX R1', A4_R1_CSS)
    for sc in list(soup.find_all('script')):
        txt = sc.string or sc.get_text() or ''
        if 'dproFitA4' in txt:
            sc.decompose()
    sc = soup.new_tag('script')
    sc.string = A4_FIT_SCRIPT
    soup.body.append(sc)
    path.write_text(str(soup), encoding='utf-8')


def patch_product(path: Path):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(path.read_text(encoding='utf-8'), 'html.parser')
    h = soup.select_one('.hero__copy h1')
    if not h:
        raise RuntimeError('Product Site hero h1 missing')
    h.clear()
    h['class'] = sorted(set((h.get('class') or []) + ['semantic-headline']))
    pc = [
        ('写真相談から、', 'dline-pc', False),
        ('現調・見積・施工・', 'dline-pc', False),
        ('完了承認まで。', 'dline-pc', False),
        ('ひとつの現場カルテへ。', 'dline-pc', True),
    ]
    mobile = [
        ('写真相談から、', 'dline-mobile', False),
        ('現調・見積・施工・', 'dline-mobile', False),
        ('完了承認まで。', 'dline-mobile', False),
        ('ひとつの', 'dline-mobile', True),
        ('現場カルテへ。', 'dline-mobile', True),
    ]
    for text, cls, emph in pc + mobile:
        sp = soup.new_tag('span')
        sp['class'] = ['dline', cls]
        if emph:
            em = soup.new_tag('em')
            em.string = text
            sp.append(em)
        else:
            sp.string = text
        h.append(sp)
    add_style(soup, 'DPRO CENTRAL FIX R1', PRODUCT_R1_CSS)
    path.write_text(str(soup), encoding='utf-8')


def patch():
    patch_a4(SITE / 'a4-flyer.html')
    src = SITE / 'presentation-v12' / 'a4-flyer.html'
    if src.exists():
        patch_a4(src)
    patch_product(SITE / 'product-site.html')
    print('PATCH R1 PASS')


def validate_workflows():
    import yaml
    checked = []
    for name in [
        'dpro-53-central-fix-r1.yml',
        'dpro-53-central-fix-r1-apply.yml',
        'dpro-53-bootstrap-dispatch.yml',
        'deploy-pages.yml',
    ]:
        p = ROOT / '.github' / 'workflows' / name
        if not p.exists():
            raise RuntimeError('missing workflow ' + name)
        obj = yaml.safe_load(p.read_text(encoding='utf-8'))
        if not isinstance(obj, dict):
            raise RuntimeError('invalid YAML ' + name)
        checked.append(name)

        def walk(v):
            if isinstance(v, dict):
                for k, x in v.items():
                    if k == 'run' and isinstance(x, str):
                        cp = subprocess.run(['bash', '-n'], input=x, text=True, capture_output=True)
                        if cp.returncode:
                            raise RuntimeError(f'bash -n failed {name}: {cp.stderr}')
                    walk(x)
            elif isinstance(v, list):
                for x in v:
                    walk(x)
        walk(obj)
    run([sys.executable, '-m', 'py_compile', str(Path(__file__))])
    p, log = start_server(port=8011)
    try:
        urllib.request.urlopen('http://127.0.0.1:8011/product-site.html', timeout=3).read(64)
    finally:
        p.terminate()
        try:
            p.wait(timeout=5)
        except Exception:
            p.kill()
        log.close()
    cp = subprocess.run(['bash', '-n'], input="git commit -m 'DPRO 53 CENTRAL FIX R1 presentation sync'\n", text=True, capture_output=True)
    if cp.returncode:
        raise RuntimeError('commit quoting preflight failed: ' + cp.stderr)
    print('WORKFLOW PREFLIGHT PASS', checked)


def start_server(port=8000):
    log = open(f'/tmp/dpro53-r1-http-{port}.log', 'w')
    p = subprocess.Popen(
        [sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(SITE)],
        stdout=log,
        stderr=subprocess.STDOUT,
    )
    for _ in range(60):
        try:
            urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=1).read(16)
            return p, log
        except Exception:
            time.sleep(.2)
    p.terminate()
    log.close()
    raise RuntimeError('HTTP server failed')


PAGE_METRICS_JS = r'''()=>{
const de=document.documentElement,b=document.body;
const dw=Math.max(de.scrollWidth,b?b.scrollWidth:0);
const visible=e=>{const cs=getComputedStyle(e),r=e.getBoundingClientRect();return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0};
const headingEls=[...document.querySelectorAll('h1,h2,h3')].filter(visible);
const badHeadings=headingEls.map(e=>{const r=e.getBoundingClientRect();return {text:(e.innerText||'').trim(),left:r.left,right:r.right,sw:e.scrollWidth,cw:e.clientWidth}}).filter(x=>x.right>innerWidth+1||x.left<-1||x.sw>x.cw+1);
function charRects(el){
 const out=[]; const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
 let n; while(n=w.nextNode()){
  const t=n.nodeValue||'';
  for(let i=0;i<t.length;i++){
   const ch=t[i]; if(/\s/.test(ch)) continue;
   const rg=document.createRange(); rg.setStart(n,i); rg.setEnd(n,i+1);
   const r=rg.getBoundingClientRect(); if(r.width||r.height) out.push({ch,top:r.top,left:r.left,right:r.right});
  }
 }
 return out;
}
function groups(chars){
 const ls=[];
 for(const c of chars){let g=ls.find(x=>Math.abs(x.top-c.top)<=2);if(!g){g={top:c.top,chars:[]};ls.push(g)}g.chars.push(c)}
 ls.sort((a,b)=>a.top-b.top);return ls;
}
const dlineWrap=[];
for(const e of [...document.querySelectorAll('.dline')].filter(visible)){
 const ls=groups(charRects(e)); if(ls.length!==1){dlineWrap.push({text:(e.innerText||'').trim(),lines:ls.length})}
}
const orphans=[]; const compoundSplits=[];
const compounds=%s;
for(const e of headingEls){
 const chars=charRects(e); const ls=groups(chars);
 for(const l of ls){
  const raw=l.chars.map(x=>x.ch).join('');
  const glyphs=[...raw];
  if(glyphs.length===1 && /[ぁ-んァ-ヶ一-龯々〆ヵヶ]/.test(glyphs[0])) orphans.push({heading:(e.innerText||'').trim(),line:raw});
 }
 const flat=chars.map(x=>x.ch).join('');
 for(const word of compounds){
  let start=0;
  while(true){const idx=flat.indexOf(word,start);if(idx<0)break;const tops=new Set(chars.slice(idx,idx+word.length).map(x=>Math.round(x.top)));if(tops.size>1)compoundSplits.push({heading:(e.innerText||'').trim(),word});start=idx+word.length}
 }
}
return {innerWidth,docWidth:dw,overflow:Math.max(0,dw-de.clientWidth),badHeadings:badHeadings.slice(0,20),dlineWrap,orphans,compoundSplits};
}''' % json.dumps(COMPOUNDS, ensure_ascii=False)


def page_metrics(page):
    return page.evaluate(PAGE_METRICS_JS)


def screenshot(page, path: Path):
    page.screenshot(path=str(path), full_page=True)


def pdf_generate_a4(browser, base):
    master = SITE / 'DPRO_LANDSCAPE_EXTERIOR_A4_FLYER_MASTER_V2.0_20260904.pdf'
    alias = SITE / 'DPRO_LANDSCAPE_EXTERIOR_A4_FLYER_V1.0_20260902.pdf'
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    page.goto(base + 'a4-flyer.html', wait_until='networkidle')
    page.emulate_media(media='print')
    page.pdf(
        path=str(master), format='A4', print_background=True, prefer_css_page_size=True,
        margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'},
    )
    page.close()
    shutil.copy2(master, alias)


def render_pdf(path: Path, outdir: Path, dpi=220):
    import fitz
    outdir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(path)
    outs = []
    for i, pg in enumerate(doc):
        pix = pg.get_pixmap(matrix=fitz.Matrix(dpi / 72, dpi / 72), alpha=False)
        q = outdir / f'page-{i+1}.png'
        pix.save(str(q))
        outs.append(q)
    return outs


def qr_decode(paths):
    import cv2
    vals=[]; det=cv2.QRCodeDetector()
    for path in paths:
        im=cv2.imread(str(path))
        if im is None: continue
        H,W=im.shape[:2]
        crops=[(0,0,1,1),(0,0,.55,1),(.45,0,1,1),(0,0,1,.6),(0,.4,1,1)] + [(x0,y0,x1,y1) for y0,y1 in [(0,.5),(.45,1)] for x0,x1 in [(0,.38),(.31,.69),(.62,1)]]
        for x0,y0,x1,y1 in crops:
            r=im[int(y0*H):int(y1*H),int(x0*W):int(x1*W)]
            if not r.size: continue
            scale=min(1.0,1000/min(r.shape[:2])); r=cv2.resize(r,None,fx=scale,fy=scale) if scale<1 else r
            try:
                ok, infos, _, _ = det.detectAndDecodeMulti(r)
                if ok:
                    for x in infos:
                        if x and x not in vals: vals.append(x)
                x,_,_=det.detectAndDecode(r)
                if x and x not in vals: vals.append(x)
            except Exception:
                pass
    return vals


def qa():
    from bs4 import BeautifulSoup
    from pypdf import PdfReader
    from playwright.sync_api import sync_playwright

    QA.mkdir(parents=True, exist_ok=True)
    server, log = start_server(8000)
    base='http://127.0.0.1:8000/'
    r={
        'product':'DPRO 造園・外構', 'product_number':53, 'fix':'CENTRAL REAUDIT FIX R1',
        'widths':WIDTHS, 'responsive':{}, 'static':{}, 'runtime':{}, 'pdf':{}, 'qr':{},
        'blockers':[], 'status':'FAIL'
    }
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            for name in TARGET_PAGES:
                r['responsive'][name]={}
                for w in WIDTHS:
                    page=browser.new_page(viewport={'width':w,'height':900})
                    page_errors=[]; request_failed=[]; console_errors=[]
                    page.on('pageerror',lambda e,a=page_errors:a.append(str(e)))
                    page.on('requestfailed',lambda q,a=request_failed:a.append({'url':q.url,'failure':q.failure}))
                    page.on('console',lambda m,a=console_errors:a.append(m.text) if m.type=='error' else None)
                    page.goto(base+name,wait_until='networkidle')
                    m=page_metrics(page)
                    m['page_errors']=page_errors; m['request_failed']=request_failed; m['console_errors']=console_errors
                    r['responsive'][name][str(w)]=m
                    if m['overflow']!=0 or m['badHeadings'] or m['dlineWrap'] or m['orphans'] or m['compoundSplits'] or page_errors or request_failed or console_errors:
                        r['blockers'].append(f'RESPONSIVE_WRAP:{name}:{w}:{m}')
                    if name=='product-site.html' and w in (390,1440):
                        screenshot(page,QA/f'DPRO53_PRODUCT_SITE_{w}.png')
                    if name=='lp.html' and w in (390,1440):
                        page.locator('#p9').scroll_into_view_if_needed()
                        page.wait_for_function("document.querySelector('#p9 iframe') !== null")
                        page.wait_for_timeout(900)
                        page.evaluate("scrollTo(0,0)")
                        page.wait_for_timeout(100)
                        screenshot(page,QA/f'DPRO53_LP_{w}.png')
                    page.close()

            product=BeautifulSoup((SITE/'product-site.html').read_text(encoding='utf-8'),'html.parser')
            r['static']['product_dline_pc']=[x.get_text(strip=True) for x in product.select('.hero h1 .dline-pc')]
            r['static']['product_dline_mobile']=[x.get_text(strip=True) for x in product.select('.hero h1 .dline-mobile')]
            product_ok=(
                '現調・見積・施工・' in r['static']['product_dline_pc'] and
                '完了承認まで。' in r['static']['product_dline_pc'] and
                '現場カルテへ。' in r['static']['product_dline_mobile']
            )
            r['static']['product_semantic_headline']=product_ok
            if not product_ok: r['blockers'].append('PRODUCT_SEMANTIC_HEADLINE')

            a4=BeautifulSoup((SITE/'a4-flyer.html').read_text(encoding='utf-8'),'html.parser')
            r['static']['a4_dlines']=[x.get_text(strip=True) for x in a4.select('.hero h1 .dline')]
            r['static']['a4_stage']=bool(a4.select_one('.sheet-stage'))
            a4_ok=(r['static']['a4_dlines']==['写真だけじゃない。','相談・現調・見積から','施工完了まで、','ひとつにつなぐ。'] and r['static']['a4_stage'])
            r['static']['a4_semantic_headline']=a4_ok
            if not a4_ok: r['blockers'].append('A4_SEMANTIC_HEADLINE')

            lp=BeautifulSoup((SITE/'lp.html').read_text(encoding='utf-8'),'html.parser')
            secs=[lp.select_one(f'#p{i}') for i in range(1,11)]
            r['static']['lp_sections_1_10']=all(secs)
            p1img=lp.select_one('#p1 img'); p10img=lp.select_one('#p10 img')
            r['static']['lp_p1_photo']=p1img.get('src') if p1img else None
            r['static']['lp_p10_photo']=p10img.get('src') if p10img else None
            p4=lp.select_one('#p4 .connected .flow')
            r['static']['lp_p4_diagram']=bool(p4 and len(p4.select('.flow-box'))==3 and len(p4.select('.arrow'))==2)
            if not (r['static']['lp_sections_1_10'] and r['static']['lp_p1_photo']=='landscape-hero.jpg' and r['static']['lp_p10_photo']=='landscape-consult.jpg' and r['static']['lp_p4_diagram']):
                r['blockers'].append('LP_P1_P4_P10')

            page=browser.new_page(viewport={'width':1440,'height':900})
            errs=[]; failed=[]; cons=[]
            page.on('pageerror',lambda e:errs.append(str(e)))
            page.on('requestfailed',lambda q:failed.append({'url':q.url,'failure':q.failure}))
            page.on('console',lambda m:cons.append(m.text) if m.type=='error' else None)
            page.goto(base+'lp.html#p9',wait_until='networkidle')
            page.wait_for_timeout(500)
            p9=page.locator('#p9')
            iframe=p9.locator('iframe')
            iframe_count=iframe.count()
            iframe_src=iframe.first.get_attribute('src') if iframe_count else None
            frame_urls=[f.url for f in page.frames]
            owner_frames=[f for f in page.frames if f.url.endswith('/owner.html')]
            owner_text=(owner_frames[0].locator('body').inner_text(timeout=5000).strip() if owner_frames else '')
            p9_ok=(p9.count()==1 and iframe_count>=1 and bool(owner_frames) and len(owner_text)>20)
            r['runtime']['lp_p9_current_live']={'pass':p9_ok,'iframe_src':iframe_src,'frame_urls':frame_urls,'owner_text_chars':len(owner_text),'errors':errs,'request_failed':failed,'console_errors':cons}
            if not p9_ok or errs or failed or cons: r['blockers'].append('LP_P9_LIVE')
            page.close()

            page=browser.new_page(viewport={'width':390,'height':844})
            errs=[];failed=[];cons=[]
            page.on('pageerror',lambda e:errs.append(str(e)))
            page.on('requestfailed',lambda q:failed.append({'url':q.url,'failure':q.failure}))
            page.on('console',lambda m:cons.append(m.text) if m.type=='error' else None)
            page.goto(base+'guide-center.html',wait_until='networkidle')
            guide_link=page.locator('a[href="tutorial.html"]').count()>=1
            page.goto(base+'tutorial.html',wait_until='networkidle')
            steps=page.evaluate("typeof STEPS!=='undefined' ? STEPS.length : -1")
            start=page.get_by_role('button',name='Start',exact=True).count()>=1
            resume=page.get_by_role('button',name='Resume',exact=True).count()>=1
            replay=page.get_by_role('button',name='Replay',exact=True).count()>=1
            tut_ok=(guide_link and steps==10 and start and resume and replay and not errs and not failed and not cons)
            r['runtime']['tutorial_guide_regression']={'pass':tut_ok,'steps':steps,'guide_link':guide_link,'start':start,'resume':resume,'replay':replay,'errors':errs,'request_failed':failed,'console_errors':cons}
            if not tut_ok: r['blockers'].append('TUTORIAL_GUIDE_REGRESSION')
            page.close()

            pdf_generate_a4(browser,base)
            browser.close()

        pdf_defs={
            'a4':(SITE/'DPRO_LANDSCAPE_EXTERIOR_A4_FLYER_MASTER_V2.0_20260904.pdf',1),
            'quick':(SITE/'DPRO_LANDSCAPE_EXTERIOR_QUICK_START_MASTER_V1.1_20260904.pdf',3),
            'manual':(SITE/'DPRO_LANDSCAPE_EXTERIOR_DETAILED_MANUAL_MASTER_V1.1_20260904.pdf',9),
        }
        for key,(path,pages_expected) in pdf_defs.items():
            if not path.exists():
                r['blockers'].append(f'PDF_MISSING:{key}'); continue
            pages=len(PdfReader(str(path)).pages)
            renders=render_pdf(path,QA/f'render-{key}')
            decoded=qr_decode(renders)
            qr_ok=EXPECTED_QR[key].issubset(set(decoded))
            r['pdf'][key]={'file':path.name,'pages':pages,'bytes':path.stat().st_size,'expected_pages':pages_expected}
            r['qr'][key]={'decoded':decoded,'expected':sorted(EXPECTED_QR[key]),'pass':qr_ok}
            if pages!=pages_expected or not qr_ok:
                r['blockers'].append(f'PDF_QR:{key}')
            if key=='a4' and renders:
                shutil.copy2(renders[0],QA/'DPRO53_A4_FINAL_RENDER.png')

        r['visual_evidence']={
            'a4':'DPRO53_A4_FINAL_RENDER.png',
            'product_1440':'DPRO53_PRODUCT_SITE_1440.png',
            'product_390':'DPRO53_PRODUCT_SITE_390.png',
            'lp_1440':'DPRO53_LP_1440.png',
            'lp_390':'DPRO53_LP_390.png',
        }
        r['status']='PASS' if not r['blockers'] else 'FAIL'
        (SITE/'.dpro53-fix-r1-ok.txt').write_text('DPRO53 CENTRAL FIX R1 '+r['status']+'\n',encoding='utf-8')
        (QA/'FINAL_QA_REPORT.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')
        md=[
            '# DPRO 53 造園・外構 / CENTRAL REAUDIT FIX R1',
            f"- Result: **{r['status']}**",
            f"- Blockers: {len(r['blockers'])}",
            '- Required viewports: 375 / 390 / 430 / 768 / 1280 / 1440',
            '- Horizontal overflow: blocking at every required viewport',
            '- Semantic .dline wrap: measured from rendered character line positions',
            '- One-character orphan: blocking',
            '- Japanese compound split: blocking',
            '- P1/P10 photo: checked',
            '- P4 diagram: checked',
            '- P9 current LIVE screen: checked against owner.html frame',
            '- Runtime console/request/page errors: blocking',
            '- A4 PDF: A4 portrait / one page / regenerated after FIX R1',
            '- Tutorial / Guide / Quick Start / Detailed Manual: regression checked',
        ]
        if r['blockers']:
            md += ['', '## Blockers'] + ['- '+x for x in r['blockers']]
        (QA/'FINAL_QA_REPORT.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
        if r['blockers']:
            raise SystemExit('QA FAIL: '+repr(r['blockers']))
        print('DPRO53 CENTRAL FIX R1 QA PASS')
    finally:
        server.terminate()
        try: server.wait(timeout=5)
        except Exception: server.kill()
        log.close()


def artifact():
    d=ROOT/'artifact-dpro53-fix-r1'
    shutil.rmtree(d,ignore_errors=True)
    (d/'site-final').mkdir(parents=True)
    (d/'reports').mkdir(parents=True)
    for rel in SITE_FINAL:
        src=SITE/rel
        if not src.exists(): raise RuntimeError('missing final artifact file '+rel)
        dst=d/'site-final'/rel
        dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(src,dst)
    for p in QA.rglob('*'):
        if p.is_file():
            rel=p.relative_to(QA)
            dst=d/'reports'/rel
            dst.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(p,dst)
    print('ARTIFACT R1 READY',d)


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('command',choices=['patch','validate-workflows','qa','artifact'])
    a=ap.parse_args()
    {'patch':patch,'validate-workflows':validate_workflows,'qa':qa,'artifact':artifact}[a.command]()


if __name__=='__main__':
    main()
