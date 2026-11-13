import {expect,it,vi} from 'vitest'
import {createHhcWebClient,HhcWebApiError,type OnlineBulletinRecoveryResult,type OnlineBulletinProduction} from './client.js'

const edition={issueId:'issue',series:'general',contentLocale:'zh-Hant'} as const
const input={canonicalVersion:5,revision:2,layoutValidationHash:'a'.repeat(64)}
const success=(data:unknown)=>Response.json({data,meta:{},error:null})

it('sends explicit PDF-only choice and zero online version through the existing authenticated transport',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(success({status:'queued',onlinePublication:{outcome:'cancelled'}}))
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'admin-token',fetcher})
  const controller=new AbortController()
  const result=await client.publishBulletin('issue',5,{series:'general',locale:'zh-Hant'},{notifySubscribers:false,onlinePublication:'pdf_only',onlineVersion:0},controller.signal)
  const request=fetcher.mock.calls[0]![0] as Request
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(request.method).toBe('POST')
  expect(new URL(request.url).pathname).toBe('/api/admin/bulletins/issue/publish')
  expect(request.headers.get('If-Match')).toBe('"5"')
  expect(request.headers.get('Authorization')).toBe('Bearer admin-token')
  expect(request.cache).toBe('no-store')
  expect(await request.json()).toEqual({series:'general',locale:'zh-Hant',notifySubscribers:false,onlinePublication:'pdf_only',onlineVersion:0})
  expect(result.onlinePublication?.outcome).toBe('cancelled')
  controller.abort();expect(request.signal.aborted).toBe(true)
})

it('preserves omitted legacy publication options and sends continue without creating an online version',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>success({status:'queued'}))
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  await client.publishBulletin('issue',5,{series:'general',locale:'zh-Hant'},{notifySubscribers:true})
  await client.publishBulletin('issue',5,{series:'general',locale:'zh-Hant'},{notifySubscribers:false,onlinePublication:'continue_automatic'})
  expect(await (fetcher.mock.calls[0]![0] as Request).json()).toEqual({series:'general',locale:'zh-Hant',notifySubscribers:true})
  expect(await (fetcher.mock.calls[1]![0] as Request).json()).toEqual({series:'general',locale:'zh-Hant',notifySubscribers:false,onlinePublication:'continue_automatic'})
})

it.each([
  [{series:'general',locale:'zh-Hant'},{onlinePublication:'pdf_only'}],
  [{series:'general',locale:'zh-Hant'},{onlinePublication:'pdf_only',onlineVersion:-1}],
  [{series:'general',locale:'zh-Hant'},{onlinePublication:'pdf_only',onlineVersion:0.5}],
  [{series:'general',locale:'zh-Hans'},{onlinePublication:'pdf_only',onlineVersion:0}],
  [{series:'children',locale:'zh-Hant'},{onlinePublication:'continue_automatic'}],
  [{series:'general',locale:'zh-Hant'},{onlinePublication:'unknown'}],
  [{series:'general',locale:'zh-Hant'},{onlinePublication:'continue_automatic',onlineVersion:3}],
  [{series:'general',locale:'zh-Hant'},{onlineVersion:3}],
])('rejects invalid explicit PDF publication before sending (%j, %j)',async(edition,options)=>{
  const fetcher=vi.fn<typeof fetch>()
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  await expect(client.publishBulletin('issue',5,edition as never,{notifySubscribers:false,...options} as never)).rejects.toMatchObject({status:400,code:'invalid_request'})
  expect(fetcher).not.toHaveBeenCalled()
})

it('recovers only the exact qualified draft with CAS, caller idempotency key and a single no-store request',async()=>{
  const result:OnlineBulletinRecoveryResult={receipt:{id:'receipt',operationKey:'recovery-key',documentId:'document',revision:2,canonicalVersion:5,onlineVersion:3,layoutValidationHash:input.layoutValidationHash,outcome:'published',createdAt:'2026-11-13T00:00:00Z'},publication:{documentId:'document',version:4,revision:2},replayed:false}
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(success(result))
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'admin-token',fetcher})
  const controller=new AbortController()
  expect(await client.recoverOnlineBulletinPublication(edition,3,input,'recovery-key',controller.signal)).toEqual(result)
  expect(fetcher).toHaveBeenCalledTimes(1)
  const request=fetcher.mock.calls[0]![0] as Request
  expect(new URL(request.url).pathname).toBe('/api/admin/bulletins/issue/online/general/zh-Hant/recover-publication')
  expect(request.method).toBe('POST')
  expect(request.headers.get('If-Match')).toBe('"3"')
  expect(request.headers.get('Idempotency-Key')).toBe('recovery-key')
  expect(request.headers.get('Authorization')).toBe('Bearer admin-token')
  expect(request.cache).toBe('no-store')
  expect(await request.json()).toEqual(input)
  controller.abort();expect(request.signal.aborted).toBe(true)
})

it.each([409,412,401,503])('does not retry a recovery rejected with %i',async(status)=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({data:null,error:{code:'conflict',message:'Refresh state'},meta:{}},{status}))
  const refresh=vi.fn()
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'admin-token',refreshAfterUnauthorized:refresh,fetcher})
  await expect(client.recoverOnlineBulletinPublication(edition,3,input,'key')).rejects.toBeInstanceOf(HhcWebApiError)
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(refresh).not.toHaveBeenCalled()
})

it.each([409,412,401,503])('does not retry explicit PDF publication rejected with %i',async(status)=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({data:null,error:{code:'conflict',message:'Refresh state'},meta:{}},{status}))
  const refresh=vi.fn()
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'admin-token',refreshAfterUnauthorized:refresh,fetcher})
  await expect(client.publishBulletin('issue',5,{series:'general',locale:'zh-Hant'},{notifySubscribers:false,onlinePublication:'pdf_only',onlineVersion:3})).rejects.toMatchObject({status,code:'conflict'})
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(refresh).not.toHaveBeenCalled()
})

it('leaves an uncertain recovery network outcome to caller reconciliation without another mutation',async()=>{
  const failure=new TypeError('connection closed')
  const fetcher=vi.fn<typeof fetch>().mockRejectedValue(failure)
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  await expect(client.recoverOnlineBulletinPublication(edition,3,input,'key')).rejects.toBe(failure)
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('retains only allowlisted structured recovery blockers and existing version hints',async()=>{
  const blockers=['missing_local','pdf_not_published','source_changed','stale_metadata','review_required','incompatible_proof','layout_not_ready','semantic_proof_missing']
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({data:null,error:{code:'recovery_blocked',message:'Review qualification'},meta:{currentVersion:7,canonicalVersion:9,blockers:[...blockers,'private arbitrary text',{code:'source_changed'},null]}},{status:409}))
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  await expect(client.recoverOnlineBulletinPublication(edition,3,input,'key')).rejects.toMatchObject({status:409,code:'recovery_blocked',currentVersion:7,canonicalVersion:9,blockers})
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it.each([{blockers:'layout_not_ready'},{blockers:{code:'source_changed'}},{blockers:['unknown']},{blockers:[]},{blockers:null}])('ignores unstructured or unknown recovery blocker metadata (%j)',async({blockers})=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({data:null,error:{code:'recovery_blocked',message:'Review qualification'},meta:{blockers}},{status:409}))
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  await expect(client.recoverOnlineBulletinPublication(edition,3,input,'key')).rejects.toMatchObject({blockers:undefined})
})

it('does not interpret blocker-like metadata from an unrelated failure',async()=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({data:null,error:{code:'version_conflict',message:'Refresh'},meta:{blockers:['source_changed']}},{status:409}))
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  await expect(client.recoverOnlineBulletinPublication(edition,3,input,'key')).rejects.toMatchObject({blockers:undefined})
})

it('accepts older admin responses without capabilities or progress, and preserves optional server progress',async()=>{
  const legacy={documentId:'document',version:3,local:null,publishedRevision:null}
  const production:OnlineBulletinProduction={sourceIdentity:'a'.repeat(64),jobId:'job',attemptId:'attempt',progressVersion:2,phase:'recognition',status:'running',totalPages:null,currentPage:null,verifiedPages:0,subphase:'recognition',startedAt:null,lastProgressAt:null,heartbeatAt:null,observedAt:'2026-11-13T00:00:00Z',verifiedReuseCount:0}
  const current={...legacy,capabilities:{explicitOnlinePublication:false,qualifiedDraftRecovery:false},production}
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(success(legacy)).mockResolvedValueOnce(success(current))
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  expect(await client.getOnlineBulletinState(edition)).toEqual(legacy)
  expect(await client.getOnlineBulletinState(edition)).toEqual(current)
})

it('returns the original replay outcome without treating it as current publication state',async()=>{
  const result:OnlineBulletinRecoveryResult={receipt:{id:'original',operationKey:'original-key',documentId:'document',revision:2,canonicalVersion:5,onlineVersion:3,layoutValidationHash:input.layoutValidationHash,outcome:'published',createdAt:'2026-11-13T00:00:00Z'},publication:{documentId:'document',version:4,revision:2},replayed:true}
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(success(result))
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  expect(await client.recoverOnlineBulletinPublication(edition,3,input,'original-key')).toEqual(result)
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it.each(['return-key','normal-key',String.fromCharCode(92)+'r'])('accepts ordinary r/n and literal backslash key characters (%s)',async(key)=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(success({replayed:true}))
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  await client.recoverOnlineBulletinPublication(edition,3,input,key)
  expect((fetcher.mock.calls[0]![0] as Request).headers.get('Idempotency-Key')).toBe(key)
})

it.each([
  [edition,0,input,'key'],[edition,0.5,input,'key'],
  [{...edition,contentLocale:'zh-Hans'},3,input,'key'],
  [edition,3,{...input,canonicalVersion:0},'key'],
  [edition,3,{...input,revision:0},'key'],
  [edition,3,{...input,layoutValidationHash:'invalid'},'key'],
  [edition,3,{...input,layoutValidationHash:'A'.repeat(64)},'key'],
  [edition,3,input,''],[edition,3,input,'x'.repeat(129)],
  [edition,3,input,'bad'+String.fromCharCode(13)+'key'],[edition,3,input,'bad'+String.fromCharCode(10)+'key'],
  [edition,3,input,' key'],[edition,3,input,'key '],[edition,3,input,'é'.repeat(65)],
])('rejects invalid recovery boundaries before transport (%j)',async(edition,version,input,key)=>{
  const fetcher=vi.fn<typeof fetch>()
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  await expect(client.recoverOnlineBulletinPublication(edition as never,version as number,input as typeof input,key as string)).rejects.toMatchObject({status:400,code:'invalid_request'})
  expect(fetcher).not.toHaveBeenCalled()
})
