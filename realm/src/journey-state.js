/**
 * Hades Realm v3: local progress through a public link catalogue.
 *
 * Create state with createProgress(saved, catalog), call a mutator after the
 * matching visitor action, and persist snapshotProgress(state). An "opened"
 * destination means the visitor chose its link; it does not assert that an
 * external page loaded, was read, or was finished. No link has prerequisites.
 *
 * Mutators change state and return { ok, changed, ... }, or
 * { ok: false, changed: false, reason }. Projections and collection helpers do
 * not mutate state or the catalogue. This module performs no storage, timers,
 * DOM, network, or cross-tab synchronization.
 *
 * Sharing uses #collection=v3:id-a,id-b. decodeCollection only returns IDs.
 * Call mergeCollection explicitly after the visitor chooses to save/import;
 * it adds favourites without removing existing ones or recording opens.
 */

export const PROGRESS_VERSION = 3;
export const MAX_COLLECTION_IDS = 64;
export const MAX_COLLECTION_HASH_LENGTH = 4096;

const COLLECTION_PREFIX = '#collection=v3:';
const MAX_SAVE_LENGTH = 262_144;
const MAX_LIST_INPUT = 4096;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = (value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._~-]{0,79}$/.test(value);
const failure = (reason) => ({ ok: false, changed: false, reason });

function freshProgress() {
  return { version: PROGRESS_VERSION, discovered: [], opened: [], saved: [], activeJourney: null };
}

function uniqueIds(value, allowed) {
  if (!Array.isArray(value)) return [];
  const found = new Set();
  for (let i = 0; i < Math.min(value.length, MAX_LIST_INPUT); i++) {
    const id = value[i];
    if (isId(id) && (!allowed || allowed.has(id))) found.add(id);
  }
  return [...found];
}

function catalogue(catalog) {
  const realms = new Map();
  const destinations = new Map();
  const journeys = new Map();
  for (const realm of Array.isArray(catalog?.realms) ? catalog.realms : []) {
    if (isRecord(realm) && isId(realm.id) && !realms.has(realm.id)) realms.set(realm.id, realm);
  }
  for (const destination of Array.isArray(catalog?.destinations) ? catalog.destinations : []) {
    if (!isRecord(destination) || !isId(destination.id) || destinations.has(destination.id)) continue;
    // The shipped atlas is public. Honour an explicit restriction if a later
    // catalogue adds one, including when creating a shared collection.
    if (destination.public === false || destination.private === true || (destination.visibility != null && destination.visibility !== 'public')) continue;
    destinations.set(destination.id, {
      entry: destination,
      realmIds: uniqueIds(destination.realmIds, realms),
    });
  }
  for (const journey of Array.isArray(catalog?.journeys) ? catalog.journeys : []) {
    if (!isRecord(journey) || !isId(journey.id) || journeys.has(journey.id)) continue;
    // A broken catalogue must not silently shorten a journey and report it as
    // completed. Invalid journeys are unavailable until their steps are fixed.
    if (!Array.isArray(journey.steps) || !journey.steps.length || journey.steps.length > MAX_LIST_INPUT) continue;
    if (!journey.steps.every((step) => isRecord(step) && destinations.has(step.destinationId))) continue;
    journeys.set(journey.id, journey);
  }
  return { realms, destinations, journeys };
}

function validState(state) {
  return isRecord(state) && state.version === PROGRESS_VERSION
    && Array.isArray(state.discovered) && Array.isArray(state.opened) && Array.isArray(state.saved);
}

function normalize(source, index) {
  if (!isRecord(source) || source.version !== PROGRESS_VERSION) return freshProgress();
  const state = {
    version: PROGRESS_VERSION,
    discovered: uniqueIds(source.discovered, index.realms),
    opened: uniqueIds(source.opened, index.destinations),
    saved: uniqueIds(source.saved, index.destinations),
    activeJourney: index.journeys.has(source.activeJourney) ? source.activeJourney : null,
  };
  // Opening a destination also discovers every realm containing that link.
  const discovered = new Set(state.discovered);
  for (const id of state.opened) {
    for (const realmId of index.destinations.get(id).realmIds) discovered.add(realmId);
  }
  state.discovered = [...discovered];
  return state;
}

/** Validate a v3 object/JSON save. Earlier game versions start a fresh journey. */
export function createProgress(saved, catalog) {
  let source = saved;
  if (typeof source === 'string') {
    if (source.length > MAX_SAVE_LENGTH) source = null;
    else { try { source = JSON.parse(source); } catch { source = null; } }
  }
  return normalize(source, catalogue(catalog));
}

/** Independent, serializable copy of progress; unknown extension fields drop. */
export function snapshotProgress(state) {
  if (!validState(state)) return freshProgress();
  return {
    version: PROGRESS_VERSION,
    discovered: uniqueIds(state.discovered),
    opened: uniqueIds(state.opened),
    saved: uniqueIds(state.saved),
    activeJourney: isId(state.activeJourney) ? state.activeJourney : null,
  };
}

/** Record the first opening of a realm panel; this alone does not light it. */
export function discoverRealm(state, realmId, catalog) {
  const index = catalogue(catalog);
  if (!index.realms.has(realmId)) return failure('unknown-realm');
  if (!validState(state)) return failure('invalid-state');
  const changed = !state.discovered.includes(realmId);
  if (changed) state.discovered.push(realmId);
  return { ok: true, changed, realmId };
}

/** Record a chosen link once, plus discovery of all of its catalogue realms. */
export function openDestination(state, id, catalog) {
  const destination = catalogue(catalog).destinations.get(id);
  if (!destination) return failure('unknown-destination');
  if (!validState(state)) return failure('invalid-state');
  const firstOpen = !state.opened.includes(id);
  if (firstOpen) state.opened.push(id);
  const discoveredRealmIds = destination.realmIds.filter((realmId) => !state.discovered.includes(realmId));
  state.discovered.push(...discoveredRealmIds);
  return { ok: true, changed: firstOpen || discoveredRealmIds.length > 0, destinationId: id, firstOpen, discoveredRealmIds };
}

/** Save/unsave a link without opening it or changing journey completion. */
export function toggleSaved(state, id, catalog) {
  if (!catalogue(catalog).destinations.has(id)) return failure('unknown-destination');
  if (!validState(state)) return failure('invalid-state');
  const existing = state.saved.indexOf(id);
  if (existing === -1) state.saved.push(id);
  else state.saved.splice(existing, 1);
  return { ok: true, changed: true, destinationId: id, saved: existing === -1 };
}

/** Choose a suggested journey, or pass null to clear the active suggestion. */
export function chooseJourney(state, id, catalog) {
  if (id !== null && !catalogue(catalog).journeys.has(id)) return failure('unknown-journey');
  if (!validState(state)) return failure('invalid-state');
  const changed = state.activeJourney !== id;
  state.activeJourney = id;
  return { ok: true, changed, journeyId: id };
}

function journeyProjection(state, journey) {
  const opened = new Set(state.opened);
  const steps = journey.steps.map((step, index) => ({
    ...step,
    ...(isRecord(step.prompt) ? { prompt: { ...step.prompt } } : {}),
    ...(isRecord(step.why) ? { why: { ...step.why } } : {}),
    index,
    completed: opened.has(step.destinationId),
  }));
  const completed = steps.filter((step) => step.completed).length;
  return {
    ok: true, id: journey.id, total: steps.length, completed,
    complete: steps.length > 0 && completed === steps.length,
    nextDestinationId: steps.find((step) => !step.completed)?.destinationId ?? null,
    steps,
  };
}

/** Accept a catalogue journey object or ID; only its catalogue steps count. */
export function getJourneyProgress(state, journey, catalog) {
  const index = catalogue(catalog);
  const id = typeof journey === 'string' ? journey : journey?.id;
  const known = index.journeys.get(id);
  if (!known) return { ok: false, reason: 'unknown-journey', id: isId(id) ? id : null, total: 0, completed: 0, complete: false, nextDestinationId: null, steps: [] };
  return journeyProjection(normalize(state, index), known);
}

function realmProjection(state, realmId, index) {
  const ids = [...index.destinations].filter(([, destination]) => destination.realmIds.includes(realmId)).map(([id]) => id);
  const opened = ids.filter((id) => state.opened.includes(id)).length;
  return {
    ok: true, id: realmId, opened, total: ids.length,
    discovered: state.discovered.includes(realmId),
    lit: opened > 0,
    complete: ids.length > 0 && opened === ids.length,
  };
}

/** A realm lights after at least one of its destination links is chosen. */
export function getRealmProgress(state, realmId, catalog) {
  const index = catalogue(catalog);
  if (!index.realms.has(realmId)) return { ok: false, reason: 'unknown-realm', id: isId(realmId) ? realmId : null, opened: 0, total: 0, discovered: false, lit: false, complete: false };
  return realmProjection(normalize(state, index), realmId, index);
}

/** Counts are unique destinations globally; a shared link can light two realms. */
export function getProgressSummary(state, catalog) {
  const index = catalogue(catalog);
  const progress = normalize(state, index);
  return {
    totalRealms: index.realms.size,
    discoveredRealms: progress.discovered.length,
    litRealms: [...index.realms.keys()].filter((id) => realmProjection(progress, id, index).lit).length,
    totalDestinations: index.destinations.size,
    openedDestinations: progress.opened.length,
    savedDestinations: progress.saved.length,
    totalJourneys: index.journeys.size,
    completedJourneys: [...index.journeys.values()].filter((journey) => journeyProjection(progress, journey).complete).length,
    activeJourney: progress.activeJourney,
  };
}

export function resetProgress(catalog) {
  return createProgress(null, catalog);
}

function collectionIds(ids, index) {
  if (!Array.isArray(ids)) return { ok: false, ids: [], reason: 'invalid-collection' };
  if (ids.length > MAX_LIST_INPUT) return { ok: false, ids: [], reason: 'collection-too-large' };
  const valid = uniqueIds(ids, index.destinations);
  if (valid.length > MAX_COLLECTION_IDS) return { ok: false, ids: [], reason: 'collection-too-large' };
  if (!valid.length) return { ok: false, ids: [], reason: 'empty-collection' };
  return { ok: true, ids: valid };
}

/** Return a shareable hash, or '' for an empty/oversized collection. */
export function encodeCollection(ids, catalog) {
  const selected = collectionIds(ids, catalogue(catalog));
  if (!selected.ok) return '';
  const hash = COLLECTION_PREFIX + selected.ids.map(encodeURIComponent).join(',');
  return hash.length <= MAX_COLLECTION_HASH_LENGTH ? hash : '';
}

/** Decode only public catalogue IDs; never interpret URLs, markup, or state. */
export function decodeCollection(hash, catalog) {
  if (typeof hash !== 'string') return { ok: false, ids: [], reason: 'invalid-collection' };
  if (hash.length > MAX_COLLECTION_HASH_LENGTH) return { ok: false, ids: [], reason: 'collection-too-large' };
  if (!hash.startsWith(COLLECTION_PREFIX)) return { ok: false, ids: [], reason: 'not-a-collection' };
  const payload = hash.slice(COLLECTION_PREFIX.length);
  if (!payload) return { ok: false, ids: [], reason: 'empty-collection' };
  const tokens = payload.split(',');
  if (tokens.length > MAX_COLLECTION_IDS) return { ok: false, ids: [], reason: 'collection-too-large' };
  if (tokens.some((token) => !token)) return { ok: false, ids: [], reason: 'invalid-collection' };
  let ids;
  try { ids = tokens.map((token) => decodeURIComponent(token)); }
  catch { return { ok: false, ids: [], reason: 'invalid-collection' }; }
  return collectionIds(ids, catalogue(catalog));
}

/** Explicit import action: merge favourites, preserving all existing progress. */
export function mergeCollection(state, ids, catalog) {
  const selected = collectionIds(ids, catalogue(catalog));
  if (!selected.ok) return failure(selected.reason);
  if (!validState(state)) return failure('invalid-state');
  const addedIds = selected.ids.filter((id) => !state.saved.includes(id));
  state.saved.push(...addedIds);
  return { ok: true, changed: addedIds.length > 0, addedIds };
}
