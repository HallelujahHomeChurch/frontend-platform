import {describe, expect, it, vi} from 'vitest';
import {
  AccountSessionError,
  createAccountSessionClient,
  createRefreshCoordinator,
  resolveAccountAuth,
  retrySupersededRefresh
} from './index';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});
}

describe('account session client', () => {
  it('loads the cookie-backed session without calling refresh', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      authenticated: true,
      user: {id: 'u1', email: 'ada@example.com', display_name: 'Ada', avatar_url: null}
    }));
    const client = createAccountSessionClient({fetcher});

    await expect(client.getSession()).resolves.toMatchObject({authenticated: true});
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith('/api/account/v1/session', expect.objectContaining({
      cache: 'no-store',
      credentials: 'include',
      method: 'GET'
    }));
  });

  it('gets a CSRF token before current-device global logout', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({csrf_token: 'csrf-123'}))
      .mockResolvedValueOnce(jsonResponse({message: 'Logged out'}));
    const client = createAccountSessionClient({fetcher});

    await client.logoutAll();

    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/account/v1/csrf-token', expect.objectContaining({
      credentials: 'include',
      method: 'GET'
    }));
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/account/v1/session/logout-all', expect.objectContaining({
      credentials: 'include',
      method: 'POST',
      headers: {'accept': 'application/json', 'x-csrf-token': 'csrf-123'}
    }));
  });

  it('throws a typed error for invalid responses', async () => {
    const client = createAccountSessionClient({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({error_code: 'ACC_INTERNAL'}, 500))
    });

    await expect(client.getSession()).rejects.toEqual(
      expect.objectContaining({name: 'AccountSessionError', status: 500, code: 'ACC_INTERNAL'})
    );
  });
});

describe('account auth lifecycle helpers', () => {
  it('distinguishes authenticated, anonymous, and unavailable session results', async () => {
    await expect(resolveAccountAuth({
      getSession: async () => ({
        authenticated: true,
        user: {id: 'u1', email: 'ada@example.com', display_name: 'Ada', avatar_url: null}
      })
    })).resolves.toMatchObject({status: 'authenticated', user: {id: 'u1'}});

    await expect(resolveAccountAuth({
      getSession: async () => ({authenticated: false})
    })).resolves.toEqual({status: 'anonymous'});

    await expect(resolveAccountAuth({
      getSession: async () => { throw new AccountSessionError(401, 'ACC_AUTH_REQUIRED'); }
    })).resolves.toEqual({status: 'anonymous'});

    const outage = new AccountSessionError(503, 'ACC_UNAVAILABLE');
    await expect(resolveAccountAuth({
      getSession: async () => { throw outage; }
    })).resolves.toEqual({status: 'unavailable', error: outage});
  });

  it('serializes refresh across simulated tabs and coalesces requests within one tab', async () => {
    let lockTail = Promise.resolve();
    const locks = {
      request: <T>(_name: string, callback: () => Promise<T>): Promise<T> => {
        const result = lockTail.then(callback);
        lockTail = result.then(() => undefined, () => undefined);
        return result;
      }
    };
    const firstTab = createRefreshCoordinator({locks});
    const secondTab = createRefreshCoordinator({locks});
    let active = 0;
    let maxActive = 0;
    let calls = 0;
    const refresh = async () => {
      calls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return `token-${calls}`;
    };

    const sameTabFirst = firstTab.run('account', refresh);
    const sameTabSecond = firstTab.run('account', refresh);
    const otherTab = secondTab.run('account', refresh);

    expect(sameTabFirst).toBe(sameTabSecond);
    await expect(Promise.all([sameTabFirst, sameTabSecond, otherTab])).resolves.toEqual([
      'token-1',
      'token-1',
      'token-2'
    ]);
    expect(maxActive).toBe(1);
    expect(calls).toBe(2);
  });

  it('retries a superseded refresh once without retrying other failures', async () => {
    let attempts = 0;
    await expect(retrySupersededRefresh(async () => {
      attempts += 1;
      if (attempts === 1) throw new AccountSessionError(409, 'ACC_AUTH_REFRESH_SUPERSEDED');
      return 'fresh';
    })).resolves.toBe('fresh');
    expect(attempts).toBe(2);

    const unavailable = new AccountSessionError(503, 'ACC_UNAVAILABLE');
    const request = vi.fn(async () => { throw unavailable; });
    await expect(retrySupersededRefresh(request)).rejects.toBe(unavailable);
    expect(request).toHaveBeenCalledOnce();
  });
});
