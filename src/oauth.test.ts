import {describe, expect, it} from 'vitest';
import {
  buildAuthorizeUrl,
  createCodeChallenge,
  createOAuthTransaction,
  currentReturnTo,
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
});
