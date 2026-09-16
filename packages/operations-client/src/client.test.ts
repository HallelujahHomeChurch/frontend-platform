import {describe, expect, it, vi} from 'vitest';
import {createOperationsClient} from './client';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});
}

describe('Operations client authentication', () => {
  it('refreshes once after 401 and retries the original request once', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({memberships: [], orgRoles: [], qualifications: [], entitlements: [], version: 'a'.repeat(64)}));
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
});
