import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const OUT='artifacts/hades-signature';
await mkdir(OUT,{recursive:true});
const orig=await readFile('hades/assets/IMG_7187(2).png');
const expected='79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7';
assert.equal(createHash('sha256').update(orig).digest('hex'),expected,'source owner original cannot change');
const browser=await chromium.launch({headless:true});
const notes=[];
try{
for(const path of ['/hades/library/HADES_Email_Signature_REVIEW.html','/site/public/hades/library/HADES_Email_Signature_REVIEW.html']){
 for(const width of [320,390,430]){
  const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://ialirezaaa.github.io/hades/assets/IMG_7187(2).png',route=>route.fulfill({status:200,contentType:'image/png',body:orig}));
  const r=await page.goto('http://127.0.0.1:8765'+path,{waitUntil:'load'});
  assert.equal(r.status(),200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'horizontal overflow '+width);
  assert.equal(await page.locator('#sig-html').count(),1,'HTML export exists');
  assert.equal(await page.locator('.paper img').evaluate(e=>e.complete&&e.naturalWidth>0),true,'original decode (local routed)');
  await page.locator('#sig-name').fill('نام آزمایشی');
  await page.locator('#sig-role').fill('مدیر خلاقیت');
  await page.locator('#sig-email').fill('example@example.invalid');
  assert.match(await page.locator('textarea[readonly]').inputValue(),/نام آزمایشی/);
  const saved=page.waitForEvent('download');await page.locator('#sig-json').click();const d=await saved;
  const f=OUT+'/project-'+width+'-'+(path.includes('site/public')?'source':'pages')+'.json';await d.saveAs(f);
  const content=JSON.parse(await readFile(f,'utf8'));assert.equal(content.status,'REVIEW');
  await page.locator('#sig-name').fill('changed');
  await page.locator('#sig-load').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(content))});
  await page.waitForFunction(()=>document.getElementById('sig-status').textContent.includes('restored'));
  assert.equal(await page.locator('#sig-name').inputValue(),'نام آزمایشی');
  await page.locator('#sig-load').setInputFiles({name:'fake.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...content,status:'FINAL',name:'should-not-load'}))});
  await page.waitForFunction(()=>document.getElementById('sig-status').textContent.includes('Rejected'));
  assert.equal(await page.locator('#sig-name').inputValue(),'نام آزمایشی');
  await page.locator('#sig-lang').selectOption('en');await page.locator('#sig-mark').selectOption('hide');
  assert.equal(await page.locator('.paper img').count(),0);
  await page.locator('#sig-mark').selectOption('show');
  assert.equal(await page.locator('.paper img').count(),1);
  const ds=page.waitForEvent('download');await page.locator('#sig-html').click();const htmlDownload=await ds;
  const hf=OUT+'/email-'+width+'-'+(path.includes('site/public')?'source':'pages')+'.html';await htmlDownload.saveAs(hf);
  const emitted=await readFile(hf,'utf8');
  assert.match(emitted,/HADES THE THIRD/);assert.doesNotMatch(emitted,/<script/,'export must not run scripts');
  assert.equal(errors.length,0,JSON.stringify(errors));
  await page.screenshot({path:OUT+'/screen-'+width+'-'+(path.includes('site/public')?'source':'pages')+'.png',fullPage:true});
  notes.push({path,width,overflow:false,sourceLogoSha256:expected,logoDecodedOnLocalSource:true,HTMLExport:true,JSONRoundtrip:true,forgedFinalRejected:true});
  await page.close();
 }
}
await writeFile(OUT+'/qa.json',JSON.stringify({result:'PASS',cases:notes.length,notes,publicHostedHTTPS:'NOT TESTED BY THIS LOCAL CHECKOUT'},null,2));
console.log(JSON.stringify({result:'PASS',cases:notes.length,notes},null,2));
}finally{await browser.close();}
