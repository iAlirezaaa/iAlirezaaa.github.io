// Functional parity with the upstream Digital Garden template. No theme, social
// features, analytics or changes to the existing reading interface.
export function graphAtDepth(graph,currentId,depth=1) {
  const nodes=graph?.nodes||[], links=graph?.links||[];
  const available=new Set(nodes.map(n=>n.id));
  if(!available.has(currentId))return {nodes:[],links:[]};
  const valid=links.filter(l=>available.has(l.source)&&available.has(l.target));
  const ids=new Set([currentId]);
  let frontier=new Set([currentId]);
  const levels=Math.max(1,Math.min(3,Math.floor(Number(depth)||1)));
  for(let level=0;level<levels&&frontier.size;level++){
    const next=new Set();
    for(const {source,target} of valid){
      if(frontier.has(source)&&!ids.has(target))next.add(target);
      if(frontier.has(target)&&!ids.has(source))next.add(source);
    }
    for(const id of next)ids.add(id);
    frontier=next;
  }
  return {nodes:nodes.filter(n=>ids.has(n.id)),links:valid.filter(l=>ids.has(l.source)&&ids.has(l.target))};
}

// Only pages actually containing diagrams request the pinned Mermaid module.
// Strict mode disables HTML labels/click callbacks. Keep readable source if
// the network or a malformed diagram prevents rendering.
export async function renderMermaid(root,load=()=>import('https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs')){
  const blocks=Array.from(root.querySelectorAll('pre.mermaid:not([data-diagram-state])'));
  if(!blocks.length)return {rendered:0,failed:0};
  let engine;
  try{
    engine=(await load()).default;
    engine.initialize({startOnLoad:false,securityLevel:'strict',htmlLabels:false,flowchart:{htmlLabels:false},suppressErrorRendering:true});
  }catch{
    for(const block of blocks)block.dataset.diagramState='unavailable';
    return {rendered:0,failed:blocks.length};
  }
  let rendered=0,failed=0;
  for(const [i,block] of blocks.entries()){
    const source=block.textContent;
    try{
      const {svg}=await engine.render('hades-mermaid-'+i,source);
      block.innerHTML=svg;
      block.dataset.diagramState='rendered';
      rendered++;
    }catch{
      block.textContent=source;
      block.dataset.diagramState='invalid';
      failed++;
    }
  }
  return {rendered,failed};
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>renderMermaid(document),{once:true});
  else renderMermaid(document);
}
