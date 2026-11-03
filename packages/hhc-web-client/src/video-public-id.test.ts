import {expect, it, vi} from 'vitest';
import {createHhcWebClient} from './client.js';

it('resolves a case-sensitive public ID with member identity, no cache and cancellation', async () => {
 const value={recordingId:'internal-uuid',publicId:'FA0AoBO02uU',view:'waiting'};
 const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({data:value,meta:{},error:null}));
 const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>'test-member',fetcher});
 const controller=new AbortController();
 expect(await client.resolveVideoWatch('FA0AoBO02uU',controller.signal)).toEqual(value);
 const request=fetcher.mock.calls[0]![0] as Request;
 expect(new URL(request.url).pathname).toBe('/api/member/videos/FA0AoBO02uU/watch');
 expect(request.headers.get('Authorization')).toBe('Bearer test-member');
 expect(request.cache).toBe('no-store');
 expect(request.redirect).toBe('error');
 controller.abort();expect(request.signal.aborted).toBe(true);
});

it('rejects malformed public IDs before transport and preserves legacy UUID reads',async()=>{
 const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({data:{recordingId:'uuid'},meta:{},error:null}));
 const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher});
 for(const id of ['short','FA0AoBO02uUU','FA0AoBO02u!','FA0AoBO02uU/extra']) {
  await expect(client.resolveVideoWatch(id)).rejects.toMatchObject({status:400,code:'invalid_request'});
 }
 expect(fetcher).not.toHaveBeenCalled();
 expect(await client.resolveRecordingWatch('00000000-0000-4000-8000-000000000001')).toEqual({recordingId:'uuid'});
});
