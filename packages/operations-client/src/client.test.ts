import {describe, expect, it, vi} from 'vitest';
import {createOperationsClient} from './client';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});
}

describe('Operations client authentication', () => {
  it('refreshes once after 401 and retries the original request once', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({memberships: [], orgRoles: [], responsibilities: [], entitlements: [], version: 'a'.repeat(64)}));
    const refresh = vi.fn(async () => 'new-token');
    const client = createOperationsClient({
      baseUrl: '/api/operations',
      getAccessToken: async () => 'old-token',
      refreshAfterUnauthorized: refresh,
      fetcher
    });

    await expect(client.getMyAccess()).resolves.toMatchObject({version: 'a'.repeat(64)});
    expect(refresh).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledTimes(2);
    const retriedRequest = fetcher.mock.calls[1]?.[0];
    expect(retriedRequest).toBeInstanceOf(Request);
    expect((retriedRequest as Request).headers.get('authorization')).toBe('Bearer new-token');
  });

  it('does not refresh or retry 403', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({}, 403));
    const refresh = vi.fn(async () => 'new-token');
    const client = createOperationsClient({
      baseUrl: '/api/operations',
      getAccessToken: async () => 'old-token',
      refreshAfterUnauthorized: refresh,
      fetcher
    });

    await expect(client.getMyAccess()).rejects.toMatchObject({status: 403});
    expect(refresh).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('preserves the final-binding conflict code without refreshing', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({error: 'conflict', error_code: 'last_binding_requires_membership_end', message: 'Removing the final binding ends church membership'}, 409));
    const refresh = vi.fn(async () => 'new-token');
    const client = createOperationsClient({baseUrl: '/api/operations', getAccessToken: async () => 'old-token', refreshAfterUnauthorized: refresh, fetcher});

    await expect(client.getMyAccess()).rejects.toMatchObject({status: 409, code: 'last_binding_requires_membership_end'});
    expect(refresh).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('sends final-binding intent in the DELETE query string', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({id: 'binding-1', version: 2}));
    const client = createOperationsClient({baseUrl: '', getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null, fetcher});

    await client.raw.DELETE('/api/admin/operations/org-memberships/{id}', {
      params: {path: {id: 'binding-1'}, header: {'If-Match': '"1"'}, query: {endChurchMembership: true}}
    });

    const request = fetcher.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe('http://localhost/api/admin/operations/org-memberships/binding-1?endChurchMembership=true');
    expect(await request.clone().text()).toBe('');
  });

  it('uses the contract path without sending trusted Gateway headers', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({memberships: [], orgRoles: [], responsibilities: [], entitlements: [], version: 'a'.repeat(64)}));
    const client = createOperationsClient({
      baseUrl: '',
      getAccessToken: async () => 'token',
      refreshAfterUnauthorized: async () => null,
      fetcher
    });

    await client.getMyAccess();

    const request = fetcher.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe('http://localhost/api/operations/me/access');
    expect(request.headers.has('x-hhc-scopes')).toBe(false);
  });
});
