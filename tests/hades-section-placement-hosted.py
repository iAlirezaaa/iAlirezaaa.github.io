from pathlib import Path
import urllib.request,urllib.error,hashlib,time,json
root=Path.cwd()
paths=['library/backgrounds/section-cuts/placement/'+f for f in [
'HADES_Cantilever_Text_Placement_16x9_REVIEW.svg','HADES_Sunken_Text_Placement_9x16_REVIEW.svg',
'HADES_Lintel_Text_Placement_1x1_REVIEW.svg','README.md','index.html']]
paths.append('fa/library/backgrounds/section-cuts/placement/index.html')
Path('hades-placement-hosted').mkdir(exist_ok=True)
records=[]
for rel in paths:
    expected=(root/'hades'/rel).read_bytes()
    assert expected==(root/'site/public/hades'/rel).read_bytes(),rel
    url='https://ialirezaaa.github.io/hades/'+rel
    match=False
    for attempt in range(6):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'HADES-Placement-Independent-Live-Audit'})
            with urllib.request.urlopen(req,timeout=25) as response:
                code=response.status
                mime=response.headers.get('content-type','')
                data=response.read()
            match=code==200 and data==expected and (mime.startswith('image/svg+xml') if rel.endswith('.svg') else (mime.startswith('text/html') if rel.endswith('.html') else True))
            records.append({'url':url,'attempt':attempt+1,'status':code,'mime':mime,'sha':hashlib.sha256(data).hexdigest(),'expected':hashlib.sha256(expected).hexdigest(),'ok':match})
            if match:break
        except Exception as e:
            records.append({'url':url,'attempt':attempt+1,'error':str(e),'ok':False})
        time.sleep(15)
    print('PASS live' if match else 'FAIL live',url)
    if not match: 
        Path('hades-placement-hosted/report.json').write_text(json.dumps(records,indent=2))
        raise AssertionError('not yet hosted/mime/hash:'+rel)
Path('hades-placement-hosted/report.json').write_text(json.dumps(records,indent=2))
print('PASS',len(paths),'independent HTTPS status/MIME/SHA')
