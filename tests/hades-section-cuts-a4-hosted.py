"""Independently check deployed Pages bytes, status and MIME — not a build substitute."""
from pathlib import Path
import hashlib, time, urllib.request, json
base='https://ialirezaaa.github.io/hades/'
root=Path('hades')
prefix='library/backgrounds/section-cuts/'
paths=[
prefix+'HADES_Section_Cuts_A4_Applied_Optical_Proof_REVIEW.svg',
prefix+'print-preflight/index.html','fa/'+prefix+'print-preflight/index.html',
'index.html','fa/index.html','library/index.html','fa/library/index.html',
'brand-kit/logo-usage/index.html','fa/brand-kit/logo-usage/index.html',
prefix+'index.html','fa/'+prefix+'index.html']
# GitHub Pages serves index.html at directory URLs.
def live_url(p): return base+(p[:-10] if p.endswith('/index.html') else p)
records=[]
for attempt in range(1,14):
 try:
  records=[]
  for p in paths:
   url=live_url(p)
   req=urllib.request.Request(url,headers={'User-Agent':'HADES-public-review-a4-byte-verifier/1.0','Cache-Control':'no-cache'})
   with urllib.request.urlopen(req,timeout=25) as resp:
    data=resp.read();status=resp.status;mime=resp.headers.get('Content-Type','').split(';')[0].strip().lower()
   wanted=(root/p).read_bytes()
   assert status==200,(p,'http',status)
   assert data==wanted,(p,'sha256 mismatch',hashlib.sha256(data).hexdigest(),hashlib.sha256(wanted).hexdigest())
   expected='image/svg+xml' if p.endswith('.svg') else 'text/html'
   assert mime==expected,(p,'mime',mime,expected)
   records.append({'path':p,'status':status,'mime':mime,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'url':url})
  print('PASS actual hosted HTTPS',len(records),'of',len(paths),'exact byte and MIME matches on attempt',attempt)
  break
 except Exception as exc:
  print('OPEN live retry',attempt,str(exc),flush=True)
  if attempt==13:raise
  time.sleep(20)
Path('hades-section-cuts-a4-hosted-QA').mkdir(exist_ok=True)
Path('hades-section-cuts-a4-hosted-QA/independent_live_results_REVIEW.json').write_text(json.dumps(records,indent=2),encoding='utf8')
