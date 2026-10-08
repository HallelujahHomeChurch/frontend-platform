import {expect, it, vi} from 'vitest'
import {createHhcWebClient} from './client'

it('keeps live grants, capture status and independent controls authenticated and uncached', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({data: {}, meta: {}, error: null}))
  const client = createHhcWebClient({baseUrl: '/api', getAccessToken: () => 'member-token', fetcher})
  const controller = new AbortController()
  await client.listMemberLivestreams(controller.signal)
  await client.issueLiveRecordingPlayback('rec-1', 'capture-1', 'scope-1', controller.signal)
  await client.getRecordingCapture('rec-1', 'capture-1', {cursor: '720p/init.mp4', limit: 100, signal: controller.signal})
  await client.closeRecordingLive('rec-1', 'capture-1', 'close-key', controller.signal)
  await client.cancelRecordingAutoPublish('rec-1', 'capture-1', 'cancel-key', controller.signal)
  const requests = fetcher.mock.calls.map(([request]) => request as Request)
  expect(requests.map(request => request.method)).toEqual(['GET', 'POST', 'GET', 'DELETE', 'DELETE'])
  expect(requests.map(request => new URL(request.url).pathname)).toEqual([
    '/api/member/recordings/live', '/api/member/recordings/rec-1/live/playback',
    '/api/admin/recordings/rec-1/captures/capture-1',
    '/api/admin/recordings/rec-1/captures/capture-1/live',
    '/api/admin/recordings/rec-1/captures/capture-1/auto-publish',
  ])
  expect(await requests[1]!.json()).toEqual({captureId: 'capture-1', playbackScopeId: 'scope-1'})
  expect(new URL(requests[2]!.url).searchParams.get('cursor')).toBe('720p/init.mp4')
  expect(new URL(requests[2]!.url).searchParams.get('limit')).toBe('100')
  expect(await requests[3]!.json()).toEqual({operationKey: 'close-key'})
  expect(await requests[4]!.json()).toEqual({operationKey: 'cancel-key'})
  for (const request of requests) {
    expect(request.cache).toBe('no-store')
    expect(request.headers.get('Authorization')).toBe('Bearer member-token')
  }
  controller.abort()
  expect(requests.every(request => request.signal.aborted)).toBe(true)
})

it('surfaces an expired capture without retrying or silently creating a new scope', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({data: null, meta: {}, error: {code: 'capture_expired', message: 'Expired'}}, {status: 410}))
  const client = createHhcWebClient({baseUrl: '/api', getAccessToken: () => 'member-token', fetcher})
  await expect(client.issueLiveRecordingPlayback('rec-1', 'capture-1', 'scope-1')).rejects.toMatchObject({status: 410, code: 'capture_expired'})
  expect(fetcher).toHaveBeenCalledTimes(1)
})
