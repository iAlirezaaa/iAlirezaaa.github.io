/**
 * Hades Realm's small, browser-local village simulation.
 *
 * This module has no DOM, network, timers, storage or randomness. Call
 * createGame(saved, Date.now()), tick(state, Date.now()) before an action, then
 * persist JSON.stringify(snapshot(state)). Persist the initial createGame result
 * too: its lastTick already consumes the offline period. Actions mutate state
 * and return { ok, reason?, ... }; portfolio access never depends on this state.
 *
 * Currency is whole units in the wallet. Production is fractional in storage;
 * collect transfers only whole units and retains the fraction for the next tick.
 */

export const GAME_VERSION = 2;
export const CORE_IDS = Object.freeze([
  'citadel', 'forge', 'archive', 'oracle', 'theatre', 'elysium', 'gates',
]);
export const REALM_IDS = Object.freeze(CORE_IDS.filter((id) => id !== 'citadel'));
export const PLOT_IDS = Object.freeze(['plot-a', 'plot-b', 'plot-c']);
export const MAX_LEVEL = 3;
export const MAX_OFFLINE_MS = 4 * 60 * 60 * 1000;
export const WALLET_CAP = 999_999;

export const BUILD_TYPES = Object.freeze({
  lantern: Object.freeze({
    title: { en: 'Wisp lantern', fa: 'فانوس ارواح' },
    description: { en: '+7 embers / min · +70 ember storage', fa: '۷ اخگر در دقیقه و ۷۰ جای بیشتر برای اخگر' },
    cost: Object.freeze({ embers: 90, souls: 20 }),
  }),
  garden: Object.freeze({
    title: { en: 'Soul garden', fa: 'باغ ارواح' },
    description: { en: '+4 souls / min · +35 soul storage', fa: '۴ روح در دقیقه و ۳۵ جای بیشتر برای روح' },
    cost: Object.freeze({ embers: 80, souls: 35 }),
  }),
  watchtower: Object.freeze({
    title: { en: 'Watchtower', fa: 'برج نگهبانی' },
    description: { en: '+3 embers & +1 soul / min · more storage', fa: '۳ اخگر و ۱ روح در دقیقه، همراه با افزایش گنجایش' },
    cost: Object.freeze({ embers: 130, souls: 40 }),
  }),
});

const BASE_UPGRADE_COSTS = Object.freeze({
  citadel: { embers: 120, souls: 50 },
  forge: { embers: 90, souls: 25 },
  archive: { embers: 80, souls: 20 },
  oracle: { embers: 85, souls: 35 },
  theatre: { embers: 85, souls: 30 },
  elysium: { embers: 95, souls: 30 },
  gates: { embers: 90, souls: 35 },
});

const QUESTS = Object.freeze([
  {
    id: 'first-portal',
    title: { en: 'A world beyond', fa: 'جهانی فراتر' },
    description: { en: 'Explore your first realm.', fa: 'نخستین قلمرو را کشف کن.' },
    target: 1, reward: { embers: 50, souls: 15 },
    progress: (state) => state.visited.length,
  },
  {
    id: 'first-harvest',
    title: { en: 'Keep the fires burning', fa: 'آتش را روشن نگه دار' },
    description: { en: 'Collect the resources your village produces.', fa: 'منابعی را که دهکده تولید کرده جمع کن.' },
    target: 1, reward: { embers: 40, souls: 12 },
    progress: (state) => state.stats.collections,
  },
  {
    id: 'first-upgrade',
    title: { en: 'A stronger realm', fa: 'قلمرویی نیرومندتر' },
    description: { en: 'Upgrade any landmark.', fa: 'یکی از ساختمان‌های اصلی را ارتقا بده.' },
    target: 1, reward: { embers: 60, souls: 20 },
    progress: (state) => state.stats.upgrades,
  },
  {
    id: 'first-build',
    title: { en: 'Make it your own', fa: 'دهکده‌ات را بساز' },
    description: { en: 'Build on an empty plot.', fa: 'در یکی از زمین‌های خالی ساختمانی بساز.' },
    target: 1, reward: { embers: 60, souls: 15 },
    progress: (state) => state.stats.constructions,
  },
  {
    id: 'all-realms',
    title: { en: 'Explorer of the underworld', fa: 'کاشف جهان زیرین' },
    description: { en: 'Visit all six realms.', fa: 'هر شش قلمرو را کشف کن.' },
    target: 6, reward: { embers: 120, souls: 45 },
    progress: (state) => state.visited.length,
  },
  {
    id: 'village-builder',
    title: { en: 'A village comes alive', fa: 'دهکده جان می‌گیرد' },
    description: { en: 'Build on all three empty plots.', fa: 'در هر سه زمین خالی ساختمان بساز.' },
    target: 3, reward: { embers: 100, souls: 50 },
    progress: (state) => state.stats.constructions,
  },
  {
    id: 'master-builder',
    title: { en: 'Throne of the third', fa: 'تختگاه هادس سوم' },
    description: { en: 'Raise the citadel to level 3.', fa: 'دژ مرکزی را به سطح ۳ برسان.' },
    target: 2, reward: { embers: 180, souls: 70 },
    progress: (state) => buildingLevel(state, 'citadel') - 1,
  },
]);

const questIds = new Set(QUESTS.map((quest) => quest.id));
const coreIds = new Set(CORE_IDS);
const realmIds = new Set(REALM_IDS);
const plotIds = new Set(PLOT_IDS);
const own = (value, key) => value != null && Object.prototype.hasOwnProperty.call(value, key);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nowValue = (now) => Number.isFinite(now) && now >= 0 ? Math.floor(now) : Date.now();
const round = (value) => Math.round(value * 1_000_000) / 1_000_000;

function number(value, fallback, min, max, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const bounded = Math.min(max, Math.max(min, value));
  return integer ? Math.floor(bounded) : round(bounded);
}

function list(value, allowed) {
  return Array.isArray(value) ? [...new Set(value.filter((item) => allowed.has(item)))] : [];
}

function recalculateStats(state) {
  state.stats.upgrades = CORE_IDS.reduce((sum, id) => sum + buildingLevel(state, id) - 1, 0);
  state.stats.constructions = PLOT_IDS.filter((id) => state.plots[id] !== null).length;
}

/** Returns a fresh state, validates a v2 save and consumes eligible offline time. */
export function createGame(saved, now = Date.now()) {
  const timestamp = nowValue(now);
  let source = saved;
  if (typeof source === 'string') {
    try { source = JSON.parse(source); } catch { source = null; }
  }
  const validSave = isRecord(source) && source.version === GAME_VERSION;
  source = validSave ? source : {};
  const state = {
    version: GAME_VERSION,
    embers: number(source.embers, 240, 0, WALLET_CAP, true),
    souls: number(source.souls, 100, 0, WALLET_CAP, true),
    storedEmbers: number(source.storedEmbers, validSave ? 0 : 40, 0, WALLET_CAP),
    storedSouls: number(source.storedSouls, validSave ? 0 : 12, 0, WALLET_CAP),
    levels: Object.fromEntries(CORE_IDS.map((id) => [id, number(source.levels?.[id], 1, 1, MAX_LEVEL, true)])),
    plots: Object.fromEntries(PLOT_IDS.map((id) => [id, own(BUILD_TYPES, source.plots?.[id]) ? source.plots[id] : null])),
    visited: list(source.visited, realmIds),
    claimedQuests: list(source.claimedQuests, questIds),
    stats: {
      collections: number(source.stats?.collections, 0, 0, 1_000_000, true),
      upgrades: 0,
      constructions: 0,
      collectedEmbers: number(source.stats?.collectedEmbers, 0, 0, WALLET_CAP * 100, true),
      collectedSouls: number(source.stats?.collectedSouls, 0, 0, WALLET_CAP * 100, true),
    },
    lastTick: number(source.lastTick, timestamp, 0, timestamp, true),
  };
  recalculateStats(state);
  const rates = production(state);
  state.storedEmbers = Math.min(state.storedEmbers, rates.emberCapacity);
  state.storedSouls = Math.min(state.storedSouls, rates.soulCapacity);
  tick(state, timestamp);
  return state;
}

/** Unknown IDs return zero; core buildings are always between level 1 and 3. */
export function buildingLevel(state, id) {
  return coreIds.has(id) ? number(state?.levels?.[id], 1, 1, MAX_LEVEL, true) : 0;
}

/** Per-minute production, storage capacities and offline simulation limit. */
export function production(state) {
  const plots = PLOT_IDS.map((id) => state.plots?.[id]);
  const lanterns = plots.filter((type) => type === 'lantern').length;
  const gardens = plots.filter((type) => type === 'garden').length;
  const towers = plots.filter((type) => type === 'watchtower').length;
  const citadelBonus = buildingLevel(state, 'citadel') - 1;
  return {
    embersPerMinute: 24 * buildingLevel(state, 'forge') + 4 * citadelBonus + 7 * lanterns + 3 * towers,
    soulsPerMinute: 10 * buildingLevel(state, 'oracle') + 2 * citadelBonus + 4 * gardens + towers,
    emberCapacity: 200 + 80 * citadelBonus + 70 * lanterns + 40 * towers,
    soulCapacity: 80 + 40 * citadelBonus + 35 * gardens + 15 * towers,
    maxOfflineMs: MAX_OFFLINE_MS,
  };
}

/**
 * Consume time once. Discard time beyond the offline cap and do not rewind a
 * running simulation if the device clock moves backwards. Storage is bounded.
 */
export function tick(state, now = Date.now()) {
  const timestamp = nowValue(now);
  if (timestamp <= state.lastTick) {
    return { ok: true, elapsedMs: 0, simulatedMs: 0, offlineCapped: false, earned: { embers: 0, souls: 0 } };
  }
  const elapsedMs = timestamp - state.lastTick;
  const simulatedMs = Math.min(elapsedMs, MAX_OFFLINE_MS);
  const rates = production(state);
  const beforeEmbers = state.storedEmbers;
  const beforeSouls = state.storedSouls;
  state.storedEmbers = round(Math.min(rates.emberCapacity, beforeEmbers + rates.embersPerMinute * simulatedMs / 60_000));
  state.storedSouls = round(Math.min(rates.soulCapacity, beforeSouls + rates.soulsPerMinute * simulatedMs / 60_000));
  state.lastTick = timestamp;
  return {
    ok: true, elapsedMs, simulatedMs, offlineCapped: elapsedMs > MAX_OFFLINE_MS,
    earned: { embers: round(state.storedEmbers - beforeEmbers), souls: round(state.storedSouls - beforeSouls) },
  };
}

export function visit(state, id) {
  if (!coreIds.has(id)) return { ok: false, reason: 'invalid-building' };
  if (id === 'citadel') return { ok: true, discovered: false };
  const discovered = !state.visited.includes(id);
  if (discovered) state.visited.push(id);
  return { ok: true, discovered, id };
}

export function collect(state) {
  const embers = Math.min(Math.floor(state.storedEmbers), WALLET_CAP - state.embers);
  const souls = Math.min(Math.floor(state.storedSouls), WALLET_CAP - state.souls);
  if (embers <= 0 && souls <= 0) {
    const full = state.embers >= WALLET_CAP && state.souls >= WALLET_CAP;
    return { ok: false, reason: full ? 'wallet-full' : 'nothing-to-collect' };
  }
  state.embers += embers;
  state.souls += souls;
  state.storedEmbers = round(state.storedEmbers - embers);
  state.storedSouls = round(state.storedSouls - souls);
  state.stats.collections = Math.min(1_000_000, state.stats.collections + 1);
  state.stats.collectedEmbers = Math.min(WALLET_CAP * 100, state.stats.collectedEmbers + embers);
  state.stats.collectedSouls = Math.min(WALLET_CAP * 100, state.stats.collectedSouls + souls);
  return { ok: true, reward: { embers, souls } };
}

/** Cost to reach the next level, or null for an unknown or maxed landmark. */
export function upgradeCost(state, id) {
  if (!coreIds.has(id)) return null;
  const level = buildingLevel(state, id);
  if (level >= MAX_LEVEL) return null;
  const multiplier = level === 1 ? 1 : 2;
  const base = BASE_UPGRADE_COSTS[id];
  return { embers: base.embers * multiplier, souls: base.souls * multiplier };
}

export function buildCost(type) {
  return own(BUILD_TYPES, type) ? { ...BUILD_TYPES[type].cost } : null;
}

function pay(state, cost) {
  if (!Number.isFinite(state.embers) || !Number.isFinite(state.souls)
    || state.embers < cost.embers || state.souls < cost.souls) return false;
  state.embers -= cost.embers;
  state.souls -= cost.souls;
  return true;
}

export function upgrade(state, id) {
  if (!coreIds.has(id)) return { ok: false, reason: 'invalid-building' };
  const cost = upgradeCost(state, id);
  if (!cost) return { ok: false, reason: 'max-level' };
  if (!pay(state, cost)) return { ok: false, reason: 'insufficient-resources', cost };
  state.levels[id] = buildingLevel(state, id) + 1;
  recalculateStats(state);
  return { ok: true, id, level: state.levels[id], cost };
}

export function build(state, plotId, type) {
  if (!plotIds.has(plotId)) return { ok: false, reason: 'invalid-plot' };
  const cost = buildCost(type);
  if (!cost) return { ok: false, reason: 'invalid-building-type' };
  if (state.plots[plotId] !== null) return { ok: false, reason: 'plot-occupied' };
  if (!pay(state, cost)) return { ok: false, reason: 'insufficient-resources', cost };
  state.plots[plotId] = type;
  recalculateStats(state);
  return { ok: true, plotId, type, cost };
}

/** Quest text is bilingual; progress is capped to target for direct rendering. */
export function getQuests(state) {
  return QUESTS.map((quest) => {
    const progress = Math.min(quest.target, Math.max(0, quest.progress(state)));
    return {
      id: quest.id,
      title: { ...quest.title },
      description: { ...quest.description },
      progress,
      target: quest.target,
      complete: progress >= quest.target,
      claimed: state.claimedQuests.includes(quest.id),
      reward: { ...quest.reward },
    };
  });
}

export function claimQuest(state, questId) {
  const quest = getQuests(state).find((item) => item.id === questId);
  if (!quest) return { ok: false, reason: 'invalid-quest' };
  if (quest.claimed) return { ok: false, reason: 'already-claimed' };
  if (!quest.complete) return { ok: false, reason: 'quest-incomplete' };
  if (state.embers + quest.reward.embers > WALLET_CAP || state.souls + quest.reward.souls > WALLET_CAP) {
    return { ok: false, reason: 'wallet-full' };
  }
  state.claimedQuests.push(questId);
  state.embers += quest.reward.embers;
  state.souls += quest.reward.souls;
  return { ok: true, id: questId, reward: quest.reward };
}

/** Deep copy of the known save schema. Never adds time or touches browser state. */
export function snapshot(state) {
  return {
    version: GAME_VERSION,
    embers: state.embers,
    souls: state.souls,
    storedEmbers: state.storedEmbers,
    storedSouls: state.storedSouls,
    levels: Object.fromEntries(CORE_IDS.map((id) => [id, state.levels[id]])),
    plots: Object.fromEntries(PLOT_IDS.map((id) => [id, state.plots[id]])),
    visited: [...state.visited],
    claimedQuests: [...state.claimedQuests],
    stats: { ...state.stats },
    lastTick: state.lastTick,
  };
}

export function resetGame(now = Date.now()) {
  return createGame(null, now);
}
