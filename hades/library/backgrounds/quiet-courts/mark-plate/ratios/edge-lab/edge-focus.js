"use strict";
// Diagnostic only: original brand files remain untouched. All coordinates are native pixels.
function focusRect(width,height,cx,cy,size){
  const w=Math.min(size,width),h=Math.min(size,height);
  return [Math.max(0,Math.min(width-w,Math.round(cx-w/2))),Math.max(0,Math.min(height-h,Math.round(cy-h/2))),w,h];
}
function referenceGradient(data,width,height,x,y){
  const p=4*(y*width+x);let g=0;
  for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
    const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=width||yy>=height)continue;
    const q=4*(yy*width+xx);for(let k=0;k<3;k++)g=Math.max(g,Math.abs(data[p+k]-data[q+k]));
  }return g;
}
function strongestEdge(data,width,height){
  let best=-1,point=[Math.floor(width/2),Math.floor(height/2)];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const g=referenceGradient(data,width,height,x,y);
    if(g>best){best=g;point=[x,y];}
  }return point;
}
function edgeMetrics(a,b,width,height,rect,threshold=16){
  if(a.length!==width*height*4||b.length!==a.length)throw Error("edge data size mismatch");
  const [x,y,w,h]=rect;let count=0,sum=0,max=0,changed=0,over=0;
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
    if(referenceGradient(a,width,height,xx,yy)<threshold)continue;
    count++;let d=0,p=4*(yy*width+xx);
    for(let k=0;k<3;k++){const e=Math.abs(a[p+k]-b[p+k]);sum+=e;d=Math.max(d,e);}
    max=Math.max(max,d);changed+=Number(d>0);over+=Number(d>8);
  }
  return {threshold,edgePixels:count,mae:count?sum/(3*count):null,max:count?max:null,changed,over};
}
if(typeof module!=="undefined")module.exports={focusRect,referenceGradient,strongestEdge,edgeMetrics};
