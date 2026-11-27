import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, tick, visit, collect, upgrade, build, claimQuest, snapshot,
  getQuests, production, upgradeCost, buildCost, CORE_IDS, REALM_IDS,
  PLOT_IDS, GAME_VERSION, MAX_OFFLINE_MS, WALLET_CAP,
} from '../src/game.js';

const epoch = 1_800_000_000_000;

test('a fresh village can collect, upgrade and build immediately', () => {
  const state = createGame(null, epoch);
  assert.deepEqual(collect(state).reward, { embers: 40, souls: 12 });
  assert.equal(upgrade(state, 'forge').ok, true);
  assert.equal(build(state, 'plot-a', 'garden').ok, true);
  assert.equal(state.levels.forge, 2);
  assert.equal(state.plots['plot-a'], 'garden');
  assert.ok(state.embers >= 0 && state.souls >= 0);
  assert.deepEqual({ embers: state.embers, souls: state.souls }, { embers: 110, souls: 52 });
});

test('production retains fractions through collections and accrues only once', () => {
  const state = createGame(null, epoch);
  collect(state);
  tick(state, epoch + 1_000);
  assert.equal(state.storedEmbers, 0.4);
  assert.equal(collect(state).reason, 'nothing-to-collect');
  tick(state, epoch + 3_000);
  const reward = collect(state).reward;
  assert.deepEqual(reward, { embers: 1, souls: 0 });
  assert.equal(state.storedEmbers, 0.2);
  const after = snapshot(state);
  tick(state, epoch + 3_000);
  assert.deepEqual(snapshot(state), after);
  tick(state, epoch + 2_000);
  assert.deepEqual(snapshot(state), after);
});

test('offline accrual is capped and reloading does not repeat its reward', () => {
  const state = createGame(null, epoch);
  collect(state);
  const later = epoch + MAX_OFFLINE_MS * 10;
  const result = tick(state, later);
  assert.equal(result.offlineCapped, true);
  assert.equal(result.simulatedMs, MAX_OFFLINE_MS);
  assert.equal(state.lastTick, later);
  assert.equal(state.storedEmbers, production(state).emberCapacity);
  assert.equal(state.storedSouls, production(state).soulCapacity);
  const saved = snapshot(state);
  const reloaded = createGame(JSON.stringify(saved), later);
  assert.deepEqual(snapshot(reloaded), saved);
  collect(reloaded);
  const afterCollect = snapshot(reloaded);
  const secondReload = createGame(afterCollect, later);
  assert.equal(secondReload.storedEmbers, 0);
  assert.equal(secondReload.storedSouls, 0);
  assert.equal(collect(secondReload).ok, false);
});

test('unknown or malformed saves recover without invalid numbers or hidden fields', () => {
  assert.deepEqual(createGame('{bad json', epoch), createGame(null, epoch));
  assert.deepEqual(createGame({ version: 999, embers: 999 }, epoch), createGame(null, epoch));
  const state = createGame({
    version: GAME_VERSION,
    embers: -100,
    souls: Number.NaN,
    storedEmbers: Infinity,
    storedSouls: -5,
    lastTick: Infinity,
    levels: { forge: -20, oracle: 999, citadel: 2.8, theatre: '3', invented: 999 },
    plots: { 'plot-a': 'garden', 'plot-b': '__proto__', unknown: 'watchtower' },
    visited: ['forge', 'forge', 'fake', null, 'citadel'],
    claimedQuests: ['first-portal', 'first-portal', 'not-a-quest'],
    stats: { collections: NaN, upgrades: 1_000, constructions: -2 },
    other: 'discard me',
  }, epoch);
  assert.equal(state.embers, 0);
  assert.equal(state.souls, 100);
  assert.equal(state.storedEmbers, 0);
  assert.equal(state.storedSouls, 0);
  assert.equal(state.lastTick, epoch);
  assert.equal(state.levels.forge, 1);
  assert.equal(state.levels.oracle, 3);
  assert.equal(state.levels.citadel, 2);
  assert.equal(state.levels.theatre, 1);
  assert.equal(state.plots['plot-b'], null);
  assert.deepEqual(state.visited, ['forge']);
  assert.deepEqual(state.claimedQuests, ['first-portal']);
  assert.equal(state.stats.upgrades, 3);
  assert.equal(state.stats.constructions, 1);
  assert.equal(state.other, undefined);
  assert.deepEqual(Object.keys(state.levels), CORE_IDS);
  assert.deepEqual(Object.keys(state.plots), PLOT_IDS);
});

test('upgrades and construction fail atomically when funds, levels or IDs are invalid', () => {
  const state = createGame({ ...snapshot(createGame(null, epoch)), embers: 0, souls: 0 }, epoch);
  const before = snapshot(state);
  assert.equal(upgrade(state, 'forge').reason, 'insufficient-resources');
  assert.equal(build(state, 'plot-a', 'lantern').reason, 'insufficient-resources');
  assert.equal(upgrade(state, '__proto__').reason, 'invalid-building');
  assert.equal(build(state, 'fake', 'lantern').reason, 'invalid-plot');
  assert.equal(build(state, 'plot-a', '__proto__').reason, 'invalid-building-type');
  assert.deepEqual(snapshot(state), before);
  state.embers = 10_000;
  state.souls = 10_000;
  assert.equal(upgrade(state, 'forge').level, 2);
  assert.equal(upgrade(state, 'forge').level, 3);
  const maxed = snapshot(state);
  assert.equal(upgradeCost(state, 'forge'), null);
  assert.equal(upgrade(state, 'forge').reason, 'max-level');
  assert.deepEqual(snapshot(state), maxed);
  assert.equal(build(state, 'plot-a', 'lantern').ok, true);
  const built = snapshot(state);
  assert.equal(build(state, 'plot-a', 'garden').reason, 'plot-occupied');
  assert.deepEqual(snapshot(state), built);
});

test('quests require their actual objective and can only be claimed once, including after reload', () => {
  const state = createGame(null, epoch);
  assert.equal(claimQuest(state, 'first-portal').reason, 'quest-incomplete');
  visit(state, 'citadel');
  assert.equal(state.visited.length, 0);
  visit(state, 'forge');
  visit(state, 'forge');
  assert.equal(state.visited.length, 1);
  assert.equal(claimQuest(state, 'first-portal').ok, true);
  const afterReward = snapshot(state);
  assert.equal(claimQuest(state, 'first-portal').reason, 'already-claimed');
  assert.deepEqual(snapshot(state), afterReward);
  const reloaded = createGame(afterReward, epoch);
  assert.equal(claimQuest(reloaded, 'first-portal').reason, 'already-claimed');
  for (const id of REALM_IDS) visit(state, id);
  const quest = getQuests(state).find(({ id }) => id === 'all-realms');
  assert.equal(quest.complete, true);
  assert.equal(quest.progress, 6);
  assert.equal(claimQuest(state, 'all-realms').ok, true);
});

test('upgrades and built plots change the correct production and storage amounts', () => {
  const state = createGame(null, epoch);
  state.embers = 5_000;
  state.souls = 5_000;
  const base = production(state);
  upgrade(state, 'forge');
  upgrade(state, 'oracle');
  upgrade(state, 'citadel');
  build(state, 'plot-a', 'lantern');
  build(state, 'plot-b', 'garden');
  build(state, 'plot-c', 'watchtower');
  const enhanced = production(state);
  assert.equal(enhanced.embersPerMinute - base.embersPerMinute, 24 + 4 + 7 + 3);
  assert.equal(enhanced.soulsPerMinute - base.soulsPerMinute, 10 + 2 + 4 + 1);
  assert.equal(enhanced.emberCapacity - base.emberCapacity, 80 + 70 + 40);
  assert.equal(enhanced.soulCapacity - base.soulCapacity, 40 + 35 + 15);
});

test('wallet overflow preserves stored resources and pending quest rewards', () => {
  const state = createGame(null, epoch);
  state.embers = WALLET_CAP;
  state.souls = WALLET_CAP;
  const bank = [state.storedEmbers, state.storedSouls];
  assert.equal(collect(state).reason, 'wallet-full');
  assert.deepEqual([state.storedEmbers, state.storedSouls], bank);
  visit(state, 'forge');
  assert.equal(claimQuest(state, 'first-portal').reason, 'wallet-full');
  assert.equal(state.claimedQuests.length, 0);
});

test('returned data cannot mutate the saved game or the shared economy constants', () => {
  const state = createGame(null, epoch);
  const copy = snapshot(state);
  copy.levels.forge = 3;
  copy.plots['plot-a'] = 'lantern';
  copy.visited.push('forge');
  copy.stats.collections = 7;
  assert.equal(state.levels.forge, 1);
  assert.equal(state.plots['plot-a'], null);
  assert.equal(state.visited.length, 0);
  assert.equal(state.stats.collections, 0);
  const cost = buildCost('lantern');
  cost.embers = 0;
  assert.equal(buildCost('lantern').embers, 90);
  const quests = getQuests(state);
  quests[0].reward.embers = 0;
  quests[0].title.en = 'Changed';
  assert.equal(getQuests(state)[0].reward.embers, 50);
  assert.equal(getQuests(state)[0].title.en, 'A world beyond');
});
