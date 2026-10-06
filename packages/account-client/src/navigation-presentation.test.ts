import {afterEach, describe, expect, it, vi} from 'vitest';
import {createNavigationPresentation, navigationPresentationTTL as ttl} from './navigation-presentation';

function memory() {
  const data = new Map<string, string>();
  return {getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => {data.set(key, value);}, removeItem: (key: string) => {data.delete(key);}};
}
afterEach(() => {vi.useRealTimers(); vi.unstubAllGlobals();});

describe('navigation presentation, never authorization', () => {
  it('synchronizes invalidation without restoring verified identity from a different tab update', () => {
    const browser = new EventTarget();
    vi.stubGlobal('window', browser);
    vi.stubGlobal('document', Object.assign(new EventTarget(), {cookie: ''}));
    const storage = memory();
    const options = {key: 'nav', allowedIds: ['admin'], storage};
    const first = createNavigationPresentation(options);
    first.identify('a'); first.capture('a')('account', ['admin']);
    const other = createNavigationPresentation(options);
    const invalidate = vi.fn();
    const stop = first.subscribe(vi.fn());
    first.onInvalidate(invalidate);
    other.clear();
    const event = Object.assign(new Event('storage'), {key: 'nav:epoch'});
    browser.dispatchEvent(event);
    expect(first.getSnapshot().subjectId).toBeNull();
    expect(invalidate).toHaveBeenCalledOnce();
    other.identify('b'); other.capture('b')('account', ['admin']);
    browser.dispatchEvent(Object.assign(new Event('storage'), {key: 'nav'}));
    expect(first.getSnapshot().subjectId).toBe('b');
    expect(invalidate).toHaveBeenCalledOnce();
    stop();
  });

  it('restores IDs without identity fields and renews only the successfully verified source', () => {
    const storage = memory();
    let now = 1_000;
    const options = {key: 'nav', allowedIds: ['admin', 'bulletin'], storage, now: () => now};
    const first = createNavigationPresentation(options);
    first.identify('a');
    first.capture('a')('account', ['admin']);
    first.capture('a')('operations', ['bulletin']);
    now += ttl - 100;
    const revisit = createNavigationPresentation(options);
    expect(revisit.getSnapshot().sources.operations?.ids).toEqual(['bulletin']);
    revisit.identify('a');
    revisit.capture('a')('account', ['admin']);
    now += 101;
    const later = createNavigationPresentation(options);
    expect(later.getSnapshot().sources.account?.ids).toEqual(['admin']);
    expect(later.getSnapshot().sources.operations).toBeUndefined();
    later.capture('a')('operations', []);
    expect(later.getSnapshot().sources.operations?.ids).toEqual([]);
    expect(Object.keys(JSON.parse(storage.getItem('nav')!)).sort()).toEqual(['sources', 'subjectId', 'version']);
  });

  it('fences late writes after same-tab logout, account switch, and another tab logout before its event', () => {
    const storage = memory();
    const options = {key: 'nav', allowedIds: ['bulletin'], storage};
    const first = createNavigationPresentation(options);
    first.identify('a');
    first.capture('a')('operations', ['bulletin']);
    const late = first.capture('a');
    const other = createNavigationPresentation(options);
    other.clear();
    expect(late('operations', ['bulletin'])).toBe(false);
    first.identify('b');
    expect(first.getSnapshot().sources).toEqual({});
    expect(late('account', ['bulletin'])).toBe(false);
    const newWork = first.capture('b');
    first.clear();
    expect(newWork('account', ['bulletin'])).toBe(false);
  });

  it.each(['{', '{"version":99}', JSON.stringify({version: 1, subjectId: 'a', sources: {account: {ids: ['unknown'], verifiedAt: 500}}}), JSON.stringify({version: 1, subjectId: 'a', sources: {account: {ids: ['admin'], verifiedAt: 2_000}}})])('ignores malformed, unknown, or future data: %s', raw => {
    const storage = memory(); storage.setItem('nav', raw);
    expect(createNavigationPresentation({key: 'nav', allowedIds: ['admin'], storage, now: () => 1_000}).getSnapshot().subjectId).toBeNull();
  });

  it('continues in memory when storage is unavailable', () => {
    const fail = () => {throw new Error('blocked');};
    const store = createNavigationPresentation({key: 'nav', allowedIds: ['admin'], storage: {getItem: fail, setItem: fail, removeItem: fail}});
    store.identify('a');
    expect(store.capture('a')('account', ['admin'])).toBe(true);
    expect(store.getSnapshot().sources.account?.ids).toEqual(['admin']);
  });

  it('expires mounted display and does not renew just because it was read', () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000);
    const store = createNavigationPresentation({key: 'nav', allowedIds: ['admin'], storage: memory()});
    const stop = store.subscribe(vi.fn());
    store.identify('a'); store.capture('a')('account', ['admin']);
    vi.advanceTimersByTime(ttl);
    expect(store.getSnapshot().subjectId).toBeNull();
    stop();
  });

  it('rejects snapshots before render when the shared sign-out hint is present', () => {
    const storage = memory();
    const first = createNavigationPresentation({key: 'nav', allowedIds: ['admin'], storage});
    first.identify('a'); first.capture('a')('account', ['admin']);
    vi.stubGlobal('document', {cookie: 'hhc_sso_hint=0'});
    expect(createNavigationPresentation({key: 'nav', allowedIds: ['admin'], storage}).getSnapshot().subjectId).toBeNull();
  });
});
