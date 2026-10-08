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

  it('keeps member list sorting and church projection fields in the generated contract', async () => {
    const member = {
      id: 'member-1', accountUserId: 'account-1', churchOrgUnitId: 'church-1',
      churchStatus: 'active' as const, churchName: 'HHC', version: 1,
      createdAt: '2026-09-23T00:00:00Z', updatedAt: '2026-09-23T00:00:00Z'
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json([member]));
    const client = createOperationsClient({baseUrl: '', getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null, fetcher});

    const result = await client.raw.GET('/api/admin/operations/members', {
      params: {query: {sort: 'church', direction: 'desc', page: 2, limit: 50}}
    });

    expect(result.data?.[0]).toMatchObject({churchOrgUnitId: 'church-1', churchStatus: 'active', churchName: 'HHC'});
    const request = fetcher.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe('http://localhost/api/admin/operations/members?sort=church&direction=desc&page=2&limit=50');
  });

  it('keeps the bounded effective-member verification endpoint in the generated contract', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({accountUserIds: ['account-1']}));
    const client = createOperationsClient({baseUrl: '', getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null, fetcher});

    const result = await client.raw.POST('/api/admin/operations/members/effective-verification', {
      body: {accountUserIds: ['account-1', 'account-2']}
    });

    expect(result.data).toEqual({accountUserIds: ['account-1']});
    const request = fetcher.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe('http://localhost/api/admin/operations/members/effective-verification');
    expect(await request.clone().json()).toEqual({accountUserIds: ['account-1', 'account-2']});
  });

  it('keeps the Account unit-management routes in the generated client', async () => {
	const fetcher = vi.fn<typeof fetch>()
	  .mockResolvedValueOnce(json({items: []}))
	  .mockResolvedValueOnce(json({unit: {id: 'unit-1'}, children: [], actions: {}}))
	  .mockResolvedValueOnce(json({items: []}))
	  .mockResolvedValueOnce(json({memberId: 'member-1', displayName: 'Member', email: 'member@example.test', affiliations: [], entitlementCodes: [], actions: {}}, 201))
	  .mockResolvedValueOnce(json({matched: 1, changed: 1}));
	const client = createOperationsClient({baseUrl: '', getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null, fetcher});

	await client.raw.GET('/api/operations/manage/roots');
	await client.raw.GET('/api/operations/manage/org-units/{unitId}', {params: {path: {unitId: 'unit-1'}, query: {includeArchived: true}}});
	await client.raw.GET('/api/operations/manage/org-units/{unitId}/account-candidates', {params: {path: {unitId: 'unit-1'}, query: {q: '王小', limit: 20}}});
	await client.raw.POST('/api/operations/manage/org-units/{unitId}/members', {params: {path: {unitId: 'unit-1'}, header: {'Idempotency-Key': 'admit'}}, body: {accountUserId: 'account-1'}});
	await client.raw.POST('/api/operations/manage/org-units/{unitId}/entitlements/batch', {params: {path: {unitId: 'unit-1'}, header: {'Idempotency-Key': 'grant'}}, body: {memberIds: ['member-1'], entitlementCode: 'bulletin.general.zh-Hant.access', operation: 'grant'}});

	const [, folder, candidates, admission, entitlement] = fetcher.mock.calls.map(([input]) => input as Request);
	expect(folder.url).toContain('/api/operations/manage/org-units/unit-1?includeArchived=true');
	expect(candidates.url).toContain('q=%E7%8E%8B%E5%B0%8F');
	expect(admission.headers.get('idempotency-key')).toBe('admit');
	expect(entitlement.headers.get('idempotency-key')).toBe('grant');
  });
});

it('preserves an explicit empty unit policy and sends a typed video grant', async () => {
 const bodies: unknown[] = [];
 const fetcher: typeof fetch = async input => { bodies.push(await (input as Request).json()); return json({}); };
 const client = createOperationsClient({baseUrl: '', getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null, fetcher});
 await client.raw.PUT('/api/operations/manage/org-units/{unitId}', {
  params: {path: {unitId: 'unit'}, header: {'If-Match':'"1"','Idempotency-Key':'policy'}},
  body: {name:'Group',grantableEntitlementCodes:[]}
 });
 await client.raw.POST('/api/operations/manage/org-units/{unitId}/entitlements/batch', {
  params: {path:{unitId:'unit'},header:{'Idempotency-Key':'grant'}},
  body:{memberIds:['member'],entitlementCode:'video.meeting-recordings.access',operation:'grant'}
 });
 await client.raw.PUT('/api/operations/manage/org-units/{unitId}', {params:{path:{unitId:'unit'},header:{'If-Match':'"1"','Idempotency-Key':'inherit'}},body:{name:'Group',inheritsGrantableEntitlements:true}});
 expect(bodies).toEqual([{name:'Group',grantableEntitlementCodes:[]},{memberIds:['member'],entitlementCode:'video.meeting-recordings.access',operation:'grant'},{name:'Group',inheritsGrantableEntitlements:true}]);
});

it('carries admission entitlements through both existing routes with stable keys', async () => {
 const bodies: unknown[]=[];
 const keys: (string|null)[]=[];
 const client=createOperationsClient({baseUrl:'',getAccessToken:async()=>'token',refreshAfterUnauthorized:async()=>null,fetcher:async input=>{
  const request=input as Request; bodies.push(await request.json()); keys.push(request.headers.get('Idempotency-Key')); return json({});
 }});
 await client.raw.POST('/api/operations/manage/org-units/{unitId}/members',{
  params:{path:{unitId:'unit'},header:{'Idempotency-Key':'account-admit'}},body:{accountUserId:'account',entitlementCodes:['bulletin.general.zh-Hant.access']}
 });
 await client.raw.POST('/api/admin/operations/org-units/{id}/members/batch',{
  params:{path:{id:'unit'},header:{'Idempotency-Key':'admin-admit'}},body:{accountUserIds:['account'],entitlementCodes:['video.meeting-recordings.access']}
 });
 expect(bodies).toEqual([{accountUserId:'account',entitlementCodes:['bulletin.general.zh-Hant.access']},{accountUserIds:['account'],entitlementCodes:['video.meeting-recordings.access']}]);
 expect(keys).toEqual(['account-admit','admin-admit']);
});
