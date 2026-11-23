/* HADES alpha fixture lab — PUBLIC REVIEW; synthetic source only.
 * Browser-local SVG -> 512px transparent PNG; no user data upload. */
(()=>{'use strict';
 const fa=document.body.dataset.lang==='fa';
 const $=id=>document.getElementById(id);
 const t=(en,faText)=>fa?faText:en;
 const root='/hades/library/object-stages/alpha-fixtures/';
 const kinds=['hard-edge','tiered-alpha','soft-shadow'];
 let image=null, last='',generation=0;
 const canvas=$('fixtureCanvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 const format=n=>new Intl.NumberFormat(fa?'fa-IR':'en-US').format(n);
 function message(s){$('state').textContent=s;}
 function inspect(){
   const img=ctx.getImageData(0,0,512,512).data;
   let nonzero=0,partial=0,above=0, fringe=0;
   const cutoff=Number($('cutoff').value);
   for(let i=3;i<img.length;i+=4){
     const a=img[i];if(a>0)nonzero++;if(a>0&&a<255)partial++;
     if(a>=cutoff)above++;if(a>0&&a<cutoff)fringe++;
   }
   $('cutoffText').textContent=format(cutoff)+'/255';
   $('metrics').textContent=t(
     'Visible at cutoff: '+format(above)+' px · Semi-transparent: '+format(partial)+' px · Below cutoff: '+format(fringe)+' px',
     'پیکسلِ قابل‌دیدن: '+format(above)+' · نیمه‌شفاف: '+format(partial)+' · زیر آستانه: '+format(fringe));
   if(nonzero===0||above===0)message(t('No visible pixels: OPEN / review fixture','پیکسل قابل‌دیدن وجود ندارد: نیازمند بررسی'));
 }
 async function render(){
   const token=++generation;
   const kind=$('kind').value;if(!kinds.includes(kind))return;
   const src=root+'HADES_Alpha_'+kind+'_REVIEW.svg';
   $('png').disabled=true;$('svg').href=src;
   message(t('Loading approved-for-demo synthetic SVG…','در حال بارگذاری SVG آزمایشی مجاز…'));
   try{
     const im=new Image();im.src=src;await im.decode();
     if(token!==generation)return;
     ctx.clearRect(0,0,512,512);ctx.drawImage(im,0,0,512,512);
     image=im;last=kind;$('png').disabled=false;inspect();
     message(t('512 × 512 transparent canvas · synthetic only · PUBLIC REVIEW','بوم شفاف ۵۱۲ × ۵۱۲ · صرفاً آزمایشی · PUBLIC REVIEW'));
   }catch(err){message(t('Failed to read source SVG; PNG is unavailable','خطا در خواندن SVG؛ خروجی PNG در دسترس نیست'));$('png').disabled=true;}
 }
 function exportPNG(){
   if(!image||last!==$('kind').value)return;
   canvas.toBlob(blob=>{
     if(!blob){message(t('PNG encoding failed','ساخت PNG ناموفق بود'));return;}
     const url=URL.createObjectURL(blob),a=document.createElement('a');
     a.href=url;a.download='HADES_Alpha_'+last+'_512_REVIEW.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),8000);
   },'image/png');
 }
 $('kind').addEventListener('change',render);
 $('backdrop').addEventListener('change',()=>{$('plate').dataset.surface=$('backdrop').value});
 $('cutoff').addEventListener('input',()=>{if(image)inspect()});
 $('png').addEventListener('click',exportPNG);
 render();
})();