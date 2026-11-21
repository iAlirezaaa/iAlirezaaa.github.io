'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright-core');
const root=process.cwd(), out=path.join(root,'hades-asset-passport-editor-proof');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\\//,'');
 const target=path.resolve(root,rel.endsWith('/')?path.join(rel,'index.html'):rel);
 if(!target.startsWith(root+path.sep))return res.writeHead(403).end();
 try{const data=fs.readFileSync(target);res.writeHead(200,{'Content-Type':target.endsWith('.html')?'text/html':'application/octet-stream'});res.end(data)}
 catch{res.writeHead(404).end()}
});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const port=server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 let count=0;
 try{
 for(const mirror of ['hades','site/public/hades']){
  for(const width of [320,390,430]){
   const context=await browser.newContext({viewport:{width,height:850},acceptDownloads:true});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const url='http://127.0.0.1:'+port+'/'+mirror+'/library/tools/asset-passport/editor/';
   await page.goto(url,{waitUntil:'networkidle'});
   await page.locator('#editorPreview svg').waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'mobile horizontal overflow');
   assert.equal(await page.locator('#editorPreview svg').getAttribute('viewBox'),'0 0 794 1123');
   const [en]=await Promise.all([page.waitForEvent('download'),page.locator('#saveSvg').click()]);
   const prefix=mirror.replace(/\\//g,'_')+'-'+width;
   const enFile=path.join(out,prefix+'-EN.svg');await en.saveAs(enFile);
   assert.match(fs.readFileSync(enFile,'utf8'),/ASSET PASSPORT/);
   const [j]=await Promise.all([page.waitForEvent('download'),page.locator('#saveJson').click()]);
   const jFile=path.join(out,prefix+'.json');await j.saveAs(jFile);
   const project=JSON.parse(fs.readFileSync(jFile));assert.equal(project.status,'REVIEW');assert.equal(project.language,'en');
   await page.locator('[data-editor-lang="fa"]').click();
   assert.match(await page.locator('#editorPreview svg').textContent(),/شناسنامه/);
   const [fa]=await Promise.all([page.waitForEvent('download'),page.locator('#saveSvg').click()]);
   const faFile=path.join(out,prefix+'-FA.svg');await fa.saveAs(faFile);
   assert.match(fs.readFileSync(faFile,'utf8'),/شناسنامه/);
   await page.locator('#jsonFile').setInputFiles({name:'forged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...project,status:'FINAL'}))});
   await page.waitForFunction(()=>document.getElementById('editorStatus').textContent.includes('OPEN'));
   assert.match(await page.locator('#editorStatus').textContent(),/OPEN/);
   await page.locator('#jsonFile').setInputFiles({name:'safe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
   await page.waitForFunction(()=>document.getElementById('editorStatus').textContent.includes('imported'));
   assert.equal(await page.locator('[data-editor-lang="en"]').getAttribute('aria-pressed'),'true');
   await page.locator('#asset').fill('W'.repeat(60));
   await page.locator('#saveSvg').click();
   assert.match(await page.locator('#editorStatus').innerText(),/OPEN/);
   await page.locator('[data-editor-lang="fa"]').click();
   await page.screenshot({path:path.join(out,prefix+'-REVIEW.png'),fullPage:true});
   assert.deepEqual(errors,[]);
   count++;console.log('HADES EDITOR CHROMIUM PASS',mirror,width);
   await context.close();
  }
 }
 assert.equal(count,6);
 const pdfContext=await browser.newContext({viewport:{width:1024,height:850}});
 const print=await pdfContext.newPage();
 await print.goto('http://127.0.0.1:'+port+'/hades/library/tools/asset-passport/editor/',{waitUntil:'networkidle'});
 await print.pdf({path:path.join(out,'HADES_Asset_Passport_EDITOR_A4_REVIEW.pdf'),format:'A4',preferCSSPageSize:true,printBackground:true});
 await pdfContext.close();
 console.log('HADES EDITOR CHROMIUM 6/6 PASS · SVG/JSON downloads, forged FINAL and overflow rejected');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
