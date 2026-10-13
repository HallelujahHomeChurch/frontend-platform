import {describe, expect, it, vi} from 'vitest'
import {readFileSync} from 'node:fs'
import {createHhcWebClient, type BroadcastSourceStreamKeyInput, type BroadcastSourceTargetInput, type BroadcastSourceResolveInput, type BroadcastSourceBindInput} from './index.js'

const recordingId = '00000000-0000-4000-8000-000000000001'
const streamKey = `hhc_stream_${'A'.repeat(43)}`
const metadata = {revision: 4, configured: true, canRotate: true, inputBusy: false, suffix: 'AAAA', targetRecordingId: recordingId}
const keyInput = {operationKey: 'rotate-once', expectedSourceRevision: 3, streamKey}
const targetInput = {operationKey: 'prepare-once', expectedSourceRevision: 3, recordingId, expectedRevision: 7}
const bindingInput = {...targetInput, streamKey, protocolVersion: 'b1-2026-10-10.rc1'}
const resolved = {sourceRevision: 4, recordingId, broadcastRevision: 8}
const mutation = {broadcast: {phase: 'binding_pending'}, binding: null, receipt: {operationKey: targetInput.operationKey}}

describe('reusable broadcast source transport', () => {
  it('round-trips the frozen CMS K2 fixtures unchanged', async () => {
    const wire = JSON.parse(readFileSync(new URL('./fixtures/broadcast-source.json', import.meta.url), 'utf8'))
    const fixtures = Object.fromEntries(wire.fixtures.map((fixture: {name: string; value: unknown}) => [fixture.name, fixture.value]))
    const requests: Request[] = []
    const outputs = [fixtures.idle, fixtures.prepared, fixtures.prepared, fixtures.resolved, mutation]
    const client = createHhcWebClient({baseUrl: 'https://admin.example/api', getAccessToken: () => 'staff', fetcher: async value => {
      requests.push(value as Request)
      return Response.json({data: outputs[requests.length - 1]})
    }})
    expect(await client.getBroadcastSource()).toEqual(fixtures.idle)
    expect(await client.setBroadcastSourceStreamKey(fixtures['set-key'] as BroadcastSourceStreamKeyInput)).toEqual(fixtures.prepared)
    expect(await client.setBroadcastSourceTarget(fixtures.prepare as BroadcastSourceTargetInput)).toEqual(fixtures.prepared)
    expect(await client.resolveBroadcastSource(fixtures.resolve as BroadcastSourceResolveInput)).toEqual(fixtures.resolved)
    expect(await client.bindBroadcastSource(fixtures.bind as BroadcastSourceBindInput)).toEqual(mutation)
    for (const [index, name] of ['set-key', 'prepare', 'resolve', 'bind'].entries()) expect(await requests[index + 1].json()).toEqual(fixtures[name])
  })
  it('uses exact routes, private transport, OAuth, body-only secrets and cancellation', async () => {
    const requests: Request[] = []
    const outputs = [metadata, metadata, metadata, resolved, mutation]
    const client = createHhcWebClient({baseUrl: 'https://admin.example/api', getAccessToken: () => 'staff', fetcher: async value => {
      requests.push(value as Request)
      return Response.json({data: outputs[requests.length - 1]}, {status: requests.length === 5 ? 202 : 200})
    }})
    const controller = new AbortController()
    expect(await client.getBroadcastSource(controller.signal)).toEqual(metadata)
    expect(await client.setBroadcastSourceStreamKey(keyInput, controller.signal)).toEqual(metadata)
    expect(await client.setBroadcastSourceTarget(targetInput, controller.signal)).toEqual(metadata)
    expect(await client.resolveBroadcastSource({streamKey}, controller.signal)).toEqual(resolved)
    expect(await client.bindBroadcastSource(bindingInput, controller.signal)).toEqual(mutation)
    const cases = [['GET', '', undefined], ['PUT', '/stream-key', keyInput], ['PUT', '/target', targetInput], ['POST', '/resolve', {streamKey}], ['POST', '/bindings', bindingInput]] as const
    for (const [index, request] of requests.entries()) {
      const [method, suffix, body] = cases[index]
      expect(request.method).toBe(method)
      expect(request.url).toBe(`https://admin.example/api/admin/broadcast-source${suffix}`)
      expect(request.headers.get('Authorization')).toBe('Bearer staff')
      expect(JSON.stringify([...request.headers])).not.toContain(streamKey)
      expect(request.cache).toBe('no-store')
      expect(request.redirect).toBe('error')
      if (body) expect(await request.json()).toEqual(body)
      else expect(await request.text()).toBe('')
    }
    controller.abort()
    expect(requests.every(request => request.signal.aborted)).toBe(true)
  })

  it('retries an uncertain bind only when asked and keeps the original target and operation', async () => {
    const requests: Request[] = []
    const fetcher = vi.fn(async (request: Request) => {
      requests.push(request)
      if (requests.length === 1) throw new TypeError('Response lost')
      return Response.json({data: mutation})
    })
    const client = createHhcWebClient({baseUrl: 'https://admin.example/api', getAccessToken: () => 'staff', fetcher: fetcher as typeof fetch})
    await expect(client.bindBroadcastSource(bindingInput)).rejects.toThrow('Response lost')
    expect(fetcher).toHaveBeenCalledOnce()
    expect(await client.bindBroadcastSource(bindingInput)).toEqual(mutation)
    for (const request of requests) expect(await request.json()).toEqual(bindingInput)
  })

  it.each([[403, 'broadcast_stream_key_invalid'], [409, 'broadcast_source_not_prepared'], [409, 'broadcast_source_busy'], [409, 'broadcast_operation_conflict'], [412, 'broadcast_revision_conflict'], [503, 'unavailable']])('preserves %s %s without fallback, automatic retries or extra resolving', async (status, code) => {
    const fetcher = vi.fn(async () => Response.json({error: {code, message: 'Request failed'}}, {status: Number(status)}))
    const client = createHhcWebClient({baseUrl: 'https://admin.example/api', getAccessToken: () => 'staff', fetcher})
    await expect(client.bindBroadcastSource(bindingInput)).rejects.toMatchObject({status, code})
    expect(fetcher).toHaveBeenCalledOnce()
  })
})
