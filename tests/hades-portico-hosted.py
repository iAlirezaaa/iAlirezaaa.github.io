from pathlib import Path
import urllib.request,time,hashlib,json
root=Path("hades")
paths=["library/portico-studies/index.html","fa/library/portico-studies/index.html"]+[
f"library/portico-studies/HADES_Portico_{mode}_{lang}_REVIEW.svg"
for mode in ["Classic","Modern"] for lang in ["EN","FA"]]
out=[]
for p in paths:
 expected=(root/p).read_bytes()
 url="https://ialirezaaa.github.io/hades/"+p
 for attempt in range(18):
  try:
   req=urllib.request.Request(url,headers={"Cache-Control":"no-cache"})
   with urllib.request.urlopen(req,timeout=20) as response:
    body=response.read(); mime=response.headers.get("Content-Type","");code=response.status
   if code==200 and expected==body and (("svg+xml" in mime) if p.endswith(".svg") else ("html" in mime)):
    break
  except Exception as e:
   print("retry",attempt,url,str(e))
  if attempt==17:raise RuntimeError("OPEN/FAIL public-site GET/MIME/SHA "+url)
  time.sleep(15)
 checksum=hashlib.sha256(body).hexdigest()
 out.append({"url":url,"http":code,"mime":mime,"sha256":checksum})
 print("PUBLIC HTTP PASS",p,code,mime,checksum)
Path("hades-portico-qa").mkdir(exist_ok=True)
Path("hades-portico-qa/hosted-evidence.json").write_text(json.dumps(out,indent=2))
