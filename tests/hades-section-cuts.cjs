// HADES Section Cuts / PUBLIC REVIEW — real Chromium, local repository checkout, NOT physical phone.
const {chromium}=require('playwright-core');const fs=require('fs');const path=require('path');const assert=require('assert/strict');const {pathToFileURL}=require('url');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'hades-section-cuts-QA');fs.mkdirSync(OUT,{recursive:true});
const names=['HADES_Section_Cut_Cantilever_16x9_REVIEW.svg','HADES_Section_Cut_Sunken_Gallery_9x16_REVIEW.svg','HADES_Section_Cut_Suspended_Lintel_1x1_REVIEW.svg'];
const dim=[[1920,1080],[1080,1920],[1080,1080]];
for(let i=0;i<3;i++){
 const rel='library/backgrounds/assets/'+names[i];const a=fs.readFileSync(path.join(ROOT,'hades',rel),'utf8'),b=fs.readFileSync(path.join(ROOT,'site/public/hades',rel),'utf8');
 assert.equal(a,b,'source/served mismatch '+rel);assert.ok(a.includes('width="'+dim[i][0]+'" height="'+dim[i][1]+'"'),'dimensions '+rel);
 assert.ok(a.includes('PUBLIC REVIEW')&&a.includes('#EF4B32')&&!a.includes('<image'),'no logo re-render / provenance');
}
for(let rel of ['library/backgrounds/section-cuts/index.html','fa/library/backgrounds/section-cuts/index.html','library/backgrounds/section-cuts/README_PUBLIC_REVIEW.md',...['library/backgrounds/index.html','fa/library/backgrounds/index.html','library/index.html','fa/library/index.html','brand-kit/logo-usage/index.html','fa/brand-kit/logo-usage/index.html','index.html','fa/index.html','library/neutral-atlas/index.html','fa/library/neutral-atlas/index.html']]){
 const a=fs.readFileSync(path.join(ROOT,'hades',rel));const b=fs.readFileSync(path.join(ROOT,'site/public/hades',rel));assert.ok(a.equals(b),'source/served mismatch '+rel);
 if(rel.endsWith('index.html')&&!rel.includes('section-cuts/'))assert.ok(a.toString().includes('hades-section-cuts-review'),'missing nav '+rel);
}
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});const report=[];
try{
 for(let locale of ['en','fa'])for(let width of [320,390,430]){
  const page=await browser.newPage({viewport:{width,height:830},deviceScaleFactor:1});
  const rel=locale==='fa'?'fa/library/backgrounds/section-cuts/index.html':'library/backgrounds/section-cuts/index.html';
  await page.goto(pathToFileURL(path.join(ROOT,'hades',rel)).href,{waitUntil:'load'});
  assert.equal(await page.locator('html').getAttribute('lang'),locale);
  assert.equal(await page.locator('.study').count(),3);
  assert.equal(await page.locator('img').count(),3);
  const img=await page.locator('.preview img').evaluateAll(els=>els.map(e=>({ok:e.complete&&e.naturalWidth>0,w:e.naturalWidth,h:e.naturalHeight})));
  assert.ok(img.every((x,i)=>x.ok&&x.w===dim[i][0]&&x.h===dim[i][1]),'SVG decoding/dimensions '+JSON.stringify(img));
  for(const a of await page.locator('.study .download').all()){
    const href=await a.getAttribute('href');assert.ok(href.includes('library/backgrounds/assets/')||href.startsWith('../assets/'));
    const resolved=path.resolve(path.dirname(path.join(ROOT,'hades',rel)),href);assert.ok(fs.existsSync(resolved),resolved);
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);assert.equal(overflow,false,'horizontal overflow '+locale+' '+width);
  await page.screenshot({path:path.join(OUT,locale+'-'+width+'.png'),fullPage:true});
  report.push({locale,width,image_decode_3_of_3:true,no_overflow:true,links_3_of_3:true});await page.close();
 }
 console.log('SECTION CUTS real Chromium PASS 6/6');fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify({scope:'Local Chromium, NOT physical device; hosted HTTP independent',status:'PASS',report},null,2));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
