import {expect, it, vi} from 'vitest'
import {createHhcWebClient} from './client.js'

const values = {visionMission:'遍地華人興起、福音傳到地極',visionFellowship:'共同生活、愛與成全、恩膏傳承',visionCommitment:'宣教主導、靈恩神學、團隊事奉、門徒訓練'}

it('uses exact private settings routes with CAS, no-store and unchanged values', async () => {
  const requests: Request[] = []
  const fetcher = vi.fn<typeof fetch>(async request => {
    const req=request as Request
    requests.push(req)
    const data=req.url.endsWith('/revisions')?[{...values,version:7,createdBy:'editor',createdAt:'2026-10-10T00:00:00Z'}]:{...values,version:req.method==='PUT'?8:7}
    return Response.json({data,meta:{},error:null})
  })
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'human-token',fetcher})
  const controller=new AbortController()
  await expect(client.getBulletinTemplateSettings(controller.signal)).resolves.toEqual({...values,version:7})
  await expect(client.saveBulletinTemplateSettings(7,values,controller.signal)).resolves.toEqual({...values,version:8})
  await expect(client.listBulletinTemplateSettingsRevisions(controller.signal)).resolves.toEqual([{...values,version:7,createdBy:'editor',createdAt:'2026-10-10T00:00:00Z'}])
  expect(requests.map(r=>[r.method,new URL(r.url).pathname,r.cache])).toEqual([
    ['GET','/api/admin/bulletins/template-settings','no-store'],
    ['PUT','/api/admin/bulletins/template-settings','no-store'],
    ['GET','/api/admin/bulletins/template-settings/revisions','no-store'],
  ])
  expect(requests.every(r=>r.headers.get('Authorization')==='Bearer human-token')).toBe(true)
  expect(requests[1]!.headers.get('If-Match')).toBe('"7"')
  expect(await requests[1]!.json()).toEqual(values)
  controller.abort()
  expect(requests.every(r=>r.signal.aborted)).toBe(true)
})

it('propagates a stale settings conflict without retrying or overwriting', async () => {
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json({data:null,meta:{currentVersion:9},error:{code:'version_conflict',message:'Changed'}},{status:412}))
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'human-token',fetcher})
  await expect(client.saveBulletinTemplateSettings(7,values)).rejects.toMatchObject({status:412,code:'version_conflict',currentVersion:9})
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it.each([0,-1,1.5,Number.NaN,Number.POSITIVE_INFINITY,Number.MAX_SAFE_INTEGER+1])('rejects unsafe settings version %s before sending', async version => {
  const fetcher=vi.fn<typeof fetch>()
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  await expect(client.saveBulletinTemplateSettings(version,values)).rejects.toThrow('Invalid bulletin template settings version')
  expect(fetcher).not.toHaveBeenCalled()
})
