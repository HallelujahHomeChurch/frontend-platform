/** Display hints only. Never use these IDs to authorize a route, request, or action. */
export type NavigationSource = 'account' | 'operations' | 'resources';
type Projection = {ids: readonly string[]; verifiedAt: number};
export type NavigationPresentation = {
  ready: boolean;
  subjectId: string | null;
  sources: Partial<Record<NavigationSource, Projection>>;
};
export const emptyNavigationPresentation: NavigationPresentation = {ready: false, subjectId: null, sources: {}};
export const navigationPresentationTTL = 7 * 24 * 60 * 60 * 1_000;
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createNavigationPresentation({key, allowedIds, storage = browserStorage(), now = Date.now}: {
  key: string;
  allowedIds: readonly string[];
  storage?: StorageLike;
  now?: () => number;
}) {
  const epochKey = `${key}:epoch`;
  const allowed = new Set(allowedIds);
  const listeners = new Set<() => void>();
  const invalidations = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let epoch: string | null = null;
  epoch = read(epochKey);
  let state = parse(read(key));
  if (hasSignedOutHint()) invalidate(false);

  function read(name: string): string | null {
    try { return storage ? storage.getItem(name) : name === epochKey ? epoch : null; } catch { return name === epochKey ? epoch : null; }
  }
  function parse(raw: string | null): NavigationPresentation {
    const empty = {ready: true, subjectId: null, sources: {}};
    try {
      const data = JSON.parse(raw ?? 'null');
      if (data?.version !== 1 || typeof data.subjectId !== 'string' || !data.subjectId || !data.sources) return empty;
      const sources: NavigationPresentation['sources'] = {};
      for (const source of ['account', 'operations', 'resources'] as const) {
        const value = data.sources[source];
        if (!value) continue;
        if (!Number.isFinite(value.verifiedAt) || value.verifiedAt > now() || value.verifiedAt <= now() - navigationPresentationTTL
          || !Array.isArray(value.ids) || !value.ids.every((id: unknown) => typeof id === 'string' && allowed.has(id))) continue;
        sources[source] = {ids: [...new Set<string>(value.ids)], verifiedAt: value.verifiedAt};
      }
      return {ready: true, subjectId: Object.keys(sources).length ? data.subjectId : null, sources};
    } catch { return empty; }
  }
  function publish(next: NavigationPresentation) {
    state = next;
    scheduleExpiry();
    for (const listener of listeners) listener();
  }
  function scheduleExpiry() {
    clearTimeout(timer);
    if (!listeners.size) return;
    const times = Object.values(state.sources).map(value => value.verifiedAt + navigationPresentationTTL);
    if (times.length) timer = setTimeout(() => publish(parse(JSON.stringify({version: 1, ...state}))), Math.max(0, Math.min(...times) - now()));
  }
  function invalidate(notify = true) {
    generation += 1;
    // A separate epoch fences writes even before another tab processes its storage event.
    epoch = `${now()}:${Math.random()}`;
    try { storage?.setItem(epochKey, epoch); storage?.removeItem(key); } catch { /* Memory-only operation still works. */ }
    publish({ready: true, subjectId: null, sources: {}});
    if (notify) for (const listener of invalidations) listener();
  }
  function sync() {
    const nextEpoch = read(epochKey);
    if (nextEpoch !== epoch) {
      epoch = nextEpoch;
      generation += 1;
      publish({ready: true, subjectId: null, sources: {}});
      for (const listener of invalidations) listener();
    }
  }
  function onStorage(event: StorageEvent) {
    if (event.key !== key && event.key !== epochKey && event.key !== null) return;
    sync();
    // Other tabs may update display hints, but never establish verified identity here.
    publish(parse(read(key)));
  }
  function onActivity() {
    if (hasSignedOutHint()) {
      if (state.subjectId) invalidate();
    } else {
      sync();
      publish(parse(JSON.stringify({version: 1, ...state})));
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1 && typeof window !== 'undefined') {
        window.addEventListener('storage', onStorage);
        window.addEventListener('focus', onActivity);
        window.addEventListener('pageshow', onActivity);
        document.addEventListener('visibilitychange', onActivity);
      }
      scheduleExpiry();
      return () => {
        listeners.delete(listener);
        if (!listeners.size) clearTimeout(timer);
        if (!listeners.size && typeof window !== 'undefined') {
          window.removeEventListener('storage', onStorage);
          window.removeEventListener('focus', onActivity);
          window.removeEventListener('pageshow', onActivity);
          document.removeEventListener('visibilitychange', onActivity);
        }
      };
    },
    onInvalidate(listener: () => void) {
      invalidations.add(listener);
      return () => { invalidations.delete(listener); };
    },
    identify(subjectId: string) {
      sync();
      if (state.subjectId && state.subjectId !== subjectId) invalidate(false);
      if (state.subjectId !== subjectId) publish({ready: true, subjectId, sources: {}});
    },
    /** Capture after verified identity, before starting the source's asynchronous request. */
    capture(subjectId: string) {
      const requestGeneration = generation;
      const requestEpoch = epoch;
      return (source: NavigationSource, ids: readonly string[]) => {
        sync();
        if (requestGeneration !== generation || requestEpoch !== epoch || state.subjectId !== subjectId || hasSignedOutHint()) return false;
        if (!ids.every(id => allowed.has(id))) return false;
        const stored = parse(read(key));
        const sources = stored.subjectId === subjectId ? {...state.sources, ...stored.sources} : state.sources;
        const next = {ready: true, subjectId, sources: {...sources, [source]: {ids: [...new Set(ids)], verifiedAt: now()}}};
        try { storage?.setItem(key, JSON.stringify({version: 1, subjectId, sources: next.sources})); } catch { /* Keep live display without persistence. */ }
        publish(next);
        return true;
      };
    },
    clear() {
      // Do not echo invalidation events between tabs.
      if (state.subjectId || read(key)) invalidate(false);
      else { generation += 1; publish({ready: true, subjectId: null, sources: {}}); }
    }
  };
}
export type NavigationPresentationStore = ReturnType<typeof createNavigationPresentation>;

function browserStorage(): StorageLike | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; }
}
function hasSignedOutHint(): boolean {
  return typeof document !== 'undefined' && (document.cookie.split(';').some(value => value.trim() === 'hhc_sso_hint=0')
    || (typeof location !== 'undefined' && new URLSearchParams(location.search).get('signed_out') === '1'));
}
