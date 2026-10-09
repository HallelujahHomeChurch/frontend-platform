import {describe,it,expect,vi} from 'vitest'
import {createHhcWebClient} from './client'

describe('live thumbnail client',()=>{
 it('uses scoped authenticated reads, revision fencing and raw image uploads',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async(request)=>{
   const r=request as Request
   if(r.url.endsWith('/content')||r.url.endsWith('/cover'))return new Response('jpeg',{headers:{'Content-Type':'image/jpeg'}})
   return Response.json({data:{revision:2,selection:{mode:'auto'},coverState:'waiting',uploadId:'upload-1',state:'ready'},meta:{},error:null})
  })
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'test-auth',fetcher}),signal=new AbortController().signal
  const scope={recordingId:'recording-1',captureId:'a'.repeat(32)}
  await client.getLiveCoverSettings('defaults',signal)
  await client.setLiveCoverSettings(scope,1,{mode:'auto'},'operation-1',signal)
  await client.uploadLiveCover(scope,new Blob(['image'],{type:'image/png'}),'upload-key',signal)
  await client.getLiveCoverUpload(scope,'upload-1',signal)
  await client.getLiveCoverContent(scope,undefined,signal)
  await client.getMemberLiveCover('recording-1',scope.captureId,signal)
  const requests=fetcher.mock.calls.map(call=>call[0] as Request)
  expect(requests.map(r=>r.method)).toEqual(['GET','PUT','POST','GET','GET','GET'])
  expect(requests[1]!.headers.get('If-Match')).toBe('"1"')
  expect(requests[1]!.headers.get('Idempotency-Key')).toBe('operation-1')
  expect(await requests[2]!.text()).toBe('image')
  expect(requests.every(r=>r.cache==='no-store'&&r.headers.get('Authorization')==='Bearer test-auth')).toBe(true)
 })
 it('rejects unsupported images before any request',async()=>{
  const fetcher=vi.fn<typeof fetch>(),client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'test-auth',fetcher})
  await expect(client.uploadLiveCover('defaults',new Blob(['gif'],{type:'image/gif'}),'key')).rejects.toMatchObject({code:'invalid_cover'})
  expect(fetcher).not.toHaveBeenCalled()
 })
 it.each([401,409,412])('preserves typed %i settings errors',async(status)=>{
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'test-auth',fetcher:vi.fn().mockResolvedValue(Response.json({data:null,error:{code:'version_conflict',message:'Changed'}},{status}))})
  await expect(client.setLiveCoverSettings('defaults',1,{mode:'auto'},'same-key')).rejects.toMatchObject({status,code:'version_conflict'})
 })
 it('passes cancellation to the private image request and rejects oversized inputs locally',async()=>{
  const abort=new AbortController()
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async(request)=>{
   const r=request as Request
   expect(r.redirect).toBe('error')
   return new Promise((_,reject)=>r.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))
  })
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'test-auth',fetcher})
  const result=client.getLiveCoverContent('defaults','image',abort.signal)
  await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());abort.abort()
  await expect(result).rejects.toMatchObject({name:'AbortError'})
  await expect(client.uploadLiveCover('defaults',new Blob([new Uint8Array(5*1024*1024+1)],{type:'image/jpeg'}),'key')).rejects.toMatchObject({code:'invalid_cover'})
  expect(fetcher).toHaveBeenCalledOnce()
 })

})
