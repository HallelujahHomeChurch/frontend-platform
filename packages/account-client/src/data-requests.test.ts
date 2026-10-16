import b2 from './testdata/email-correction-b2.json';
import b3 from './testdata/email-correction-b3.json';
import {describe, expect, it, vi} from 'vitest';
import * as sdk from './index.js';
import {authorizedAdminDestinations, firstAuthorizedAdminDestination, findAdminDestination} from './admin-access.js';
const submission: sdk.EmailCorrectionSubmitInput = {...b3.submit, kind: 'email_change'};
const json = (value: unknown, status = 200, headers = {}) => Response.json(value, {status, headers});

it('exports the typed data requests factory from the public package root', () => {
  expect(sdk).toHaveProperty('createAccountDataRequestsClient');
});

it('adds only the star destination after all existing destinations', () => {
  expect(findAdminDestination('data-requests')).toEqual({id: 'data-requests', path: '/data-requests', permission: '*'});
  expect(authorizedAdminDestinations(['users:read', 'users:manage']).some(x => x.id === 'data-requests')).toBe(false);
  expect(authorizedAdminDestinations(['*']).at(-1)?.id).toBe('data-requests');
  expect(firstAuthorizedAdminDestination(['*'])?.id).toBe('page-settings');
});

describe('actual flat producer contract through existing session transport', () => {
  it('uses every exact member/Admin method, payload and encoded opaque path', async () => {
    const replies = [b2.capability, b2.catalog, b2.factor_required, b2.ready, b2.mfa_required,
      {authorizationUrl: 'https://provider.invalid/authorize?state=ecr.opaque', expiresAt: b2.ready.expiresAt, requestVersion: 2},
      b2.ready, null, b3.pending_verification, b3.empty_current, b3.pending_verification,
      b3.pending_approval, b3.cancelled, b3.pending_verification, b3.empty_list, b3.admin_pending_approval, b3.completed];
    const calls: {path: string; init: RequestInit}[] = [];
    const client = sdk.createAccountSessionClient({fetcher: async (url, init = {}) => {
      const path = String(url).replace('/api/account/v1', '');
      if (path === '/csrf-token') return json({csrf_token: 'csrf'});
      calls.push({path, init}); const reply = replies.shift();
      return reply === null ? new Response(null, {status: 204}) : json(reply);
    }}).dataRequests;
    expect(await client.capability()).toEqual(b2.capability);
    expect(await client.catalog()).toEqual(b2.catalog);
    await client.createReauth({kind: 'email_change', newEmail: b2.create.newEmail});
    await client.password(b2.ready.intentId, {password: 'memory-only'});
    await client.mfa(b2.ready.intentId, {code: '123456'});
    await client.oauth(b2.ready.intentId, {provider: 'google'});
    expect(await client.restoreReauth(b2.ready.intentId)).toEqual(b2.ready);
    await client.cancelReauth(b2.ready.intentId);
    expect(await client.submit(submission)).toEqual(b3.pending_verification);
    expect(await client.current()).toEqual(b3.empty_current);
    expect(await client.submission(submission.submissionNonce)).toEqual(b3.pending_verification);
    await client.request(b3.pending_verification.id);
    await client.cancel(b3.pending_verification.id, b3.version_input);
    await client.resendVerification(b3.pending_verification.id, b3.version_input);
    await client.adminList({cursor: 'opaque+=/', limit: 20});
    await client.adminRequest(b3.pending_verification.id);
    await client.approve(b3.pending_verification.id, b3.version_input);
    const intent = encodeURIComponent(b2.ready.intentId), id = b3.pending_verification.id;
    expect(calls.map(c => [c.path, c.init.method, c.init.body && JSON.parse(String(c.init.body))])).toEqual([
      ['/oauth-providers', 'GET', undefined], ['/data-requests/items', 'GET', undefined],
      ['/data-requests/reauth', 'POST', b2.create],
      [`/data-requests/reauth/${intent}/password`, 'POST', {password: 'memory-only'}],
      [`/data-requests/reauth/${intent}/mfa`, 'POST', {code: '123456'}],
      [`/data-requests/reauth/${intent}/oauth`, 'POST', {provider: 'google'}],
      [`/data-requests/reauth/${intent}`, 'GET', undefined], [`/data-requests/reauth/${intent}`, 'DELETE', undefined],
      ['/data-requests/requests', 'POST', submission], ['/data-requests/requests/current', 'GET', undefined],
      [`/data-requests/submissions/${encodeURIComponent(submission.submissionNonce)}`, 'GET', undefined],
      [`/data-requests/requests/${id}`, 'GET', undefined], [`/data-requests/requests/${id}/cancel`, 'POST', b3.version_input],
      [`/data-requests/requests/${id}/resend-verification`, 'POST', b3.version_input],
      ['/admin/data-requests/requests?cursor=opaque%2B%3D%2F&limit=20', 'GET', undefined],
      [`/admin/data-requests/requests/${id}`, 'GET', undefined], [`/admin/data-requests/requests/${id}/approve`, 'POST', b3.version_input]
    ]);
    for (const {init} of calls) {
      expect(init.cache).toBe('no-store'); expect(init.redirect).toBe('error');
      if (init.method !== 'GET') expect(new Headers(init.headers).get('x-csrf-token')).toBe('csrf');
    }
  });

  it('verifies only by explicit body-only POST without login cookies, CSRF bootstrap or recovery', async () => {
    const calls: RequestInit[] = [];
    const fetcher = vi.fn(async (url, init) => {expect(url).toBe('/api/account/v1/data-requests/email-verification'); calls.push(init!); return json(b3.public_verified);});
    const client = sdk.createAccountSessionClient({fetcher}).dataRequests;
    expect(await client.verifyEmail({token: 'A'.repeat(43)})).toEqual(b3.public_verified);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(calls[0]).toMatchObject({method: 'POST', credentials: 'omit', body: JSON.stringify({token: 'A'.repeat(43)})});
    expect(new Headers(calls[0].headers).has('x-csrf-token')).toBe(false);
  });

  it.each(b2.errors)('preserves actual $httpStatus / $body.errorCode and server timing', async ({httpStatus, body}) => {
    const fetcher = vi.fn(async () => json(body, httpStatus, {'Retry-After': '17', 'X-Request-ID': 'trace-1'}));
    const client = sdk.createAccountSessionClient({fetcher, now: () => 1000}).dataRequests;
    await expect(client.catalog()).rejects.toMatchObject({status: httpStatus, code: body.errorCode, serverTime: body.serverTime, retryAfter: '17', requestId: 'trace-1', ...(httpStatus === 429 ? {retryAt: 18000} : {})});
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(sdk.authActionForStatus(httpStatus)).toBe(httpStatus === 401 ? 'refresh-once' : httpStatus === 403 ? 'forbidden' : httpStatus === 429 ? 'cooldown' : 'fail');
  });

  it('retries only a legacy CSRF rejection and preserves exact submit nonce and proof', async () => {
    let csrf = 0, submits = 0;
    const inputs: string[] = [];
    const client = sdk.createAccountSessionClient({fetcher: async (url, init) => {
      if (String(url).endsWith('/csrf-token')) return json({csrf_token: `csrf-${++csrf}`});
      inputs.push(String(init?.body));
      return ++submits === 1 ? json({error_code: 'ACC_CSRF_TOKEN_INVALID'}, 403) : json(b3.pending_verification);
    }}).dataRequests;
    await expect(client.submit(submission)).resolves.toEqual(b3.pending_verification);
    expect(inputs).toEqual([JSON.stringify(submission), JSON.stringify(submission)]);
    expect(csrf).toBe(2);
  });

  it('does not replay an uncertain submission; result recovery keeps the original nonce', async () => {
    const paths: string[] = [];
    const client = sdk.createAccountSessionClient({fetcher: async (url) => {
      const path = String(url); paths.push(path);
      if (path.endsWith('/csrf-token')) return json({csrf_token: 'csrf'});
      if (path.endsWith('/requests')) throw new TypeError('connection lost');
      return json(b3.pending_verification);
    }}).dataRequests;
    await expect(client.submit(submission)).rejects.toThrow('connection lost');
    await expect(client.submission(submission.submissionNonce)).resolves.toEqual(b3.pending_verification);
    expect(paths.filter(p => p.endsWith('/requests'))).toHaveLength(1);
    expect(paths.at(-1)).toContain(encodeURIComponent(submission.submissionNonce));
  });

  it.each(['pending_verification', 'pending_approval', 'completed', 'cancelled', 'superseded', 'expired', 'invalidated'])('preserves the actual %s view', async status => {
    const client = sdk.createAccountSessionClient({fetcher: async () => json(b3[status as keyof typeof b3])}).dataRequests;
    const view = b3[status as keyof typeof b3];
    expect(await client.request(b3.pending_verification.id)).toEqual(view);
  });

  it.each([
    {...b2.catalog, items: [{...b2.catalog.items[0], kind: 'erase'}]},
    {...b2.catalog, extra: 'unknown'},
    {...b2.catalog, items: [{...b2.catalog.items[0], fields: [{...b2.catalog.items[0].fields[0], key: 'password'}, b2.catalog.items[0].fields[1]]}]},
    {data: b2.catalog},
  ])('rejects unsupported catalog wire at the SDK boundary', async body => {
    const client = sdk.createAccountSessionClient({fetcher: async () => json(body)}).dataRequests;
    await expect(client.catalog()).rejects.toMatchObject({code: 'INVALID_RESPONSE'});
  });

  it.each([{...b2.factor_required, proof: 'secret'}, {...b2.ready, proof: undefined}, {...b2.ready, status: 'unknown'}, {...b2.ready, requestVersion: 0}])('rejects invalid reauth state or proof exposure', async body => {
    const client = sdk.createAccountSessionClient({fetcher: async () => json(body)}).dataRequests;
    await expect(client.restoreReauth(b2.ready.intentId)).rejects.toMatchObject({code: 'INVALID_RESPONSE'});
  });
});

it.each([
  [404, 'ACC_CORRECTION_NOT_FOUND'], [409, 'ACC_CORRECTION_CONFLICT'],
  [409, 'ACC_CORRECTION_REVIEWER_UNAVAILABLE'], [403, 'ACC_CORRECTION_FORBIDDEN'],
  [400, 'ACC_CORRECTION_VERIFICATION_INVALID'],
] as const)('normalizes B3 %i %s errors without replay', async (status, errorCode) => {
  const fetcher = vi.fn(async () => json({status: 'error', errorCode, serverTime: b3.public_verified.serverTime}, status));
  const client = sdk.createAccountSessionClient({fetcher}).dataRequests;
  await expect(client.request(b3.pending_verification.id)).rejects.toMatchObject({status, code: errorCode});
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([401, 403, 503])('keeps public verification independent of login recovery on %i', async status => {
  const fetcher = vi.fn(async () => json({errorCode: 'ACC_CORRECTION_VERIFICATION_INVALID'}, status));
  await expect(sdk.createAccountSessionClient({fetcher}).dataRequests.verifyEmail({token: 'A'.repeat(43)})).rejects.toMatchObject({status});
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('passes explicit public options to the existing consumer transport and preserves its errors', async () => {
  const failure = new sdk.AccountSessionError(503, 'ACC_SERVICE_UNAVAILABLE', 'unavailable', {requestId: 'trace', retryAfter: 'Wed, 21 Oct 2026 07:28:00 GMT'});
  const transport = vi.fn(async () => {throw failure;});
  const client = sdk.createAccountDataRequestsClient(transport);
  await expect(client.verifyEmail({token: 'A'.repeat(43)})).rejects.toBe(failure);
  expect(transport).toHaveBeenCalledWith('/data-requests/email-verification', {
    method: 'POST', body: {token: 'A'.repeat(43)}, cache: 'no-store', redirect: 'error',
    auth: false, csrf: false, retry: false, credentials: 'omit'
  });
});

it.each([400, 403, 503])('preserves the authenticated session while a feature request fails with %i', async status => {
  const session = {authenticated: true, user: {id: 'user', email: 'old@example.invalid', display_name: 'User', avatar_url: null}, permissions: [], permission_availability: {status: 'available'}};
  const client = sdk.createAccountSessionClient({fetcher: async url => String(url).endsWith('/session') ? json(session) : json({errorCode: 'ACC_REAUTH_FACTOR_INVALID'}, status)});
  const runtime = sdk.createBrowserAccountAuthRuntime({client});
  await runtime.start();
  await expect(client.dataRequests.catalog()).rejects.toMatchObject({status});
  expect(runtime.getSnapshot().status).toBe('authenticated');
  runtime.dispose();
});

it('encodes request IDs as one path segment and keeps original CAS payloads', async () => {
  const transport = vi.fn(async () => b3.completed);
  await sdk.createAccountDataRequestsClient(transport).approve('opaque/+=?', {requestVersion: 7});
  expect(transport).toHaveBeenCalledWith('/admin/data-requests/requests/opaque%2F%2B%3D%3F/approve', {
    method: 'POST', body: {requestVersion: 7}, cache: 'no-store', redirect: 'error'
  });
});

it.each([
  {...b3.completed, kind: 'erase'}, {...b3.completed, status: 'delivered'},
  {...b3.completed, notificationStatus: 'sent'}, {...b3.completed, allowedActions: ['delete']},
  {...b3.completed, requestVersion: 1.5}, {...b3.completed, serverTime: 'bad'},
])('rejects an unsupported B3 response without changing its status', async body => {
  await expect(sdk.createAccountSessionClient({fetcher: async () => json(body)}).dataRequests.request(b3.completed.id)).rejects.toMatchObject({code: 'INVALID_RESPONSE'});
});
