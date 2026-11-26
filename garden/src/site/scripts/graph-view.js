import {createForceLayout,forceStep} from './graph-physics.mjs';
/** A quiet, navigable network shared by the sidebar and its expanded view. */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const NS = 'http://www.w3.org/2000/svg';

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

export function installGraphViews({getGraph, here, trimPath, graphDialog, openDialog}) {
  const $ = (selector, within = document) => within?.querySelector(selector) ?? null;
  const $$ = (selector, within = document) => within ? [...within.querySelectorAll(selector)] : [];
  const numbers = new Intl.NumberFormat('fa-IR');
  const states = new WeakMap();
  const miniature = $('[data-local-graph]');
  const full = $('[data-global-graph]');
  const scopeButton = $('button[data-graph-scope]');
  let scope = 'local', miniVersion = 0, fullVersion = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function subset(graph, all) {
    const current = graph.nodes.find(node => trimPath(node.url) === here);
    if (all || !current) return {...graph, scope:'all'};
    const ids = new Set([current.id]);
    for (const edge of graph.links) {
      if (edge.source === current.id) ids.add(edge.target);
      if (edge.target === current.id) ids.add(edge.source);
    }
    return {nodes:graph.nodes.filter(node => ids.has(node.id)),
      links:graph.links.filter(edge => ids.has(edge.source) && ids.has(edge.target)), scope:'local'};
  }

  function unavailable(container) {
    const message = document.createElement('p');
    message.className = 'muted';
    message.textContent = 'گراف دریافت نشد. نوشته‌ها از فهرست در دسترس‌اند.';
    container.replaceChildren(message);
    container.dataset.graphReady = 'false';
  }

  function draw(container, data, expanded) {
    states.get(container)?.destroy();
    container.dataset.graphReady = 'false';
    container.dataset.scope = data.scope;
    delete container.dataset.layoutChanged;
    container.replaceChildren();
    let width = Math.max(200, container.clientWidth), height = Math.max(200, container.clientHeight);
    const ids = new Set(data.nodes.map(node => node.id)), seen = new Set();
    const edges = data.links.filter(edge => {
      if (!ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target) return false;
      const key = JSON.stringify([edge.source, edge.target].sort());
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    const degrees = new Map(data.nodes.map(node => [node.id, 0]));
    for (const edge of edges) {
      degrees.set(edge.source, degrees.get(edge.source) + 1);
      degrees.set(edge.target, degrees.get(edge.target) + 1);
    }
    const currentId = data.nodes.find(node => trimPath(node.url) === here)?.id ?? null;
    const pinned = !expanded && data.scope === 'local' ? currentId : null;
    const initial=createForceLayout(data.nodes,edges,width,height,pinned);
    const nodes=initial.nodes;
    let unit=initial.unit;
    const byId = new Map(nodes.map(node => [node.id, node]));
    const svg = svgElement('svg', {viewBox:`0 0 ${width} ${height}`, role:'group',
      tabindex:0, 'aria-label':'گراف نوشته‌ها؛ انتخاب نود برای خواندن، کشیدن برای جابه‌جایی، کلیدهای جهت برای حرکت و مثبت و منفی برای بزرگ‌نمایی.'});
    const scene = svgElement('g', {'data-graph-scene':''});
    svg.append(scene);
    const edgeElements = edges.map(edge => {
      const line = svgElement('line', {class:'graph-edge', 'data-source':edge.source, 'data-target':edge.target});
      scene.append(line);
      return {source:byId.get(edge.source), target:byId.get(edge.target), line};
    });
    // Container metadata also includes data-graph-count. Select the actual
    // status paragraph inside this view, never the other graph's container.
    const information = expanded ? graphDialog : container.closest('[data-local-graph-section]');
    const status = $(expanded ? 'p[data-graph-detail]' : 'p[data-local-detail]', information);
    const count = $(expanded ? 'p[data-graph-count]' : 'p[data-local-count]', information);
    if (count) count.textContent = `${numbers.format(nodes.length)} نوشته · ${numbers.format(edges.length)} ارتباط`;
    if (status) status.textContent = 'هر نقطه یک نوشته است. برای خواندن، آن را انتخاب کن.';
    const camera = {scale:1, dx:0, dy:0};
    let active = null, labelFrame = 0, destroyed = false, physicsFrame=0, heat=0;
    const held=new Set(pinned===null?[]:[pinned]);
    let dragging=0, tickCount=0;
    container.dataset.physicsEngine='spring-charge-v1';
    container.dataset.physicsRunning='false';
    container.dataset.physicsTicks='0';

    for (const node of nodes) {
      node.current = node.id === currentId;
      node.degree = degrees.get(node.id);
      const density=Math.min(1,Math.sqrt(width*height/Math.max(1,nodes.length))/56);
      node.radius=(node.current?7:clamp(3.2+Math.sqrt(node.degree)*.8,3.8,7.5))*Math.max(.62,density);
      node.homeX = node.x / width; node.homeY = node.y / height;
      node.a = svgElement('a', {href:node.url, class:'graph-node', tabindex:0,
        'data-current':node.current, 'data-graph-id':node.id,
        'data-kind':/\/notes(?:\/|$)/.test(node.url) ? 'note' : 'article', 'aria-label':node.title});
      const title = svgElement('title'); title.textContent = node.title;
      node.hit = svgElement('circle', {r:Math.max(13, node.radius + 6), class:'graph-hit'});
      node.dot = svgElement('circle', {r:node.radius});
      node.label = svgElement('text', {'aria-hidden':'true'});
      node.a.append(title, node.hit, node.dot, node.label); scene.append(node.a);
      node.a.addEventListener('pointerenter', () => inspect(node.id));
      node.a.addEventListener('pointerleave', () => { if (document.activeElement !== node.a) inspect(null); });
      node.a.addEventListener('focus', () => inspect(node.id));
      node.a.addEventListener('blur', () => inspect(null));
      node.a.addEventListener('keydown', event => {
        const direction = {ArrowLeft:[-1, 0], ArrowRight:[1, 0], ArrowUp:[0, -1], ArrowDown:[0, 1]}[event.key];
        if (!direction) return;
        event.preventDefault(); inspect(node.id);
        const step = (event.shiftKey ? 28 : 12) / camera.scale;
        moveNode(node,node.x+direction[0]*step,node.y+direction[1]*step);
        if(!reducedMotion.matches)wake(.27);
      });
    }
    container.append(svg);

    function geometry() {
      for (const node of nodes) for (const circle of [node.dot, node.hit]) {
        circle.setAttribute('cx', node.x); circle.setAttribute('cy', node.y);
      }
      for (const edge of edgeElements) {
        edge.line.setAttribute('x1', edge.source.x); edge.line.setAttribute('y1', edge.source.y);
        edge.line.setAttribute('x2', edge.target.x); edge.line.setAttribute('y2', edge.target.y);
      }
    }
    function inspect(id) {
      active = id;
      const neighbors = new Set([id]);
      for (const edge of edgeElements) {
        const related = edge.source.id === id || edge.target.id === id;
        edge.line.classList.toggle('is-related', id !== null && related);
        edge.line.classList.toggle('is-dim', id !== null && !related);
        if (related) { neighbors.add(edge.source.id); neighbors.add(edge.target.id); }
      }
      for (const node of nodes) {
        node.a.classList.toggle('is-related', id !== null && neighbors.has(node.id));
        node.a.classList.toggle('is-dim', id !== null && !neighbors.has(node.id));
      }
      if (id !== null && status) status.textContent = `${byId.get(id).title} · ${numbers.format(byId.get(id).degree)} ارتباط`;
      placeLabels();
    }
    function placeLabels() {
      if (destroyed || !svg.isConnected) return;
      const bounds = svg.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const used = [], dots = nodes.map(node => ({id:node.id, rect:node.dot.getBoundingClientRect()}));
      const intersects = (a, b, pad = 4) => a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;
      const ordered = [...nodes].sort((a, b) => Number(b.id === active) - Number(a.id === active) || Number(b.current) - Number(a.current) || b.degree - a.degree || String(a.id).localeCompare(String(b.id)));
      const matrix=scene.getScreenCTM(), screenScale=Math.max(.05,matrix?Math.hypot(matrix.a,matrix.b):camera.scale);
      const baseFont=expanded?13:11;
      const font=clamp(baseFont*Math.sqrt(camera.scale),10,17)/screenScale;
      const maxVisible=expanded?(camera.scale<.85?4:camera.scale<1.4?(width<460?7:13):camera.scale<2.3?24:nodes.length):(camera.scale>1.5?10:4);
      for (const node of ordered) {
        node.label.style.visibility = 'hidden';
        if (used.length >= maxVisible && node.id !== active) continue;
        if(heat>.45&&!node.current&&node.id!==active&&node.degree<3)continue;
        const chars=Array.from(node.title),maxChars=node.id===active?90:camera.scale>1.8?54:expanded?(width<460?22:36):18;
        node.label.textContent=chars.length>maxChars?chars.slice(0,maxChars-1).join('')+'…':node.title;
        node.label.style.fontSize=font+'px';node.label.style.strokeWidth=(3/screenScale)+'px';
        const space=8/screenScale,offset=font*1.05;
        for (const [dx,dy] of [[0,node.radius+offset+space/2],[0,-node.radius-space],[node.radius+space,font*.35],[-node.radius-space,font*.35]]) {
          node.label.setAttribute('x', node.x + dx); node.label.setAttribute('y', node.y + dy);
          node.label.style.textAnchor=dx>0?'end':dx<0?'start':'middle';
          const rect = node.label.getBoundingClientRect();
          if (rect.left < bounds.left + 5 || rect.right > bounds.right - 5 || rect.top < bounds.top + 5 || rect.bottom > bounds.bottom - 5 || used.some(other => intersects(rect, other)) || dots.some(other => other.id !== node.id && intersects(rect, other.rect, 3))) continue;
          node.label.style.visibility = 'visible'; used.push(rect); break;
        }
      }
    }
    function scheduleLabels() {
      if (!labelFrame) labelFrame = requestAnimationFrame(() => { labelFrame = 0; placeLabels(); });
    }
    function apply() {
      scene.setAttribute('transform', `translate(${width / 2 + camera.dx} ${height / 2 + camera.dy}) scale(${camera.scale}) translate(${-width / 2} ${-height / 2})`);
      container.dataset.scale = String(camera.scale); placeLabels();
    }
    // Use the real transform: SVG letterboxing and zoom invalidate bounding-box ratios.
    function matrixPoint(element,x,y){
      const matrix=element.getScreenCTM();
      return matrix?new DOMPoint(x,y).matrixTransform(matrix.inverse()):null;
    }
    function viewportPoint(x,y){return matrixPoint(svg,x,y)||{x:width/2,y:height/2};}
    function scenePoint(x,y){
      const direct=matrixPoint(scene,x,y);
      if(direct)return direct;
      const point=viewportPoint(x,y);
      return {x:(point.x-width/2-camera.dx)/camera.scale+width/2,y:(point.y-height/2-camera.dy)/camera.scale+height/2};
    }
    // The scene has no artificial rectangular walls. Only the camera clips it.
    function moveNode(node,x,y) {
      node.x=x;node.y=y;node.vx=0;node.vy=0;
      container.dataset.layoutChanged='true';geometry();scheduleLabels();
    }
    function stopPhysics(){
      cancelAnimationFrame(physicsFrame);physicsFrame=0;heat=0;
      container.dataset.physicsRunning='false';
      for(const n of nodes){n.vx=0;n.vy=0;}
    }
    function visibleGraph(){
      return !document.hidden&&container.isConnected&&container.clientWidth>0&&container.clientHeight>0&&getComputedStyle(container).visibility==='visible'&&(!expanded||graphDialog.open);
    }
    function animatePhysics(){
      physicsFrame=0;
      if(destroyed||reducedMotion.matches||!visibleGraph()){stopPhysics();return;}
      heat=dragging?Math.max(.38,heat*.975):heat*.94;
      const velocity=forceStep(nodes,edgeElements,{unit,cx:width/2,cy:height/2},heat,held);
      tickCount++;container.dataset.physicsTicks=String(tickCount);
      geometry();
      if(tickCount%3===0)placeLabels();
      if(!dragging&&(heat<.012||velocity<.015&&heat<.1)){stopPhysics();placeLabels();return;}
      physicsFrame=requestAnimationFrame(animatePhysics);
    }
    function wake(amount){
      if(destroyed||reducedMotion.matches||!visibleGraph())return;
      heat=Math.max(heat,amount);container.dataset.physicsRunning='true';
      if(!physicsFrame)physicsFrame=requestAnimationFrame(animatePhysics);
    }
    function zoom(factor, clientX, clientY) {
      const rect = svg.getBoundingClientRect();
      const x = clientX ?? rect.left + rect.width / 2, y = clientY ?? rect.top + rect.height / 2;
      const point = scenePoint(x, y), screen = viewportPoint(x, y);
      camera.scale = clamp(camera.scale * factor, .55, 4);
      camera.dx = screen.x - width / 2 - (point.x - width / 2) * camera.scale;
      camera.dy = screen.y - height / 2 - (point.y - height / 2) * camera.scale;
      apply();
    }

    // One pointer moves a node or pans the canvas. A second pointer always
    // switches to pinch zoom, even when the gesture began on a node.
    const pointers = new Map();
    let pinch = null, suppressUntil = 0, tapped = null;
    svg.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (!pointers.size) { suppressUntil = 0; tapped = null; stopPhysics(); }
      const point = scenePoint(event.clientX, event.clientY);
      // Hit areas can overlap when the corpus grows. Resolve to the closest
      // actual dot, not whichever transparent SVG circle was painted last.
      let node=null,distance=Infinity;
      const transform=scene.getScreenCTM(),scale=transform?Math.hypot(transform.a,transform.b):1;
      for(const candidate of nodes){
        const d=Math.hypot(candidate.x-point.x,candidate.y-point.y)*scale;
        const limit=clamp(Math.max(13,candidate.radius+6)*scale,10,event.pointerType==='touch'?22:18);
        if(d<=limit&&d<distance){node=candidate;distance=d;}
      }
      const record = {id:event.pointerId, x:event.clientX, y:event.clientY, startX:event.clientX, startY:event.clientY,
        dx:camera.dx, dy:camera.dy, node, offsetX:node ? node.x - point.x : 0, offsetY:node ? node.y - point.y : 0, moved:false};
      pointers.set(event.pointerId, record);
      (node?.a || svg).setPointerCapture(event.pointerId);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        pinch = {distance:Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), scale:camera.scale, point:scenePoint(x, y)};
        for (const pointer of pointers.values()) { if(pointer.node&&pointer.node.id!==pinned)held.delete(pointer.node.id);pointer.moved = true; pointer.node?.a.classList.remove('is-dragging'); }
        dragging=0;stopPhysics();
      }
    });
    svg.addEventListener('pointermove', event => {
      const pointer = pointers.get(event.pointerId); if (!pointer) return;
      pointer.x = event.clientX; pointer.y = event.clientY;
      if (pinch && pointers.size >= 2) {
        event.preventDefault();
        const [a, b] = [...pointers.values()], point = viewportPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
        camera.scale = clamp(pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance, .55, 4);
        camera.dx = point.x - width / 2 - (pinch.point.x - width / 2) * camera.scale;
        camera.dy = point.y - height / 2 - (pinch.point.y - height / 2) * camera.scale;
        apply(); return;
      }
      if (!pointer.moved && Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) < 6) return;
      const firstMove=!pointer.moved;pointer.moved=true;event.preventDefault();
      if(pointer.node){
        if(firstMove){dragging++;held.add(pointer.node.id);inspect(pointer.node.id);}
        pointer.node.a.classList.add('is-dragging');
        const point=scenePoint(pointer.x,pointer.y);
        moveNode(pointer.node,point.x+pointer.offsetX,point.y+pointer.offsetY);
        wake(.72);
      } else {
        svg.classList.add('is-panning');
        const from=viewportPoint(pointer.startX,pointer.startY),to=viewportPoint(pointer.x,pointer.y);
        camera.dx=pointer.dx+to.x-from.x;camera.dy=pointer.dy+to.y-from.y;
        apply();
      }
    });
    function finish(event) {
      const pointer = pointers.get(event.pointerId); if (!pointer) return;
      if (pointer.moved || pinch) { suppressUntil = performance.now() + 650; tapped = null; }
      else if (event.type === 'pointerup' && pointer.node) tapped = {node:pointer.node, until:performance.now()+650};
      if(pointer.node&&pointer.moved&&!pinch){
        dragging=Math.max(0,dragging-1);if(pointer.node.id!==pinned)held.delete(pointer.node.id);
        wake(.45);
      }
      pointer.node?.a.classList.remove('is-dragging'); pointers.delete(event.pointerId);
      if (pinch) {
        pinch = null;
        for (const remaining of pointers.values()) Object.assign(remaining, {node:null, startX:remaining.x, startY:remaining.y, dx:camera.dx, dy:camera.dy, moved:true});
      }
      if (!pointers.size) svg.classList.remove('is-panning');
      placeLabels();
    }
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) svg.addEventListener(event, finish);
    svg.addEventListener('click', event => {
      if (event.detail === 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (performance.now() < suppressUntil) { event.preventDefault(); event.stopPropagation(); return; }
      const chosen = tapped && performance.now() < tapped.until ? tapped.node : null;
      tapped = null;
      if (chosen && event.target.closest('.graph-node') !== chosen.a) {
        event.preventDefault(); event.stopPropagation(); location.assign(chosen.url);
      }
    }, true);
    if (expanded) svg.addEventListener('wheel', event => {
      event.preventDefault(); zoom(Math.exp(-event.deltaY * .0015), event.clientX, event.clientY);
    }, {passive:false});

    const state = {
      reflow() {
        if (!container.clientWidth || !container.clientHeight) return;
        const nextWidth = Math.max(200, container.clientWidth), nextHeight = Math.max(200, container.clientHeight);
        if (nextWidth !== width || nextHeight !== height) {
          const x = nextWidth / width, y = nextHeight / height;
          stopPhysics();
          for (const node of nodes) { node.x *= x; node.y *= y; }
          unit*=Math.sqrt(x*y);
          camera.dx *= x; camera.dy *= y; width = nextWidth; height = nextHeight;
          svg.setAttribute('viewBox', `0 0 ${width} ${height}`); geometry();
        }
        apply();
      },
      reset() {
        stopPhysics();dragging=0;held.clear();if(pinned!==null)held.add(pinned);
        state.reflow();
        for (const node of nodes) { node.x = node.homeX * width; node.y = node.homeY * height; }
        camera.scale = 1; camera.dx = 0; camera.dy = 0;
        delete container.dataset.layoutChanged; geometry(); apply();
      },
      zoom,
      stop:stopPhysics,
      destroy() { destroyed = true; stopPhysics();cancelAnimationFrame(labelFrame); },
    };
    states.set(container, state);
    svg.addEventListener('keydown', event => {
      if (event.target !== svg) return;
      const direction = {ArrowLeft:[-1, 0], ArrowRight:[1, 0], ArrowUp:[0, -1], ArrowDown:[0, 1]}[event.key];
      if (direction) { event.preventDefault(); camera.dx += direction[0] * 32; camera.dy += direction[1] * 32; apply(); }
      else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.25); }
      else if (event.key === '-') { event.preventDefault(); zoom(.8); }
      else if (event.key === '0' || event.key === 'Home') { event.preventDefault(); state.reset(); }
    });
    geometry(); apply();
    document.fonts?.ready.then(() => { if (!destroyed) placeLabels(); });
    if(!reducedMotion.matches&&visibleGraph()&&nodes.length>1){
      // Start from a gently compressed equilibrium and let the same physical
      // engine unfold it. No canned CSS animation or continuous idle motion.
      for(const n of nodes){if(n.id!==pinned){n.x=width/2+(n.x-width/2)*.79;n.y=height/2+(n.y-height/2)*.79;}}
      geometry();placeLabels();wake(.8);
    }
    container.dataset.graphCount = String(nodes.length);
    container.dataset.graphReady = 'true';
  }

  async function renderMini() {
    if (!miniature?.clientWidth) return;
    const version = ++miniVersion;
    try {
      const graph = await getGraph(); if (version !== miniVersion || !miniature.clientWidth) return;
      const current = graph.nodes.some(node => trimPath(node.url) === here);
      if (scopeButton) {
        scopeButton.hidden = !current;
        scopeButton.setAttribute('aria-pressed', String(scope === 'all'));
        scopeButton.setAttribute('aria-label', scope === 'all' ? 'نمایش گراف این نوشته' : 'نمایش گراف همهٔ نوشته‌ها');
        scopeButton.title = scope === 'all' ? 'گراف این نوشته' : 'گراف همهٔ نوشته‌ها';
      }
      draw(miniature, subset(graph, scope === 'all'), false);
    } catch { if (version === miniVersion) unavailable(miniature); }
  }
  async function renderFull() {
    if (!full || !graphDialog?.open) return;
    const version = ++fullVersion;
    try {
      const graph = await getGraph(); if (version !== fullVersion || !graphDialog.open) return;
      draw(full, {...graph, scope:'all'}, true);
    } catch { if (version === fullVersion) unavailable(full); }
  }
  scopeButton?.addEventListener('click', () => { scope = scope === 'all' ? 'local' : 'all'; renderMini(); });
  $$('[data-global-graph-open]').forEach(button => button.addEventListener('click', () => {
    openDialog(graphDialog); requestAnimationFrame(()=>renderFull());
  }));
  $$('[data-graph-zoom]').forEach(button => button.addEventListener('click', () => states.get(full)?.zoom(button.dataset.graphZoom === 'in' ? 1.25 : .8)));
  $('[data-graph-reset]')?.addEventListener('click', () => states.get(full)?.reset());
  graphDialog?.addEventListener('close', () => { fullVersion++;states.get(full)?.stop();requestAnimationFrame(() => states.get(miniature)?.reflow()); });
  const resizeObserver = new ResizeObserver(entries => {
    for (const {target} of entries) {
      if (!target.clientWidth || !target.clientHeight) continue;
      const state = states.get(target);
      if (state) state.reflow(); else if (target === miniature) renderMini();
    }
  });
  for (const container of [miniature, full]) if (container) resizeObserver.observe(container);
  const panelObserver=new MutationObserver(()=>{
    if(!miniature)return;
    if(getComputedStyle(miniature).visibility!=='visible')states.get(miniature)?.stop();
    else if(!states.has(miniature))renderMini();
  });
  panelObserver.observe(document.body,{attributes:true,attributeFilter:['data-open-panel']});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){states.get(full)?.stop();states.get(miniature)?.stop();}});
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches){states.get(full)?.stop();states.get(miniature)?.stop();}});
  renderMini();
}
