/** A quiet, navigable network shared by the sidebar and its expanded view. */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const NS = 'http://www.w3.org/2000/svg';

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

// Components have independent forces. An unrelated article must not repel the
// useful connected network into a corner just because it has no links yet.
export function layoutGraphNodes(nodes, edges, width, height, currentId = null) {
  if (!nodes.length) return [];
  if (nodes.length === 1) return [{...nodes[0], x:width / 2, y:height / 2}];
  const byId = new Map(nodes.map(node => [node.id, node]));
  const neighbors = new Map(nodes.map(node => [node.id, new Set()]));
  for (const edge of edges) if (byId.has(edge.source) && byId.has(edge.target)) {
    neighbors.get(edge.source).add(edge.target); neighbors.get(edge.target).add(edge.source);
  }
  const visited = new Set(), components = [];
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const ids = new Set([node.id]), queue = [node.id]; visited.add(node.id);
    for (let i = 0; i < queue.length; i++) for (const id of neighbors.get(queue[i])) {
      if (visited.has(id)) continue;
      visited.add(id); ids.add(id); queue.push(id);
    }
    components.push({nodes:nodes.filter(item => ids.has(item.id)), edges:edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)), ids});
  }
  components.sort((a, b) => Number(b.ids.has(currentId)) - Number(a.ids.has(currentId)) || b.nodes.length - a.nodes.length);
  const placed = [];
  function centered(component, w, h, centerX, centerY, pinned = null) {
    const result = forceLayout(component.nodes, component.edges, w, h, pinned);
    if (pinned !== null) return result.map(node => ({...node, x:node.x + centerX - w / 2, y:node.y + centerY - h / 2}));
    const xs = result.map(node => node.x), ys = result.map(node => node.y);
    const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    const xScale = right > left ? w * .7 / (right - left) : 1;
    const yScale = bottom > top ? h * .72 / (bottom - top) : 1;
    return result.map(node => ({...node, x:centerX + (node.x - (left + right) / 2) * xScale,
      y:centerY + (node.y - (top + bottom) / 2) * yScale}));
  }
  if (components.length === 1) return centered(components[0], width, height, width / 2, height / 2, currentId);
  if (components[0].nodes.length > nodes.length * .65 || currentId !== null) {
    placed.push(...centered(components[0], width, height, width / 2, height / 2, currentId));
    // A deterministic set of peripheral pockets keeps disconnected notes
    // visibly separate. Pick the pocket with most clearance from real nodes.
    const pockets = [[.88,.12],[.12,.88],[.12,.12],[.88,.88],[.5,.08],[.92,.5],[.5,.92],[.08,.5]];
    for (const component of components.slice(1)) {
      const candidates = pockets.map(([x, y]) => centered(component, width * .2, height * .2, width * x, height * y));
      const clearance = candidate => Math.min(...candidate.flatMap(a => placed.map(b => Math.hypot((a.x - b.x) / width, (a.y - b.y) / height))));
      candidates.sort((a, b) => clearance(b) - clearance(a)); placed.push(...candidates[0]);
    }
  } else {
    // Several similarly sized networks share balanced cells rather than
    // pretending that separate components belong to one force simulation.
    const columns = Math.min(components.length, Math.ceil(Math.sqrt(components.length * width / height)));
    const rows = Math.ceil(components.length / columns), cellWidth = width / columns, cellHeight = height / rows;
    components.forEach((component, i) => {
      const row = Math.floor(i / columns), cellsInRow = Math.min(columns, components.length - row * columns);
      const x = (i % columns + .5) * cellWidth + (width - cellsInRow * cellWidth) / 2;
      placed.push(...centered(component, cellWidth, cellHeight, x, (row + .5) * cellHeight));
    });
  }
  const positions = new Map(placed.map(node => [node.id, node]));
  return nodes.map(node => positions.get(node.id));
}

// Finite deterministic simulation; no continuous movement while reading.
function forceLayout(nodes, edges, width, height, currentId = null) {
  if (nodes.length === 1) return [{...nodes[0], x:width / 2, y:height / 2}];
  const padding = Math.min(60, width * .13, height * .13);
  const availableWidth = width - padding * 2, availableHeight = height - padding * 2;
  const result = nodes.map((node, i) => {
    const angle = i * 2.3999632297;
    const radius = Math.sqrt((i + .5) / nodes.length) * .39;
    return {...node, x:width / 2 + Math.cos(angle) * availableWidth * radius,
      y:height / 2 + Math.sin(angle) * availableHeight * radius, fx:0, fy:0};
  });
  const byId = new Map(result.map(node => [node.id, node]));
  const validEdges = edges.map(edge => ({source:byId.get(edge.source), target:byId.get(edge.target)}))
    .filter(edge => edge.source && edge.target && edge.source !== edge.target);
  const ideal = Math.sqrt(availableWidth * availableHeight / result.length) * .9;
  const steps = Math.max(70, Math.min(200, Math.floor(2400 / Math.sqrt(result.length))));
  for (let step = 0; step < steps; step++) {
    for (const node of result) { node.fx = (width / 2 - node.x) * .14; node.fy = (height / 2 - node.y) * .14; }
    for (let i = 0; i < result.length; i++) for (let j = i + 1; j < result.length; j++) {
      const a = result[i], b = result[j], dx = a.x - b.x, dy = a.y - b.y;
      const distance = Math.max(1, Math.hypot(dx, dy)), force = ideal * ideal / distance;
      const x = dx / distance * force, y = dy / distance * force;
      a.fx += x; a.fy += y; b.fx -= x; b.fy -= y;
    }
    for (const {source:a, target:b} of validEdges) {
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.max(1, Math.hypot(dx, dy));
      const force = distance * distance / ideal * .5;
      const x = dx / distance * force, y = dy / distance * force;
      a.fx += x; a.fy += y; b.fx -= x; b.fy -= y;
    }
    const temperature = Math.min(width, height) * .035 * (1 - step / steps) + .08;
    for (const node of result) {
      if (node.id === currentId) { node.x = width / 2; node.y = height / 2; continue; }
      const distance = Math.max(1, Math.hypot(node.fx, node.fy));
      node.x = clamp(node.x + node.fx / distance * Math.min(distance, temperature), padding, width - padding);
      node.y = clamp(node.y + node.fy / distance * Math.min(distance, temperature), padding, height - padding);
    }
  }
  return result.map(({fx, fy, ...node}) => node);
}

// Initial center separation is independent of the force simulation. The local
// graph preserves its current note at the center and resize preserves positions.
export function separateGraphNodes(nodes, width, height, pinnedId = null) {
  const gap=Math.min(28,Math.sqrt(width*height/Math.max(1,nodes.length))*.68);
  const pad=Math.min(17,width/5,height/5);
  for(let round=0;round<36;round++){
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i],b=nodes[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
      if(d>=gap)continue;
      if(d<.001){const angle=(i*17+j*13)*2.399963;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
      const shift=(gap-d)*.53,ax=a.id===pinnedId?0:b.id===pinnedId?2:1,bx=b.id===pinnedId?0:a.id===pinnedId?2:1;
      a.x-=dx/d*shift*ax;a.y-=dy/d*shift*ax;b.x+=dx/d*shift*bx;b.y+=dy/d*shift*bx;
    }
    for(const n of nodes){if(n.id===pinnedId){n.x=width/2;n.y=height/2;}else{n.x=clamp(n.x,pad,width-pad);n.y=clamp(n.y,pad,height-pad);}}
  }
  return nodes;
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
    const nodes=separateGraphNodes(layoutGraphNodes(data.nodes,edges,width,height,pinned),width,height,pinned);
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
    let active = null, labelFrame = 0, destroyed = false;

    for (const node of nodes) {
      node.current = node.id === currentId;
      node.degree = degrees.get(node.id);
      node.radius = node.current ? 7 : clamp(3.2 + Math.sqrt(node.degree) * .8, 3.8, 7.5);
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
        moveNode(node, node.x + direction[0] * step, node.y + direction[1] * step);
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
      const maxVisible = expanded ? (width < 460 ? 6 : 12) : 4;
      for (const node of ordered) {
        node.label.style.visibility = 'hidden';
        if (used.length >= maxVisible && node.id !== active) continue;
        const chars = Array.from(node.title), maxChars = expanded ? (width < 460 ? 22 : 36) : 18;
        node.label.textContent = chars.length > maxChars ? chars.slice(0, maxChars - 1).join('') + '…' : node.title;
        for (const [dx, dy] of [[0, node.radius + 16], [0, -node.radius - 9], [node.radius + 9, 4], [-node.radius - 9, 4]]) {
          node.label.setAttribute('x', node.x + dx); node.label.setAttribute('y', node.y + dy);
          node.label.style.textAnchor = dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle';
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
    function moveNode(node, x, y) {
      node.x = clamp(x, 15, width - 15); node.y = clamp(y, 15, height - 15);
      container.dataset.layoutChanged = 'true'; geometry(); scheduleLabels();
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
      if (!pointers.size) { suppressUntil = 0; tapped = null; }
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
        for (const pointer of pointers.values()) { pointer.moved = true; pointer.node?.a.classList.remove('is-dragging'); }
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
      pointer.moved = true; event.preventDefault();
      if (pointer.node) {
        pointer.node.a.classList.add('is-dragging');
        const point = scenePoint(pointer.x, pointer.y);
        moveNode(pointer.node, point.x + pointer.offsetX, point.y + pointer.offsetY);
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
          for (const node of nodes) { node.x *= x; node.y *= y; }
          camera.dx *= x; camera.dy *= y; width = nextWidth; height = nextHeight;
          svg.setAttribute('viewBox', `0 0 ${width} ${height}`); geometry();
        }
        apply();
      },
      reset() {
        state.reflow();
        for (const node of nodes) { node.x = node.homeX * width; node.y = node.homeY * height; }
        camera.scale = 1; camera.dx = 0; camera.dy = 0;
        delete container.dataset.layoutChanged; geometry(); apply();
      },
      zoom,
      destroy() { destroyed = true; cancelAnimationFrame(labelFrame); },
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
    if (!reducedMotion.matches && typeof svg.animate === 'function') svg.animate([{opacity:.3}, {opacity:1}], {duration:180});
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
    openDialog(graphDialog); renderFull();
  }));
  $$('[data-graph-zoom]').forEach(button => button.addEventListener('click', () => states.get(full)?.zoom(button.dataset.graphZoom === 'in' ? 1.25 : .8)));
  $('[data-graph-reset]')?.addEventListener('click', () => states.get(full)?.reset());
  graphDialog?.addEventListener('close', () => { fullVersion++; requestAnimationFrame(() => states.get(miniature)?.reflow()); });
  const resizeObserver = new ResizeObserver(entries => {
    for (const {target} of entries) {
      if (!target.clientWidth || !target.clientHeight) continue;
      const state = states.get(target);
      if (state) state.reflow(); else if (target === miniature) renderMini();
    }
  });
  for (const container of [miniature, full]) if (container) resizeObserver.observe(container);
  renderMini();
}
