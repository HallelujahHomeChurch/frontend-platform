import {describe, expect, it, vi} from 'vitest';
import {AccountSessionError, type AccountSessionClient} from './session-client';
import {createBrowserAccountAuthRuntime} from './browser-runtime';
import {createOAuthTransaction, saveOAuthTransaction} from './oauth';

const user = {id: 'u1', email: 'a@example.test', display_name: 'A', avatar_url: null};
const authenticated = {
  authenticated: true as const,
  user,
  permissions: [] as string[],
  permission_availability: {status: 'available' as const}
};

function client(overrides: Partial<AccountSessionClient> = {}): AccountSessionClient {
  return {
    getSession: vi.fn(async () => authenticated),
    issueAccessToken: vi.fn(async () => ({accessToken: 'access-1', expiresIn: 900})),
    refreshAccessToken: vi.fn(async () => ({accessToken: 'access-2', expiresIn: 900})),
    logout: vi.fn(async () => undefined),
    logoutAll: vi.fn(async () => undefined),
    ...overrides
  };
}

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); }
  };
}

describe('browser account auth runtime', () => {
  it('transitions from checking without putting tokens in snapshots', async () => {
    const runtime = createBrowserAccountAuthRuntime({client: client()});
    expect(runtime.getSnapshot()).toEqual({status: 'checking'});

    await expect(runtime.start()).resolves.toMatchObject({
      status: 'authenticated',
      session: {permissions: []}
    });
    await expect(runtime.getAccessToken()).resolves.toBe('access-1');
    expect(JSON.stringify(runtime.getSnapshot())).not.toContain('access-1');
    runtime.dispose();
  });

  it('coalesces issuance and reuses a token until 30 seconds before expiry', async () => {
    let now = 1_000;
    const account = client();
    const runtime = createBrowserAccountAuthRuntime({client: account, now: () => now});

    const [first, second] = await Promise.all([runtime.getAccessToken(), runtime.getAccessToken()]);
    expect(first).toBe(second);
    expect(account.issueAccessToken).toHaveBeenCalledOnce();

    now += 869_000;
    await expect(runtime.getAccessToken()).resolves.toBe('access-1');
    now += 1_001;
    await expect(runtime.getAccessToken()).resolves.toBe('access-1');
    expect(account.issueAccessToken).toHaveBeenCalledTimes(2);
  });

  it('does not install a late token after clear', async () => {
    let resolve!: (value: {accessToken: string; expiresIn: number}) => void;
    const pending = new Promise<{accessToken: string; expiresIn: number}>((next) => { resolve = next; });
    const issueAccessToken = vi.fn()
      .mockImplementationOnce(() => pending)
      .mockResolvedValue({accessToken: 'access-1', expiresIn: 900});
    const runtime = createBrowserAccountAuthRuntime({client: client({issueAccessToken})});

    const request = runtime.getAccessToken();
    runtime.clear();
    resolve({accessToken: 'late-token', expiresIn: 900});

    await expect(request).resolves.toBeNull();
    await expect(runtime.getAccessToken()).resolves.toBe('access-1');
  });

  it('returns a newer token without refreshing a stale rejection', async () => {
    const account = client();
    const runtime = createBrowserAccountAuthRuntime({client: account});
    await runtime.getAccessToken();
    await runtime.refreshAfterUnauthorized('access-1');

    await expect(runtime.refreshAfterUnauthorized('access-1')).resolves.toBe('access-2');
    expect(account.refreshAccessToken).toHaveBeenCalledOnce();
  });

  it('coalesces refresh for the same rejected token', async () => {
    const account = client();
    const runtime = createBrowserAccountAuthRuntime({client: account});
    await runtime.getAccessToken();

    await expect(Promise.all([
      runtime.refreshAfterUnauthorized('access-1'),
      runtime.refreshAfterUnauthorized('access-1')
    ])).resolves.toEqual(['access-2', 'access-2']);
    expect(account.refreshAccessToken).toHaveBeenCalledOnce();
  });

  it('honors a persisted 429 cooldown without another issuance', async () => {
    let now = 1_000;
    const retryAt = 61_000;
    const account = client({
      issueAccessToken: vi.fn(async () => { throw new AccountSessionError(429, 'ACC_AUTH_RATE_LIMITED', 'limited', {retryAt}); })
    });
    const runtimeStorage = storage();
    const runtime = createBrowserAccountAuthRuntime({client: account, now: () => now, storage: runtimeStorage});

    await expect(runtime.getAccessToken()).rejects.toMatchObject({status: 429, retryAt});
    await expect(runtime.getAccessToken()).rejects.toMatchObject({status: 429, retryAt});
    expect(account.issueAccessToken).toHaveBeenCalledOnce();

    now = retryAt + 1;
    await expect(runtime.getAccessToken()).rejects.toMatchObject({status: 429});
    expect(account.issueAccessToken).toHaveBeenCalledTimes(2);
  });

  it('coalesces revalidation and preserves permission-unavailable as authenticated', async () => {
    const account = client({getSession: vi.fn(async () => ({
      ...authenticated,
      permission_availability: {
        status: 'unavailable' as const,
        code: 'permission_unavailable' as const,
        request_id: 'req-1'
      }
    }))});
    const runtime = createBrowserAccountAuthRuntime({client: account});

    await expect(Promise.all([runtime.revalidate(), runtime.revalidate()])).resolves.toEqual([
      expect.objectContaining({status: 'authenticated'}),
      expect.objectContaining({status: 'authenticated'})
    ]);
    expect(account.getSession).toHaveBeenCalledOnce();
    expect(runtime.getSnapshot()).toMatchObject({
      status: 'authenticated',
      session: {permissions: [], permissionAvailability: {status: 'unavailable'}}
    });
  });

  it('emits sanitized events only', async () => {
    const events: unknown[] = [];
    const runtime = createBrowserAccountAuthRuntime({client: client(), onEvent: (event) => events.push(event)});
    await runtime.start();
    await runtime.getAccessToken();

    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain('a@example.test');
    expect(serialized).not.toContain('u1');
    expect(serialized).not.toContain('access-1');
    expect(events).toContainEqual(expect.objectContaining({stage: 'session', outcome: 'succeeded'}));
    expect(events).toContainEqual(expect.objectContaining({stage: 'access_token', outcome: 'succeeded'}));
  });

  it('uses the configured Account authorization server for a hosted sign-in', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', {href: 'https://www.alive.org.tw/zh-Hant', assign});
    const runtime = createBrowserAccountAuthRuntime({
      client: client(),
      storage: storage(),
      oauth: {
        authorizeBaseUrl: 'https://account.alive.org.tw/api/account/v1',
        clientId: 'www-web',
        redirectUri: 'https://www.alive.org.tw/oauth/callback',
        scope: 'openid profile email'
      }
    });

    await runtime.beginSignIn('/zh-Hant');

    const destination = new URL(assign.mock.calls[0][0]);
    expect(destination.origin).toBe('https://account.alive.org.tw');
    expect(destination.pathname).toBe('/api/account/v1/oauth/authorize');
    expect(destination.searchParams.get('client_id')).toBe('www-web');
    expect(destination.searchParams.get('redirect_uri')).toBe('https://www.alive.org.tw/oauth/callback');
    vi.unstubAllGlobals();
  });

  it('forwards prompt=none for a silent hosted sign-in', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', {href: 'https://www.alive.org.tw/zh-Hant', assign});
    const runtime = createBrowserAccountAuthRuntime({
      client: client(),
      storage: storage(),
      oauth: {
        authorizeBaseUrl: 'https://account.alive.org.tw/api/account/v1',
        clientId: 'www-web',
        redirectUri: 'https://www.alive.org.tw/oauth/callback',
        scope: 'openid profile email'
      }
    });

    await runtime.beginSignIn('/zh-Hant', {prompt: 'none'});

    expect(new URL(assign.mock.calls[0][0]).searchParams.get('prompt')).toBe('none');
    vi.unstubAllGlobals();
  });

  it('completes an exact hosted callback and clears the transaction', async () => {
    const runtimeStorage = storage();
    const transaction = await createOAuthTransaction('/content', {
      randomBytes: () => new Uint8Array(32).fill(7),
      now: () => 1_000
    });
    saveOAuthTransaction(transaction, {
      storage: runtimeStorage,
      storageKey: 'hhc:oauth:admin-web'
    });
    vi.stubGlobal('location', {
      href: `https://admin.alive.org.tw/oauth/callback?code=code-1&state=${transaction.state}`,
      assign: vi.fn()
    });
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      access_token: 'callback-access',
      expires_in: 900
    }), {headers: {'content-type': 'application/json'}})));
    const runtime = createBrowserAccountAuthRuntime({
      client: client(),
      now: () => 1_000,
      storage: runtimeStorage,
      oauth: {
        authorizeBaseUrl: 'https://account.alive.org.tw/api/account/v1',
        clientId: 'admin-web',
        redirectUri: 'https://admin.alive.org.tw/oauth/callback',
        scope: 'openid profile email'
      }
    });

    await expect(runtime.completeSignIn()).resolves.toMatchObject({status: 'authenticated'});
    await expect(runtime.getAccessToken()).resolves.toBe('callback-access');
    expect(fetch).toHaveBeenCalledWith('https://account.alive.org.tw/api/account/v1/oauth/token', expect.anything());
    expect(runtimeStorage.getItem('hhc:oauth:admin-web')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('revalidates after a callback instead of reusing a pre-exchange anonymous check', async () => {
    let resolveInitialSession!: (value: {authenticated: false}) => void;
    const initialSession = new Promise<{authenticated: false}>((resolve) => { resolveInitialSession = resolve; });
    const getSession = vi.fn()
      .mockImplementationOnce(() => initialSession)
      .mockResolvedValue(authenticated);
    const runtimeStorage = storage();
    const transaction = await createOAuthTransaction('/content', {
      randomBytes: () => new Uint8Array(32).fill(7),
      now: () => 1_000
    });
    saveOAuthTransaction(transaction, {
      storage: runtimeStorage,
      storageKey: 'hhc:oauth:admin-web'
    });
    vi.stubGlobal('location', {
      href: `https://admin.alive.org.tw/oauth/callback?code=code-1&state=${transaction.state}`,
      assign: vi.fn()
    });
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      access_token: 'callback-access',
      expires_in: 900
    }), {headers: {'content-type': 'application/json'}})));
    const runtime = createBrowserAccountAuthRuntime({
      client: client({getSession}),
      now: () => 1_000,
      storage: runtimeStorage,
      oauth: {
        tokenBaseUrl: '/api/account/v1',
        clientId: 'admin-web',
        redirectUri: 'https://admin.alive.org.tw/oauth/callback',
        scope: 'openid profile email'
      }
    });

    const startup = runtime.start();
    const callback = runtime.completeSignIn();
    resolveInitialSession({authenticated: false});

    await expect(startup).resolves.toEqual({status: 'anonymous'});
    await expect(callback).resolves.toMatchObject({status: 'authenticated'});
    expect(getSession).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it('uses a product-local endpoint for a hosted authorization code exchange', async () => {
    const runtimeStorage = storage();
    const transaction = await createOAuthTransaction('/content', {
      randomBytes: () => new Uint8Array(32).fill(7),
      now: () => 1_000
    });
    saveOAuthTransaction(transaction, {
      storage: runtimeStorage,
      storageKey: 'hhc:oauth:admin-web'
    });
    vi.stubGlobal('location', {
      href: `https://admin.alive.org.tw/oauth/callback?code=code-1&state=${transaction.state}`,
      assign: vi.fn()
    });
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      access_token: 'callback-access',
      expires_in: 900
    }), {headers: {'content-type': 'application/json'}})));
    const runtime = createBrowserAccountAuthRuntime({
      client: client(),
      now: () => 1_000,
      storage: runtimeStorage,
      oauth: {
        authorizeBaseUrl: 'https://account.alive.org.tw/api/account/v1',
        tokenBaseUrl: '/api/account/v1',
        clientId: 'admin-web',
        redirectUri: 'https://admin.alive.org.tw/oauth/callback',
        scope: 'openid profile email'
      }
    });

    await expect(runtime.completeSignIn()).resolves.toMatchObject({status: 'authenticated'});
    expect(fetch).toHaveBeenCalledWith('https://admin.alive.org.tw/api/account/v1/oauth/token', expect.anything());
    vi.unstubAllGlobals();
  });

  it('rejects a callback on another path without exchanging a code', async () => {
    const runtimeStorage = storage();
    vi.stubGlobal('location', {
      href: 'https://admin.alive.org.tw/wrong?code=code-1&state=state-1',
      assign: vi.fn()
    });
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    const runtime = createBrowserAccountAuthRuntime({
      client: client(),
      storage: runtimeStorage,
      oauth: {
        clientId: 'admin-web',
        redirectUri: 'https://admin.alive.org.tw/oauth/callback',
        scope: 'openid profile email'
      }
    });

    await expect(runtime.completeSignIn()).rejects.toMatchObject({code: 'OAUTH_CALLBACK_MISMATCH'});
    expect(fetcher).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
