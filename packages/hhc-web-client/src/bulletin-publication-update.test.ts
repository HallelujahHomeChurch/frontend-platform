import {describe,expect,it,vi} from 'vitest'
import {createHhcWebClient,type BulletinPublicationOutcome} from './client'

const outcome:BulletinPublicationOutcome={status:'preparing',availability:{pdf:true,traditional:true,simplified:true},current:{pdf:true,traditional:true,simplified:false}}
const result={issue:{id:'issue-1',version:8,publicationOutcome:outcome},outcome}

describe('bulletin publication update',()=>{
  it.each([{}, {action:'publish' as const,commandToken:'a'.repeat(64)}, {commandToken:'a'.repeat(64),metadata:{issueNumber:1747,issueDate:'2026-11-15',title:'週報',subtitle:''}}])('sends one source-bound command with the supplied replay key',async input=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({data:result,error:null}))
    const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'token',fetcher})
    const controller=new AbortController()
    await expect(client.updateBulletinPublication('issue-1',7,input,'original-command',controller.signal)).resolves.toEqual(result)
    const request=fetcher.mock.calls[0]![0] as Request
    expect(new URL(request.url).pathname).toBe('/api/admin/bulletins/issue-1/publication-update')
    expect(request.method).toBe('POST')
    expect(request.headers.get('If-Match')).toBe('"7"')
    expect(request.headers.get('Idempotency-Key')).toBe('original-command')
    expect(request.cache).toBe('no-store')
    await expect(request.json()).resolves.toEqual(input)
    controller.abort();expect(request.signal.aborted).toBe(true)
  })
  it('returns a stale-source error without retrying with a different version or command',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({data:null,error:{code:'version_conflict',message:'Changed'}},{status:412}))
    const client=createHhcWebClient({baseUrl:'/api',getAccessToken:()=> 'token',fetcher})
    await expect(client.updateBulletinPublication('issue-1',7,{},'original-command')).rejects.toMatchObject({status:412,code:'version_conflict'})
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
