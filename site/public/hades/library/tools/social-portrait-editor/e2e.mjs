import{chromium}from"playwright";
import{strict as assert}from"node:assert";
import fs from"node:fs/promises";
import path from"node:path";
import{fileURLToPath,pathToFileURL}from"node:url";
const root=path.dirname(fileURLToPath(import.meta.url)),out=path.join(root,"e2e-proofs");
await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,args:["--no-sandbox"]}),results=[];
try{for(const width of[320,390,430]){
 const page=await browser.newPage({viewport:{width,height:850},acceptDownloads:true});
 try{
 await page.goto(pathToFileURL(path.join(root,"index.html")).href);
 await page.waitForFunction(()=>!document.getElementById("export").disabled,{timeout:15000});
 let bounds=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
 assert.ok(bounds.scroll<=bounds.width,"overflow "+width);
 let font=await page.locator("#heading").evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
 assert.ok(font>=16,"small input text");
 await page.locator("#lang").selectOption("fa");await page.locator("#heading").fill("پروژهٔ نمونه");
 await page.locator("#description").fill("این متن آزمایشی است و مجوز انتشار ندارد.");
 let save=page.waitForEvent("download");await page.locator("#project-save").click();
 let d=await save,project=JSON.parse(await fs.readFile(await d.path(),"utf8"));
 assert.equal(project.status,"REVIEW");assert.equal(project.content.language,"fa");assert.equal(project.content.heading,"پروژهٔ نمونه");assert.ok(!("photo"in project));
 await page.locator("#reset").click();
 await page.locator("#project-import").setInputFiles({name:"example.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(project))});
 await page.waitForFunction(()=>document.getElementById("heading").value==="پروژهٔ نمونه");
 assert.equal(await page.locator("#heading").inputValue(),"پروژهٔ نمونه");
 assert.equal(await page.locator("#lang").inputValue(),"fa");
 let png=page.waitForEvent("download");await page.locator("#export").click();
 let f=await png,b=await fs.readFile(await f.path());
 assert.equal(b.subarray(0,8).toString("hex"),"89504e470d0a1a0a");assert.equal(b.readUInt32BE(16),1080);assert.equal(b.readUInt32BE(20),1350);
 await page.screenshot({path:path.join(out,"social-"+width+"-fa-REVIEW.png"),fullPage:true});
 await page.locator("#project-import").setInputFiles({name:"bad.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({...project,status:"FINAL"}))});
 await page.waitForFunction(()=>document.getElementById("status").textContent.startsWith("Import rejected"));
 assert.match(await page.locator("#status").innerText(),/Import rejected/);
 await page.locator("#heading").fill("X".repeat(110));assert.equal(await page.locator("#export").isDisabled(),true);
 results.push({width,scrollOverflow:Math.max(0,bounds.scroll-bounds.width),inputFont:font,JSON:"PASS",PNG:"1080x1350",rejectFINAL:true,overflowHold:true});
 }finally{await page.close();}
}await fs.writeFile(path.join(out,"results.json"),JSON.stringify({status:"PASS",results},null,2)+"\n");console.log(JSON.stringify({status:"PASS",results}));}
finally{await browser.close();}
