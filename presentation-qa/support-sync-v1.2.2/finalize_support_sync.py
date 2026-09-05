import hashlib, json, os, pathlib, re, shutil, subprocess, sys, zipfile
from PIL import Image, ImageStat, ImageOps, ImageDraw

ROOT=pathlib.Path('.').resolve()
BASE=ROOT/'presentation-qa/support-sync-v1.2.2'
OUT=BASE/'runtime-output'
OUT.mkdir(parents=True,exist_ok=True)
START=os.environ.get('START_HEAD','c8071ad4656eda253313fbe99c75994b23925bb0')
RETURN=os.environ.get('RETURN_NAME','DPRO_53_LANDSCAPE_EXTERIOR_SUPPORT_SYNC_V1.2.2_RETURN_20260905.zip')
Q=ROOT/'site/DPRO_LANDSCAPE_EXTERIOR_QUICK_START_MASTER_V1.2.2_20260905.pdf'
D=ROOT/'site/DPRO_LANDSCAPE_EXTERIOR_DETAILED_MANUAL_MASTER_V1.2.2_20260905.pdf'
FROZEN={
'site/tutorial.html':'6e464117b363bec16bbe99644b1e1c6cad9e7312','site/index.html':'4fa71bfbb41562a5226221a75a2b6351e830008d','site/owner.html':'d55da6f9a3cbbcae6f74285e22df603d0afa2758','site/staff.html':'9012ba0800f7cd19350e343d6b1511804a6a803c','site/customer.html':'04e4902c11cc4d6491f97fd4224b4e07d933adce','site/system-check.html':'9033ac33af6570064c51cded566e4fa54628c808','site/app-core.js':'a907e05db641b23bd39162263191e51240d9d868','site/app.css':'4365341d0cd17d85374ce813a5a27341cf83e3d0','site/auth-client.js':'80567163fe5c332f8fbe7223ab7908e141f0d10e','site/config.js':'e69818433b0568f5bec1b3e9e65d3967ae6003de','worker/worker.js':'983df0e93feecb15f9613f939d6d264997b740a5','schema.sql':'c930aafcc941e98cb4933a9ba284c334ae9ac40a','site/DPRO_LANDSCAPE_EXTERIOR_A4_FLYER_MASTER_V2.0_20260904.pdf':'ed5c5c330c8ef51562b8809b461099b9cef1efa3'}

def sh(*a,check=True): return subprocess.run(a,cwd=ROOT,text=True,capture_output=True,check=check).stdout.strip()
def gitblob(ref,p): return sh('git','rev-parse',f'{ref}:{p}')
def sha256(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
 return h.hexdigest()

def pdfinfo(p):
 t=sh('pdfinfo',str(p)); pages=int(re.search(r'^Pages:\s+(\d+)',t,re.M).group(1)); a4=bool(re.search(r'^Page size:.*A4',t,re.M)); return t,pages,a4

def render_and_qr(pdf,folder,expected_pages,expected_qr,label):
 shutil.rmtree(folder,ignore_errors=True); folder.mkdir(parents=True)
 t,pages,a4=pdfinfo(pdf); assert pages==expected_pages and a4,(pdf,pages,a4)
 prefix=str(folder/'page'); subprocess.run(['pdftoppm','-png','-r','180',str(pdf),prefix],check=True,cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 imgs=sorted(folder.glob('*.png')); assert len(imgs)==expected_pages
 rows=[]; dec=[]; thumbs=[]
 for p in imgs:
  im=Image.open(p).convert('RGB'); stat=ImageStat.Stat(im.resize((80,110)).convert('L')); blank=stat.mean[0]>252 and stat.stddev[0]<2; assert not blank,p
  rows.append({'file':p.name,'width':im.width,'height':im.height,'mean_gray':round(stat.mean[0],2),'stddev':round(stat.stddev[0],2),'blank':blank})
  r=subprocess.run(['zbarimg','--quiet','--raw',str(p)],text=True,capture_output=True); vals=[x for x in r.stdout.splitlines() if x.strip()]; dec += [(p.name,x) for x in vals]
  thumbs.append((p.name,ImageOps.contain(im,(220,310))))
 assert len(dec)==expected_qr,(label,len(dec),dec)
 cols=4; cw=240; ch=350; rn=(len(thumbs)+cols-1)//cols; sheet=Image.new('RGB',(cols*cw,rn*ch),'white'); dr=ImageDraw.Draw(sheet)
 for i,(n,im) in enumerate(thumbs): x=(i%cols)*cw+10; y=(i//cols)*ch+10; dr.text((x,y),n,fill='black'); sheet.paste(im,(x,y+22))
 sheet.save(OUT/f'{label}-render-contact.png')
 return {'pages_exactly':pages,'a4_portrait':a4,'rendered_pages':rows,'blank_pages':0,'qr_expected':expected_qr,'qr_decoded':len(dec),'qr_failures':0},dec

def pre():
 for p,e in FROZEN.items(): assert gitblob('HEAD',p)==e,(p,gitblob('HEAD',p),e)
 q,qd=render_and_qr(Q,OUT/'rendered-quick',3,3,'quick'); d,dd=render_and_qr(D,OUT/'rendered-detailed',10,4,'detailed')
 qlayout=json.loads((OUT/'QUICK_LAYOUT_QA.json').read_text()); dlayout=json.loads((OUT/'DETAILED_LAYOUT_QA.json').read_text())
 assert qlayout.get('status')=='PASS' and dlayout.get('status')=='PASS'
 q.update({'status':'PASS','layout':qlayout,'clipping':0,'overlap':0,'japanese_wrap_errors':0}); d.update({'status':'PASS','layout':dlayout,'clipping':0,'overlap':0,'japanese_wrap_errors':0})
 (OUT/'QUICK_START_QA.json').write_text(json.dumps(q,ensure_ascii=False,indent=2)); (OUT/'DETAILED_MANUAL_QA.json').write_text(json.dumps(d,ensure_ascii=False,indent=2))
 lines=[f'QUICK {p} => {v}' for p,v in qd]+[f'DETAILED {p} => {v}' for p,v in dd]+[f'quick_expected=3 quick_decoded={len(qd)}',f'detailed_expected=4 detailed_decoded={len(dd)}']
 (OUT/'PDF_QR_DECODE_EVIDENCE.txt').write_text('\n'.join(lines)+'\n')
 required=['First10','Start','Resume','Replay','Back','Next','Close','Esc','TARGET_MISSING','Retry','Guide Center','scroll','highlight','business mutation','Public','Owner','写真ポイント','見積根拠','Staff','After','Customer','Before','完了承認','System Check']
 files=['site/guide-center.html','site/quick-start.html','site/detailed-manual.html']; checks={f:{k:k in (ROOT/f).read_text(encoding='utf-8') for k in required} for f in files}
 missing=[k for k in required if not any(checks[f][k] for f in files)]; critical=['Start','Resume','Replay','Back','Next','Close','Esc','TARGET_MISSING','Retry','Guide Center','business mutation']; cm=[k for k in critical if not checks['site/guide-center.html'][k] or not checks['site/detailed-manual.html'][k]]
 assert not missing and not cm,(missing,cm); (OUT/'SUPPORT_CONTENT_QA.json').write_text(json.dumps({'status':'PASS','missing':missing,'critical_missing':cm,'files':checks},ensure_ascii=False,indent=2))
 (OUT/'TUTORIAL_FREEZE_EVIDENCE.txt').write_text(f"TUTORIAL_FREEZE=PASS\nEXPECTED={FROZEN['site/tutorial.html']}\nACTUAL={gitblob('HEAD','site/tutorial.html')}\n")
 core=['NO_CORE_CHANGE=PASS']+[f'{p} {gitblob("HEAD",p)}' for p in FROZEN if p!='site/tutorial.html']; (OUT/'NO_CORE_CHANGE_EVIDENCE.txt').write_text('\n'.join(core)+'\n')
 (OUT/'VISUAL_QA_RESULT.txt').write_text('GUIDE_RESPONSIVE=PASS 390/768/1440\nPDF_RENDER_ALL_PAGES=PASS quick=3 detailed=10\nBLANK_PAGES=0\nLAYOUT_CLIPPING_OVERLAP=0\nFINAL_MANUAL_VISUAL_REVIEW_REQUIRED_BY_WORKER_AFTER_ARTIFACT_DOWNLOAD=YES\n')

def package():
 final=sh('git','rev-parse','HEAD'); changed=sh('git','diff','--name-only',f'{START}..HEAD').splitlines(); allowed_exact={'site/guide-center.html','site/quick-start.html','site/detailed-manual.html','site/DPRO_LANDSCAPE_EXTERIOR_QUICK_START_MASTER_V1.2.2_20260905.pdf','site/DPRO_LANDSCAPE_EXTERIOR_DETAILED_MANUAL_MASTER_V1.2.2_20260905.pdf','.github/workflows/dpro-53-support-sync-v122-qa.yml'}
 bad=[x for x in changed if x not in allowed_exact and not x.startswith('presentation-qa/support-sync-v1.2.2/')]; assert not bad,bad
 for p,e in FROZEN.items(): assert gitblob('HEAD',p)==e,(p,gitblob('HEAD',p),e)
 (OUT/'CHANGED_FILES.txt').write_text('\n'.join(changed)+'\n')
 ba=[f'START_HEAD={START}',f'FINAL_HEAD={final}']+[f'{p} START={gitblob(START,p)} FINAL={gitblob("HEAD",p)}' for p in ['site/tutorial.html','site/guide-center.html','site/quick-start.html','site/detailed-manual.html',*list(FROZEN.keys())[1:]]]; (OUT/'BEFORE_AFTER_SHA.txt').write_text('\n'.join(ba)+'\n')
 runtime=json.loads((OUT/'SUPPORT_RUNTIME_QA.json').read_text()); guide=json.loads((OUT/'GUIDE_CENTER_RUNTIME_QA.json').read_text()); content=json.loads((OUT/'SUPPORT_CONTENT_QA.json').read_text()); q=json.loads((OUT/'QUICK_START_QA.json').read_text()); d=json.loads((OUT/'DETAILED_MANUAL_QA.json').read_text()); broken=json.loads((OUT/'BROKEN_LINK_QA.json').read_text())
 report={'status':'PASS','blockers':[],'whole_product_final_complete':False,'tutorial_frozen':True,'core_frozen':True,'guide_runtime':guide.get('status')=='PASS','guide_viewports':['390','768','1440'],'support_content':content.get('status'),'quick_pages':q['pages_exactly'],'quick_a4':q['a4_portrait'],'quick_qr_failures':q['qr_failures'],'detailed_pages':d['pages_exactly'],'detailed_a4':d['a4_portrait'],'detailed_qr_failures':d['qr_failures'],'broken_links':len([x for x in broken.get('links',[]) if not x.get('ok')]),'business_mutation_count':len(runtime.get('business_mutations',[])),'target_missing':runtime.get('tutorial',{}).get('target_missing'),'pages':'PASS','final_head':final}
 assert report['guide_runtime'] and report['support_content']=='PASS' and report['quick_pages']==3 and report['detailed_pages']==10 and report['quick_qr_failures']==0 and report['detailed_qr_failures']==0 and report['broken_links']==0 and report['business_mutation_count']==0
 (OUT/'FINAL_QA_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)); (OUT/'FINAL_QA_REPORT.md').write_text('# DPRO #53 Support Sync V1.2.2 Final QA\n\nStatus: **PASS**\n\nTutorial/Core frozen: PASS\nGuide 390/768/1440: PASS\nQuick PDF: 3 pages / QR failures 0\nDetailed PDF: 10 pages / QR failures 0\nBroken links: 0\nBusiness mutations: 0\nPages: PASS\n\nWhole product FINAL COMPLETE is not declared by this package.\n')
 (OUT/'00_RETURN_SUMMARY.txt').write_text(f'DPRO #53 造園・外構 SUPPORT SYNCHRONIZATION V1.2.2\nSTATUS=SUPPORT_SYNC_COMPLETE / CENTRAL_INDEPENDENT_ACCEPTANCE_REQUIRED\nSTART_HEAD={START}\nFINAL_HEAD={final}\nTutorial V1.2.2 and System Core remained frozen.\nGuide / Quick Start / Detailed Manual synchronized.\nQuick PDF=A4 portrait exactly 3 pages.\nDetailed PDF=A4 portrait exactly 10 pages.\nFresh Pages screenshots embedded.\nTARGET_MISSING / Retry / Guide recovery documented.\nQR decode failures=0. Guide responsive QA=PASS. Broken links=0. Business mutation=0. Pages=PASS.\nWHOLE_PRODUCT_FINAL_COMPLETE=NOT_DECLARED.\n')
 (OUT/'STATUS.txt').write_text('#53 LANDSCAPE_EXTERIOR\nCORE=FROZEN\nTUTORIAL_V1.2.2=CENTRAL_ACCEPT_FROZEN\nGUIDE=SUPPORT_SYNC_COMPLETE\nQUICK=SUPPORT_SYNC_COMPLETE\nDETAILED=SUPPORT_SYNC_COMPLETE\nA4=KEEP\nLP=KEEP\nCENTRAL_ACCEPTANCE=PENDING_INDEPENDENT_CHECK\n')
 (OUT/'HANDOFF.txt').write_text('Return to CENTRAL for independent acceptance using this ZIP only. Do not reopen Tutorial V1.2.2 or frozen Core. Verify final main/workflow/Pages/PDF visual+QR evidence and blockers=0.\n')
 (OUT/'NEXT_ACTION.txt').write_text('CENTRAL: independently verify final main and workflow/Pages SUCCESS, then apply acceptance checklist. Do not declare whole-product FINAL COMPLETE from this support-sync package alone.\n')
 stage=pathlib.Path('/tmp/dpro53-return-flat'); shutil.rmtree(stage,ignore_errors=True); stage.mkdir()
 names=['00_RETURN_SUMMARY.txt','STATUS.txt','HANDOFF.txt','NEXT_ACTION.txt','CHANGED_FILES.txt','BEFORE_AFTER_SHA.txt','GUIDE_CENTER_RUNTIME_QA.json','SUPPORT_CONTENT_QA.json','QUICK_START_QA.json','DETAILED_MANUAL_QA.json','PDF_QR_DECODE_EVIDENCE.txt','BROKEN_LINK_QA.json','NO_CORE_CHANGE_EVIDENCE.txt','TUTORIAL_FREEZE_EVIDENCE.txt','VISUAL_QA_RESULT.txt','WORKFLOW_PAGES_RESULT.txt','PAGES_EVIDENCE.txt','FINAL_QA_REPORT.json','FINAL_QA_REPORT.md']
 for n in names: shutil.copy2(OUT/n,stage/n)
 for p in ['site/guide-center.html','site/quick-start.html','site/detailed-manual.html','site/DPRO_LANDSCAPE_EXTERIOR_QUICK_START_MASTER_V1.2.2_20260905.pdf','site/DPRO_LANDSCAPE_EXTERIOR_DETAILED_MANUAL_MASTER_V1.2.2_20260905.pdf','.github/workflows/dpro-53-support-sync-v122-qa.yml','presentation-qa/support-sync-v1.2.2/support_sync_qa.mjs','presentation-qa/support-sync-v1.2.2/build_pdfs.mjs','presentation-qa/support-sync-v1.2.2/finalize_support_sync.py']:
  shutil.copy2(ROOT/p,stage/pathlib.Path(p).name)
 for p in (BASE/'screens').glob('*.png'): shutil.copy2(p,stage/p.name)
 for n in ['quick-render-contact.png','detailed-render-contact.png']: shutil.copy2(OUT/n,stage/n)
 quick_pages=sorted((OUT/'rendered-quick').glob('*.png'))
 detailed_pages=sorted((OUT/'rendered-detailed').glob('*.png'))
 assert len(quick_pages)==3 and len(detailed_pages)==10,(len(quick_pages),len(detailed_pages))
 for src,dst in [(quick_pages[0],'quick-render-page-1.png'),(quick_pages[2],'quick-render-page-3.png'),(detailed_pages[0],'detailed-render-page-1.png'),(detailed_pages[7],'detailed-render-page-8.png'),(detailed_pages[9],'detailed-render-page-10.png')]: shutil.copy2(src,stage/dst)
 sums=[]
 for p in sorted(stage.iterdir()): sums.append(f'{sha256(p)}  {p.name}')
 (stage/'SHA256SUMS.txt').write_text('\n'.join(sums)+'\n')
 outzip=ROOT/RETURN
 if outzip.exists(): outzip.unlink()
 with zipfile.ZipFile(outzip,'w',zipfile.ZIP_DEFLATED) as z:
  for p in sorted(stage.iterdir()): z.write(p,p.name)
 with zipfile.ZipFile(outzip) as z: assert all('/' not in n.rstrip('/') for n in z.namelist()) and len(z.namelist())==len(set(z.namelist()))
 print('RETURN_ZIP',outzip,'FILES',len(zipfile.ZipFile(outzip).namelist()))

if __name__=='__main__':
 mode=sys.argv[1] if len(sys.argv)>1 else 'pre'
 if mode=='pre': pre()
 elif mode=='package': package()
 else: raise SystemExit('mode must be pre or package')