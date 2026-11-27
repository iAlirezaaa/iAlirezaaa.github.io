import './style.css';
import realmData from './realms.json';
import { icon } from './icons.js';
import { createGame, tick, visit, collect, upgrade, build, claimQuest, resetGame, snapshot, upgradeCost, buildCost, getQuests, buildingLevel, production, BUILD_TYPES, CORE_IDS, PLOT_IDS } from './game.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SAVE_KEY = 'hadesrealm.village.v2';
const PREF_KEY = 'hadesrealm.preferences.v2';
const storage = {
  read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
};
const preferences = storage.read(PREF_KEY) || {};
let lang = preferences.lang === 'en' ? 'en' : 'fa';
let theme = preferences.theme === 'day' ? 'day' : 'dusk';
let sound = false;
const initialSave = storage.read(SAVE_KEY);
let state = createGame(initialSave, Date.now());
let saveMetadata = readSaveMetadata(initialSave);
const writerId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let saveSequence = 0;
let saveQueue = Promise.resolve();
let scene;
let sceneFailed = false;
let panelMode = null;
let selected = null;
let selectionRequest = 0;
let selectedPlot = PLOT_IDS.find((id) => !state.plots[id]) || PLOT_IDS[0];
let selectedType = 'lantern';
let directoryFilter = 'all';
let directoryQuery = '';
let resetPending = false;
let lastFocus = null;
let toastTimer;
let audioContext;
let saveCounter = 0;
let saveWarningShown = false;
const labelElements = new Map();

const text = {
  fa: {
    embers: 'اخگر', souls: 'روح', chapter: 'جهان زیرین / فصل اول', welcomeTitle: 'یک جهان،\nهزار داستان.',
    welcomeBody: 'به قلمرو هادس خوش آمدی. هر ساختمان، دری به یکی از چیزهایی است که می‌سازم.',
    explored: 'قلمروهای کشف‌شده', startExplore: 'اکتشاف را شروع کن', currentQuest: 'مأموریت بعدی',
    worldName: 'سرزمینِ آغازها', worldSeason: 'خانهٔ هادس سوم', villageLevel: 'سطح دهکده', villageName: 'قلمرو هادس',
    sceneHint: 'بکش تا بچرخد · اسکرول برای زوم · ساختمان‌ها را انتخاب کن', world: 'دهکده', build: 'ساخت‌وساز', quests: 'مأموریت‌ها', allLinks: 'همهٔ لینک‌ها', collect: 'جمع‌آوری',
    fallbackTitle: 'نمای سه‌بعدی در این مرورگر در دسترس نیست.', fallbackBody: 'همهٔ پروژه‌ها و لینک‌ها از فهرست در دسترس‌اند.',
    level: 'سطح', citadel: 'دژ هادس', citadelSubtitle: 'قلب جهان زیرین', citadelDescription: 'قلمرو شخصی هادس سوم؛ از ساخت ابزار و جهان‌های تعاملی تا فیلم، یادداشت و هوش مصنوعی. در دهکده بگرد، منابع جمع کن و آن را گسترش بده.',
    portals: 'دروازه‌های این قلمرو', openAccess: 'همیشه باز', upgrade: 'ارتقا', maxLevel: 'بالاترین سطح', upgradeTo: 'ارتقا به سطح', nextLevel: 'مرحلهٔ بعد', upgradeBenefit: 'جزئیات تازه به ساختمان اضافه می‌شود.',
    forgeBenefit: 'تولید اخگر بیشتر می‌شود.', oracleBenefit: 'تولید روح بیشتر می‌شود.', citadelBenefit: 'تولید و گنجایش دهکده بیشتر می‌شود.',
    notEnough: 'منابع کافی نیست؛ منابع دهکده یا پاداش مأموریت‌ها را جمع کن.', upgraded: 'ساختمان ارتقا پیدا کرد.', built: 'ساختمان تازه آماده است!', collected: 'منابع جمع شدند', emptyBank: 'منابع در حال تولیدند؛ چند لحظهٔ دیگر دوباره جمع کن.',
    claimed: 'پاداش دریافت شد', claim: 'دریافت پاداش', received: 'دریافت‌شده', inProgress: 'در جریان', questIntro: 'دهکده را کشف کن، بساز و برای هر قدم پاداش بگیر.', allQuestsDone: 'همهٔ مأموریت‌ها کامل شد',
    buildIntro: 'یک زمین آزاد و یک ساختمان انتخاب کن. هر بنا تولید و گنجایش دهکده را بیشتر می‌کند.', plot: 'زمین', freePlot: 'زمین آزاد', occupied: 'ساخته‌شده', buildHere: 'اینجا بساز', noFreePlots: 'هر سه زمین ساخته شده‌اند. حالا بناهای اصلی را ارتقا بده.', choosePlot: 'انتخاب زمین', chooseBuilding: 'انتخاب ساختمان', builtDescription: 'این ساختمان به تولید منابع دهکده کمک می‌کند. اثرش از همین حالا فعال است.',
    linksIntro: 'همهٔ جهان‌هایی که می‌سازم، یک‌جا. برای رفتن به هیچ لینکی نیازی به بازی‌کردن نیست.', searchPlaceholder: 'جست‌وجوی پروژه، موضوع یا کانال…', all: 'همه', destinations: 'لینک', noResults: 'لینکی با این عبارت پیدا نشد.',
    helpTitle: 'راهنمای قلمرو', helpSubtitle: 'چند قدم تا یک دهکدهٔ زنده', helpExplore: 'روی ساختمان یا نام آن بزن تا لینک‌ها و امکان ارتقایش را ببینی.', helpCamera: 'با کشیدن تصویر بچرخ؛ با اسکرول یا دو انگشت زوم کن. کلیک راست دوربین را جابه‌جا می‌کند.', helpResources: 'آهنگری اخگر و رصدخانه روح تولید می‌کند. جمع‌آوری کن، بساز و ارتقا بده.', helpSave: 'پیشرفت در همین مرورگر ذخیره می‌شود. تولیدِ زمان غیبت تا ۴ ساعت و به اندازهٔ گنجایش انبار محاسبه می‌شود.', helpLinks: 'همهٔ لینک‌ها از ابتدا بازند؛ از «همهٔ لینک‌ها» هم می‌توانی مستقیم بروی.',
    reset: 'شروع دوبارهٔ دهکده', resetConfirm: 'منابع، ساختمان‌های ساخته‌شده و پیشرفت مأموریت‌ها در این مرورگر پاک شود؟', confirmReset: 'بله، از نو بساز', cancel: 'انصراف', resetDone: 'دهکده به آغاز برگشت.', share: 'کپی لینک قلمرو', copied: 'لینک قلمرو کپی شد.', copyFailed: 'لینک قلمرو را از نوار آدرس مرورگر کپی کن.', close: 'بستن', day: 'نور روز', dusk: 'نور غروب', enableSound: 'فعال‌سازی صدا', disableSound: 'خاموش‌کردن صدا', soundUnavailable: 'صدا در این مرورگر در دسترس نیست.', zoomIn: 'بزرگ‌نمایی', zoomOut: 'کوچک‌نمایی', resetCamera: 'بازگشت دوربین', perMinute: 'در دقیقه', storage: 'گنجایش انبار', available: 'آمادهٔ جمع‌آوری', discovered: 'قلمرو تازه کشف شد', localSave: 'پیشرفت در این مرورگر ذخیره می‌شود.', openMain: 'ورود به سایت هادس', brandHub: 'جهان برند هادس', brandLibrary: 'کتابخانهٔ برند و دارایی‌ها', choose: 'انتخاب', backVillage: 'بازگشت به دهکده',
    Code: 'کد', Archive: 'آرشیو', GitHub: 'گیت‌هاب', Read: 'خواندن', Explore: 'کشف', Channel: 'کانال', Watch: 'تماشا', Social: 'شبکه', Site: 'سایت', Contact: 'ارتباط',
  },
  en: {
    embers: 'EMBERS', souls: 'SOULS', chapter: 'THE UNDERWORLD / CHAPTER I', welcomeTitle: 'One world.\nA thousand stories.',
    welcomeBody: 'Welcome to my corner of the underworld. Every building opens a door to something I make.', explored: 'Realms discovered', startExplore: 'Begin exploring', currentQuest: 'YOUR NEXT QUEST',
    worldName: 'The land of beginnings', worldSeason: 'HOME OF HADES III', villageLevel: 'VILLAGE LEVEL', villageName: 'Hades Realm', sceneHint: 'Drag to orbit · Scroll to zoom · Select a building', world: 'Village', build: 'Build', quests: 'Quests', allLinks: 'All links', collect: 'Collect',
    fallbackTitle: 'The 3D view is unavailable in this browser.', fallbackBody: 'Every project and destination is still available in All links.',
    level: 'Level', citadel: 'The Citadel', citadelSubtitle: 'Heart of the underworld', citadelDescription: 'The personal universe of Hades III. Tools, interactive worlds, films, notes, and artificial intelligence. Explore the village, gather resources, and make it grow.',
    portals: 'PORTALS IN THIS REALM', openAccess: 'Always open', upgrade: 'Upgrade', maxLevel: 'Maximum level', upgradeTo: 'Upgrade to level', nextLevel: 'NEXT LEVEL', upgradeBenefit: 'New architectural details appear.', forgeBenefit: 'Increases ember production.', oracleBenefit: 'Increases soul production.', citadelBenefit: 'Increases production and storage.',
    notEnough: 'You need more resources. Collect from your village or claim quest rewards.', upgraded: 'Building upgraded.', built: 'Your new building is ready!', collected: 'Resources collected', emptyBank: 'Your village is producing. Collect again in a few moments.', claimed: 'Reward claimed', claim: 'Claim reward', received: 'Claimed', inProgress: 'In progress', questIntro: 'Explore your realm and build your village. Every step brings a reward.', allQuestsDone: 'Every quest completed',
    buildIntro: 'Choose a free plot and a building. Every addition helps your village produce and store more resources.', plot: 'Plot', freePlot: 'Free plot', occupied: 'Built', buildHere: 'Build here', noFreePlots: 'All three plots are built. Keep growing by upgrading your landmarks.', choosePlot: 'CHOOSE A PLOT', chooseBuilding: 'CHOOSE A BUILDING', builtDescription: 'This building contributes to your village production. Its effect is already active.',
    linksIntro: 'All the worlds I build, in one place. Every destination is open from the start.', searchPlaceholder: 'Find a project, topic, or channel…', all: 'All', destinations: 'links', noResults: 'No destinations match your search.',
    helpTitle: 'A guide to the realm', helpSubtitle: 'A few steps to a living village', helpExplore: 'Select a building or its label to explore its links and upgrades.', helpCamera: 'Drag to orbit. Scroll or pinch to zoom. Right-drag to pan the camera.', helpResources: 'The Forge produces embers; the Oracle produces souls. Collect, build, and upgrade.', helpSave: 'Progress is saved in this browser. Offline production is limited to four hours and your storage capacity.', helpLinks: 'Every link is open from the start. All links gives you direct access.',
    reset: 'Start a new village', resetConfirm: 'Reset resources, new buildings, and quest progress in this browser?', confirmReset: 'Yes, start again', cancel: 'Cancel', resetDone: 'Your village has a fresh start.', share: 'Copy realm link', copied: 'Realm link copied.', copyFailed: 'Copy the realm link from your browser’s address bar.', close: 'Close', day: 'Daylight', dusk: 'Dusk', enableSound: 'Enable sound', disableSound: 'Mute sound', soundUnavailable: 'Audio is unavailable in this browser.', zoomIn: 'Zoom in', zoomOut: 'Zoom out', resetCamera: 'Reset camera', perMinute: '/ min', storage: 'Storage capacity', available: 'Ready to collect', discovered: 'A new realm discovered', localSave: 'Progress is saved in this browser.', openMain: 'Visit the main website', brandHub: 'The Hades brand world', brandLibrary: 'Brand & asset library', choose: 'Select', backVillage: 'Back to village',
    Code: 'Code', Archive: 'Archive', GitHub: 'GitHub', Read: 'Read', Explore: 'Explore', Channel: 'Channel', Watch: 'Watch', Social: 'Social', Site: 'Site', Contact: 'Contact',
  },
};
const t = (key) => text[lang][key] || key;
const n = (value) => Number(value).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US', { maximumFractionDigits: 0 });
const realms = structuredClone(realmData);
const realmById = new Map(realms.map((realm) => [realm.id, realm]));
const title = (realm) => lang === 'fa' ? realm.fa : realm.n;
const plotName = (id) => `${t('plot')} ${n(PLOT_IDS.indexOf(id) + 1)}`;
const resourceMarkup = (cost) => `<span class="cost"><span class="embers">${icon('ember')}<span>${n(cost.embers)}</span></span><span class="souls">${icon('soul')}<span>${n(cost.souls)}</span></span></span>`;
const canPay = (cost) => cost && state.embers >= cost.embers && state.souls >= cost.souls;

// Metadata belongs to persistence, not the v2 game schema. Action revisions
// outrank clock-only saves, so a sleeping tab cannot undo a build or a reset.
function readSaveMetadata(saved) {
  const metadata = saved?._sync;
  const integer = (value) => Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER ? value : 0;
  return {
    revision: integer(metadata?.revision),
    actionRevision: integer(metadata?.actionRevision),
    id: typeof metadata?.id === 'string' ? metadata.id.slice(0, 160) : '',
  };
}

function compareSaveMetadata(a, b) {
  return a.actionRevision - b.actionRevision || a.revision - b.revision || (a.id > b.id ? 1 : a.id < b.id ? -1 : 0);
}

function gameplayKey(value) {
  return JSON.stringify([value.embers, value.souls, value.levels, value.plots, value.visited, value.claimedQuests, value.stats]);
}

function adoptLatestSave() {
  const latest = storage.read(SAVE_KEY);
  if (!latest || latest.version !== state.version) return { changed: false, stale: false };
  const metadata = readSaveMetadata(latest);
  const order = compareSaveMetadata(metadata, saveMetadata);
  if (order <= 0) return { changed: false, stale: order < 0 };
  const before = gameplayKey(state);
  // Recreate from the saved bank and its timestamp; never add another tab's
  // production to this tab's already accrued bank.
  state = createGame(latest, Date.now());
  saveMetadata = metadata;
  return { changed: before !== gameplayKey(state), stale: false };
}

function refreshGameViews() {
  syncScene();
  updateHUD();
  // Links and help do not depend on game state. Preserve search focus/query.
  if (['building', 'plot', 'build', 'quests'].includes(panelMode)) renderPanel();
}

function writeSave(action) {
  saveMetadata = {
    revision: Math.max(saveMetadata.revision + 1, Date.now()),
    actionRevision: saveMetadata.actionRevision + (action ? 1 : 0),
    id: `${writerId}:${++saveSequence}`,
  };
  const saved = storage.write(SAVE_KEY, { ...snapshot(state), _sync: saveMetadata });
  if (!saved && !saveWarningShown) {
    saveWarningShown = true;
    setTimeout(() => toast(lang === 'fa' ? 'ذخیره‌سازی مرورگر در دسترس نیست؛ پیشرفت فقط تا بستن این صفحه می‌ماند.' : 'Browser storage is unavailable. This village will last only while the page stays open.', 'error'), 1600);
  }
  return saved;
}

function transact(mutate = null) {
  const work = () => {
    let changed = false;
    // Web Locks serialize the complete read/mutate/write on supported browsers.
    // Rechecking also handles a racing writer in the localStorage-only fallback.
    for (let attempt = 0; attempt < 3; attempt++) {
      changed = adoptLatestSave().changed || changed;
      tick(state, Date.now());
      const result = mutate ? mutate(state) : { ok: true };
      const latest = storage.read(SAVE_KEY);
      if (latest?.version === state.version && compareSaveMetadata(readSaveMetadata(latest), saveMetadata) > 0) continue;
      if (!mutate || result.ok) writeSave(Boolean(mutate));
      if (!mutate && changed) refreshGameViews();
      return result;
    }
    adoptLatestSave();
    refreshGameViews();
    return { ok: false, reason: 'sync-conflict' };
  };
  const run = async () => {
    if (!navigator.locks?.request) return work();
    let entered = false;
    try {
      return await navigator.locks.request(SAVE_KEY, () => { entered = true; return work(); });
    } catch (error) {
      if (entered) throw error;
      return work(); // Storage-restricted browsers can still play in memory.
    }
  };
  const pending = saveQueue.then(run);
  saveQueue = pending.catch(() => {});
  return pending;
}

const save = () => transact();
const savePreferences = () => storage.write(PREF_KEY, { lang, theme });
save(); // Persist initial offline accrual through the same cross-tab transaction.

function toast(message, type = 'success') {
  clearTimeout(toastTimer);
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast ${type}`;
  el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

function chime(kind = 'select') {
  if (!sound || !audioContext) return;
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  const notes = kind === 'reward' ? [392, 523.25, 659.25] : kind === 'build' ? [261.63, 392, 523.25] : [440];
  const now = audioContext.currentTime;
  for (let i = 0; i < notes.length; i++) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = notes[i];
    gain.gain.setValueAtTime(0, now + i * 0.075);
    gain.gain.linearRampToValueAtTime(0.055, now + i * 0.075 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.075 + 0.24);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now + i * 0.075);
    oscillator.stop(now + i * 0.075 + 0.25);
  }
}

function syncScene() {
  scene?.setLevels(state.levels);
  scene?.setBuilt(Object.fromEntries(PLOT_IDS.filter((id) => state.plots[id]).map((id) => [id, { type: state.plots[id], level: 1 }])));
}

function updateHUD() {
  const rates = production(state);
  $('#wallet-embers').textContent = n(state.embers);
  $('#wallet-souls').textContent = n(state.souls);
  $('#ember-rate').textContent = `+${n(rates.embersPerMinute)} ${t('perMinute')}`;
  $('#soul-rate').textContent = `+${n(rates.soulsPerMinute)} ${t('perMinute')}`;
  $('#explored-count').textContent = `${n(state.visited.length)} / ${n(6)}`;
  $('#exploration-track').innerHTML = realms.map((r) => `<span class="${state.visited.includes(r.id) ? 'done' : ''}"></span>`).join('');
  $('#collect-amount').textContent = `+${n(Math.floor(state.storedEmbers))} / +${n(Math.floor(state.storedSouls))}`;
  $('#collect').setAttribute('aria-label', `${t('collect')}: ${n(Math.floor(state.storedEmbers))} ${t('embers')}، ${n(Math.floor(state.storedSouls))} ${t('souls')}`);
  $('#collect').title = `${t('storage')}: ${n(rates.emberCapacity)} / ${n(rates.soulCapacity)}`;
  const availablePlots = PLOT_IDS.filter((id) => !state.plots[id]).length;
  $('#build-badge').textContent = n(availablePlots);
  $('#build-badge').hidden = availablePlots === 0;
  $('#village-level').textContent = n(state.levels.citadel);
  const quests = getQuests(state);
  const ready = quests.filter((q) => q.complete && !q.claimed).length;
  $('#quest-badge').hidden = ready === 0;
  $('#quest-badge').textContent = n(ready);
  const current = quests.find((q) => q.complete && !q.claimed) || quests.find((q) => !q.claimed);
  $('#quest-peek-title').textContent = current ? current.title[lang] : t('allQuestsDone');
  $('#quest-peek-count').textContent = current ? `${n(current.progress)}/${n(current.target)}` : '✓';
  for (const [id, element] of labelElements) {
    element.classList.toggle('selected', id === selected);
    element.classList.toggle('visited', state.visited.includes(id));
    const plot = PLOT_IDS.includes(id);
    const built = plot && state.plots[id];
    const name = plot ? built ? BUILD_TYPES[built].title[lang] : t('freePlot') : id === 'citadel' ? t('citadel') : title(realmById.get(id));
    const iconName = plot ? built || 'plus' : id;
    const content = `${icon(iconName)}<span class="label-name" dir="auto">${escape(name)}</span>${plot ? '' : `<small>${n(state.levels[id])}</small>`}`;
    if (element.innerHTML !== content) element.innerHTML = content;
    element.classList.toggle('plot-label', plot && !built);
    element.setAttribute('aria-label', plot ? `${name} — ${plotName(id)}` : `${name} — ${t('level')} ${n(state.levels[id])}`);
  }
}

function heading(titleText, subtitle, symbol, eyebrow = '') {
  return `${eyebrow ? `<div class="panel-eyebrow">${escape(eyebrow)}</div>` : ''}<div class="panel-heading"><span class="building-crest">${icon(symbol)}</span><div><h2 id="panel-title">${escape(titleText)}</h2><p class="panel-subtitle">${escape(subtitle)}</p></div></div>`;
}

function portal(link) {
  let url;
  try { url = new URL(link.url); } catch { return ''; }
  if (url.protocol !== 'https:') return '';
  return `<a class="portal" href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">${icon('links')}<span class="portal-label" dir="auto">${escape(lang === 'fa' ? link.fa : link.name)}</span><span class="portal-kind">${escape(t(link.kind))}</span></a>`;
}

function renderBuilding() {
  const id = selected;
  if (!CORE_IDS.includes(id)) return;
  const realm = realmById.get(id);
  const level = buildingLevel(state, id);
  const cost = upgradeCost(state, id);
  const benefit = t(id === 'forge' ? 'forgeBenefit' : id === 'oracle' ? 'oracleBenefit' : id === 'citadel' ? 'citadelBenefit' : 'upgradeBenefit');
  const links = realm?.links || [{ name: 'Visit the main website', fa: 'ورود به سایت هادس', url: 'https://ialirezaaa.github.io/', kind: 'Site' }];
  $('#panel-body').innerHTML = heading(realm ? title(realm) : t('citadel'), realm ? lang === 'fa' ? realm.fs : realm.s : t('citadelSubtitle'), id, `${t('level')} ${n(level)} / ${n(3)}`)
    + `<div class="level-pips" aria-hidden="true">${[1, 2, 3].map((i) => `<span class="${i <= level ? 'active' : ''}"></span>`).join('')}</div><p class="panel-description">${escape(realm ? lang === 'fa' ? realm.fd : realm.d : t('citadelDescription'))}</p>`
    + `<div class="upgrade-card"><div class="upgrade-top"><strong>${escape(cost ? `${t('upgradeTo')} ${n(level + 1)}` : t('maxLevel'))}</strong>${cost ? resourceMarkup(cost) : icon('trophy')}</div><p class="panel-small" style="margin:0 0 11px">${escape(benefit)}</p>${cost ? `<button class="primary-button" type="button" data-action="upgrade" ${canPay(cost) ? '' : 'disabled'}>${icon('plus')}${escape(t('upgrade'))}</button>${!canPay(cost) ? `<p class="panel-small">${escape(t('notEnough'))}</p>` : ''}` : ''}</div>`
    + (id === 'citadel' ? villageStats() : '')
    + `<h3 class="portal-title">${escape(t('portals'))}<span>${escape(t('openAccess'))}</span></h3><div class="portal-list">${links.map(portal).join('')}</div>`;
}

function villageStats() {
  const rate = production(state);
  return `<div class="panel-stats"><div class="stat"><strong>${n(rate.embersPerMinute)}</strong><span>${escape(t('embers'))} ${escape(t('perMinute'))}</span></div><div class="stat"><strong>${n(rate.soulsPerMinute)}</strong><span>${escape(t('souls'))} ${escape(t('perMinute'))}</span></div><div class="stat"><strong>${n(rate.emberCapacity)}</strong><span>${escape(t('storage'))} · ${escape(t('embers'))}</span></div><div class="stat"><strong>${n(rate.soulCapacity)}</strong><span>${escape(t('storage'))} · ${escape(t('souls'))}</span></div></div>`;
}

function renderBuild() {
  const free = PLOT_IDS.filter((id) => !state.plots[id]);
  if (state.plots[selectedPlot] && free.length) {
    selectedPlot = free[0];
    selected = selectedPlot;
    scene?.select(selected);
    updateHUD();
  }
  const cost = buildCost(selectedType);
  $('#panel-body').innerHTML = heading(t('build'), t('chooseBuilding'), 'build', 'HADES REALM')
    + `<p class="panel-description">${escape(free.length ? t('buildIntro') : t('noFreePlots'))}</p>`
    + (free.length ? `<div class="portal-title">${escape(t('choosePlot'))}</div><div class="plot-selector">${PLOT_IDS.map((id) => `<button type="button" data-plot="${id}" class="${id === selectedPlot ? 'selected-outline' : ''}" aria-pressed="${id === selectedPlot}" ${state.plots[id] ? 'disabled' : ''}>${escape(plotName(id))}${state.plots[id] ? ' ✓' : ''}</button>`).join('')}</div><div class="build-cards">${Object.entries(BUILD_TYPES).map(([type, data]) => `<button type="button" data-build-type="${type}" aria-pressed="${type === selectedType}" class="build-card ${type === selectedType ? 'selected-outline' : ''}"><span>${icon(type)}</span><span><strong>${escape(data.title[lang])}</strong><small>${escape(data.description[lang])}</small>${resourceMarkup(data.cost)}</span></button>`).join('')}</div><div class="build-action"><button type="button" class="primary-button" data-action="build" ${canPay(cost) ? '' : 'disabled'}>${icon('build')}${escape(t('buildHere'))} · ${escape(plotName(selectedPlot))}</button>${!canPay(cost) ? `<p class="panel-small">${escape(t('notEnough'))}</p>` : ''}</div>` : `<div class="build-cards">${PLOT_IDS.map((id) => `<button class="build-card" type="button" data-select="${id}"><span>${icon(state.plots[id])}</span><span><strong>${escape(BUILD_TYPES[state.plots[id]].title[lang])}</strong><small>${escape(plotName(id))} · ${escape(t('occupied'))}</small></span></button>`).join('')}</div>`);
}

function renderPlot() {
  const type = state.plots[selected];
  if (!type) { renderBuild(); return; }
  const data = BUILD_TYPES[type];
  $('#panel-body').innerHTML = heading(data.title[lang], plotName(selected), type, t('occupied'))
    + `<p class="panel-description">${escape(t('builtDescription'))}</p><div class="build-benefit">${escape(data.description[lang])}</div>${villageStats()}<button class="secondary-button" type="button" data-action="show-build">${escape(t('build'))}</button>`;
}

function renderQuests() {
  $('#panel-body').innerHTML = heading(t('quests'), 'HADES REALM', 'quests')
    + `<p class="panel-description">${escape(t('questIntro'))}</p><div class="quest-list">${getQuests(state).map((q) => `<article class="quest-card ${q.claimed ? 'claimed' : q.complete ? 'ready' : ''}"><div class="quest-card-heading"><h3>${escape(q.title[lang])}</h3><span>${n(q.progress)}/${n(q.target)}</span></div><p>${escape(q.description[lang])}</p><div class="quest-progress" aria-label="${n(q.progress)} / ${n(q.target)}"><span style="width:${q.progress / q.target * 100}%"></span></div><div class="quest-reward">${resourceMarkup(q.reward)}${q.claimed ? `<span class="quest-completion">${icon('check')} ${escape(t('received'))}</span>` : `<button type="button" class="claim-button" data-quest="${q.id}" ${q.complete ? '' : 'disabled'}>${escape(t(q.complete ? 'claim' : 'inProgress'))}</button>`}</div></article>`).join('')}</div>`;
}

function renderDirectory() {
  $('#panel-body').innerHTML = heading(t('allLinks'), 'THE PORTALS OF HADES III', 'links')
    + `<p class="panel-description">${escape(t('linksIntro'))}</p><div class="search-box">${icon('search')}<input id="link-search" type="search" value="${escape(directoryQuery)}" placeholder="${escape(t('searchPlaceholder'))}" aria-label="${escape(t('searchPlaceholder'))}" autocomplete="off"></div><div class="filter-chips">${[{ id: 'all', name: t('all') }, ...realms.map((r) => ({ id: r.id, name: title(r) }))].map((item) => `<button type="button" class="filter-chip ${directoryFilter === item.id ? 'is-active' : ''}" data-filter="${item.id}" aria-pressed="${directoryFilter === item.id}">${escape(item.name)}</button>`).join('')}</div><p id="directory-count" class="directory-count" role="status"></p><div id="directory-results" class="directory-groups"></div>`;
  renderDirectoryResults();
}

function renderDirectoryResults() {
  const query = directoryQuery.trim().toLocaleLowerCase();
  let count = 0;
  const groups = realms.filter((r) => directoryFilter === 'all' || directoryFilter === r.id).map((realm) => {
    const links = realm.links.filter((l) => `${l.name} ${l.fa} ${l.url} ${realm.n} ${realm.fa}`.toLocaleLowerCase().includes(query));
    count += links.length;
    return links.length ? `<section class="directory-group"><h3>${icon(realm.id)}${escape(title(realm))}</h3>${links.map(portal).join('')}</section>` : '';
  }).join('');
  $('#directory-count').textContent = `${n(count)} ${t('destinations')}`;
  $('#directory-results').innerHTML = groups || `<p class="empty-message">${escape(t('noResults'))}</p>`;
}

function renderHelp() {
  $('#panel-body').innerHTML = heading(t('helpTitle'), t('helpSubtitle'), 'compass')
    + `<ul class="help-list">${[['citadel', 'helpExplore'], ['compass', 'helpCamera'], ['ember', 'helpResources'], ['links', 'helpLinks'], ['check', 'helpSave']].map(([symbol, key]) => `<li>${icon(symbol)}<span>${escape(t(key))}</span></li>`).join('')}</ul><div class="keyboard-hints">${[['1–6', 'world'], ['B', 'build'], ['Q', 'quests'], ['L', 'allLinks'], ['C', 'collect'], ['Esc', 'close']].map(([key, name]) => `<span><kbd>${key}</kbd>${escape(t(name))}</span>`).join('')}</div><button class="secondary-button" type="button" data-action="share">${icon('copy')} ${escape(t('share'))}</button><button class="secondary-button danger-button" type="button" data-action="reset-prompt">${escape(t('reset'))}</button>${resetPending ? `<div class="reset-confirm"><span>${escape(t('resetConfirm'))}</span><div><button class="quiet-button danger-button" type="button" data-action="reset-confirm">${escape(t('confirmReset'))}</button><button class="quiet-button" type="button" data-action="reset-cancel">${escape(t('cancel'))}</button></div></div>` : ''}`;
}

function renderPanel() {
  if (!panelMode) return;
  const scroll = $('#detail-panel').scrollTop;
  if (panelMode === 'building') renderBuilding();
  if (panelMode === 'plot') renderPlot();
  if (panelMode === 'build') renderBuild();
  if (panelMode === 'quests') renderQuests();
  if (panelMode === 'links') renderDirectory();
  if (panelMode === 'help') renderHelp();
  $('#detail-panel').scrollTop = scroll;
}

function setNavigation(mode) {
  const nav = ['build', 'quests', 'links'].includes(mode) ? mode : 'world';
  for (const button of $$('.dock-button')) {
    button.classList.toggle('is-active', button.dataset.section === nav);
    button.setAttribute('aria-pressed', String(button.dataset.section === nav));
  }
}

function openPanel(mode, focus = true) {
  selectionRequest++;
  if (!panelMode) lastFocus = document.activeElement;
  const changed = panelMode !== mode;
  panelMode = mode;
  $('#app').classList.add('panel-open');
  $('#intro-card').inert = true;
  $('#detail-panel').hidden = false;
  $('#detail-panel').classList.toggle('wide', mode === 'links');
  setNavigation(mode);
  renderPanel();
  if (changed) $('#detail-panel').scrollTop = 0;
  if (focus) $('#detail-panel').focus({ preventScroll: true });
}

function closePanel() {
  selectionRequest++;
  panelMode = null;
  resetPending = false;
  selected = null;
  scene?.select(null);
  $('#app').classList.remove('panel-open');
  $('#intro-card').inert = false;
  $('#detail-panel').hidden = true;
  setNavigation('world');
  updateHUD();
  if (lastFocus instanceof HTMLElement && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
}

async function selectBuilding(id) {
  if (!CORE_IDS.includes(id) && !PLOT_IDS.includes(id)) return;
  const request = ++selectionRequest;
  const result = CORE_IDS.includes(id) ? await transact((current) => visit(current, id)) : await save();
  if (request !== selectionRequest) { refreshGameViews(); return; }
  selected = id;
  scene?.select(id);
  chime();
  if (PLOT_IDS.includes(id)) {
    selectedPlot = id;
    openPanel(state.plots[id] ? 'plot' : 'build');
  } else {
    if (result.discovered) toast(`${t('discovered')} · ${title(realmById.get(id))}`);
    openPanel('building');
  }
  refreshGameViews();
}

function finishAction(result, message, kind = 'reward') {
  refreshGameViews();
  if (!result.ok) {
    const message = result.reason === 'sync-conflict'
      ? lang === 'fa' ? 'دهکده در صفحهٔ دیگری تغییر کرد؛ دوباره تلاش کن.' : 'Your village changed in another tab. Please try again.'
      : t(result.reason === 'insufficient-resources' ? 'notEnough' : result.reason === 'nothing-to-collect' ? 'emptyBank' : 'inProgress');
    toast(message, 'error');
    return;
  }
  chime(kind);
  const reward = result.reward ? ` · +${n(result.reward.embers)} / +${n(result.reward.souls)}` : '';
  toast(`${message}${reward}`);
}

async function collectResources() {
  finishAction(await transact((current) => collect(current)), t('collected'));
}

function applyLanguage() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  $('.skip-link').textContent = lang === 'fa' ? 'رفتن به فهرست لینک‌ها' : 'Skip to all links';
  document.title = lang === 'fa' ? 'Hades Realm · جهان سه‌بعدی هادس' : 'Hades Realm · A world of your own';
  for (const element of $$('[data-i]')) {
    const value = t(element.dataset.i);
    if (element.dataset.i === 'welcomeTitle') element.innerHTML = value.split('\n').map(escape).join('<br>');
    else element.textContent = value;
  }
  $('#language').textContent = lang === 'fa' ? 'EN' : 'فا';
  $('#language').setAttribute('aria-label', lang === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی');
  const labels = { '#close-panel': 'close', '#help': 'helpTitle', '#zoom-in': 'zoomIn', '#zoom-out': 'zoomOut', '#reset-camera': 'resetCamera' };
  for (const [selector, key] of Object.entries(labels)) { $(selector).title = t(key); $(selector).setAttribute('aria-label', t(key)); }
  $('#theme-toggle').innerHTML = icon(theme === 'dusk' ? 'sun' : 'moon');
  $('#theme-toggle').title = t(theme === 'dusk' ? 'day' : 'dusk');
  $('#theme-toggle').setAttribute('aria-label', $('#theme-toggle').title);
  $('#sound-toggle').innerHTML = icon(sound ? 'sound' : 'mute');
  $('#sound-toggle').setAttribute('aria-label', t(sound ? 'disableSound' : 'enableSound'));
  $('#sound-toggle').title = t(sound ? 'disableSound' : 'enableSound');
  $('#sound-toggle').setAttribute('aria-pressed', String(sound));
  $('#world-canvas').setAttribute('aria-label', lang === 'fa' ? 'دهکدهٔ سه‌بعدی هادس؛ از دکمه‌های روی ساختمان‌ها برای انتخاب استفاده کن.' : 'Hades 3D village. Use building label buttons to select a landmark.');
  updateHUD();
  renderPanel();
}

for (const [selector, name] of Object.entries({ '#ember-icon': 'ember', '#soul-icon': 'soul', '#explore-icon': 'chevron', '#quest-peek-icon': 'quests', '#help': 'help', '#close-panel': 'close', '#zoom-in': 'plus', '#zoom-out': 'minus', '#reset-camera': 'home', '#collect-icon': 'ember' })) $(selector).innerHTML = icon(name);
for (const [name, symbol] of Object.entries({ world: 'compass', build: 'build', quests: 'quests', links: 'links' })) $(`#nav-${name} .dock-icon`).innerHTML = icon(symbol);
for (const id of [...CORE_IDS, ...PLOT_IDS]) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'landmark-label';
  button.dataset.landmark = id;
  button.hidden = true;
  button.addEventListener('click', () => selectBuilding(id));
  $('#landmark-labels').append(button);
  labelElements.set(id, button);
}

$('#close-panel').addEventListener('click', closePanel);
$('#start-explore').addEventListener('click', () => selectBuilding(realms.find((r) => !state.visited.includes(r.id))?.id || 'citadel'));
$('#quest-peek').addEventListener('click', () => openPanel('quests'));
$('#collect').addEventListener('click', collectResources);
$('#help').addEventListener('click', () => openPanel('help'));
$('#language').addEventListener('click', () => { lang = lang === 'fa' ? 'en' : 'fa'; savePreferences(); applyLanguage(); });
$('#theme-toggle').addEventListener('click', () => { theme = theme === 'dusk' ? 'day' : 'dusk'; scene?.setTheme(theme); savePreferences(); applyLanguage(); });
$('#sound-toggle').addEventListener('click', async () => {
  try {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();
    sound = !sound;
    chime('reward');
  } catch { sound = false; toast(t('soundUnavailable'), 'error'); }
  applyLanguage();
});
$('#zoom-in').addEventListener('click', () => scene?.zoom(1));
$('#zoom-out').addEventListener('click', () => scene?.zoom(-1));
$('#reset-camera').addEventListener('click', () => scene?.resetCamera());
for (const button of $$('.dock-button')) button.addEventListener('click', () => {
  const mode = button.dataset.section;
  if (mode === 'world') { closePanel(); return; }
  if (mode === 'build') {
    selectedPlot = PLOT_IDS.find((id) => !state.plots[id]) || PLOT_IDS[0];
    selected = state.plots[selectedPlot] ? null : selectedPlot;
    scene?.select(selected);
  }
  openPanel(mode);
  updateHUD();
});

$('#panel-body').addEventListener('input', (event) => {
  if (event.target.id === 'link-search') { directoryQuery = event.target.value; renderDirectoryResults(); }
});

$('#panel-body').addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  tick(state, Date.now());
  if (button.dataset.plot) {
    selectedPlot = button.dataset.plot;
    selected = selectedPlot;
    scene?.select(selected);
    renderBuild(); updateHUD(); return;
  }
  if (button.dataset.buildType) { selectedType = button.dataset.buildType; renderBuild(); return; }
  if (button.dataset.select) { selectBuilding(button.dataset.select); return; }
  if (button.dataset.quest) {
    const questId = button.dataset.quest;
    finishAction(await transact((current) => claimQuest(current, questId)), t('claimed')); return;
  }
  if (button.dataset.filter) {
    directoryFilter = button.dataset.filter;
    for (const chip of $$('.filter-chip')) { chip.classList.toggle('is-active', chip.dataset.filter === directoryFilter); chip.setAttribute('aria-pressed', String(chip.dataset.filter === directoryFilter)); }
    renderDirectoryResults(); return;
  }
  switch (button.dataset.action) {
    case 'upgrade': {
      const id = selected;
      finishAction(await transact((current) => upgrade(current, id)), t('upgraded'), 'build'); break;
    }
    case 'build': {
      const plotId = selectedPlot, type = selectedType, request = selectionRequest;
      const result = await transact((current) => build(current, plotId, type));
      if (result.ok && request === selectionRequest) { selectedPlot = plotId; selected = plotId; panelMode = 'plot'; scene?.select(selected); }
      finishAction(result, t('built'), 'build');
      break;
    }
    case 'show-build': openPanel('build'); break;
    case 'reset-prompt': resetPending = true; renderHelp(); break;
    case 'reset-cancel': resetPending = false; renderHelp(); break;
    case 'reset-confirm': {
      const result = await transact(() => { state = resetGame(Date.now()); return { ok: true }; });
      if (result.ok) { syncScene(); closePanel(); toast(t('resetDone')); }
      else finishAction(result, t('resetDone'));
      break;
    }
    case 'share':
      try { await navigator.clipboard.writeText('https://ialirezaaa.github.io/HadesRealm/'); toast(t('copied')); }
      catch { toast(t('copyFailed'), 'error'); }
      break;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && panelMode) { event.preventDefault(); closePanel(); return; }
  if (event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
  const key = event.key.toLowerCase();
  if (/^[1-6]$/.test(key)) { selectBuilding(realms[Number(key) - 1].id); return; }
  if (key === 'b') $('#nav-build').click();
  if (key === 'q') openPanel('quests');
  if (key === 'l') openPanel('links');
  if (key === 'c') collectResources();
  if (key === 'r') scene?.resetCamera();
});

function hideLoading() {
  $('#loading').classList.add('leaving');
  setTimeout(() => { $('#loading').hidden = true; }, 550);
}

function sceneError(error) {
  if (sceneFailed) return;
  sceneFailed = true;
  console.warn('Hades Realm: the 3D scene is unavailable.', error);
  $('#app').classList.add('scene-failed');
  $('#webgl-notice').hidden = false;
  hideLoading();
  openPanel('links', false);
}

$('#loading-links').addEventListener('click', () => { hideLoading(); openPanel('links'); });
applyLanguage();

import('./scene.js').then(({ createRealmScene }) => {
  scene = createRealmScene({
    canvas: $('#world-canvas'),
    onSelect: selectBuilding,
    onHover: (id) => { $('#world-canvas').style.cursor = id ? 'pointer' : 'grab'; },
    onReady: hideLoading,
    onError: sceneError,
    onLabels: (labels) => {
      for (const label of labels) {
        const el = labelElements.get(label.id);
        if (!el) continue;
        el.hidden = !label.visible;
        if (label.visible) el.style.transform = `translate(${label.x}px, ${label.y}px) translate(-50%, -100%)`;
      }
    },
  });
  syncScene();
  scene.setTheme(theme);
  if (selected) scene.select(selected);
}).catch(sceneError);

setInterval(() => {
  tick(state, Date.now());
  updateHUD();
  if (++saveCounter >= 10) { save(); saveCounter = 0; }
}, 1000);
window.addEventListener('storage', (event) => {
  if (event.key !== SAVE_KEY) return;
  // Read current storage instead of event.newValue: queued events can be old.
  const { changed, stale } = adoptLatestSave();
  if (changed) refreshGameViews();
  else updateHUD();
  if (stale) save(); // Repair a late clock-only save without reviving old actions.
});
document.addEventListener('visibilitychange', () => {
  save();
  scene?.setPaused(document.hidden);
  if (!document.hidden) updateHUD();
});
window.addEventListener('pagehide', () => { save(); });
