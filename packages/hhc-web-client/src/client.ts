import createClient from 'openapi-fetch'

import type { components, paths } from './generated.js'

export type BulletinLocale = components['schemas']['Locale']
export type BulletinStatus = components['schemas']['BulletinStatus']
export type BulletinIssue = components['schemas']['BulletinIssue']
export type BulletinVersion = components['schemas']['BulletinVersion']
export type BulletinRevision = components['schemas']['BulletinRevision']
export type PageMeta = components['schemas']['PageMeta']
export type UploadTarget = components['schemas']['UploadTarget']
export type CreatedBulletinUpload = components['schemas']['CreatedUpload']
export type CompleteBulletinUploadInput = components['schemas']['CompleteBulletinUploadInput']
export type ContentModule = components['schemas']['ContentModule']
export type ContentStatus = components['schemas']['ContentStatus']
export type ContentItem = components['schemas']['ContentItem']
export type ContentWriteInput = components['schemas']['ContentWriteInput']
export type ContentRevision = components['schemas']['ContentRevision']
export type PublicContentItem = components['schemas']['PublicContentItem']
export type AssetStatus = components['schemas']['AssetStatus']
export type CreateImageUploadInput = components['schemas']['CreateImageUploadInput']
export type CompleteImageUploadInput = components['schemas']['CompleteImageUploadInput']

export class HhcWebApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'HhcWebApiError'
    this.status = status
    this.code = code
  }
}

export function createHhcWebClient(options: {
  baseUrl: string
  getAccessToken: () => string | null
  fetcher?: typeof fetch
}) {
  const client = createClient<paths>({
    baseUrl: absoluteBaseUrl(options.baseUrl),
    fetch: options.fetcher,
  })

  client.use({
    onRequest({ request }) {
      const token = options.getAccessToken()
      if (token) request.headers.set('Authorization', `Bearer ${token}`)
      request.headers.set('Accept', 'application/json')
      return request
    },
  })

  async function unwrap<T>(request: Promise<{ data?: T; error?: unknown; response: Response }>) {
    const result = await request
    if (result.error !== undefined || !result.response.ok) throw apiError(result.response, result.error)
    if (result.data === undefined) throw new HhcWebApiError(result.response.status, 'invalid_response', 'The API response did not include data.')
    return result.data
  }

  async function listPublicContentPage(
    module: ContentModule,
    locale: BulletinLocale,
    params: { page?: number; pageSize?: number; signal?: AbortSignal } = {},
  ) {
    const query = { locale, page: params.page, pageSize: params.pageSize }
    const result = module === 'news'
      ? client.GET('/news', { params: { query }, signal: params.signal })
      : module === 'history'
        ? client.GET('/history', { params: { query }, signal: params.signal })
        : client.GET('/videos', { params: { query }, signal: params.signal })
    const envelope = await unwrap(result)
    return { data: envelope.data, meta: envelope.meta }
  }

  return {
    async listAdminBulletins(params: { page?: number; pageSize?: number; status?: BulletinStatus; query?: string; signal?: AbortSignal } = {}) {
      const envelope = await unwrap(client.GET('/admin/bulletins', {
        params: { query: { page: params.page, pageSize: params.pageSize, status: params.status, q: params.query } },
        signal: params.signal,
      }))
      return { data: envelope.data, meta: envelope.meta }
    },
    async getAdminBulletin(issueId: string, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/bulletins/{issueId}', { params: { path: { issueId } }, signal }))).data
    },
    async updateBulletin(issueId: string, version: number, issueNumber: number, issueDate: string) {
      return (await unwrap(client.PUT('/admin/bulletins/{issueId}', {
        params: { path: { issueId }, header: { 'If-Match': `"${version}"` } },
        body: { issueNumber, issueDate },
      }))).data
    },
    async getBulletinAssetStatus(issueId: string, assetId: string, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/bulletins/{issueId}/assets/{assetId}', { params: { path: { issueId, assetId } }, signal }))).data
    },
    async retryBulletinAssetScan(issueId: string, assetId: string) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/assets/{assetId}/scan/retry', { params: { path: { issueId, assetId } } }))).data
    },
    async createBulletin(issueNumber: number, issueDate: string, idempotencyKey: string) {
      return (await unwrap(client.POST('/admin/bulletins', {
        params: { header: { 'Idempotency-Key': idempotencyKey } },
        body: { issueNumber, issueDate },
      }))).data
    },
    async createBulletinUpload(issueId: string, input: components['schemas']['CreateBulletinUploadInput'], idempotencyKey: string) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/upload-sessions', {
        params: { path: { issueId }, header: { 'Idempotency-Key': idempotencyKey } },
        body: input,
      }))).data
    },
    async updateBulletinVersion(issueId: string, locale: BulletinLocale, version: number, title: string, subtitle: string) {
      return (await unwrap(client.PUT('/admin/bulletins/{issueId}/versions/{locale}', {
        params: { path: { issueId, locale }, header: { 'If-Match': `"${version}"` } },
        body: { title, subtitle },
      }))).data
    },
    async deleteBulletinVersion(issueId: string, locale: BulletinLocale, version: number) {
      return (await unwrap(client.DELETE('/admin/bulletins/{issueId}/versions/{locale}', {
        params: { path: { issueId, locale }, header: { 'If-Match': `"${version}"` } },
      }))).data
    },
    async completeBulletinUpload(issueId: string, assetId: string, version: number, input: CompleteBulletinUploadInput) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/assets/{assetId}/complete', {
        params: { path: { issueId, assetId }, header: { 'If-Match': `"${version}"` } },
        body: input,
      }))).data
    },
    async publishBulletin(issueId: string, version: number, locale: BulletinLocale) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/publish', {
        params: { path: { issueId }, header: { 'If-Match': `"${version}"` } },
        body: { locale },
      }))).data
    },
    async unpublishBulletin(issueId: string, version: number, locale: BulletinLocale) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/unpublish', {
        params: { path: { issueId }, header: { 'If-Match': `"${version}"` } },
        body: { locale },
      }))).data
    },
    async deleteBulletin(issueId: string, version: number) {
      const result = await client.DELETE('/admin/bulletins/{issueId}', {
        params: { path: { issueId }, header: { 'If-Match': `"${version}"` } },
      })
      if (result.error !== undefined || !result.response.ok) throw apiError(result.response, result.error)
    },
    async listBulletinRevisions(issueId: string) {
      return (await unwrap(client.GET('/admin/bulletins/{issueId}/revisions', { params: { path: { issueId } } }))).data
    },
    async restoreBulletinRevision(issueId: string, revision: number, version: number) {
      return (await unwrap(client.POST('/admin/bulletins/{issueId}/revisions/{revision}/restore', {
        params: { path: { issueId, revision }, header: { 'If-Match': `"${version}"` } },
      }))).data
    },
    async uploadFile(target: UploadTarget, file: File, signal?: AbortSignal) {
      const headers = new Headers(target.headers)
      if (!headers.has('Content-Type')) headers.set('Content-Type', file.type || 'application/octet-stream')
      const response = await (options.fetcher ?? globalThis.fetch)(target.url, {
        method: target.method,
        headers,
        body: file,
        signal,
      })
      if (!response.ok) throw new HhcWebApiError(response.status, 'upload_failed', 'The file could not be uploaded.')
    },
    async listContent(module: ContentModule, params: {
      page?: number
      pageSize?: number
      query?: string
      status?: ContentStatus
      sort?: 'updatedAt' | 'displayDate' | 'eventDate'
      direction?: 'asc' | 'desc'
      signal?: AbortSignal
    } = {}) {
      const envelope = await unwrap(client.GET('/admin/content/{module}', {
        params: {
          path: { module },
          query: {
            page: params.page,
            pageSize: params.pageSize,
            q: params.query,
            status: params.status,
            sort: params.sort,
            direction: params.direction,
          },
        },
        signal: params.signal,
      }))
      return { data: envelope.data, meta: envelope.meta }
    },
    async getContent(module: ContentModule, contentId: string, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/content/{module}/{contentId}', { params: { path: { module, contentId } }, signal }))).data
    },
    async createContent(module: ContentModule, input: ContentWriteInput, idempotencyKey: string) {
      return (await unwrap(client.POST('/admin/content/{module}', {
        params: { path: { module }, header: { 'Idempotency-Key': idempotencyKey } }, body: input,
      }))).data
    },
    async updateContent(module: ContentModule, contentId: string, version: number, input: ContentWriteInput) {
      return (await unwrap(client.PUT('/admin/content/{module}/{contentId}', {
        params: { path: { module, contentId }, header: { 'If-Match': `"${version}"` } }, body: input,
      }))).data
    },
    async publishContent(module: ContentModule, contentId: string, version: number) {
      return (await unwrap(client.POST('/admin/content/{module}/{contentId}/publish', {
        params: { path: { module, contentId }, header: { 'If-Match': `"${version}"` } },
      }))).data
    },
    async unpublishContent(module: ContentModule, contentId: string, version: number) {
      return (await unwrap(client.POST('/admin/content/{module}/{contentId}/unpublish', {
        params: { path: { module, contentId }, header: { 'If-Match': `"${version}"` } },
      }))).data
    },
    async deleteContent(module: ContentModule, contentId: string, version: number) {
      const result = await client.DELETE('/admin/content/{module}/{contentId}', {
        params: { path: { module, contentId }, header: { 'If-Match': `"${version}"` } },
      })
      if (result.error !== undefined || !result.response.ok) throw apiError(result.response, result.error)
    },
    async listContentRevisions(module: ContentModule, contentId: string) {
      return (await unwrap(client.GET('/admin/content/{module}/{contentId}/revisions', { params: { path: { module, contentId } } }))).data
    },
    async restoreContentRevision(module: ContentModule, contentId: string, revision: number, version: number) {
      return (await unwrap(client.POST('/admin/content/{module}/{contentId}/revisions/{revision}/restore', {
        params: { path: { module, contentId, revision }, header: { 'If-Match': `"${version}"` } },
      }))).data
    },
    async createNewsCoverUpload(contentId: string, input: CreateImageUploadInput, idempotencyKey: string) {
      return (await unwrap(client.POST('/admin/content/news/{contentId}/upload-sessions', {
        params: { path: { contentId }, header: { 'Idempotency-Key': idempotencyKey } }, body: input,
      }))).data
    },
    async completeNewsCoverUpload(contentId: string, assetId: string, version: number, input: CompleteImageUploadInput) {
      return (await unwrap(client.POST('/admin/content/news/{contentId}/assets/{assetId}/complete', {
        params: { path: { contentId, assetId }, header: { 'If-Match': `"${version}"` } }, body: input,
      }))).data
    },
    async getNewsCoverStatus(contentId: string, assetId: string, signal?: AbortSignal) {
      return (await unwrap(client.GET('/admin/content/news/{contentId}/assets/{assetId}', { params: { path: { contentId, assetId } }, signal }))).data
    },
    async retryNewsCoverScan(contentId: string, assetId: string) {
      return (await unwrap(client.POST('/admin/content/news/{contentId}/assets/{assetId}/scan/retry', { params: { path: { contentId, assetId } } }))).data
    },
    async listPublicContent(module: ContentModule, locale: BulletinLocale, signal?: AbortSignal) {
      return (await listPublicContentPage(module, locale, { signal })).data
    },
    listPublicContentPage,
    async getHome(locale: BulletinLocale, signal?: AbortSignal) {
      return (await unwrap(client.GET('/home', { params: { query: { locale } }, signal }))).data
    },
    async getNewsBySlug(locale: BulletinLocale, slug: string, signal?: AbortSignal) {
      return (await unwrap(client.GET('/news/{slug}', {
        params: { path: { slug }, query: { locale } },
        signal,
      }))).data
    },
  }
}

function apiError(response: Response, value: unknown) {
  const error = value && typeof value === 'object' && 'error' in value
    ? (value as { error?: { code?: string; message?: string } }).error
    : undefined
  return new HhcWebApiError(
    response.status,
    error?.code ?? 'request_failed',
    (error?.message ?? response.statusText) || 'Request failed.',
  )
}

export type HhcWebClient = ReturnType<typeof createHhcWebClient>

function absoluteBaseUrl(value: string) {
  const base = value.replace(/\/$/, '')
  if (/^https?:\/\//.test(base)) return base
  const origin = globalThis.location?.origin ?? 'http://localhost'
  return new URL(base || '/', origin).toString().replace(/\/$/, '')
}
