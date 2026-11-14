import {expect,it,vi} from 'vitest'
import {createServer} from 'node:http'
import {createHhcWebClient,HhcWebApiError} from './client.js'

const edition={issueId:'11111111-1111-4111-8111-111111111111',series:'general',contentLocale:'zh-Hans'} as const
const input={targetDocumentId:'33333333-3333-4333-8333-333333333333',canonicalVersion:12,source:{documentId:edition.issueId,revision:6,contentHash:'a'.repeat(64),onlineVersion:8},publicationOperationId:'22222222-2222-4222-8222-222222222222',revision:4,layoutValidationHash:'b'.repeat(64)}
const success=(data:unknown)=>Response.json({data,meta:{},error:null})

it('sends exact Hans proof and versions through one authenticated no-store abortable request',async()=>{
  const result={receipt:{id:edition.issueId,operationKey:'original-key',documentId:input.targetDocumentId,revision:4,canonicalVersion:12,onlineVersion:9,layoutValidationHash:input.layoutValidationHash,outcome:'published',createdAt:'2026-11-14T00:00:00Z',source:input.source,publicationOperationId:input.publicationOperationId,authorizationId:input.targetDocumentId},publication:{documentId:input.targetDocumentId,version:10,revision:4},replayed:true}
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(success(result))
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'token',fetcher})
  const controller=new AbortController()
  expect(await client.recoverSimplifiedOnlineBulletinPublication(edition,9,input,'original-key',controller.signal)).toEqual(result)
  const request=fetcher.mock.calls[0]![0] as Request
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(new URL(request.url).pathname).toBe(`/api/admin/bulletins/${edition.issueId}/online/general/zh-Hans/recover-publication`)
  expect(request.method).toBe('POST')
  expect(request.headers.get('Authorization')).toBe('Bearer token')
  expect(request.headers.get('If-Match')).toBe('"9"')
  expect(request.headers.get('Idempotency-Key')).toBe('original-key')
  expect(request.cache).toBe('no-store')
  expect(await request.json()).toEqual(input)
  controller.abort();expect(request.signal.aborted).toBe(true)
})

it.each([
  [{...edition,series:'children'},9,input,'key'],[{...edition,contentLocale:'zh-Hant'},9,input,'key'],
  [{...edition,issueId:'not-a-uuid'},9,input,'key'],[edition,0,input,'key'],[edition,1.2,input,'key'],[edition,Number.MAX_SAFE_INTEGER+1,input,'key'],
  [edition,9,{...input,targetDocumentId:'invalid'},'key'],[edition,9,{...input,publicationOperationId:'invalid'},'key'],
  [edition,9,{...input,canonicalVersion:0},'key'],[edition,9,{...input,revision:-1},'key'],
  [edition,9,{...input,source:{...input.source,documentId:'invalid'}},'key'],
  [edition,9,{...input,source:null},'key'],[edition,9,{...input,source:undefined},'key'],
  [edition,9,{...input,source:{...input.source,revision:0}},'key'],[edition,9,{...input,source:{...input.source,onlineVersion:0}},'key'],
  [edition,9,{...input,source:{...input.source,contentHash:'A'.repeat(64)}},'key'],[edition,9,{...input,layoutValidationHash:'x'},'key'],
  [edition,9,input,''],[edition,9,input,'x'.repeat(129)],[edition,9,input,'é'.repeat(65)],[edition,9,input,'😀'.repeat(33)],
  [edition,9,input,'a\uD800b'],[edition,9,input,'a\uDC00b'],
  [edition,9,input,' key'],[edition,9,input,'key\u2003'],[edition,9,input,'\u0085key'],
  ...Array.from({length:32},(_,code)=>[edition,9,input,`a${String.fromCharCode(code)}b`]),
  [edition,9,input,'a\u007fb'],
])('rejects invalid Hans scope/CAS/proof/key before transport (%j)',async(selected,version,proof,key)=>{
  const fetcher=vi.fn<typeof fetch>()
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  await expect(client.recoverSimplifiedOnlineBulletinPublication(selected as never,version as number,proof as typeof input,key as string)).rejects.toMatchObject({status:400,code:'invalid_request'})
  expect(fetcher).not.toHaveBeenCalled()
})

it.each(['x','x'.repeat(128),'ordinary-rn-\\r'])('accepts valid exact key bytes without normalization (%s)',async(key)=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(success({replayed:true}))
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  await client.recoverSimplifiedOnlineBulletinPublication(edition,9,input,key)
  expect((fetcher.mock.calls[0]![0] as Request).headers.get('Idempotency-Key')).toBe(key)
})

it.each(['é'.repeat(64),'確認😀','😀'.repeat(32),'確'.repeat(42)+'é','e\u0301','\uFEFFkey','key\uFEFF'])('sends exact UTF-8 key bytes through real HTTP without normalization (%s)',async(key)=>{
  let received:Buffer|undefined
  const server=createServer((request,response)=>{
    received=Buffer.from(request.headers['idempotency-key'] as string,'latin1')
    response.setHeader('Content-Type','application/json');response.end(JSON.stringify({data:{replayed:true},meta:{},error:null}))
  })
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  try{
    const address=server.address()
    if(!address || typeof address==='string')throw new Error('Missing test server address')
    const client=createHhcWebClient({baseUrl:`http://127.0.0.1:${address.port}`,getAccessToken:()=>null})
    await client.recoverSimplifiedOnlineBulletinPublication(edition,9,input,key)
    expect(received).toEqual(Buffer.from(key,'utf8'))
    expect(received?.toString('utf8')).toBe(key)
  }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
})

it.each([401,409,412,503])('never refreshes or retries a rejected Hans mutation (%i)',async(status)=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({error:{code:'conflict'},meta:{}},{status}))
  const refresh=vi.fn()
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'token',refreshAfterUnauthorized:refresh,fetcher})
  await expect(client.recoverSimplifiedOnlineBulletinPublication(edition,9,input,'key')).rejects.toMatchObject({status})
  expect(fetcher).toHaveBeenCalledTimes(1);expect(refresh).not.toHaveBeenCalled()
})

it('leaves an uncertain outcome for exact caller reconciliation',async()=>{
  const failure=new TypeError('connection closed')
  const fetcher=vi.fn<typeof fetch>().mockRejectedValue(failure)
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  await expect(client.recoverSimplifiedOnlineBulletinPublication(edition,9,input,'key')).rejects.toBe(failure)
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('exposes only deduplicated typed Hans blockers without widening Traditional blockers',async()=>{
  const blockers=['publication_intent_missing','missing_local','source_changed','review_required','incompatible_proof','semantic_proof_missing','layout_not_ready','stale_metadata','mapping_review_required']
  const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>Response.json({error:{code:'recovery_blocked'},meta:{blockers:[...blockers,blockers[0],'pdf_not_published','private arbitrary text',null,{}]}},{status:409}))
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  try{await client.recoverSimplifiedOnlineBulletinPublication(edition,9,input,'key');throw new Error('Expected recovery rejection')}catch(error){
    expect(error).toBeInstanceOf(HhcWebApiError)
    expect((error as HhcWebApiError).simplifiedRecoveryBlockers).toEqual(blockers)
    expect(Object.isFrozen((error as HhcWebApiError).simplifiedRecoveryBlockers)).toBe(true)
    expect((error as HhcWebApiError).blockers).not.toContain('mapping_review_required')
  }
})

it.each([[409,'recovery_blocked',['unknown']],[409,'recovery_blocked','layout_not_ready'],[412,'recovery_blocked',['source_changed']],[409,'conflict',['source_changed']]])('ignores untrusted Hans blocker metadata (%j)',async(status,code,blockers)=>{
  const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({error:{code},meta:{blockers}},{status:status as number}))
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  await expect(client.recoverSimplifiedOnlineBulletinPublication(edition,9,input,'key')).rejects.toMatchObject({simplifiedRecoveryBlockers:undefined})
})

it('preserves independent nullable source-bound history and notification acceptance without defaults',async()=>{
  const derivedPublication={operationId:input.publicationOperationId,source:{documentId:input.source.documentId,revision:6,contentHash:null,metadataHash:null},sourceCurrent:null,status:'cancelled',phase:'publication',conversionJobId:null,resultRevision:4,attempts:null,failureCount:null,createdAt:null,updatedAt:null,nextAttemptAt:null,errorCode:'publication_withdrawn',lastFailure:{code:'simplified_layout_failed',kind:'failure',phase:'layout',at:'2026-11-14T00:00:00Z',attempts:2},history:[],hasMore:false,historyCoverage:'unknown',recovery:null}
  const notification={id:edition.issueId,generation:0,status:'accepted',attempts:null,errorCode:'',canonicalVersion:null,createdAt:null,updatedAt:null,nextAttemptAt:null}
  const legacy={documentId:input.targetDocumentId,version:9,local:null,publishedRevision:null}
  const current={...legacy,derivedPublication,notification}
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(success(legacy)).mockResolvedValueOnce(success(current))
  const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=>null,fetcher})
  expect(await client.getOnlineBulletinState(edition)).toEqual(legacy)
  expect(await client.getOnlineBulletinState(edition)).toEqual(current)
})
