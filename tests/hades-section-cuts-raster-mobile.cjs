// Real source-checkout Chromium viewport test; not a physical phone or public-site browser.
const { chromium } = require('playwright-core');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'section-cuts-raster-mobile-QA');
fs.mkdirSync(OUT,{recursive:true});
const names=['HADES_Section_Cut_Cantilever_16x9_REVIEW','HADES_Section_Cut_Sunken_Gallery_9x16_REVIEW','HADES_Section_Cut_Suspended_Lintel_1x1_REVIEW'];
for(const stem of names)for(const ext of ['svg','png','jpg','webp']){
 const rel='library/backgrounds/assets/'+stem+'.'+ext;
 assert.ok(fs.readFileSync(path.join(ROOT,'hades',rel)).equals(fs.readFileSync(path.join(ROOT,'site/public/hades',rel))),rel);
}
const mime={'.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.zip':'application/zip'};
const server=http.createServer((req,res)=>{
 let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'');
 if(!rel.startsWith('hades/')){res.writeHead(404);res.end();return;}
 let file=path.join(ROOT,rel);
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
 fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port,browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});
 const report=[];
 try{
  for(const lang of ['en','fa'])for(const width of [320,390,430]){
   const page=await browser.newPage({viewport:{width,height:820},deviceScaleFactor:1});
   await page.goto('http://127.0.0.1:'+port+'/hades/'+(lang==='fa'?'fa/':'')+'library/backgrounds/section-cuts/',{waitUntil:'load'});
   assert.equal(await page.locator('html').getAttribute('lang'),lang);
   const section=page.locator('#section-cuts-raster-review');
   assert.equal(await section.locator('article').count(),3);
   const images=await section.locator('img').evaluateAll(async arr=>Promise.all(arr.map(async image=>{await image.decode();return [image.naturalWidth,image.naturalHeight]})));
   assert.deepEqual(images,[[1920,1080],[1080,1920],[1080,1080]]);
   const links=await section.locator('a').evaluateAll(arr=>arr.map(a=>a.href));
   assert.ok(links.some(u=>u.endsWith('.zip')));
   for(const url of links.filter(u=>['.svg','.png','.jpg','.webp','.zip','.json'].some(ext=>u.endsWith(ext)))){
    const response=await page.request.get(url);assert.equal(response.status(),200,url);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'overflow '+lang+'/'+width);
   await page.screenshot({path:path.join(OUT,lang+'-'+width+'.png'),fullPage:true});
   report.push({lang,width,decodedWebP:3,downloadLinks:links.length,noOverflow:true});
   await page.close();
  }
  fs.writeFileSync(path.join(OUT,'report_REVIEW.json'),JSON.stringify(report,null,2));
  console.log('PASS real Chromium 6/6 FA/EN x 320/390/430; not physical phone');
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
})().catch(e=>{console.error(e);server.close();process.exit(1)});
