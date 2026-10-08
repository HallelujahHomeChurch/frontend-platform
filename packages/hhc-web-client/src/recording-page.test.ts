import {expect, it, vi} from 'vitest';
import {createHhcWebClient} from './client.js';

it('preserves the array call and reads cursor batches without caching member metadata',async()=>{
 const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({data:[{id:'one'}],meta:{},error:null})).mockResolvedValueOnce(Response.json({data:[{id:'two'}],meta:{nextCursor:'next'},error:null})).mockResolvedValueOnce(Response.json({data:[],meta:{nextCursor:null},error:null}));
 const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>'test-member',fetcher});
 expect(await client.listMemberRecordings()).toEqual([{id:'one'}]);
 expect(await client.listMemberRecordingsPage({limit:12,cursor:'opaque'})).toEqual({items:[{id:'two'}],nextCursor:'next'});
 expect(await client.listMemberRecordingsPage()).toEqual({items:[],nextCursor:null});
 const requests=fetcher.mock.calls.map(([r])=>r as Request);
 expect(new URL(requests[0]!.url).search).toBe('');
 expect(new URL(requests[1]!.url).searchParams.get('cursor')).toBe('opaque');
 expect(new URL(requests[1]!.url).searchParams.get('limit')).toBe('12');
 expect(requests.every(r=>r.cache==='no-store')).toBe(true);
});

it.each([{}, {nextCursor:42}])('rejects unavailable or malformed pagination metadata %j',async(meta)=>{
 const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>'test-member',fetcher:vi.fn<typeof fetch>().mockResolvedValue(Response.json({data:[],meta,error:null}))});
 await expect(client.listMemberRecordingsPage()).rejects.toMatchObject({status:502,code:'invalid_response'});
});
