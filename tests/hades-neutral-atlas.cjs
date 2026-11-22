// HADES Neutral Atlas / PUBLIC REVIEW: local Chromium, not physical-device verification.
const {chromium}=require('playwright-core');const fs=require('fs');const path=require('path');const {pathToFileURL}=require('url');
const assert=require('assert/strict');const ROOT=path.resolve(__dirname,'..');const OUT=path.join(ROOT,'hades-neutral-atlas-QA');fs.mkdirSync(OUT,{recursive:true});
const tokenPath=path.join(ROOT,'hades/library/neutral-atlas/HADES_Neutral_Atlas_Tokens_REVIEW.json');const tokens=JSON.parse(fs.readFileSync(tokenPath,'utf8'));
assert.equal(tokens.approved_color_only,'#EF4B32');assert.equal(tokens.colors.filter(x=>x.approved).length,1);
assert.ok(fs.readFileSync(path.join(ROOT,'hades/library/neutral-atlas/HADES_Neutral_Atlas_A4_REVIEW.svg'),'utf8').includes('width="210mm"'));
for(const item of ['library/neutral-atlas/index.html','fa/library/neutral-atlas/index.html','library/neutral-atlas/HADES_Neutral_Atlas_A4_REVIEW.svg','library/neutral-atlas/HADES_Neutral_Atlas_Tokens_REVIEW.json','library/neutral-atlas/README_PUBLIC_REVIEW.md']){
 const a=fs.readFileSync(path.join(ROOT,'hades',item));const b=fs.readFileSync(path.join(ROOT,'site/public/hades',item));assert.ok(a.equals(b),'source/served mismatch '+item)
}
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});const report=[];
try{
for(const locale of ['en','fa'])for(const width of [320,390,430]){
 const page=await browser.newPage({viewport:{width,height:840},deviceScaleFactor:1});
 const file=path.join(ROOT,'hades',locale==='fa'?'fa/library/neutral-atlas/index.html':'library/neutral-atlas/index.html');
 await page.goto(pathToFileURL(file).href);
 assert.equal(await page.locator('html').getAttribute('lang'),locale);
 assert.equal(await page.locator('#reading').innerText(),'16.06:1');
 await page.locator('#fg').selectOption('#EF4B32');await page.locator('#bg').selectOption('#E6D9C7');
 assert.equal(await page.locator('#reading').innerText(),'2.64:1');
 assert.equal(await page.locator('#rules span').first().getAttribute('data-pass'),'false');
 assert.equal(await page.locator('#rules span').nth(1).getAttribute('data-pass'),'false');
 const over=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(over,false,'horizontal overflow '+locale+' '+width);
 for(const a of await page.locator('.downloads a').all()){const href=await a.getAttribute('href');assert.ok(fs.existsSync(path.join(ROOT,href.replace(/^\/hades\//,'' ).replace(/^/,'hades/'))),'missing download: '+href)}
 await page.screenshot({path:path.join(OUT,locale+'-'+width+'.png'),fullPage:true});report.push({locale,width,pass:true,ratio_bone_vermilion:'2.64:1',no_horizontal_overflow:true});await page.close();
}
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify({status:'PASS',scope:'Chromium local checkout; no real physical phone or deployed HTTP',report},null,2));console.log('HADES Neutral Atlas local Chrome PASS 6/6');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
