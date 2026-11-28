import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createProgress, snapshotProgress, discoverRealm, openDestination,
  toggleSaved, chooseJourney, getJourneyProgress, getRealmProgress,
  getProgressSummary, resetProgress, encodeCollection, decodeCollection,
  mergeCollection, MAX_COLLECTION_IDS, MAX_COLLECTION_HASH_LENGTH,
} from '../src/journey-state.js';

const catalog = {
  realms: [{ id: 'forge' }, { id: 'archive' }, { id: 'theatre' }, { id: 'gates' }],
  destinations: [
    { id: 'work', realmIds: ['theatre'], url: 'https://example.com/work/' },
    { id: 'instagram', realmIds: ['theatre', 'gates'], url: 'https://example.com/social/' },
    { id: 'systems', realmIds: ['archive', 'forge'], url: 'https://example.com/systems/' },
    { id: 'repository', realmIds: ['forge'], url: 'https://example.com/code/' },
  ],
  journeys: [{
    id: 'inspiration',
    steps: [
      { destinationId: 'work', prompt: { en: 'Explore a film.', fa: 'یک فیلم ببین.' }, why: { en: 'Visual ideas.' } },
      { destinationId: 'instagram', prompt: { en: 'Explore recent work.' } },
      { destinationId: 'systems', prompt: { en: 'Explore a creative system.' } },
    ],
  }],
};

test('v3 saves validate known IDs, discard old economies, and restore open/discovery invariants', () => {
  const fresh = resetProgress(catalog);
  for (const value of [null, false, [], '{bad', { version: 2, embers: 999, visited: ['forge'] }, { version: 99 }]) {
    assert.deepEqual(createProgress(value, catalog), fresh);
  }
  const input = {
    version: 3,
    discovered: ['forge', 'unknown', 'forge', 123],
    opened: ['instagram', 'instagram', 'unknown', null],
    saved: ['work', 'unknown', 'work', {}, 'systems'],
    activeJourney: 'inspiration',
    embers: 900,
    claimedQuests: ['pretend'],
    injected: { unexpected: true },
  };
  const original = structuredClone(input);
  const state = createProgress(JSON.stringify(input), catalog);
  assert.deepEqual(state, {
    version: 3, discovered: ['forge', 'theatre', 'gates'], opened: ['instagram'],
    saved: ['work', 'systems'], activeJourney: 'inspiration',
  });
  assert.deepEqual(input, original);
  assert.equal(createProgress({ version: 3, activeJourney: 'invented' }, catalog).activeJourney, null);
  assert.deepEqual(createProgress({ version: 3, saved: 'work', opened: { work: true } }, null), fresh);
});

test('opening a shared destination is deduplicated and lights its realms without requiring discovery first', () => {
  const state = createProgress(null, catalog);
  discoverRealm(state, 'archive', catalog);
  assert.equal(getRealmProgress(state, 'archive', catalog).lit, false);
  const first = openDestination(state, 'instagram', catalog);
  assert.deepEqual(first, { ok: true, changed: true, destinationId: 'instagram', firstOpen: true, discoveredRealmIds: ['theatre', 'gates'] });
  const before = snapshotProgress(state);
  const again = openDestination(state, 'instagram', catalog);
  assert.equal(again.firstOpen, false);
  assert.equal(again.changed, false);
  assert.deepEqual(state, before);
  assert.deepEqual(getRealmProgress(state, 'theatre', catalog), { ok: true, id: 'theatre', opened: 1, total: 2, discovered: true, lit: true, complete: false });
  assert.equal(getRealmProgress(state, 'gates', catalog).complete, true);
  assert.deepEqual(getProgressSummary(state, catalog), {
    totalRealms: 4, discoveredRealms: 3, litRealms: 2,
    totalDestinations: 4, openedDestinations: 1, savedDestinations: 0,
    totalJourneys: 1, completedJourneys: 0, activeJourney: null,
  });
});

test('unknown IDs are rejected without changing progress and invalid states do not throw', () => {
  const state = createProgress(null, catalog);
  const before = snapshotProgress(state);
  assert.equal(discoverRealm(state, 'unknown', catalog).reason, 'unknown-realm');
  assert.equal(openDestination(state, '__proto__', catalog).reason, 'unknown-destination');
  assert.equal(toggleSaved(state, 'https://example.com/', catalog).reason, 'unknown-destination');
  assert.equal(chooseJourney(state, 'unknown', catalog).reason, 'unknown-journey');
  assert.deepEqual(state, before);
  assert.equal(openDestination(null, 'work', catalog).reason, 'invalid-state');
  assert.equal(toggleSaved({}, 'work', catalog).reason, 'invalid-state');
  assert.equal(getRealmProgress(state, 'unknown', catalog).ok, false);
  assert.equal(getJourneyProgress(state, null, catalog).complete, false);
});

test('journeys complete only from chosen destination links, in any order', () => {
  const state = createProgress(null, catalog);
  chooseJourney(state, 'inspiration', catalog);
  for (const realm of catalog.realms) discoverRealm(state, realm.id, catalog);
  for (const step of catalog.journeys[0].steps) toggleSaved(state, step.destinationId, catalog);
  let progress = getJourneyProgress(state, catalog.journeys[0], catalog);
  assert.equal(progress.completed, 0);
  assert.equal(progress.nextDestinationId, 'work');
  assert.equal(progress.complete, false);
  openDestination(state, 'systems', catalog);
  openDestination(state, 'work', catalog);
  openDestination(state, 'work', catalog);
  progress = getJourneyProgress(state, 'inspiration', catalog);
  assert.equal(progress.completed, 2);
  assert.equal(progress.nextDestinationId, 'instagram');
  assert.deepEqual(progress.steps.map((step) => step.completed), [true, false, true]);
  openDestination(state, 'instagram', catalog);
  progress = getJourneyProgress(state, 'inspiration', catalog);
  assert.equal(progress.complete, true);
  assert.equal(progress.nextDestinationId, null);
  assert.equal(getProgressSummary(state, catalog).completedJourneys, 1);
  chooseJourney(state, null, catalog);
  assert.equal(getJourneyProgress(state, 'inspiration', catalog).complete, true);
  assert.equal(state.activeJourney, null);
});

test('journey projection uses the real catalogue and does not expose mutable prompt objects', () => {
  const state = createProgress(null, catalog);
  const forged = { id: 'inspiration', steps: [] };
  const progress = getJourneyProgress(state, forged, catalog);
  assert.equal(progress.total, 3);
  progress.steps[0].prompt.en = 'Altered';
  assert.equal(catalog.journeys[0].steps[0].prompt.en, 'Explore a film.');
  const broken = { ...catalog, journeys: [{ id: 'broken', steps: [{ destinationId: 'missing' }] }] };
  assert.equal(chooseJourney(state, 'broken', broken).ok, false);
  assert.equal(getJourneyProgress(state, 'broken', broken).complete, false);
});

test('shared hashes contain only public catalogue IDs and decoding never changes progress', () => {
  const state = createProgress(null, catalog);
  toggleSaved(state, 'repository', catalog);
  const before = snapshotProgress(state);
  const hash = encodeCollection(['work', 'work', 'unknown', 'systems', 'https://evil.example/'], catalog);
  assert.equal(hash, '#collection=v3:work,systems');
  assert.deepEqual(decodeCollection(hash, catalog), { ok: true, ids: ['work', 'systems'] });
  assert.deepEqual(decodeCollection('#collection=v3:work,%3Cscript%3E,unknown', catalog), { ok: true, ids: ['work'] });
  assert.deepEqual(decodeCollection('#collection=v3:%77ork,work', catalog), { ok: true, ids: ['work'] });
  assert.deepEqual(state, before);
  const privateCatalog = { ...catalog, destinations: [...catalog.destinations, { id: 'private-note', realmIds: ['archive'], public: false }] };
  assert.equal(encodeCollection(['private-note'], privateCatalog), '');
  assert.equal(decodeCollection('#collection=v3:private-note', privateCatalog).ok, false);
});

test('malformed and oversized collection inputs are bounded and rejected safely', () => {
  for (const value of [null, {}, '#collection=v2:work', '#collection=v3:', '#collection=v3:unknown', '#collection=v3:%E0%A4%A', '#collection=v3:work,,systems', '#collection=v3:work&saved=repository', 'https://example.com/#collection=v3:work']) {
    const result = decodeCollection(value, catalog);
    assert.equal(result.ok, false);
    assert.deepEqual(result.ids, []);
  }
  assert.equal(encodeCollection('work', catalog), '');
  assert.equal(encodeCollection([], catalog), '');
  assert.equal(decodeCollection('#collection=v3:' + 'x'.repeat(MAX_COLLECTION_HASH_LENGTH), catalog).reason, 'collection-too-large');
  const ids = Array.from({ length: MAX_COLLECTION_IDS + 1 }, (_, i) => `link-${i}`);
  const bigCatalog = { realms: [], destinations: ids.map((id) => ({ id, realmIds: [] })), journeys: [] };
  assert.equal(encodeCollection(ids, bigCatalog), '');
  assert.equal(decodeCollection('#collection=v3:' + ids.join(','), bigCatalog).reason, 'collection-too-large');
  const allowed = ids.slice(0, MAX_COLLECTION_IDS);
  assert.deepEqual(decodeCollection(encodeCollection(allowed, bigCatalog), bigCatalog).ids, allowed);
});

test('explicit collection imports merge favourites without opening links or replacing existing favourites', () => {
  const state = createProgress(null, catalog);
  toggleSaved(state, 'repository', catalog);
  chooseJourney(state, 'inspiration', catalog);
  const incoming = decodeCollection('#collection=v3:work,systems,repository', catalog);
  assert.deepEqual(state.saved, ['repository'], 'decoding must wait for an explicit save action');
  const imported = mergeCollection(state, incoming.ids, catalog);
  assert.deepEqual(imported, { ok: true, changed: true, addedIds: ['work', 'systems'] });
  assert.deepEqual(state.saved, ['repository', 'work', 'systems']);
  assert.deepEqual(state.opened, []);
  assert.deepEqual(state.discovered, []);
  assert.equal(state.activeJourney, 'inspiration');
  assert.equal(getJourneyProgress(state, 'inspiration', catalog).completed, 0);
  assert.equal(mergeCollection(state, incoming.ids, catalog).changed, false);
  const before = snapshotProgress(state);
  assert.equal(mergeCollection(state, ['unknown'], catalog).ok, false);
  assert.deepEqual(state, before);
});

test('snapshots and resets are independent and saving a link does not create an open event', () => {
  const state = createProgress(null, catalog);
  assert.equal(toggleSaved(state, 'work', catalog).saved, true);
  assert.equal(toggleSaved(state, 'work', catalog).saved, false);
  assert.deepEqual(state.opened, []);
  openDestination(state, 'repository', catalog);
  const copy = snapshotProgress(state);
  copy.discovered.push('theatre');
  copy.opened.length = 0;
  copy.saved.push('work');
  assert.deepEqual(state.opened, ['repository']);
  assert.deepEqual(state.discovered, ['forge']);
  assert.deepEqual(state.saved, []);
  assert.deepEqual(createProgress(JSON.stringify(snapshotProgress(state)), catalog), state);
  assert.deepEqual(resetProgress(catalog), { version: 3, discovered: [], opened: [], saved: [], activeJourney: null });
});

test('the shipped atlas has safe, coherent links and its full journeys and realms progress only through actual opens', async () => {
  const atlas = JSON.parse(await readFile(new URL('../src/atlas.json', import.meta.url), 'utf8'));
  assert.equal(atlas.realms.length, 6);
  assert.equal(atlas.destinations.length, 35);
  assert.equal(atlas.journeys.length, 3);
  for (const [name, entries] of [['realms', atlas.realms], ['destinations', atlas.destinations], ['journeys', atlas.journeys]]) {
    assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length, `${name} IDs must be unique`);
    for (const entry of entries) assert.match(entry.id, /^[A-Za-z0-9][A-Za-z0-9._~-]{0,79}$/, `${name} ID must be a safe public token`);
  }
  const realmIds = new Set(atlas.realms.map((realm) => realm.id));
  const ids = atlas.destinations.map((destination) => destination.id);
  const destinationIds = new Set(ids);
  for (const destination of atlas.destinations) {
    const url = new URL(destination.url);
    assert.equal(url.protocol, 'https:', `${destination.id} must use HTTPS`);
    assert.ok(url.hostname, `${destination.id} must have a host`);
    assert.equal(url.username, '', `${destination.id} must not embed credentials`);
    assert.equal(url.password, '', `${destination.id} must not embed credentials`);
    assert.ok(Array.isArray(destination.realmIds) && destination.realmIds.length > 0, `${destination.id} must belong to a realm`);
    assert.equal(new Set(destination.realmIds).size, destination.realmIds.length, `${destination.id} memberships must be unique`);
    for (const realmId of destination.realmIds) assert.ok(realmIds.has(realmId), `${destination.id} references unknown realm ${realmId}`);
  }
  for (const journey of atlas.journeys) {
    assert.equal(journey.steps.length, 3, `${journey.id} must have three steps`);
    assert.equal(new Set(journey.steps.map((step) => step.destinationId)).size, 3, `${journey.id} must reference three distinct links`);
    for (const step of journey.steps) assert.ok(destinationIds.has(step.destinationId), `${journey.id} references an unknown destination`);
  }

  const state = createProgress(null, atlas);
  for (const realmId of realmIds) discoverRealm(state, realmId, atlas);
  for (const id of ids) toggleSaved(state, id, atlas);
  for (const journey of atlas.journeys) chooseJourney(state, journey.id, atlas);
  const unopened = getProgressSummary(state, atlas);
  assert.equal(unopened.discoveredRealms, 6);
  assert.equal(unopened.savedDestinations, 35);
  assert.equal(unopened.openedDestinations, 0);
  assert.equal(unopened.litRealms, 0, 'discovery and favourites alone cannot illuminate a realm');
  assert.equal(unopened.completedJourneys, 0, 'choosing journeys and saving links cannot complete their steps');

  const opened = new Set();
  for (const id of ids) {
    assert.equal(openDestination(state, id, atlas).firstOpen, true);
    opened.add(id);
    for (const journey of atlas.journeys) {
      const expected = journey.steps.filter((step) => opened.has(step.destinationId)).length;
      const progress = getJourneyProgress(state, journey, atlas);
      assert.equal(progress.completed, expected, `${journey.id} counts only its chosen links`);
      assert.equal(progress.complete, expected === 3, `${journey.id} completes only after all three links are chosen`);
    }
  }
  const completed = getProgressSummary(state, atlas);
  assert.equal(completed.openedDestinations, 35);
  assert.equal(completed.litRealms, 6);
  assert.equal(completed.completedJourneys, 3);
  for (const realmId of realmIds) {
    const progress = getRealmProgress(state, realmId, atlas);
    const expected = atlas.destinations.filter((destination) => destination.realmIds.includes(realmId)).length;
    assert.equal(progress.total, expected);
    assert.equal(progress.opened, expected);
    assert.equal(progress.lit, true);
    assert.equal(progress.complete, true);
  }
  const hash = encodeCollection(ids, atlas);
  assert.ok(hash && hash.length <= MAX_COLLECTION_HASH_LENGTH, 'the complete public atlas must fit a shareable collection');
  assert.deepEqual(decodeCollection(hash, atlas), { ok: true, ids });
});
