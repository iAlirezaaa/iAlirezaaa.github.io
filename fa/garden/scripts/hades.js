import { installCodeCopy } from './reader-tools.js';
import { installGraphViews } from './graph-view.js';
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
  const $ = (selector, within = document) => within?.querySelector(selector) ?? null;
  const $$ = (selector, within = document) => within ? [...within.querySelectorAll(selector)] : [];
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
  let preferences={...defaults,...safeStorage.read('hades-garden-reading',{}),measure:'regular',leading:'regular'};
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

  // Native dialogs make the page inert and handle Escape. Keep Tab inside the
  // visible controls as well: Chrome can otherwise tab into browser chrome
  // after the last control, even while a modal dialog is open.
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
    dialog.addEventListener('keydown',event=>{
      if(event.key!=='Tab'||event.altKey||event.ctrlKey||event.metaKey)return;
      const targets=$$('a[href],button,input,select,textarea,summary,[tabindex]',dialog).filter(element=>{
        const visibility=getComputedStyle(element).visibility;
        return element.tabIndex>=0&&!element.matches(':disabled')&&!element.closest('[inert]')&&element.getClientRects().length&&visibility!=='hidden'&&visibility!=='collapse';
      });
      const first=targets[0],last=targets.at(-1),active=document.activeElement;
      if(!first){event.preventDefault();dialog.focus();return;}
      if(event.shiftKey?(active===first||active===dialog||!dialog.contains(active)):(active===last||active===dialog||!dialog.contains(active))){
        event.preventDefault();(event.shiftKey?last:first).focus();
      }
    });
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
  function selectResult(index,focus=false,scroll=true) {
    if(!resultNotes.length)return;
    resultIndex=(index+resultNotes.length)%resultNotes.length;
    const links=$$('.search-result-link',resultList);
    links.forEach((link,i)=>{if(i===resultIndex)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');});
    if(focus)links[resultIndex]?.focus();
    else if(scroll)links[resultIndex]?.scrollIntoView({block:'nearest'});
  }
  async function runSearch() {
    const version=++searchVersion;
    searchStatus.textContent='در حال جست‌وجو…';
    resultList.setAttribute('aria-busy','true');
    try {
      const notes=await getSearchIndex();if(version!==searchVersion)return;
      const query=searchInput.value;
      resultNotes=searchNotes(notes,query);resultIndex=0;resultList.replaceChildren();
      searchStatus.textContent=resultNotes.length?(query.trim()?numbers.format(resultNotes.length)+' نتیجه برای «'+query+'»':'برای شروع، یکی از این صفحه‌ها را باز کن.'):'برای «'+query+'» چیزی پیدا نشد. یک واژهٔ دیگر را امتحان کن.';
      for(const [i,note] of resultNotes.entries()) {
        const li=document.createElement('li'),link=document.createElement('a');link.className='search-result-link';link.href=note.url;
        link.append(textElement('strong',note.title),textElement('p',note.content.slice(0,135)+(note.content.length>135?'…':'')));
        link.addEventListener('pointermove',event=>{if(event.movementX||event.movementY)selectResult(i,false,false);});link.addEventListener('focus',()=>selectResult(i,false,false));
        li.append(link);resultList.append(li);
      }
      resultList.dataset.query=query;resultList.setAttribute('aria-busy','false');
      if(resultNotes.length)selectResult(0);
    } catch {
      if(version!==searchVersion)return;
      resultList.replaceChildren();resultNotes=[];resultList.setAttribute('aria-busy','false');searchStatus.textContent='فهرست جست‌وجو دریافت نشد. اتصال را بررسی کن و دوباره بنویس.';
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
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(resultList.getAttribute('aria-busy')==='true')return;selectResult(resultIndex+(event.key==='ArrowDown'?1:-1),event.target!==searchInput);}
    if(event.key==='Enter'&&event.target===searchInput&&resultList.getAttribute('aria-busy')!=='true'&&resultNotes[resultIndex]){event.preventDefault();location.assign(resultNotes[resultIndex].url);}
  });
  document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openSearch();}});
  $$('[data-search-query]').forEach(button=>button.addEventListener('click',()=>openSearch(button.dataset.searchQuery)));
  $$('a.tag:not([href])').forEach(tag=>{tag.setAttribute('role','button');tag.tabIndex=0;tag.addEventListener('click',()=>openSearch(tag.textContent.trim().replace(/^#/,'')));tag.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tag.click();}});});

  // Navigation stays a regular tree of links, including without Alpine/CDNs.
  const tree=$('[data-filetree]');
  function syncTreeToggle() {
    const button=$('[data-tree-collapse]');if(!button)return;
    const folders=$$('details[data-folder]',tree),anyOpen=folders.some(folder=>folder.open);
    button.textContent=anyOpen?'جمع کردن':'باز کردن';
    button.setAttribute('aria-label',anyOpen?'بستن همهٔ بخش‌های فهرست':'باز کردن همهٔ بخش‌های فهرست');
    button.setAttribute('aria-expanded',String(anyOpen));
    button.title=button.getAttribute('aria-label');
    button.disabled=!folders.length;
    if(tree?.id)button.setAttribute('aria-controls',tree.id);
  }
  function markNavigation() {
    $$('.garden-wordmark,.tree-note a').forEach(link=>{
      if(trimPath(link.href)===here && !new URL(link.href,document.baseURI).hash)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    });
    if(!tree)return;
    const folderState=safeStorage.read('hades-garden-folders',{});
    $$('details[data-folder]',tree).forEach(details=>{
      if(Object.hasOwn(folderState,details.dataset.folder))details.open=folderState[details.dataset.folder];
      if($('a[aria-current=page]',details))details.open=true;
      details.addEventListener('toggle',()=>{folderState[details.dataset.folder]=details.open;safeStorage.write('hades-garden-folders',folderState);syncTreeToggle();});
    });
    syncTreeToggle();
  }
  if(tree?.querySelector('.tree-note a')) {
    markNavigation();tree.dataset.treeReady='true';
  } else if(tree) fetch(BASE+'filetree.html').then(response=>{if(!response.ok)throw new Error('Tree unavailable');return response.text();}).then(markup=>{
    const parsed=new DOMParser().parseFromString(markup,'text/html');
    tree.replaceChildren(...parsed.body.childNodes);markNavigation();tree.dataset.treeReady='true';
  }).catch(error=>{tree.dataset.treeReady='false';console.warn('HADES filetree initialization failed',error);if(!tree.querySelector('a[href]'))tree.replaceChildren(textElement('p','فهرست دریافت نشد. از جست‌وجو یا پیوندهای متن استفاده کن.','muted'));});
  $('[data-tree-collapse]')?.addEventListener('click',()=>{const folders=$$('details[data-folder]',tree);const allClosed=folders.every(d=>!d.open);folders.forEach(d=>{d.open=allClosed;});syncTreeToggle();});

  const panels={navigation:$('#garden-navigation'),context:$('#garden-context')};
  const navMobile=matchMedia('(max-width: 1100px)'),contextMobile=matchMedia('(max-width: 1100px)');
  let panelOpener=null,activePanel=null;
  const backdrop=$('.garden-backdrop');
  function syncPanelInert() {
    for(const [name,panel] of Object.entries(panels))if(panel){const mobile=name==='navigation'?navMobile.matches:contextMobile.matches;panel.inert=mobile?activePanel!==name:false;const button=$('[data-panel-open="'+name+'"]');button?.setAttribute('aria-expanded',String(!panel.inert));}
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
  $$('[data-panel-open]').forEach(button=>button.addEventListener('click',()=>{const name=button.dataset.panelOpen;const mobile=name==='navigation'?navMobile.matches:contextMobile.matches;if(mobile)openPanel(name,button);}));
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
  syncPanelInert();

  // Dates, reading time, progress and section indicator are all local.
  $$('.persian-date').forEach(time=>{const date=new Date(time.getAttribute('datetime'));if(!Number.isNaN(date.getTime())){time.dateTime=date.toISOString();time.textContent=readableDate.format(date);}});
  const article=$('[data-note-body]');
  if(article && $('[data-reading-time]')){const prose=article.cloneNode(true);prose.querySelectorAll('script,style,template').forEach(el=>el.remove());const words=prose.textContent.trim().split(/\s+/u).filter(Boolean).length;const label=$('[data-reading-time]');const minutes=Number(label.dataset.readingMinutes)||Math.max(1,Math.ceil(words/190));label.textContent='· '+numbers.format(minutes)+' دقیقه مطالعه';}
  const tocLinks=$$('[data-toc] a[href^="#"]');
  const headings=tocLinks.map(link=>{let id;try{id=decodeURIComponent(link.hash.slice(1));}catch{id=link.hash.slice(1);}return{link,target:document.getElementById(id)};}).filter(item=>item.target);
  const progress=$('#reading-progress'), progressFill=progress?.querySelector('.reading-progress-fill');
  function onScroll(){
    if(article&&progress&&progressFill){
      const root=document.scrollingElement||document.documentElement;
      const top=root.scrollTop,maxScroll=Math.max(0,root.scrollHeight-root.clientHeight);
      const articleEnd=article.getBoundingClientRect().bottom+top-root.clientHeight+24;
      const finish=Math.max(1,Math.min(maxScroll,articleEnd));
      const fraction=maxScroll===0?1:Math.min(1,Math.max(0,top/finish));
      progressFill.style.transform='scaleX('+fraction+')';
      progress.setAttribute('aria-valuenow',String(Math.round(fraction*100)));
    }
    let current=headings[0];for(const item of headings)if(item.target.getBoundingClientRect().top<=150)current=item;
    for(const item of headings)if(item.target===current?.target)item.link.setAttribute('aria-current','true');else item.link.removeAttribute('aria-current');
  }
  let scrollFrame=0;function scheduleReading(){if(!scrollFrame)scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;onScroll();});}
  addEventListener('scroll',scheduleReading,{passive:true});addEventListener('resize',scheduleReading,{passive:true});
  if(article&&typeof ResizeObserver!=='undefined')new ResizeObserver(scheduleReading).observe(article);
  document.fonts?.ready.then(scheduleReading);onScroll();
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
  installGraphViews({getGraph, here, trimPath, graphDialog, openDialog});

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
  const article = document.querySelector('main.blog-article, main.animation-lesson');
  if (!article || typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal || article.dataset.figureViewer) return;
  const links = [...article.querySelectorAll('figure.article-figure .figure-open, figure.animation-study-figure .figure-open')];
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
    if (!source || !((url.origin === new URL(document.baseURI).origin && (url.pathname.startsWith('/fa/blog/media/') || url.pathname.startsWith('/fa/garden/img/user/animation/'))) || (url.origin === 'https://arxiv.org' && url.pathname.startsWith('/fa/garden/html/')))) continue;
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || dialog.open) return;
      opener = link;
      title.textContent = figure.querySelector('.figure-index')?.textContent || 'نمایش تصویر';
      caption.textContent = figure.querySelector('figcaption > span:not(.figure-index)')?.textContent || figure.querySelector('figcaption')?.textContent || source.alt;
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
