import { describe, expect, it, vi } from 'vitest'

import { HhcWebApiError, createHhcWebClient } from './client'

describe('hhc web client', () => {
  it('maps bulletin list query and authorization through the generated contract', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: [],
      meta: { page: 2, pageSize: 50, total: 0 },
      error: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: 'https://www.alive.org.tw/api', getAccessToken: () => 'token', fetcher })

    const response = await client.listAdminBulletins({ page: 2, pageSize: 50, status: 'published' })

    expect(response.meta).toEqual({ page: 2, pageSize: 50, total: 0 })
    const request = fetcher.mock.calls[0]?.[0] as Request
    expect(request.url).toBe('https://www.alive.org.tw/api/admin/bulletins?page=2&pageSize=50&status=published')
    expect(request.headers.get('Authorization')).toBe('Bearer token')
  })

  it('preserves the API error code and status', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: null,
      meta: {},
      error: { code: 'precondition_failed', message: 'Version changed.' },
    }), { status: 412, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: 'https://www.alive.org.tw/api', getAccessToken: () => 'token', fetcher })

    await expect(client.publishBulletin('issue-1', 2, 'en')).rejects.toEqual(
      expect.objectContaining<HhcWebApiError>({ status: 412, code: 'precondition_failed' }),
    )
  })

  it('uses typed content paths and optimistic concurrency', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: { id: 'video-1', module: 'videos', status: 'draft', version: 3, youtubeVideoId: 'K3ckFWeSQ-k', translations: [], createdBy: 'admin', updatedBy: 'admin', createdAt: '2026-07-13T00:00:00Z', updatedAt: '2026-07-13T00:00:00Z' },
      meta: {}, error: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })

    await client.updateContent('videos', 'video-1', 2, { youtubeVideoId: 'K3ckFWeSQ-k', homeEligible: true, translations: [{ locale: 'en', title: 'Song' }] })

    const request = fetcher.mock.calls[0]?.[0] as Request
    expect(request.url).toBe('http://localhost/api/admin/content/videos/video-1')
    expect(request.headers.get('If-Match')).toBe('"2"')
    expect(request.method).toBe('PUT')
  })
})
