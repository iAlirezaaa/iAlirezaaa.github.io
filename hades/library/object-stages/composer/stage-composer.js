/* HADES Architectural Object Stages compositor · PUBLIC REVIEW.
   Local-only user images; original 3 stage SVGs are fetched unchanged.
   No mark reconstruction and no user uploads. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const fa=document.body.dataset.lang==="fa";
const say=(en,faText)=>fa?faText:en;
const stages={
"16x9":{w:1920,h:1080,file:"HADES_Object_Stage_16x9_REVIEW.svg",plinth:{"poly":[[550,735],[700,686],[1235,686],[1380,735],[1235,782],[700,782]],"cx":965,"cy":735}},
"9x16":{w:1080,h:1920,file:"HADES_Object_Stage_9x16_REVIEW.svg",plinth:{"poly":[[290,1380],[410,1340],[670,1340],[790,1380],[670,1430],[410,1430]],"cx":540,"cy":1380}},
"1x1":{w:1080,h:1080,file:"HADES_Object_Stage_1x1_REVIEW.svg",plinth:{"poly":[[240,730],[405,673],[824,673],[940,730],[824,785],[405,785]],"cx":590,"cy":730}}
};
const srcBase="/hades/library/object-stages/";
const canvas=$("stageCanvas"),ctx=canvas.getContext("2d",{alpha:false});
let selected="16x9",stageImage=null,stageSource="",subjectImage=null,subjectData="",ready=false,nonce=0,drag=false,subjectAlpha=null;
const values=()=>({x:Number($("positionX").value),y:Number($("positionY").value),scale:Number($("subjectScale").value)});
const setStatus=(message)=>{$("status").textContent=message;};
function refresh(){
const a=values();$("xOut").textContent=a.x+"%";$("yOut").textContent=a.y+"%";$("scaleOut").textContent=a.scale+"%";
if(!ctx)return;
const d=stages[selected];canvas.width=d.w;canvas.height=d.h;
ctx.clearRect(0,0,d.w,d.h);
if(stageImage)ctx.drawImage(stageImage,0,0,d.w,d.h);
else {ctx.fillStyle="#131211";ctx.fillRect(0,0,d.w,d.h);}
if(subjectImage){const w=d.w*a.scale/100,h=w*subjectImage.naturalHeight/subjectImage.naturalWidth;
ctx.drawImage(subjectImage,d.w*a.x/100-w/2,d.h*a.y/100-h/2,w,h);}
if(subjectImage&&subjectAlpha?.kind==="transparent"&&$("alphaGuides").checked){
 const w=d.w*a.scale/100,h=w*subjectImage.naturalHeight/subjectImage.naturalWidth,b=subjectAlpha;
 ctx.save();ctx.strokeStyle="#EF4B32";ctx.lineWidth=Math.max(2,d.w/650);ctx.setLineDash([8,6]);
 ctx.strokeRect(d.w*a.x/100-w/2+w*b.left,d.h*a.y/100-h/2+h*b.top,w*(b.right-b.left),h*(b.bottom-b.top));ctx.restore();
}
if($("guides").checked){ctx.save();ctx.strokeStyle="#EF4B32";ctx.lineWidth=Math.max(2,d.w/640);ctx.setLineDash([d.w/100,d.w/120]);ctx.globalAlpha=.85;ctx.strokeRect(d.w*.1,d.h*.1,d.w*.8,d.h*.8);ctx.restore();}
if($("plinthGuides").checked){
 const g=d.plinth;
 ctx.save();ctx.lineWidth=Math.max(2,d.w/700);
 ctx.strokeStyle=selected==="9x16"?"#292723":"#E6D9C7";
 ctx.setLineDash([Math.max(6,d.w/145),Math.max(4,d.w/220)]);
 ctx.beginPath();g.poly.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));ctx.closePath();ctx.stroke();
 ctx.setLineDash([]);ctx.fillStyle="#EF4B32";ctx.beginPath();ctx.arc(g.cx,g.cy,Math.max(5,d.w/140),0,2*Math.PI);ctx.fill();
 if(subjectImage){
  const w=d.w*a.scale/100,h=w*subjectImage.naturalHeight/subjectImage.naturalWidth;
  ctx.strokeStyle="#EF4B32";ctx.setLineDash([Math.max(4,d.w/170),Math.max(3,d.w/240)]);
  ctx.beginPath();ctx.moveTo(d.w*a.x/100,d.h*a.y/100+h/2);ctx.lineTo(g.cx,g.cy);ctx.stroke();
 }
 ctx.restore();
}
}
function bytesBase64(str){const data=new TextEncoder().encode(str);let raw="";for(let i=0;i<data.length;i++)raw+=String.fromCharCode(data[i]);return btoa(raw);}
function download(blob,name){const href=URL.createObjectURL(blob),a=document.createElement("a");a.href=href;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1200);}
async function changeStage(key){
const n=++nonce;ready=false;stageImage=null;stageSource="";selected=key;refresh();
$("savePNG").disabled=true;$("saveSVG").disabled=true;
setStatus(say("Loading unchanged source stage…","در حال بارگذاری فایل اصلی و بدون تغییر…"));
try{
const res=await fetch(srcBase+stages[key].file,{cache:"no-store"});
if(!res.ok)throw new Error("HTTP "+res.status);
const source=await res.text();
if(!source.includes("<svg")||!source.includes("PUBLIC REVIEW"))throw new Error("Invalid stage source");
const img=new Image();img.src="data:image/svg+xml;base64,"+bytesBase64(source);await img.decode();
if(n!==nonce)return;
stageImage=img;stageSource=source;ready=true;refresh();
$("savePNG").disabled=false;$("saveSVG").disabled=false;
setStatus(say("Stage ready. Move the subject with sliders or drag it on the canvas.","استیج آماده است. سوژه را با لغزنده‌ها یا کشیدن روی تصویر جابه‌جا کنید."));
}catch(err){if(n!==nonce)return;setStatus(say("OPEN: stage source failed to load: ","OPEN: بارگذاری استیج ناموفق بود: ")+err.message);}
}
async function upload(file){
if(!file)return;
if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>12*1024*1024||file.size===0){
setStatus(say("Rejected: use a PNG/JPEG/WebP image of 12MB or less.","رد شد: PNG/JPEG/WebP با حجم حداکثر ۱۲ مگابایت لازم است."));return;
}
try{
const url=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(new Error("File read failed"));r.readAsDataURL(file);});
const img=new Image();img.src=url;await img.decode();
if(img.naturalWidth*img.naturalHeight>26000000)throw new Error("Source image too large");
subjectImage=img;subjectData=url;subjectAlpha=alphaBounds(img);describeAlpha();refresh();
setStatus(say("Local subject loaded; no upload made.","تصویر سوژه محلی بارگذاری شد؛ هیچ آپلودی انجام نشد."));
}catch(err){setStatus(say("Image rejected: ","تصویر پذیرفته نشد: ")+err.message);}
}

/* Local-only transparency measurement. 768px max sample, alpha cutoff 32/255.
   Silhouette extremum is optical guidance, not a real foot/shadow segmentation. */
function alphaBounds(img){
 const s=Math.min(1,768/Math.max(img.naturalWidth,img.naturalHeight));
 const w=Math.max(1,Math.round(img.naturalWidth*s)),h=Math.max(1,Math.round(img.naturalHeight*s));
 const c=document.createElement("canvas");c.width=w;c.height=h;
 const context=c.getContext("2d",{willReadFrequently:true});context.drawImage(img,0,0,w,h);
 const raw=context.getImageData(0,0,w,h).data;
 let minX=w,minY=h,maxX=-1,maxY=-1,transparent=false;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const a=raw[4*(y*w+x)+3];if(a<255)transparent=true;
   if(a>=32){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
 }
 if(!transparent)return {kind:"opaque"};
 if(maxX<0)return {kind:"empty"};
 return {kind:"transparent",left:minX/w,top:minY/h,right:(maxX+1)/w,bottom:(maxY+1)/h};
}
function describeAlpha(){
 if(!subjectImage){$("alphaInfo").textContent=say("Load a transparent subject to measure bounds.","برای اندازه‌گیری، تصویر شفاف اضافه کنید.");return;}
 if(subjectAlpha?.kind!=="transparent"){
  $("alphaInfo").textContent=subjectAlpha?.kind==="opaque"?say("Opaque image; use photo-bounds alignment.","تصویر غیرشفاف است؛ تراز کادر عکس را انتخاب کنید."):say("OPEN: no pixels above alpha 32/255.","OPEN: پیکسل قابل‌دیدن با آلفا بالاتر از ۳۲ یافت نشد.");return;
 }
 const b=subjectAlpha,p=n=>Math.round(n*100)+"%";
 $("alphaInfo").textContent=say("Local alpha ≥32/255: L "+p(b.left)+" T "+p(b.top)+" R "+p(b.right)+" B "+p(b.bottom)+". Bottom is approximate.","آلفای محلی ≥۳۲/۲۵۵: چپ "+p(b.left)+" بالا "+p(b.top)+" راست "+p(b.right)+" پایین "+p(b.bottom)+". تراز تقریبی است.");
}
function alignVisible(){
 if(!subjectImage||subjectAlpha?.kind!=="transparent"){setStatus(say("Transparent foreground required; use photo alignment for opaque images.","برای تراز سیلویت تصویر شفاف لازم است؛ برای عکس غیرشفاف تراز کادر را به‌کار ببرید."));return;}
 const d=stages[selected],g=d.plinth,a=values(),b=subjectAlpha,w=d.w*a.scale/100,h=w*subjectImage.naturalHeight/subjectImage.naturalWidth;
 setSliders((g.cx+w*(.5-(b.left+b.right)/2))/d.w*100,(g.cy+h*(.5-b.bottom))/d.h*100,a.scale);
 $("plinthGuides").checked=true;$("alphaGuides").checked=true;refresh();
 setStatus(say("Visible lower edge approximately aligned; verify shadows and perspective. Export excludes guides.","لبهٔ دیداری به‌صورت تقریبی تراز شد؛ سایه و پرسپکتیو را دستی بررسی کنید. خروجی بدون راهنما است."));
}
function setSliders(x,y,scale){
$("positionX").value=String(Math.max(0,Math.min(100,Math.round(x))));
$("positionY").value=String(Math.max(0,Math.min(100,Math.round(y))));
$("subjectScale").value=String(Math.max(5,Math.min(100,Math.round(scale))));
refresh();
}
function alignBaseToPlinth(){
 if(!subjectImage){setStatus(say("Load a local subject first.","ابتدا عکس سوژه را اضافه کنید."));return;}
 const d=stages[selected],g=d.plinth,a=values(),h=d.w*a.scale/100*subjectImage.naturalHeight/subjectImage.naturalWidth;
 setSliders(g.cx/d.w*100,(g.cy-h/2)/d.h*100,a.scale);
 $("plinthGuides").checked=true;refresh();
 setStatus(say("Approximate image rectangle contact; adjust transparent margins manually.","تماس تقریبی کادر تصویر؛ حاشیه‌های شفاف را دستی تنظیم کنید."));
}
function svgExport(){
if(!ready||!stageSource)throw Error("Stage unavailable");
const d=stages[selected],a=values(),root='http://www.w3.org/2000/svg';
let overlay="";
if(subjectImage){const w=d.w*a.scale/100,h=w*subjectImage.naturalHeight/subjectImage.naturalWidth;
const x=d.w*a.x/100-w/2,y=d.h*a.y/100-h/2;
overlay='<image id="editable-subject" x="'+x.toFixed(3)+'" y="'+y.toFixed(3)+'" width="'+w.toFixed(3)+'" height="'+h.toFixed(3)+'" href="'+subjectData+'" />';}
return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="'+root+'" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+d.w+'" height="'+d.h+'" viewBox="0 0 '+d.w+' '+d.h+'"><title>HADES Object Stage composition — PUBLIC REVIEW</title><desc>Unchanged source stage embedded as data SVG. Subject remains a separate movable raster image layer. No HADES logo included. Colors other than #EF4B32 proposed.</desc><image id="unchanged-stage" width="'+d.w+'" height="'+d.h+'" href="data:image/svg+xml;base64,'+bytesBase64(stageSource)+'" />'+overlay+'</svg>';
}
function savePNG(){if(!ready||!stageImage)return;const file="HADES_Object_Stage_Composed_"+selected+"_REVIEW.png";
/* Export to a separate bitmap; preview-only 10% guides must not be included in PNG. */
const d=stages[selected],a=values(),out=document.createElement("canvas");out.width=d.w;out.height=d.h;
const c=out.getContext("2d",{alpha:false});c.drawImage(stageImage,0,0,d.w,d.h);
if(subjectImage){const w=d.w*a.scale/100,h=w*subjectImage.naturalHeight/subjectImage.naturalWidth;
c.drawImage(subjectImage,d.w*a.x/100-w/2,d.h*a.y/100-h/2,w,h);}
out.toBlob(b=>{if(b)download(b,file);else setStatus("OPEN: PNG encode failed");},"image/png");}
function saveSVG(){try{download(new Blob([svgExport()],{type:"image/svg+xml;charset=utf-8"}),"HADES_Object_Stage_Composed_"+selected+"_REVIEW.svg");}catch(e){setStatus("OPEN: "+e.message);}}
function saveJSON(){const state={status:"PUBLIC REVIEW",ratio:selected,position:values(),view:{guides:$("guides").checked,plinthGuides:$("plinthGuides").checked,alphaGuides:$("alphaGuides").checked},sourceFile:stages[selected].file,subjectData:subjectData||null,warning:"Local-only source; this JSON may contain your full private image bytes. Do not upload or share it without permission."};
download(new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),"HADES_Object_Stage_Settings_REVIEW.json");}
async function loadJSON(file){if(!file||file.size>17*1024*1024){setStatus("OPEN: invalid JSON size");return;}
try{const s=JSON.parse(await file.text());
if(s.status!=="PUBLIC REVIEW"||!stages[s.ratio]||!s.position||!Number.isFinite(s.position.x)||!Number.isFinite(s.position.y)||!Number.isFinite(s.position.scale))throw Error("Invalid REVIEW settings");
if(s.subjectData && (!/^data:image\/(png|jpeg|webp);base64,/.test(s.subjectData)||s.subjectData.length>17*1024*1024))throw Error("Invalid subject data");
if(s.view && (typeof s.view.guides!=="boolean"||typeof s.view.plinthGuides!=="boolean"||(s.view.alphaGuides!==undefined&&typeof s.view.alphaGuides!=="boolean")))throw Error("Invalid guide settings");
if(s.subjectData){const img=new Image();img.src=s.subjectData;await img.decode();if(img.naturalWidth*img.naturalHeight>26000000)throw Error("Image too large");subjectImage=img;subjectData=s.subjectData;subjectAlpha=alphaBounds(img);}else {subjectImage=null;subjectData="";subjectAlpha=null;}describeAlpha();
if(s.view){$("guides").checked=s.view.guides;$("plinthGuides").checked=s.view.plinthGuides;if(s.view.alphaGuides!==undefined)$("alphaGuides").checked=s.view.alphaGuides;}
$("ratio").value=s.ratio;setSliders(s.position.x,s.position.y,s.position.scale);await changeStage(s.ratio);
}catch(e){setStatus(say("Settings not loaded: ","بارگذاری تنظیمات انجام نشد: ")+e.message);}}
$("ratio").addEventListener("change",e=>changeStage(e.target.value));
$("subjectFile").addEventListener("change",e=>upload(e.target.files[0]));
["positionX","positionY","subjectScale","guides","plinthGuides","alphaGuides"].forEach(id=>$(id).addEventListener("input",refresh));
$("alignBase").addEventListener("click",alignBaseToPlinth);
$("alignVisible").addEventListener("click",alignVisible);
$("reset").addEventListener("click",()=>setSliders(50,53,30));
$("remove").addEventListener("click",()=>{subjectImage=null;subjectData="";subjectAlpha=null;$("subjectFile").value="";describeAlpha();refresh();});
$("savePNG").addEventListener("click",savePNG);
$("saveSVG").addEventListener("click",saveSVG);
$("saveJSON").addEventListener("click",saveJSON);
$("loadJSON").addEventListener("change",e=>loadJSON(e.target.files[0]));
canvas.addEventListener("pointerdown",e=>{if(!subjectImage||!ready)return;drag=true;canvas.setPointerCapture(e.pointerId);position(e);});
canvas.addEventListener("pointermove",e=>{if(drag)position(e);});
["pointerup","pointercancel","lostpointercapture"].forEach(ev=>canvas.addEventListener(ev,()=>drag=false));
function position(e){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;const x=(e.clientX-r.left)/r.width*100,y=(e.clientY-r.top)/r.height*100;setSliders(x,y,values().scale);}
describeAlpha();changeStage(selected);
})();