import {describe,expect,it,vi} from 'vitest'
import {createHhcWebClient} from './client.js'
const input={operationKey:'stable-key',expectedRevision:7}
describe('broadcast transport',()=>{
 it('retains operation identity and revision when the caller retries a lost response',async()=>{
  const requests:Request[]=[]
  const fetcher=vi.fn(async(request:Request)=>{requests.push(request);if(requests.length===1)throw new TypeError('Response lost');return Response.json({data:{broadcast:{phase:'start_pending'},receipt:{operationKey:input.operationKey}}})})
  const client=createHhcWebClient({baseUrl:'https://admin.example/api',getAccessToken:()=> 'token',fetcher:fetcher as typeof fetch})
  await expect(client.startBroadcast('recording',input)).rejects.toThrow('Response lost')
  expect((await client.startBroadcast('recording',input)).broadcast.phase).toBe('start_pending')
  expect(await requests[0].json()).toEqual(await requests[1].json())
  expect(requests[1].url).toBe('https://admin.example/api/admin/broadcasts/recording/start')
  expect(requests[1].headers.get('Authorization')).toBe('Bearer token')
 })
 it.each([409,412])('surfaces %s conflicts without a silent mutation retry',async(status)=>{
  const fetcher=vi.fn(async()=>Response.json({error:{code:'broadcast_revision_conflict',message:'Changed'}},{status}))
  const client=createHhcWebClient({baseUrl:'https://admin.example/api',getAccessToken:()=>null,fetcher})
  await expect(client.updateBroadcast('recording',{...input,title:'Draft'})).rejects.toMatchObject({status,code:'broadcast_revision_conflict'})
  expect(fetcher).toHaveBeenCalledOnce()
 })
 it('passes cancellation and never caches the watch resolver',async()=>{
  const abort=new AbortController();let request!:Request
  const client=createHhcWebClient({baseUrl:'https://www.example/api',getAccessToken:()=>null,fetcher:async(value)=>{request=value as Request;return Response.json({data:{view:'waiting'}})}})
  expect((await client.resolveRecordingWatch('outside-loaded-page',abort.signal)).view).toBe('waiting')
  abort.abort();expect(request.signal.aborted).toBe(true);expect(request.cache).toBe('no-store')
 })
})
it('lists upcoming member identities and reads the private pre-live cover',async()=>{
 const requests:Request[]=[];const client=createHhcWebClient({baseUrl:'https://www.example/api',getAccessToken:()=> 'member',fetcher:async value=>{const request=value as Request;requests.push(request);return request.url.includes('broadcast-cover')?new Response(new Blob(['jpeg'],{type:'image/jpeg'})):Response.json({data:{items:[],nextCursor:null}})}})
 expect(await client.listMemberBroadcasts({limit:3,cursor:'next'})).toEqual({items:[],nextCursor:null});expect(requests[0].url).toContain('/member/broadcasts?limit=3&cursor=next')
 const image=await client.getMemberBroadcastCover('event');expect(image.type).toBe('image/jpeg');expect(requests[1].redirect).toBe('error')
})
it('prepares thumbnail bytes for the event owner without modifying persistent defaults',async()=>{
 const requests:Request[]=[];const client=createHhcWebClient({baseUrl:'https://admin.example/api',getAccessToken:()=> 'staff',fetcher:async value=>{requests.push(value as Request);return Response.json({data:{uploadId:'ready',state:'pending'}})}})
 await client.uploadBroadcastCover('event',new Blob(['jpeg'],{type:'image/jpeg'}),'same-key');expect(requests[0].url.endsWith('/admin/broadcasts/event/cover-uploads')).toBe(true);expect(requests[0].headers.get('Idempotency-Key')).toBe('same-key');expect(await requests[0].text()).toBe('jpeg')
 await expect(client.uploadBroadcastCover('event',new Blob(['gif'],{type:'image/gif'}),'same-key')).rejects.toMatchObject({status:422});expect(requests).toHaveLength(1)
})
