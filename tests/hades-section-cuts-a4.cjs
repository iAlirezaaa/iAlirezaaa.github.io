/* HADES A4 Section Cuts / PUBLIC REVIEW — real browser and immutable original QA. */
const fs=require('node:fs'), crypto=require('node:crypto'), http=require('node:http'), path=require('node:path');
const {chromium}=require('playwright-core');
const out='hades-section-cuts-a4-QA'; fs.mkdirSync(out,{recursive:true});
const folder='library/backgrounds/section-cuts/';
const a4=folder+'HADES_Section_Cuts_A4_Applied_Optical_Proof_REVIEW.svg';
const pages=[a4,folder+'print-preflight/index.html','fa/'+folder+'print-preflight/index.html',
'index.html','fa/index.html','library/index.html','fa/library/index.html',
'brand-kit/logo-usage/index.html','fa/brand-kit/logo-usage/index.html',
folder+'index.html','fa/'+folder+'index.html'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const png=fs.readFileSync('hades/assets/IMG_7187(2).png');
const expected='79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7';
if(sha(png)!==expected)throw Error('Protected original PNG does not match owner manifest');
for(const rel of pages){
 const a=fs.readFileSync('hades/'+rel),b=fs.readFileSync('site/public/hades/'+rel);
 if(!a.equals(b))throw Error('Source/served mirror mismatch '+rel);
 if(rel.endsWith('index.html')&&!a.includes(Buffer.from('A4_Applied_Optical_Proof_REVIEW.svg')))throw Error('Missing A4 navigation '+rel);
}
const vector=fs.readFileSync('hades/'+a4,'utf8');
if(!vector.includes('width="210mm" height="297mm" viewBox="0 0 210 297"'))throw Error('Not physical A4 geometry');
const images=[...vector.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)];
if(images.length!==3)throw Error('Expected 3 actual owner PNG embeds');
images.forEach((m,i)=>{if(!Buffer.from(m[1],'base64').equals(png))throw Error('Original logo bytes modified in specimen '+i)});
if(vector.includes('FINAL APPROVED'))throw Error('Unexpected FINAL marker');
console.log('PASS A4 true-sized XML source + 3 unchanged embedded original PNGs + 11 mirrored paths');
const root=process.cwd();
const server=http.createServer((req,res)=>{
 const full=path.resolve(root,'.'+decodeURI(req.url.split('?')[0]));
 if(!full.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 let f=full;try{if(fs.statSync(f).isDirectory())f=path.join(f,'index.html')}catch{}
 fs.readFile(f,(err,buf)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('.svg')?'image/svg+xml':f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');res.end(buf)})
});
(async()=>{
 await new Promise(resolve=>server.listen(8979,'127.0.0.1',resolve));
 const executablePath=process.env.CHROME_PATH;
 const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
 try{
  for(const language of ['en','fa']){
   const folderPrefix=language==='fa'?'fa/':'';
   for(const width of [320,390,430]){
    const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1});
    const url='http://127.0.0.1:8979/hades/'+folderPrefix+'library/backgrounds/section-cuts/print-preflight/';
    const response=await page.goto(url,{waitUntil:'load',timeout:60000});
    if(response.status()!==200)throw Error('HTTP '+response.status()+' '+url);
    const img=page.locator('.art img');
    await img.evaluate(async el=>{await el.decode()});
    const dims=await img.evaluate(el=>({naturalWidth:el.naturalWidth,naturalHeight:el.naturalHeight}));
    if(dims.naturalWidth===0||dims.naturalHeight===0)throw Error('SVG image did not decode '+language+' '+width);
    if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1))throw Error('mobile horizontal overflow '+language+' '+width);
    if((await page.locator('html').getAttribute('lang'))!==language)throw Error('wrong language');
    await page.screenshot({path:out+'/'+language+'_'+width+'_REVIEW.png',fullPage:true});
    console.log('PASS real Chromium',language,width,dims.naturalWidth,dims.naturalHeight);
    if(width===390){
      const downloadPromise=page.waitForEvent('download');
      await page.locator('#json').click();
      const download=await downloadPromise, temp=out+'/'+language+'_observation_REVIEW.json';
      await download.saveAs(temp);
      const j=JSON.parse(fs.readFileSync(temp,'utf8'));
      if(j.owner_final!=='OPEN'||j.measured_mm!==null)throw Error('JSON fabricated approval/measurement');
      await page.pdf({path:out+'/'+language+'_A4_REVIEW.pdf',format:'A4',printBackground:true,preferCSSPageSize:true});
      if(fs.readFileSync(out+'/'+language+'_A4_REVIEW.pdf').subarray(0,4).toString()!=='%PDF')throw Error('Invalid PDF');
    }
    await page.close();
   }
  }
  const page=await browser.newPage({viewport:{width:1100,height:1557}});
  const response=await page.goto('http://127.0.0.1:8979/hades/'+a4,{waitUntil:'load'});
  if(response.status()!==200)throw Error('A4 URL not 200');
  const stats=await page.evaluate(()=>({svgs:document.querySelectorAll('svg').length,images:document.querySelectorAll('image').length}));
  if(stats.svgs<4||stats.images!==3)throw Error('SVG DOM missing artboards or owner images '+JSON.stringify(stats));
  await page.screenshot({path:out+'/A4_Source_Real_Chromium_REVIEW.png'});
  console.log('PASS A4 SVG in real browser',JSON.stringify(stats));
  await page.close();
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
