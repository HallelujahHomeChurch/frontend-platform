import {describe, expect, it, vi} from 'vitest'
import {createHhcWebClient} from './index.js'

const recordingId = '00000000-0000-4000-8000-000000000001'
const streamKey = `hhc_live_${recordingId}_${'A'.repeat(43)}`
const input = {operationKey: 'stable-operation', expectedRevision: 7, streamKey}
const metadata = {configured: true, canRotate: true, revision: 8, suffix: 'AAAA'}

describe('broadcast stream key transport', () => {
  it('reads private metadata with authorization and cancellation', async () => {
    let request!: Request
    const controller = new AbortController()
    const client = createHhcWebClient({baseUrl: 'https://admin.example/api', getAccessToken: () => 'staff', fetcher: async value => {
      request = value as Request
      return Response.json({data: metadata})
    }})
    expect(await client.getBroadcastStreamKey(recordingId, controller.signal)).toEqual(metadata)
    expect(request.method).toBe('GET')
    expect(request.url).toBe(`https://admin.example/api/admin/broadcasts/${recordingId}/stream-key`)
    expect(request.headers.get('Authorization')).toBe('Bearer staff')
    expect(request.cache).toBe('no-store')
    expect(request.redirect).toBe('error')
    controller.abort()
    expect(request.signal.aborted).toBe(true)
  })

  it('keeps a lost-response retry key and operation identical, in the body only', async () => {
    const requests: Request[] = []
    const fetcher = vi.fn(async (value: Request) => {
      requests.push(value)
      if (requests.length === 1) throw new TypeError('Response lost')
      return Response.json({data: metadata})
    })
    const client = createHhcWebClient({baseUrl: 'https://admin.example/api', getAccessToken: () => 'staff', fetcher: fetcher as typeof fetch})
    await expect(client.setBroadcastStreamKey(recordingId, input)).rejects.toThrow('Response lost')
    expect(fetcher).toHaveBeenCalledOnce()
    expect(await client.setBroadcastStreamKey(recordingId, input)).toEqual(metadata)
    for (const request of requests) {
      expect(request.method).toBe('PUT')
      expect(request.url).toBe(`https://admin.example/api/admin/broadcasts/${recordingId}/stream-key`)
      expect(request.url).not.toContain(streamKey)
      expect(JSON.stringify([...request.headers])).not.toContain(streamKey)
      expect(request.redirect).toBe('error')
      expect(request.cache).toBe('no-store')
      expect(await request.json()).toEqual(input)
    }
  })

  it('preserves accepted null bindings and the existing B1 envelope', async () => {
    let request!: Request
    const result = {broadcast: {phase: 'binding_pending'}, binding: null, receipt: {operationKey: input.operationKey}}
    const client = createHhcWebClient({baseUrl: 'https://admin.example/api', getAccessToken: () => 'staff', fetcher: async value => {
      request = value as Request
      return Response.json({data: result}, {status: 202})
    }})
    const controller = new AbortController()
    const bindingInput = {...input, protocolVersion: 'b1-2026-10-10.rc1'}
    expect(await client.bindBroadcastStreamKey(recordingId, bindingInput, controller.signal)).toEqual(result)
    expect(request.method).toBe('POST')
    expect(request.url).toBe(`https://admin.example/api/admin/broadcasts/${recordingId}/stream-key-bindings`)
    expect(await request.json()).toEqual(bindingInput)
    expect(request.redirect).toBe('error')
    expect(request.cache).toBe('no-store')
    controller.abort()
    expect(request.signal.aborted).toBe(true)
  })

  it.each([403, 409, 412])('surfaces %s without retrying or falling back to unkeyed binding', async status => {
    const fetcher = vi.fn(async () => Response.json({error: {code: 'broadcast_stream_key_invalid', message: 'Invalid key'}}, {status}))
    const client = createHhcWebClient({baseUrl: 'https://admin.example/api', getAccessToken: () => 'staff', fetcher})
    await expect(client.bindBroadcastStreamKey(recordingId, {...input, protocolVersion: 'b1-2026-10-10.rc1'})).rejects.toMatchObject({status, code: 'broadcast_stream_key_invalid'})
    expect(fetcher).toHaveBeenCalledOnce()
  })
})
