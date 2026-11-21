/* HADES EMAIL REVIEW QA — self-contained browser regression, 2026-11-21.
   Checks exact mirrored source served locally; NOT a Gmail/Outlook acceptance test. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright-core');
const root=process.cwd(),evidence=path.resolve('hades-signature-qa-proof');fs.mkdirSync(evidence,{recursive:true});
const htmlPath='hades/library/HADES_Email_Signature_REVIEW.html';
const guidePath='hades/library/tools/email-signature-install/index.html';
const original='hades/assets/IMG_7187(2).png';
for(const f of [htmlPath,guidePath,original]){
 assert(fs.existsSync(path.join(root,f)),'missing '+f);
 assert.equal(fs.readFileSync(path.join(root,f)).toString('hex'),fs.readFileSync(path.join(root,'site/public/'+f)).toString('hex'),'mirror '+f);
}
const mime={'.html':'text/html; charset=utf-8','.png':'image/png','.css':'text/css','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const decoded=decodeURIComponent((req.url||'/').split('?')[0]);
 let p=path.resolve(root,'.'+decoded);
 if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return}
 if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');
 if(!fs.existsSync(p)){res.writeHead(404).end('Not found');return}
 res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');
 res.end(fs.readFileSync(p));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const results=[];const sizes=[320,390,430];
 for(const width of sizes){
  const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,permissions:['clipboard-read','clipboard-write']});
  await context.route('https://ialirezaaa.github.io/hades/assets/**',route=>route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,original))}));
  const page=await context.newPage();await page.goto(base+'/'+htmlPath,{waitUntil:'load'});
  await page.locator('#sig-rich').waitFor();
  await page.locator('#sig-name').fill('Sample HADES '+width);
  await page.locator('#sig-role').fill('Creative producer | تولیدکننده');
  await page.locator('#sig-email').fill('example@example.org');
  const preview=page.locator('.paper table');await preview.waitFor();
  assert((await preview.innerText()).includes('Sample HADES '+width));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'editor overflow '+width);
  assert(await page.evaluate(()=>{const im=document.querySelector('.paper table img');return im&&im.complete&&im.naturalWidth===946}),'owner original not decoded');
  await page.locator('#sig-rich').click();
  assert((await page.locator('#sig-status').innerText()).includes('Rich signature copied'),'rich clipboard failure '+width);
  const clip=await page.evaluate(async()=>{const i=(await navigator.clipboard.read())[0];return await(await i.getType('text/html')).text()});
  assert(clip.includes('<table')&&clip.includes('Sample HADES '+width),'HTML clipboard incomplete');
  await page.locator('#sig-select').click();
  assert((await page.evaluate(()=>getSelection().toString())).includes('Sample HADES '+width),'select rendered failed');
  await page.screenshot({path:path.join(evidence,'signature-'+width+'-REVIEW.png'),fullPage:true});
  // Verify text injection stays escaped in composed HTML, not executable markup.
  await page.locator('#sig-name').fill('<img src=x onerror=alert(1)>');
  assert.equal(await page.locator('.paper table img').count(),1,'injected image');
  const generated=await page.locator('textarea[readonly]').inputValue();
  assert(generated.includes('&lt;img'),'unsafe HTML input '+width);
  await page.locator('#sig-load').setInputFiles({name:'forged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schema:'hades.email.signature.v1',status:'FINAL',lang:'fa',mark:'show',name:'x',role:'x',email:''}))});
  assert((await page.locator('#sig-status').innerText()).includes('Rejected'),'forged FINAL accepted');
  await page.goto(base+'/'+guidePath,{waitUntil:'load'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'guide overflow '+width);
  await page.screenshot({path:path.join(evidence,'guide-'+width+'-REVIEW.png'),fullPage:true});
  if(width===390){const pdf=await page.pdf({path:path.join(evidence,'email-signature-install-REVIEW.pdf'),format:'A4',printBackground:true});assert(pdf.length>3000&&pdf.slice(0,4).toString()==='%PDF','pdf invalid')}
  results.push({width,mirror:true,editorOverflow:false,guideOverflow:false,richClipboard:true,selection:true,injectionEscaped:true,forgedFinalRejected:true,sourceOriginalDecoded:true});
  await context.close();
 }
 await browser.close();fs.writeFileSync(path.join(evidence,'QA_REVIEW.json'),JSON.stringify({status:'PASS_LOCAL_SOURCE_ONLY',tested:'2026-11-21',results,open:['deployed HTTPS test','actual Gmail/Outlook native pastes','owner signoff','Mikhak/physical micro-legibility']},null,2));server.close();console.log(JSON.stringify(results));
})().catch(e=>{console.error(e.stack||e);server.close();process.exitCode=1});