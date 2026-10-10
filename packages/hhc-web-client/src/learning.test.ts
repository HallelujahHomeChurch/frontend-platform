import {describe, expect, it, vi} from 'vitest'
import {createHhcWebClient} from './client'

const signature = 'a'.repeat(64)

describe('private bulletin learning rules', () => {
  it('uses human auth, private reads, abort and versioned controls', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({data: {}, meta: {}, error: null}))
    const client = createHhcWebClient({baseUrl: '/api', getAccessToken: () => 'admin-token', fetcher})
    const controller = new AbortController()
    await client.listBulletinLearningRules(undefined, controller.signal)
    await client.listBulletinLearningRules(signature, controller.signal)
    await client.getBulletinLearningRule(signature, controller.signal)
    await client.setBulletinLearningRuleEnabled(signature, 7, false, controller.signal)
    await client.setBulletinLearningRuleEnabled(signature, 8, true, controller.signal)
    const requests = fetcher.mock.calls.map(call => call[0] as Request)
    expect(requests.map(request => new URL(request.url).pathname)).toEqual([
      '/api/admin/bulletin-learning-rules', '/api/admin/bulletin-learning-rules',
      ...Array(3).fill(`/api/admin/bulletin-learning-rules/${signature}`),
    ])
    expect(new URL(requests[0]!.url).search).toBe('')
    expect(new URL(requests[1]!.url).searchParams.get('cursor')).toBe(signature)
    expect(requests.map(request => request.method)).toEqual(['GET', 'GET', 'GET', 'PUT', 'PUT'])
    for (const request of requests) {
      expect(request.cache).toBe('no-store')
      expect(request.headers.get('Authorization')).toBe('Bearer admin-token')
    }
    expect(requests[3]!.headers.get('If-Match')).toBe('"7"')
    expect(await requests[3]!.json()).toEqual({enabled: false})
    expect(await requests[4]!.json()).toEqual({enabled: true})
    controller.abort()
    expect(requests.every(request => request.signal.aborted)).toBe(true)
  })

  it('rejects unsafe paths and versions before sending requests', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const client = createHhcWebClient({baseUrl: '/api', getAccessToken: () => 'admin-token', fetcher})
    for (const value of ['../template-settings', 'A'.repeat(64), 'a'.repeat(63)]) {
      await expect(client.listBulletinLearningRules(value)).rejects.toThrow()
      await expect(client.getBulletinLearningRule(value)).rejects.toThrow()
      await expect(client.setBulletinLearningRuleEnabled(value, 1, true)).rejects.toThrow()
    }
    for (const version of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(client.setBulletinLearningRuleEnabled(signature, version, true)).rejects.toThrow()
    }
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('does not retry a stale administrator decision', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({data: null, meta: {}, error: {code: 'precondition_failed', message: 'Conflict'}}, {status: 412}))
    const client = createHhcWebClient({baseUrl: '/api', getAccessToken: () => 'admin-token', fetcher})
    await expect(client.setBulletinLearningRuleEnabled(signature, 1, false)).rejects.toMatchObject({status: 412})
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
