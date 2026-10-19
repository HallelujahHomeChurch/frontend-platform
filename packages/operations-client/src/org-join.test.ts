import {describe, expect, it, vi} from 'vitest';
import {createBrowserAccountAuthRuntime, type AccountSessionClient} from '@hallelujahhomechurch/account-client';
import {createOperationsClient} from './client';

const id = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const row = {id, orgUnitId: other, orgUnitName: 'Group', orgUnitKind: 'small_group', status: 'pending', requestedAt: '2026-10-19T00:00:00Z', version: 2, actions: {cancel: true, approve: false, reject: false}, ancestorCollapsePreview: [{id, name: 'Church', kind: 'church'}]};
const unit = {id: other, name: 'Group', kind: 'small_group', ancestorLabels: ['Church'], relationship: 'none', applicationAvailability: 'available', ancestorCollapsePreview: []};
async function setup(fetcher = vi.fn<typeof fetch>(async () => Response.json(row))) {
  let actor = id;
  const sessionClient = {getSession: async () => ({authenticated: true, user: {id: actor, email: '', display_name: '', avatar_url: null}, permissions: [], permission_availability: {status: 'available'}}), issueAccessToken: async () => ({accessToken: 'old', expiresIn: 900}), refreshAccessToken: vi.fn(async () => ({accessToken: 'new', expiresIn: 900}))} as unknown as AccountSessionClient;
  const auth = createBrowserAccountAuthRuntime({client: sessionClient});
  await auth.start();
  const client = createOperationsClient({baseUrl: '', auth, getAccessToken: auth.getAccessToken, refreshAfterUnauthorized: auth.refreshAfterUnauthorized, fetcher});
  return {client, auth, sessionClient, fetcher, changeActor: async () => {actor = other; await auth.revalidate();}};
}
describe('typed group application contracts', () => {
  it('exposes fixed typed routes with literal filters, direct DTOs and exact mutation intent', async () => {
    const s = await setup();
    expect(typeof s.client.listOrgUnitDirectory).toBe('function');
    s.fetcher.mockResolvedValueOnce(Response.json({items: [unit], page: 1, nextPage: 2}));
    expect(await s.client.listOrgUnitDirectory({relation: 'all', q: '  %_中  ', page: 1, limit: 20})).toMatchObject({items: [unit]});
    s.fetcher.mockResolvedValueOnce(Response.json({items: [row], page: 10000}));
    await s.client.listOwnOrgJoinRequests({status: 'history', page: 10000, limit: 50});
    s.fetcher.mockResolvedValueOnce(Response.json({items: [row], page: 1, actionablePendingTotal: 0}));
    expect((await s.client.listReviewableOrgJoinRequests({orgUnitId: other, status: 'pending'})).actionablePendingTotal).toBe(0);
    await s.client.getOwnOrgJoinRequest(id);
    await s.client.getReviewableOrgJoinRequest(id);
    await s.client.createOrgJoinRequest({orgUnitId: other, idempotencyKey: 'create-key'});
    for (const method of ['cancelOrgJoinRequest', 'approveOrgJoinRequest', 'rejectOrgJoinRequest'] as const) await s.client[method](id, {version: 2, idempotencyKey: method});
    const requests = s.fetcher.mock.calls.map(([r]) => r as Request);
    expect(requests.map(r => new URL(r.url).pathname)).toEqual(['/api/operations/me/org-units', '/api/operations/me/org-join-requests', '/api/operations/manage/org-join-requests', `/api/operations/me/org-join-requests/${id}`, `/api/operations/manage/org-join-requests/${id}`, '/api/operations/me/org-join-requests', ...['cancel', 'approve', 'reject'].map(a => `/api/operations/${a === 'cancel' ? 'me' : 'manage'}/org-join-requests/${id}/${a}`)]);
    expect(new URL(requests[0].url).searchParams.get('q')).toBe('  %_中  ');
    expect(requests[1].url).toContain('status=history');
    expect(requests[2].url).toContain(`orgUnitId=${other}`);
    expect(await requests[5].json()).toEqual({orgUnitId: other});
    for (const r of requests) {expect(r.cache).toBe('no-store'); expect(r.redirect).toBe('error'); expect(r.headers.has('x-hhc-user-id')).toBe(false);}
    for (const [i, r] of requests.slice(6).entries()) {expect(r.headers.get('If-Match')).toBe('"2"'); expect(r.headers.get('Idempotency-Key')).toBe(['cancelOrgJoinRequest', 'approveOrgJoinRequest', 'rejectOrgJoinRequest'][i]); expect(await r.json()).toEqual({});}
    s.auth.dispose();
  });
  it.each([
    {version: 0}, {version: Number.MAX_SAFE_INTEGER + 1}, {status: 'history'}, {actions: {cancel: true}}, {ancestorCollapsePreview: null}, {ancestorCollapsePreview: [{id, name: 'x', kind: 'small_group'}]}, {ancestorCollapsePreview: [{id, name: 'x', kind: 'church', version: 1}]}, {requestedAt: '2026-02-30T00:00:00Z'}, {requestedAt: '2026-10-19T24:00:00Z'}, {decidedAt: '2026-10-19T24:00:00.000+08:00'}, {decidedAt: null}, {applicantDisplayName: 3}, {secret: 'private'}
  ])('fails closed on malformed direct request fields %j', async delta => {
    const s = await setup(vi.fn(async () => Response.json({...row, ...delta})));
    await expect(s.client.getOwnOrgJoinRequest(id)).rejects.toMatchObject({code: 'invalid_response'}); s.auth.dispose();
  });
  it('requires the reviewer count, rejects own totals and malformed directory fields', async () => {
    const s = await setup();
    for (const page of [{items: [row], page: 1}, {items: [row], page: 1, actionablePendingTotal: -1}, {items: [row], page: 1, actionablePendingTotal: 1.5}]) {s.fetcher.mockResolvedValueOnce(Response.json(page)); await expect(s.client.listReviewableOrgJoinRequests()).rejects.toMatchObject({code: 'invalid_response'});}
    s.fetcher.mockResolvedValueOnce(Response.json({items: [], page: 1, actionablePendingTotal: 0})); await expect(s.client.listOwnOrgJoinRequests()).rejects.toMatchObject({code: 'invalid_response'});
    for (const delta of [{relationship: 'admin'}, {applicationAvailability: 'yes'}, {ancestorLabels: [1]}, {ownPendingRequestId: 'bad'}, {ancestorCollapsePreview: undefined}]) {s.fetcher.mockResolvedValueOnce(Response.json({items: [{...unit, ...delta}], page: 1})); await expect(s.client.listOrgUnitDirectory()).rejects.toMatchObject({code: 'invalid_response'});}
    s.auth.dispose();
  });
  it('normalizes producer conflict and standard status codes without recovering non-401', async () => {
    const s = await setup();
    for (const [status, payload, code] of [[409, {error: 'already_pending', existingRequestId: id}, 'already_pending'], [412, {error_code: 'version_mismatch'}, 'version_mismatch'], [403, {error_code: 'out_of_scope'}, 'out_of_scope'], [503, {error_code: 'operations_unavailable'}, 'operations_unavailable']] as const) {
      s.fetcher.mockResolvedValueOnce(Response.json(payload, {status})); await expect(s.client.createOrgJoinRequest({orgUnitId: other, idempotencyKey: 'same-intent'})).rejects.toMatchObject({status, code, ...(status === 409 ? {existingRequestId: id} : {})});
    }
    expect(s.sessionClient.refreshAccessToken).not.toHaveBeenCalled(); expect(s.fetcher).toHaveBeenCalledTimes(4); s.auth.dispose();
  });
  it('validates bounded input and requires live identity before network', async () => {
    const s = await setup();
    for (const options of [{page: 10001}, {limit: 51}, {page: 0}, {relation: 'bad'}, {q: '中'.repeat(101)}]) await expect(s.client.listOrgUnitDirectory(options as never)).rejects.toMatchObject({code: 'invalid_request'});
    for (const key of ['', '中'.repeat(67), ' bad ', 'line\nkey']) await expect(s.client.createOrgJoinRequest({orgUnitId: other, idempotencyKey: key})).rejects.toMatchObject({code: 'invalid_request'});
    await expect(s.client.cancelOrgJoinRequest('../bad', {version: 2, idempotencyKey: 'key'})).rejects.toMatchObject({code: 'invalid_request'});
    await expect(s.client.approveOrgJoinRequest(id, {version: 1.5, idempotencyKey: 'key'})).rejects.toMatchObject({code: 'invalid_request'});
    expect(s.fetcher).not.toHaveBeenCalled(); s.auth.clear(); await expect(s.client.getOwnOrgJoinRequest(id)).rejects.toMatchObject({status: 401}); s.auth.dispose();
  });
  it('keeps the identical mutation on unchanged-actor 401 token rotation', async () => {
    const s = await setup(vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({}, {status: 401})).mockResolvedValue(Response.json(row)));
    await s.client.approveOrgJoinRequest(id, {version: 2, idempotencyKey: 'stable'});
    expect(s.fetcher).toHaveBeenCalledTimes(2);
    const [a, b] = s.fetcher.mock.calls.map(([r]) => r as Request);
    expect([a.url, await a.text(), a.headers.get('If-Match'), a.headers.get('Idempotency-Key')]).toEqual([b.url, await b.text(), b.headers.get('If-Match'), b.headers.get('Idempotency-Key')]);
    expect(b.headers.get('Authorization')).toBe('Bearer new'); s.auth.dispose();
  });
  it('never replays an old mutation after actor switch during 401 refresh', async () => {
    const s = await setup(vi.fn(async () => Response.json({}, {status: 401})));
    let release!: (v: {accessToken: string; expiresIn: number}) => void;
    vi.mocked(s.sessionClient.refreshAccessToken).mockImplementation(() => new Promise(resolve => {release = resolve;}));
    const pending = s.client.approveOrgJoinRequest(id, {version: 2, idempotencyKey: 'old-actor'});
    const rejected = expect(pending).rejects.toMatchObject({code: 'actor_changed'});
    await vi.waitFor(() => expect(release).toBeTypeOf('function')); await s.changeActor(); release({accessToken: 'other-actor', expiresIn: 900});
    await rejected; expect(s.fetcher).toHaveBeenCalledOnce(); s.auth.dispose();
  });
  it('discards late successful reads after loss and even switch-away-then-back', async () => {
    const s = await setup();
    let finish!: (r: Response) => void; s.fetcher.mockImplementation(() => new Promise(resolve => {finish = resolve;}));
    const pending = s.client.getOwnOrgJoinRequest(id); const rejected = expect(pending).rejects.toMatchObject({code: 'actor_changed'});
    await vi.waitFor(() => expect(finish).toBeTypeOf('function')); s.auth.clear(); await s.auth.start(); finish(Response.json(row)); await rejected; s.auth.dispose();
  });
});

it('bounds 401 recovery, rejects missing runtime and never sends aborted group calls', async () => {
  const s = await setup(vi.fn(async () => Response.json({error_code: 'unauthorized'}, {status: 401})));
  await expect(s.client.getOwnOrgJoinRequest(id)).rejects.toMatchObject({status: 401});
  expect(s.fetcher).toHaveBeenCalledTimes(2); expect(s.sessionClient.refreshAccessToken).toHaveBeenCalledOnce();
  await expect(s.client.getOwnOrgJoinRequest(id, AbortSignal.abort())).rejects.toMatchObject({name: 'AbortError'});
  expect(s.fetcher).toHaveBeenCalledTimes(2);
  const oldClient = createOperationsClient({baseUrl: '', getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null, fetcher: s.fetcher});
  await expect(oldClient.getOwnOrgJoinRequest(id)).rejects.toMatchObject({status: 401}); expect(s.fetcher).toHaveBeenCalledTimes(2);
  s.auth.dispose();
});
