import {describe, expect, it, vi} from 'vitest';
import {createAccountSessionClient} from './index';

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

  it('gets a CSRF token before browser-session logout', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({csrf_token: 'csrf-123'}))
      .mockResolvedValueOnce(jsonResponse({message: 'Logged out'}));
    const client = createAccountSessionClient({fetcher});

    await client.logout();

    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/account/v1/csrf-token', expect.objectContaining({
      credentials: 'include',
      method: 'GET'
    }));
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/account/v1/session/logout', expect.objectContaining({
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
