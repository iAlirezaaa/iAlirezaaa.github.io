/* HADES Stage × Alpha panel inspector · PUBLIC REVIEW · No remote uploads */
(()=>{"use strict";
const doc=document,fa=doc.body.dataset.lang==="fa";
const labels=fa?["مرز سخت","آلفای چندپله‌ای","سایهٔ نرم"]:["Hard edge","Tiered alpha","Soft shadow"];
const ratios=["16:9","9:16","1:1"];
const words=fa?{inspect:"نمایش بزرگ",title:"بررسی تک‌قاب",back:"قاب قبل",next:"قاب بعد",close:"بستن",download:"دریافت PNG همین قاب",zoom:"بزرگ‌نمایی",unready:"تصویر هنوز آماده نیست؛ ابتدا بارگذاری کامل شود.",description:"نمونهٔ مصنوعی / PUBLIC REVIEW / بدون تغییر فایل اصلی"}:
{inspect:"Inspect panel",title:"Single-panel inspection",back:"Previous",next:"Next",close:"Close",download:"Download this panel PNG",zoom:"View scale",unready:"Panel not ready; wait for the nine sources to load.",description:"Synthetic example / PUBLIC REVIEW / originals unchanged"};
const cells=[...doc.querySelectorAll("#matrix .cell")],exportAll=doc.getElementById("export");
if(cells.length!==9||!exportAll)return;
const dialog=doc.createElement("dialog");dialog.id="hades-panel-inspector";dialog.className="hades-panel-inspector";dialog.dir=fa?"rtl":"ltr";
dialog.innerHTML='<div class="inspector-head"><div><p class="inspector-kicker">HADES / PUBLIC REVIEW</p><h2 id="inspector-title"></h2></div><button type="button" id="inspector-close"></button></div><p id="inspector-label" class="inspector-label"></p><div class="inspector-viewport" id="inspector-viewport"><canvas id="inspector-canvas" width="500" height="340" role="img"></canvas></div><div class="inspector-actions"><label id="inspector-scale-label" for="inspector-scale"></label><input id="inspector-scale" type="range" min="100" max="250" step="25" value="100"><output id="inspector-scale-output" for="inspector-scale">100%</output><button type="button" id="inspector-prev"></button><button type="button" id="inspector-next"></button><button type="button" id="inspector-download"></button></div><p class="inspector-foot"></p>';
doc.querySelector("main").append(dialog);
const $=id=>doc.getElementById(id),preview=$("inspector-canvas"),viewport=$("inspector-viewport"),slider=$("inspector-scale");let selected=0;
$("inspector-title").textContent=words.title;$("inspector-close").textContent=words.close;
$("inspector-prev").textContent=words.back;$("inspector-next").textContent=words.next;
$("inspector-download").textContent=words.download;
$("inspector-scale-label").textContent=words.zoom;
dialog.querySelector(".inspector-foot").textContent=words.description;
function ready(){return !exportAll.disabled}
function name(i){return ratios[Math.floor(i/3)]+" · "+labels[i%3]}
function applyScale(){const n=Number(slider.value);preview.style.width=n+"%";$("inspector-scale-output").textContent=n+"%";viewport.scrollTo(0,0)}
function refresh(){
 if(!ready()){ $("inspector-label").textContent=words.unready;return false;}
 const src=cells[selected].querySelector("canvas");
 const ctx=preview.getContext("2d",{alpha:false});if(!ctx)return false;
 ctx.clearRect(0,0,500,340);ctx.drawImage(src,0,0,500,340);
 $("inspector-label").textContent=name(selected);
 preview.setAttribute("aria-label",name(selected));
 slider.value="100";applyScale();return true;
}
function open(i){if(!ready())return;selected=i;if(!refresh())return;dialog.showModal();$("inspector-close").focus()}
cells.forEach((cell,i)=>{
 const b=doc.createElement("button");b.type="button";b.className="panel-inspect-trigger";
 b.textContent=words.inspect;b.setAttribute("aria-label",words.inspect+" · "+name(i));
 b.addEventListener("click",()=>open(i));cell.append(b);
});
$("inspector-close").addEventListener("click",()=>dialog.close());
$("inspector-prev").addEventListener("click",()=>{selected=(selected+8)%9;refresh()});
$("inspector-next").addEventListener("click",()=>{selected=(selected+1)%9;refresh()});
slider.addEventListener("input",applyScale);
dialog.addEventListener("keydown",e=>{
 if(e.key==="ArrowLeft"||e.key==="ArrowRight"){
   if(e.target===slider)return;
   e.preventDefault();selected=(selected+(e.key==="ArrowRight"?1:8))%9;refresh();
 }
});
$("inspector-download").addEventListener("click",()=>{
 if(!ready())return;
 preview.toBlob(blob=>{
  if(!blob)return;
  const url=URL.createObjectURL(blob),a=doc.createElement("a");
  a.href=url;a.download="HADES_Stage_Alpha_Panel_"+ratios[Math.floor(selected/3)].replace(":","x")+"_"+["Hard","Tiered","Shadow"][selected%3]+"_"+doc.getElementById("codec").value.toUpperCase()+"_REVIEW.png";
  a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
 },"image/png");
});
doc.getElementById("codec").addEventListener("change",()=>{if(dialog.open)dialog.close()});
})();