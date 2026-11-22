// HADES original-mark A4 optical proof | ACTUAL browser and PDF QA | PUBLIC REVIEW
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'hades-logo-optical-proof');
fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.jpeg':'image/jpeg'};
const server=http.createServer((req,res)=>{try{let route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(route.endsWith('/'))route+='index.html';
 const target=path.resolve(root,'.'+route);
 if(!target.startsWith(root+path.sep))return res.writeHead(403).end();
 if(!fs.existsSync(target))return res.writeHead(404).end();
 res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'}).end(fs.readFileSync(target));
}catch(err){res.writeHead(500).end(String(err))}});
(async()=>{await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const base='http://127.0.0.1:'+server.address().port, browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});
 try{
 let tested=0;
 for(const locale of ['en','fa'])for(const width of [320,390,430]){
 const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
 const route='/hades/'+(locale==='fa'?'fa/':'')+'brand-kit/logo-usage/preflight/';
 const response=await page.goto(base+route,{waitUntil:'networkidle',timeout:30000});
 assert.equal(response.status(),200);assert.equal(await page.locator('html').getAttribute('lang'),locale);
 await page.waitForFunction(()=>[...document.querySelectorAll('img.proof-image')].every(i=>i.complete&&i.naturalWidth>0));
 const state=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,links:[...document.querySelectorAll('a[href$=".svg"]')].length,source:[...document.querySelectorAll('img.proof-image')].map(x=>new URL(x.src).pathname),lang:document.documentElement.lang}));
 assert.equal(state.lang,locale);assert.ok(state.overflow<=1,'Horizontal overflow '+JSON.stringify(state));
 assert.ok(state.links>0,'A4 SVG download must be visible');assert.equal(state.source.length,4);
 assert.ok(state.source.every(s=>s.startsWith('/hades/assets/')),'Use only source originals');
 await page.screenshot({path:path.join(out,locale+'-'+width+'.png'),fullPage:true});
 assert.equal(errors.length,0,errors.join('\n'));tested++;await page.close();
 }
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const route='/hades/brand-kit/logo-usage/preflight/HADES_Original_Marks_A4_Optical_Proof_REVIEW.svg';
 const resp=await page.goto(base+route,{waitUntil:'networkidle',timeout:30000});assert.equal(resp.status(),200);
 assert.equal(await page.locator('svg image').count(),4,'two unmodified owner original image sources');
 const dims=await page.locator('svg').evaluate(x=>({width:x.getAttribute('width'),height:x.getAttribute('height'),viewBox:x.getAttribute('viewBox'),images:[...x.querySelectorAll('image')].map(y=>y.getAttribute('href')||y.getAttributeNS('http://www.w3.org/1999/xlink','href'))}));
 assert.equal(dims.width,'210mm');assert.equal(dims.height,'297mm');assert.equal(dims.viewBox,'0 0 794 1123');
 assert.ok(dims.images.every(s=>s&&s.startsWith('data:image/')),'Embedded owner originals must be self-contained');
 // Standalone data-rich SVG screen capture intermittently hangs Chrome 158 (font wait); real page/PDF proof is authoritative.
 // Keep six measured HTML screenshots and test A4 via PDF instead.
 const pdf=await page.pdf({width:'210mm',height:'297mm',printBackground:true,preferCSSPageSize:true});
 assert.ok(pdf.subarray(0,4).toString()==='%PDF'&&pdf.length>10000,'PDF render failed');
 fs.writeFileSync(path.join(out,'HADES_Original_Marks_Optical_A4_REVIEW.pdf'),pdf);
 console.log('ACTUAL CHROMIUM PASS 6/6 FA/EN 320/390/430, 4/4 source images, self-contained A4 SVG, printed PDF size',pdf.length,'status REVIEW; physical printer/phone/Mikhak OPEN');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
