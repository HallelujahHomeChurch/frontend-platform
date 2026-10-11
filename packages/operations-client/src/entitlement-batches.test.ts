import {describe, expect, expectTypeOf, it, vi} from 'vitest';
import {createOperationsClient} from './client';
import type {components} from './generated';

const prefix = '/api/admin/operations/entitlement-batches';
const batchId = '019a66fc-cb3c-7000-8000-000000000001';

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json', ...headers}});
}

describe('Entitlement batch contract', () => {
  it('preserves candidate selection and cursor when refreshing a rejected human token', async () => {
    const member = {id: batchId, accountUserId: batchId, version: 1, createdAt: '2026-10-11T00:00:00Z', updatedAt: '2026-10-11T00:00:00Z',
      account: {accountUserId: batchId, displayName: '王明', email: 'member@example.test'}} satisfies components['schemas']['MemberView'];
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({error: 'unauthorized'}, 401))
      .mockResolvedValueOnce(json({items: [member], nextCursor: batchId})).mockResolvedValueOnce(json({items: []}));
    const refresh = vi.fn(async () => 'new-token');
    const client = createOperationsClient({baseUrl: '', getAccessToken: async () => 'old-token', refreshAfterUnauthorized: refresh, fetcher});
    const query = {entitlementCode: 'video.meeting-recordings.access' as const, audienceKind: 'members' as const,
      unitId: batchId, q: '王 明+test@example.test', limit: 20};
    const first = await client.raw.GET('/api/admin/operations/entitlement-batches/candidates', {params: {query}, cache: 'no-store'});
    expect(first.data?.items).toEqual([member]);
    await client.raw.GET('/api/admin/operations/entitlement-batches/candidates', {params: {query: {...query, cursor: first.data?.nextCursor}}, cache: 'no-store'});
    expect(refresh).toHaveBeenCalledExactlyOnceWith('old-token');
    for (const [index, [input]] of fetcher.mock.calls.entries()) {
      const request = input as Request;
      const url = new URL(request.url);
      expect(url.pathname).toBe(`${prefix}/candidates`);
      expect(url.searchParams.toString()).toBe(new URLSearchParams({...query, limit: '20', ...(index === 2 ? {cursor: batchId} : {})}).toString());
      expect(request.method).toBe('GET');
      expect(request.cache).toBe('no-store');
      expect(request.headers.get('authorization')).toBe(index === 1 ? 'Bearer new-token' : 'Bearer old-token');
      expect(request.headers.has('x-hhc-scopes')).toBe(false);
      expect(await request.clone().text()).toBe('');
    }
  });

  it('preserves candidate validation and scope errors without retrying or refreshing', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({error: 'invalid_input'}, 400))
      .mockResolvedValueOnce(json({error: 'forbidden'}, 403));
    const refresh = vi.fn(async () => 'token');
    const client = createOperationsClient({baseUrl: '', getAccessToken: async () => 'token', refreshAfterUnauthorized: refresh, fetcher});
    for (const [status, code] of [[400, 'invalid_input'], [403, 'forbidden']] as const) {
      const result = await client.raw.GET('/api/admin/operations/entitlement-batches/candidates', {
        params: {query: {entitlementCode: 'video.meeting-recordings.access', audienceKind: 'all', q: '王明'}}
      });
      expect(result.response.status).toBe(status);
      expect(result.error?.error).toBe(code);
    }
    expect(refresh).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('retries the same preview body and operation key once after 401', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({id: batchId}));
    const refresh = vi.fn(async () => 'new-token');
    const client = createOperationsClient({baseUrl: '', getAccessToken: async () => 'old-token', refreshAfterUnauthorized: refresh, fetcher});
    const body = {entitlementCode: 'video.meeting-recordings.access' as const, audience: {kind: 'all' as const}, excludedMemberIds: []};
    await client.raw.POST('/api/admin/operations/entitlement-batches/previews', {
      params: {header: {'Idempotency-Key': 'preview-key'}}, body
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [input] of fetcher.mock.calls) {
      const request = input as Request;
      expect(request.url).toBe(`http://localhost${prefix}/previews`);
      expect(request.headers.get('idempotency-key')).toBe('preview-key');
      expect(request.headers.has('x-hhc-scopes')).toBe(false);
      expect(await request.clone().json()).toEqual(body);
    }
  });

  it('keeps execution metadata optional and preserves the existing public status enum', () => {
    type Batch = components['schemas']['EntitlementBatch'];
    expectTypeOf<Batch['status']>().toEqualTypeOf<'preview' | 'confirmed' | 'completed' | 'expired'>();
    expectTypeOf<Batch['executionState']>().toEqualTypeOf<'queued' | 'processing' | 'retrying' | 'stopped' | undefined>();
    expectTypeOf<Batch['executionReason']>().toEqualTypeOf<'authorization_unavailable' | 'execution_unavailable' | 'actor_ineligible' | 'authority_lost' | 'deadline_expired' | undefined>();
  });

  it('retries confirmation with the same snapshot and key and recovers accepted status by GET', async () => {
    const accepted = {id: batchId, status: 'confirmed', executionState: 'queued'};
    const stopped = {...accepted, executionState: 'stopped', executionReason: 'authority_lost'};
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json(accepted)).mockResolvedValueOnce(json(stopped));
    const client = createOperationsClient({baseUrl: '', getAccessToken: async () => 'old-token', refreshAfterUnauthorized: async () => 'new-token', fetcher});
    const confirmation = await client.raw.POST('/api/admin/operations/entitlement-batches/{batchId}/confirm', {
      params: {path: {batchId}, header: {'Idempotency-Key': 'stable-confirm-key'}}, body: {version: 7}, cache: 'no-store'
    });
    expect(confirmation.data).toEqual(accepted);
    const controller = new AbortController();
    const recovered = await client.raw.GET('/api/admin/operations/entitlement-batches/{batchId}', {
      params: {path: {batchId}}, cache: 'no-store', signal: controller.signal
    });
    expect(recovered.data).toEqual(stopped);
    for (const [input] of fetcher.mock.calls.slice(0, 2)) {
      const request = input as Request;
      expect(request.url).toBe(`http://localhost${prefix}/${batchId}/confirm`);
      expect(request.method).toBe('POST');
      expect(request.headers.get('idempotency-key')).toBe('stable-confirm-key');
      expect(await request.clone().json()).toEqual({version: 7});
    }
    const recovery = fetcher.mock.calls[2]?.[0] as Request;
    expect(recovery.url).toBe(`http://localhost${prefix}/${batchId}`);
    expect(recovery.method).toBe('GET');
    expect(recovery.cache).toBe('no-store');
    expect(recovery.headers.get('authorization')).toBe('Bearer old-token');
    expect(await recovery.clone().text()).toBe('');
    controller.abort();
    expect(recovery.signal.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('leaves an ambiguous confirmation to recovery using the original key and version', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('connection lost'))
      .mockResolvedValueOnce(json({id: batchId, status: 'confirmed', executionState: 'processing'}));
    const refresh = vi.fn(async () => 'new-token');
    const client = createOperationsClient({baseUrl: '', getAccessToken: async () => 'token', refreshAfterUnauthorized: refresh, fetcher});
    const confirm = () => client.raw.POST('/api/admin/operations/entitlement-batches/{batchId}/confirm', {
      params: {path: {batchId}, header: {'Idempotency-Key': 'original-key'}}, body: {version: 7}
    });
    await expect(confirm()).rejects.toThrow('connection lost');
    expect(fetcher).toHaveBeenCalledOnce();
    const recovered = await confirm();
    expect(recovered.data?.executionState).toBe('processing');
    for (const [input] of fetcher.mock.calls) {
      const request = input as Request;
      expect(request.url).toBe(`http://localhost${prefix}/${batchId}/confirm`);
      expect(request.headers.get('idempotency-key')).toBe('original-key');
      expect(await request.clone().json()).toEqual({version: 7});
    }
    expect(refresh).not.toHaveBeenCalled();
  });

  it('confirms a reviewed version then executes only the fixed batch ID', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json({id: batchId}));
    const client = createOperationsClient({baseUrl: '', getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null, fetcher});
    await client.raw.POST('/api/admin/operations/entitlement-batches/{batchId}/confirm', {
      params: {path: {batchId}, header: {'Idempotency-Key': 'confirm-key'}}, body: {version: 1}
    });
    await client.raw.POST('/api/admin/operations/entitlement-batches/{batchId}/execute', {params: {path: {batchId}}});
    const confirm = fetcher.mock.calls[0]?.[0] as Request;
    const execute = fetcher.mock.calls[1]?.[0] as Request;
    expect(confirm.headers.get('idempotency-key')).toBe('confirm-key');
    expect(await confirm.clone().json()).toEqual({version: 1});
    expect(execute.url).toBe(`http://localhost${prefix}/${batchId}/execute`);
    expect(await execute.clone().text()).toBe('');
  });

  it('does not refresh or retry denied operations and preserves retry-after', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 403)).mockResolvedValueOnce(json({}, 429, {'retry-after': '30'}));
    const refresh = vi.fn(async () => 'token');
    const client = createOperationsClient({baseUrl: '', getAccessToken: async () => 'token', refreshAfterUnauthorized: refresh, fetcher});
    const denied = await client.raw.POST('/api/admin/operations/entitlement-batches/{batchId}/execute', {params: {path: {batchId}}});
    const limited = await client.raw.POST('/api/admin/operations/entitlement-batches/{batchId}/execute', {params: {path: {batchId}}});
    expect(denied.response.status).toBe(403);
    expect(limited.response.headers.get('retry-after')).toBe('30');
    expect(refresh).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('pages stored results without sending a new audience and supports abort', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({items: []}));
    const client = createOperationsClient({baseUrl: '', getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null, fetcher});
    const controller = new AbortController();
    await client.raw.GET('/api/admin/operations/entitlement-batches/{batchId}/items', {
      params: {path: {batchId}, query: {cursor: 'cursor-1', limit: 50}}, signal: controller.signal
    });
    const request = fetcher.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(`http://localhost${prefix}/${batchId}/items?cursor=cursor-1&limit=50`);
    expect(request.method).toBe('GET');
    expect(await request.clone().text()).toBe('');
    controller.abort();
    expect(request.signal.aborted).toBe(true);
  });
});
