import {describe, expect, it, vi} from 'vitest';
import {
  AccountSessionError,
  authActionForStatus,
  createAccountSessionClient
} from './session-client';

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json', ...headers}
  });
}

describe('account session transport', () => {
  it('coalesces CSRF acquisition for concurrent mutations', async () => {
    let resolveCsrf!: (response: Response) => void;
    const csrf = new Promise<Response>((resolve) => { resolveCsrf = resolve; });
    const fetcher = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => csrf)
      .mockResolvedValueOnce(jsonResponse({access_token: 'one', expires_in: 900}))
      .mockResolvedValueOnce(jsonResponse({access_token: 'two', expires_in: 900}));
    const client = createAccountSessionClient({fetcher});

    const first = client.issueAccessToken();
    const second = client.issueAccessToken();
    resolveCsrf(jsonResponse({csrf_token: 'csrf'}));

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/csrf-token'))).toHaveLength(1);
  });

  it('clears cached CSRF only for recognized rejection and retries once', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({csrf_token: 'old'}))
      .mockResolvedValueOnce(jsonResponse({error_code: 'ACC_AUTH_CSRF_INVALID'}, 403))
      .mockResolvedValueOnce(jsonResponse({csrf_token: 'new'}))
      .mockResolvedValueOnce(jsonResponse({access_token: 'fresh', expires_in: 900}));

    await expect(createAccountSessionClient({fetcher}).issueAccessToken())
      .resolves.toEqual({accessToken: 'fresh', expiresIn: 900});
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('keeps ordinary 403 forbidden without retry', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({csrf_token: 'csrf'}))
      .mockResolvedValueOnce(jsonResponse({error_code: 'ACC_FORBIDDEN'}, 403));

    await expect(createAccountSessionClient({fetcher}).issueAccessToken())
      .rejects.toMatchObject({status: 403, code: 'ACC_FORBIDDEN'});
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('preserves request and Retry-After metadata', async () => {
    const now = 1_000;
    const client = createAccountSessionClient({
      now: () => now,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(
        {error_code: 'ACC_AUTH_RATE_LIMITED'},
        429,
        {'retry-after': '60', 'x-request-id': 'req-1'}
      ))
    });

    await expect(client.getSession()).rejects.toMatchObject({
      status: 429,
      code: 'ACC_AUTH_RATE_LIMITED',
      requestId: 'req-1',
      retryAt: 61_000
    });
  });

  it('parses HTTP-date Retry-After and bounds invalid 429 responses', async () => {
    const now = Date.parse('2026-09-16T00:00:00Z');
    const dateClient = createAccountSessionClient({
      now: () => now,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 429, {
        'retry-after': 'Wed, 16 Sep 2026 00:02:00 GMT'
      }))
    });
    await expect(dateClient.getSession()).rejects.toMatchObject({retryAt: now + 120_000});

    const fallbackClient = createAccountSessionClient({
      now: () => now,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 429, {'retry-after': 'invalid'}))
    });
    await expect(fallbackClient.getSession()).rejects.toMatchObject({retryAt: now + 60_000});
  });

  it('rejects malformed successful JSON', async () => {
    const client = createAccountSessionClient({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response('{', {
        headers: {'content-type': 'application/json'}
      }))
    });
    await expect(client.getSession()).rejects.toMatchObject({code: 'INVALID_RESPONSE'});
  });
});

describe('auth response classification', () => {
  it('distinguishes refresh, forbidden, cooldown, and other failures', () => {
    expect(authActionForStatus(401)).toBe('refresh-once');
    expect(authActionForStatus(403)).toBe('forbidden');
    expect(authActionForStatus(429)).toBe('cooldown');
    expect(authActionForStatus(503)).toBe('fail');
  });

  it('carries typed metadata', () => {
    expect(new AccountSessionError(429, 'rate', 'limited', {requestId: 'req', retryAt: 2}))
      .toMatchObject({status: 429, code: 'rate', requestId: 'req', retryAt: 2});
  });
});
