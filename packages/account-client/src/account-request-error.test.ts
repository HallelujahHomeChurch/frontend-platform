import {afterEach, describe, expect, it, vi} from 'vitest';
import {AccountSessionError as PublicError, accountResponseMetadata as publicMetadata} from './index.js';
import {AccountSessionError, accountResponseMetadata} from './session-client.js';
import {AccountSessionError as LeafError} from './account-request-error.js';
import {createAccountDataRequestsClient} from './data-requests.js';
import {createAccountLegalClient} from './legal.js';

const now = Date.UTC(2026, 9, 25, 12);

afterEach(() => {
  vi.doUnmock('./session-client.js');
  vi.resetModules();
});

describe('public Account request error contract', () => {
  it('preserves one public constructor and all error fields', () => {
    expect(PublicError).toBe(AccountSessionError);
    expect(PublicError).toBe(LeafError);
    expect(publicMetadata).toBe(accountResponseMetadata);
    const metadata = {requestId: 'req-1', retryAt: now, retryAfter: '60', serverTime: '2026-10-25T12:00:00Z', endpoint: 'oauth_token' as const, method: 'POST', decodeStage: 'schema' as const};
    const error = new AccountSessionError(429, 'ACC_AUTH_RATE_LIMITED', 'limited', metadata);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PublicError);
    expect(error.name).toBe('AccountSessionError');
    expect(error.message).toBe('limited');
    expect({...error}).toEqual({name: 'AccountSessionError', status: 429, code: 'ACC_AUTH_RATE_LIMITED', ...metadata});
    expect(new PublicError(503).message).toBe('Account session request failed');
  });

  it.each([
    ['0', now], [' 2 ', now + 2_000],
    [new Date(now + 120_000).toUTCString(), now + 120_000],
    [new Date(now - 1_000).toUTCString(), now + 60_000],
    ['invalid', now + 60_000], [null, now + 60_000]
  ])('preserves 429 Retry-After parsing for %s', (value, retryAt) => {
    const headers: HeadersInit = value === null ? {} : {'retry-after': value};
    expect(accountResponseMetadata(new Response(null, {status: 429, headers}), now).retryAt).toBe(retryAt);
    expect(accountResponseMetadata(new Response(null, {status: 503, headers}), now).retryAt).toBeUndefined();
  });

  it('preserves request-id precedence, validation, and raw retry header', () => {
    const metadata = (headers: HeadersInit) => accountResponseMetadata(new Response(null, {headers}), now);
    expect(metadata({'x-hhc-request-id': 'primary:1', 'x-request-id': 'fallback', 'retry-after': '7'}))
      .toEqual({requestId: 'primary:1', retryAfter: '7', retryAt: undefined});
    expect(metadata({'x-request-id': 'fallback_1'}).requestId).toBe('fallback_1');
    expect(metadata({'x-hhc-request-id': 'invalid=value', 'x-request-id': 'fallback'}).requestId).toBeUndefined();
    expect(metadata({'x-request-id': 'a'.repeat(128)}).requestId).toHaveLength(128);
    expect(metadata({'x-request-id': 'a'.repeat(129)}).requestId).toBeUndefined();
  });

  it('keeps capability failures recognizable by the consumer error constructor', async () => {
    await expect(createAccountDataRequestsClient(async () => ({})).catalog()).rejects.toBeInstanceOf(PublicError);
    await expect(createAccountLegalClient(async () => ({})).status('en')).rejects.toBeInstanceOf(PublicError);
  });

  it('loads independent Account capabilities without loading session transport', async () => {
    vi.resetModules();
    vi.doMock('./session-client.js', () => {throw new Error('Independent capability imported session transport');});
    for (const load of [() => import('./data-requests.js'), () => import('./oauth.js'), () => import('./legal.js')]) {
      await expect(load()).resolves.toBeDefined();
    }
  });
});
