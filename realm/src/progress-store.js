import { createProgress, snapshotProgress, resetProgress } from './journey-state.js';

/**
 * Browser persistence for atlas progress. There are no timers or passive writes.
 *
 * getState() returns a copy. mutate(fn) passes a private, validated candidate to
 * a synchronous or asynchronous callback, commits actual changes, and returns
 * the callback's result. Calls in one tab are queued; Web Locks serialize the
 * entire read/mutate/write between cooperating tabs when available. Without
 * Web Locks, each mutation still starts from current storage, but simultaneous
 * cross-tab writes cannot be made fully atomic with localStorage alone.
 *
 * An I/O failure switches this instance to memory-only mode and reports once.
 * This prevents a later stale stored value from erasing an unsaved action.
 * Reloading creates a new instance that can try browser storage again.
 */
export function createProgressStore({
  catalog,
  storageKey = 'hadesrealm.atlas.v3',
  onChange,
  onStorageError,
} = {}) {
  if (typeof storageKey !== 'string' || !storageKey) throw new TypeError('A nonempty progress storage key is required.');

  let state = createProgress(null, catalog);
  let storage;
  let locks;
  let memoryOnly = false;
  let storageErrorReported = false;
  let destroyed = false;
  let queue = Promise.resolve();
  const eventTarget = globalThis.window || globalThis;
  const serialized = (value) => JSON.stringify(snapshotProgress(value));

  function storageFailed(error) {
    memoryOnly = true;
    if (storageErrorReported) return;
    storageErrorReported = true;
    // A broken warning handler must not make in-memory progress unusable.
    try { if (typeof onStorageError === 'function') onStorageError(error); } catch { /* Keep progress usable. */ }
  }

  function readLatest() {
    if (memoryOnly) return snapshotProgress(state);
    try { return createProgress(storage.getItem(storageKey), catalog); }
    catch (error) { storageFailed(error); return snapshotProgress(state); }
  }

  function publish(next) {
    if (destroyed || serialized(next) === serialized(state)) return;
    state = next;
    if (typeof onChange === 'function') onChange(snapshotProgress(state));
  }

  function ensureActive() {
    if (destroyed) throw new Error('The progress store has been destroyed.');
  }

  try {
    storage = globalThis.localStorage;
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
      throw new Error('Browser storage is unavailable.');
    }
    state = readLatest();
  } catch (error) { storageFailed(error); }
  try { locks = globalThis.navigator?.locks; } catch { /* Use current-storage fallback. */ }

  async function withLock(work) {
    if (typeof locks?.request !== 'function') return work();
    let entered = false;
    try {
      return await locks.request(storageKey, () => { entered = true; return work(); });
    } catch (error) {
      // Only fall back when acquiring the lock failed. Never run a rejected
      // mutator twice or mistake its exception for unavailable browser locks.
      if (entered) throw error;
      locks = null;
      return work();
    }
  }

  function mutate(mutatorFn) {
    if (typeof mutatorFn !== 'function') return Promise.reject(new TypeError('A progress mutator function is required.'));
    if (destroyed) return Promise.reject(new Error('The progress store has been destroyed.'));

    const work = async () => {
      ensureActive();
      const base = readLatest();
      const candidate = snapshotProgress(base);
      let result = mutatorFn(candidate);
      // Keep synchronous callbacks in one uninterrupted job, including in the
      // no-lock fallback; asynchronous callbacks retain the acquired lock.
      if (result && typeof result.then === 'function') result = await result;
      ensureActive();
      const next = createProgress(candidate, catalog);
      if (serialized(next) !== serialized(base) && !memoryOnly) {
        try { storage.setItem(storageKey, serialized(next)); }
        catch (error) { storageFailed(error); }
      }
      publish(next);
      return result;
    };

    const pending = queue.then(() => withLock(work));
    queue = pending.catch(() => {});
    return pending;
  }

  function reset() {
    return mutate((candidate) => {
      Object.assign(candidate, resetProgress(catalog));
      return snapshotProgress(candidate);
    });
  }

  function onStorage(event) {
    if (destroyed || memoryOnly || event.key !== storageKey) return;
    if (event.storageArea && event.storageArea !== storage) return;
    // Event payloads may be queued/outdated. The current key is authoritative.
    publish(readLatest());
  }

  eventTarget.addEventListener?.('storage', onStorage);

  return {
    getState: () => snapshotProgress(state),
    mutate,
    reset,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      eventTarget.removeEventListener?.('storage', onStorage);
    },
  };
}
