import base64, hashlib, re, time, urllib.request
from pathlib import Path
base=Path('hades/library/backgrounds/quiet-courts/closing-cards')
sub=base/'motion-safe'
paths=[sub/f'HADES_Motion_Safe_Closing_{l}_16x9_PUBLIC_REVIEW.svg' for l in ('EN','FA')]
paths += [sub/'index.html',Path(str(sub).replace('hades/','hades/fa/',1))/'index.html',base/'index.html',Path(str(base).replace('hades/','hades/fa/',1))/'index.html']
for p in paths:
    assert p.read_bytes()==(Path('site/public')/p).read_bytes(), p
    if p.suffix=='.svg':
        data=re.search(rb'data:image/png;base64,([A-Za-z0-9+/=]+)',p.read_bytes()).group(1)
        assert hashlib.sha256(base64.b64decode(data)).hexdigest()=='79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7'
    for attempt in range(24):
        try:
            url='https://ialirezaaa.github.io/'+str(p).removesuffix('index.html')
            req=urllib.request.Request(url+'?review='+hashlib.sha256(p.read_bytes()).hexdigest()[:12],headers={'Cache-Control':'no-cache','User-Agent':'HADES REVIEW QA'})
            with urllib.request.urlopen(req,timeout=15) as response:
                assert response.status==200
                assert response.headers.get_content_type()==('image/svg+xml' if p.suffix=='.svg' else 'text/html')
                assert hashlib.sha256(response.read()).digest()==hashlib.sha256(p.read_bytes()).digest()
            print('PASS HTTP 200 MIME SHA256',url,flush=True)
            break
        except Exception as e:
            if attempt==23: raise
            print('Retry',p,attempt,str(e),flush=True)
            time.sleep(10)
print('PASS independent hosted URLs',len(paths))
