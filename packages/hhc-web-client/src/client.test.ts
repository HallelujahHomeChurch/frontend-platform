import { describe, expect, it, vi } from 'vitest'

import { HhcWebApiError, createHhcWebClient } from './client'
import type {
  HomeBannerCompleteInput,
  HomeBannerUploadInput,
  HomePageWriteInputV2,
  LocationWriteInput,
  PageWriteInput,
  PublicContentItem,
} from './client'

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

  it('decodes Home v1 and v2 and updates a fixed editorial page through typed routes', async () => {
    const publishedPage = {
      pageKey: 'home',
      template: 'home.v1',
      routePath: '/',
      indexable: true,
      content: {
        schemaVersion: 1,
        template: 'home.v1',
        data: {
          heroTitle: 'ハレルヤ', heroSubtitle: 'Home', newsTitle: 'News', moreNews: 'More',
          weeklyTitle: 'Weekly', downloadWeekly: 'Download', videosTitle: 'Videos', videosSubtitle: 'Watch',
          watchMore: 'More videos', aboutTitle: 'About', aboutBody: 'Body', aboutCta: 'Learn',
          locationsTitle: 'Locations', mapLink: 'Map',
        },
      },
      resolvedLocale: 'ja',
      availableLocales: ['ja'],
      version: 3,
      publishedAt: '2026-08-29T00:00:00Z',
    }
    const publishedPageV2 = {
      pageKey: 'home',
      template: 'home.v2',
      routePath: '/',
      indexable: true,
      content: {
        schemaVersion: 2,
        template: 'home.v2',
        data: {
          heroTitle: 'Hallelujah',
          heroSubtitle: 'Home',
          kingdomJoyDescription: 'Joy',
          aboutDescription: 'About',
          bannerImageUrl: '/api/assets/banner',
          links: {
            churchYoutube: 'https://youtube.com/@hhc33',
            churchFacebook: 'https://facebook.com/hhc33',
            musicYoutube: 'https://youtube.com/@hhcmusic33',
          },
          locations: [],
        },
      },
      resolvedLocale: 'en',
      availableLocales: ['en'],
      version: 4,
      publishedAt: '2026-08-29T00:00:00Z',
    }
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: publishedPage, meta: {}, error: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: publishedPageV2, meta: {}, error: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'page-1' }, meta: {}, error: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })
    const input: PageWriteInput = {
      pageKey: 'home',
      pageTemplate: 'home.v1',
      routePath: '/',
      indexable: true,
      translations: [{ locale: 'ja', bodyJson: publishedPage.content }],
    }

    await expect(client.getPublicPage('home', 'ja')).resolves.toEqual(publishedPage)
    await expect(client.getPublicPage('home', 'en')).resolves.toEqual(publishedPageV2)
    await client.updatePage('page-1', 2, input)

    const publicRequest = fetcher.mock.calls[0]![0] as Request
    const updateRequest = fetcher.mock.calls[2]![0] as Request
    expect(publicRequest.url).toBe('http://localhost/api/pages/home?locale=ja')
    expect(updateRequest.url).toBe('http://localhost/api/admin/content/pages/page-1')
    expect(updateRequest.method).toBe('PUT')
    expect(updateRequest.headers.get('If-Match')).toBe('"2"')
    await expect(updateRequest.json()).resolves.toEqual(input)
  })

  it('writes the exact Home v2 shape', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: { id: 'page-1' }, meta: {}, error: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })
    const locales = ['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko'] as const
    const input: HomePageWriteInputV2 = {
      pageKey: 'home',
      pageTemplate: 'home.v2',
      routePath: '/',
      indexable: true,
      bannerAssetId: 'asset-1',
      links: {
        churchYoutube: 'https://youtube.com/@hhc33',
        churchFacebook: 'https://facebook.com/hhc33',
        musicYoutube: 'https://youtube.com/@hhcmusic33',
      },
      locations: [{
        key: 'taipei',
        mapHref: 'https://maps.example/taipei',
        sortOrder: 10,
        translations: locales.map(locale => ({ locale, name: 'Taipei', address: 'Taipei' })),
      }],
      translations: locales.map(locale => ({
        locale,
        bodyJson: {
          schemaVersion: 2,
          template: 'home.v2',
          data: {
            heroTitle: 'Hallelujah',
            heroSubtitle: 'Home',
            kingdomJoyDescription: 'Joy',
            aboutDescription: 'About',
          },
        },
      })),
    }

    await client.updatePage('page-1', 4, input)

    const request = fetcher.mock.calls[0]![0] as Request
    expect(request.url).toBe('http://localhost/api/admin/content/pages/page-1')
    expect(request.headers.get('If-Match')).toBe('"4"')
    await expect(request.json()).resolves.toEqual(input)
  })

  it('uses the four Home Banner routes and exact JPEG contracts', async () => {
    const responses = [
      { asset: { id: 'asset-1' }, uploadTarget: { url: 'https://storage.example/upload', method: 'PUT', headers: {}, expiresAt: '2026-08-29T00:00:00Z' } },
      { id: 'asset-1', uploadStatus: 'completed', scanStatus: 'pending', processingStatus: 'not_required', retryable: false },
      { id: 'asset-1', uploadStatus: 'completed', scanStatus: 'pending', processingStatus: 'not_required', retryable: false },
      { id: 'page-1' },
    ]
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({
      data: responses.shift(), meta: {}, error: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })
    const upload: HomeBannerUploadInput = { usage: 'home_banner', fileName: 'banner.jpg', mimeType: 'image/jpeg', sizeBytes: 1024 }
    const complete: HomeBannerCompleteInput = { mimeType: 'image/jpeg', sizeBytes: 1024, checksumSha256: 'a'.repeat(64) }

    await client.createHomeBannerUpload('page-1', upload, 'upload-1')
    await client.getHomeBannerStatus('page-1', 'asset-1')
    await client.retryHomeBannerScan('page-1', 'asset-1')
    await client.completeHomeBannerUpload('page-1', 'asset-1', 4, complete)

    const [create, status, retry, finish] = fetcher.mock.calls.map(call => call[0] as Request)
    expect(create!.url).toBe('http://localhost/api/admin/content/pages/page-1/upload-sessions')
    expect(create!.headers.get('Idempotency-Key')).toBe('upload-1')
    await expect(create!.json()).resolves.toEqual(upload)
    expect(status!.url).toBe('http://localhost/api/admin/content/pages/page-1/assets/asset-1')
    expect(retry!.url).toBe('http://localhost/api/admin/content/pages/page-1/assets/asset-1/scan/retry')
    expect(retry!.method).toBe('POST')
    expect(finish!.url).toBe('http://localhost/api/admin/content/pages/page-1/assets/asset-1/complete')
    expect(finish!.headers.get('If-Match')).toBe('"4"')
    await expect(finish!.json()).resolves.toEqual(complete)
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
    await client.updateLocation('5e02a37e-c779-42dd-9b25-c05f4ea9eace', 2, input)

    const create = fetcher.mock.calls[0]![0] as Request
    const update = fetcher.mock.calls[1]![0] as Request
    expect(create.url).toBe('http://localhost/api/admin/content/locations')
    expect(create.headers.get('Idempotency-Key')).toBe('location-create-1')
    await expect(create.json()).resolves.toEqual(input)
    expect(update.url).toBe('http://localhost/api/admin/content/locations/5e02a37e-c779-42dd-9b25-c05f4ea9eace')
    expect(update.headers.get('If-Match')).toBe('"2"')
    await expect(update.json()).resolves.toEqual(input)
  })

  it('reads public layout, admin settings, and revisions through their exact routes', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { locale: 'zh-Hant' }, meta: {}, error: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'default' }, meta: {}, error: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], meta: {}, error: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })

    await expect(client.getSiteLayout('zh-Hant')).resolves.toEqual({ locale: 'zh-Hant' })
    await expect(client.getSiteSettings()).resolves.toEqual({ id: 'default' })
    await expect(client.listSiteSettingsRevisions()).resolves.toEqual([])

    const publicRequest = fetcher.mock.calls[0]![0] as Request
    expect(publicRequest.url).toBe('http://localhost/api/site-layout?locale=zh-Hant')
    const settingsRequest = fetcher.mock.calls[1]![0] as Request
    expect(settingsRequest.url).toBe('http://localhost/api/admin/site-settings')
    expect(settingsRequest.headers.get('Authorization')).toBe('Bearer token')
    expect((fetcher.mock.calls[2]![0] as Request).url).toBe('http://localhost/api/admin/site-settings/revisions')
  })

  it('saves, publishes, unpublishes, and restores site settings with optimistic concurrency', async () => {
    const response = JSON.stringify({ data: { id: 'default' }, meta: {}, error: null })
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(response, { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })
    const input = {
      locales: [],
      links: {
        churchYoutube: 'https://www.youtube.com/@hhc33',
        churchFacebook: 'https://www.facebook.com/hhc33',
        musicYoutube: 'https://www.youtube.com/@hhcmusic33',
      },
    }

    await client.saveSiteSettings(2, input)
    await client.publishSiteSettings(3)
    await client.unpublishSiteSettings(4)
    await client.restoreSiteSettingsRevision(7, 5)

    const save = fetcher.mock.calls[0]![0] as Request
    expect(save.url).toBe('http://localhost/api/admin/site-settings')
    expect(save.method).toBe('PUT')
    expect(save.headers.get('If-Match')).toBe('"2"')
    await expect(save.json()).resolves.toEqual(input)
    const publish = fetcher.mock.calls[1]![0] as Request
    expect(publish.url).toBe('http://localhost/api/admin/site-settings/publish')
    expect(publish.method).toBe('POST')
    expect(publish.headers.get('If-Match')).toBe('"3"')
    const unpublish = fetcher.mock.calls[2]![0] as Request
    expect(unpublish.url).toBe('http://localhost/api/admin/site-settings/unpublish')
    expect(unpublish.method).toBe('POST')
    expect(unpublish.headers.get('If-Match')).toBe('"4"')
    const restore = fetcher.mock.calls[3]![0] as Request
    expect(restore.url).toBe('http://localhost/api/admin/site-settings/revisions/7/restore')
    expect(restore.method).toBe('POST')
    expect(restore.headers.get('If-Match')).toBe('"5"')
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

  it('decodes pending removal items and Page group revision manifests', async () => {
    const content = {
      id: 'history-1', module: 'history', status: 'pending_removal', version: 4, detailLayout: 'top',
      translations: [], isPublished: true, publishedVersion: 3, createdBy: 'admin', updatedBy: 'admin',
      createdAt: '2026-08-30T00:00:00Z', updatedAt: '2026-08-30T00:00:00Z',
    }
    const manifest = {
      pageId: '00000000-0000-0000-0000-000000000001', pageSourceVersion: 6, pageTargetVersion: 7,
      childModule: 'history',
      items: [{ id: '00000000-0000-0000-0000-000000000002', sourceVersion: 3, targetVersion: 4, action: 'remove' }],
      sha256: 'a'.repeat(64),
    }
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [content], meta: { page: 1, pageSize: 20, total: 1 }, error: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ version: 7, snapshot: content, groupManifest: manifest, createdBy: 'admin', createdAt: '2026-08-30T00:00:00Z' }],
        meta: {}, error: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })

    const listed = await client.listContent('history')
    const revisions = await client.listContentRevisions('pages', 'page-1')

    expect(listed.data[0]?.status).toBe('pending_removal')
    expect(revisions[0]?.groupManifest).toEqual(manifest)
    expect(revisions[0]?.groupManifest?.items[0]?.action).toBe('remove')
  })

  it('publishes, unpublishes, and restores only supported content modules', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({
      data: { id: 'content-1' }, meta: {}, error: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })

    await client.publishContent('pages', 'page-1', 2)
    await client.unpublishContent('pages', 'page-1', 3)
    await client.restoreContentRevision('pages', 'page-1', 1, 4)
    await client.publishContent('news', 'news-1', 5)
    await client.unpublishContent('news', 'news-1', 6)
    await client.restoreContentRevision('news', 'news-1', 2, 7)

    const requests = fetcher.mock.calls.map(call => call[0] as Request)
    expect(requests.map(request => request.url)).toEqual([
      'http://localhost/api/admin/content/pages/page-1/publish',
      'http://localhost/api/admin/content/pages/page-1/unpublish',
      'http://localhost/api/admin/content/pages/page-1/revisions/1/restore',
      'http://localhost/api/admin/content/news/news-1/publish',
      'http://localhost/api/admin/content/news/news-1/unpublish',
      'http://localhost/api/admin/content/news/news-1/revisions/2/restore',
    ])
    expect(requests.map(request => request.headers.get('If-Match'))).toEqual(['"2"', '"3"', '"4"', '"5"', '"6"', '"7"'])
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
    const home = { news: [{ id: 'news-1', title: 'News' }], videos: [{ id: 'video-1', title: 'Video' }] }
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: home,
        meta: {},
        error: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { id: 'news-1', title: 'News' },
        meta: {},
        error: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => null, fetcher })

    await expect(client.getHome('en')).resolves.toEqual(home)
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

  it('does not route locations through the legacy videos listing', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => null, fetcher })
    const legacyClient = client as unknown as { listPublicContent(module: string, locale: 'zh-Hant'): Promise<unknown> }

    await expect(legacyClient.listPublicContent('locations', 'zh-Hant')).rejects.toThrow('Use listLocations for locations.')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('maps public meeting queries through the released contract', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ data: [], meta: {}, error: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => null, fetcher })

    await client.listPublicMeetings()
    await client.getPublicMeeting('sunday-service')
    await client.listPublicMeetingOccurrences({ from: '2026-09-01T00:00:00Z', to: '2026-10-01T00:00:00Z' })

    expect(fetcher.mock.calls.map(call => (call[0] as Request).url)).toEqual([
      'http://localhost/api/meetings',
      'http://localhost/api/meetings/sunday-service',
      'http://localhost/api/meeting-occurrences?from=2026-09-01T00%3A00%3A00Z&to=2026-10-01T00%3A00%3A00Z',
    ])
  })

  it('maps meeting operations headers, actions, dates, and bindings', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      return new Response(JSON.stringify({ data: {}, meta: {}, error: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    const client = createHhcWebClient({ baseUrl: '/api', getAccessToken: () => 'token', fetcher })
    const unit = { key: 'main', name: 'Main' }
    const resource = { key: 'sanctuary', name: 'Sanctuary', kind: 'venue' as const, churchUnitId: 'unit-1', timezone: 'Asia/Taipei', visibility: 'public' as const }
    const meeting = { key: 'sunday-service', name: 'Sunday Service', churchUnitId: 'unit-1', venueResourceId: 'venue-1', timezone: 'Asia/Taipei', schedule: { type: 'weekly' as const, daysOfWeek: [0], startTime: '10:00' }, durationMinutes: 90, visibility: 'public' as const }

    await client.listChurchUnits({ includeArchived: true })
    await client.createChurchUnit(unit, 'unit-create')
    await client.updateChurchUnit('unit-1', 2, unit)
    await client.setChurchUnitStatus('unit-1', 3, 'archive')
    await client.listOperationsResources({ includeArchived: true })
    await client.createOperationsResource(resource, 'resource-create')
    await client.updateOperationsResource('resource-1', 4, resource)
    await client.setOperationsResourceStatus('resource-1', 5, 'pause')
    await client.listMeetings({ includeArchived: true })
    await client.createMeeting(meeting, 'meeting-create')
    await client.updateMeeting('meeting-1', 6, meeting)
    await client.setMeetingStatus('meeting-1', 7, 'resume')
    await client.putMeetingOccurrenceOverride('meeting-1', '2026-09-06', 8, { cancelled: true, reason: 'Typhoon' })
    await client.deleteMeetingOccurrenceOverride('meeting-1', '2026-09-06', 9)
    await client.replaceMeetingCollectionBindings('meeting-1', 10, ['collection-1', 'collection-2'])

    const requests = fetcher.mock.calls.map(call => call[0] as Request)
    expect(requests.map(request => `${request.method} ${new URL(request.url).pathname}${new URL(request.url).search}`)).toEqual([
      'GET /api/admin/operations/church-units?includeArchived=true',
      'POST /api/admin/operations/church-units',
      'PUT /api/admin/operations/church-units/unit-1',
      'POST /api/admin/operations/church-units/unit-1/archive',
      'GET /api/admin/operations/resources?includeArchived=true',
      'POST /api/admin/operations/resources',
      'PUT /api/admin/operations/resources/resource-1',
      'POST /api/admin/operations/resources/resource-1/pause',
      'GET /api/admin/operations/meetings?includeArchived=true',
      'POST /api/admin/operations/meetings',
      'PUT /api/admin/operations/meetings/meeting-1',
      'POST /api/admin/operations/meetings/meeting-1/resume',
      'PUT /api/admin/operations/meetings/meeting-1/overrides/2026-09-06',
      'DELETE /api/admin/operations/meetings/meeting-1/overrides/2026-09-06',
      'PUT /api/admin/operations/meetings/meeting-1/collections',
    ])
    expect(requests[1]!.headers.get('Idempotency-Key')).toBe('unit-create')
    expect(requests[5]!.headers.get('Idempotency-Key')).toBe('resource-create')
    expect(requests[9]!.headers.get('Idempotency-Key')).toBe('meeting-create')
    for (const [index, version] of [[2, 2], [3, 3], [6, 4], [7, 5], [10, 6], [11, 7], [12, 8], [13, 9], [14, 10]] as const) {
      expect(requests[index]!.headers.get('If-Match')).toBe(`"${version}"`)
    }
    await expect(requests[12]!.json()).resolves.toEqual({ cancelled: true, reason: 'Typhoon' })
    await expect(requests[14]!.json()).resolves.toEqual({ collectionIds: ['collection-1', 'collection-2'] })
  })
})
