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
})
