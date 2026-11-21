const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),proof=path.join(root,'hades-backgrounds-proof');
fs.mkdirSync(proof,{recursive:true});
const types={'.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json','.zip':'application/zip'};
const server=http.createServer((req,res)=>{try{
 let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';
 const f=path.resolve(root,'.'+p);
 if(!f.startsWith(root+path.sep))return res.writeHead(403).end();
 if(!fs.existsSync(f)||!fs.statSync(f).isFile())return res.writeHead(404).end();
 res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(fs.readFileSync(f));
}catch(e){res.writeHead(500).end(String(e))}});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});
 try{
 let passed=0;
 for(const locale of ['en','fa'])for(const width of [320,390,430]){
  const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>errors.push(r.url()+' '+r.failure()?.errorText));
  const route=locale==='fa'?'/hades/fa/library/backgrounds/':'/hades/library/backgrounds/';
  const response=await page.goto(base+route,{waitUntil:'networkidle',timeout:30000});
  assert.equal(response.status(),200,'route HTTP');
  // Lazy thumbnails below the fold are not supposed to load until scrolled.
  // Force them eager only for image decoding QA, keeping public lazy-load UX unchanged.
  await page.locator('.tile img').evaluateAll(imgs=>imgs.forEach(img=>{img.loading='eager'}));
  await page.waitForFunction(()=>[...document.querySelectorAll('.tile img')].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:15000});
  const result=await page.evaluate(()=>{
   const images=[...document.querySelectorAll('.tile img')],plate=document.querySelector('.logo-plate'),logo=plate?.querySelector('img');
   return {lang:document.documentElement.lang,dir:getComputedStyle(document.documentElement).direction,tiles:images.length,
    good:images.filter(x=>x.complete&&x.naturalWidth>0&&x.naturalHeight>0&&x.alt.trim()).length,
    overflow:document.documentElement.scrollWidth-innerWidth,plate:getComputedStyle(plate).backgroundColor,
    logo:!!logo&&logo.complete&&logo.naturalWidth>0,review:document.body.innerText.includes('REVIEW'),
    links:[...document.querySelectorAll('a[download]')].map(a=>a.getAttribute('href'))};
  });
  assert.equal(result.tiles,11,'10 original backgrounds plus one distinct original-logo contrast application');
  assert.equal(result.good,11,'11 actually decoded SVG images');
  assert.ok(result.overflow<=1,'horizontal overflow '+JSON.stringify(result));
  assert.ok(result.logo,'unaltered original logo image did not load');
  assert.equal(result.plate,'rgb(24, 22, 21)','white logo must be backed by dark plate');
  assert.equal(result.lang,locale);assert.equal(result.dir,locale==='fa'?'rtl':'ltr');
  assert.ok(result.review,'REVIEW missing');
  for(const stem of ['HADES_Threshold_Portico_16x9_REVIEW','HADES_Threshold_Passage_9x16_REVIEW','HADES_Threshold_Court_1x1_REVIEW','HADES_Quiet_Loggia_16x9_REVIEW','HADES_Bone_Pier_9x16_REVIEW','HADES_Charcoal_Courtyard_1x1_REVIEW'])
   for(const ext of ['svg','png','jpg','webp'])
    assert.ok(result.links.includes('/hades/library/backgrounds/assets/'+stem+'.'+ext),'download missing '+stem+'.'+ext);
  assert.ok(result.links.some(h=>h.endsWith('HADES_Threshold_3_Ratios_SVG_PNG_JPEG_WEBP_REVIEW.zip')),'Threshold pack missing');
  assert.ok(result.links.some(h=>h.endsWith('HADES_Quiet_Spaces_3_Ratios_SVG_PNG_JPEG_WEBP_REVIEW.zip')),'Quiet Spaces pack missing');
  assert.ok(result.links.some(h=>h.endsWith('HADES_Quiet_Spaces_Overview_1600x1000_REVIEW.svg')),'Overview editable SVG link missing');
  assert.ok(result.links.includes('/hades/library/backgrounds/assets/HADES_Original_Logo_Dark_Plate_Contrast_16x9_REVIEW.svg'),'Exact-original contrast application SVG link missing');
  assert.deepEqual(errors,[],'page errors');
  await page.screenshot({path:path.join(proof,locale+'-'+width+'.png'),fullPage:true});
  console.log('CHROMIUM PASS',locale,width,'images '+result.good+'/11','overflow '+result.overflow,'dark plate '+result.plate);
  passed++;await page.close();
 }
 assert.equal(passed,6);console.log('HADES ARCHITECTURAL CHROMIUM PASS 6/6; Mikhak, native phone, print, owner FINAL remain OPEN');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());