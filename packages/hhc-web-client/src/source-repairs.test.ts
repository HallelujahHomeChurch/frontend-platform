import {expect,it,vi} from 'vitest'
import {createHhcWebClient} from './client.js'

it('uses authenticated no-store source reads and exact-CAS bounded repair inputs',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>Response.json({data:{status:'saved'},meta:{},error:null}))
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'admin-token',fetcher})
  const edition={issueId:'issue',series:'general',contentLocale:'zh-Hant'} as const,controller=new AbortController()
  await client.getOnlineBulletinSourceParts(edition,controller.signal)
  const input={canonicalVersion:5,revision:2,sourceChecksum:'a'.repeat(64),partId:'b'.repeat(64),componentId:'body',remove:true}
  await client.repairOnlineBulletinSource(edition,3,input,controller.signal)
  const [read,write]=fetcher.mock.calls.map(call=>call[0] as Request)
  expect(new URL(read!.url).pathname).toBe('/api/admin/bulletins/issue/online/general/zh-Hant/source-parts')
  expect(new URL(write!.url).pathname).toBe('/api/admin/bulletins/issue/online/general/zh-Hant/source-repairs')
  expect(write!.method).toBe('POST');expect(write!.headers.get('If-Match')).toBe('"3"')
  expect(await write!.json()).toEqual(input)
  for(const request of [read!,write!]){expect(request.cache).toBe('no-store');expect(request.headers.get('Authorization')).toBe('Bearer admin-token')}
  controller.abort();expect(read!.signal.aborted&&write!.signal.aborted).toBe(true)
})
