import {describe, expect, it, vi} from 'vitest';
import {createInboxClient} from './inbox';
import {createBrowserAccountAuthRuntime} from './browser-runtime';
import {type AccountSessionClient} from './session-client';

const id = '00000000-0000-4000-8000-000000000001';
const time = '2026-10-19T00:00:00Z';
const resource = {type: 'bulletin', id: 'issue-1', series: 'children'};
const item = {id, type: 'bulletin.published', resource, occurredAt: time, projection: {titleKey: 'notification.bulletin', messageKey: 'notification.published', parameters: {title: '<safe text>', issueNumber: '123'}, action: {type: 'bulletin', resource, locale: 'en'}}};
const page = {items: [item], readSnapshotToken: 'snapshot', asOf: time};
const envelope = (data: unknown) => ({data, meta: {requestId: 'request-1'}, error: null});
async function setup(fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json(envelope(page)))) {
  const sessionClient = {getSession: async () => ({authenticated: true, user: {id, email: '', display_name: '', avatar_url: null}, permissions: [], permission_availability: {status: 'available'}}), issueAccessToken: async () => ({accessToken: 'old', expiresIn: 900}), refreshAccessToken: vi.fn(async () => ({accessToken: 'new', expiresIn: 900}))} as unknown as AccountSessionClient;
  const auth = createBrowserAccountAuthRuntime({client: sessionClient});
  await auth.start();
  return {client: createInboxClient({auth, fetcher}), auth, fetcher, sessionClient};
}
describe('owned inbox client', () => {
  it('uses the owned same-origin paths, bounded queries and snapshot body', async () => {
    const s = await setup();
    expect(await s.client.list({filter: 'unread', cursor: 'cursor', limit: 20, locale: 'en'})).toEqual(page);
    const [path, init] = s.fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/api/notifications/me?filter=unread&cursor=cursor&limit=20&locale=en');
    expect(init).toMatchObject({method: 'GET', cache: 'no-store', redirect: 'error', credentials: 'same-origin'});
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer old');
    s.fetcher.mockImplementation(async () => Response.json(envelope({read: true})));
    await s.client.markRead(id);
    expect(s.fetcher.mock.calls.at(-1)?.[0]).toBe(`/api/notifications/me/${id}/read`);
    await s.client.markAllRead('snapshot');
    expect(s.fetcher.mock.calls.at(-1)?.[1]).toMatchObject({method: 'POST', body: '{"snapshotToken":"snapshot"}'});
    s.auth.dispose();
  });
  it('refreshes through the existing runtime once on 401', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, {status: 401})).mockResolvedValue(Response.json(envelope({...page, unreadCount: 101})));
    const s = await setup(fetcher);
    expect((await s.client.summary({locale: 'ja'})).unreadCount).toBe(101);
    expect(s.sessionClient.refreshAccessToken).toHaveBeenCalledOnce();
    expect(new Headers(fetcher.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer new');
    expect(fetcher.mock.calls[0][0]).toBe('/api/notifications/me/summary?locale=ja');
    s.auth.dispose();
  });
  it.each(['2026-02-30T00:00:00Z', '2026-02-29T12:30:45.123456789+08:00', '2026-04-31T23:30:00-05:00', '1900-02-29T00:00:00Z', '2100-02-29T00:00:00Z'])('rejects nonexistent calendar dates in every timestamp field: %s', async date => {
    for (const data of [{...page, asOf: date}, {...page, items: [{...item, occurredAt: date}]}, {...page, items: [{...item, readAt: date}]}]) {
      const s = await setup(vi.fn(async () => Response.json(envelope(data))));
      await expect(s.client.list()).rejects.toMatchObject({code: 'NTF_INVALID_RESPONSE'});
      s.auth.dispose();
    }
  });
  it.each(['2024-02-29T00:00:00Z', '2000-02-29T12:30:45.123456789+08:00', '2024-02-29T23:30:00-05:00', '0000-02-29T00:00:00Z'])('preserves valid leap days, RFC3339 offsets and fractions: %s', async date => {
    const expected = {...page, asOf: date, items: [{...item, occurredAt: date, readAt: date}]};
    const s = await setup(vi.fn(async () => Response.json(envelope(expected))));
    expect(await s.client.list()).toEqual(expected);
    s.auth.dispose();
  });
  it.each([
    {data: page}, envelope({...page, readSnapshotToken: undefined}),
    envelope({...page, items: [{...item, resource: {...resource, series: 'other'}}]}),
    envelope({...page, items: [{...item, id: 'not-uuid'}]}),
    envelope({...page, items: [{...item, resource: {type: 'future', id: 'x'}}]}),
    envelope({...page, items: [{...item, resource: {...resource, url: 'https://evil.test'}}]}),
    envelope({...page, items: [{...item, projection: {...item.projection, action: {type: 'bulletin', resource: {...resource, series: 'general'}, locale: 'en'}}}]}),
    envelope({...page, items: [{...item, projection: {...item.projection, parameters: {title: 'bad\rvalue'}}}]}),
    {...envelope(page), error: {code: 'NTF_INBOX_UNAVAILABLE'}}
  ])('rejects malformed envelopes and required wire fields without exposing payloads', async data => {
    const s = await setup(vi.fn(async () => Response.json(data)));
    await expect(s.client.list()).rejects.toMatchObject({code: 'NTF_INVALID_RESPONSE'});
    s.auth.dispose();
  });
  it.each([
    {resource: {type: 'recording', id: 'recording-1'}, action: {type: 'recording', resource: {type: 'recording', id: 'recording-1'}}},
    ...(['join_request_review', 'join_request_result'] as const).map(type => ({resource: {type: 'org_join_request', id, unitId: id}, action: {type, resource: {type: 'org_join_request', id, unitId: id}}}))
  ])('preserves each known closed resource/action pair', async ({resource, action}) => {
    const expected = {...item, resource, projection: {...item.projection, action}};
    const s = await setup(vi.fn(async () => Response.json(envelope({...page, items: [expected]}))));
    expect((await s.client.list()).items).toEqual([expected]);
    s.auth.dispose();
  });
  it('omits future actions rather than accepting their URL or dispatcher fields', async () => {
    const s = await setup(vi.fn(async () => Response.json(envelope({...page, items: [{...item, projection: {...item.projection, action: {type: 'future', url: 'https://evil.test', method: 'DELETE'}}}]}))));
    expect((await s.client.list()).items[0].projection.action).toBeUndefined();
    s.auth.dispose();
  });
  it('bounds unauthorized refresh and honors cancellation without sending a request', async () => {
    const fetcher = vi.fn(async () => Response.json({data: null, meta: {requestId: 'r'}, error: {code: 'NTF_UNAUTHORIZED'}}, {status: 401}));
    const s = await setup(fetcher);
    await expect(s.client.summary()).rejects.toMatchObject({status: 401});
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(s.sessionClient.refreshAccessToken).toHaveBeenCalledOnce();
    const signal = AbortSignal.abort();
    await expect(s.client.list({signal})).rejects.toMatchObject({name: 'AbortError'});
    expect(fetcher).toHaveBeenCalledTimes(2);
    s.auth.dispose();
  });
  it('does not widen or retry an expired snapshot or recover a non-401', async () => {
    const fetcher = vi.fn(async () => Response.json({data: null, meta: {requestId: 'r'}, error: {code: 'NTF_INVALID_REQUEST'}}, {status: 422, headers: {'Retry-After': '3'}}));
    const s = await setup(fetcher);
    await expect(s.client.markAllRead('snapshot')).rejects.toMatchObject({status: 422, code: 'NTF_INVALID_REQUEST', requestId: 'r', retryAfter: '3'});
    expect(fetcher).toHaveBeenCalledOnce();
    expect(s.sessionClient.refreshAccessToken).not.toHaveBeenCalled();
    s.auth.dispose();
  });
  it('rejects invalid input before network and discards late responses after auth loss', async () => {
    const s = await setup();
    for (const input of [{limit: 51}, {locale: 'bad'}, {filter: 'bad'}, {cursor: 'x'.repeat(4097)}]) await expect(s.client.list(input as never)).rejects.toMatchObject({code: 'NTF_INVALID_INPUT'});
    await expect(s.client.markRead('../read-all')).rejects.toMatchObject({code: 'NTF_INVALID_INPUT'});
    expect(s.fetcher).not.toHaveBeenCalled();
    let finish!: (r: Response) => void;
    s.fetcher.mockImplementation(() => new Promise(resolve => {finish = resolve;}));
    const pending = s.client.list();
    await vi.waitFor(() => expect(s.fetcher).toHaveBeenCalledOnce());
    s.auth.clear(); finish(Response.json(envelope(page)));
    await expect(pending).rejects.toMatchObject({code: 'NTF_ACTOR_CHANGED'});
    s.auth.dispose();
  });
});
