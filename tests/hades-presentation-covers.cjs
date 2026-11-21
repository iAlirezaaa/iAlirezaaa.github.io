const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright-core');
(async()=>{
 const exe=process.env.CHROME_PATH||'/usr/bin/google-chrome';
 const browser=await chromium.launch({headless:true,executablePath:exe,args:['--no-sandbox']});
 const root=path.resolve('hades-presentation-cover-qa-proof');fs.mkdirSync(root,{recursive:true});
 const mirrors=['hades/library/tools/presentation-covers/','site/public/hades/library/tools/presentation-covers/'];
 const names=['HADES_Presentation_Cover_Classic_EN_REVIEW.svg','HADES_Presentation_Cover_Modern_FA_REVIEW.svg'];
 const results=[];
 try{
  for(const name of names){
   const a=fs.readFileSync(path.join(mirrors[0],name));
   const b=fs.readFileSync(path.join(mirrors[1],name));
   assert.deepEqual(a,b,'source mirror SVG bytes');
   assert.match(a.toString('utf8'),/viewBox="0 0 1920 1080"/);
   for(const id of ['project-title','project-type','project-note'])assert.ok(a.toString('utf8').includes('id="'+id+'"'));
  }
  for(const mirror of mirrors)for(const width of [320,390,430]){
   const prefix=(mirror.startsWith('hades/')?'published':'source')+'-'+width;
   const context=await browser.newContext({viewport:{width,height:850},acceptDownloads:true});
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.resolve(mirror,'index.html')).href,{waitUntil:'load'});
   await page.locator('.card img').first().waitFor();
   const visual=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,images:[...document.querySelectorAll('.card img')].map(i=>i.complete&&i.naturalWidth>0)}));
   assert.ok(visual.scroll<=visual.client+1,'horizontal scroll '+prefix+JSON.stringify(visual));
   assert.deepEqual(visual.images,[true,true],'actual SVG images loaded '+prefix);
   for(let i=0;i<2;i++){
    const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('a.download').nth(i).click()]);
    const filename=dl.suggestedFilename();
    assert.equal(filename,names[i]);
    const saved=path.join(root,prefix+'-'+filename);
    await dl.saveAs(saved);
    assert.deepEqual(fs.readFileSync(saved),fs.readFileSync(path.join(mirror,names[i])),'download bytes '+prefix);
   }
   assert.deepEqual(errors,[],'page JS errors '+prefix);
   await page.screenshot({path:path.join(root,prefix+'.png'),fullPage:true});
   results.push({mirror,width,visual,status:'PASS'});
   await context.close();
  }
  assert.equal(results.length,6);
  fs.writeFileSync(path.join(root,'qa.json'),JSON.stringify({status:'PASS',viewports:[320,390,430],cases:results,open:['live public HTTP','licensed Mikhak','native device','printer/rights signoff']},null,2));
  console.log('HADES PRESENTATION COVER exact-source Chromium 6/6 PASS');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
