import './style.css';
import catalog from './atlas.json';
import { icon } from './icons.js';
import { createProgress, discoverRealm, openDestination, toggleSaved, chooseJourney, getJourneyProgress, getRealmProgress, getProgressSummary, encodeCollection, decodeCollection, mergeCollection } from './journey-state.js';
import { createProgressStore } from './progress-store.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const PREF_KEY = 'hadesrealm.atlas.preferences.v3';
const PUBLIC_URL = 'https://ialirezaaa.github.io/HadesRealm/';
const realmById = new Map(catalog.realms.map((entry) => [entry.id, entry]));
const destinationById = new Map(catalog.destinations.map((entry) => [entry.id, entry]));
const journeyById = new Map(catalog.journeys.map((entry) => [entry.id, entry]));
let preferences = {};
try { preferences = JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch { /* A blocked store still leaves the atlas usable. */ }
if (typeof preferences !== 'object' || Array.isArray(preferences)) preferences = {};
let lang = preferences.lang === 'en' ? 'en' : 'fa';
let sound = false;
let ambientMotion = typeof preferences.motion === 'boolean' ? preferences.motion : !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = createProgress(null, catalog);
let scene;
let panelMode = null;
let selectedRealm = null;
let lastFocus = null;
let directoryFilter = 'all';
let directoryQuery = '';
let sharedIds = [];
let shareUrl = '';
let resetPending = false;
let toastTimer;
let audioContext;
let destroyed = false;
const labels = new Map();
const words = {
  fa: { riverName:'رود استیکس', yourFootprint:'ردپای تو', worldName:'جهانِ هادس', worldSeason:'ایده‌ها را دنبال کن. راهت را پیدا کن.', sceneHint:'بکش تا بچرخد · یک ساختمان را انتخاب کن', previousChapter:'فصل پیشین', villageArchive:'آرشیو دهکده', world:'نقشه', journeys:'مسیرها', collection:'کوله‌بار', allLinks:'همهٔ مقصدها', openWorld:'هر مقصد، یک شروع تازه', renderFallback:'نقشه در دسترس نیست؛ همهٔ مقصدها از فهرست باز می‌شوند.' },
  en: { riverName:'River Styx', yourFootprint:'YOUR FOOTPRINT', worldName:'The world of Hades', worldSeason:'Follow an idea. Find your own way.', sceneHint:'Drag to orbit · Select a landmark', previousChapter:'PREVIOUS CHAPTER', villageArchive:'Village archive', world:'Atlas', journeys:'Journeys', collection:'Collection', allLinks:'All destinations', openWorld:'Every destination is a beginning', renderFallback:'The map is unavailable. Every destination is still in the directory.' },
};
const tr = (fa, en) => lang === 'fa' ? fa : en;
const local = (entry) => entry?.[lang] || entry?.en || '';
const number = (value) => new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en').format(value);
const journeyIcon = (id) => ({ inspiration:'spark', build:'forge', learn:'book' }[id] || 'route');
const kindName = (kind) => ({ repo:tr('کد و راهنما','Source & guide'), read:tr('خواندنی','Reading'), channel:tr('کانال','Channel'), contact:tr('ارتباط','Contact'), explore:tr('کشف','Explore'), site:tr('وب‌سایت','Website'), social:tr('شبکهٔ اجتماعی','Social'), archive:tr('مخزن آرشیوشده','Archived source') }[kind] || kind);
const store = createProgressStore({ catalog, onChange(next) { if (JSON.stringify(state.saved) !== JSON.stringify(next.saved)) shareUrl = ''; state = next; renderState(); }, onStorageError() { queueMicrotask(() => toast(tr('ذخیره‌سازی مرورگر در دسترس نیست؛ این بار پیشرفت فقط تا بستن صفحه می‌ماند.','Browser storage is unavailable. This visit’s progress lasts until the page closes.'))); } });
state = store.getState();

function toast(message) {
  const element = $('#toast');
  element.textContent = message; element.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { element.hidden = true; }, 5500);
}
function persistPreferences() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ lang, ...(typeof preferences.motion === 'boolean' ? { motion: preferences.motion } : {}) })); } catch { /* Language continues for this visit. */ }
}
function chime() {
  if (!sound || !audioContext) return;
  const now = audioContext.currentTime;
  [440, 660].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now + index * 0.075);
    gain.gain.linearRampToValueAtTime(0.035, now + index * 0.075 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.075 + 0.28);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.start(now + index * 0.075); oscillator.stop(now + index * 0.075 + 0.3);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}
async function change(mutator) {
  try { return await store.mutate(mutator); }
  catch { toast(tr('این انتخاب ثبت نشد. دوباره امتحان کن.','That choice could not be saved. Please try again.')); return { ok:false }; }
}
function heading(symbol, title, description, kicker = '') {
  return `<div class="panel-heading"><span class="panel-symbol">${icon(symbol)}</span>${kicker ? `<div class="panel-kicker">${esc(kicker)}</div>` : ''}<h1 id="panel-title">${esc(title)}</h1><p>${esc(description)}</p></div>`;
}
function dots(progress) {
  return `<span class="route-dots" aria-label="${esc(tr(`${number(progress.completed)} از ${number(progress.total)} مقصد انتخاب شده`,`${progress.completed} of ${progress.total} destinations chosen`))}">${progress.steps.map((step) => `<span class="${step.completed ? 'done' : ''}"></span>`).join('')}</span>`;
}
function renderIntro() {
  const active = journeyById.get(state.activeJourney);
  $('#intro-card').classList.toggle('has-active-path', Boolean(active));
  if (active) {
    const progress = getJourneyProgress(state, active, catalog);
    const next = destinationById.get(progress.nextDestinationId);
    $('#intro-card').innerHTML = `<div class="eyebrow"><span class="eyebrow-line"></span>${esc(tr('مسیر تو در این جهان','YOUR PATH THROUGH THE WORLD'))}</div><h1>${esc(local(active.title))}</h1><p class="intro-lead">${esc(progress.complete ? tr('هر سه مقصد را انتخاب کردی. چه چیزی را با خودت می‌بری؟','You chose all three destinations. What will you take with you?') : tr('یک ایده را دنبال کن؛ هر انتخاب، رد تازه‌ای روی نقشه می‌گذارد.','Follow an idea. Every choice leaves a new mark on the map.'))}</p><div class="active-path-card"><div class="route-title"><span>${esc(progress.complete ? tr('مسیر پیموده شد','PATH EXPLORED') : tr('مقصد بعدی','NEXT DESTINATION'))}</span>${dots(progress)}</div><strong>${esc(next ? local(next.title) : tr('چیزهای ارزشمند را نگه دار','Keep what matters to you'))}</strong><button class="primary-button" type="button" data-action="${progress.complete ? 'collection' : 'journeys'}">${icon(progress.complete ? 'bag' : 'route')}${esc(progress.complete ? words[lang].collection : tr('ادامهٔ مسیر','Continue the journey'))}</button></div><button class="text-button" type="button" data-action="journeys">${esc(tr('انتخاب یک مسیر دیگر','Choose another path'))}</button>`;
    return;
  }
  $('#intro-card').innerHTML = `<div class="eyebrow"><span class="eyebrow-line"></span>${esc(tr('اطلس شخصی هادس سوم','THE PERSONAL ATLAS OF HADES III'))}</div><h1>${tr('هر در،<br> یک دنیای تازه.','Every door.<br> A new world.')}</h1><p class="intro-lead">${esc(tr('میان ایده‌ها، ابزارها و داستان‌هایی که می‌سازم راه خودت را پیدا کن.','Find your way through the ideas, tools and stories I make.'))}</p><div class="section-label">${esc(tr('امروز دنبال چه می‌گردی؟','WHAT BRINGS YOU HERE?'))}</div><div class="journey-choices">${catalog.journeys.map((journey) => `<button type="button" class="journey-choice" data-action="choose-journey" data-journey="${journey.id}">${icon(journeyIcon(journey.id))}<span>${esc(journey.id === 'inspiration' ? tr('الهام بگیر','Be inspired') : journey.id === 'build' ? tr('چیزی بساز','Make something') : tr('یاد بگیر','Learn something'))}</span><small>${esc(tr('۳ مقصد','3 stops'))}</small></button>`).join('')}</div><p class="intro-footnote">${esc(tr('یا روی نقشه آزادانه بگرد. انتخاب با توست.','Or wander the atlas. This is your journey.'))}</p>`;
}
function destinationCard(destination) {
  const saved = state.saved.includes(destination.id);
  const opened = state.opened.includes(destination.id);
  return `<article class="destination-card" data-destination="${destination.id}"><div class="destination-meta"><span class="kind-tag">${esc(kindName(destination.kind))}</span>${opened ? `<span class="opened-tag">${icon('check')}${esc(tr('انتخاب شده','Chosen'))}</span>` : ''}</div><h3 dir="auto">${esc(local(destination.title))}</h3><p>${esc(local(destination.summary))}</p><div class="destination-actions">${openLink(destination)}<button class="save-button${saved ? ' is-saved' : ''}" type="button" data-action="save" data-id="${destination.id}" aria-pressed="${saved}" aria-label="${esc(`${saved ? tr('حذف از کوله‌بار: ','Remove from collection: ') : tr('ذخیره در کوله‌بار: ','Save to collection: ')}${local(destination.title)}`)}">${icon(saved ? 'check' : 'bookmark')}<span>${esc(saved ? tr('ذخیره شده','Saved') : tr('ذخیره','Save'))}</span></button></div></article>`;
}
function openLink(destination, label) {
  return `<a class="destination-open" href="${esc(destination.url)}" target="_blank" rel="noopener noreferrer" data-open="${destination.id}" aria-label="${esc(`${tr('بازکردن ','Open ')}${local(destination.title)}${tr(' در زبانهٔ تازه',' in a new tab')}`)}">${icon('links')}${esc(label || tr('بازکردن مقصد','Open destination'))}</a>`;
}
function renderRealm() {
  const realm = realmById.get(selectedRealm);
  if (!realm) return '';
  const progress = getRealmProgress(state, realm.id, catalog);
  const entries = catalog.destinations.filter((entry) => entry.realmIds.includes(realm.id));
  return `${heading(realm.icon, local(realm.title), local(realm.description), local(realm.tagline))}<div class="route-overview"><span>${esc(tr('ردپای تو در این قلمرو','YOUR FOOTPRINT HERE'))}</span><strong>${number(progress.opened)} / ${number(progress.total)}</strong></div><p class="panel-note">${esc(progress.lit ? tr('این بخش با انتخاب‌های تو روشن شده است.','Your choices have lit this district.') : tr('یکی از مقصدها را باز کن تا مسیر این قلمرو روشن شود.','Open a destination to light this district’s path.'))}</p><div class="destination-list">${entries.map(destinationCard).join('')}</div>`;
}
function renderJourneys() {
  const active = journeyById.get(state.activeJourney);
  let result = heading('route', tr('یک مسیر، سه کشف','One path. Three discoveries.'), tr('از علاقه‌ات شروع کن؛ هر مسیر سه مقصد مرتبط را پیشنهاد می‌دهد. هر جا خواستی از مسیر بیرون بزن.','Start with a curiosity. Each journey connects three destinations. Wander off whenever you like.'));
  if (active) {
    const progress = getJourneyProgress(state, active, catalog);
    result += `<div class="route-overview"><strong>${esc(local(active.title))}</strong>${dots(progress)}</div><p class="panel-note">${esc(local(active.description))}</p><div class="journey-steps">${progress.steps.map((step, index) => {
      const destination = destinationById.get(step.destinationId);
      const saved = state.saved.includes(destination.id);
      return `<article class="journey-step${step.completed ? ' is-done' : ''}${destination.id === progress.nextDestinationId ? ' is-next' : ''}"><span class="step-number">${step.completed ? icon('check') : number(index + 1)}</span><div class="step-body"><span class="section-label">${esc(step.completed ? tr('انتخاب شده','CHOSEN') : destination.id === progress.nextDestinationId ? tr('مقصد بعدی','NEXT STOP') : tr('توقف در مسیر','ON YOUR PATH'))}</span><h3>${esc(local(step.prompt))}</h3><p>${esc(local(step.why))}</p><div class="step-destination"><strong dir="auto">${esc(local(destination.title))}</strong><span>${esc(kindName(destination.kind))}</span></div><div class="destination-actions">${openLink(destination)}<button type="button" class="save-button${saved ? ' is-saved' : ''}" data-action="save" data-id="${destination.id}" aria-pressed="${saved}" aria-label="${esc(`${saved ? tr('حذف از کوله‌بار: ','Remove from collection: ') : tr('ذخیره در کوله‌بار: ','Save to collection: ')}${local(destination.title)}`)}">${icon(saved ? 'check' : 'bookmark')}<span>${esc(saved ? tr('ذخیره شده','Saved') : tr('ذخیره','Save'))}</span></button></div></div></article>`;
    }).join('')}</div>${progress.complete ? `<div class="collection-message">${icon('spark')}<strong>${esc(tr('سه مقصد این مسیر را انتخاب کردی.','You chose all three stops.'))}</strong><p>${esc(tr('مقصدهای مفید را در کوله‌بار نگه دار یا مسیر دیگری را شروع کن.','Save useful destinations to your collection or take another path.'))}</p><button type="button" class="secondary-button" data-action="collection">${icon('bag')}${esc(words[lang].collection)}</button></div>` : ''}<p class="panel-note">${esc(tr('این ردپا انتخابِ لینک را ثبت می‌کند؛ خواندن یا تمام‌کردن محتوا سنجیده نمی‌شود.','Progress records choosing a link, not reading or completing its content.'))}</p>`;
  }
  result += `<div class="section-label">${esc(active ? tr('مسیرت را عوض کن','CHOOSE ANOTHER PATH') : tr('مسیر شروع را انتخاب کن','CHOOSE YOUR STARTING POINT'))}</div><div class="journey-list">${catalog.journeys.map((journey, index) => {
    const progress = getJourneyProgress(state, journey, catalog);
    return `<button type="button" class="journey-card${journey.id === active?.id ? ' is-active' : ''}${progress.complete ? ' is-complete' : ''}" data-action="choose-journey" data-journey="${journey.id}" aria-pressed="${journey.id === active?.id}"><span class="journey-number">${icon(journeyIcon(journey.id))}<small>0${index + 1}</small></span><span><h3>${esc(local(journey.title))}</h3><p>${esc(local(journey.description))}</p><span class="journey-progress">${dots(progress)}<span>${number(progress.completed)} / ${number(progress.total)}</span></span></span></button>`;
  }).join('')}</div>`;
  if (active) result += `<button class="text-button" type="button" data-action="wander">${esc(tr('فعلاً آزادانه می‌گردم','Explore freely for now'))}</button>`;
  return result;
}
function renderDirectory() {
  return `${heading('compass', words[lang].allLinks, tr('همهٔ جهان‌هایی که می‌سازم، یک‌جا. با نام، موضوع یا نوع مقصد جست‌وجو کن.','All the worlds I make, in one place. Search by name, topic or destination type.'))}<label class="search-field">${icon('search')}<span class="sr-only">${esc(tr('جست‌وجوی مقصدها','Search destinations'))}</span><input id="directory-search" type="search" placeholder="${esc(tr('نام پروژه، موضوع یا کانال…','Project, topic or channel…'))}" value="${esc(directoryQuery)}" autocomplete="off" spellcheck="false"></label><div class="filter-list" aria-label="${esc(tr('فیلتر قلمروها','Filter by realm'))}">${[{id:'all',title:{fa:'همه',en:'All'}}, ...catalog.realms].map((realm) => `<button type="button" class="filter-button${directoryFilter === realm.id ? ' is-active' : ''}" data-action="filter" data-realm="${realm.id}" aria-pressed="${directoryFilter === realm.id}">${esc(local(realm.title))}</button>`).join('')}</div><div class="directory-count" id="directory-count" role="status" aria-live="polite"></div><div id="directory-results" class="destination-list"></div>`;
}
function normalizeSearch(value) {
  return value.normalize('NFKC').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\u064B-\u065F\u0670\u200C\u200D]/g, '').toLocaleLowerCase().trim();
}
function renderDirectoryResults() {
  const query = normalizeSearch(directoryQuery);
  const entries = catalog.destinations.filter((destination) => {
    if (directoryFilter !== 'all' && !destination.realmIds.includes(directoryFilter)) return false;
    const haystack = normalizeSearch([destination.title.fa,destination.title.en,destination.summary.fa,destination.summary.en,destination.url,kindName(destination.kind),...destination.realmIds.map((id) => local(realmById.get(id).title))].join(' '));
    return query.split(/\s+/).every((word) => haystack.includes(word));
  });
  $('#directory-count').textContent = `${number(entries.length)} ${tr('مقصد','destinations')}`;
  $('#directory-results').innerHTML = entries.length ? entries.map(destinationCard).join('') : `<div class="empty-state">${icon('search')}<h2>${esc(tr('مقصدی پیدا نشد','No destination found'))}</h2><p>${esc(tr('عبارت کوتاه‌تری بنویس یا فیلتر دیگری انتخاب کن.','Try a shorter search or choose a different filter.'))}</p><button class="secondary-button" type="button" data-action="clear-search">${esc(tr('پاک‌کردن جست‌وجو','Clear search'))}</button></div>`;
}
function renderCollection(isShared = false) {
  const ids = isShared ? sharedIds : state.saved;
  let result = heading(isShared ? 'share' : 'bag', isShared ? tr('کوله‌بار یک هم‌مسیر','A fellow traveller’s collection') : tr('چیزهایی برای بردن','Things to take with you'), isShared ? tr('این مجموعه با تو به اشتراک گذاشته شده. مقصدها را ببین و اگر خواستی به کوله‌بار خودت اضافه کن.','This collection was shared with you. Explore it and add it to your own collection if it interests you.') : tr('هرچه به کارت می‌آید اینجا نگه دار؛ از یک ابزار تا ایدهٔ پروژهٔ بعدی.','Keep what speaks to you, from a useful tool to the seed of your next project.'));
  if (isShared && ids.length) {
    const newCount = ids.filter((id) => !state.saved.includes(id)).length;
    result += `<div class="shared-banner"><strong>${number(ids.length)} ${esc(tr('مقصد مشترک','shared destinations'))}</strong><button class="primary-button" type="button" data-action="import-collection" ${newCount ? '' : 'disabled'}>${icon(newCount ? 'bag' : 'check')}${esc(newCount ? tr('افزودن به کوله‌بار من','Add to my collection') : tr('همه در کوله‌بار تو هستند','All are in your collection'))}</button></div>`;
  } else if (sharedIds.length) {
    result += `<button class="secondary-button" type="button" data-action="shared">${icon('share')}${esc(tr('دیدن مجموعهٔ دریافتی','View the shared collection'))}</button>`;
  }
  if (!ids.length) return `${result}<div class="empty-state">${icon('bookmark')}<h2>${esc(tr('جا برای کشف‌های تو','Room for your discoveries'))}</h2><p>${esc(tr('کنار هر مقصد «ذخیره» را بزن. بعد می‌توانی مجموعه‌ات را با یک لینک بفرستی یا دانلود کنی.','Choose Save beside any destination. Then share your collection with a link or download it.'))}</p><button class="primary-button" type="button" data-action="links">${icon('compass')}${esc(tr('پیداکردن اولین مقصد','Find your first destination'))}</button></div>`;
  if (!isShared) result += `<div class="collection-toolbar"><strong>${number(ids.length)} ${esc(tr('مقصد در کوله‌بار','destinations saved'))}</strong><div class="panel-actions"><button type="button" class="secondary-button" data-action="share-collection">${icon('share')}${esc(tr('اشتراک‌گذاری','Share'))}</button><button type="button" class="secondary-button" data-action="download-collection">${icon('download')}${esc(tr('دانلود فهرست','Download list'))}</button></div></div>${shareUrl ? `<div class="share-box"><label for="collection-url">${esc(tr('لینک مجموعهٔ تو','Your collection link'))}</label><input id="collection-url" type="url" dir="ltr" readonly value="${esc(shareUrl)}"><p class="panel-note">${esc(tr('این لینک فقط مقصدهای همین مجموعه را دارد؛ تغییرهای بعدی را دوباره به اشتراک بگذار.','This link contains the current selection. Share again after making changes.'))}</p></div>` : ''}`;
  result += `<div class="destination-list">${ids.map((id) => destinationById.get(id)).filter(Boolean).map(destinationCard).join('')}</div>`;
  if (!isShared) result += `<p class="panel-note">${esc(tr('کوله‌بار روی همین مرورگر می‌ماند. برای نگه‌داشتن آن در جای دیگر، لینک یا فایلش را بردار.','Your collection stays in this browser. Keep its link or file to take it elsewhere.'))}</p>`;
  return result;
}
function renderJournal() {
  const progress = getProgressSummary(state, catalog);
  return `${heading('quests', tr('ردپای تو','Your footprint'), tr('نقشه با انتخاب‌های واقعی تو روشن می‌شود. اینجا مسیرهایی را می‌بینی که تا امروز از این اطلس آغاز کرده‌ای.','Your choices light the atlas. This is a record of the paths you have started here.'))}<div class="stats-grid"><div><strong>${number(progress.litRealms)}<small> / ${number(progress.totalRealms)}</small></strong><span>${esc(tr('قلمرو روشن','Districts lit'))}</span></div><div><strong>${number(progress.openedDestinations)}</strong><span>${esc(tr('مقصد انتخاب‌شده','Destinations chosen'))}</span></div><div><strong>${number(progress.savedDestinations)}</strong><span>${esc(tr('مقصد ذخیره‌شده','Destinations saved'))}</span></div><div><strong>${number(progress.completedJourneys)}<small> / ${number(progress.totalJourneys)}</small></strong><span>${esc(tr('مسیر پیموده‌شده','Paths explored'))}</span></div></div><div class="section-label">${esc(tr('نقشهٔ کشف‌ها','YOUR DISCOVERY MAP'))}</div><div class="realm-progress-list">${catalog.realms.map((realm) => { const realmProgress = getRealmProgress(state, realm.id, catalog); return `<button type="button" class="realm-progress-item${realmProgress.lit ? ' is-lit' : ''}" data-action="realm" data-realm="${realm.id}">${icon(realm.icon)}<span><strong>${esc(local(realm.title))}</strong><small>${esc(realmProgress.lit ? tr('مسیر روشن است','Path illuminated') : realmProgress.discovered ? tr('کشف شده؛ مقصدی انتخاب کن','Discovered; choose a destination') : tr('در انتظار کشف','Waiting to be discovered'))}</small></span><span class="progress-dots">${number(realmProgress.opened)} / ${number(realmProgress.total)}</span></button>`; }).join('')}</div><p class="panel-note">${esc(tr('«انتخاب‌شده» یعنی لینک را از این اطلس باز کرده‌ای؛ ما بازشدن صفحهٔ بیرونی، مطالعه یا یادگیری را اندازه نمی‌گیریم.','“Chosen” means you selected its link here. The atlas does not measure whether the external page loaded, was read or learned from.'))}</p>${progress.openedDestinations ? `<div class="section-label">${esc(tr('آخرین انتخاب‌ها','RECENT FIRST CHOICES'))}</div><div class="destination-list">${[...state.opened].reverse().slice(0, 5).map((id) => destinationCard(destinationById.get(id))).join('')}</div>` : `<button class="primary-button" type="button" data-action="journeys">${icon('route')}${esc(tr('اولین مسیرت را انتخاب کن','Choose your first path'))}</button>`}`;
}
function renderArchive() {
  return `${heading('watchtower', tr('فصل قبلی، محفوظ','The previous chapter, preserved'), tr('دهکدهٔ اولیهٔ هادس هنوز اینجاست؛ با ساخت‌وساز، منابع و حال‌وهوای خودش. هر وقت خواستی به آن سر بزن.','The original Hades village is still here, with its building, resources and its own atmosphere. Visit whenever you like.'))}<article class="archive-card"><div class="archive-mark"><img src="./hades-mark.png" alt=""></div><span class="section-label" lang="en">HADES REALM / VILLAGE V2</span><h2>${esc(tr('دهکدهٔ جهان زیرین','The underworld village'))}</h2><p>${esc(tr('نسخهٔ پیشین جداگانه نگه‌داری می‌شود. پیشرفت آن از این اطلس مستقل است.','The previous version lives in a separate archive. Its progress is independent of this atlas.'))}</p><div class="panel-actions"><a class="primary-button" href="./archive/village-v2/" target="_blank" rel="noopener noreferrer">${icon('citadel')}${esc(tr('بازی نسخهٔ قبلی','Play the original village'))}</a><a class="secondary-button" href="./archive/HadesRealm-Village-v2-backup.zip" download>${icon('download')}${esc(tr('دانلود بک‌آپ کامل','Download complete backup'))}</a></div></article><p class="panel-note">${esc(tr('بک‌آپ شامل کد و فایل‌های اجرایی اصلی نسخهٔ دوم است. آرشیوشده در ۷ آذر ۱۴۰۵.','The backup includes the original source and playable build of version 2. Archived 28 November 2026.'))}</p>`;
}
function renderHelp() {
  return `${heading('help', tr('نقشه‌ای که با تو زنده می‌شود','An atlas that comes alive with you'), tr('از یک کنجکاوی شروع کن؛ مقصدهای مفیدت را پیدا کن و همراه ببر.','Start with a curiosity. Find useful destinations and take them with you.'))}<ol class="help-list"><li><strong>${esc(tr('کشف کن','Explore'))}</strong><p>${esc(tr('ساختمان‌ها موضوع‌های این جهان‌اند. هرکدام را انتخاب کن تا مقصدها و توضیحشان را ببینی.','Landmarks are the subjects of this world. Select one to see its destinations and descriptions.'))}</p></li><li><strong>${esc(tr('مسیر را روشن کن','Light a path'))}</strong><p>${esc(tr('وقتی لینک یک مقصد را انتخاب می‌کنی، راه و پنجره‌های قلمرو مرتبط روشن می‌شوند. مسیرهای سه‌مرحله‌ای چند پیشنهاد مرتبط را کنار هم می‌گذارند.','Choosing a destination lights its district’s path and windows. Three-stop journeys connect related suggestions.'))}</p></li><li><strong>${esc(tr('با خودت ببر','Take it with you'))}</strong><p>${esc(tr('مقصدهای دلخواهت را ذخیره کن. کوله‌بار را با لینک به اشتراک بگذار یا به شکل فایل Markdown دانلود کن.','Save destinations you like. Share your collection with a link or download a Markdown list.'))}</p></li></ol><div class="section-label">${esc(tr('حرکت در نقشه','MOVING AROUND'))}</div><p>${esc(tr('تصویر را بکش تا بچرخد؛ اسکرول یا دو انگشت برای زوم. نام ساختمان‌ها و فهرست مقصدها با کیبورد هم در دسترس‌اند. دکمهٔ توقف بالای صفحه، حرکت رود و محیط را متوقف می‌کند.','Drag to orbit; scroll or pinch to zoom. Landmark labels and the directory are also keyboard accessible. The pause button in the header stops the river and ambient motion.'))}</p><p class="panel-note">${esc(tr('۱ تا ۶: قلمروها · J: مسیرها · C: کوله‌بار · L یا /: جست‌وجو · R: دوربین · Esc: بستن','1–6: districts · J: journeys · C: collection · L or /: search · R: camera · Esc: close'))}</p><div class="section-label">${esc(tr('ردپای تو کجا می‌ماند؟','WHERE YOUR FOOTPRINT LIVES'))}</div><p>${esc(tr('پیشرفت و کوله‌بار فقط در مرورگر تو ذخیره می‌شوند. با پاک‌کردن داده‌های مرورگر از بین می‌روند. هیچ حساب یا ردیابی‌ای لازم نیست.','Progress and collections are saved only in your browser. Clearing browser data removes them. No account or tracking is involved.'))}</p><button class="secondary-button" type="button" data-action="archive">${icon('watchtower')}${esc(tr('آرشیو و بک‌آپ نسخهٔ قبلی','Original village & backup'))}</button><div class="reset-box">${resetPending ? `<div class="confirm-reset"><strong>${esc(tr('ردپا و کوله‌بار این اطلس پاک شود؟','Clear this atlas’s footprint and collection?'))}</strong><p>${esc(tr('فقط ذخیره‌های همین مرورگر پاک می‌شوند. بک‌آپ دهکده تغییری نمی‌کند.','This clears the atlas’s data in this browser. The archived village is unaffected.'))}</p><div class="panel-actions"><button class="secondary-button" type="button" data-action="cancel-reset">${esc(tr('انصراف','Cancel'))}</button><button class="primary-button" type="button" data-action="confirm-reset">${esc(tr('بله، پاک کن','Yes, clear it'))}</button></div></div>` : `<button class="text-button" type="button" data-action="ask-reset">${icon('reset')}${esc(tr('شروع دوبارهٔ ردپا','Reset my footprint'))}</button>`}</div>`;
}
function focusKey(element) {
  if (!element || !$('#detail-panel').contains(element)) return null;
  if (element.id) return { id:element.id, start:element.selectionStart, end:element.selectionEnd };
  const target = element.closest('[data-action],[data-open]');
  return target ? { action:target.dataset.action, open:target.dataset.open, idValue:target.dataset.id, realm:target.dataset.realm, journey:target.dataset.journey } : null;
}
function restoreFocus(key) {
  if (!key) return;
  const target = key.id ? document.getElementById(key.id) : $$('#panel-body [data-action],#panel-body [data-open]').find((element) => element.dataset.action === key.action && element.dataset.open === key.open && element.dataset.id === key.idValue && element.dataset.realm === key.realm && element.dataset.journey === key.journey);
  if (target) {
    target.focus({ preventScroll:true });
    if (key.start != null && ['search','text'].includes(target.type)) target.setSelectionRange(key.start, key.end);
  } else $('#detail-panel').focus({ preventScroll:true });
}
function renderPanel(fresh = false) {
  if (!panelMode) return;
  const element = $('#detail-panel');
  const previousFocus = fresh ? null : focusKey(document.activeElement);
  const scroll = fresh ? 0 : element.scrollTop;
  const renderers = { realm:renderRealm, journeys:renderJourneys, links:renderDirectory, collection:() => renderCollection(), shared:() => renderCollection(true), journal:renderJournal, archive:renderArchive, help:renderHelp };
  $('#panel-body').innerHTML = renderers[panelMode]?.() || '';
  $('#panel-overline').textContent = `HADES / ${panelMode === 'realm' ? selectedRealm.toUpperCase() : panelMode.toUpperCase()}`;
  if (panelMode === 'links') renderDirectoryResults();
  element.scrollTop = scroll;
  restoreFocus(previousFocus);
}
function showPanel(mode, realmId) {
  const firstOpening = !panelMode;
  if (firstOpening) lastFocus = document.activeElement;
  if (mode !== 'help') resetPending = false;
  panelMode = mode;
  document.body.dataset.panel = mode;
  selectedRealm = mode === 'realm' ? realmId : null;
  $('#detail-panel').hidden = false;
  $('#intro-card').inert = true;
  document.body.classList.add('panel-open');
  scene?.select(mode === 'realm' ? realmId : ({journeys:'citadel',journal:'plot-a',collection:'plot-b',shared:'plot-b',archive:'plot-c'}[mode] || null));
  renderPanel(true); updateDock(); updateLabels();
  $('#detail-panel').focus({ preventScroll:true });
  if (mode === 'realm') void change((draft) => discoverRealm(draft, realmId, catalog));
}
function closePanel() {
  if (!panelMode) return;
  panelMode = null; selectedRealm = null; resetPending = false;
  delete document.body.dataset.panel;
  $('#detail-panel').hidden = true;
  $('#intro-card').inert = false;
  document.body.classList.remove('panel-open');
  scene?.select(null); updateDock(); updateLabels();
  if (lastFocus?.isConnected && lastFocus !== document.body && lastFocus !== document.documentElement && !lastFocus.closest('[inert],[hidden]')) lastFocus.focus({ preventScroll:true });
  else $('#nav-world').focus({ preventScroll:true });
}
function updateDock() {
  $$('.dock-button').forEach((button) => {
    const active = button.dataset.section === (panelMode === 'shared' ? 'collection' : panelMode || 'world');
    button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
  });
}
function labelInfo(id) {
  const realm = realmById.get(id);
  if (realm) return { title:local(realm.title), symbol:realm.icon };
  return {citadel:{title:tr('آغاز سفر','Journey hub'),symbol:'citadel'},'plot-a':{title:tr('ردپای تو','Your footprint'),symbol:'quests'},'plot-b':{title:words[lang].collection,symbol:'bag'},'plot-c':{title:tr('دهکدهٔ پیشین','Original village'),symbol:'watchtower'}}[id];
}
function makeLabels() {
  for (const id of ['citadel',...catalog.realms.map((realm) => realm.id),'plot-a','plot-b','plot-c']) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'landmark-label'; button.dataset.landmark = id;
    button.addEventListener('click', () => selectLandmark(id));
    $('#landmark-labels').append(button); labels.set(id, button);
  }
  updateLabels();
}
function updateLabels() {
  for (const [id, button] of labels) {
    const info = labelInfo(id);
    const lit = realmById.has(id) ? getRealmProgress(state,id,catalog).lit : id === 'plot-b' ? state.saved.length > 0 : id === 'plot-a' ? state.opened.length > 0 : id === 'citadel' ? Boolean(state.activeJourney) : false;
    button.innerHTML = `<span class="label-icon">${icon(info.symbol)}</span><span class="label-text">${esc(info.title)}</span><span class="label-dot" aria-hidden="true"></span>`;
    button.title = info.title;
    button.setAttribute('aria-label', info.title);
    button.setAttribute('aria-pressed', String(selectedRealm === id || ({journeys:'citadel',journal:'plot-a',collection:'plot-b',shared:'plot-b',archive:'plot-c'}[panelMode] === id)));
    button.classList.toggle('is-lit', lit);
    button.classList.toggle('is-selected', button.getAttribute('aria-pressed') === 'true');
  }
}
function selectLandmark(id) {
  if (realmById.has(id)) showPanel('realm',id);
  else showPanel({citadel:'journeys','plot-a':'journal','plot-b':'collection','plot-c':'archive'}[id] || 'journeys');
}
function syncScene() {
  if (!scene) return;
  const summary = getProgressSummary(state,catalog);
  const stages = {citadel:summary.completedJourneys ? 3 : state.activeJourney ? 2 : 1};
  const lit = [];
  for (const realm of catalog.realms) {
    const progress = getRealmProgress(state,realm.id,catalog);
    stages[realm.id] = progress.lit ? 3 : progress.discovered ? 2 : 1;
    if (progress.lit) lit.push(realm.id);
  }
  if (summary.openedDestinations) lit.push('plot-a');
  if (summary.savedDestinations) lit.push('plot-b');
  if (summary.completedJourneys) lit.push('citadel');
  scene.setLevels(stages); scene.setExplored(lit);
}
function renderState() {
  const summary = getProgressSummary(state,catalog);
  $('#progress-count').textContent = tr(`${number(summary.litRealms)} / ${number(summary.totalRealms)} قلمرو روشن`,`${summary.litRealms} / ${summary.totalRealms} districts lit`);
  $('#progress-button').setAttribute('aria-label', tr(`ردپای تو، ${number(summary.openedDestinations)} مقصد انتخاب‌شده`, `Your footprint, ${summary.openedDestinations} destinations chosen`));
  $('.progress-orbit').style.setProperty('--progress', `${summary.litRealms / summary.totalRealms * 360}deg`);
  $('#collection-badge').textContent = number(summary.savedDestinations);
  $('#collection-badge').hidden = !summary.savedDestinations;
  renderIntro(); updateLabels(); syncScene(); renderPanel(); updateDock();
}
function renderMotionControl() {
  const button = $('#motion-toggle');
  button.innerHTML = icon(ambientMotion ? 'pause' : 'play');
  const label = ambientMotion ? tr('توقف حرکت‌های محیط','Pause ambient motion') : tr('پخش حرکت‌های محیط','Play ambient motion');
  button.setAttribute('aria-label', label); button.title = label;
  button.dataset.playing = String(ambientMotion);
}
function renderLanguage() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  document.title = tr('Hades Realm · اطلس جهان هادس','Hades Realm · An atlas of ideas');
  $('.hud-header').setAttribute('aria-label',tr('اطلس هادس','Hades atlas'));
  $('.camera-tools').setAttribute('aria-label',tr('کنترل دوربین','Camera controls'));
  $('.dock-nav').setAttribute('aria-label',tr('منوی اطلس','Atlas navigation'));
  $$('[data-i]').forEach((element) => { if (words[lang][element.dataset.i]) element.textContent = words[lang][element.dataset.i]; });
  $('#language').textContent = lang === 'fa' ? 'EN' : 'فا';
  $('#language').setAttribute('aria-label', tr('Switch to English','تغییر زبان به فارسی'));
  $('#sound-toggle').innerHTML = icon(sound ? 'sound' : 'mute');
  $('#sound-toggle').setAttribute('aria-label', sound ? tr('خاموش‌کردن صدا','Turn sound off') : tr('فعال‌سازی صدا','Turn sound on'));
  $('#sound-toggle').setAttribute('aria-pressed',String(sound));
  renderMotionControl();
  $('#help').innerHTML = icon('help'); $('#help').setAttribute('aria-label',tr('راهنمای اطلس','Atlas guide'));
  $('#close-panel').innerHTML = icon('close'); $('#close-panel').setAttribute('aria-label',tr('بستن','Close'));
  for (const [id,symbol,fa,en] of [['zoom-in','plus','بزرگ‌نمایی','Zoom in'],['zoom-out','minus','کوچک‌نمایی','Zoom out'],['reset-camera','compass','بازگشت دوربین','Reset camera']]) { $(`#${id}`).innerHTML = icon(symbol); $(`#${id}`).setAttribute('aria-label',tr(fa,en)); }
  for (const [id,symbol] of [['world','compass'],['journeys','route'],['collection','bag'],['links','search']]) $(`#nav-${id} .dock-icon`).innerHTML = icon(symbol);
  $('#archive-icon').innerHTML = icon('watchtower');
  $('#loading-links').textContent = words[lang].allLinks;
  $('#loading p').textContent = tr('نقشهٔ جهان در حال بازشدن است…','Opening the atlas…');
  $('.skip-link').textContent = tr('رفتن به فهرست مقصدها','Skip to the destination directory');
  $('#world-canvas').setAttribute('aria-label',tr('اطلس سه‌بعدی هادس؛ دکمه‌های روی نقشه یا فهرست مقصدها را انتخاب کنید.','Hades 3D atlas. Select a landmark label or use the destination directory.'));
  $('#intro-card').setAttribute('aria-label',tr('آغاز سفر','Start a journey'));
  renderState();
}
async function recordOpen(id) {
  const currentJourney = journeyById.get(state.activeJourney);
  const wasComplete = currentJourney ? getJourneyProgress(state,currentJourney,catalog).complete : false;
  const result = await change((draft) => openDestination(draft,id,catalog));
  if (!result.ok || !result.firstOpen) return;
  chime();
  if (currentJourney && !wasComplete && getJourneyProgress(state,currentJourney,catalog).complete) toast(tr('سه مقصد این مسیر را انتخاب کردی. کشف‌های مفیدت را نگه دار.','You chose all three stops. Keep your useful discoveries.'));
  else toast(tr('انتخابت روی نقشه ثبت شد.','Your choice left a mark on the atlas.'));
}
async function shareCollection() {
  const hash = encodeCollection(state.saved,catalog);
  if (!hash) return;
  shareUrl = PUBLIC_URL + hash;
  renderPanel();
  try { await navigator.clipboard.writeText(shareUrl); toast(tr('لینک این مجموعه کپی شد.','Collection link copied.')); }
  catch { $('#collection-url')?.focus(); $('#collection-url')?.select(); toast(tr('لینک آماده است؛ آن را از کادر کپی کن.','Your link is ready. Copy it from the field.')); }
}
function downloadCollection() {
  if (!state.saved.length) return;
  const lines = ['# Hades Realm · '+tr('کوله‌بار من','My collection'),'',PUBLIC_URL,'',...state.saved.map((id) => { const destination = destinationById.get(id); return `- [${local(destination.title).replace(/[\[\]]/g,'')}](${destination.url})\n  ${local(destination.summary)}`; }),'','---',tr('مجموعه‌ای از مقصدهای عمومی هادس؛ انتخاب‌شده توسط بازدیدکننده.','A visitor’s selection of public Hades destinations.'),''];
  const blob = new Blob([lines.join('\n')], {type:'text/markdown;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = 'HadesRealm-my-collection.md';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(tr('فهرست مجموعه برای دانلود آماده شد.','Your collection list is ready to download.'));
}
async function action(name, target) {
  if (['journeys','collection','shared','links','journal','archive','help'].includes(name)) { showPanel(name); return; }
  if (name === 'realm') { showPanel('realm',target.dataset.realm); return; }
  if (name === 'choose-journey') {
    const result = await change((draft) => chooseJourney(draft,target.dataset.journey,catalog));
    if (result.ok) { showPanel('journeys'); chime(); }
  } else if (name === 'wander') {
    await change((draft) => chooseJourney(draft,null,catalog)); closePanel();
  } else if (name === 'save') {
    shareUrl = '';
    const result = await change((draft) => toggleSaved(draft,target.dataset.id,catalog));
    if (result.ok) { if (result.saved) chime(); toast(result.saved ? tr('به کوله‌بارت اضافه شد.','Added to your collection.') : tr('از کوله‌بار برداشته شد.','Removed from your collection.')); }
  } else if (name === 'filter') {
    directoryFilter = target.dataset.realm; renderPanel();
  } else if (name === 'clear-search') {
    directoryQuery = ''; directoryFilter = 'all'; renderPanel(); $('#directory-search')?.focus();
  } else if (name === 'share-collection') await shareCollection();
  else if (name === 'download-collection') downloadCollection();
  else if (name === 'import-collection') {
    shareUrl = '';
    const result = await change((draft) => mergeCollection(draft,sharedIds,catalog));
    if (result.ok) { toast(tr(`${number(result.addedIds.length)} مقصد به کوله‌بارت اضافه شد.`,`${result.addedIds.length} destinations added to your collection.`)); showPanel('collection'); chime(); }
  } else if (name === 'ask-reset' || name === 'cancel-reset') { resetPending = name === 'ask-reset'; renderPanel(); if(resetPending) $('[data-action="cancel-reset"]')?.focus(); }
  else if (name === 'confirm-reset' && resetPending) {
    try { await store.reset(); shareUrl = ''; resetPending = false; renderPanel(); toast(tr('ردپای اطلس پاک شد؛ یک شروع تازه.','Atlas progress cleared. A fresh start.')); }
    catch { toast(tr('ذخیره‌ها پاک نشدند؛ دوباره امتحان کن.','Could not clear progress. Please try again.')); }
  }
}
function readSharedHash() {
  sharedIds = [];
  if (!location.hash.startsWith('#collection=')) {
    if (panelMode === 'shared') closePanel();
    else if (panelMode === 'collection') renderPanel();
    return;
  }
  const decoded = decodeCollection(location.hash,catalog);
  if (!decoded.ok || !decoded.ids.length) {
    if (panelMode === 'shared') showPanel('collection');
    else if (panelMode === 'collection') renderPanel();
    toast(tr('این لینک مجموعه معتبر نیست. مقصدها را از فهرست پیدا کن.','This collection link is invalid. Explore the destination directory instead.'));
    return;
  }
  sharedIds = decoded.ids; showPanel('shared');
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-open]');
  if (link) { void recordOpen(link.dataset.open); return; }
  const button = event.target.closest('[data-action]');
  if (button && !button.disabled) void action(button.dataset.action,button);
});
document.addEventListener('auxclick', (event) => { const link = event.target.closest('a[data-open]'); if (event.button === 1 && link) void recordOpen(link.dataset.open); });
document.addEventListener('input', (event) => { if (event.target.id === 'directory-search') { directoryQuery = event.target.value; renderDirectoryResults(); } });
$('#nav-world').addEventListener('click',closePanel);
for (const mode of ['journeys','collection','links']) $(`#nav-${mode}`).addEventListener('click',() => showPanel(mode));
$('#progress-button').addEventListener('click',() => showPanel('journal'));
$('#archive-shortcut').addEventListener('click',() => showPanel('archive'));
$('#help').addEventListener('click',() => showPanel('help'));
$('#close-panel').addEventListener('click',closePanel);
$('#language').addEventListener('click',() => { lang = lang === 'fa' ? 'en' : 'fa'; persistPreferences(); renderLanguage(); scene?.resetCamera(); });
$('#sound-toggle').addEventListener('click',async () => {
  if (sound) { sound = false; renderLanguage(); return; }
  try { const AudioClass = window.AudioContext || window.webkitAudioContext; audioContext ||= new AudioClass(); await audioContext.resume(); sound = true; renderLanguage(); chime(); }
  catch { sound = false; toast(tr('صدا در این مرورگر در دسترس نیست.','Sound is unavailable in this browser.')); }
});
$('#motion-toggle').addEventListener('click',() => { ambientMotion = !ambientMotion; preferences.motion = ambientMotion; persistPreferences(); scene?.setMotion(ambientMotion); renderMotionControl(); });
$('#zoom-in').addEventListener('click',() => scene?.zoom(1));
$('#zoom-out').addEventListener('click',() => scene?.zoom(-1));
$('#reset-camera').addEventListener('click',() => scene?.resetCamera());
$('#loading-links').addEventListener('click',() => { $('#loading').hidden = true; showPanel('links'); });
$('.skip-link').addEventListener('click',(event) => { event.preventDefault(); showPanel('links'); $('#directory-search')?.focus(); });
document.addEventListener('keydown',(event) => {
  if (event.key === 'Escape' && panelMode) { event.preventDefault(); closePanel(); return; }
  if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  const key = event.key.toLowerCase();
  if (/^[1-6]$/.test(key)) { event.preventDefault(); showPanel('realm',catalog.realms[Number(key) - 1].id); }
  else if (['j','c','l','h','/'].includes(key)) { event.preventDefault(); showPanel({j:'journeys',c:'collection',l:'links',h:'help','/':'links'}[key]); if (key === 'l' || key === '/') $('#directory-search')?.focus(); }
  else if (key === 'r') { event.preventDefault(); scene?.resetCamera(); }
});
window.addEventListener('hashchange',readSharedHash);
document.addEventListener('visibilitychange',() => scene?.setPaused(document.hidden));
window.addEventListener('pagehide',(event) => {
  if (event.persisted) { scene?.setPaused(true); return; }
  destroyed = true; store.destroy(); scene?.destroy(); clearTimeout(toastTimer); void audioContext?.close();
});
window.addEventListener('pageshow',(event) => { if (event.persisted) scene?.setPaused(document.hidden); });

makeLabels(); renderLanguage(); readSharedHash();
const loadTimeout = setTimeout(() => { $('#loading').hidden = true; },12000);
function renderFailed(error) { if (error) console.error('Hades Realm could not render its scene:',error); $('#loading').hidden = true; $('#render-notice').hidden = false; $('#landmark-labels').hidden = true; $('#river-caption').hidden = true; clearTimeout(loadTimeout); }
import('./scene.js').then(({ createRealmScene }) => {
  if (destroyed) return;
  scene = createRealmScene({ canvas:$('#world-canvas'), motion:preferences.motion, onMotionChange:(enabled) => { ambientMotion = enabled; renderMotionControl(); }, onSelect:selectLandmark, onHover:(id) => { for (const [key,element] of labels) element.classList.toggle('is-hovered',key === id); }, onReady:() => { $('#loading').hidden = true; clearTimeout(loadTimeout); }, onError:renderFailed, onLabels:(positions) => {
    const rect = $('#world-canvas').getBoundingClientRect();
    positions.forEach(({id,x,y,visible}) => { const element = id === 'river-styx' ? $('#river-caption') : labels.get(id); if (element) { element.style.left = `${rect.left + x}px`; element.style.top = `${rect.top + y}px`; element.hidden = !visible; } });
  } });
  scene.setBuilt({'plot-a':'lantern','plot-b':'garden','plot-c':'watchtower'});
  syncScene();
  if (panelMode) scene.select(panelMode === 'realm' ? selectedRealm : ({journeys:'citadel',journal:'plot-a',collection:'plot-b',shared:'plot-b',archive:'plot-c'}[panelMode] || null));
  scene.setPaused(document.hidden);
}).catch(renderFailed);
