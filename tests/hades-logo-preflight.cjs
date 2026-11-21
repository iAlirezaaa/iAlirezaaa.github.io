'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright-core');
const root=process.cwd(),out=path.join(root,'hades-logo-preflight-proof');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);const target=path.resolve(root,rel.endsWith('/')?path.join(rel,'index.html'):rel);if(!target.startsWith(root+path.sep))return res.writeHead(403).end();try{const data=fs.readFileSync(target);res.writeHead(200,{'Content-Type':target.endsWith('.html')?'text/html':'application/octet-stream'});res.end(data)}catch{res.writeHead(404).end()}});
(async()=>{await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const port=server.address().port;const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});let count=0;
try{for(const mirror of ['hades','site/public/hades']){for(const width of [320,390,430]){
const context=await browser.newContext({viewport:{width,height:860},acceptDownloads:true});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+port+'/'+mirror+'/brand-kit/logo-usage/preflight/',{waitUntil:'networkidle'});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'horizontal overflow '+mirror+' '+width);
assert.equal(await page.locator('.proof-image').count(),4);assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.proof-image')].every(x=>x.complete&&x.naturalWidth>0)),true,'Original owner raster failed to load');
await page.locator('#project').fill('Test & <specimen> نمونه');await page.locator('#channel').fill('A4 / app icon');
assert.match(await page.locator('#projectText').innerText(),/Test & <specimen>/);
await page.locator('#mode').selectOption('classic');assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.proof-image')].every(x=>x.src.includes('B3424A5B-3375-4244-806C-EF9EAA60BDD1.jpeg')&&x.naturalWidth>0)),true,'classic source load');
await page.locator('#lang').selectOption('fa');assert.equal(await page.locator('html').getAttribute('dir'),'rtl');assert.match(await page.locator('#sheetTitle').innerText(),/آزمون/);
const [d]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);const file=path.join(out,mirror.replace(/\//g,'_')+'-'+width+'.json');await d.saveAs(file);const data=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(data.status,'REVIEW');assert.equal(data.approval,false);assert.equal(data.device_test,'OPEN');assert.equal(data.mikhak,'OPEN');
assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,mirror.replace(/\//g,'_')+'-'+width+'.png'),fullPage:true});console.log('HADES LOGO PREFLIGHT CHROMIUM PASS',mirror,width);count++;await context.close();
}}
assert.equal(count,6);const ctx=await browser.newContext({viewport:{width:1024,height:800}});const pg=await ctx.newPage();await pg.goto('http://127.0.0.1:'+port+'/hades/brand-kit/logo-usage/preflight/',{waitUntil:'networkidle'});await pg.pdf({path:path.join(out,'HADES_Logo_Scale_Proof_A4_REVIEW.pdf'),format:'A4',preferCSSPageSize:true,printBackground:true});await ctx.close();
console.log('HADES LOGO PREFLIGHT Chromium 6/6 + A4 PDF created');}
finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
