import { describe, expect, it, vi } from 'vitest'

import { HhcWebApiError, createHhcWebClient } from './client'
import type { LocationWriteInput, PublicContentItem } from './client'

describe('hhc web client', () => {
  it('exposes public news SEO metadata', () => {
    const news: PublicContentItem = {
      id: 'news-1',
      title: 'News',
      resolvedLocale: 'zh-Hant',
      availableLocales: ['zh-Hant'],
      authorName: '王牧師',
      firstPublishedAt: '2026-08-12T07:37:32Z',
      lastPublishedAt: '2026-08-13T07:37:32Z',
    }

    expect(news.authorName).toBe('王牧師')
    expect(news.firstPublishedAt).toBe('2026-08-12T07:37:32Z')
    expect(news.lastPublishedAt).toBe('2026-08-13T07:37:32Z')
  })

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

  it('lists public locations for the requested locale', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'taipei', name: 'Taipei', address: 'Taipei', mapHref: 'https://maps.example/taipei', sortOrder: 0, resolvedLocale: 'zh-Hant', availableLocales: ['zh-Hant'] }],
      meta: {},
      error: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => null, fetcher })

    await expect(client.listLocations('zh-Hant')).resolves.toEqual([
      { id: 'taipei', name: 'Taipei', address: 'Taipei', mapHref: 'https://maps.example/taipei', sortOrder: 0, resolvedLocale: 'zh-Hant', availableLocales: ['zh-Hant'] },
    ])
    expect((fetcher.mock.calls[0]![0] as Request).url).toBe('http://localhost/api/locations?locale=zh-Hant')
  })

  it('creates and updates locations through the generic admin content transport', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'taipei' }, meta: {}, error: null }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'taipei' }, meta: {}, error: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })
    const input: LocationWriteInput = {
      locationKey: 'taipei',
      mapHref: 'https://maps.example/taipei',
      sortOrder: 0,
      translations: [{ locale: 'zh-Hant', title: '台北', body: '台北市' }],
    }

    await client.createLocation(input, 'location-create-1')
    await client.updateLocation('taipei', 2, input)

    const create = fetcher.mock.calls[0]![0] as Request
    const update = fetcher.mock.calls[1]![0] as Request
    expect(create.url).toBe('http://localhost/api/admin/content/locations')
    expect(create.headers.get('Idempotency-Key')).toBe('location-create-1')
    await expect(create.json()).resolves.toEqual(input)
    expect(update.url).toBe('http://localhost/api/admin/content/locations/taipei')
    expect(update.headers.get('If-Match')).toBe('"2"')
    await expect(update.json()).resolves.toEqual(input)
  })

  it('preserves the API error code and status', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: null,
      meta: {},
      error: { code: 'precondition_failed', message: 'Version changed.' },
    }), { status: 412, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: 'https://www.alive.org.tw/api', getAccessToken: () => 'token', fetcher })

    await expect(client.publishBulletin('issue-1', 2, 'en', { notifySubscribers: false })).rejects.toEqual(
      expect.objectContaining<HhcWebApiError>({ status: 412, code: 'precondition_failed' }),
    )
  })

  it('forwards the bulletin subscriber notification choice', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: { id: 'issue-1', issueDate: '2026-07-31', status: 'publishing', notificationStatus: 'not_requested', version: 3, versions: [], createdBy: 'admin', updatedBy: 'admin', createdAt: '2026-07-31T00:00:00Z', updatedAt: '2026-07-31T00:00:00Z' },
      meta: {},
      error: null,
    }), { status: 202, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })

    await client.publishBulletin('issue-1', 2, 'zh-Hant', { notifySubscribers: true })

    const request = fetcher.mock.calls[0]?.[0] as Request
    expect(request.headers.get('If-Match')).toBe('"2"')
    await expect(request.json()).resolves.toEqual({ locale: 'zh-Hant', notifySubscribers: true })
  })

  it('uses typed content paths and optimistic concurrency', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: { id: 'video-1', module: 'videos', status: 'draft', version: 3, youtubeVideoId: 'K3ckFWeSQ-k', translations: [], createdBy: 'admin', updatedBy: 'admin', createdAt: '2026-07-13T00:00:00Z', updatedAt: '2026-07-13T00:00:00Z' },
      meta: {}, error: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })

    await client.updateContent('videos', 'video-1', 2, { youtubeVideoId: 'K3ckFWeSQ-k', detailLayout: 'top', homeEligible: true, translations: [{ locale: 'en', title: 'Song' }] })

    const request = fetcher.mock.calls[0]?.[0] as Request
    expect(request.url).toBe('http://localhost/api/admin/content/videos/video-1')
    expect(request.headers.get('If-Match')).toBe('"2"')
    expect(request.method).toBe('PUT')
  })

  it('forwards content filters and delete concurrency', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0 },
        error: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })

    await client.listContent('news', { query: 'alpha', sort: 'displayDate', direction: 'asc' })
    await client.deleteContent('news', 'news-1', 2)

    const listRequest = fetcher.mock.calls[0]?.[0] as Request
    expect(listRequest.url).toBe('http://localhost/api/admin/content/news?q=alpha&sort=displayDate&direction=asc')
    const deleteRequest = fetcher.mock.calls[1]?.[0] as Request
    expect(deleteRequest.url).toBe('http://localhost/api/admin/content/news/news-1')
    expect(deleteRequest.method).toBe('DELETE')
    expect(deleteRequest.headers.get('If-Match')).toBe('"2"')
  })

  it('uses optimistic concurrency for bulletin deletion and revision restore', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { id: 'issue-1', issueDate: '2026-07-31', status: 'draft', version: 4, versions: [], createdBy: 'admin', updatedBy: 'admin', createdAt: '2026-07-31T00:00:00Z', updatedAt: '2026-07-31T00:00:00Z' },
        meta: {},
        error: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })

    await client.deleteBulletin('issue-1', 2)
    await client.restoreBulletinRevision('issue-1', 1, 3)

    const deletion = fetcher.mock.calls[0]![0] as Request
    const restore = fetcher.mock.calls[1]![0] as Request
    expect(deletion.url).toBe('http://localhost/api/admin/bulletins/issue-1')
    expect(deletion.method).toBe('DELETE')
    expect(deletion.headers.get('If-Match')).toBe('"2"')
    expect(restore.url).toBe('http://localhost/api/admin/bulletins/issue-1/revisions/1/restore')
    expect(restore.headers.get('If-Match')).toBe('"3"')
  })

  it('reads bulletin asset status through the protected CMS route', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({
      data: { id: 'asset-1', uploadStatus: 'completed', scanStatus: 'pending', processingStatus: 'not_required', retryable: false },
      meta: {}, error: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })

    await client.getBulletinAssetStatus('issue-1', 'asset-1')
    await client.retryBulletinAssetScan('issue-1', 'asset-1')

    const request = fetcher.mock.calls[0]![0] as Request
    expect(request.url).toBe('http://localhost/api/admin/bulletins/issue-1/assets/asset-1')
    expect(request.headers.get('Authorization')).toBe('Bearer token')
    const retryRequest = fetcher.mock.calls[1]![0] as Request
    expect(retryRequest.url).toBe('http://localhost/api/admin/bulletins/issue-1/assets/asset-1/scan/retry')
    expect(retryRequest.method).toBe('POST')
  })

  it('sends the requested news image usage when creating an upload', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: {
        asset: { id: 'asset-1' },
        uploadTarget: { url: 'https://storage.example/upload', method: 'PUT', headers: {}, expiresAt: '2026-08-03T00:00:00Z' },
      },
      meta: {},
      error: null,
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })

    await client.createNewsCoverUpload('news-1', {
      fileName: 'home.webp',
      mimeType: 'image/webp',
      sizeBytes: 1024,
      usage: 'home',
    }, 'upload-1')

    const request = fetcher.mock.calls[0]![0] as Request
    await expect(request.json()).resolves.toEqual({
      fileName: 'home.webp',
      mimeType: 'image/webp',
      sizeBytes: 1024,
      usage: 'home',
    })
  })

  it('forwards cancellation to bulletin upload requests', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          asset: { id: 'asset-1' },
          uploadTarget: { url: 'https://storage.example/upload', method: 'PUT', headers: {}, expiresAt: '2026-08-03T00:00:00Z' },
        },
        meta: {},
        error: null,
      }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { id: 'issue-1', issueDate: '2026-07-31', status: 'draft', version: 3, versions: [], createdBy: 'admin', updatedBy: 'admin', createdAt: '2026-07-31T00:00:00Z', updatedAt: '2026-07-31T00:00:00Z' },
        meta: {},
        error: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })
    const createController = new AbortController()
    const completeController = new AbortController()

    await client.createBulletinUpload('issue-1', {
      locale: 'zh-Hant',
      fileName: 'weekly.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    }, 'upload-1', createController.signal)
    await client.completeBulletinUpload('issue-1', 'asset-1', 2, {
      locale: 'zh-Hant',
      title: 'Weekly',
      subtitle: '',
      fileName: 'weekly.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksumSha256: 'abc123',
    }, completeController.signal)

    const createRequest = fetcher.mock.calls[0]![0] as Request
    const completeRequest = fetcher.mock.calls[1]![0] as Request
    createController.abort()
    completeController.abort()
    expect(createRequest.signal.aborted).toBe(true)
    expect(completeRequest.signal.aborted).toBe(true)
  })

  it('forwards cancellation to news image upload requests', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          asset: { id: 'asset-1' },
          uploadTarget: { url: 'https://storage.example/upload', method: 'PUT', headers: {}, expiresAt: '2026-08-03T00:00:00Z' },
        },
        meta: {},
        error: null,
      }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { id: 'asset-1', uploadStatus: 'completed', scanStatus: 'pending', processingStatus: 'not_required', retryable: false },
        meta: {},
        error: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })
    const createController = new AbortController()
    const completeController = new AbortController()

    await client.createNewsCoverUpload('news-1', {
      fileName: 'cover.webp',
      mimeType: 'image/webp',
      sizeBytes: 1024,
      usage: 'detail',
    }, 'upload-1', createController.signal)
    await client.completeNewsCoverUpload('news-1', 'asset-1', 2, {
      fileName: 'cover.webp',
      mimeType: 'image/webp',
      sizeBytes: 1024,
      checksumSha256: 'abc123',
    }, completeController.signal)

    const createRequest = fetcher.mock.calls[0]![0] as Request
    const completeRequest = fetcher.mock.calls[1]![0] as Request
    createController.abort()
    completeController.abort()
    expect(createRequest.signal.aborted).toBe(true)
    expect(completeRequest.signal.aborted).toBe(true)
  })

  it('updates and removes one bulletin locale version with issue concurrency', async () => {
    const body = JSON.stringify({
      data: { id: 'issue-1', issueDate: '2026-07-31', status: 'draft', version: 3, versions: [], createdBy: 'admin', updatedBy: 'admin', createdAt: '2026-07-31T00:00:00Z', updatedAt: '2026-07-31T00:00:00Z' },
      meta: {}, error: null,
    })
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })

    await client.updateBulletinVersion('issue-1', 'en', 2, 'Weekly', 'Subtitle')
    await client.deleteBulletinVersion('issue-1', 'en', 3)

    const update = fetcher.mock.calls[0]![0] as Request
    const deletion = fetcher.mock.calls[1]![0] as Request
    expect(update.method).toBe('PUT')
    expect(update.headers.get('If-Match')).toBe('"2"')
    await expect(update.json()).resolves.toEqual({ title: 'Weekly', subtitle: 'Subtitle' })
    expect(deletion.method).toBe('DELETE')
    expect(deletion.headers.get('If-Match')).toBe('"3"')
  })

  it('reads home and news detail projections directly', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { news: [], videos: [] },
        meta: {},
        error: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { id: 'news-1', title: 'News' },
        meta: {},
        error: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => null, fetcher })

    await client.getHome('en')
    await client.getNewsBySlug('en', 'announcement')

    expect(fetcher).toHaveBeenCalledTimes(2)
    const homeRequest = fetcher.mock.calls[0]![0] as Request
    const newsRequest = fetcher.mock.calls[1]![0] as Request
    expect(homeRequest.url).toBe('http://localhost/api/home?locale=en')
    expect(newsRequest.url).toBe('http://localhost/api/news/announcement?locale=en')
  })

  it('returns public pagination metadata', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'news-1', title: 'News' }],
      meta: { page: 2, pageSize: 12, total: 25 },
      error: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => null, fetcher })

    await expect(client.listPublicContentPage('news', 'en', { page: 2, pageSize: 12 })).resolves.toEqual({
      data: [{ id: 'news-1', title: 'News' }],
      meta: { page: 2, pageSize: 12, total: 25 },
    })
    expect((fetcher.mock.calls[0]![0] as Request).url).toBe('http://localhost/api/news?locale=en&page=2&pageSize=12')
  })
})
