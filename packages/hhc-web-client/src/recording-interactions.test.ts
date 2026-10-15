import {expect,it} from 'vitest'
import {createHhcWebClient} from './client.js'
it('preserves comment mutation identities, CAS and metric payload through protected no-store routes',async()=>{
 const requests:Request[]=[]
 const api=createHhcWebClient({baseUrl:'https://www.example/api',getAccessToken:()=> 'member',fetcher:async value=>{requests.push(value as Request);return Response.json({data:{}})}})
 const input={clientMutationId:'00000000-0000-4000-8000-000000000001',text:'Plain <text>'}
 await api.createRecordingComment('recording',input)
 await api.createRecordingComment('recording',input)
 await api.listRecordingComments('recording',{order:'oldest',parentId:'parent',limit:20})
 await api.updateRecordingComment('recording','comment',{text:'Changed',expectedRevision:3})
 await api.deleteRecordingComment('recording','comment',{expectedRevision:4})
 await api.setRecordingLike('recording',{liked:false})
 await api.recordPlaybackHeartbeat('recording',{playbackSessionId:input.clientMutationId,sequence:1,state:'playing',position:120,deltaPlayingMs:15000})
 expect(await requests[0].json()).toEqual(input)
 expect(await requests[1].json()).toEqual(input)
 expect(new URL(requests[2].url).searchParams.get('parentId')).toBe('parent')
 expect(await requests[4].json()).toEqual({expectedRevision:4})
 expect(requests.map(r=>r.method)).toEqual(['POST','POST','GET','PATCH','DELETE','PUT','POST'])
 for(const request of requests){expect(request.cache).toBe('no-store');expect(request.redirect).toBe('error');expect(request.headers.get('Authorization')).toBe('Bearer member')}
})
