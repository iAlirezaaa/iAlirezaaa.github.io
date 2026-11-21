import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const OUT='artifacts/hades-proforma';
await mkdir(OUT,{recursive:true});
const routes=['/hades/library/tools/a4-proforma-invoice/','/site/public/hades/library/tools/a4-proforma-invoice/'];
const widths=[320,390,430];
let cases=0;
const notes=[];
const browser=await chromium.launch({headless:true});
try{
 for (const route of routes){
  for(const w of widths){
   const page=await browser.newPage({viewport:{width:w,height:880},deviceScaleFactor:1,acceptDownloads:true});
   const errs=[];
   page.on('pageerror',e=>errs.push(e.message));
   const url='http://127.0.0.1:8765'+route;
   const response=await page.goto(url,{waitUntil:'networkidle'});
   assert.equal(response.status(),200,url);
   await page.waitForFunction(()=>document.getElementById('logoStatus').textContent.includes('SHA-256 PASS'),{timeout:12000});
   assert.equal(await page.locator('#logo').evaluate(el=>el.complete&&el.naturalWidth>0),true,'published original JPEG must decode');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,w+'px horizontal overflow');
   await page.locator('#currency').fill('USD');
   await page.locator('#number').fill('SAMPLE-001');
   await page.locator('#date').fill('2026-11-21');
   await page.locator('#recipient').fill('SAMPLE RECIPIENT');
   await page.locator('#subject').fill('SAMPLE WORK');
   await page.locator('.entry input[aria-label="desc 1"]').fill('SAMPLE ITEM');
   await page.locator('.entry input[aria-label="qty 1"]').fill('2');
   await page.locator('.entry input[aria-label="unit 1"]').fill('15');
   await page.locator('#tax').fill('10');
   assert.match(await page.locator('#totalOut').innerText(),/33\.00 USD/,'correct total');
   await page.locator('#addRow').click();
   assert.equal(await page.locator('.entry').count(),2,'add row working');
   await page.locator('.entry button').last().click();
   assert.equal(await page.locator('.entry').count(),1,'remove row working');
   const download=page.waitForEvent('download');
   await page.locator('#save').click();
   const d=await download;const dest=OUT+'/project-'+w+'-'+(route.includes('site/public')?'source':'pages')+'.json';
   await d.saveAs(dest);
   const p=JSON.parse(await readFile(dest,'utf8'));
   assert.equal(p.status,'REVIEW');assert.equal(p.kind,'hades-proforma-a4');
   const rejected={...p,status:'FINAL'};
   await page.locator('#upload').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(rejected))});
   assert.match(await page.locator('#notice').innerText(),/Invalid JSON/,'reject counterfeit FINAL');
   await page.locator('#upload').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
   assert.match(await page.locator('#notice').innerText(),/REVIEW JSON restored/,'valid JSON roundtrip');
   await page.evaluate(()=>{window.__printed=false;window.print=()=>{window.__printed=true;}});
   await page.locator('#print').click();
   assert.equal(await page.evaluate(()=>window.__printed),true,'print guarded by original and valid rows');
   assert.equal(errs.length,0,'no runtime JS errors');
   await page.screenshot({path:OUT+'/mobile-'+w+'-'+(route.includes('site/public')?'source':'pages')+'.png',fullPage:true});
   if(w===390&&route===routes[0]){
    const pdf=await page.pdf({path:OUT+'/A4_Proforma_Chromium_REVIEW.pdf',preferCSSPageSize:true,printBackground:true});
    assert.equal(pdf.slice(0,4).toString(),'%PDF');
    const count=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
    assert.equal(count,1,'single printed A4 page');
   }
   notes.push({route,width:w,originalDecoded:true,originalSHA:true,rtl:await page.locator('html').getAttribute('dir'),download:true,jsonFinalRejected:true,pdf:w===390&&route===routes[0]});
   cases++;
   await page.close();
  }
 }
 await writeFile(OUT+'/results.json',JSON.stringify({status:'PASS',cases,notes,source:'actual Chromium GitHub Actions checkout'},null,2));
 console.log(JSON.stringify({status:'PASS',cases,notes},null,2));
}finally{await browser.close();}
