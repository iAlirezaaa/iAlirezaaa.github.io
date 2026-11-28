import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressStore } from '../src/progress-store.js';
import {
  createProgress, openDestination, toggleSaved, chooseJourney,
} from '../src/journey-state.js';

const KEY = 'hadesrealm.atlas.v3';
const catalog = {
  realms: [{ id: 'forge' }, { id: 'archive' }],
  destinations: [{ id: 'code', realmIds: ['forge'] }, { id: 'notes', realmIds: ['archive'] }],
  journeys: [{ id: 'learn', steps: [{ destinationId: 'code' }, { destinationId: 'notes' }] }],
};

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function sharedLocks() {
  const queues = new Map();
  return {
    request(name, callback) {
      const pending = (queues.get(name) || Promise.resolve()).then(callback);
      queues.set(name, pending.catch(() => {}));
      return pending;
    },
  };
}

function environment({ initial = null, locks = sharedLocks() } = {}) {
  const values = new Map(initial === null ? [] : [[KEY, JSON.stringify(initial)]]);
  const tabs = [];
  let writes = 0;
  function newTab() {
    const listeners = new Set();
    const tab = { failRead: false, failWrite: false, changes: [], errors: [], listeners };
    tab.storage = {
      getItem(key) {
        if (tab.failRead) throw new Error('Storage read denied');
        return values.get(key) ?? null;
      },
      setItem(key, value) {
        if (tab.failWrite) throw new Error('Storage write denied');
        writes++;
        values.set(key, value);
      },
    };
    tab.window = {
      addEventListener(type, callback) { if (type === 'storage') listeners.add(callback); },
      removeEventListener(type, callback) { if (type === 'storage') listeners.delete(callback); },
    };
    tab.dispatch = (key = KEY, newValue = null) => {
      for (const listener of [...listeners]) listener({ key, newValue, storageArea: tab.storage });
    };
    tab.mount = () => {
      const previous = new Map();
      try {
        for (const [name, value] of Object.entries({ window: tab.window, localStorage: tab.storage, navigator: { locks } })) {
          previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
          Object.defineProperty(globalThis, name, { configurable: true, value });
        }
        tab.store = createProgressStore({ catalog, onChange: (state) => tab.changes.push(state), onStorageError: (error) => tab.errors.push(error) });
      } finally {
        for (const [name, descriptor] of previous) {
          if (descriptor) Object.defineProperty(globalThis, name, descriptor);
          else delete globalThis[name];
        }
      }
      return tab.store;
    };
    tabs.push(tab);
    return tab;
  }
  return {
    newTab,
    read: () => createProgress(values.get(KEY), catalog),
    writeDirect: (state) => values.set(KEY, JSON.stringify(state)),
    writes: () => writes,
    destroy: () => tabs.forEach((tab) => tab.store?.destroy()),
  };
}

test('initial reads and no-op actions do not write; state and notification snapshots are isolated', async (t) => {
  const initial = createProgress(null, catalog);
  openDestination(initial, 'code', catalog);
  const env = environment({ initial }); t.after(env.destroy);
  const tab = env.newTab(), store = tab.mount();
  assert.deepEqual(store.getState().opened, ['code']);
  assert.equal(env.writes(), 0);
  assert.equal(tab.changes.length, 0);
  store.getState().opened.push('notes');
  assert.deepEqual(store.getState().opened, ['code']);
  const repeated = await store.mutate((state) => openDestination(state, 'code', catalog));
  assert.equal(repeated.changed, false);
  assert.equal(env.writes(), 0);
  const result = await store.mutate((state) => toggleSaved(state, 'notes', catalog));
  assert.equal(result.saved, true);
  assert.equal(env.writes(), 1);
  tab.changes[0].saved.length = 0;
  assert.deepEqual(store.getState().saved, ['notes']);
  assert.deepEqual(env.read().saved, ['notes']);
});

test('same-tab async mutations serialize and thrown mutations cannot leak their candidate or poison the queue', async (t) => {
  const env = environment(); t.after(env.destroy);
  const store = env.newTab().mount();
  const entered = deferred(), release = deferred();
  const first = store.mutate(async (state) => {
    entered.resolve(); await release.promise;
    return openDestination(state, 'code', catalog);
  });
  await entered.promise;
  const second = store.mutate((state) => openDestination(state, 'notes', catalog));
  assert.deepEqual(env.read().opened, []);
  release.resolve(); await Promise.all([first, second]);
  assert.deepEqual(env.read().opened, ['code', 'notes']);
  let attempts = 0;
  await assert.rejects(store.mutate((state) => {
    attempts++; state.opened.length = 0; throw new Error('Rejected action');
  }), /Rejected action/);
  assert.equal(attempts, 1);
  assert.deepEqual(store.getState().opened, ['code', 'notes']);
  await store.mutate((state) => toggleSaved(state, 'code', catalog));
  assert.deepEqual(env.read().saved, ['code']);
});

test('a held shared lock preserves racing actions and reset cannot be undone by a stale tab', async (t) => {
  const env = environment(); t.after(env.destroy);
  const a = env.newTab().mount(), b = env.newTab().mount();
  const entered = deferred(), release = deferred();
  const first = a.mutate(async (state) => {
    entered.resolve(); await release.promise;
    return openDestination(state, 'code', catalog);
  });
  await entered.promise;
  const second = b.mutate((state) => openDestination(state, 'notes', catalog));
  release.resolve(); await Promise.all([first, second]);
  assert.deepEqual(env.read().opened, ['code', 'notes']);
  await a.mutate((state) => {
    toggleSaved(state, 'code', catalog);
    return chooseJourney(state, 'learn', catalog);
  });
  const reset = await b.reset();
  assert.deepEqual(reset, createProgress(null, catalog));
  await a.mutate((state) => toggleSaved(state, 'notes', catalog));
  assert.deepEqual(env.read(), { version: 3, discovered: [], opened: [], saved: ['notes'], activeJourney: null });
});

test('without locks a stale tab starts each mutation from current storage and preserves explicit removals', async (t) => {
  // Passing null deliberately exercises the browser-without-Web-Locks path.
  const noLocks = environment({ locks: null }); t.after(noLocks.destroy);
  const a = noLocks.newTab().mount(), b = noLocks.newTab().mount();
  await a.mutate((state) => toggleSaved(state, 'code', catalog));
  await b.mutate((state) => toggleSaved(state, 'notes', catalog));
  assert.deepEqual(noLocks.read().saved, ['code', 'notes']);
  await a.mutate((state) => toggleSaved(state, 'code', catalog));
  await b.mutate((state) => chooseJourney(state, 'learn', catalog));
  assert.deepEqual(noLocks.read().saved, ['notes']);
  assert.equal(noLocks.read().activeJourney, 'learn');
});

test('storage events read the current matching key without writing, and destroy removes listeners and cancels pending commits', async (t) => {
  const env = environment(); t.after(env.destroy);
  const tab = env.newTab(), store = tab.mount();
  const latest = createProgress(null, catalog);
  openDestination(latest, 'notes', catalog);
  env.writeDirect(latest);
  tab.dispatch('unrelated-key');
  assert.deepEqual(store.getState().opened, []);
  tab.dispatch(KEY, JSON.stringify(createProgress(null, catalog)));
  assert.deepEqual(store.getState().opened, ['notes'], 'a queued event payload must not rewind live storage');
  assert.equal(env.writes(), 0);
  const entered = deferred(), release = deferred();
  const pending = store.mutate(async (state) => { entered.resolve(); await release.promise; return openDestination(state, 'code', catalog); });
  await entered.promise;
  store.destroy(); store.destroy();
  assert.equal(tab.listeners.size, 0);
  const changedBefore = tab.changes.length;
  release.resolve();
  await assert.rejects(pending, /destroyed/);
  await assert.rejects(store.mutate(() => ({})), /destroyed/);
  await assert.rejects(store.reset(), /destroyed/);
  env.writeDirect(createProgress(null, catalog)); tab.dispatch();
  assert.equal(tab.changes.length, changedBefore);
  assert.deepEqual(store.getState().opened, ['notes']);
  assert.equal(env.writes(), 0);
});

test('failed writes retain unsaved actions and later stale reads/events cannot erase memory-only progress', async (t) => {
  const initial = createProgress(null, catalog);
  openDestination(initial, 'code', catalog);
  const env = environment({ initial }); t.after(env.destroy);
  const tab = env.newTab(), store = tab.mount();
  tab.failWrite = true;
  await store.mutate((state) => toggleSaved(state, 'notes', catalog));
  assert.deepEqual(store.getState().saved, ['notes']);
  assert.deepEqual(env.read().saved, []);
  assert.equal(tab.errors.length, 1);
  tab.failWrite = false;
  env.writeDirect(createProgress(null, catalog)); tab.dispatch();
  await store.mutate((state) => chooseJourney(state, 'learn', catalog));
  assert.deepEqual(store.getState(), { version: 3, discovered: ['forge'], opened: ['code'], saved: ['notes'], activeJourney: 'learn' });
  assert.equal(tab.errors.length, 1);
  assert.equal(env.writes(), 0);
  assert.deepEqual(await store.reset(), createProgress(null, catalog));
});

test('read failures report once and still allow ordered in-memory progress', async (t) => {
  const env = environment(); t.after(env.destroy);
  const tab = env.newTab(); tab.failRead = true;
  const store = tab.mount();
  await store.mutate((state) => openDestination(state, 'code', catalog));
  await store.mutate((state) => toggleSaved(state, 'notes', catalog));
  assert.deepEqual(store.getState().opened, ['code']);
  assert.deepEqual(store.getState().saved, ['notes']);
  assert.equal(tab.errors.length, 1);
  assert.equal(env.writes(), 0);
});

test('lock acquisition failures fall back once without being reported as a storage failure', async (t) => {
  const env = environment({ locks: { request: () => Promise.reject(new Error('Locks denied')) } }); t.after(env.destroy);
  const tab = env.newTab(), store = tab.mount();
  let actions = 0;
  await store.mutate((state) => { actions++; return openDestination(state, 'code', catalog); });
  assert.equal(actions, 1);
  assert.deepEqual(env.read().opened, ['code']);
  assert.equal(tab.errors.length, 0);
});
