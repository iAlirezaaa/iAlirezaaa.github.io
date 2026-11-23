/* HADES source-stage-resolution panel export / PUBLIC REVIEW.
 * Re-composites unchanged same-origin stage SVG + synthetic transparent fixture.
 * No uploads, no invented logo, no image upscaling claim for 512px fixture.
 * Only #EF4B32 is owner-approved; all other colors/layouts REVIEW. */
(() => {
  "use strict";
  const d=document, dialog=d.getElementById("hades-panel-inspector"), controls=dialog?.querySelector(".inspector-actions");
  if(!dialog || !controls || !d.getElementById("codec"))return;
  const fa=d.body.dataset.lang==="fa";
  const b=d.createElement("button");b.type="button";b.id="inspector-native-download";
  b.textContent=fa?"دریافت PNG با ابعاد اصلی استیج":"Download source-stage-size PNG";
  b.setAttribute("aria-label",fa?"ساخت PNG از SVG اصلی استیج، بدون افزایش وضوح سوژه":"Render PNG from original stage SVG, fixture still 512 pixels");
  const state=d.createElement("p");state.id="inspector-native-status";state.setAttribute("role","status");state.setAttribute("aria-live","polite");
  state.textContent=fa?"منبع استیج دست‌نخورده؛ وضوح نمونهٔ شفاف ۵۱۲px باقی می‌ماند.":"Original SVG stage unchanged; transparent fixture remains 512px source.";
  controls.append(b,state);
  const base="/hades/library/object-stages/";
  const stages=[
    {file:"HADES_Object_Stage_16x9_REVIEW.svg",w:1920,h:1080,x:965,y:735,ratio:"16x9"},
    {file:"HADES_Object_Stage_9x16_REVIEW.svg",w:1080,h:1920,x:540,y:1380,ratio:"9x16"},
    {file:"HADES_Object_Stage_1x1_REVIEW.svg",w:1080,h:1080,x:590,y:730,ratio:"1x1"}
  ];
  const kinds=["hard-edge","tiered-alpha","soft-shadow"];
  function load(url){return new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error("SOURCE_UNAVAILABLE: "+url));image.src=url;
  });}
  function blobFrom(canvas){return new Promise((resolve,reject)=>{
    try{canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("PNG_ENCODING_FAILED")),"image/png");}
    catch(err){reject(err);}
  });}
  let busy=false;
  b.addEventListener("click",async()=>{
    if(busy || !dialog.open || d.getElementById("export").disabled)return;
    const i=Number(dialog.dataset.panelIndex);
    const codec=d.getElementById("codec").value;
    if(!Number.isInteger(i)||i<0||i>8||!["png","webp"].includes(codec)){
      state.textContent="OPEN: INVALID_PANEL_OR_CODEC";return;
    }
    const st=stages[Math.floor(i/3)],kind=kinds[i%3];busy=true;b.disabled=true;
    state.textContent=fa?"در حال ساخت از فایل‌های اصلی…":"Rendering from unchanged source assets…";
    try{
      const [stage,fixture]=await Promise.all([
        load(base+st.file),
        load(base+"alpha-fixtures/raster/HADES_Alpha_"+kind+"_512_REVIEW."+codec)
      ]);
      if(stage.naturalWidth!==st.w||stage.naturalHeight!==st.h || fixture.naturalWidth!==512||fixture.naturalHeight!==512)
        throw new Error("SOURCE_DIMENSIONS_MISMATCH");
      const canvas=d.createElement("canvas");canvas.width=st.w;canvas.height=st.h;
      const ctx=canvas.getContext("2d",{alpha:false});
      if(!ctx)throw new Error("CANVAS_UNAVAILABLE");
      // No contact-sheet letterbox, frame, badge or legend is baked into the native image.
      ctx.drawImage(stage,0,0,st.w,st.h);
      const subjectW=st.w*0.27,subjectH=subjectW*fixture.naturalHeight/fixture.naturalWidth;
      ctx.drawImage(fixture,st.x-subjectW/2,st.y-subjectH*0.87,subjectW,subjectH);
      const png=await blobFrom(canvas);const url=URL.createObjectURL(png);
      const a=d.createElement("a");a.href=url;
      a.download="HADES_Stage_Alpha_Native_"+st.ratio+"_"+kind+"_"+codec.toUpperCase()+"_PUBLIC_REVIEW.png";
      a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
      b.dataset.lastSize=st.w+"x"+st.h;
      state.textContent=(fa?"ساخته شد: ":"Rendered: ")+st.w+" × "+st.h+" / PUBLIC REVIEW · fixture 512px";
    }catch(err){state.textContent="OPEN: "+String(err?.message||err);}
    finally{busy=false;b.disabled=false;}
  });
})();
