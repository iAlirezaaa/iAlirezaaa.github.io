// HADES Original Mark Micro Bench · actual Chromium six-viewport QA (PUBLIC REVIEW)
const assert=require("assert").strict;
const fs=require("fs"),path=require("path"),http=require("http");
const {chromium}=require("playwright-core");
const root=process.cwd(),output=path.join(root,"hades-micro-bench-QA");
fs.mkdirSync(output,{recursive:true});
for(const rel of ["brand-kit/logo-usage/micro-bench/index.html","fa/brand-kit/logo-usage/micro-bench/index.html","brand-kit/logo-usage/micro-bench/README_REVIEW.md"]){
 assert(fs.readFileSync(path.join(root,"hades",rel)).equals(fs.readFileSync(path.join(root,"site/public/hades",rel))),"mirrors differ "+rel)
}
const server=http.createServer((req,res)=>{
 let url;try{url=decodeURIComponent(new URL(req.url,"http://localhost").pathname)}catch{res.writeHead(400);res.end();return}
 if(!url.startsWith("/hades/")){res.writeHead(404);res.end();return}
 const file=path.resolve(root,"."+url);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 const target=fs.existsSync(file)&&fs.statSync(file).isDirectory()?path.join(file,"index.html"):file;
 if(!fs.existsSync(target)){res.writeHead(404);res.end();return}
 const ext=path.extname(target);res.setHeader("Content-Type",({".html":"text/html;charset=utf-8",".png":"image/png",".jpeg":"image/jpeg",".jpg":"image/jpeg",".md":"text/plain"})[ext]||"application/octet-stream");
 res.end(fs.readFileSync(target));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const port=server.address().port;
 let browser,pass=0;
 try{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:["--no-sandbox"]});
 for(const lang of ["en","fa"])for(const width of [320,390,430]){
 const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true,deviceScaleFactor:1});
 const route=lang==="en"?"/hades/brand-kit/logo-usage/micro-bench/":"/hades/fa/brand-kit/logo-usage/micro-bench/";
 await page.goto("http://127.0.0.1:"+port+route,{waitUntil:"networkidle"});
 assert.equal(await page.locator("html").getAttribute("lang"),lang);
 await page.locator("#original").evaluate(img=>img.decode());
 for(const px of ["48","96","400"]){
 await page.locator("#size").selectOption(px);
 let w=await page.locator("#original").evaluate(img=>getComputedStyle(img).width);
 assert.equal(w,px+"px","image pixel size incorrect");
 }
 await page.locator("#size").selectOption("96");
 await page.locator("#surface").selectOption("bone");
 await page.locator("#mark").selectOption("classic");
 await page.locator("#original").evaluate(img=>img.decode());
 assert.equal(await page.locator("#plaque").evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(21, 20, 19)");
 assert.equal(await page.locator("#stage").evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(232, 222, 208)");
 assert.equal(await page.locator("#original").evaluate(el=>new URL(el.currentSrc).pathname),"/hades/assets/B3424A5B-3375-4244-806C-EF9EAA60BDD1.jpeg");
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,"horizontal document overflow");
 await page.locator("#recognition").selectOption("partial");
 await page.locator("#record").click();
 const p=page.waitForEvent("download");
 await page.locator("#export").click();
 const download=await p,save=path.join(output,lang+"-"+width+"-review.json");
 await download.saveAs(save);
 const log=JSON.parse(fs.readFileSync(save,"utf8"));
 assert.equal(log.review_only,true);assert.equal(log.logo_sources_unchanged,true);assert.equal(log.observations.length,1);
 assert.equal(log.observations[0].actual_phone_verified,false);assert.equal(log.observations[0].physical_print_verified,false);
 await page.screenshot({path:path.join(output,lang+"-"+width+".png"),fullPage:true});
 console.log("PASS",lang,width,"96px original Classic","bone dark plate","JSON","no overflow");pass++;
 await page.close();
 }
 assert.equal(pass,6);
 }finally{if(browser)await browser.close();}
})().then(()=>server.close(),e=>{console.error(e.stack||e);server.close();process.exitCode=1});
