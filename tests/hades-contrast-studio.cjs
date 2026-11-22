// HADES Contrast Studio / browser QA / REVIEW
// Executed against the exact committed website files served from a local test HTTP server.
const http=require("node:http"),fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium}=require("playwright-core");
const root=path.resolve(__dirname,".."),screens=path.join(root,"hades-contrast-studio-proof");
fs.mkdirSync(screens,{recursive:true});
const types={".html":"text/html",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg"};
const server=http.createServer((req,res)=>{try{
 let p=decodeURIComponent(new URL(req.url,"http://localhost").pathname);if(p.endsWith("/"))p+="index.html";
 const f=path.resolve(root,"."+p);if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 if(!fs.existsSync(f)||!fs.statSync(f).isFile())return res.writeHead(404).end();
 res.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});res.end(fs.readFileSync(f));
}catch(e){res.writeHead(500).end(String(e))}});
(async()=>{
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 const base="http://127.0.0.1:"+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:["--no-sandbox"]});
 try{
 let n=0;
 for(const locale of ["en","fa"])for(const width of [320,390,430]){
  const page=await browser.newPage({viewport:{width,height:860},deviceScaleFactor:1});
  let issues=[];page.on("pageerror",e=>issues.push(e.message));page.on("requestfailed",r=>issues.push(r.url()+" "+r.failure()?.errorText));
  const route="/hades/"+(locale==="fa"?"fa/":"")+"library/tools/contrast-studio/";
  const response=await page.goto(base+route,{waitUntil:"networkidle",timeout:30000});
  assert.equal(response.status(),200);
  const before=await page.evaluate(()=>{
   const bg=document.querySelector("#backdrop"),mark=document.querySelector("#logo-plate img");
   return {lang:document.documentElement.lang,dir:document.documentElement.dir,
     bgReady:bg.complete&&bg.naturalWidth>0,markReady:mark.complete&&mark.naturalWidth>0,
     plate:getComputedStyle(document.querySelector("#logo-plate")).backgroundColor,
     overflow:document.documentElement.scrollWidth-innerWidth,
     title:document.querySelector("#preview-title").textContent,
     guide:document.querySelector("#guide-download").getAttribute("href")};
  });
  assert.equal(before.lang,locale);assert.equal(before.dir,locale==="fa"?"rtl":"ltr");
  assert.ok(before.bgReady,"source background did not render");
  assert.ok(before.markReady,"source original mark not decoded");
  assert.equal(before.plate,"rgb(22, 21, 20)","original mark requires independent dark plate");
  assert.ok(before.overflow<=1,"page overflow "+JSON.stringify(before));
  assert.ok(before.guide.endsWith("HADES_Safe_Field_Guide_16x9_REVIEW.svg"));
  await page.locator("#headline").fill(locale==="fa"?"آزمون فارسی":"Test layout / verified");
  assert.equal(await page.locator("#preview-title").innerText(),locale==="fa"?"آزمون فارسی":"Test layout / verified");
  await page.locator("#family").selectOption("apertures");
  await page.locator("#ratio").selectOption("portrait");
  await page.waitForFunction(()=>document.querySelector("#backdrop").complete&&document.querySelector("#backdrop").naturalWidth>0);
  let mid=await page.evaluate(()=>({src:document.querySelector("#backdrop").getAttribute("src"),ratio:document.querySelector("#stage").dataset.ratio,guide:document.querySelector("#guide-download").getAttribute("href"),overflow:document.documentElement.scrollWidth-innerWidth}));
  assert.ok(mid.src.endsWith("HADES_Aperture_Vestibule_9x16_REVIEW.svg"));
  assert.equal(mid.ratio,"portrait");assert.ok(mid.guide.endsWith("9x16_REVIEW.svg"));assert.ok(mid.overflow<=1);
  await page.locator("#ratio").selectOption("square");
  await page.waitForFunction(()=>document.querySelector("#backdrop").complete&&document.querySelector("#backdrop").naturalWidth>0);
  assert.ok((await page.locator("#guide-download").getAttribute("href")).endsWith("1x1_REVIEW.svg"));
  await page.locator("#guides").uncheck();
  assert.equal(await page.locator("#safe").evaluate(x=>x.hidden),true);
  await page.locator("#mark").uncheck();
  assert.equal(await page.locator("#logo-plate").evaluate(x=>x.hidden),true);
  await page.locator("#mark").check();
  assert.equal(await page.locator("#logo-plate").evaluate(x=>x.hidden),false);
  const guidePaths=["16x9","9x16","1x1"];
  for(const size of guidePaths){
   const r=await page.request.get(base+"/hades/library/tools/contrast-studio/assets/HADES_Safe_Field_Guide_"+size+"_REVIEW.svg");
   assert.equal(r.status(),200);assert.ok((await r.text()).includes('xmlns="http://www.w3.org/2000/svg"'));
  }
  await page.emulateMedia({media:"print"});
  assert.equal(await page.locator("#control-panel").evaluate(x=>getComputedStyle(x).display),"none");
  await page.emulateMedia({media:"screen"});
  await page.screenshot({path:path.join(screens,locale+"-"+width+".png"),fullPage:true});
  assert.deepEqual(issues,[],"browser errors");
  console.log("CHROMIUM PASS",locale,width,"original mark loaded, 3 ratios, palette/plate valid, links and print CSS; overflow <=1");
  await page.close();n++;
 }
 assert.equal(n,6);
 console.log("HADES Contrast Studio 6/6 Chromium local HTTP QA complete. Hosted HTTP, actual phone, print and Mikhak: OPEN.");
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
