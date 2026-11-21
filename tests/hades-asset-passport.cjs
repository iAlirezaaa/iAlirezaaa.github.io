'use strict';
const fs=require('fs'), path=require('path'), http=require('http');
const {chromium}=require('playwright-core');
const root=process.cwd(), proof=path.join(root,'hades-asset-passport-proof');
fs.mkdirSync(proof,{recursive:true});
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const rel=pathname.replace(/^\//,'');
 const target=path.resolve(root,rel.endsWith('/')?path.join(rel,'index.html'):rel);
 if(!target.startsWith(root+path.sep))return res.writeHead(403).end();
 try{
  const data=fs.readFileSync(target);
  const ext=path.extname(target);
  res.writeHead(200,{'Content-Type':ext==='.svg'?'image/svg+xml':ext==='.html'?'text/html':'application/octet-stream'});
  res.end(data);
 }catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port, browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});
 let passed=0;
 try{
  for(const base of ['hades','site/public/hades']){
   for(const width of [320,390,430]){
    const context=await browser.newContext({viewport:{width,height:820},acceptDownloads:true});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    const prefix='http://127.0.0.1:'+port+'/'+base+'/library/tools/asset-passport/';
    await page.goto(prefix,{waitUntil:'networkidle'});
    const data=await page.evaluate(()=>{
      const img=document.querySelector('.paper img');
      return {overflow:document.documentElement.scrollWidth>innerWidth,loaded:img?.complete&&img.naturalWidth>0,link:document.querySelector('.downloads a[download]')?.getAttribute('href'),review:document.body.textContent.includes('REVIEW')};
    });
    if(data.overflow||!data.loaded||!data.link||!data.review||errors.length)throw Error(JSON.stringify({base,width,data,errors}));
    const want=fs.readFileSync(path.join(root,base,'library/tools/asset-passport/HADES_Asset_Passport_Bilingual_A4_REVIEW.svg'));
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('.downloads a[download]').click()]);
    const got=fs.readFileSync(await download.path());
    if(!want.equals(got))throw Error('download byte mismatch '+base+' '+width);
    await page.screenshot({path:path.join(proof,base.replace(/\//g,'_')+'_'+width+'.png'),fullPage:true});
    const vector=await context.newPage();
    await vector.goto(prefix+'HADES_Asset_Passport_Bilingual_A4_REVIEW.svg');
    const bounds=await vector.evaluate(()=>{
     const texts=[...document.querySelectorAll('svg text')];
     return texts.map(t=>{let b=t.getBBox();return {x:b.x,y:b.y,right:b.x+b.width,bottom:b.y+b.height,content:t.textContent}});
    });
    const bad=bounds.filter(b=>b.x<0||b.right>794||b.y<0||b.bottom>1123);
    if(bad.length)throw Error('SVG text bbox overflow '+JSON.stringify(bad));
    fs.writeFileSync(path.join(proof,'bounds_'+base.replace(/\//g,'_')+'_'+width+'.json'),JSON.stringify({base,width,bounds},null,2));
    console.log('PASS',base,width,'image+download+text-bounds',bounds.length);
    passed++;await context.close();
   }
  }
  if(passed!==6)throw Error('unexpected pass count '+passed);
  console.log('HADES ASSET PASSPORT CHROMIUM 6/6 PASS');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
