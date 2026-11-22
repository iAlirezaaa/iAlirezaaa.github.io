/* HADES Contrast Studio · native PNG/WebP exporter · PUBLIC REVIEW.
   Original source imagery loaded unchanged from same-origin public files.
   Raster composition only, never an official vector master or FINAL approval. */
(() => {
  "use strict";
  const el = id => document.getElementById(id);
  const sizes = {wide:[1920,1080,"16x9"],portrait:[1080,1920,"9x16"],square:[1080,1080,"1x1"]};
  const status = el("export-status");
  const buttons = ["export-png","export-webp"].map(el);
  const fa = document.documentElement.lang === "fa";
  async function imageFrom(src) {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    if (img.decode) await img.decode();
    else await new Promise((resolve,reject) => {img.onload=resolve;img.onerror=reject;});
    if (!img.naturalWidth) throw new Error("Image did not decode: "+src);
    return img;
  }
  function measureLines(ctx,text,maxW,maxLines) {
    const words = String(text).trim().split(/\s+/).filter(Boolean);
    const lines=[];let line="";
    for(const word of words) {
      const tryLine = line ? line+" "+word : word;
      if(line && ctx.measureText(tryLine).width > maxW) { lines.push(line);line=word; }
      else line=tryLine;
    }
    if(line) lines.push(line);
    const trimmed=lines.slice(0,maxLines);
    if(lines.length>maxLines && trimmed.length) {
      let last=trimmed[trimmed.length-1];
      while(last.length>1 && ctx.measureText(last+"…").width>maxW) last=last.slice(0,-1);
      trimmed[trimmed.length-1]=last+"…";
    }
    return trimmed;
  }
  function textLines(ctx,text,x,y,maxW,lineHeight,maxLines) {
    const lines=measureLines(ctx,text,maxW,maxLines);
    for(let i=0;i<lines.length;i++)ctx.fillText(lines[i],x,y+i*lineHeight);
    return lines.length*lineHeight;
  }
  async function compose() {
    const ratio=el("ratio").value, family=el("family").value;
    const dims=sizes[ratio];if(!dims)throw new Error("Unknown output size");
    const [w,h,ratioTag]=dims,rtl=fa;
    const [bg,logo]=await Promise.all([
      imageFrom(el("backdrop").getAttribute("src")),
      el("mark").checked ? imageFrom("/hades/assets/IMG_7187(2).png") : Promise.resolve(null)
    ]);
    const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext("2d",{alpha:false});
    if(!ctx)throw new Error("Canvas is unavailable");
    ctx.drawImage(bg,0,0,w,h);
    ctx.save();
    if(rtl){ctx.translate(w,0);ctx.scale(-1,1);}
    const fog=ctx.createLinearGradient(0,0,w*.75,0);
    fog.addColorStop(0,"rgba(7,7,7,.46)");fog.addColorStop(1,"rgba(7,7,7,0)");
    ctx.fillStyle=fog;ctx.fillRect(0,0,w,h);ctx.restore();
    if(el("guides").checked){
      ctx.save();ctx.strokeStyle="rgba(239,75,50,.8)";
      ctx.lineWidth=Math.max(2,Math.round(w/800));ctx.setLineDash([11,9]);
      ctx.strokeRect(.08*w,.08*h,.84*w,.84*h);
      ctx.strokeStyle="rgba(238,223,209,.5)";ctx.setLineDash([3,10]);
      ctx.strokeRect(.13*w,.13*h,.74*w,.74*h);
      ctx.restore();
    }
    const px=.11*w, py=(ratio==="portrait"?.17:.13)*h;
    const panelW=.76*w, panelH=Math.min(.34*h,ratio==="portrait"?360:250);
    const padding=Math.max(22,Math.round(w*.019));
    ctx.fillStyle="rgba(16,15,14,.87)";
    ctx.fillRect(px,py,panelW,panelH);
    ctx.fillStyle="#EF4B32";
    ctx.fillRect(rtl?px+panelW-5:px,py,5,panelH);
    const tx=rtl?px+panelW-padding:px+padding;
    ctx.textAlign=rtl?"right":"left";ctx.direction=rtl?"rtl":"ltr";ctx.textBaseline="top";
    ctx.fillStyle="#F0E6DA";ctx.font="400 16px Arial,Tahoma,sans-serif";
    ctx.fillText("HADES / THE THIRD / REVIEW",tx,py+padding,Math.max(50,panelW-2*padding));
    const titleSize=ratio==="portrait"?36:Math.min(42,Math.round(w*.027));
    ctx.font="400 "+titleSize+"px "+(rtl?'Tahoma,"Noto Sans Arabic",sans-serif':'Arial,sans-serif');
    const titleY=py+padding+35;
    const titleH=textLines(ctx,el("headline").value,tx,titleY,panelW-2*padding,titleSize*1.35,ratio==="wide"?2:3);
    ctx.fillStyle="#E9DCD0";
    const subSize=ratio==="portrait"?21:Math.max(16,Math.round(w*.013));
    ctx.font="400 "+subSize+"px "+(rtl?'Tahoma,"Noto Sans Arabic",sans-serif':'Arial,sans-serif');
    textLines(ctx,el("subtitle").value,tx,titleY+titleH+10,panelW-2*padding,subSize*1.5,3);
    if(logo){
      // Independent dark plaque. Source PNG decoded without modification, recolor, trace or inversion.
      const pw=Math.round((ratio==="portrait"?.22:.13)*w);
      const ph=Math.round((ratio==="portrait"?.18:.23)*h);
      const x=rtl?w-pw-.1*w:.1*w,y=h-ph-(ratio==="portrait"?.09:.11)*h;
      ctx.fillStyle="#161514";ctx.fillRect(x,y,pw,ph);
      ctx.strokeStyle="rgba(230,217,199,.24)";ctx.lineWidth=2;ctx.strokeRect(x,y,pw,ph);
      // Match the existing optical viewport in CSS: object-fit contain, zoom x9,
      // clip ONLY the preview plaque. The owner-owned original file remains untouched.
      const innerW=pw-10,innerH=ph-10;
      const scale=Math.min(innerW/logo.width,innerH/logo.height);
      const dw=logo.width*scale*9,dh=logo.height*scale*9;
      ctx.save();ctx.beginPath();ctx.rect(x+5,y+5,innerW,innerH);ctx.clip();
      ctx.drawImage(logo,x+pw/2-dw/2,y+ph/2-dh/2,dw,dh);
      ctx.restore();
    }
    return {canvas,tag:"HADES_Contrast_"+family+"_"+ratioTag+"_"+(fa?"FA":"EN")+"_REVIEW"};
  }
  function blobFrom(canvas,mime) {
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob && blob.size>1000 && blob.type===mime ? resolve(blob) : reject(new Error("Encoder unavailable: "+mime)),mime,.92));
  }
  async function save(mime) {
    buttons.forEach(b=>b.disabled=true);
    status.textContent=fa?"در حال ساخت خروجی از فایل‌های اصلی…":"Composing from original source assets…";
    try {
      const {canvas,tag}=await compose(),blob=await blobFrom(canvas,mime);
      const ext=mime==="image/png"?"png":"webp",url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;a.download=tag+"."+ext;document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      status.textContent=(fa?"خروجی REVIEW ساخته شد: ":"REVIEW export created: ")+canvas.width+"×"+canvas.height+" "+ext.toUpperCase()+". "+(fa?"چاپ و خوانایی واقعی هنوز OPEN است.":"Print and real-device legibility remain OPEN.");
    }catch(err){
      status.textContent=(fa?"خطای خروجی؛ فایل ذخیره نشد: ":"Export failed; no file saved: ")+err.message;
      console.error("HADES EXPORT REVIEW:",err);
    }finally{buttons.forEach(b=>b.disabled=false);}
  }
  function updateLabel() {
    const dims=sizes[el("ratio").value];
    if(!dims)return;
    el("export-png").textContent=(fa?"دریافت PNG · ":"Download PNG · ")+dims[0]+"×"+dims[1];
  }
  el("ratio").addEventListener("change",updateLabel);
  updateLabel();
  el("export-png").addEventListener("click",()=>save("image/png"));
  el("export-webp").addEventListener("click",()=>save("image/webp"));
  window.HADES_EXPORT_REVIEW={compose,blobFrom}; // deterministic Chromium validation; never modifies originals
})();