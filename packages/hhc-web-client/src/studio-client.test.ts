import {expect, it} from 'vitest'
import {createHhcWebClient} from './client.js'

it('uses source-scoped authenticated mutations without redirects or implicit retries', async () => {
  const requests: Request[] = []
  const api = createHhcWebClient({baseUrl:'https://admin.example/api',getAccessToken:()=> 'staff',fetcher:async value=>{
    requests.push(value as Request)
    return Response.json({data:{id:'source'}})
  }})
  const input = {operationKey:'one',expectedRevision:2,name:'Main'}
  await api.listStudioSources()
  await api.createStudioSource({...input,streamKey:'test-key'})
  await api.renameStudioSource('source',input)
  await api.setStudioSourceKey('source',{...input,streamKey:'test-key'})
  await api.ensureDirectBroadcast('source',input)
  await api.prepareStudioSource('source',{operationKey:'prepare',expectedSourceRevision:2,expectedRevision:1,recordingId:'recording'})
  await api.getStudioBroadcast('recording')
  await api.createStudioSchedule({operationKey:'schedule',sourceId:'source',title:'Sunday',description:'',scheduledAt:'2026-10-18T01:00:00Z'})
  await api.deleteStudioSource('source',input)
  expect(requests.map(r=>[r.method,new URL(r.url).pathname])).toEqual([
    ['GET','/api/admin/broadcast-sources'],['POST','/api/admin/broadcast-sources'],
    ['PATCH','/api/admin/broadcast-sources/source'],['PUT','/api/admin/broadcast-sources/source/stream-key'],
    ['POST','/api/admin/broadcast-sources/source/direct/ensure'],['PUT','/api/admin/broadcast-sources/source/target'],
    ['GET','/api/admin/broadcasts/recording/studio'],['POST','/api/admin/studio/broadcasts'],['DELETE','/api/admin/broadcast-sources/source'],
  ])
  for(const r of requests){expect(r.cache).toBe('no-store');expect(r.redirect).toBe('error');expect(r.headers.get('Authorization')).toBe('Bearer staff')}
  expect(await requests[2].json()).toEqual(input)
})
