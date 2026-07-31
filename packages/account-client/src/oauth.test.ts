import {describe, expect, it} from 'vitest';
import {
  buildAuthorizeUrl,
  createCodeChallenge,
  createOAuthTransaction,
  currentReturnTo,
  exchangeAuthorizationCode,
  readOAuthTransaction,
  safeReturnTo,
  validateOAuthState
} from './oauth';

function storageWith(value?: string): Storage {
  const values = new Map<string, string>();
  if (value) values.set('oauth', value);
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, next) => { values.set(key, next); }
  };
}

describe('browser OAuth helpers', () => {
  it('creates an S256 code challenge', async () => {
    const challenge = await createCodeChallenge('test-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).not.toContain('=');
  });

  it('preserves pathname, search, and hash for the return path', () => {
    expect(currentReturnTo({pathname: '/users', search: '?page=2', hash: '#details'}))
      .toBe('/users?page=2#details');
    expect(safeReturnTo('//evil.example/path')).toBe('/');
    expect(safeReturnTo('https://evil.example/path')).toBe('/');
  });

  it('rejects expired transactions and mismatched state', async () => {
    const transaction = await createOAuthTransaction('/users', {
      randomBytes: () => new Uint8Array(32).fill(7),
      now: () => 1_000
    });
    const storage = storageWith(JSON.stringify(transaction));

    expect(readOAuthTransaction({storage, storageKey: 'oauth', now: () => 601_001})).toBeNull();
    expect(storage.getItem('oauth')).toBeNull();
    expect(validateOAuthState(transaction, 'wrong-state')).toBe(false);
    expect(validateOAuthState(transaction, transaction.state)).toBe(true);
  });

  it('builds prompt=none authorization requests', async () => {
    const transaction = await createOAuthTransaction('/', {
      randomBytes: () => new Uint8Array(32).fill(3)
    });
    const url = buildAuthorizeUrl({
      authorizeBaseUrl: 'https://account.alive.org.tw/api/account/v1',
      clientId: 'www-web',
      redirectUri: 'https://www.alive.org.tw/oauth/callback',
      scope: 'openid profile email'
    }, transaction, {prompt: 'none'});

    expect(url.searchParams.get('prompt')).toBe('none');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('exchanges an authorization code with the PKCE transaction', async () => {
    const transaction = await createOAuthTransaction('/users', {
      randomBytes: () => new Uint8Array(32).fill(4)
    });
    const requests: Array<{input: RequestInfo | URL; init?: RequestInit}> = [];
    const fetcher: typeof fetch = async (input, init) => {
      requests.push({input, init});
      return new Response(JSON.stringify({
        access_token: 'access-token',
        token_type: 'Bearer',
        expires_in: 900
      }), {headers: {'content-type': 'application/json'}});
    };

    const response = await exchangeAuthorizationCode({
      authorizeBaseUrl: 'https://account.alive.org.tw/api/account/v1',
      clientId: 'admin-web',
      redirectUri: 'https://admin.alive.org.tw/oauth/callback',
      scope: 'openid profile email'
    }, transaction, 'authorization-code', fetcher);

    expect(response).toEqual({
      access_token: 'access-token',
      token_type: 'Bearer',
      expires_in: 900
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.input).toBe('https://account.alive.org.tw/api/account/v1/oauth/token');
    expect(requests[0]?.init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: {'content-type': 'application/x-www-form-urlencoded'}
    });
    expect(new URLSearchParams(requests[0]?.init?.body as string)).toEqual(new URLSearchParams({
      grant_type: 'authorization_code',
      code: 'authorization-code',
      client_id: 'admin-web',
      redirect_uri: 'https://admin.alive.org.tw/oauth/callback',
      code_verifier: transaction.codeVerifier
    }));
  });

  it('throws when authorization-code exchange is rejected', async () => {
    const transaction = await createOAuthTransaction('/', {
      randomBytes: () => new Uint8Array(32).fill(5)
    });
    const fetcher: typeof fetch = async () => new Response(
      JSON.stringify({error: 'invalid_grant'}),
      {status: 400, headers: {'content-type': 'application/json'}}
    );

    await expect(exchangeAuthorizationCode({
      authorizeBaseUrl: '/api/account/v1',
      clientId: 'account-console',
      redirectUri: 'https://account.alive.org.tw/oauth/callback',
      scope: 'openid profile email'
    }, transaction, 'expired-code', fetcher)).rejects.toThrow('OAuth token exchange failed (400)');
  });

  it('rejects a malformed successful token response', async () => {
    const transaction = await createOAuthTransaction('/', {
      randomBytes: () => new Uint8Array(32).fill(6)
    });
    const fetcher: typeof fetch = async () => new Response(
      JSON.stringify({token_type: 'Bearer'}),
      {headers: {'content-type': 'application/json'}}
    );

    await expect(exchangeAuthorizationCode({
      authorizeBaseUrl: '/api/account/v1',
      clientId: 'account-console',
      redirectUri: 'https://account.alive.org.tw/oauth/callback',
      scope: 'openid profile email'
    }, transaction, 'authorization-code', fetcher)).rejects.toThrow('OAuth token exchange returned an invalid response');
  });
});
