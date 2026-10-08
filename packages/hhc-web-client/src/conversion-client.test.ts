import {expect, it, vi} from 'vitest'
import {createHhcWebClient} from './client.js'

it('queues the exact Simplified edition with independent target and source versions', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({data: {documentId: 'target', version: 1, job: {status: 'queued'}}, meta: {}, error: null}), {status: 202, headers: {'Content-Type': 'application/json'}}))
  const client = createHhcWebClient({baseUrl: '/api', getAccessToken: () => 'token', fetcher})
  const controller = new AbortController()
  const input = {canonicalVersion: 5, sourceOnlineVersion: 3, sourceRevision: 2}
  await client.startOnlineBulletinConversion({issueId: 'issue', series: 'general', contentLocale: 'zh-Hans'}, 0, input, controller.signal)
  const request = fetcher.mock.calls[0]![0] as Request
  expect(request.url).toContain('/online/general/zh-Hans/conversions')
  expect(request.headers.get('If-Match')).toBe('"0"')
  expect(request.headers.get('Authorization')).toBe('Bearer token')
  expect(request.cache).toBe('no-store')
  expect(await request.json()).toEqual(input)
  controller.abort()
  expect(request.signal.aborted).toBe(true)
})
