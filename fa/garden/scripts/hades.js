import { installCodeCopy } from './reader-tools.js';
import { installReadingTrail } from './reading-trail.js';
import { installWorkspacePanes } from './workspace-panes.js';
/** HADES' Persian reading layer for the upstream Eleventy Digital Garden. */
export function normalizeSearchText(value = '') {
  return String(value).normalize('NFKC').toLocaleLowerCase('fa-IR')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[إأٱآ]/g, 'ا')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u200c\u200d\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
export function searchNotes(notes, query, limit = 40) {
  const normalized = normalizeSearchText(query).slice(0, 240);
  const terms = normalized.split(' ').filter(Boolean);
  if (!terms.length) return notes.slice(0, 10);
  return notes.map(note => {
    const title = normalizeSearchText(note.title);
    const aliases = normalizeSearchText(Array.isArray(note.aliases) ? note.aliases.join(' ') : note.aliases || '');
    const tags = normalizeSearchText((note.tags || []).join(' '));
    const body = normalizeSearchText(note.content || note.text || '');
    const text = [title, aliases, tags, body].join(' ');
    const compact = text.replaceAll(' ', '');
    if (!terms.every(term => text.includes(term) || compact.includes(term))) return null;
    let score = title === normalized ? 120 : title.includes(normalized) ? 70 : 0;
    for (const term of terms) score += title.includes(term) ? 18 : aliases.includes(term) ? 14 : tags.includes(term) ? 10 : 1;
    return {note, score};
  }).filter(Boolean).sort((a,b) => b.score-a.score || a.note.title.localeCompare(b.note.title,'fa')).slice(0,limit).map(result => result.note);
}

if (typeof document !== 'undefined') { initializeGarden(); installFigureViewer(); installCodeCopy(); }
function initializeGarden() {
  const root = document.documentElement;
  const $ = (selector, within = document) => within.querySelector(selector);
  const $$ = (selector, within = document) => [...within.querySelectorAll(selector)];
  const BASE = '/fa/garden/';
  const trimPath = value => {
    try { return decodeURI(new URL(value, location.origin).pathname).replace(/\/+$/, '') || '/'; }
    catch { return ''; }
  };
  const here = trimPath(location.pathname);
  const numbers = new Intl.NumberFormat('fa-IR');
  const readableDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian',{dateStyle:'long',timeZone:'Asia/Tehran'});
  const safeStorage = {
    read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    write(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch { return false; } },
  };
  const urlAllowed = value => {
    try { const url = new URL(value,location.origin); return url.origin===location.origin && /^\/(?:fa|hades)(?:\/|$)/.test(url.pathname); }
    catch { return false; }
  };
  function textElement(tag, text, className) { const el=document.createElement(tag); el.textContent=text;if(className)el.className=className;return el; }
  function cleanText(value) { const el=document.createElement('textarea');el.innerHTML=String(value);return el.value.replace(/\s+/g,' ').trim(); }

  // Apply a validated preference set. Storage failure never blocks reading.
  const defaults={theme:'system',size:'regular',measure:'regular',leading:'regular'};
  const choices={theme:['system','light','dark'],size:['small','regular','large','extra'],measure:['narrow','regular','wide'],leading:['compact','regular','airy']};
  let preferences={...defaults,...safeStorage.read('hades-garden-reading',{})};
  function applyPreferences(save=false) {
    for(const key of Object.keys(defaults)) {
      if(!choices[key].includes(preferences[key]))preferences[key]=defaults[key];
      root.dataset[key]=preferences[key];
      const control=$('[data-setting="'+key+'"]');if(control)control.value=preferences[key];
    }
    if(save) {
      const status=$('[data-settings-status]');
      const saved=safeStorage.write('hades-garden-reading',preferences);
      if(status)status.textContent=saved?'تنظیمات مطالعه ذخیره شد.':'تنظیمات برای همین صفحه اعمال شد.';
    }
  }
  applyPreferences();
  $$('[data-setting]').forEach(control=>control.addEventListener('change',()=>{preferences[control.dataset.setting]=control.value;applyPreferences(true);}));
  $('[data-settings-reset]')?.addEventListener('click',()=>{preferences={...defaults};applyPreferences(true);});

  // Native dialogs provide focus trapping and Escape; restore the opener explicitly.
  const searchDialog=$('#garden-search'), searchInput=$('#garden-search-input'), settingsDialog=$('#garden-settings'), graphDialog=$('#garden-graph');
  const dialogOpeners=new WeakMap();
  function openDialog(dialog,focusTarget) {
    if(!dialog)return;
    const opener=activePanel?panelOpener:document.activeElement;
    closePanel(false);
    if(dialog.open)return;
    dialogOpeners.set(dialog,opener);
    dialog.showModal();
    (focusTarget||$('button',dialog))?.focus();
  }
  $$('.garden-dialog').forEach(dialog=>{
    $('[data-dialog-close]',dialog)?.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>dialogOpeners.get(dialog)?.focus());
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  });
  $$('[data-settings-open]').forEach(button=>button.addEventListener('click',()=>openDialog(settingsDialog,$('[data-setting]',settingsDialog))));

  let searchCache,searchPromise;
  async function getSearchIndex() {
    if(searchCache)return searchCache;
    if(!searchPromise)searchPromise=fetch(BASE+'searchIndex.json').then(response=>{if(!response.ok)throw new Error('Search unavailable');return response.json();}).then(data=>{
      searchCache=data.filter(note=>urlAllowed(note.url)).map(note=>({...note,title:cleanText(note.title),content:cleanText(note.content||note.text||'')}));return searchCache;
    }).catch(error=>{searchPromise=null;throw error;});
    return searchPromise;
  }
  let resultNotes=[],resultIndex=0,searchVersion=0;
  const resultList=$('#garden-search-results'),searchStatus=$('#garden-search-status');
  function selectResult(index,focus=false) {
    if(!resultNotes.length)return;
    resultIndex=(index+resultNotes.length)%resultNotes.length;
    const links=$$('.search-result-link',resultList);
    links.forEach((link,i)=>{if(i===resultIndex)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');});
    const note=resultNotes[resultIndex];
    $('#search-preview-heading').textContent=note.title;
    $('[data-search-preview]').textContent=note.content.slice(0,520)+(note.content.length>520?'…':'');
    const previewLink=$('[data-search-preview-link]');previewLink.href=note.url;previewLink.hidden=false;
    if(focus)links[resultIndex]?.focus();
    else links[resultIndex]?.scrollIntoView({block:'nearest'});
  }
  async function runSearch() {
    const version=++searchVersion;
    searchStatus.textContent='در حال جست‌وجو…';
    try {
      const notes=await getSearchIndex();if(version!==searchVersion)return;
      const query=searchInput.value;
      resultNotes=searchNotes(notes,query);resultIndex=0;resultList.replaceChildren();
      searchStatus.textContent=resultNotes.length?(query.trim()?numbers.format(resultNotes.length)+' نتیجه برای «'+query+'»':'برای شروع، یکی از این صفحه‌ها را باز کن.'):'برای «'+query+'» چیزی پیدا نشد. یک واژهٔ دیگر را امتحان کن.';
      for(const [i,note] of resultNotes.entries()) {
        const li=document.createElement('li'),link=document.createElement('a');link.className='search-result-link';link.href=note.url;
        link.append(textElement('strong',note.title),textElement('p',note.content.slice(0,135)+(note.content.length>135?'…':'')));
        link.addEventListener('pointerenter',()=>selectResult(i));link.addEventListener('focus',()=>selectResult(i));
        li.append(link);resultList.append(li);
      }
      if(resultNotes.length)selectResult(0);
      else {$('#search-preview-heading').textContent='نتیجه‌ای پیدا نشد';$('[data-search-preview]').textContent='می‌توانی با عنوان، موضوع یا بخشی از متن جست‌وجو کنی.';$('[data-search-preview-link]').hidden=true;}
    } catch {
      if(version!==searchVersion)return;
      resultList.replaceChildren();resultNotes=[];searchStatus.textContent='فهرست جست‌وجو دریافت نشد. اتصال را بررسی کن و دوباره بنویس.';
    }
  }
  function openSearch(query) {
    if(typeof query==='string')searchInput.value=query;
    openDialog(searchDialog,searchInput);runSearch();
  }
  $$('[data-search-open]').forEach(button=>button.addEventListener('click',()=>openSearch()));
  searchInput?.addEventListener('input',runSearch);
  searchDialog?.addEventListener('keydown',event=>{
    // A search input consumes its first Escape to clear text. Honour the
    // dialog's visible Esc shortcut immediately, preserving the query.
    if(event.key==='Escape'){event.preventDefault();searchDialog.close();return;}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();selectResult(resultIndex+(event.key==='ArrowDown'?1:-1),event.target!==searchInput);}
    if(event.key==='Enter'&&event.target===searchInput&&resultNotes[resultIndex]){event.preventDefault();location.assign(resultNotes[resultIndex].url);}
  });
  document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openSearch();}});
  $$('[data-search-query]').forEach(button=>button.addEventListener('click',()=>openSearch(button.dataset.searchQuery)));
  $$('a.tag:not([href])').forEach(tag=>{tag.setAttribute('role','button');tag.tabIndex=0;tag.addEventListener('click',()=>openSearch(tag.textContent.trim().replace(/^#/,'')));tag.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tag.click();}});});

  // Navigation stays a regular tree of links, including without Alpine/CDNs.
  const tree=$('[data-filetree]');
  const treeFilter=$('[data-tree-filter]');
  const treeFilterBox=$('[data-tree-filter-box]');
  let treeQuery='', treeOpenSnapshot=null;
  function filterTree() {
    if(!tree||!treeFilter)return;
    const query=normalizeSearchText(treeFilter.value);
    const folders=Array.from(tree.querySelectorAll('details[data-folder]')), items=Array.from(tree.querySelectorAll('.tree-note'));
    if(query&&!treeQuery)treeOpenSnapshot=new Map(folders.map(d=>[d,d.open]));
    treeQuery=query;
    let count=0;
    for(const item of items){
      const link=$('a',item);
      const haystack=normalizeSearchText((link?.textContent||'')+' '+(item.closest('details[data-folder]')?.dataset.folder||''));
      const show=!query||query.split(' ').every(term=>haystack.includes(term)||haystack.replaceAll(' ','').includes(term));
      item.hidden=!show;
      if(show)count++;
    }
    for(const details of [...folders].reverse()){
      const wrapper=details.closest('.tree-folder');
      if(query){const show=Array.from(details.querySelectorAll('.tree-note')).some(item=>!item.hidden);if(wrapper)wrapper.hidden=!show;if(show)details.open=true;}
      else{if(wrapper)wrapper.hidden=false;if(treeOpenSnapshot?.has(details))details.open=treeOpenSnapshot.get(details);}
    }
    if(!query)treeOpenSnapshot=null;
    const toggle=$('[data-tree-collapse]');
    if(toggle)toggle.disabled=Boolean(query);
    const status=$('[data-tree-filter-status]');
    if(status)status.textContent=numbers.format(count)+' نوشته'+(query?' مطابق فیلتر':' در فهرست');
  }
  treeFilter?.addEventListener('input',filterTree);
  treeFilter?.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&treeFilter.value){event.preventDefault();event.stopPropagation();treeFilter.value='';filterTree();}
  });
  function markNavigation() {
    $$('.garden-sections a,.topbar-links a,.tree-note a').forEach(link=>{
      if(trimPath(link.href)===here && !new URL(link.href,document.baseURI).hash)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    });
    const folderState=safeStorage.read('hades-garden-folders',{});
    $$('details[data-folder]',tree).forEach(details=>{
      if(Object.hasOwn(folderState,details.dataset.folder))details.open=folderState[details.dataset.folder];
      if($('a[aria-current=page]',details))details.open=true;
      details.addEventListener('toggle',()=>{if(treeQuery)return;folderState[details.dataset.folder]=details.open;safeStorage.write('hades-garden-folders',folderState);});
    });
  }
  if(tree)fetch(BASE+'filetree.html').then(response=>{if(!response.ok)throw new Error('Tree unavailable');return response.text();}).then(markup=>{
    const parsed=new DOMParser().parseFromString(markup,'text/html');
    tree.replaceChildren(...parsed.body.childNodes);markNavigation();filterTree();tree.dataset.treeReady='true';if(treeFilterBox)treeFilterBox.hidden=false;
  }).catch(error=>{tree.dataset.treeReady='false';console.warn('HADES filetree initialization failed',error);if(treeFilterBox)treeFilterBox.hidden=true;if(!tree.querySelector('a[href]'))tree.replaceChildren(textElement('p','فهرست دریافت نشد. از جست‌وجو یا پیوندهای متن استفاده کن.','muted'));});
  markNavigation();
  $('[data-tree-collapse]')?.addEventListener('click',()=>{const folders=$$('details',tree);const allClosed=folders.every(d=>!d.open);folders.forEach(d=>{d.open=allClosed;});$('[data-tree-collapse]').textContent=allClosed?'جمع کردن':'باز کردن';});

  const panels={navigation:$('#garden-navigation'),context:$('#garden-context')};
  const navMobile=matchMedia('(max-width: 900px)'),contextMobile=matchMedia('(max-width: 1240px)');
  let panelOpener=null,activePanel=null,workspace=null;
  const backdrop=$('.garden-backdrop');
  function syncPanelInert() {
    for(const [name,panel] of Object.entries(panels))if(panel){const mobile=name==='navigation'?navMobile.matches:contextMobile.matches;panel.inert=mobile?activePanel!==name:Boolean(workspace?.isHidden(name));}
  }
  function closePanel(restore=true) {
    const old=activePanel;activePanel=null;delete document.body.dataset.openPanel;
    if(backdrop)backdrop.hidden=true;
    for(const panel of Object.values(panels))if(panel){panel.removeAttribute('role');panel.removeAttribute('aria-modal');}
    $$('[data-panel-open]').forEach(button=>button.setAttribute('aria-expanded','false'));
    $('.garden-layout main').inert=false;$('.garden-topbar').inert=false;
    syncPanelInert();
    if(old&&restore)panelOpener?.focus();
  }
  function openPanel(name,button) {
    if(!panels[name])return;
    closePanel(false);activePanel=name;panelOpener=button;document.body.dataset.openPanel=name;backdrop.hidden=false;
    panels[name].inert=false;panels[name].setAttribute('role','dialog');panels[name].setAttribute('aria-modal','true');
    button.setAttribute('aria-expanded','true');
    $('.garden-layout main').inert=true;$('.garden-topbar').inert=true;
    $('[data-panel-close]',panels[name])?.focus();syncPanelInert();
  }
  $$('[data-panel-open]').forEach(button=>button.addEventListener('click',()=>openPanel(button.dataset.panelOpen,button)));
  $$('[data-panel-close]').forEach(button=>button.addEventListener('click',()=>closePanel()));
  Object.values(panels).forEach(panel=>panel?.addEventListener('click',event=>{if(activePanel&&event.target.closest('a[href]'))closePanel(false);}));
  document.addEventListener('keydown',event=>{
    if(!activePanel)return;
    if(event.key==='Escape'){event.preventDefault();closePanel();return;}
    if(event.key==='Tab'){
      const tabbable=$$('a[href],button:not([disabled]),summary,input,select,[tabindex="0"]',panels[activePanel]).filter(el=>el.getClientRects().length);
      const first=tabbable[0],last=tabbable.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  [navMobile,contextMobile].forEach(query=>query.addEventListener('change',()=>{closePanel(false);syncPanelInert();}));
  workspace=installWorkspacePanes({body:document.body,storage:safeStorage,onChange:syncPanelInert});
  syncPanelInert();

  // Dates, reading time, progress and section indicator are all local.
  $$('.persian-date').forEach(time=>{const date=new Date(time.getAttribute('datetime'));if(!Number.isNaN(date.getTime())){time.dateTime=date.toISOString();time.textContent=readableDate.format(date);}});
  const article=$('[data-note-body]');
  if(article && $('[data-reading-time]')){const prose=article.cloneNode(true);prose.querySelectorAll('script,style,template').forEach(el=>el.remove());const words=prose.textContent.trim().split(/\s+/u).filter(Boolean).length;const label=$('[data-reading-time]');const minutes=Number(label.dataset.readingMinutes)||Math.max(1,Math.ceil(words/190));label.textContent='· '+numbers.format(minutes)+' دقیقه مطالعه';}
  const tocLinks=$$('[data-toc] a[href^="#"]');
  const headings=tocLinks.map(link=>{let id;try{id=decodeURIComponent(link.hash.slice(1));}catch{id=link.hash.slice(1);}return{link,target:document.getElementById(id)};}).filter(item=>item.target);
  function onScroll(){
    const progress=$('#reading-progress');
    if(article&&progress){const r=article.getBoundingClientRect();const total=Math.max(1,article.offsetHeight-innerHeight+140);progress.value=Math.max(0,Math.min(100,(140-r.top)/total*100));}
    let current=headings[0];for(const item of headings)if(item.target.getBoundingClientRect().top<=150)current=item;
    for(const item of headings)if(item.target===current?.target)item.link.setAttribute('aria-current','true');else item.link.removeAttribute('aria-current');
  }
  addEventListener('scroll',onScroll,{passive:true});onScroll();
  $('[data-copy-link]')?.addEventListener('click',async()=>{const status=$('.copy-status');try{await navigator.clipboard.writeText(location.href);status.textContent='پیوند کپی شد.';}catch{status.textContent='برای کپی، نشانی صفحه را از نوار آدرس بردار.';}});
  $$('.callout.is-collapsible .callout-title').forEach(title=>{title.tabIndex=0;title.setAttribute('role','button');title.setAttribute('aria-expanded',String(!title.parentElement.classList.contains('is-collapsed')));const toggle=()=>{title.parentElement.classList.toggle('is-collapsed');title.setAttribute('aria-expanded',String(!title.parentElement.classList.contains('is-collapsed')));};title.addEventListener('click',toggle);title.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}});});

  let graphCache,graphPromise;
  async function getGraph() {
    if(graphCache)return graphCache;
    if(!graphPromise)graphPromise=fetch(BASE+'graph.json').then(response=>{if(!response.ok)throw new Error('Graph unavailable');return response.json();}).then(data=>{
      const raw=Array.isArray(data.nodes)?data.nodes:Object.values(data.nodes||{});
      const nodes=raw.filter(n=>!n.private&&!n.hide&&urlAllowed(n.url)).map(n=>({...n,title:cleanText(n.title),id:n.id ?? n.url}));
      const ids=new Set(nodes.map(n=>n.id));const links=(data.links||data.edges||[]).filter(l=>ids.has(l.source)&&ids.has(l.target));
      graphCache={nodes,links};return graphCache;
    }).catch(error=>{graphPromise=null;throw error;});
    return graphPromise;
  }
  if ($('[data-reading-history]')) getGraph().then(graph => installReadingTrail({document, graph, here, storage:safeStorage})).catch(()=>{});
  function graphSubset(graph,all=false){
    if(all)return graph;
    const current=graph.nodes.find(n=>trimPath(n.url)===here);
    if(!current)return{nodes:[],links:[]};
    const ids=new Set([current.id]);for(const link of graph.links){if(link.source===current.id)ids.add(link.target);if(link.target===current.id)ids.add(link.source);}
    return{nodes:graph.nodes.filter(n=>ids.has(n.id)),links:graph.links.filter(l=>ids.has(l.source)&&ids.has(l.target))};
  }
  function svgElement(name,attrs={}){const el=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));return el;}

  // REVIEW: shared SVG atlas, screen-space label collision and finite motion.
  const atlasState = new WeakMap();
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const options = {spread:100, labels:'auto', kind:'all', motion:!motionQuery.matches};
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
  function drawGraph(container,data,all=false){
    container.dataset.graphReady='false';
    container.replaceChildren();
    if(!data.nodes.length){container.append(textElement('p','نوشته‌ای در این نما نیست.','muted'));container.dataset.graphCount='0';container.dataset.graphKind='all';container.dataset.graphReady='true';return;}
    const interactive=container.matches('[data-global-graph]');
    const width=Math.max(200,container.clientWidth),height=Math.max(200,container.clientHeight);
    const svg=svgElement('svg',{viewBox:'0 0 '+width+' '+height,role:'group','aria-label':'نقشهٔ ارتباط نوشته‌ها؛ عنوان کامل با فوکوس روی نود در دسترس است.'});
    const group=svgElement('g',{'data-graph-scene':''});svg.append(group);
    const kind=n=>/^\/fa\/blog\/notes(?:\/|$)/.test(trimPath(n.url))?'note':'article';
    const visible=all&&interactive&&options.kind!=='all'?data.nodes.filter(n=>kind(n)===options.kind):data.nodes;
    const ids=new Set(visible.map(n=>n.id));
    const filter=all&&interactive?options.kind:'all';
    const counts={article:visible.filter(n=>kind(n)==='article').length,note:visible.filter(n=>kind(n)==='note').length};
    const unique=new Set();
    const rawEdges=data.links.filter(l=>{if(!ids.has(l.source)||!ids.has(l.target)||l.source===l.target)return false;const key=JSON.stringify([l.source,l.target].sort());if(unique.has(key))return false;unique.add(key);return true;});
    const degrees=new Map(visible.map(n=>[n.id,0]));
    for(const l of rawEdges){degrees.set(l.source,degrees.get(l.source)+1);degrees.set(l.target,degrees.get(l.target)+1);}
    const nodes=visible.map(n=>({...n,kind:kind(n),degree:degrees.get(n.id),current:trimPath(n.url)===here}));
    const compact=width<460;
    // Stable two-ring layout makes article/note clusters legible. Expand freely; zoom/pan reveal space.
    const spread=interactive?options.spread/100:1;
    const rings=[nodes.filter(n=>n.kind==='note'),nodes.filter(n=>n.kind==='article')];
    rings.forEach((ring,ri)=>ring.forEach((n,i)=>{
      const angle=2*Math.PI*i/Math.max(1,ring.length)-Math.PI/2+(ri ? .35 : 0);
      const fraction=rings.every(a=>a.length)?(ri===0?.56:1):.83;
      n.x=width/2+Math.cos(angle)*Math.max(56,width*.35)*fraction*spread;
      n.y=height/2+Math.sin(angle)*Math.max(55,height*.34)*fraction*spread;
      if(nodes.length===1){n.x=width/2;n.y=height/2;}
    }));
    if(container.matches('[data-local-graph]')){
      const center=nodes.find(n=>n.current);
      if(center){
        center.x=width/2;center.y=height/2;
        const neighbors=nodes.filter(n=>!n.current);
        neighbors.forEach((n,i)=>{
          const angle=2*Math.PI*i/Math.max(1,neighbors.length)-Math.PI/2;
          n.x=width/2+Math.cos(angle)*width*.32;
          n.y=height/2+Math.sin(angle)*height*.34;
        });
      }
    }
    const byId=new Map(nodes.map(n=>[n.id,n]));
    const edges=rawEdges.map(l=>({source:byId.get(l.source),target:byId.get(l.target)}));
    const edgeEls=edges.map(e=>{const line=svgElement('line',{x1:e.source.x,y1:e.source.y,x2:e.target.x,y2:e.target.y,class:'graph-edge'});group.append(line);return{...e,line};});
    const nodeEls=[];
    const preview=container.closest('.atlas-preview-section');
    const local=container.closest('[data-local-graph-section]');
    const status=interactive?$('[data-graph-detail]'):preview?.querySelector('[data-atlas-detail]')||local?.querySelector('[data-local-detail]');
    const total=interactive?$('[data-graph-count]'):preview?.querySelector('[data-atlas-count]')||local?.querySelector('[data-local-count]');
    if(total)total.textContent=numbers.format(counts.article)+' مقاله · '+numbers.format(counts.note)+' یادداشت · '+numbers.format(edges.length)+' ارتباط';
    if(status)status.textContent='برای دیدن عنوان کامل، روی یک نود مکث کن یا با صفحه‌کلید آن را انتخاب کن.';
    const defaultId=local?(nodes.find(n=>n.current)?.id??null):null;
    let active=null;
    const state={scale:1,dx:0,dy:0,apply:null,reflow:null,width,height};
    function prioritize(id){
      if(id===null&&local)id=defaultId;
      active=id;
      const neighbors=new Set([id]);
      for(const e of edgeEls){const connected=e.source.id===id||e.target.id===id;e.line.classList.toggle('is-related',id!==null&&connected);e.line.classList.toggle('is-dim',id!==null&&!connected);if(connected){neighbors.add(e.source.id);neighbors.add(e.target.id);}}
      for(const n of nodeEls){n.a.classList.toggle('is-related',id!==null&&neighbors.has(n.id));n.a.classList.toggle('is-dim',id!==null&&!neighbors.has(n.id));}
      if(status)status.textContent=id===null?'یک نود را انتخاب یا با صفحه‌کلید روی آن فوکوس کن.':byId.get(id).title+' · '+numbers.format(byId.get(id).degree)+' ارتباط'+(local?' در این نما':'');
      placeLabels();
    }
    for(const [i,node] of nodes.entries()){
      const a=svgElement('a',{href:node.url,class:'graph-node',tabindex:0,'data-current':node.current,'data-kind':node.kind,'aria-label':node.title});
      const title=svgElement('title');title.textContent=node.title;a.append(title);
      const radius=node.current?7:clamp(4+Math.sqrt(node.degree),5,9);
      const dot=svgElement('circle',{cx:node.x,cy:node.y,r:radius});
      a.append(svgElement('circle',{cx:node.x,cy:node.y,r:Math.max(12,radius+4),class:'graph-hit'}),dot);
      const label=svgElement('text',{x:node.x,y:node.y+radius+16,'aria-hidden':'true'});
      const chars=Array.from(node.title);
      const max=compact?16:28;
      label.textContent=chars.length>max?chars.slice(0,max-1).join('')+'…':node.title;
      a.append(label);group.append(a);
      nodeEls.push({...node,a,dot,label,radius});
      a.addEventListener('pointerenter',()=>prioritize(node.id));
      a.addEventListener('pointerleave',()=>{if(document.activeElement!==a)prioritize(null);});
      a.addEventListener('focus',()=>prioritize(node.id));
      a.addEventListener('blur',()=>prioritize(null));
      if(options.motion&&!motionQuery.matches&&typeof a.animate==='function')a.animate([{opacity:0},{opacity:1}],{duration:340,delay:Math.min(i,10)*24,easing:'ease-out'});
    }
    container.append(svg);
    // Bounding boxes in *screen pixels*, including zoom and actual font metrics.
    // A suppressed label never removes its node, accessible title, or list entry.
    function placeLabels(){
      if(!svg.isConnected)return;
      const box=svg.getBoundingClientRect(),used=[];
      const dots=nodeEls.map(n=>({id:n.id,rect:n.dot.getBoundingClientRect()}));
      const intersects=(a,b,pad=4)=>a.left<b.right+pad&&a.right>b.left-pad&&a.top<b.bottom+pad&&a.bottom>b.top-pad;
      const mode=interactive?options.labels:'auto';
      const sorted=[...nodeEls].sort((a,b)=>Number(b.id===active)-Number(a.id===active)||Number(b.current)-Number(a.current)||b.degree-a.degree||String(a.id).localeCompare(String(b.id)));
      for(const n of sorted){
        n.label.style.visibility='hidden';
        if(mode==='off'&&n.id!==active)continue;
        if(mode==='focus'&&n.id!==active&&!n.current)continue;
        const offsets=[[0,n.radius+17],[0,-n.radius-8],[n.radius+8,4],[-n.radius-8,4]];
        for(const [dx,dy] of offsets){
          n.label.setAttribute('x',n.x+dx);n.label.setAttribute('y',n.y+dy);
          n.label.style.textAnchor=dx>0?'start':dx<0?'end':'middle';
          const b=n.label.getBoundingClientRect();
          if(b.left<box.left+5||b.right>box.right-5||b.top<box.top+5||b.bottom>box.bottom-5||used.some(v=>intersects(b,v))||dots.some(v=>v.id!==n.id&&intersects(b,v.rect,3)))continue;
          n.label.style.visibility='visible';used.push(b);break;
        }
      }
    }
    state.apply=()=>{group.setAttribute('transform','translate('+(width/2+state.dx)+' '+(height/2+state.dy)+') scale('+state.scale+') translate('+(-width/2)+' '+(-height/2)+')');container.dataset.scale=String(state.scale);placeLabels();};
    state.reflow=placeLabels;
    atlasState.set(container,state);
    state.apply();if(local&&defaultId!==null)prioritize(defaultId);document.fonts?.ready.then(()=>{if(svg.isConnected)placeLabels();});
    if(interactive){
      let drag=null;
      svg.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('a'))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,dx:state.dx,dy:state.dy};svg.setPointerCapture(e.pointerId);svg.classList.add('is-panning');});
      svg.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const rect=svg.getBoundingClientRect();state.dx=drag.dx+(e.clientX-drag.x)*width/rect.width;state.dy=drag.dy+(e.clientY-drag.y)*height/rect.height;state.apply();});
      const end=()=>{drag=null;svg.classList.remove('is-panning');};svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);svg.addEventListener('lostpointercapture',end);
      const list=$('[data-graph-pages]');if(list){list.replaceChildren();for(const n of nodes){const li=document.createElement('li'),a=document.createElement('a');a.href=n.url;a.textContent=n.title;li.append(a);list.append(li);}}
    }
    if(!nodes.length){container.replaceChildren(textElement('p','در این دسته نوشته‌ای نیست. نوع نوشته را تغییر بده.','graph-empty'));}
    container.dataset.graphKind=filter;
    container.dataset.graphCount=String(nodes.length);
    container.dataset.graphReady='true';
  }
  async function renderLocalGraph(){const c=$('[data-local-graph]');if(!c||!c.clientWidth)return;try{drawGraph(c,graphSubset(await getGraph()));}catch{c.replaceChildren(textElement('p','گراف دریافت نشد.','muted'));}}
  async function renderAtlasPreview(){const c=$('[data-atlas-preview]');if(!c||!c.clientWidth)return;try{drawGraph(c,await getGraph(),true);}catch{c.replaceChildren(textElement('p','نقشه در دسترس نیست؛ فهرست نوشته‌ها در ادامه قرار دارد.','muted'));}}
  let globalRenderVersion=0;
  async function renderGlobal(){const c=$('[data-global-graph]');if(!graphDialog?.open||!c)return;const version=++globalRenderVersion;c.dataset.graphReady='false';try{const data=await getGraph();if(version!==globalRenderVersion||!graphDialog.open)return;drawGraph(c,data,true);}catch{if(version===globalRenderVersion)c.replaceChildren(textElement('p','گراف دریافت نشد. دوباره امتحان کن.','muted'));}}
  // Resizing the dialog or its text must not replace its SVG or reset the camera.
  // Reflow measured labels against the current rendered view; only the first
  // non-zero layout of an inline atlas (or a real viewport breakpoint change)
  // needs a new layout. The dialog is rendered exclusively by open/settings.
  const graphSizes=new WeakMap();
  const resizeObserver=new ResizeObserver(entries=>{for(const e of entries){
    const c=e.target, w=Math.round(e.contentRect.width),h=Math.round(e.contentRect.height);
    if(!w||!h)continue;
    const size=w+'x'+h;if(graphSizes.get(c)===size)continue;graphSizes.set(c,size);
    const state=atlasState.get(c);
    if(c.matches('[data-global-graph]')){state?.reflow();continue;}
    if(state&&(graphDialog?.open||Math.abs(state.width-w)<90)){state.reflow();continue;}
    if(c.matches('[data-local-graph]'))renderLocalGraph();else if(c.matches('[data-atlas-preview]'))renderAtlasPreview();
  }});
  for(const c of $$('[data-local-graph],[data-atlas-preview],[data-global-graph]'))resizeObserver.observe(c);
  $$('[data-global-graph-open]').forEach(button=>button.addEventListener('click',()=>{openDialog(graphDialog);const c=$('[data-global-graph]');if(c)c.dataset.graphReady='false';renderGlobal();}));
  // The page behind a native modal is inert. Once it becomes interactive
  // again, ensure the inline atlas is still complete and recalculate labels.
  graphDialog?.addEventListener('close',()=>{
    requestAnimationFrame(()=>{
      for(const c of $$('[data-atlas-preview],[data-local-graph]')){
        if(!c.clientWidth)continue;
        const state=atlasState.get(c), expected=Number(c.dataset.graphCount);
        const intact=c.dataset.graphReady==='true'&&Number.isFinite(expected)&&c.querySelectorAll('.graph-node').length===expected;
        if(intact&&state){state.reflow();continue;}
        if(c.matches('[data-atlas-preview]'))renderAtlasPreview();else renderLocalGraph();
      }
    });
  });
  $$('[data-graph-option]').forEach(control=>{
    if(control.dataset.graphOption==='motion')control.checked=options.motion;
    control.addEventListener('change',()=>{const key=control.dataset.graphOption;options[key]=key==='motion'?control.checked:key==='spread'?Number(control.value):control.value;renderGlobal();});
  });
  motionQuery.addEventListener('change',()=>{if(motionQuery.matches){options.motion=false;const c=$('[data-graph-option="motion"]');if(c)c.checked=false;}if(graphDialog?.open)renderGlobal();});
  $$('[data-graph-zoom]').forEach(button=>button.addEventListener('click',()=>{const c=$('[data-global-graph]'),state=atlasState.get(c);if(!state)return;const action=button.dataset.graphZoom;if(action==='reset'){state.scale=1;state.dx=0;state.dy=0;}else state.scale=clamp(state.scale*(action==='in'?1.25:.8),.6,3);state.apply();}));
  $$('[data-graph-pan]').forEach(button=>button.addEventListener('click',()=>{const c=$('[data-global-graph]'),state=atlasState.get(c);if(!state)return;const d=button.dataset.graphPan;if(d==='left')state.dx-=40;if(d==='right')state.dx+=40;if(d==='up')state.dy-=40;if(d==='down')state.dy+=40;state.apply();}));

  // Hover/focus previews use the local search index, never remote page fetches.
  const tooltip=$('#garden-link-preview');let previewTimer,previewTarget;
  function hidePreview(){clearTimeout(previewTimer);tooltip.hidden=true;previewTarget=null;}
  async function showPreview(link){
    const target=trimPath(link.href);if(target===here||!urlAllowed(link.href))return;
    previewTarget=link;
    try{const notes=await getSearchIndex();if(previewTarget!==link)return;const note=notes.find(n=>trimPath(n.url)===target);if(!note)return;
      $('strong',tooltip).textContent=note.title;$('p',tooltip).textContent=note.content.slice(0,240)+(note.content.length>240?'…':'');
      tooltip.hidden=false;const r=link.getBoundingClientRect(),t=tooltip.getBoundingClientRect();tooltip.style.left=Math.max(12,Math.min(innerWidth-t.width-12,r.left))+'px';tooltip.style.top=Math.max(12,Math.min(innerHeight-t.height-12,r.bottom+9))+'px';link.setAttribute('aria-describedby','garden-link-preview');
    }catch{hidePreview();}
  }
  document.addEventListener('pointerover',event=>{const link=event.target.closest('.note-body a.internal-link,.backlink-list a');if(!link||event.pointerType==='touch')return;clearTimeout(previewTimer);previewTimer=setTimeout(()=>showPreview(link),300);});
  document.addEventListener('pointerout',event=>{const link=event.target.closest('.note-body a.internal-link,.backlink-list a');if(link){link.removeAttribute('aria-describedby');hidePreview();}});
  document.addEventListener('focusin',event=>{const link=event.target.closest('.note-body a.internal-link,.backlink-list a');if(link)showPreview(link);});
  document.addEventListener('focusout',event=>{if(event.target.closest('.note-body a.internal-link,.backlink-list a'))hidePreview();});
  addEventListener('scroll',hidePreview,{passive:true});document.addEventListener('keydown',event=>{if(event.key==='Escape')hidePreview();});
}

// REVIEW: inline enlargement; retain native image links without JS.
export function installFigureViewer() {
  const article = document.querySelector('.blog-article');
  if (!article || typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal || article.dataset.figureViewer) return;
  const links = [...article.querySelectorAll('figure.article-figure .figure-open')];
  if (!links.length) return;
  article.dataset.figureViewer = 'ready';
  const dialog = document.createElement('dialog');
  dialog.className = 'hades-figure-viewer';
  dialog.setAttribute('aria-labelledby', 'figure-viewer-title');
  dialog.innerHTML = '<div class="figure-viewer-bar"><h2 id="figure-viewer-title">نمایش تصویر</h2><button type="button" class="figure-viewer-close" aria-label="بستن تصویر">×</button></div><div class="figure-viewer-stage"><img alt=""><p role="status" hidden>تصویر در این پنجره بارگذاری نشد. پیوند فایل اصلی در دسترس است.</p></div><div class="figure-viewer-footer"><p class="figure-viewer-caption"></p><a class="figure-viewer-original" target="_blank" rel="noopener noreferrer">باز کردن فایل اصلی در زبانهٔ جدید</a></div>';
  document.body.append(dialog);
  const title = dialog.querySelector('h2'), close = dialog.querySelector('button'), image = dialog.querySelector('img');
  const status = dialog.querySelector('[role="status"]'), caption = dialog.querySelector('.figure-viewer-caption'), original = dialog.querySelector('a');
  let opener = null;
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => { image.removeAttribute('src'); opener?.focus({preventScroll:true}); opener = null; });
  image.addEventListener('load', () => { status.hidden = true; image.hidden = false; });
  image.addEventListener('error', () => { if (dialog.open) { image.hidden = true; status.hidden = false; } });
  for (const link of links) {
    const figure = link.closest('figure'), source = figure?.querySelector('img');
    let url;
    try { url = new URL(link.getAttribute('href'), document.baseURI); } catch { continue; }
    if (!source || !((url.origin === new URL(document.baseURI).origin && url.pathname.startsWith('/fa/blog/media/')) || (url.origin === 'https://arxiv.org' && url.pathname.startsWith('/fa/garden/html/')))) continue;
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || dialog.open) return;
      opener = link;
      title.textContent = figure.querySelector('.figure-index')?.textContent || 'نمایش تصویر';
      caption.textContent = figure.querySelector('figcaption > span:not(.figure-index)')?.textContent || source.alt;
      image.alt = source.alt;
      original.href = url.href;
      status.hidden = true; image.hidden = false;
      try { dialog.showModal(); } catch { opener = null; return; }
      event.preventDefault();
      image.src = source.currentSrc || source.src;
      close.focus();
    });
  }
}
