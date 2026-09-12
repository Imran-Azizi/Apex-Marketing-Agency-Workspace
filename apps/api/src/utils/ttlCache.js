/**
 * Process-local TTL cache with in-flight promise coalescing.
 * Concurrent getOrSet() calls for the same key share one factory run.
 */

export function createTtlCache() {
  const store = new Map();
  const inflight = new Map();

  function get(key) {
    const hit = store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  function set(key, value, ttlMs) {
    const ttl = Math.max(0, Number(ttlMs) || 0);
    store.set(key, { value, expiresAt: Date.now() + ttl });
    return value;
  }

  async function getOrSet(key, ttlMs, factory) {
    const existing = get(key);
    if (existing !== undefined) return existing;
    if (inflight.has(key)) return inflight.get(key);

    const pending = Promise.resolve()
      .then(factory)
      .then((value) => {
        set(key, value, ttlMs);
        inflight.delete(key);
        return value;
      })
      .catch((err) => {
        inflight.delete(key);
        throw err;
      });

    inflight.set(key, pending);
    return pending;
  }

  function invalidate(key) {
    store.delete(key);
    inflight.delete(key);
  }

  function invalidatePrefix(prefix) {
    const needle = String(prefix || "");
    if (!needle) return;
    for (const key of [...store.keys()]) {
      if (key === needle || key.startsWith(needle)) {
        store.delete(key);
        inflight.delete(key);
      }
    }
    for (const key of [...inflight.keys()]) {
      if (key === needle || key.startsWith(needle)) {
        inflight.delete(key);
      }
    }
  }

  function clear() {
    store.clear();
    inflight.clear();
  }

  return { get, set, getOrSet, invalidate, invalidatePrefix, clear };
}
