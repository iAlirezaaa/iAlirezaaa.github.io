// HADES Contrast Studio REVIEW / independent hosted HTTPS proof
// Only success when published site returns exact bytes, correct MIME and HTTP 200.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"..");
const paths=[
"/hades/library/tools/contrast-studio/index.html",
"/hades/fa/library/tools/contrast-studio/index.html",
"/hades/library/tools/contrast-studio/assets/HADES_Safe_Field_Guide_16x9_REVIEW.svg",
"/hades/library/tools/contrast-studio/assets/HADES_Safe_Field_Guide_9x16_REVIEW.svg",
"/hades/library/tools/contrast-studio/assets/HADES_Safe_Field_Guide_1x1_REVIEW.svg",
"/hades/assets/IMG_7187(2).png",
"/hades/library/index.html",
"/hades/fa/library/index.html",
"/hades/brand-kit/logo-usage/index.html",
"/hades/fa/brand-kit/logo-usage/index.html"
];
const mime={".html":"text/html",".svg":"image/svg+xml",".png":"image/png"};
const hash=b=>crypto.createHash("sha256").update(b).digest("hex");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function audit(){
 let checked=0;
 for(const route of paths){
  const file=path.join(root,route.slice(1)),local=fs.readFileSync(file),url="https://ialirezaaa.github.io"+route+"?qa_source="+hash(local).slice(0,12);
  const resp=await fetch(url,{cache:"no-store",redirect:"follow",headers:{"Cache-Control":"no-cache"},signal:AbortSignal.timeout(15000)});
  if(resp.status!==200)throw Error("HTTP "+resp.status+" "+route);
  const type=resp.headers.get("content-type")||"";
  if(!type.toLowerCase().includes(mime[path.extname(file)]))throw Error("MIME "+type+" "+route);
  const remote=Buffer.from(await resp.arrayBuffer());
  if(hash(local)!==hash(remote))throw Error("BYTE HASH "+route+" expected "+hash(local)+" got "+hash(remote));
  console.log("LIVE PASS",route,"HTTP 200",type,remote.length+" bytes",hash(remote).slice(0,16));checked++;
 }
 assert.equal(checked,paths.length);
 console.log("HADES LIVE HTTPS PASS 10/10 URL 200 MIME SHA256 byte-exact; does not prove print, device or Mikhak.");
}
(async()=>{
 let last=null;
 for(let attempt=1;attempt<=12;attempt++){
  try{console.log("Hosted release attempt",attempt,"/12");await audit();return;}
  catch(e){last=e;console.error("RELEASE OPEN attempt",attempt,e.message);if(attempt<12)await sleep(12000);}
 }
 throw last;
})().catch(e=>{console.error("HOSTED QA FAILED",e);process.exitCode=1});
