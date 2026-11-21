import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.dirname(fileURLToPath(import.meta.url));const out=path.join(root,'e2e-proofs');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
try{
for(const width of [320,390,430]){
 const page=await browser.newPage({viewport:{width,height:960},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.waitForTimeout(250);
 const scroll=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,viewport:innerWidth}));
 assert.ok(scroll.doc<=width&&scroll.body<=width,'horizontal overflow '+JSON.stringify(scroll));
 const href=await page.locator('.source-logo svg image').getAttribute('href');assert.ok(href?.startsWith('data:image/png;base64,'));
 await page.locator('#title').fill('بریف پروژهٔ نمونه');
 await page.locator('#purpose').fill('طراحی و ارزیابی یک روایت بصری کوتاه.');
 await page.locator('#audience').fill('گروه خلاقهٔ داخلی');
 await page.locator('#deliverables').fill('طرح اولیه، کانسپت و دو نمونهٔ قاب‌بندی');
 await page.locator('#constraints').fill('فایل لوگوی اصلی بدون تغییر. انتشار نهایی نیازمند تأیید است.');
 await page.locator('#next').fill('بازبینی نسخهٔ آزمایشی');
 await page.locator('#lang').selectOption('fa');
 await page.waitForTimeout(120);
 assert.equal(await page.locator('#paper').getAttribute('dir'),'rtl');
 assert.equal(await page.locator('[data-output="purpose"]').textContent(),'طراحی و ارزیابی یک روایت بصری کوتاه.');
 assert.equal(await page.locator('#print').isDisabled(),false,'print must be available for sample');
 await page.screenshot({path:path.join(out,'brief-'+width+'-fa-REVIEW.png'),fullPage:true});
 const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);
 const jsonFile=path.join(out,'brief-'+width+'-project-REVIEW.json');await dl.saveAs(jsonFile);
 const obj=JSON.parse(await fs.readFile(jsonFile,'utf8'));assert.equal(obj.status,'REVIEW');
 assert.equal(obj.language,'fa');assert.equal(obj.fields.title,'بریف پروژهٔ نمونه');
 await page.locator('#reset').click();assert.equal(await page.locator('#print').isDisabled(),true);
 await page.locator('#open').setInputFiles(jsonFile);assert.equal(await page.locator('#title').inputValue(),obj.fields.title);
 const bad=structuredClone(obj);bad.status='FINAL';
 await page.locator('#open').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
 assert.match(await page.locator('#status').textContent(),/Import rejected/);
 await page.pdf({path:path.join(out,'brief-'+width+'-fa-A4-REVIEW.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});
 const bytes=await fs.readFile(path.join(out,'brief-'+width+'-fa-A4-REVIEW.pdf'));assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 assert.deepEqual(errors,[]);
 results.push({width,horizontalOverflow:false,rtl:true,jsonRoundTrip:true,finalRejected:true,pdfHeader:true,sourceLogoEmbedded:true});
 await page.close();
}
await fs.writeFile(path.join(out,'results.json'),JSON.stringify({status:'PASS',tested:'Actual Playwright Chromium',font:'UNVERIFIED — not Mikhak',physicalPrint:'OPEN',results},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',results}));
}finally{await browser.close()}
