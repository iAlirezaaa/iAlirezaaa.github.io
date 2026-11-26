// Independent spring/charge simulation, no fixed rectangular boundaries or invented edges.
export function forceStep(nodes, links, cfg, alpha=1, held=new Set()) {
  const unit=cfg.unit||1, cx=cfg.cx, cy=cfg.cy;
  const damping=.78;
  for(const n of nodes){
    const gravity=n.degree===0?.025:.0045;
    n.vx=(n.vx||0)+(cx-n.x)*gravity*alpha;
    n.vy=(n.vy||0)+(cy-n.y)*gravity*alpha;
  }
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j];
    let dx=(b.x-a.x)/unit,dy=(b.y-a.y)/unit,d=Math.hypot(dx,dy);
    if(d<.01){const angle=(i*17+j*13)*2.399963;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
    const repel=1250/(d*d+90);
    const collide=Math.max(0,((a.radius||5)+(b.radius||5))/unit+10-d)*.17;
    const force=Math.min(7,repel+collide)*alpha*unit;
    const fx=dx/d*force,fy=dy/d*force;
    a.vx-=fx;a.vy-=fy;b.vx+=fx;b.vy+=fy;
  }
  for(const {source:a,target:b} of links){
    const dx=(b.x-a.x)/unit,dy=(b.y-a.y)/unit,d=Math.max(.01,Math.hypot(dx,dy));
    const rest=49+Math.min(12,Math.sqrt(Math.max(a.degree,b.degree))*2);
    const strength=.055/Math.sqrt(Math.max(1,Math.min(a.degree,b.degree)));
    const f=(d-rest)*strength*alpha*unit;
    a.vx+=dx/d*f;a.vy+=dy/d*f;b.vx-=dx/d*f;b.vy-=dy/d*f;
  }
  let motion=0;
  for(const n of nodes){
    if(held.has(n.id)){n.vx=0;n.vy=0;continue;}
    n.vx*=damping;n.vy*=damping;
    const speed=Math.hypot(n.vx,n.vy), cap=12*unit;
    if(speed>cap){n.vx*=cap/speed;n.vy*=cap/speed;}
    n.x+=n.vx;n.y+=n.vy;motion=Math.max(motion,Math.hypot(n.vx,n.vy));
  }
  return motion;
}

export function createForceLayout(raw,edges,width,height,pinnedId=null){
  const degree=new Map(raw.map(n=>[n.id,0]));
  for(const e of edges){degree.set(e.source,(degree.get(e.source)||0)+1);degree.set(e.target,(degree.get(e.target)||0)+1);}
  const nodes=raw.map((n,i)=>{
    const a=i*2.3999632297,r=19*Math.sqrt(i+.5),d=degree.get(n.id)||0;
    return {...n,degree:d,radius:n.id===pinnedId?7:Math.max(3.5,Math.min(8,3.4+Math.sqrt(d)*.85)),x:Math.cos(a)*r,y:Math.sin(a)*r,vx:0,vy:0};
  });
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const links=edges.map(e=>({source:byId.get(e.source),target:byId.get(e.target)})).filter(e=>e.source&&e.target);
  const held=new Set(pinnedId===null?[]:[pinnedId]);
  const pin=byId.get(pinnedId);if(pin){pin.x=0;pin.y=0;}
  for(let i=0;i<320;i++)forceStep(nodes,links,{unit:1,cx:0,cy:0},i<240?1:Math.max(.08,1-(i-240)/86),held);
  if(!nodes.length)return {nodes,unit:1};
  const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y);
  const x0=pin?0:(Math.min(...xs)+Math.max(...xs))/2,y0=pin?0:(Math.min(...ys)+Math.max(...ys))/2;
  const rx=Math.max(24,...xs.map(x=>Math.abs(x-x0))),ry=Math.max(24,...ys.map(y=>Math.abs(y-y0)));
  const unit=Math.min(2.2,Math.max(.05,Math.min(width*.38/rx,height*.38/ry)));
  for(const n of nodes){n.x=width/2+(n.x-x0)*unit;n.y=height/2+(n.y-y0)*unit;n.vx=0;n.vy=0;}
  return {nodes,unit};
}
