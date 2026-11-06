import {expect, it} from 'vitest'
import {createHhcWebClient} from './client.js'

const id = '00000000-0000-4000-8000-000000000001'
const mediaVersion = 'live:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const stamp = '2026-11-06T06:00:00Z'

it('decodes nullable progress and a live resume item without creating a media request', async () => {
  const paths: string[] = []
  const item = {sessionId: id, recordingId: id, publicId: 'short', title: 'Live', mode: 'live', captureId: mediaVersion.slice(5), mediaVersion, positionSeconds: 60, generation: id, claimedAt: stamp, updatedAt: stamp}
  const api = createHhcWebClient({baseUrl: 'https://www.example/api', getAccessToken: () => 'member', fetcher: async request => {
    const path = new URL((request as Request).url).pathname
    paths.push(path)
    return Response.json({data: path.endsWith('/progress') ? {mediaVersion, claimToken: 'intent', progress: null} : {item}})
  }})
  expect(await api.getRecordingProgress(id)).toEqual({mediaVersion, claimToken: 'intent', progress: null})
  expect(await api.getContinueWatching()).toEqual({item})
  expect(paths).toEqual([`/api/member/recordings/${id}/progress`, '/api/member/recordings/continue-watching'])
})

it('uses authenticated no-store keepalive for bounded writes', async () => {
  const body = {sessionId: id, generation: id, sequence: 3, mediaVersion, positionSeconds: 60, state: 'paused'} as const
  const requests: Request[] = []
  const api = createHhcWebClient({baseUrl: 'https://www.example/api', getAccessToken: () => 'member', fetcher: async request => {
    requests.push(request as Request)
    return Response.json({data: {accepted: true, sequence: 3}})
  }})
  expect(await api.updateRecordingProgress(id, body, {keepalive: true})).toEqual({accepted: true, sequence: 3})
  expect(requests[0].keepalive).toBe(true)
  expect(requests[0].headers.get('Authorization')).toBe('Bearer member')
  expect(requests[0].cache).toBe('no-store')
  expect(await requests[0].json()).toEqual(body)
  await expect(api.updateRecordingProgress(id, {...body, mediaVersion: 'a'.repeat(4096)}, {keepalive: true})).rejects.toMatchObject({code: 'invalid_request'})
  expect(requests).toHaveLength(1)
})

it.each([[409, 'progress_conflict'], [409, 'progress_superseded'], [401, 'unauthorized'], [403, 'processing_restricted']])(
  'preserves HTTP %s and %s', async (status, code) => {
    const api = createHhcWebClient({baseUrl: 'https://www.example/api', getAccessToken: () => 'member', fetcher: async () => Response.json({error: {code}}, {status})})
    await expect(api.claimRecordingProgress(id, {sessionId: id, claimId: id, expectedGeneration: null, claimToken: 'intent', mediaVersion, startKind: 'resume', observedPositionSeconds: 0})).rejects.toMatchObject({status, code})
  },
)

it.each([undefined, id])('accepts a resume session identity or an older producer without it: %s', async sessionId => {
  const item = {sessionId, recordingId: id, publicId: 'short', title: 'Video', mode: 'vod', mediaVersion: 'vod:package', positionSeconds: 60, generation: id, claimedAt: stamp, updatedAt: stamp}
  const api = createHhcWebClient({baseUrl: 'https://www.example/api', getAccessToken: () => 'member', fetcher: async () => Response.json({data: {item}})})
  expect((await api.getContinueWatching()).item?.sessionId).toBe(sessionId)
})

it.each([null, 123, 'not-a-session', {}])('rejects an invalid resume session identity: %j', async sessionId => {
  const item = {sessionId, recordingId: id, publicId: 'short', title: 'Video', mode: 'vod', mediaVersion: 'vod:package', positionSeconds: 60, generation: id, claimedAt: stamp, updatedAt: stamp}
  const api = createHhcWebClient({baseUrl: 'https://www.example/api', getAccessToken: () => 'member', fetcher: async () => Response.json({data: {item}})})
  await expect(api.getContinueWatching()).rejects.toBeInstanceOf(Error)
})
