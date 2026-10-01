import {describe, expect, it, vi} from 'vitest'
import {createHhcWebClient} from './client'

const input = {issueId:'b08a80e8-6388-4166-9a2a-23d336f74b7a',series:'general',locale:'zh-Hant',clientRequestId:'94aff842-b88a-4942-8ecb-2817955fa9de',revision:2,receiptId:'4a5df71f-6bdc-467c-8879-68ec251fdc26'} as const
async function response(body = JSON.stringify({data:{document:{revision:2},access:{revision:2}},meta:{},error:null})) {
  const bytes = new TextEncoder().encode(body)
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('')
  return new Response(body,{headers:{'Content-Type':'application/json','X-HHC-Content-SHA256':digest}})
}

describe('member reader client',()=>{
  it('forwards bearer, exact selectors, cancellation and unchanged retry identity without caching',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>response())
    const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'member-token',fetcher})
    const controller=new AbortController()
    for(let i=0;i<2;i++) expect(await client.openOnlineBulletin({...input,signal:controller.signal})).toMatchObject({document:{revision:2}})
    await client.listOnlineBulletinDiscovery({series:'general',locale:'zh-Hant',offset:20,limit:10,issueNumber:1739,signal:controller.signal})
    const requests=fetcher.mock.calls.map(c=>c[0] as Request)
    expect(requests[0]!.url).toContain(`/member/bulletins/${input.issueId}/versions/zh-Hant/online/access?series=general`)
    expect(requests[2]!.url).toContain('/member/bulletins/online?series=general&locale=zh-Hant&offset=20&limit=10&issueNumber=1739')
    for(const req of requests) {expect(req.cache).toBe('no-store');expect(req.headers.get('Authorization')).toBe('Bearer member-token')}
    expect(await requests[0]!.json()).toEqual({revision:2,clientRequestId:input.clientRequestId,receiptId:input.receiptId})
    expect(await requests[1]!.json()).toEqual({revision:2,clientRequestId:input.clientRequestId,receiptId:input.receiptId})
    controller.abort()
    expect(requests.every(r=>r.signal.aborted)).toBe(true)
  })
  it.each([401,404,503])('preserves typed %i and only marks owner not_found terminal',async status=>{
    for(const marker of ['', 'unavailable']) {
      const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({error:{code:'not_found',message:'Unavailable'}}),{status,headers:{'Content-Type':'application/json','X-HHC-Bulletin-Access':marker}}))
      const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'token',fetcher})
      await expect(client.openOnlineBulletin(input)).rejects.toMatchObject({status,code:'not_found',bulletinUnavailable:status===404&&marker==='unavailable'})
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
  })
  it('fails closed on missing or mismatched digest, invalid JSON, content type and bounded length',async()=>{
    for(const kind of ['missing','mismatch','json','type','length','truncated']) {
      const value=await response(kind==='json'?'invalid':undefined)
      if(kind==='missing')value.headers.delete('X-HHC-Content-SHA256')
      if(kind==='mismatch')value.headers.set('X-HHC-Content-SHA256','a'.repeat(64))
      if(kind==='type')value.headers.set('Content-Type','text/html')
      if(kind==='length')value.headers.set('Content-Length',String(9*1024*1024+1))
      if(kind==='truncated')value.headers.set('Content-Length','10000')
      const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'token',fetcher:vi.fn().mockResolvedValue(value)})
      await expect(client.openOnlineBulletin(input)).rejects.toMatchObject({code:'invalid_response'})
    }
  })
})
