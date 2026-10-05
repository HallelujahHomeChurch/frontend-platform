import {describe,it,expect,vi} from 'vitest';
import {createServiceClient} from './service.js';
import {OperationsApiError} from './client.js';
describe('service management transport',()=>{
 it('sends manager draft reads and versioned publication through the shared client',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({items:[]})).mockResolvedValueOnce(Response.json({assignmentIds:['id']}));
  const api=createServiceClient({baseUrl:'https://test.invalid',getAccessToken:async()=> 'token',refreshAfterUnauthorized:async()=>null,fetcher});
  await api.list('team','2026-10-01T00:00Z','2026-11-01T00:00Z',undefined,true);
  expect(new URL((fetcher.mock.calls[0][0] as Request).url).searchParams.get('includeDrafts')).toBe('true');
  await api.publish('team',[{id:'id',expectedVersion:4}],'same-intent');
  const req=fetcher.mock.calls[1][0] as Request;expect(req.headers.get('Idempotency-Key')).toBe('same-intent');expect(await req.json()).toEqual({items:[{id:'id',expectedVersion:4}]});
 });
 it('preserves status and error code for recovery',async()=>{
  const api=createServiceClient({baseUrl:'https://test.invalid',getAccessToken:async()=>null,refreshAfterUnauthorized:async()=>null,fetcher:vi.fn().mockResolvedValue(Response.json({error_code:'service_idempotency_conflict'},{status:409}))});
  await expect(api.createDrafts('team',[],'key')).rejects.toMatchObject({status:409,code:'service_idempotency_conflict',name:OperationsApiError.name});
 });
});
