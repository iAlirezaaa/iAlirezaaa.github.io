const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright-core');
(async()=>{const root=process.cwd(),server=http.createServer((req,res)=>{try{const p=decodeURIComponent(req.url.split('?')[0]);const target=path.resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));if(!target.startsWith(root+path.sep))throw Error('outside');const bytes=fs.readFileSync(target);res.setHeader('Content-Type',target.endsWith('.svg')?'image/svg+xml':target.endsWith('.html')?'text/html':'application/octet-stream');res.writeHead(200);res.end(bytes)}catch(e){res.writeHead(404);res.end('missing')}});await new Promise(done=>server.listen(0,'127.0.0.1',done));const port=server.address().port;
const dir=path.resolve('hades-lower-third-proof');fs.mkdirSync(dir,{recursive:true});let passes=0;
const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{for(const prefix of ['hades','site/public/hades'])for(const width of [320,390,430]){const ctx=await b.newContext({viewport:{width,height:850},acceptDownloads:true});const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:'+port+'/'+prefix+'/library/tools/lower-third/');await p.locator('#preview svg').waitFor();
assert.equal(await p.locator('#downloadSVG').isDisabled(),false,'default text fit');
const layout=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert.ok(layout.scroll<=layout.client+1,'horizontal overflow '+JSON.stringify(layout));
await p.locator('#name').fill('Animated production');assert.match(await p.locator('#preview').textContent(),/Animated production/);
const slug=prefix.startsWith('site')?'source':'public';
let [d]=await Promise.all([p.waitForEvent('download'),p.locator('#downloadSVG').click()]);let en=path.join(dir,slug+'-'+width+'-EN.svg');await d.saveAs(en);assert.match(fs.readFileSync(en,'utf8'),/Animated production/);
let [j]=await Promise.all([p.waitForEvent('download'),p.locator('#downloadJSON').click()]);let file=path.join(dir,slug+'-'+width+'.json');await j.saveAs(file);const saved=JSON.parse(fs.readFileSync(file));assert.equal(saved.status,'REVIEW');assert.equal(saved.ownerApproved,false);assert.equal(saved.creatorCredit,'OFF');
await p.locator('#lang').selectOption('fa');await p.locator('#ratio').selectOption('vertical');await p.locator('#mode').selectOption('modern');await p.locator('#name').fill('نمونهٔ فیلم');assert.equal(await p.locator('#downloadSVG').isDisabled(),false,'FA/9:16 fit: '+await p.locator('#status').innerText());
[d]=await Promise.all([p.waitForEvent('download'),p.locator('#downloadSVG').click()]);let fa=path.join(dir,slug+'-'+width+'-FA.svg');await d.saveAs(fa);assert.match(fs.readFileSync(fa,'utf8'),/نمونهٔ فیلم/);assert.match(fs.readFileSync(fa,'utf8'),/1080 1920/);
await p.locator('#name').fill('<script>alert(1)</script>');assert.ok(!(await p.locator('#preview').innerHTML()).includes('<script>alert(1)</script>'),'raw HTML injection');
await p.locator('#name').fill('اسم فارسی');
await p.locator('#jsonfile').setInputFiles({name:'forged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...saved,status:'FINAL'}))});await p.waitForFunction(()=>document.getElementById('status').textContent.includes('Import refused'));assert.match(await p.locator('#status').innerText(),/Import refused/);
await p.locator('#jsonfile').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await p.waitForFunction(()=>document.getElementById('name').value==='Animated production');assert.equal(await p.locator('#lang').inputValue(),'en');
await p.locator('#name').fill('W'.repeat(78));assert.equal(await p.locator('#downloadSVG').isDisabled(),true,'overflow must block');
await p.locator('#lang').selectOption('fa');await p.locator('#ratio').selectOption('vertical');await p.screenshot({path:path.join(dir,slug+'-'+width+'-REVIEW.png'),fullPage:true});
assert.deepEqual(errors,[]);passes++;await ctx.close();}
}finally{await b.close();await new Promise(done=>server.close(done))}
assert.equal(passes,6);fs.writeFileSync(path.join(dir,'QA.json'),JSON.stringify({status:'PASS',cases:passes,open:['native devices','video editor import','actual Mikhak','owner FINAL']},null,2));console.log('HADES VIDEO LOWER THIRD CHROMIUM 6/6 PASS');
})().catch(e=>{console.error(e);process.exitCode=1});