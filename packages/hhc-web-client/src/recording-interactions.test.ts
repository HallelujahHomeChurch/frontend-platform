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
it('sends targeted replies, top refresh and nullable reaction desired state',async()=>{
 const requests:Request[]=[]
 const api=createHhcWebClient({baseUrl:'https://www.example/api',getAccessToken:()=> 'member',fetcher:async value=>{requests.push(value as Request);return Response.json({data:{likes:0,reaction:null}})}})
 await api.setRecordingCommentReaction('r','c',{reaction:null})
 await api.listRecordingComments('r',{order:'top',refresh:true})
 await api.createRecordingComment('r',{clientMutationId:'mutation',parentId:'root',replyToId:'reply',text:'Hello'})
 await api.listMemberBroadcasts({q:'next meeting'})
 expect(requests[0].method).toBe('PUT');expect(new URL(requests[0].url).pathname).toBe('/api/member/recordings/r/comments/c/reaction')
 expect(await requests[0].json()).toEqual({reaction:null})
 expect(new URL(requests[1].url).searchParams.get('refresh')).toBe('true')
 expect(await requests[2].json()).toMatchObject({parentId:'root',replyToId:'reply'})
 expect(new URL(requests[3].url).searchParams.get('q')).toBe('next meeting')
})
it('opts into threaded pages while keeping the legacy query unchanged',async()=>{
 const requests:Request[]=[]
 const comment={id:'child',parentId:'root',threadParentId:'parent',text:'Reply',displayName:'Member',createdAt:'2026-10-24T00:00:00Z',revision:1,deleted:false,hidden:false,mine:false,replyCount:0,directChildCount:1,descendantReplyCount:2,replyPreviewAuthors:[{displayName:'Preview',avatarUrl:'https://example.test/avatar'}]}
 const api=createHhcWebClient({baseUrl:'https://www.example/api',getAccessToken:()=> 'member',fetcher:async value=>{requests.push(value as Request);return Response.json({data:{items:[comment],nextCursor:'next'}})}})
 const page=await api.listRecordingComments('recording',{view:'threaded',parentId:'parent',cursor:'cursor',order:'oldest',limit:20})
 const query=new URL(requests[0].url).searchParams
 expect(Object.fromEntries(query)).toEqual({parentId:'parent',view:'threaded',cursor:'cursor',order:'oldest',limit:'20'})
 expect(page.items[0]).toEqual(comment);expect(page.nextCursor).toBe('next')
 expect(requests[0].cache).toBe('no-store');expect(requests[0].headers.get('Authorization')).toBe('Bearer member')
 await api.listRecordingComments('recording',{parentId:'root'})
 expect(new URL(requests[1].url).searchParams.has('view')).toBe(false)
})
